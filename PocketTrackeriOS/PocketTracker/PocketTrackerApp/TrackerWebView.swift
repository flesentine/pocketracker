import SwiftUI
import WebKit

struct TrackerWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: "pocketTracker")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

final class Coordinator: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "pocketTracker",
            let payload = message.body as? [String: Any],
            payload["action"] as? String == "shareFile",
            let filename = payload["filename"] as? String,
            let base64 = payload["base64"] as? String,
            let data = Data(base64Encoded: base64)
        else {
            return
        }

        let safeFilename = filename
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(safeFilename)

        do {
            try data.write(to: fileURL, options: .atomic)
            DispatchQueue.main.async {
                Self.presentShareSheet(for: fileURL)
            }
        } catch {
            print("Pocket Tracker export failed: \(error)")
        }
    }

    private static func presentShareSheet(for fileURL: URL) {
        guard
            let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
            let rootViewController = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else {
            return
        }

        let activityViewController = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        activityViewController.popoverPresentationController?.sourceView = rootViewController.view
        activityViewController.popoverPresentationController?.sourceRect = CGRect(
            x: rootViewController.view.bounds.midX,
            y: rootViewController.view.bounds.midY,
            width: 1,
            height: 1
        )
        rootViewController.presentedViewController?.dismiss(animated: false)
        rootViewController.present(activityViewController, animated: true)
    }
}
