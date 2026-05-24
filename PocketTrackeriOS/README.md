# Pocket Tracker iOS

This is an iOS wrapper for the Pocket Tracker web prototype. The app loads the bundled tracker files from `PocketTracker/Resources/Web` inside a `WKWebView`, so the UI, gestures, Web Audio synths, save/load controls, and MP3 encoder stay aligned with the browser version.

## Open in Xcode

Open `PocketTracker.xcodeproj`, choose the `PocketTracker` scheme, then run it on an iPhone simulator or device.

## Notes

- The iOS app bundles `index.html`, `styles.css`, `app.js`, image assets, and `lame.min.js`.
- The deployment target is iOS 17.0.
- If Xcode asks for signing, select your team under the `PocketTracker` target.
