import SwiftUI

@main
struct PocketTrackerApp: App {
    var body: some Scene {
        WindowGroup {
            TrackerWebView()
                .background(Color.black)
                .preferredColorScheme(.dark)
        }
    }
}
