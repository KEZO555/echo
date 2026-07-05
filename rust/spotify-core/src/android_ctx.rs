//! Android process bootstrap.
//!
//! cpal's AAudio backend (reached via rodio) reads the `JavaVM` and Android
//! `Context` from the global `ndk_context`. In a normal NativeActivity app that
//! is populated for us, but a Jetpack Compose app that merely `loadLibrary()`s
//! this `.so` never triggers that path, so the first audio call would panic with
//! "android context was not initialized". `JNI_OnLoad`'s reserved arg is also
//! null, so the real `applicationContext` must be handed to us from Kotlin.
//!
//! Kotlin calls `NativeInit.initAndroidContext(applicationContext)` once at
//! process start, before any playback. We also stash the `JavaVM` here so the
//! tokio runtime can permanently attach its worker threads to the JVM (cheap
//! callbacks into Kotlin instead of JNA attach/detach per call).

#![cfg(target_os = "android")]

use std::ffi::c_void;
use std::sync::{Mutex, Once, OnceLock};

use jni::objects::{GlobalRef, JClass, JObject};
use jni::{JNIEnv, JavaVM};

// Bounded ring of recent log lines, mirrored from the `log` facade so the app
// can surface librespot's own failure reasons (e.g. why a track is
// "unavailable") without a USB logcat.
static LOG_RING: Mutex<Vec<String>> = Mutex::new(Vec::new());
const LOG_RING_CAP: usize = 150;
static LOGGER_INIT: Once = Once::new();

fn capture_log(record: &log::Record) {
    let target = record.target();
    // Keep all warnings/errors, plus librespot/engine info lines for context.
    let keep = record.level() <= log::Level::Warn
        || target.starts_with("librespot")
        || target.starts_with("spotify_core");
    if !keep {
        return;
    }
    let msg = format!("{}", record.args());
    // The MP3/Ogg resync warnings can fire thousands of times for a single
    // undecodable track and would otherwise evict the real cause (e.g. the
    // audio-key failure) from the ring before it can be read. Drop that spam.
    if msg.contains("skipping junk")
        || msg.contains("invalid mpeg audio header")
        || msg.contains("invalid main_data")
    {
        return;
    }
    let line = format!("{}: {}", record.level(), msg);
    if let Ok(mut ring) = LOG_RING.lock() {
        if ring.len() >= LOG_RING_CAP {
            ring.remove(0);
        }
        ring.push(line);
    }
}

/// Recent captured log lines (oldest first) for in-app diagnostics.
pub fn recent_logs() -> Vec<String> {
    LOG_RING.lock().map(|ring| ring.clone()).unwrap_or_default()
}

/// Tees the `log` facade to logcat (android_logger) and the in-memory ring.
struct TeeLogger {
    inner: android_logger::AndroidLogger,
}

impl log::Log for TeeLogger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        self.inner.enabled(metadata)
    }

    fn log(&self, record: &log::Record) {
        self.inner.log(record);
        capture_log(record);
    }

    fn flush(&self) {
        self.inner.flush();
    }
}

// Keep the Context global ref pinned for the whole process lifetime; ndk_context
// stores only a raw pointer to it.
static ANDROID_CONTEXT: OnceLock<GlobalRef> = OnceLock::new();
static JAVA_VM: OnceLock<JavaVM> = OnceLock::new();

/// Pointer to the process `JavaVM`, used by the runtime thread-attach hook.
pub fn java_vm() -> Option<&'static JavaVM> {
    JAVA_VM.get()
}

/// Permanently attach the current (Rust-spawned) thread to the JVM. Called from
/// the tokio runtime's `on_thread_start` so event callbacks into Kotlin do not
/// pay JNA's per-call attach/detach cost.
pub fn attach_current_thread_permanently() {
    if let Some(vm) = JAVA_VM.get() {
        let _ = vm.attach_current_thread_permanently();
    }
}

#[no_mangle]
pub extern "system" fn Java_com_lightphone_spotify_NativeInit_initAndroidContext(
    mut env: JNIEnv,
    _class: JClass,
    context: JObject,
) {
    if ANDROID_CONTEXT.get().is_some() {
        return;
    }

    let global = match env.new_global_ref(&context) {
        Ok(g) => g,
        Err(e) => {
            log::error!("initAndroidContext: failed to create global ref: {e}");
            return;
        }
    };

    let vm = match env.get_java_vm() {
        Ok(vm) => vm,
        Err(e) => {
            log::error!("initAndroidContext: failed to get JavaVM: {e}");
            return;
        }
    };

    let vm_ptr = vm.get_java_vm_pointer() as *mut c_void;
    let ctx_ptr = global.as_obj().as_raw() as *mut c_void;

    // ndk_context is only required for cpal/AAudio (rodio backend).
    #[cfg(feature = "rodio-sink")]
    unsafe {
        ndk_context::initialize_android_context(vm_ptr, ctx_ptr);
    }

    let _ = JAVA_VM.set(vm);
    let _ = ANDROID_CONTEXT.set(global);

    if let Ok(sdk) = read_android_sdk_int(&mut env) {
        log::info!("Android SDK {sdk} (not used for wire identity)");
    }
    // ASSUMPTION: the session client ID is forced to the Keymaster (desktop) ID in
    // EngineShared::new (session_config.client_id = auth::CLIENT_ID). Because of that,
    // we present as the Linux desktop client on the wire, so the reported OS version
    // must be the desktop value "0", NOT the Android SDK int, and
    // set_http_platform_override("linux") is set in EngineShared::new.
    //
    // IF FUTURE WORK switches Android to a native Android client ID (the android
    // platform branch), this "0" becomes WRONG: that branch requires a real Android
    // SDK version (>= 21) or client-token/login5 will reject it. In that case, set
    // the real SDK int here and drop the "linux" platform override. Do not inherit
    // "0" blindly into non-Keymaster identity work.
    librespot::core::config::set_os_version_override("0");
    log::info!("OS version override set to desktop \"0\" for Keymaster/Linux identity");

    log::info!("Android context initialized (JavaVM stashed)");
}

fn read_android_sdk_int(env: &mut JNIEnv) -> jni::errors::Result<i32> {
    let version_class = env.find_class("android/os/Build$VERSION")?;
    env.get_static_field(version_class, "SDK_INT", "I")?.i()
}

/// Initialize Android logging so `log::*` shows up in logcat and the in-app
/// diagnostics ring. Idempotent.
pub fn init_logging() {
    use android_logger::{AndroidLogger, Config};
    LOGGER_INIT.call_once(|| {
        let android = AndroidLogger::new(
            Config::default()
                .with_max_level(log::LevelFilter::Info)
                .with_tag("spotify-core"),
        );
        if log::set_boxed_logger(Box::new(TeeLogger { inner: android })).is_ok() {
            log::set_max_level(log::LevelFilter::Info);
        }
    });
}
