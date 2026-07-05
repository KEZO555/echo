package com.lightphone.spotify

import android.content.Context

/**
 * One-time native bootstrap for the vendored librespot engine.
 *
 * UniFFI loads libspotify_core.so through JNA, which does NOT register the
 * library with the JVM's JNI method resolver - so the hand-written
 * `Java_com_lightphone_spotify_NativeInit_*` symbols would not link. We call
 * [System.loadLibrary] here to register the same .so for JNI, then hand the
 * engine the application [Context] + JavaVM (needed by the AudioTrack sink,
 * which attaches the drain thread to the JVM to write PCM) and register the
 * sink class before any playback.
 *
 * Must run before the first `LibrespotEngine(...)` construction.
 */
object NativeInit {
  @Volatile private var initialised = false

  @Synchronized
  fun ensure(context: Context) {
    if (initialised) {
      return
    }
    System.loadLibrary("spotify_core")
    initAndroidContext(context.applicationContext)
    registerAudioSink()
    initialised = true
  }

  // Instance native methods (JNI symbol Java_com_lightphone_spotify_NativeInit_*).
  // The Rust side ignores the second (this/jclass) argument, so instance vs
  // static makes no difference to linkage; instance form avoids the
  // @JvmStatic+external codegen edge case.
  private external fun initAndroidContext(context: Context)
  private external fun registerAudioSink()
}
