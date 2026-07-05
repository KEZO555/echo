package expo.modules.spotifyengine

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.lightphone.spotify.NativeInit
import com.lightphone.spotify.ffi.LibrespotEngine
import com.lightphone.spotify.ffi.PlayerEventListener
import com.lightphone.spotify.ffi.RepeatMode
import com.lightphone.spotify.ffi.StreamingQuality
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Expo wrapper around the vendored librespot engine (rust/spotify-core).
 * Playback runs in-process; this module only marshals calls and events.
 */
class SpotifyEngineModule : Module() {

  private var engine: LibrespotEngine? = null
  private var pendingLoginPromise: Promise? = null

  companion object {
    const val TAG = "SpotifyEngineModule"
    const val PLAYER_EVENT = "onEnginePlayerEvent"
    const val LOGIN_REQUEST_CODE = 0x5E10
  }

  private fun requireEngine(): LibrespotEngine {
    engine?.let { return it }
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context unavailable")
    // Load the native lib for JNI, stash the JavaVM/Context, and register the
    // AudioTrack sink before the engine is built - without this the engine
    // decodes audio but has nowhere to send PCM, so playback is silent.
    NativeInit.ensure(context)
    val cacheDir = File(context.filesDir, "spotify-engine")
    if (!cacheDir.exists()) {
      cacheDir.mkdirs()
    }
    val created = LibrespotEngine(cacheDir.absolutePath)
    created.setListener(EventForwarder())
    // Default to the highest fidelity librespot can request: 320 kbps Vorbis
    // plus gapless. (Spotify lossless is not available through librespot.)
    // Persisted in the engine's settings.json, so this also survives restarts.
    try {
      created.setStreamingQuality(StreamingQuality.HIGH)
      created.setGaplessEnabled(true)
    } catch (error: Exception) {
      Log.w(TAG, "Failed to apply high-quality audio defaults", error)
    }
    engine = created
    return created
  }

  private fun streamingQualityToString(quality: StreamingQuality): String =
    when (quality) {
      StreamingQuality.LOW -> "low"
      StreamingQuality.NORMAL -> "normal"
      StreamingQuality.HIGH -> "high"
    }

  private fun streamingQualityFromString(value: String): StreamingQuality =
    when (value) {
      "low" -> StreamingQuality.LOW
      "high" -> StreamingQuality.HIGH
      else -> StreamingQuality.NORMAL
    }

  private inner class EventForwarder : PlayerEventListener {
    private fun emit(type: String, extras: Map<String, Any?> = emptyMap()) {
      try {
        sendEvent(PLAYER_EVENT, mapOf("type" to type) + extras)
      } catch (error: Exception) {
        Log.w(TAG, "Failed to emit engine event $type", error)
      }
    }

    override fun onTrackChanged(uri: String) = emit("trackChanged", mapOf("uri" to uri))
    override fun onLoading() = emit("loading")
    override fun onPlaying(positionMs: Long) = emit("playing", mapOf("positionMs" to positionMs))
    override fun onPaused(positionMs: Long) = emit("paused", mapOf("positionMs" to positionMs))
    override fun onPositionChanged(positionMs: Long) =
      emit("positionChanged", mapOf("positionMs" to positionMs))
    override fun onEndOfTrack() = emit("endOfTrack")
    override fun onUnavailable(uri: String) = emit("unavailable", mapOf("uri" to uri))
    override fun onConnectionLost() = emit("connectionLost")
    override fun onConnectionRestored() = emit("connectionRestored")
    override fun onError(message: String) = emit("error", mapOf("message" to message))
    override fun onQueueChanged() = emit("queueChanged")
    override fun onBuffering(stalled: Boolean) = emit("buffering", mapOf("stalled" to stalled))
  }

  private fun repeatModeToString(mode: RepeatMode): String = when (mode) {
    RepeatMode.OFF -> "off"
    RepeatMode.CONTEXT -> "context"
    RepeatMode.TRACK -> "track"
  }

  override fun definition() = ModuleDefinition {
    Name("SpotifyEngine")

    Events(PLAYER_EVENT)

    AsyncFunction("beginLogin") {
      requireEngine().beginLogin()
    }

    AsyncFunction("loginWithOauthCode") { code: String ->
      requireEngine().loginWithOauthCode(code)
      mapOf("loggedIn" to true)
    }

    // One-shot interactive login: opens a WebView on the OAuth page, waits
    // for the intercepted redirect code, then exchanges it for a session.
    AsyncFunction("loginInteractive") { promise: Promise ->
      val activity = appContext.currentActivity
        ?: throw IllegalStateException("No foreground activity for login")
      if (pendingLoginPromise != null) {
        throw IllegalStateException("A login is already in progress")
      }
      val authUrl = requireEngine().beginLogin()
      pendingLoginPromise = promise
      val intent = Intent(activity, EngineLoginActivity::class.java)
      intent.putExtra(EngineLoginActivity.EXTRA_AUTH_URL, authUrl)
      activity.startActivityForResult(intent, LOGIN_REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == LOGIN_REQUEST_CODE) {
        val promise = pendingLoginPromise
        pendingLoginPromise = null
        if (promise != null) {
          val code = payload.data?.getStringExtra(EngineLoginActivity.RESULT_CODE)
          if (payload.resultCode == Activity.RESULT_OK && !code.isNullOrEmpty()) {
            // The code exchange and session rebuild do blocking network work.
            Thread {
              try {
                requireEngine().loginWithOauthCode(code)
                promise.resolve(mapOf("loggedIn" to true, "cancelled" to false))
              } catch (error: Exception) {
                Log.w(TAG, "Engine login failed", error)
                promise.reject("ERR_ENGINE_LOGIN", error.message ?: "Login failed", error)
              }
            }.start()
          } else {
            promise.resolve(mapOf("loggedIn" to false, "cancelled" to true))
          }
        }
      }
    }

    AsyncFunction("loginWithCachedCredentials") {
      mapOf("loggedIn" to requireEngine().loginWithCachedCredentials())
    }

    AsyncFunction("isLoggedIn") {
      requireEngine().isLoggedIn()
    }

    AsyncFunction("logout") {
      engine?.logout()
    }

    AsyncFunction("playUri") { uri: String ->
      requireEngine().playUri(uri)
    }

    AsyncFunction("playUris") { uris: List<String>, startIndex: Int, contextLabel: String? ->
      requireEngine().playUris(uris, startIndex.toUInt(), contextLabel)
    }

    AsyncFunction("pause") { requireEngine().pause() }
    AsyncFunction("resume") { requireEngine().resume() }
    AsyncFunction("next") { requireEngine().next() }
    AsyncFunction("previous") { requireEngine().previous() }

    AsyncFunction("seek") { positionMs: Int ->
      requireEngine().seek(positionMs.toUInt())
    }

    AsyncFunction("getShuffle") { requireEngine().getShuffle() }
    AsyncFunction("toggleShuffle") { requireEngine().toggleShuffle() }

    AsyncFunction("getRepeatMode") {
      repeatModeToString(requireEngine().getRepeatMode())
    }

    AsyncFunction("toggleRepeat") {
      repeatModeToString(requireEngine().toggleRepeat())
    }

    AsyncFunction("getQueue") {
      val snapshot = requireEngine().getQueue()
      mapOf(
        "nowPlayingUri" to snapshot.nowPlayingUri,
        "nextInQueue" to snapshot.nextInQueue,
        "contextLabel" to snapshot.contextLabel,
        "nextFromContext" to snapshot.nextFromContext,
      )
    }

    AsyncFunction("addToQueue") { uri: String ->
      requireEngine().addToQueue(uri)
    }

    AsyncFunction("moveQueueItemUp") { index: Int ->
      requireEngine().moveQueueItemUp(index.toUInt())
    }

    AsyncFunction("moveQueueItemDown") { index: Int ->
      requireEngine().moveQueueItemDown(index.toUInt())
    }

    AsyncFunction("moveContextItemUp") { index: Int ->
      requireEngine().moveContextItemUp(index.toUInt())
    }

    AsyncFunction("moveContextItemDown") { index: Int ->
      requireEngine().moveContextItemDown(index.toUInt())
    }

    AsyncFunction("clearManualQueue") {
      requireEngine().clearManualQueue()
    }

    AsyncFunction("getVolume") { requireEngine().getVolume().toInt() }

    AsyncFunction("setVolume") { percent: Int ->
      requireEngine().setVolume(percent.toUByte())
    }

    AsyncFunction("getStreamingQuality") {
      streamingQualityToString(requireEngine().getStreamingQuality())
    }

    AsyncFunction("setStreamingQuality") { value: String ->
      requireEngine().setStreamingQuality(streamingQualityFromString(value))
    }

    AsyncFunction("getGaplessEnabled") { requireEngine().getGaplessEnabled() }

    AsyncFunction("setGaplessEnabled") { enabled: Boolean ->
      requireEngine().setGaplessEnabled(enabled)
    }

    AsyncFunction("getDebugMetrics") {
      val m = requireEngine().playbackDebugMetrics()
      mapOf(
        "transportReconnect" to m.transportReconnect.toInt(),
        "fullRebuild" to m.fullRebuild.toInt(),
        "stallEvents" to m.stallEvents.toInt(),
        "sinkRecreate" to m.sinkRecreate.toInt(),
        "audiotrackWriteErrors" to m.audiotrackWriteErrors.toInt(),
        "audiotrackRoutingEvents" to m.audiotrackRoutingEvents.toInt(),
        "sinkBackend" to m.sinkBackend,
        "ringOccupancyMs" to m.ringOccupancyMs.toInt(),
        "pendingOutputMs" to m.pendingOutputMs.toInt(),
        "producerBlockMs" to m.producerBlockMs.toInt(),
        "drainPartialWrites" to m.drainPartialWrites.toInt(),
      )
    }

    AsyncFunction("getRecentLogs") {
      requireEngine().recentEngineLogs()
    }

    AsyncFunction("isSessionConnected") {
      requireEngine().isSessionConnected()
    }

    AsyncFunction("forceReconnectCheck") {
      requireEngine().forceReconnectCheck()
    }

    OnDestroy {
      // Keep cached credentials; just stop audio. The Rust engine cleans up
      // its session when the process ends.
      engine?.pause()
    }
  }
}
