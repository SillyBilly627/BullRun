// BullRunApp — Native wrapper for BullRun web app
// Works on macOS, iOS, and iPadOS

import SwiftUI

@main
struct BullRunApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        #if os(macOS)
        .windowStyle(.titleBar)
        .defaultSize(width: 1200, height: 800)
        #endif
    }
}
