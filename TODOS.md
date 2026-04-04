# TODOS

Deferred tasks and known issues. Each item has enough context to pick up months later.

---

## Extension / Phase 10A

### Haiku API timeout + fallback (CRITICAL)
**What:** Add a 5-second timeout on the `POST /api/extension/analyze-page` call. On timeout or any error (500, network failure), fall back gracefully to deterministic-only fill. Surface a small note in the review panel: "AI analysis unavailable — filled with profile data only."
**Why:** Currently the extension hangs indefinitely in "Filling form..." state if Anthropic is slow or down. Silent hang with no recovery path. This is the only critical gap identified in the eng review.
**How to apply:** In the content script's fill flow (fill.ts or the new multi-page controller), wrap the analyze-page fetch in a `Promise.race` with a 5s timeout. Catch errors and continue with whatever Tier 1 filled. The review panel should not be blocked by this failure.
**Depends on:** Phase 10A Haiku endpoint being built first.

### Next-button modal guard
**What:** The Next-button detection heuristic may misfire if a form page has a modal open with its own "Continue" button. The extension should detect whether a modal is currently visible (via `[role="dialog"]`, `aria-modal="true"`, or `.modal.show`) and not advance past it.
**Why:** Could silently skip a modal the user needs to interact with (e.g., a terms-of-service acknowledgment or CAPTCHA prompt).
**How to apply:** In the Next-button detector, check for visible modals before clicking. If a modal is open, surface it in the popup ("Modal detected — review it before continuing") rather than advancing.
**Depends on:** Next-button detection being implemented first.
