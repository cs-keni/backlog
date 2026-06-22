# Klip — Desktop Video Editor for Windows 11

## One-Line Pitch
Klip is a fully-featured non-linear video editor built from scratch in Electron, React, and TypeScript for Windows 11 — with a custom canvas timeline, FFmpeg proxy pipeline, color grading, audio processing, and YouTube-ready export — designed for editing long OBS recordings without a subscription.

## Status
GitHub: [cs-keni/klip](https://github.com/cs-keni/klip) | Demo: [docs/demo.mp4](https://raw.githubusercontent.com/cs-keni/klip/master/docs/demo.mp4)

## Problem Statement
Editing long OBS recordings into YouTube-ready content meant either expensive subscriptions (Premiere Pro, DaVinci Resolve) or inadequate free tools with poor keyboard workflows. The goal was to build a tool that handles real production constraints: 4K source files, 8-hour OBS recordings, accurate color output, and a hardened save system that doesn't lose work.

## What Was Built
A fully featured Windows 11 desktop video editor with no subscription: handles 4K/8-hour OBS recordings via a proxy pipeline for smooth playback, outputs YouTube-ready H.264/VP9 presets with accurate color grading and audio normalization, and includes multi-track support, transitions, text overlays, and a hardened save/recovery system. Built entirely in TypeScript without a single native video editing library or widget.

## Tech Stack
- **Desktop runtime:** Electron
- **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion
- **Video processing:** FFmpeg (child processes — proxy generation and composited export)
- **State management:** Zustand (deep nested timeline state with full undo/redo)
- **Database:** SQLite (project file persistence)
- **Build:** Vite
- **Testing:** Vitest

## Features in Detail

### Non-Linear Timeline Editor
A custom canvas-rendered multi-track timeline — built from scratch, not with a timeline library. Supports:
- Multiple tracks: video, audio, music, text overlays
- Spring-physics drag for clip repositioning (Framer Motion spring integration on canvas hit-test coordinates)
- Waveform visualization rendered from decoded audio samples
- Lasso selection for multi-clip operations
- Full undo/redo stack backed by Zustand state snapshots — every edit is reversible, including multi-clip moves

The timeline is a React canvas component with a custom hit-testing layer for mouse interactions. No external timeline widget was used.

### Proxy Pipeline — 4K Smooth Playback
On import, Klip spawns an FFmpeg child process to generate a 480p low-resolution proxy of every clip in the background, storing it alongside the source file. The preview player transparently uses proxies during editing. On export, the original source files are used.

Result: smooth, zero-stutter playback even on 4K or 8-hour OBS recordings on consumer hardware, without needing a GPU transcoder.

### Effects System
Per-clip effects, each implemented as an FFmpeg filter:
- **Color grade:** brightness, contrast, saturation, hue rotation with a real-time preview pane
- **Crop / zoom:** a minimap pan widget for repositioning the crop rectangle within the frame
- **Speed control:** ×0.25 to ×4 with pitch correction (FFmpeg `atempo` filter chain for > 2× limits)
- **Audio fade handles:** drag in/out fade in/out points directly on the waveform
- **Crossfade / dip-to-black transitions:** generated as FFmpeg `xfade` filter invocations at render time
- **Text overlays:** WYSIWYG canvas positioning, font selection, color, size, with a real-time preview in the player

### Export Engine
A composited FFmpeg filter graph that assembles all tracks, applies every active effect, embeds chapter metadata from timeline markers, and outputs in multiple presets:
- 1080p H.264 (YouTube standard)
- 1440p H.264 (YouTube 2K)
- 4K H.264 (YouTube 4K)
- WebM VP9 (open format)
- GIF (loop export, configurable FPS and scale)

Audio normalization (`loudnorm` filter) is applied on every export to meet YouTube's -14 LUFS target automatically.

### Hardened Project Lifecycle
- **Auto-save every 2 minutes** to a `.klip-autosave` file alongside the project
- **Crash recovery:** on launch, if a newer autosave than the last manual save is detected, the user is prompted to recover it
- **Corrupted autosave fallback:** if the autosave is unreadable (corrupt JSON/SQLite), Klip falls back to the last manual save without crashing
- **Save-before-close confirmation:** unsaved changes prompt a modal on window close
- **Missing-file detection with relink:** if a source media file is moved or deleted, Klip detects the missing file on open and prompts for a relink path rather than silently failing
- **Playhead position serialization:** the timeline scroll position and playhead are saved with the project, so reopening a project returns to the exact editing position

## Measurable Outcomes / Impact
- Handles 4K / 8-hour OBS recordings via proxy — no dropped frames during editing
- Export produces broadcast-quality H.264/VP9 output with audio normalization to YouTube's -14 LUFS target
- Zero data loss across a full editing session (2-minute autosave + crash recovery + corrupted-save fallback)
- Full undo/redo stack — every edit, including multi-clip moves, is reversible
- Built entirely without a native timeline widget or video editing library

## Best For (Role Targeting)
- Desktop application / Electron roles
- Frontend-heavy roles where complex UI state management is emphasized
- Full-stack TypeScript roles (Electron bridges Node.js and browser contexts, requiring both)
- Any role that values building complex systems from scratch rather than assembling libraries
- Roles at creative tools companies (Descript, CapCut, Figma, Canva, Adobe) or developer tools companies
- Roles where "performance," "real-time rendering," or "multimedia" appears in the JD

## Talking Points for Interviews
- **Built without a native timeline widget:** A video editor's timeline is arguably the hardest UI component to implement — canvas rendering, hit-testing, drag physics, multi-selection, undo/redo — doing it without a library demonstrates genuine frontend engineering depth
- **Proxy pipeline architecture:** The proxy/source duality is how every professional NLE (Premiere, DaVinci, Final Cut) handles 4K editing — the pattern is correct, not just functional
- **FFmpeg filter graph composition:** Assembling a composited filter graph from user-configured effects at render time requires understanding FFmpeg's DAG-based filtergraph syntax — not just calling a CLI wrapper
- **Crash recovery design:** Three layers (autosave, corrupted-save fallback, missing-file relink) mirror what a production desktop app needs; most tutorial Electron apps have zero
- **Zustand undo/redo:** Deep nested state snapshots for undo/redo is a non-trivial state management problem — naive approaches that snapshot the entire state tree are too expensive on a timeline with hundreds of clips
