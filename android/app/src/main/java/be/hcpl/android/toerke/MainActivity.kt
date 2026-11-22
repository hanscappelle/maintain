package be.android.hcpl.toerke

import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import java.io.IOException
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: View
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingBackupContents: String? = null
    private var textToSpeech: TextToSpeech? = null
    private var speechReady = false
    private var pendingSpeech: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(246, 247, 242)
        window.navigationBarColor = Color.rgb(246, 247, 242)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
            View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
        }
        webView.addJavascriptInterface(HouseholdBridge(), "HouseholdAndroid")
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }
        webView.webViewClient = HouseholdWebViewClient()
        webView.webChromeClient = HouseholdWebChromeClient()
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            download(url, userAgent, contentDisposition, mimeType)
        }

        swipeRefresh = SwipeRefreshLayout(this).apply {
            setColorSchemeColors(Color.rgb(52, 110, 67))
            setOnChildScrollUpCallback { _, _ -> webView.canScrollVertically(-1) }
            setOnRefreshListener { webView.reload() }
            addView(webView)
        }
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            isIndeterminate = false
        }
        errorView = createErrorView()
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(246, 247, 242))
            addView(swipeRefresh, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
            addView(progressBar, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(3),
                Gravity.TOP
            ))
            addView(errorView, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
            errorView.visibility = View.GONE
            setOnApplyWindowInsetsListener { view, insets ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val bars = insets.getInsets(WindowInsets.Type.systemBars())
                    view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                } else {
                    @Suppress("DEPRECATION")
                    view.setPadding(
                        insets.systemWindowInsetLeft,
                        insets.systemWindowInsetTop,
                        insets.systemWindowInsetRight,
                        insets.systemWindowInsetBottom
                    )
                }
                insets
            }
        }
        setContentView(root)

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(HOME_URL)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        pendingSpeech = null
        textToSpeech?.stop()
        if (::webView.isInitialized) webView.onPause()
        super.onPause()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == BACKUP_REQUEST) {
            val contents = pendingBackupContents
            pendingBackupContents = null
            val uri = if (resultCode == RESULT_OK) data?.data else null
            if (contents != null && uri != null) {
                try {
                    val output = contentResolver.openOutputStream(uri)
                        ?: throw IOException("Het bestand kan niet worden geopend.")
                    output.bufferedWriter(Charsets.UTF_8).use { it.write(contents) }
                    Toast.makeText(this, "Back-up opgeslagen.", Toast.LENGTH_LONG).show()
                } catch (error: IOException) {
                    showBackupError(error)
                } catch (error: SecurityException) {
                    showBackupError(error)
                }
            }
            return
        }
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val callback = fileChooserCallback ?: return
            fileChooserCallback = null
            val result = if (resultCode == RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            callback.onReceiveValue(result)
        }
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        pendingBackupContents = null
        pendingSpeech = null
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
        speechReady = false
        webView.destroy()
        super.onDestroy()
    }

    private fun createErrorView(): View {
        val message = TextView(this).apply {
            text = "De website is tijdelijk niet bereikbaar. Controleer je internetverbinding en probeer het opnieuw."
            textSize = 16f
            setTextColor(Color.rgb(52, 61, 52))
            gravity = Gravity.CENTER
        }
        val retry = Button(this).apply {
            text = "Opnieuw proberen"
            setOnClickListener {
                errorView.visibility = View.GONE
                webView.reload()
            }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(24), dp(32), dp(24))
            setBackgroundColor(Color.rgb(246, 247, 242))
            addView(message, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
            addView(retry, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
                topMargin = dp(12)
            })
        }
    }

    private fun download(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        val uri = Uri.parse(url)
        if (uri.scheme != "https" || uri.host != HOME_HOST) {
            Toast.makeText(this, "Download van deze locatie is niet toegestaan.", Toast.LENGTH_LONG).show()
            return
        }
        val request = DownloadManager.Request(uri)
            .setMimeType(mimeType)
            .addRequestHeader("User-Agent", userAgent)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType))
        val cookies = CookieManager.getInstance().getCookie(url)
        if (!cookies.isNullOrEmpty()) request.addRequestHeader("Cookie", cookies)
        val manager = getSystemService(DOWNLOAD_SERVICE) as DownloadManager
        manager.enqueue(request)
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme !in setOf("https", "http", "mailto", "tel")) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "Er is geen app beschikbaar om deze link te openen.", Toast.LENGTH_LONG).show()
        }
    }

    private fun showBackupError(error: Exception) {
        val detail = error.message?.let { ": $it" } ?: "."
        Toast.makeText(this, "Back-up opslaan is mislukt$detail", Toast.LENGTH_LONG).show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun showSpeechError(message: String) {
        Log.e("HouseholdSpeech", message)
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun speak(text: String) {
        if (speechReady) {
            if (textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "task") != TextToSpeech.SUCCESS) {
                showSpeechError("Voorlezen is niet gelukt. Controleer de spraakinstellingen van je apparaat.")
            }
            return
        }
        pendingSpeech = text
        if (textToSpeech != null) return
        textToSpeech = TextToSpeech(this) { status ->
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                val engine = textToSpeech
                if (status != TextToSpeech.SUCCESS || engine == null) {
                    pendingSpeech = null
                    engine?.shutdown()
                    textToSpeech = null
                    showSpeechError("Voorlezen is niet beschikbaar. Controleer de tekst-naar-spraakinstellingen van je apparaat.")
                    return@runOnUiThread
                }
                var language = engine.setLanguage(Locale("nl", "BE"))
                if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
                    language = engine.setLanguage(Locale("nl", "NL"))
                }
                if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
                    pendingSpeech = null
                    engine.shutdown()
                    textToSpeech = null
                    showSpeechError("Een Nederlandse stem ontbreekt. Installeer deze in de tekst-naar-spraakinstellingen.")
                    return@runOnUiThread
                }
                engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String) {}
                    override fun onDone(utteranceId: String) {}
                    @Deprecated("Deprecated in Android")
                    override fun onError(utteranceId: String) {
                        runOnUiThread {
                            if (!isFinishing && !isDestroyed) {
                                showSpeechError("Voorlezen is niet gelukt. Controleer de spraakinstellingen van je apparaat.")
                            }
                        }
                    }
                })
                speechReady = true
                val queued = pendingSpeech
                pendingSpeech = null
                if (queued != null) speak(queued)
            }
        }
    }

    private inner class HouseholdBridge {
        @JavascriptInterface
        fun speakTask(text: String) {
            runOnUiThread {
                val pageUri = webView.url?.let(Uri::parse)
                if (pageUri == null || !isHouseholdUrl(pageUri)) return@runOnUiThread
                if (text.isBlank() || text.length >= TextToSpeech.getMaxSpeechInputLength()) {
                    showSpeechError("De taaktekst kan niet worden voorgelezen.")
                    return@runOnUiThread
                }
                speak(text)
            }
        }

        @JavascriptInterface
        fun saveBackup(fileName: String, contents: String) {
            runOnUiThread {
                val pageUri = webView.url?.let(Uri::parse)
                if (pageUri == null || !isHouseholdUrl(pageUri)) return@runOnUiThread
                if (pendingBackupContents != null) {
                    Toast.makeText(this@MainActivity, "Er wordt al een back-up opgeslagen.", Toast.LENGTH_LONG).show()
                    return@runOnUiThread
                }
                pendingBackupContents = contents
                val safeFileName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/json"
                    putExtra(Intent.EXTRA_TITLE, safeFileName)
                }
                try {
                    startActivityForResult(intent, BACKUP_REQUEST)
                } catch (_: ActivityNotFoundException) {
                    pendingBackupContents = null
                    Toast.makeText(this@MainActivity, "Er is geen bestandskiezer beschikbaar.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private inner class HouseholdWebViewClient : WebViewClient() {
        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            view.evaluateJavascript(
                "document.querySelectorAll('dialog').forEach(dialog => dialog.style.maxHeight = '90%')",
                null
            )
            swipeRefresh.isRefreshing = false
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (isHouseholdUrl(uri)) return false
            openExternal(uri)
            return true
        }

        @Suppress("DEPRECATION")
        override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
            val uri = Uri.parse(url)
            if (isHouseholdUrl(uri)) return false
            openExternal(uri)
            return true
        }

        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError
        ) {
            super.onReceivedError(view, request, error)
            if (request.isForMainFrame) showError()
        }

        override fun onReceivedHttpError(
            view: WebView,
            request: WebResourceRequest,
            errorResponse: android.webkit.WebResourceResponse
        ) {
            super.onReceivedHttpError(view, request, errorResponse)
            if (request.isForMainFrame && errorResponse.statusCode >= 500) showError()
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
            showError()
        }
    }

    private inner class HouseholdWebChromeClient : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progressBar.progress = newProgress
            progressBar.visibility = if (newProgress < 100) View.VISIBLE else View.GONE
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            fileChooserCallback?.onReceiveValue(null)
            fileChooserCallback = filePathCallback
            return try {
                startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST)
                true
            } catch (_: ActivityNotFoundException) {
                fileChooserCallback = null
                filePathCallback.onReceiveValue(null)
                Toast.makeText(this@MainActivity, "Er is geen bestandskiezer beschikbaar.", Toast.LENGTH_LONG).show()
                false
            }
        }

        override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity)
                .setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setOnCancelListener { result.cancel() }
                .show()
            return true
        }

        override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
            AlertDialog.Builder(this@MainActivity)
                .setMessage(message)
                .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                .setOnCancelListener { result.cancel() }
                .show()
            return true
        }
    }

    private fun isHouseholdUrl(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host == HOME_HOST && (uri.port == -1 || uri.port == 443)

    private fun showError() {
        swipeRefresh.isRefreshing = false
        progressBar.visibility = View.GONE
        errorView.visibility = View.VISIBLE
    }

    companion object {
        private const val HOME_HOST = "betyre.alwaysdata.net"
        private const val HOME_URL = "https://betyre.alwaysdata.net/maintain/"
        private const val FILE_CHOOSER_REQUEST = 1001
        private const val BACKUP_REQUEST = 1002
    }
}
