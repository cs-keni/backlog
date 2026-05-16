# Current Task

**Last updated:** 2026-05-15
**Status:** Phase 10B smoke test bugs fixed — ready for second smoke test

---

## Fixed in this session (commit afaa5b6)

1. **"Enhancing with AI…" stuck indefinitely** — `chrome.storage.session` was throwing on Workday and crashing `runTier2AndFinish` before it could set `status: review`. Fixed with try-catch.
2. **Phone Extension filled incorrectly** — "Phone Extension" label matched `/phone/` pattern. Fixed by adding `exclude: /ext(ension)?/` to the phone FIELD_MAP entry.
3. **Cancel button** — Added to `FillingState` so the user can abort mid-fill at any time.

---

## Known remaining issues (from smoke test)

### Address parsing (profile data issue)
The profile stores address as "Portland, OR" (city + state, no street, no zip). The extension has no street address to fill and extracts the zip incorrectly. User needs to add their full address to their Backlog profile, OR we add separate address subfields to the profile.

### State dropdown not filled (Phase 10B.2)
Workday state/country/city use async custom comboboxes (not `<select>`). Clicking them triggers a dropdown that needs: type → wait → click match. Deferred to Phase 10B.2.

### "Worked at Workday" radio (Yes/No)
Yes/No radio buttons not handled. The `FIELD_MAP` has checkbox/yes-no patterns but not radio group detection. Needs investigation of the actual Workday DOM structure.

---

## Next smoke test checklist

1. Reload extension after this commit
2. Fill out Workday application page 1
3. Verify phone extension is now empty
4. Verify sidebar exits "filling" state (no longer stuck)
5. Test Cancel button works
6. Check address Line 1 — note what value appears
7. Continue to page 2 and note behavior

---

## Phase 10B.2 (deferred)

- Async Workday combobox fill (country/state/city)
- Radio button (Yes/No) field support
- Workday DOM fixture capture for regression tests
- E2E Playwright scan → apply flow
