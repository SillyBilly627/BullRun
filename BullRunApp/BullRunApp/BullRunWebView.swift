// BullRunWebView — WKWebView wrapper for SwiftUI
// Handles both macOS (NSViewRepresentable) and iOS (UIViewRepresentable)

import SwiftUI
import WebKit

#if os(macOS)
// ============================================================
// macOS — Uses NSViewRepresentable
// ============================================================
struct BullRunWebView: NSViewRepresentable {
    let urlString: String
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        
        // Allow local network connections (for localhost testing)
        webView.configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        // Dark background to match the app theme
        webView.setValue(false, forKey: "drawsBackground")
        
        loadURL(webView)
        return webView
    }
    
    func updateNSView(_ webView: WKWebView, context: Context) {
        // Reload if URL changed
        if let current = webView.url?.absoluteString, current != urlString {
            loadURL(webView)
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    private func loadURL(_ webView: WKWebView) {
        guard let url = URL(string: urlString) else { return }
        webView.load(URLRequest(url: url))
    }
}

#else
// ============================================================
// iOS / iPadOS — Uses UIViewRepresentable
// ============================================================
struct BullRunWebView: UIViewRepresentable {
    let urlString: String
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = false
        
        // Match dark theme
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        
        loadURL(webView)
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        if let current = webView.url?.absoluteString, current != urlString {
            loadURL(webView)
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    private func loadURL(_ webView: WKWebView) {
        guard let url = URL(string: urlString) else { return }
        webView.load(URLRequest(url: url))
    }
}
#endif

// ============================================================
// Shared Coordinator — Handles navigation events
// ============================================================
class Coordinator: NSObject, WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject CSS to hide any scrollbars on macOS for a cleaner native feel
        #if os(macOS)
        let css = "::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }"
        let js = "var style = document.createElement('style'); style.textContent = `\(css)`; document.head.appendChild(style);"
        webView.evaluateJavaScript(js)
        #endif
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("BullRun WebView error: \(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        // Show a friendly error page if the server isn't running
        let html = """
        <html>
        <head><style>
            body { background: #0a0f1c; color: #e2e8f0; font-family: -apple-system, system-ui; 
                   display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { text-align: center; padding: 2rem; }
            h1 { font-size: 2rem; margin-bottom: 0.5rem; }
            .bull { font-size: 3rem; }
            p { color: #94a3b8; font-size: 1rem; line-height: 1.6; max-width: 400px; }
            code { background: #1e293b; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.9rem; }
        </style></head>
        <body><div class="box">
            <div class="bull">🐂</div>
            <h1>Can't reach BullRun</h1>
            <p>Make sure the server is running.<br>
            Open Terminal, navigate to the BullRun folder, and run:<br><br>
            <code>npm run dev</code><br><br>
            Then tap the ⚙️ gear icon to reconnect.</p>
        </div></body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}
