from kivy.app import App
from kivy.uix.widget import Widget
from kivy.clock import Clock
from jnius import autoclass, cast  # For Android WebView access

# Detect if running on Android
import platform
if platform.system() == 'Linux' and 'ANDROID_BOOTLOGO' in open('/proc/cmdline').read():
    from kivy.logger import Logger
    from kivy.core.window import Window

class WebViewWidget(Widget):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        Clock.schedule_once(self.create_webview, 0)

    def create_webview(self, *args):
        # Android-specific WebView setup
        PythonActivity = autoclass('org.kivy.android.PythonActivity')
        activity = PythonActivity.mActivity
        WebView = autoclass('android.webkit.WebView')
        WebSettings = autoclass('android.webkit.WebSettings')
        webview = WebView(activity)
        settings = webview.getSettings()
        settings.setJavaScriptEnabled(True)  # Enable JS for your script.js
        settings.setDomStorageEnabled(True)  # For localStorage
        settings.setDatabaseEnabled(True)
        webview.setWebViewClient(autoclass('android.webkit.WebViewClient')())

        # Load your local HTML file (adjust path if needed)
        webview.loadUrl('/index.html')

        # Add to layout
        layout = autoclass('android.widget.LinearLayout')
        layout_params = autoclass('android.widget.LinearLayout$LayoutParams')
        params = layout_params(-1, -1)  # Match parent
        activity.addContentView(webview, params)

class MyApp(App):
    def build(self):
        return WebViewWidget()

if __name__ == '__main__':
    MyApp().run()