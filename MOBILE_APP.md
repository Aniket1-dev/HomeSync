# HomeSync AI — Android + iOS

HomeSync is now configured as a Capacitor cross-platform app. The existing HTML/CSS/JS application remains the single UI codebase and continues using the same Supabase backend.

## Stack

- Capacitor 8
- Android + iOS native shells
- Existing HomeSync HTML/CSS/JS pages
- Existing Supabase Auth, database, Storage and RLS
- Native capability packages for geolocation, push notifications, keyboard, splash screen and status bar

Capacitor is designed to wrap an existing web application and expose native APIs while keeping the web codebase shared across platforms.

## Local development

```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

Then:

```bash
npx cap open android
npx cap open ios
```

Android requires Android Studio. iOS requires macOS + Xcode.

## Android

Debug build:

```bash
npx cap sync android
cd android
./gradlew assembleDebug
```

The GitHub Actions workflow builds this automatically and uploads the debug APK as an artifact.

For Play Store release, create a release keystore and configure signing in the native Android project. Never commit the keystore or passwords.

## iOS

The GitHub Actions workflow creates and builds the iOS project for the iOS Simulator without signing. A real App Store/TestFlight build must be signed with an Apple Developer account in Xcode or through a secure CI signing setup.

Required for release:

- Apple Developer Program membership
- Bundle ID: `ai.homesync.app`
- App Store Connect app record
- Signing certificate and provisioning profile
- APNs capability if push notifications are enabled

## Native permissions

When native capabilities are used, add only the permissions the feature actually needs.

### Location

Required for:

- exact-location profile features
- consent-based safe visits
- navigation

Do not request background location unless the product genuinely requires it and the user has explicitly opted in.

### Notifications

Required for:

- merge request notifications
- chat notifications
- KYC status updates
- safety/visit reminders

Push delivery still requires Firebase Cloud Messaging configuration for Android and Apple Push Notification service configuration for iOS.

### Camera / documents

The existing browser upload flow can continue working inside the native WebView. If native camera capture is added later, use the Capacitor Camera plugin and keep KYC documents in the existing private Supabase Storage bucket.

## Security

The mobile app uses the same Supabase security model as the web application. The public anon key may be bundled in the app only when Supabase RLS and server-side authorization are correctly configured. Never put a Supabase `service_role` key in the mobile application.

KYC documents must remain private and should be accessed through authorized, short-lived signed URLs.

## CI

`.github/workflows/mobile-build.yml` builds:

- Android debug APK
- iOS Simulator `.app`

The workflow runs on pushes affecting the web/mobile application and can also be started manually from GitHub Actions.

## App Store release checklist

1. Replace placeholder/default app icons with production HomeSync assets.
2. Configure Android release signing.
3. Configure Apple signing and provisioning.
4. Configure FCM/APNs before enabling production push.
5. Add a production privacy policy and terms URL.
6. Add App Store / Play Store screenshots and descriptions.
7. Test authentication, KYC upload, map/location permissions, merge requests, chat, notifications, theme switching and document access on physical devices.
8. Run a security review of all RLS policies before production release.
