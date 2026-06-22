# Shuckler — Android Music App with YouTube Offline Download

## One-Line Pitch
Shuckler is a personal Android music app built in Kotlin and Jetpack Compose that downloads and plays music from YouTube offline with no API key required, integrates Spotify for discovery, delivers gapless playback with synced lyrics, a dynamic album-art color theming system, and a listening analytics engine — all at commercial-app quality.

## Status
GitHub: [cs-keni/shuckler](https://github.com/cs-keni/shuckler) | Demo: [docs/demo.mp4](https://github.com/cs-keni/shuckler/raw/main/docs/demo.mp4)

## Problem Statement
Streaming services don't carry every track — especially niche Japanese and Korean music — and require subscriptions for offline listening. The goal was a personal music app that can find and download anything from YouTube, play it with gapless audio, look visually great, and feel as polished as a commercial streaming app.

## What Was Built
A fully featured Android music app with commercial-quality UX: offline YouTube music via NewPipe Extractor with zero API dependency, gapless playback via ExoPlayer/Media3 with background service and lock-screen controls, per-song dynamic color theming from album art, synced scrolling lyrics, a listening analytics system with personality archetypes and achievement badges, and spring-physics micro-animations on every interaction.

## Tech Stack
- **Language:** Kotlin
- **UI:** Jetpack Compose, Material 3
- **Audio engine:** ExoPlayer / AndroidX Media3
- **Background playback:** Foreground Service, MediaSession
- **YouTube extraction:** NewPipe Extractor (no API key)
- **Music discovery:** Spotify Web API (OAuth 2.0 PKCE)
- **Lyrics:** LRCLIB API (free, no key)
- **Networking:** OkHttp 4
- **Image loading / color:** Coil 2, AndroidX Palette
- **State management:** Kotlin Coroutines + StateFlow
- **Navigation:** AndroidX Navigation Compose
- **Persistence:** SharedPreferences (settings, metadata)

## Features in Detail

### Audio Engine — ExoPlayer/Media3 Foreground Service
A foreground-service audio engine using ExoPlayer/Media3 with:
- **Gapless playlist mode:** consecutive tracks play without any audio gap between them
- **Crossfade:** configurable crossfade duration between tracks
- **Sleep timer:** auto-pause after a configurable duration
- **Background playback:** service keeps audio alive when the app is backgrounded or the screen is off
- **Lock-screen / notification controls:** MediaSession integration provides standard media controls in the system notification tray and lock screen
- **Headphone button support:** play/pause/skip via hardware media keys

Result: background playback behavior identical to Spotify or YouTube Music.

### YouTube Search and Offline Download — No API Key
Built using NewPipe Extractor — the same library that powers the NewPipe open-source YouTube client. Zero Google API key required; extraction works by parsing YouTube's web responses directly. Features:
- **Search:** full YouTube search by title, artist, or URL
- **30-second preview:** listen to a preview clip before committing to a download
- **Resumable downloads:** OkHttp download with byte-range resume on network interruption
- **Retry logic:** automatic retry with exponential backoff on partial failures
- **Quality selection:** Best / High / Data Saver presets (different audio bitrate targets)
- **Progress tracking:** per-download progress displayed in a download queue UI
- **Metadata persistence:** title, artist, album art, duration stored as JSON alongside the audio file for offline use

### Dynamic Color Theming — AndroidX Palette
Every time a song changes in the full-screen player, AndroidX Palette extracts the dominant hue from the album art asynchronously. The extracted color is applied to:
- The player background (gradient from dominant to dark)
- Button tints and accent colors
- Progress bar and scrubber color
- Lyrics highlight color

The transition between songs uses a crossfade animation on the color values, so theme changes feel like a visual response to the music rather than an abrupt swap.

### Listening Analytics — Personality Archetypes
A listening analytics screen tracks:
- **Play counts** per track and per artist
- **Time-range filters:** today / this week / this month / all time
- **Listening personality archetype:** computed from listening history — e.g., "Night Owl" (most plays after midnight), "Deep Listener" (high average track repeat rate), "Explorer" (high proportion of unique artists in recent history)
- **Achievement badge system:** badges awarded for milestones (100 plays, first download, longest listening streak, etc.)

### Spring-Physics Micro-Animations
Implemented throughout using Jetpack Compose's `Animatable` and `MutableInteractionSource` APIs:
- **Press-scale feedback:** all interactive elements scale down on press and spring back on release
- **Bounce on favorite heart:** the heart icon bounces with a spring overshoot when toggled
- **Swipe-to-delete reveal:** list items reveal a delete action with a spring-damped swipe gesture
- **Animated crossfade:** grid/list toggle in the library uses an animated crossfade rather than an instant layout swap

## Measurable Outcomes / Impact
- YouTube audio extraction with zero API key — zero ongoing cost for the download pipeline
- Gapless playback with MediaSession — indistinguishable from a commercial streaming app in background behavior
- Dynamic color theming on every song change — fully personalized player UI
- Listening personality archetype computed from play history — a sense of progression over time
- Spring-physics animations on every interactive element — tactile, commercial-quality feel

## Best For (Role Targeting)
- Android SWE roles (any company with an Android app)
- Mobile-focused SWE roles (also demonstrates Kotlin coroutines, state management, architecture patterns)
- Roles at music/media companies (Spotify, YouTube, SoundCloud, Pandora, Tidal, Apple Music)
- Roles that mention "Jetpack Compose," "ExoPlayer," "Android Media," or "Material 3"
- Consumer app roles where UX polish and animation quality matter

## Talking Points for Interviews
- **NewPipe Extractor:** YouTube's Data API is rate-limited and costs money at scale; NewPipe Extractor parses YouTube's web responses directly — the same approach used by millions of NewPipe users. Zero API cost for the entire download pipeline.
- **Gapless playback:** Gapless mode in ExoPlayer requires correctly configuring MediaSource concatenation and codec configuration sharing — it's not the default. Most music apps that claim gapless have audible gaps.
- **AndroidX Palette asynchronous extraction:** Color extraction blocks the main thread if called synchronously — Palette.Builder.generate() is called on a Coroutine dispatcher, with the result applied via `LaunchedEffect` in Compose
- **Spring-physics in Compose:** `Animatable` with custom `spring()` specs produces a fundamentally different feel than `tween()` animations — spring-based animations respond to interruption correctly (they simulate physical momentum), tween animations don't
- **Personality archetypes from listening history:** Computing a personality label from raw play-count data demonstrates the pattern of turning raw events into user-legible insight — the same pattern used in Spotify Wrapped
