# Kenny's Minesweeper — Keyboard-Controlled Minesweeper with Real-Time Probability Analysis

## One-Line Pitch
A modern, keyboard-controlled Minesweeper built in vanilla JavaScript with a real-time probability analysis engine that evaluates multiple revealed cell constraints simultaneously and displays a modal popup near the selected cell showing the mathematical reasoning behind each probability estimate.

## Status
GitHub: [cs-keni/minesweeper-for-me](https://github.com/cs-keni/minesweeper-for-me)

## Problem Statement
Standard Minesweeper has two frustrating failure modes: the first click can immediately hit a mine (pure luck), and when the board reaches a constrained state with no obvious moves, players must guess blindly. This implementation eliminates both: the first-click guarantee ensures every game starts with a logical foundation, and the probability engine gives players a mathematically-grounded basis for every decision.

## What Was Built
A complete, self-contained Minesweeper implementation in vanilla JavaScript (no frameworks) with: a first-click guarantee that auto-reveals a safe starting area, a real-time multi-constraint probability engine with certainty prioritization, a dynamic modal popup positioned near the selected cell with detailed constraint breakdowns, full keyboard control with customizable keybinds persisted to LocalStorage, and a responsive UI built in HTML5/CSS3.

## Tech Stack
- **Language:** JavaScript (ES6+) — vanilla, no frameworks or build tools
- **UI:** HTML5, CSS3
- **Persistence:** LocalStorage (custom keybinds, settings)
- **Architecture:** Object-Oriented Design (Cell, Board, ProbabilityEngine, KeybindManager classes)

## Features in Detail

### First-Click Guarantee — Safe Start Algorithm
On the first click, the mine placement algorithm runs *after* the click is registered, not before. The algorithm:
1. Excludes the clicked cell and all 8 adjacent cells from mine placement
2. Distributes all mines randomly across the remaining cells
3. Automatically reveals all safe cells within a 2-cell radius of the clicked cell using a flood-fill reveal

Result: every game starts with a revealed area that has logical structure — multiple numbered cells visible, enough information to make a real deduction on the first move. The luck-based "first click into a mine" outcome is eliminated entirely.

### Real-Time Multi-Constraint Probability Engine
The probability engine runs whenever a cell is selected on the keyboard and displays a probability estimate in the popup modal. The algorithm:

1. **Constraint collection:** For each unrevealed cell, collect all revealed numbered neighbors that constrain it. Each revealed number forms a constraint equation: "among these N unrevealed cells in my neighborhood, exactly K are mines."
2. **Single-constraint estimate:** For each constraint that includes the selected cell, compute the naive probability: K mines / N unrevealed cells in this constraint.
3. **Multi-constraint weighting:** When multiple constraints overlap on the same cell, the estimates are averaged with weighting. Constraints with fewer cells in their scope (more information-dense) receive higher weight.
4. **Certainty prioritization:** 0% probability (the cell is definitively safe) and 100% probability (the cell is definitively a mine) take absolute priority over averaged estimates. If any single constraint proves certainty, it overrides the weighted average.

The popup displays not just the final probability but the per-constraint breakdown — each revealed neighbor's constraint shown individually so the player can see the reasoning.

### Dynamic Modal Popup — Positioned Near Selected Cell
The modal is rendered as a DOM element absolutely positioned near the keyboard-selected cell. Positioning logic:
- By default, appears to the right of the selected cell
- If the cell is near the right edge of the board, the modal flips left
- If the cell is near the bottom edge, the modal appears above
- An arrow pointer (CSS triangle) points from the modal toward the selected cell

Contents: the final probability estimate (displayed prominently), then a list of each contributing constraint with its cell count and mine count, and an inline explanation of how the estimates were combined.

### Full Keyboard Control with Customizable Keybinds
- Arrow keys navigate the cell selection cursor across the board
- Configurable keybinds for: reveal cell, flag cell, chord (reveal all neighbors when flag count matches number), open probability popup, restart game
- Keybind configuration stored in LocalStorage — persists across sessions and browser restarts
- Quick-action shortcuts: restart without confirmation, toggle flag mode

## Measurable Outcomes / Impact
- First-click guarantee: 100% of games start with a revealed area containing at least one multi-digit numbered cell
- Probability engine handles multi-constraint overlaps with weighted averaging and 0%/100% certainty override
- Modal popup positions correctly across all four board edges with CSS-computed arrow pointer
- Full keyboard navigation — playable with zero mouse interaction
- Custom keybinds persist to LocalStorage with no backend required

## Best For (Role Targeting)
- Roles that want to see raw JavaScript competency without framework scaffolding
- Roles where algorithmic thinking or problem-solving ability is the emphasis
- Frontend roles at companies that care about vanilla JS, performance, and avoiding unnecessary dependencies
- Any role where the portfolio needs to demonstrate logical thinking through a self-contained system
- Game development adjacent roles or roles building interactive grid/board UIs

## Talking Points for Interviews
- **Algorithm design from scratch:** The multi-constraint probability engine isn't a library call — it's a custom algorithm that models constraint overlap, weighted averaging, and certainty escalation. Explaining the algorithm demonstrates CS fundamentals applied to a real problem.
- **No framework, no build tool:** Written in ES6+ classes directly, bundled as plain HTML/JS. This demonstrates ability to work without scaffolding — useful context when joining legacy codebases or explaining why frameworks exist.
- **Mine placement as a post-click decision:** Most Minesweeper implementations place mines before the board is shown, then pray the first click doesn't hit one. Deferring placement to after the first click is the architecturally correct solution — the board's final layout is a function of the player's first input.
- **Constraint certainty override:** Weighted averaging is useful for uncertain states, but a cell that is provably safe (all constraints agree it's 0%) must be flagged as definitely safe regardless of the averaged estimate. The override logic handles this correctly — a common bug in naive probability engines is that averaging can drift a 0% cell to 2% when many uncertain constraints overlap.
- **LocalStorage as the right tool:** Keybinds don't need a backend — LocalStorage is the correct persistence choice for per-browser user preferences at this scale.
