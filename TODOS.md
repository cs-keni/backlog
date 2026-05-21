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

### Profile address subfields (street, city, state, zip)
**What:** Add separate `street_address`, `city`, `state`, `postal_code` columns to the user profile DB table and expose them in the Profile UI. The extension would read from these directly instead of parsing a single address string.
**Why:** `parseAddress()` (added 2026-05-15) is a stopgap that parses "6925 SE 152nd Ave., Portland, OR 97236". Explicit fields eliminate parsing fragility and correctly handle international addresses where there is no 2-letter state code.
**How to apply:** DB migration to add the 4 columns. Update `/api/profile` to return them. Update the Profile page to have separate input fields. Update extension's `WORKDAY_ID_MAP` and `FIELD_MAP` to read the explicit fields directly (no `parseAddress()` needed). Keep `parseAddress()` as a fallback when explicit fields are absent.
**Depends on:** Nothing blocking. Can be done anytime.

### Radio button workHistory check
**What:** When filling "Have you previously worked at [company]?" radio buttons, check `profile.work_experience` for prior employment at the company name instead of always defaulting "No".
**Why:** The current implementation (added 2026-05-15) defaults to "No" for any employment question. This is safe (user reviews before submitting) but will give the wrong answer for users applying back to former employers.
**How to apply:** In the `RADIO_FIELD_MAP` employment resolver, extract the company name from the question text and cross-reference against `profile.work_experience[].company`. If a match is found, answer "Yes"; otherwise "No".
**Depends on:** Radio button support (Phase 10B) + profile.work_experience being populated.

### Workday DOM fixture capture for fill.test.ts
**What:** After live testing on a real Workday application, capture serialized HTML (including shadow DOM) as a test fixture file. Use this in fill.test.ts to test Workday-specific behavior against a real DOM structure rather than synthetic jsdom trees.
**Why:** Codex flagged during the 2026-05-15 eng review that synthetic tests won't catch real Workday behavior: nested shadow roots, repeated automation IDs across steps, async mount order, React controlled inputs.
**How to apply:** On a real Workday application page (console), run: `document.documentElement.outerHTML` to capture the serialized DOM. Save to `extension/src/test/fixtures/workday-page1.html`. Then write `fill.test.ts` tests that load this fixture into jsdom and run `computeFills` against it.
**Depends on:** Workday text-input fill being implemented and tested live first.

---

## Wave 2 Deferred / Wave 3

### Salary negotiation playbook
**What:** When an application moves to `offer` status, surface a comp range estimate + counter-offer email template.
**Why:** The most financially consequential moment in the job search gets zero support today. Typical negotiation on a $160K offer is worth $10-25K.
**Blocked on:** Reliable per-company compensation data. Levels.fyi isn't programmatically accessible. Unblock by: (a) letting the user manually input the offer, then comparing to general negotiation bands (15-20% counter is standard), or (b) adding a `comp_target` field to the user profile that the playbook uses as the anchor.
**How to apply:** Trigger on `status = 'offer'` in ApplicationDetail. Show: "Your target: $X. Typical counter: $X × 1.15–1.20. Here's the email:" with a generated template. Store user's `comp_target` in `users` table.
**Effort:** M once comp data story is decided.

### Warm referral radar
**What:** Detect LinkedIn connections at companies where you have open applications. Surface the connection + a message template.
**Why:** Referrals get 5-10x better callback rates than cold applications. This is the highest-leverage action in job search.
**Blocked on:** LinkedIn data access. Options: (a) Chrome extension reads LinkedIn connections page and syncs to Backlog, (b) user pastes LinkedIn export CSV, (c) user manually enters connections per company.
**Effort:** M (data pipeline) + S (UI).

### Auto-apply review queue
**What:** Backlog curates 3-5 matching jobs per day and queues them for your 5-minute morning review. You approve → extension applies.
**Why:** Closes the loop between job discovery and application submission without spam.
**Blocked on:** Callback rate data (Wave 2 P3) to validate that match quality is high enough before auto-applying. Don't ship this until P3 shows the matching is trustworthy.
**Effort:** L.

### ATS keyword gap analysis
**What:** Per job description, show which keywords your resume is missing. Integrated as a tab in ApplicationDetail.
**Why:** Direct competitor feature (Teal does this). High perceived value for ATS-heavy companies.
**How to apply:** Diff job description keywords against resume text using TF-IDF or simple word set overlap. Highlight top 5-10 missing terms.
**Effort:** M.
