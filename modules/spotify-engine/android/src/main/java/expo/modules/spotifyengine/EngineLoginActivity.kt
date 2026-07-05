package expo.modules.spotifyengine

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Full-screen WebView for the built-in engine's Spotify OAuth flow. The
 * device has no browser, so accounts.spotify.com is rendered here and the
 * 127.0.0.1 redirect is intercepted before any network request happens -
 * only the `?code=` parameter travels back via the activity result.
 */
class EngineLoginActivity : Activity() {

  companion object {
    const val EXTRA_AUTH_URL = "authUrl"
    const val RESULT_CODE = "code"
    const val RESULT_ERROR = "error"
    private const val REDIRECT_PREFIX = "http://127.0.0.1:8898/login"
  }

  private var webView: WebView? = null

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val authUrl = intent.getStringExtra(EXTRA_AUTH_URL)
    if (authUrl.isNullOrEmpty()) {
      setResult(RESULT_CANCELED)
      finish()
      return
    }

    val view = WebView(this)
    view.setBackgroundColor(Color.WHITE)
    view.settings.javaScriptEnabled = true
    view.settings.domStorageEnabled = true
    view.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(
        view: WebView?,
        request: WebResourceRequest?,
      ): Boolean {
        val url = request?.url?.toString() ?: return false
        return handleRedirect(url)
      }

      @Deprecated("Fallback for older WebView providers")
      override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        return url != null && handleRedirect(url)
      }
    }
    webView = view
    setContentView(view)
    view.loadUrl(authUrl)
  }

  private fun handleRedirect(url: String): Boolean {
    if (!url.startsWith(REDIRECT_PREFIX)) {
      return false
    }
    val uri = Uri.parse(url)
    val code = uri.getQueryParameter("code")
    val data = Intent()
    if (code.isNullOrEmpty()) {
      data.putExtra(RESULT_ERROR, uri.getQueryParameter("error") ?: "missing code")
      setResult(RESULT_CANCELED, data)
    } else {
      data.putExtra(RESULT_CODE, code)
      setResult(RESULT_OK, data)
    }
    finish()
    return true
  }

  override fun onDestroy() {
    webView?.destroy()
    webView = null
    super.onDestroy()
  }
}
