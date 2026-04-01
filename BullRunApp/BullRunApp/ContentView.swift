// ContentView — Main app view
// Shows the BullRun web app in a full-screen WebView
// Change the URL below to point to your server

import SwiftUI

struct ContentView: View {
    // ======================================
    // CHANGE THIS URL TO YOUR SERVER
    // ======================================
    // Local testing:  "http://localhost:8788"
    // Deployed:       "https://bullrun.pages.dev"
    // ======================================
    @State private var serverURL = "http://localhost:8788"
    @State private var isEditing = false
    @State private var tempURL = ""
    
    var body: some View {
        ZStack {
            // The web view fills the entire screen
            BullRunWebView(urlString: serverURL)
                .ignoresSafeArea()
            
            // Floating settings button (top-right corner)
            VStack {
                HStack {
                    Spacer()
                    Button(action: {
                        tempURL = serverURL
                        isEditing = true
                    }) {
                        Image(systemName: "gearshape.fill")
                            .font(.system(size: 14))
                            .foregroundColor(.white.opacity(0.5))
                            .padding(8)
                            .background(Color.black.opacity(0.3))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 12)
                    .padding(.top, 8)
                    .opacity(isEditing ? 0 : 1)
                }
                Spacer()
            }
        }
        .sheet(isPresented: $isEditing) {
            VStack(spacing: 20) {
                Text("Server URL")
                    .font(.headline)
                
                Text("Enter the URL where BullRun is running")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                TextField("http://localhost:8788", text: $tempURL)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 400)
                    #if os(iOS)
                    .autocapitalization(.none)
                    .keyboardType(.URL)
                    #endif
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        isEditing = false
                    }
                    
                    Button("Local (8788)") {
                        serverURL = "http://localhost:8788"
                        isEditing = false
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Connect") {
                        if !tempURL.isEmpty {
                            serverURL = tempURL
                        }
                        isEditing = false
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding(30)
            #if os(macOS)
            .frame(width: 500, height: 250)
            #endif
        }
    }
}
