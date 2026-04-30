# Screenshot Guide

Drop screenshots into `docs/screenshots/` and commit. Raw GitHub URLs follow:

```
https://raw.githubusercontent.com/cs-keni/backlog/main/docs/screenshots/<name>.jpg
```

## Files expected

| Filename | What to capture |
|---|---|
| `dashboard.jpg` | `/dashboard` — full page: stats strip at top, newest jobs mini-feed, pipeline summary row, 30-day sparkline |
| `feed.jpg` | `/feed` — job feed with filter sidebar open, 3–4 cards visible, at least one with a match score badge |
| `job-detail.jpg` | `/feed` — job detail drawer open over the feed: company logo, match score + dimension breakdown tooltip visible, "Tailor Resume" and "Generate Cover Letter" buttons visible |
| `tracker.jpg` | `/tracker` — kanban board with cards spread across at least 3 columns (Saved, Applied, Phone Screen); detail panel open on the right |
| `analytics.jpg` | `/analytics` — charts view: stat cards at top, application activity bar chart, funnel chart visible |
| `company-graph.jpg` | `/analytics` — switch to Map view: force-directed company graph with colored nodes and edges visible, tooltip on a hovered node |
| `prep.jpg` | `/prep` — with a job selected: Question Bank section open showing behavioral + technical questions with hints, STAR builder visible |
| `dsa.jpg` | `/dsa` — Today's Reviews panel with 1–2 review cards; Calendar panel visible on the right with some days highlighted |
| `cover-letter.jpg` | Cover letter generator in action — inline editor with generated letter, template selector chips at top |
| `settings.jpg` | `/settings` — notification preferences: email toggle, push enable button, match threshold slider, quiet hours |

## Demo video

Expected path: `docs/demo.mp4`
Raw URL: `https://raw.githubusercontent.com/cs-keni/backlog/main/docs/demo.mp4`

**Suggested recording flow (60–90 seconds):**
1. Dashboard → scan stats strip
2. Feed → show live job cards with match scores; open a job detail; show dimension breakdown tooltip
3. Tracker → drag a card between columns
4. Analytics → switch to company graph, hover a node
5. DSA → mark a review done, watch it animate out
