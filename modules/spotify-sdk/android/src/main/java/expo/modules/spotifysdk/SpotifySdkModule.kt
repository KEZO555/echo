package expo.modules.spotifysdk

import android.app.Activity
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity

// Spotify Auth imports
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse

// Spotify App Remote imports
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.PlayerState
import com.spotify.protocol.types.Track

class SpotifySdkModule : Module() {

  private var spotifyAppRemote: SpotifyAppRemote? = null
  private var playerStateSubscription: Subscription<PlayerState>? = null

  override fun definition() = ModuleDefinition {
    Name("SpotifySdk")

    Constants(
      "AUTH_TOKEN_REFRESH_REQUEST_CODE" to 1337,
      "AUTH_TOKEN_REQUEST_CODE" to 1338
    )

    Events("onPlayerStateChanged", "onConnectionError", "onConnected", "onDisconnected")

    // Auth functions
    AsyncFunction("authorize") { clientId: String, redirectUri: String, scopes: Array<String>, promise: Promise ->
      try {
        val activity = appContext.currentActivity as? AppCompatActivity
        if (activity == null) {
          promise.reject("ACTIVITY_NOT_FOUND", "Current activity not found", null)
          return@AsyncFunction
        }

        val builder = AuthorizationRequest.Builder(clientId, AuthorizationResponse.Type.TOKEN, redirectUri)
        builder.setScopes(scopes)
        val request = builder.build()

        AuthorizationClient.openLoginActivity(activity, 1338, request)
        promise.resolve(mapOf("success" to true))
      } catch (e: Exception) {
        promise.reject("AUTH_ERROR", e.message, e)
      }
    }

    // App Remote functions
    AsyncFunction("connect") { clientId: String, redirectUri: String, promise: Promise ->
      try {
        val connectionParams = ConnectionParams.Builder(clientId)
          .setRedirectUri(redirectUri)
          .showAuthView(true)
          .build()

        SpotifyAppRemote.connect(appContext.reactContext, connectionParams, object : Connector.ConnectionListener {
          override fun onConnected(remote: SpotifyAppRemote) {
            spotifyAppRemote = remote

            // Subscribe to player state
            spotifyAppRemote?.playerApi?.subscribeToPlayerState()?.setEventCallback { playerState ->
              sendEvent("onPlayerStateChanged", mapOf(
                "track" to mapOf(
                  "uri" to playerState.track.uri,
                  "name" to playerState.track.name,
                  "artist" to mapOf(
                    "name" to playerState.track.artist.name,
                    "uri" to playerState.track.artist.uri
                  ),
                  "album" to mapOf(
                    "name" to playerState.track.album.name,
                    "uri" to playerState.track.album.uri
                  ),
                  "imageUri" to playerState.track.imageUri.raw,
                  "duration" to playerState.track.duration,
                  "isPodcast" to playerState.track.isPodcast,
                  "isEpisode" to playerState.track.isEpisode
                ),
                "playbackPosition" to playerState.playbackPosition,
                "playbackSpeed" to playerState.playbackSpeed,
                "isPaused" to playerState.isPaused,
                "playbackOptions" to mapOf(
                  "isShuffling" to playerState.playbackOptions.isShuffling,
                  "repeatMode" to playerState.playbackOptions.repeatMode
                ),
                "playbackRestrictions" to mapOf(
                  "canSkipNext" to playerState.playbackRestrictions.canSkipNext,
                  "canSkipPrev" to playerState.playbackRestrictions.canSkipPrev,
                  "canRepeatTrack" to playerState.playbackRestrictions.canRepeatTrack,
                  "canRepeatContext" to playerState.playbackRestrictions.canRepeatContext,
                  "canToggleShuffle" to playerState.playbackRestrictions.canToggleShuffle,
                  "canSeek" to playerState.playbackRestrictions.canSeek
                )
              ))
            }

            sendEvent("onConnected", mapOf("connected" to true))
            promise.resolve(mapOf("connected" to true))
          }

          override fun onFailure(error: Throwable) {
            sendEvent("onConnectionError", mapOf("error" to error.message))
            promise.reject("CONNECTION_ERROR", error.message, error)
          }
        })
      } catch (e: Exception) {
        promise.reject("CONNECT_ERROR", e.message, e)
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        playerStateSubscription?.cancel()
        SpotifyAppRemote.disconnect(spotifyAppRemote)
        spotifyAppRemote = null
        sendEvent("onDisconnected", mapOf("disconnected" to true))
        promise.resolve(mapOf("disconnected" to true))
      } catch (e: Exception) {
        promise.reject("DISCONNECT_ERROR", e.message, e)
      }
    }

    AsyncFunction("play") { uri: String, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.play(uri)?.setResultCallback {
          promise.resolve(mapOf("playing" to true))
        }?.setErrorCallback { error ->
          promise.reject("PLAY_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("PLAY_ERROR", e.message, e)
      }
    }

    AsyncFunction("pause") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.pause()?.setResultCallback {
          promise.resolve(mapOf("paused" to true))
        }?.setErrorCallback { error ->
          promise.reject("PAUSE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("PAUSE_ERROR", e.message, e)
      }
    }

    AsyncFunction("resume") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.resume()?.setResultCallback {
          promise.resolve(mapOf("resumed" to true))
        }?.setErrorCallback { error ->
          promise.reject("RESUME_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("RESUME_ERROR", e.message, e)
      }
    }

    AsyncFunction("skipNext") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.skipNext()?.setResultCallback {
          promise.resolve(mapOf("skipped" to true))
        }?.setErrorCallback { error ->
          promise.reject("SKIP_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("SKIP_ERROR", e.message, e)
      }
    }

    AsyncFunction("skipPrevious") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.skipPrevious()?.setResultCallback {
          promise.resolve(mapOf("skipped" to true))
        }?.setErrorCallback { error ->
          promise.reject("SKIP_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("SKIP_ERROR", e.message, e)
      }
    }

    AsyncFunction("seekTo") { positionMs: Long, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.seekTo(positionMs)?.setResultCallback {
          promise.resolve(mapOf("seeked" to true))
        }?.setErrorCallback { error ->
          promise.reject("SEEK_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("SEEK_ERROR", e.message, e)
      }
    }

    AsyncFunction("setShuffle") { shuffle: Boolean, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.setShuffle(shuffle)?.setResultCallback {
          promise.resolve(mapOf("shuffleSet" to true))
        }?.setErrorCallback { error ->
          promise.reject("SHUFFLE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("SHUFFLE_ERROR", e.message, e)
      }
    }

    AsyncFunction("setRepeat") { repeatMode: Int, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.setRepeat(repeatMode)?.setResultCallback {
          promise.resolve(mapOf("repeatSet" to true))
        }?.setErrorCallback { error ->
          promise.reject("REPEAT_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("REPEAT_ERROR", e.message, e)
      }
    }

    AsyncFunction("getPlayerState") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.playerState?.setResultCallback { playerState ->
          promise.resolve(mapOf(
            "track" to mapOf(
              "uri" to playerState.track.uri,
              "name" to playerState.track.name,
              "artist" to mapOf(
                "name" to playerState.track.artist.name,
                "uri" to playerState.track.artist.uri
              ),
              "album" to mapOf(
                "name" to playerState.track.album.name,
                "uri" to playerState.track.album.uri
              ),
              "imageUri" to playerState.track.imageUri.raw,
              "duration" to playerState.track.duration,
              "isPodcast" to playerState.track.isPodcast,
              "isEpisode" to playerState.track.isEpisode
            ),
            "playbackPosition" to playerState.playbackPosition,
            "playbackSpeed" to playerState.playbackSpeed,
            "isPaused" to playerState.isPaused,
            "playbackOptions" to mapOf(
              "isShuffling" to playerState.playbackOptions.isShuffling,
              "repeatMode" to playerState.playbackOptions.repeatMode
            ),
            "playbackRestrictions" to mapOf(
              "canSkipNext" to playerState.playbackRestrictions.canSkipNext,
              "canSkipPrev" to playerState.playbackRestrictions.canSkipPrev,
              "canRepeatTrack" to playerState.playbackRestrictions.canRepeatTrack,
              "canRepeatContext" to playerState.playbackRestrictions.canRepeatContext,
              "canToggleShuffle" to playerState.playbackRestrictions.canToggleShuffle,
              "canSeek" to playerState.playbackRestrictions.canSeek
            )
          ))
        }?.setErrorCallback { error ->
          promise.reject("PLAYER_STATE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("PLAYER_STATE_ERROR", e.message, e)
      }
    }
  }
}
