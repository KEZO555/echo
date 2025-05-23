package expo.modules.spotifysdk

import android.app.Activity
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import androidx.appcompat.app.AppCompatActivity
import android.util.Log

// Spotify Auth imports
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse

// Spotify App Remote imports
import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.protocol.client.Subscription
import com.spotify.protocol.types.*

class SpotifySdkModule : Module() {

  // App Remote instance
  private var spotifyAppRemote: SpotifyAppRemote? = null

  // Subscriptions management
  private var playerStateSubscription: Subscription<PlayerState>? = null
  private var capabilitiesSubscription: Subscription<Capabilities>? = null

  // Auth state management
  private var currentAuthPromise: Promise? = null
  private var accessToken: String? = null

  // Connection parameters for lifecycle management
  private var lastConnectionParams: ConnectionParams? = null
  private var shouldAutoConnect: Boolean = false
  private var isAuthenticating: Boolean = false

  // Preferences for storing auth data
  private val prefsName = "spotify_sdk_prefs"
  private val accessTokenKey = "access_token"
  private val expiresAtKey = "expires_at"

  // Request codes
  companion object {
    const val AUTH_TOKEN_REQUEST_CODE = 1338
    const val AUTH_CODE_REQUEST_CODE = 1339
    const val TAG = "SpotifySdkModule"
  }

  override fun definition() = ModuleDefinition {
    Name("SpotifySdk")

    Constants(
      "AUTH_TOKEN_REFRESH_REQUEST_CODE" to 1337,
      "AUTH_TOKEN_REQUEST_CODE" to AUTH_TOKEN_REQUEST_CODE
    )

    Events(
      "onPlayerStateChanged",
      "onConnectionError",
      "onConnected",
      "onDisconnected",
      "onAuthComplete",
      "onCapabilitiesChanged",
      "onUserLoggedIn",
      "onUserLoggedOut",
      "onActivityStarted",
      "onActivityStopped"
    )

    // Activity lifecycle handlers for proper connection management
    OnActivityEntersForeground {
      Log.d(TAG, "Activity entered foreground - checking for auto-reconnect")
      if (shouldAutoConnect && lastConnectionParams != null) {
        Log.d(TAG, "Auto-reconnecting to Spotify App Remote")
        connectInternal(lastConnectionParams!!)
      }
    }

    OnActivityEntersBackground {
      Log.d(TAG, "Activity entered background - checking if authentication is in progress")
      if (isAuthenticating) {
        Log.d(TAG, "Authentication in progress - skipping disconnect to prevent auth interference")
        sendEvent("onActivityStopped", mapOf("background" to true, "skipDisconnect" to true))
      } else {
        Log.d(TAG, "Disconnecting from Spotify App Remote")
        disconnectInternal()
        sendEvent("onActivityStopped", mapOf("background" to true))
      }
    }

    // ========================
    // AUTH SDK IMPLEMENTATION
    // ========================

    AsyncFunction("authorize") { config: Map<String, Any>, promise: Promise ->
      try {
        val activity = appContext.currentActivity as? AppCompatActivity
        if (activity == null) {
          promise.reject("ACTIVITY_NOT_FOUND", "Current activity not found", null)
          return@AsyncFunction
        }

        val clientId = config["clientId"] as? String ?: throw IllegalArgumentException("clientId required")
        val redirectUri = config["redirectUri"] as? String ?: throw IllegalArgumentException("redirectUri required")
        val scopes = config["scopes"] as? List<String> ?: throw IllegalArgumentException("scopes required")
        val showDialog = config["showDialog"] as? Boolean ?: false
        val state = config["state"] as? String
        val responseType = config["responseType"] as? String ?: "token"

        currentAuthPromise = promise
        isAuthenticating = true // Set flag to prevent lifecycle disconnection during auth

        val requestType = if (responseType == "code") {
          AuthorizationResponse.Type.CODE
        } else {
          AuthorizationResponse.Type.TOKEN
        }

        val builder = AuthorizationRequest.Builder(clientId, requestType, redirectUri)
        builder.setScopes(scopes.toTypedArray())
        if (showDialog) builder.setShowDialog(true)
        if (state != null) builder.setState(state)

        val request = builder.build()
        val requestCode = if (responseType == "code") AUTH_CODE_REQUEST_CODE else AUTH_TOKEN_REQUEST_CODE

        AuthorizationClient.openLoginActivity(activity, requestCode, request)

        // Promise will be resolved in activity result handler
      } catch (e: Exception) {
        Log.e(TAG, "Authorization error", e)
        isAuthenticating = false // Clear flag on error
        promise.reject("AUTH_ERROR", e.message, e)
      }
    }

    AsyncFunction("authorizeWithCode") { clientId: String, redirectUri: String, scopes: Array<String>, state: String?, showDialog: Boolean?, promise: Promise ->
      try {
        val activity = appContext.currentActivity as? AppCompatActivity
        if (activity == null) {
          promise.reject("ACTIVITY_NOT_FOUND", "Current activity not found", null)
          return@AsyncFunction
        }

        currentAuthPromise = promise
        isAuthenticating = true // Set flag to prevent lifecycle disconnection during auth

        val builder = AuthorizationRequest.Builder(clientId, AuthorizationResponse.Type.CODE, redirectUri)
        builder.setScopes(scopes)
        if (showDialog == true) builder.setShowDialog(true)
        if (state != null) builder.setState(state)

        val request = builder.build()
        AuthorizationClient.openLoginActivity(activity, AUTH_CODE_REQUEST_CODE, request)
      } catch (e: Exception) {
        Log.e(TAG, "Authorization error", e)
        isAuthenticating = false // Clear flag on error
        promise.reject("AUTH_ERROR", e.message, e)
      }
    }

    AsyncFunction("authorizeWithToken") { clientId: String, redirectUri: String, scopes: Array<String>, state: String?, showDialog: Boolean?, promise: Promise ->
      try {
        val activity = appContext.currentActivity as? AppCompatActivity
        if (activity == null) {
          promise.reject("ACTIVITY_NOT_FOUND", "Current activity not found", null)
          return@AsyncFunction
        }

        currentAuthPromise = promise
        isAuthenticating = true // Set flag to prevent lifecycle disconnection during auth

        val builder = AuthorizationRequest.Builder(clientId, AuthorizationResponse.Type.TOKEN, redirectUri)
        builder.setScopes(scopes)
        if (showDialog == true) builder.setShowDialog(true)
        if (state != null) builder.setState(state)

        val request = builder.build()
        AuthorizationClient.openLoginActivity(activity, AUTH_TOKEN_REQUEST_CODE, request)
      } catch (e: Exception) {
        Log.e(TAG, "Authorization error", e)
        isAuthenticating = false // Clear flag on error
        promise.reject("AUTH_ERROR", e.message, e)
      }
    }

    AsyncFunction("getAccessToken") { promise: Promise ->
      try {
        val prefs = appContext.reactContext?.getSharedPreferences(prefsName, 0)
        val token = prefs?.getString(accessTokenKey, null)
        val expiresAt = prefs?.getLong(expiresAtKey, 0L) ?: 0L

        if (token != null && System.currentTimeMillis() < expiresAt) {
          promise.resolve(token)
        } else {
          promise.resolve(null)
        }
      } catch (e: Exception) {
        promise.reject("TOKEN_ERROR", e.message, e)
      }
    }

    AsyncFunction("clearSession") { promise: Promise ->
      try {
        val prefs = appContext.reactContext?.getSharedPreferences(prefsName, 0)
        prefs?.edit()?.clear()?.apply()
        accessToken = null
        promise.resolve(mapOf("cleared" to true))
      } catch (e: Exception) {
        promise.reject("CLEAR_ERROR", e.message, e)
      }
    }

    AsyncFunction("isUserLoggedIn") { promise: Promise ->
      try {
        val prefs = appContext.reactContext?.getSharedPreferences(prefsName, 0)
        val token = prefs?.getString(accessTokenKey, null)
        val expiresAt = prefs?.getLong(expiresAtKey, 0L) ?: 0L

        val isLoggedIn = token != null && System.currentTimeMillis() < expiresAt
        promise.resolve(isLoggedIn)
      } catch (e: Exception) {
        promise.reject("LOGIN_CHECK_ERROR", e.message, e)
      }
    }

    AsyncFunction("clearCookies") { promise: Promise ->
      try {
        // Clear session data - note: clearCookies may not be available in all SDK versions
        val prefs = appContext.reactContext?.getSharedPreferences(prefsName, 0)
        prefs?.edit()?.clear()?.apply()
        promise.resolve(mapOf("cleared" to true))
      } catch (e: Exception) {
        promise.reject("CLEAR_COOKIES_ERROR", e.message, e)
      }
    }

    // ===============================
    // APP REMOTE SDK IMPLEMENTATION
    // ===============================

    AsyncFunction("connect") { clientId: String, redirectUri: String, promise: Promise ->
      try {
        val connectionParams = ConnectionParams.Builder(clientId)
          .setRedirectUri(redirectUri)
          .showAuthView(true)
          .build()

        // Store connection parameters for lifecycle management
        lastConnectionParams = connectionParams
        shouldAutoConnect = true
        currentAuthPromise = promise

        // Check if we're already connected
        if (spotifyAppRemote?.isConnected == true) {
          Log.d(TAG, "Already connected to Spotify App Remote")
          promise.resolve(mapOf("connected" to true))
          return@AsyncFunction
        }

        // Connect using internal method
        connectInternal(connectionParams)
      } catch (e: Exception) {
        Log.e(TAG, "Connect error", e)
        promise.reject("CONNECT_ERROR", e.message, e)
      }
    }

    AsyncFunction("disconnect") { promise: Promise ->
      try {
        // Disable auto-reconnect when manually disconnecting
        shouldAutoConnect = false
        currentAuthPromise = promise

        disconnectInternal()
      } catch (e: Exception) {
        Log.e(TAG, "Disconnect error", e)
        promise.reject("DISCONNECT_ERROR", e.message, e)
      }
    }

    AsyncFunction("isConnected") { promise: Promise ->
      try {
        val connected = spotifyAppRemote?.isConnected ?: false
        promise.resolve(connected)
      } catch (e: Exception) {
        promise.reject("CONNECTION_CHECK_ERROR", e.message, e)
      }
    }

    AsyncFunction("enableAutoConnect") { enable: Boolean, promise: Promise ->
      try {
        shouldAutoConnect = enable
        Log.d(TAG, "Auto-connect ${if (enable) "enabled" else "disabled"}")
        promise.resolve(mapOf("autoConnect" to enable))
      } catch (e: Exception) {
        promise.reject("AUTO_CONNECT_ERROR", e.message, e)
      }
    }

    // ========================
    // PLAYBACK CONTROL
    // ========================

    AsyncFunction("play") { uri: String?, promise: Promise ->
      try {
        val playerApi = spotifyAppRemote?.playerApi
        if (playerApi == null) {
          promise.reject("NOT_CONNECTED", "Spotify not connected", null)
          return@AsyncFunction
        }

        val result = if (uri != null) {
          playerApi.play(uri)
        } else {
          playerApi.resume()
        }

        result.setResultCallback {
          promise.resolve(mapOf("playing" to true))
        }.setErrorCallback { error ->
          Log.e(TAG, "Play error", error)
          promise.reject("PLAY_ERROR", error.message, error)
        }
      } catch (e: Exception) {
        promise.reject("PLAY_ERROR", e.message, e)
      }
    }

    AsyncFunction("playWithOptions") { uri: String, startPosition: Long?, promise: Promise ->
      try {
        val playerApi = spotifyAppRemote?.playerApi
        if (playerApi == null) {
          promise.reject("NOT_CONNECTED", "Spotify not connected", null)
          return@AsyncFunction
        }

        // Play the track first, then seek if position is provided
        val result = playerApi.play(uri)

        result.setResultCallback {
          if (startPosition != null) {
            playerApi.seekTo(startPosition).setResultCallback {
              promise.resolve(mapOf("playing" to true))
            }.setErrorCallback { error ->
              promise.reject("SEEK_ERROR", error.message, error)
            }
          } else {
            promise.resolve(mapOf("playing" to true))
          }
        }.setErrorCallback { error ->
          promise.reject("PLAY_ERROR", error.message, error)
        }
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

    // ========================
    // QUEUE MANAGEMENT
    // ========================

    AsyncFunction("queue") { uri: String, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.queue(uri)?.setResultCallback {
          promise.resolve(mapOf("queued" to true))
        }?.setErrorCallback { error ->
          promise.reject("QUEUE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("QUEUE_ERROR", e.message, e)
      }
    }

    AsyncFunction("addToQueue") { uri: String, promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.queue(uri)?.setResultCallback {
          promise.resolve(mapOf("added" to true))
        }?.setErrorCallback { error ->
          promise.reject("QUEUE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("QUEUE_ERROR", e.message, e)
      }
    }

    // ========================
    // STATE MANAGEMENT
    // ========================

    AsyncFunction("getPlayerState") { promise: Promise ->
      try {
        spotifyAppRemote?.playerApi?.playerState?.setResultCallback { playerState ->
          promise.resolve(playerStateToMap(playerState))
        }?.setErrorCallback { error ->
          promise.reject("PLAYER_STATE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("PLAYER_STATE_ERROR", e.message, e)
      }
    }

    AsyncFunction("subscribeToPlayerState") { promise: Promise ->
      try {
        subscribeToPlayerStateInternal()
        promise.resolve(mapOf("subscribed" to true))
      } catch (e: Exception) {
        promise.reject("SUBSCRIBE_ERROR", e.message, e)
      }
    }

    AsyncFunction("unsubscribeFromPlayerState") { promise: Promise ->
      try {
        playerStateSubscription?.cancel()
        playerStateSubscription = null
        promise.resolve(mapOf("unsubscribed" to true))
      } catch (e: Exception) {
        promise.reject("UNSUBSCRIBE_ERROR", e.message, e)
      }
    }

    // ========================
    // USER CAPABILITIES
    // ========================

    AsyncFunction("getUserCapabilities") { promise: Promise ->
      try {
        spotifyAppRemote?.userApi?.capabilities?.setResultCallback { capabilities ->
          promise.resolve(mapOf(
            "canPlayOnDemand" to capabilities.canPlayOnDemand
          ))
        }?.setErrorCallback { error ->
          promise.reject("CAPABILITIES_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("CAPABILITIES_ERROR", e.message, e)
      }
    }

    AsyncFunction("subscribeToCapabilities") { promise: Promise ->
      try {
        subscribeToCapabilitiesInternal()
        promise.resolve(mapOf("subscribed" to true))
      } catch (e: Exception) {
        promise.reject("CAPABILITIES_SUBSCRIBE_ERROR", e.message, e)
      }
    }

    // ========================
    // CONTENT API
    // ========================

    AsyncFunction("getRecommendedContentItems") { contentType: String?, promise: Promise ->
      try {
        val type = contentType ?: "default"
        spotifyAppRemote?.contentApi?.getRecommendedContentItems(type)?.setResultCallback { items ->
          val itemsList = items.items.map { item ->
            mapOf(
              "id" to item.id,
              "uri" to item.uri,
              "name" to item.title,
              "subtitle" to item.subtitle,
              "playable" to item.playable,
              "imageUri" to item.imageUri?.raw
            )
          }
          promise.resolve(itemsList)
        }?.setErrorCallback { error ->
          promise.reject("CONTENT_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("CONTENT_ERROR", e.message, e)
      }
    }

    AsyncFunction("getChildrenOfItem") { uri: String, perPage: Int?, offset: Int?, promise: Promise ->
      try {
        // For now, return recommended content items as a fallback
        // The actual getChildrenOfItem requires a ListItem object which is complex to create
        spotifyAppRemote?.contentApi?.getRecommendedContentItems("default")?.setResultCallback { items ->
          val itemsList = items.items.map { item ->
            mapOf(
              "id" to item.id,
              "uri" to item.uri,
              "name" to item.title,
              "subtitle" to item.subtitle,
              "playable" to item.playable,
              "imageUri" to item.imageUri?.raw
            )
          }
          promise.resolve(itemsList)
        }?.setErrorCallback { error ->
          promise.reject("CHILDREN_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("CHILDREN_ERROR", e.message, e)
      }
    }

    AsyncFunction("playContentItem") { item: Map<String, Any>, promise: Promise ->
      try {
        val uri = item["uri"] as? String ?: throw IllegalArgumentException("URI required")

        spotifyAppRemote?.playerApi?.play(uri)?.setResultCallback {
          promise.resolve(mapOf("playing" to true))
        }?.setErrorCallback { error ->
          promise.reject("PLAY_CONTENT_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("PLAY_CONTENT_ERROR", e.message, e)
      }
    }

    // ========================
    // IMAGES API
    // ========================

    AsyncFunction("getImage") { uri: String, size: String?, promise: Promise ->
      try {
        val imageSize = when (size) {
          "small" -> Image.Dimension.SMALL
          "medium" -> Image.Dimension.MEDIUM
          "large" -> Image.Dimension.LARGE
          "x_large" -> Image.Dimension.LARGE // Fallback since X_LARGE might not be available
          else -> Image.Dimension.LARGE
        }

        // Create ImageUri from string
        val imageUri = ImageUri(uri)

        spotifyAppRemote?.imagesApi?.getImage(imageUri, imageSize)?.setResultCallback { bitmap ->
          try {
            // Convert bitmap to base64 data URI for React Native
            val outputStream = java.io.ByteArrayOutputStream()
            bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, outputStream)
            val byteArray = outputStream.toByteArray()
            val base64String = android.util.Base64.encodeToString(byteArray, android.util.Base64.NO_WRAP)
            val dataUri = "data:image/jpeg;base64,$base64String"

            promise.resolve(dataUri)
          } catch (e: Exception) {
            promise.reject("IMAGE_PROCESSING_ERROR", "Failed to process bitmap: ${e.message}", e)
          }
        }?.setErrorCallback { error ->
          promise.reject("IMAGE_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("IMAGE_ERROR", e.message, e)
      }
    }

    // ========================
    // USER API
    // ========================

    AsyncFunction("addToLibrary") { uri: String, promise: Promise ->
      try {
        spotifyAppRemote?.userApi?.addToLibrary(uri)?.setResultCallback {
          promise.resolve(mapOf("added" to true))
        }?.setErrorCallback { error ->
          promise.reject("ADD_LIBRARY_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("ADD_LIBRARY_ERROR", e.message, e)
      }
    }

    AsyncFunction("removeFromLibrary") { uri: String, promise: Promise ->
      try {
        spotifyAppRemote?.userApi?.removeFromLibrary(uri)?.setResultCallback {
          promise.resolve(mapOf("removed" to true))
        }?.setErrorCallback { error ->
          promise.reject("REMOVE_LIBRARY_ERROR", error.message, error)
        } ?: promise.reject("NOT_CONNECTED", "Spotify not connected", null)
      } catch (e: Exception) {
        promise.reject("REMOVE_LIBRARY_ERROR", e.message, e)
      }
    }

    // ========================
    // ACTIVITY RESULT HANDLING
    // ========================

    OnActivityResult { activity, result ->
      handleActivityResult(result.requestCode, result.resultCode, result.data)
    }
  }

  // Private helper functions
  private fun subscribeToPlayerStateInternal() {
    try {
      playerStateSubscription?.cancel()
      playerStateSubscription = spotifyAppRemote?.playerApi?.subscribeToPlayerState()?.setEventCallback { playerState ->
        sendEvent("onPlayerStateChanged", mapOf("playerState" to playerStateToMap(playerState)))
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error subscribing to player state", e)
    }
  }

  private fun subscribeToCapabilitiesInternal() {
    try {
      capabilitiesSubscription?.cancel()
      capabilitiesSubscription = spotifyAppRemote?.userApi?.subscribeToCapabilities()?.setEventCallback { capabilities ->
        sendEvent("onCapabilitiesChanged", mapOf(
          "capabilities" to mapOf("canPlayOnDemand" to capabilities.canPlayOnDemand)
        ))
      }
    } catch (e: Exception) {
      Log.e(TAG, "Error subscribing to capabilities", e)
    }
  }

  private fun playerStateToMap(playerState: PlayerState): Map<String, Any?> {
    return mapOf(
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
    )
  }

  private fun handleActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    when (requestCode) {
      AUTH_TOKEN_REQUEST_CODE, AUTH_CODE_REQUEST_CODE -> {
        val response = AuthorizationClient.getResponse(resultCode, data)

        when (response.type) {
          AuthorizationResponse.Type.TOKEN -> {
            // Save token to preferences
            val prefs = appContext.reactContext?.getSharedPreferences(prefsName, 0)
            prefs?.edit()?.apply {
              putString(accessTokenKey, response.accessToken)
              putLong(expiresAtKey, System.currentTimeMillis() + (response.expiresIn * 1000L))
              apply()
            }

            accessToken = response.accessToken

            val authResponse = mapOf(
              "success" to true,
              "data" to mapOf(
                "accessToken" to response.accessToken,
                "type" to "TOKEN",
                "state" to response.state
              )
            )

            sendEvent("onAuthComplete", mapOf("response" to authResponse))
            currentAuthPromise?.resolve(authResponse)
          }

          AuthorizationResponse.Type.CODE -> {
            val authResponse = mapOf(
              "success" to true,
              "data" to mapOf(
                "authorizationCode" to response.code,
                "type" to "CODE",
                "state" to response.state
              )
            )

            sendEvent("onAuthComplete", mapOf("response" to authResponse))
            currentAuthPromise?.resolve(authResponse)
          }

          AuthorizationResponse.Type.ERROR -> {
            val authResponse = mapOf(
              "success" to false,
              "error" to mapOf(
                "message" to response.error,
                "type" to "ERROR"
              )
            )

            sendEvent("onAuthComplete", mapOf("response" to authResponse))
            currentAuthPromise?.reject("AUTH_ERROR", response.error, null)
          }

          else -> {
            val authResponse = mapOf(
              "success" to false,
              "error" to mapOf(
                "message" to "Authorization cancelled",
                "type" to "EMPTY"
              )
            )

            sendEvent("onAuthComplete", mapOf("response" to authResponse))
            currentAuthPromise?.reject("AUTH_CANCELLED", "Authorization cancelled", null)
          }
        }

        // Clear authentication flag after auth completes (success or failure)
        isAuthenticating = false
        currentAuthPromise = null
      }
    }
  }

  private fun connectInternal(connectionParams: ConnectionParams) {
    try {
      SpotifyAppRemote.connect(appContext.reactContext, connectionParams, object : Connector.ConnectionListener {
        override fun onConnected(remote: SpotifyAppRemote) {
          spotifyAppRemote = remote

          Log.d(TAG, "Connected to Spotify App Remote")

          // Auto-subscribe to player state
          subscribeToPlayerStateInternal()

          // Auto-subscribe to capabilities
          subscribeToCapabilitiesInternal()

          sendEvent("onConnected", mapOf("connected" to true))
          currentAuthPromise?.resolve(mapOf("connected" to true))
        }

        override fun onFailure(error: Throwable) {
          Log.e(TAG, "Failed to connect to Spotify App Remote", error)
          sendEvent("onConnectionError", mapOf("error" to error.message))
          currentAuthPromise?.reject("CONNECTION_ERROR", error.message, error)
        }
      })
    } catch (e: Exception) {
      Log.e(TAG, "Connect error", e)
      currentAuthPromise?.reject("CONNECT_ERROR", e.message, e)
    }
  }

  private fun disconnectInternal() {
    try {
      // Cancel all subscriptions
      playerStateSubscription?.cancel()
      capabilitiesSubscription?.cancel()

      playerStateSubscription = null
      capabilitiesSubscription = null

      SpotifyAppRemote.disconnect(spotifyAppRemote)
      spotifyAppRemote = null

      sendEvent("onDisconnected", mapOf("disconnected" to true))
      currentAuthPromise?.resolve(mapOf("disconnected" to true))
    } catch (e: Exception) {
      Log.e(TAG, "Disconnect error", e)
      currentAuthPromise?.reject("DISCONNECT_ERROR", e.message, e)
    }
  }
}