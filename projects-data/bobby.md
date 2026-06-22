# Bobby — Personal AI Voice Assistant for Windows

## One-Line Pitch
Bobby is a voice-controlled AI assistant for Windows that listens for a wake word locally, understands natural language commands, controls your PC (open apps, manage windows, run commands), builds a persistent memory of your habits over time, and exposes a React PWA + screen streaming bridge so you can control your machine from your phone from anywhere.

## Status
Ongoing (in active development) | GitHub: [cs-keni/bobby](https://github.com/cs-keni/bobby)

## Problem Statement
Existing voice assistants (Siri, Cortana, Alexa) are cloud black-boxes with no memory of who you are, no real PC control beyond basic web searches, and no ability to learn your specific workflow. Bobby was built to fill that gap: a local-first assistant that actually knows your named application shortcuts, remembers facts about you across conversations, and gives you full PC control from your phone.

## What Was Built
A voice pipeline from wake word to spoken response — targeting sub-2-second latency — with: always-on local wake word detection (Porcupine), Whisper STT transcription, Claude as the reasoning and tool-use layer, ElevenLabs streaming TTS for the response, persistent memory via SQLite with pattern-matched injection, PC control via pywinauto/pywin32, named shortcut macros, an Obsidian vault knowledge base integration, and a React PWA with MJPEG screen streaming accessible from anywhere via Cloudflare Tunnel.

## Tech Stack
- **Language:** Python 3.11
- **AI / reasoning:** Claude API — Claude Haiku (fast tool dispatch), Claude Sonnet (complex reasoning, long-form responses)
- **Wake word:** Porcupine (Picovoice) — runs locally, zero cloud dependency
- **Speech-to-text:** OpenAI Whisper (local model, no API call)
- **Text-to-speech:** ElevenLabs (streaming, voice cloning)
- **Memory:** SQLite (fact store + conversation history)
- **Knowledge base:** Obsidian REST API (vault index, first-3-line note previews)
- **Backend API:** FastAPI + WebSockets
- **Screen streaming:** MJPEG (live screen capture streamed over HTTP)
- **PC control:** pywinauto + pywin32 (window management, application launch, keyboard/mouse)
- **Remote access:** Cloudflare Tunnel (zero-config public HTTPS URL, no router configuration)
- **Frontend (phone bridge):** React PWA
- **Code quality:** Ruff, mypy, pytest, GitHub Actions

## Features in Detail

### Voice Pipeline — Sub-2-Second Wake-to-Response Target
The latency-critical chain:
1. **Porcupine wake word** — always-on, CPU-only, runs on a background thread. Zero cloud calls; the model runs locally. Triggers on "hey bobby."
2. **Whisper STT** — the local Whisper model (small or medium, configurable) transcribes the captured audio. Local model avoids the latency of an API call for transcription.
3. **Claude API (Haiku for dispatch, Sonnet for complex tasks)** — the transcribed text is sent with the system prompt, relevant memories, and available tools. Claude decides which tool to invoke (or responds directly if no tool is needed).
4. **Tool execution** — pywinauto/pywin32 executes OS actions synchronously; results are returned to Claude.
5. **ElevenLabs streaming TTS** — the response text is streamed to ElevenLabs and audio is piped to the speakers as it arrives, rather than waiting for the full response to generate.

### Persistent Memory — SQLite with Pattern-Matched Injection
Bobby maintains two memory stores in SQLite:
- **Fact memory:** explicit facts stored via a `remember_fact` tool that Claude decides to invoke when it hears something worth retaining ("my morning routine starts at 7am," "I prefer dark mode in all editors," "my main project is called Backlog"). Facts are short key-value pairs with optional tags.
- **Conversation history:** recent conversation turns (last N exchanges) are persisted and injected into the context window.

On every new message, facts are retrieved via pattern matching on the user's input against stored fact keys and tags — not vector search, just keyword overlap. The top-N most relevant facts are injected into the system prompt. This keeps memory injection cheap (no embedding model, no vector DB) while still surfacing relevant context.

The memory design is deliberately bounded: facts don't accumulate infinitely in the context window. Instead, relevance scoring keeps the injected subset small regardless of total fact count.

### Obsidian Vault Knowledge Base
Bobby indexes the user's Obsidian vault by reading the first three lines of up to 100 notes and injecting a flat preview list into the system prompt. This gives Bobby awareness of what knowledge exists in the vault without loading full note content. When a command references a topic that matches a note title or preview, Bobby can read the full note via the Obsidian REST API to answer with specific content.

### Named Shortcuts — "The Usual"
Users define named shortcut macros: ordered lists of actions to execute when a shortcut name is spoken. Example: "open the usual" → launch VS Code in the project directory, open Spotify in mini mode, open Discord, arrange windows in a two-column layout.

Shortcuts are stored as JSON in SQLite. Bobby recognizes shortcut names in natural language commands ("open the usual," "start my morning setup," "launch coding mode") and executes the action list via pywinauto.

### Safety-First OS Control
Dangerous terminal commands are blocked and require explicit verbal confirmation:
- Blocked patterns: `rm -rf`, `format`, `reg delete`, `del /f /s /q`, `shutdown`, `diskpart`
- Bobby reads back the command and asks "are you sure?" before executing anything in the blocked list
- The block list is configurable in settings

### React PWA + Screen Streaming Phone Bridge
A FastAPI server exposes:
- WebSocket endpoint for sending voice commands from the phone
- MJPEG stream of the Windows desktop at a configurable FPS
- REST endpoints for named shortcut management and memory viewing

Cloudflare Tunnel creates a persistent public HTTPS URL pointing to the local FastAPI server — no router port forwarding, no static IP required. The React PWA (installable on iOS/Android via "Add to Home Screen") connects to the Cloudflare URL, renders the live screen stream, and exposes a voice recording button that streams audio to the server.

## Measurable Outcomes / Impact
- Sub-2-second wake-to-response target with local wake word + local Whisper STT (no API calls for the first two pipeline stages)
- Zero cloud dependency for wake word detection — Porcupine runs entirely on CPU
- Pattern-matched memory injection keeps context window usage proportional to query relevance, not total fact count
- Cloudflare Tunnel provides remote access from any device without router configuration
- Safety confirmation step before any blocked-pattern OS command

## Best For (Role Targeting)
- AI/LLM engineering roles (multi-model orchestration, tool use, memory design)
- Python backend roles (FastAPI, SQLite, WebSockets)
- Voice/speech product roles (Siri, Alexa, Google Assistant teams; voice-enabled startup products)
- Roles at AI-native companies or AI-adjacent startups
- Roles where "local AI," "edge inference," or "on-device ML" is mentioned
- Any role where personal initiative and building tools for yourself is valued (demonstrates genuine engineering drive)

## Talking Points for Interviews
- **Local-first pipeline:** Wake word and STT both run locally — the only API calls in the hot path are Claude (reasoning) and ElevenLabs (TTS). This means the assistant still works if the WiFi is slow and latency is bounded by local compute, not network round-trips.
- **Memory without vector search:** Pattern-matched fact injection is cheaper and more predictable than embedding-based retrieval for a personal assistant with hundreds of facts (not millions). The tradeoff is recall quality, which is acceptable at this scale.
- **Streaming TTS:** Piping ElevenLabs audio to the speakers as it arrives rather than waiting for the full response to generate is the standard pattern for low-latency voice assistants — waiting for the full response would add 1–3 seconds of perceived silence.
- **Tool use routing:** Claude Haiku handles most tool dispatch cheaply; Claude Sonnet only fires for complex tasks. This is deliberate cost-aware model routing — the same pattern production AI products use to balance quality and cost.
- **Cloudflare Tunnel:** A zero-config approach to making a local service remotely accessible — no router configuration, no static IP, no port forwarding. The correct tool for a personal project that needs remote access.
