package expo.modules.spotifyengine

import android.util.Log
import com.lightphone.spotify.ffi.LibrespotEngine
import com.lightphone.spotify.ffi.PlayerEventListener
import com.lightphone.spotify.ffi.RepeatMode
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Expo wrapper around the vendored librespot engine (rust/spotify-core).
 * Playback runs in-process; this module only marshals calls and events.
 */
class SpotifyEngineModule : Module() {

  private var engine: LibrespotEngine? = null

  companion object {
    const val TAG = "SpotifyEngineModule"
    const val PLAYER_EVENT = "onEnginePlayerEvent"
  }

  private fun requireEngine(): LibrespotEngine {
    engine?.let { return it }
    val context = appContext.reactContext
      ?: throw IllegalStateException("React context unavailable")
    val cacheDir = File(context.filesDir, "spotify-engine")
    if (!cacheDir.exists()) {
      cacheDir.mkdirs()
    }
    val created = LibrespotEngine(cacheDir.absolutePath)
    created.setListener(EventForwarder())
    engine = created
    return created
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
