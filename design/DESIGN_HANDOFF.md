# The Village Hall Record — Redesign Handoff

Reference mockups are in this folder: `home.html`, `library-board.html`, `meeting-summary.html`.
They are exported from a design tool, so ignore the `<x-dc>`, `<helmet>` and `data-dc-script` wrappers and the `support.js` script tag. Read them for markup structure, copy, inline styles and exact values only. Implement in the existing Next.js app using its current conventions (Tailwind, CSS modules, etc.) and keep all existing data fetching and routes working.

## Design tokens

Fonts (Google Fonts, load with `next/font/google`):
- Display / headings: **Newsreader**, weights 500 and 600 (optical size axis on)
- Body / UI: **Public Sans**, weights 400, 500 and 600
- Dates and labels: **IBM Plex Mono**, weight 500

Colors:
| Token | Hex | Use |
|---|---|---|
| ground | `#F5F6F3` | page background |
| surface | `#FFFFFF` | panels, inputs, highlighted row |
| ink | `#15201B` | primary text, heavy rules |
| ink-2 | `#46504A` | secondary text |
| muted | `#59625C` | captions, meta (passes 4.5:1 on ground) |
| rule | `#D5D9D3` | hairlines |
| rule-soft | `#E4E7E2` | rows inside panels |
| border-strong | `#A9B1AB` | input and secondary button borders |
| accent | `#1E4D36` | links, primary buttons, active states |
| accent-hover | `#123323` | link hover |
| signal | `#8A4A12` | "Latest" tag, AI caution icon |

Layout: content max-width 1120px, 24px side padding. Section rules: 1px `rule` hairlines; the masthead/page header ends with a `3px double ink` border. Radius 4px on controls, 6px on panels. Touch targets at least 44px tall.

Remove all emoji from the UI (📄 🎥 📝 ✉️ ✨ ⏳). Use plain text links or simple inline stroke SVG icons instead.

## Shared header and footer
- Header: wordmark "The Village Hall Record" in Newsreader 600, 22px, links home. Right side: "Municipalities", "How it works". 64px tall, bottom hairline.
- Footer: wordmark + "— an independent civic transparency platform." and About / Contact links.

## 1. Homepage (`/`)
See `home.html`.
- Hero, two columns that stack on mobile:
  - Left: mono eyebrow "Local government, small-town scale"; H1 "Making local politics accountable and accessible." (Newsreader 500, clamp 40–68px); supporting paragraph; labeled search ("Find your municipality") with a visible **Search** button.
  - Right: "Now covering · N municipalities" panel, generated from the municipalities list. Each municipality shows name, state, county, then one row per board linking to that board page with a meta line (for example "153 meetings · 2014–2026"). Ends with "Don't see your town? Request it".
- "Latest from Elmwood Park": the 3 most recent meetings across boards, using existing meeting data. Each row: mono date, board name, a status line ("Agenda posted · minutes not yet available"), and links to available docs plus Summary.
- "What's in the record": 4-column grid (auto-fit, min 230px) for Agendas, Minutes and votes, Meeting video, Plain-English summaries. Each column has a 2px ink top rule and a small icon.

## 2. Board page (`/village/elmwood-park-il`)
See `library-board.html`.
- Header: breadcrumb (Home / Elmwood Park, IL); H1 "Elmwood Park Library Board"; one-line description; a stats list (Meetings count, archive year range, latest meeting date), all computed from data. Board switcher as tabs under the header (Library Board / Village Board), active tab underlined in accent. This replaces the dropdown in the top nav.
- Two columns (sidebar stacks on top on mobile):
  - Sidebar: search input, year picker as a 3-column grid of mono buttons (plus "All years"), "Has document" checkboxes (Minutes, Video, Director's letter) that filter the list, and the AI disclaimer: "Summaries are AI-generated from the official documents. Always check the original before citing."
  - Main: meetings **grouped by year** instead of the 2-column card grid. Year header: Newsreader 34px year plus "N meetings", with a secondary "Summarize the year's agendas" button (replaces "Summarize all 2026 agendas").
  - Meeting row: mono date (for example "Oct 27") with the weekday under it; text links for each available document (Agenda, Minutes, Video, Director's letter). When a recent meeting has no minutes yet, show "Minutes not yet posted" in muted text. **One "Summarize" button per row** with a dropdown listing the available sources (agenda / minutes / letter), replacing the 1–3 separate summarize buttons. The most recent meeting gets a white background and a "Latest" tag.
  - Show about 6 meetings per year, then a "Show all N meetings from YYYY" link.

## 3. Meeting summary page (new route)
See `meeting-summary.html`. Replace the summary modal with a real, shareable page, for example `/village/elmwood-park-il/library-board/2026-08-10?source=minutes`.
- Breadcrumb, mono eyebrow "Minutes summary · Library Board", H1 = the meeting date.
- AI disclaimer line with a link to the official document.
- **At a glance**: a grid of 2–4 key figures.
- **Decisions**: a list of motions, each with a status label (Approved / Failed / Tabled), a one-line description, and notes (abstentions, no votes).
- Narrative sections as short paragraphs under Newsreader 24px headings, body 18px with line-height 1.65, max width about 700px.
- Footer: "Report an error in this summary" plus previous/next meeting links.
- Sidebar: Official documents (external links), "Other summaries" switcher (from the minutes / agenda / director's letter), Copy link button.
- Drop the duplicate title, the repeated date and the "Here's a straightforward overview…" opener.

### Summary prompt change
Update the LLM summarization to return structured JSON so the page can render the sections above, for example:
```json
{
  "key_figures": [{"label": "Cash on hand", "value": "~$331,000"}],
  "decisions": [{"status": "approved", "motion": "…", "notes": "President Pesko abstained."}],
  "sections": [{"heading": "Finances", "body": "…"}]
}
```
No preamble, and no restating the title or date. Cache generated summaries so each meeting's page loads instantly and has a stable URL.

## Accessibility
Real `<button>`, `<a href>` and `<label>` elements; `aria-current` on the active year, tab and breadcrumb item; decorative SVGs get `aria-hidden="true"`; keep the 4.5:1 contrast of the colors above.
