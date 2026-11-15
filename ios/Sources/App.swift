// Fantasy Recap on an iPhone: a thin shell around the live web app (GitHub Pages).
// The app itself is the same site everyone else opens; this shell only gives it a Home Screen icon,
// the full screen, and sound that starts without a first tap and ignores the ringer switch.
import SwiftUI
import WebKit
import AVFoundation

let liveURL = URL(string: "https://fantasyrecap.club/?intro=0")!

@main
struct FantasyRecapApp: App {
    init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        try? AVAudioSession.sharedInstance().setActive(true)
    }
    var body: some Scene {
        WindowGroup {
            // The page stays inside the safe area (below the status bar, above the home bar); the strips are filled dark.
            WebShell()
                .background(Color(red: 0.043, green: 0.051, blue: 0.055).ignoresSafeArea())
                .preferredColorScheme(.dark)
        }
    }
}

struct WebShell: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Tell the page it is installed, so it does not offer "Add to Home Screen".
        let js = "try { Object.defineProperty(navigator, 'standalone', { get: function () { return true; } }); } catch (e) {}"
        config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.043, green: 0.051, blue: 0.055, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.allowsBackForwardNavigationGestures = false
        context.coordinator.web = web
        web.load(URLRequest(url: liveURL, cachePolicy: .reloadRevalidatingCacheData))
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var web: WKWebView?
        func retryPage(_ why: String) {
            let html = """
            <html><head><meta name='viewport' content='width=device-width, initial-scale=1'>
            <style>body{background:#0b0d0e;color:#f3f0e8;font:17px -apple-system;padding:96px 24px;text-align:center}
            a{display:inline-block;margin-top:24px;padding:14px 22px;background:#ffc21a;color:#0b0d0e;font-weight:700;text-decoration:none}</style></head>
            <body><h2>Fantasy Recap</h2><p>The app could not load. Check the connection.</p><p style='color:#9aa3a8;font-size:13px'>\(why)</p>
            <a href='\(liveURL.absoluteString)'>Try again</a></body></html>
            """
            web?.loadHTMLString(html, baseURL: nil)
        }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            retryPage(error.localizedDescription)
        }
        // Links that leave the app's own site open in Safari.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = action.request.url, action.navigationType == .linkActivated, let host = url.host,
               host != liveURL.host, url.scheme == "https" || url.scheme == "http" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
