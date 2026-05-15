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

### Workday async combobox fill — Phase 2
**What:** Add async dropdown filling for Workday's custom combobox components: country, state/province, work authorization, phone country code, employment type.
**Why:** Deferred from the initial Workday autofill implementation (Phase 2 decision in eng review 2026-05-15). After live testing of the text-input fill, confirm which comboboxes block page progression — those are the ones to prioritize.
**How to apply:** Implement `fillWorkdayDropdown(el: Element, value: string): Promise<void>` that: (1) clicks the combobox trigger element `[data-automation-id="..."] [role="combobox"]`, (2) waits for `[role="option"]` list to appear via MutationObserver or 300ms poll, (3) finds the option matching `value` (case-insensitive), (4) clicks it. Handle cascading: country → state requires a second pass after the country combobox settles. Wire this as a post-pass after `applyFills()` in the Workday path.
**Trigger condition:** Test the text-only Workday fill on a real application first. If country/state/work-auth block page 1 advancement, this becomes high priority.
**Depends on:** Workday text-input fill (Phase 1) + live testing to identify gated fields.

### Workday DOM fixture capture for fill.test.ts
**What:** After live testing on a real Workday application, capture serialized HTML (including shadow DOM) as a test fixture file. Use this in fill.test.ts to test Workday-specific behavior against a real DOM structure rather than synthetic jsdom trees.
**Why:** Codex flagged during the 2026-05-15 eng review that synthetic tests won't catch real Workday behavior: nested shadow roots, repeated automation IDs across steps, async mount order, React controlled inputs.
**How to apply:** On a real Workday application page (console), run: `document.documentElement.outerHTML` to capture the serialized DOM. Save to `extension/src/test/fixtures/workday-page1.html`. Then write `fill.test.ts` tests that load this fixture into jsdom and run `computeFills` against it.
**Depends on:** Workday text-input fill being implemented and tested live first.
