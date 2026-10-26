# site-replica — тисяча · distance travelled

Photographs from the road, Bristol to Kyiv, 18–22 November 2024: тисяча, the
thousandth day. The layout started as a plain-HTML / CSS / JS replica of the
paulhempstead.com portfolio, built as a learning exercise; the palette and type
now come from the 1000 design system. No framework. No build step.

- `images/main/` — the gallery frames, `dt1000-L<number>.jpg`, 2000 px wide, with
  800 px copies in `thumbs/`. The L number is the camera frame number on the
  original file (`…_DT1000_L1062013.jpg`). The gallery runs in L order, which is
  the order of the journey, with two exceptions set by hand: the agricultural
  lorry, trailer and turbines (L1062013–L1062049) follow the sea frames, and
  the Lviv night frames (L1061972–L1062003) follow the dusk bridge (L1062081).
  Dover frames without a known L number are named by place. Order lives in
  `index.html`; insert new frames by L number, minding those blocks.
- `images/info/` — the maquette spreads shown on the Info page,
  `maquette-00.jpg` to `-05.jpg`, 2400 px wide.
- `images/_originals/` — the full-size files; ignored by git and by Vercel.
- `anatomy/` — the three.js motion version of the anatomy sheet, built from
  `src/distance-travelled` on the `feature/distance-travelled` branch:
  `ANATOMY_SRC=<that folder> <repo>/node_modules/.bin/vite build --config anatomy.vite.config.mjs`
  (run from a checkout of that branch). Linked from the nav as "Anatomy".

## Files

| File              | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `index.html`      | Semantic markup: loading screen, gallery, nav, info panel.        |
| `styles.css`      | Mobile-first CSS with design tokens, `clamp()` type, breakpoints. |
| `editor.js`       | Floating editing GUI.                                             |
| `BOX-MODEL.md`    | Box-by-box layout documentation and ASCII diagrams.               |
| `reference/`      | Local-only copies of the source HTML and CSS, for comparison.     |

The files in `reference/` are **not** shipped. They are used only to compare the
replica with the original during development.

## Running

Any static server works, because there is no build step:

```bash
cd site-replica
python3 -m http.server 8000
# or: npx serve .
```

Then open `http://localhost:8000/`.

> `editor.js` is loaded as an ES module, so you need `http://` — opening
> `index.html` as a `file://` URL will block the module and the IndexedDB /
> fetch calls that the export relies on.

## Using the GUI

A small toolbar lives in the bottom-right corner. The icons from left to right:

| Button      | What it does                                                      |
| ----------- | ----------------------------------------------------------------- |
| ✎ Edit      | Toggles contenteditable on headings, paragraphs, nav labels, and the caption. Edits autosave to `localStorage`. |
| ◉ Colours   | Opens a panel of live colour pickers bound to the five CSS variables (`--bg`, `--text`, `--accent`, `--surface`, `--border`), plus five preset palettes (Default, Light, Dark, Warm, Mono, High contrast) and a "Reset to default". A warning shows under the panel if text/surface contrast falls below WCAG AA (4.5:1). |
| ▦ Inspect   | Draws a 1px outline around every box and shows the viewport width plus the current breakpoint name in the top-left. Hovering a box tints it. |
| ▭ Preview   | Buttons for 375 / 768 / 1280 pixels load the page inside a framed iframe at that width. "Off" dismisses the frame. |
| ⬇ Export    | Serializes the current DOM — including the edited copy, the current colours, and any replaced images (as data URIs) — into a standalone `export.html` and downloads it. The editor UI is stripped from the export. |

### Replacing an image

Toggle **Edit**, then either click any image to open the file picker, or drop
an image onto it. The file is resized to a maximum of 1600 pixels wide via a
canvas, re-encoded as a progressive JPEG at adaptive quality, and stored in
IndexedDB so it survives page reloads (`localStorage` would overflow quickly).
Each image container gets a **Replace** and **Reset** button that appear on
hover; **Reset** removes the IndexedDB entry and reloads so the original
placeholder returns.

### Keyboard

- `Cmd/Ctrl + E` toggles edit mode.
- `Esc` closes any open panel and dismisses the preview frame.
- Every control is reachable with `Tab` and has a visible focus ring and an
  `aria-label` or `aria-pressed` state.

## Deviations from the original

The replica deviates in a handful of places. All of them are deliberate.

1. **Content.** All photographs, the Paul Hempstead wordmark, and the
   proprietary C 059 Roman typeface belong to the artist. The replica uses
   placeholder SVG images, a geometric wordmark drawn in SVG, and the
   open-license **EB Garamond** from Google Fonts.
2. **Markup.** The original is Webflow-generated with CMS wrappers
   (`.w-dyn-list`, `.cms-data-source`, hidden `.w-dyn-empty` placeholders).
   The replica uses semantic landmarks (`<header>`, `<nav>`, `<main>`,
   `<footer>`) and ids/data-attributes for hooks instead of recreating the
   generated div soup.
3. **Fluid sizing.** The original uses raw `vw` units for the stacked logo and
   the horizontal wordmark. The replica expresses the same intent with
   `clamp()` so it clamps on 320px phones and 1920+ monitors instead of
   producing horizontal scroll.
4. **Behaviour.** The original fetches images from the Webflow CMS and
   advances through them on each click. The replica keeps the click-to-advance
   gesture but rotates three local slots instead, because the real images are
   not ours to redistribute.
5. **Info panel.** The original ships `/info` as a separate route. The replica
   folds the equivalent copy into a dismissable overlay on the same page, to
   keep the deliverable to three files.
6. **Editor overlay.** Not present on the original. Added by the brief as a
   `position: fixed` layer at z-index 10000, so it does not alter the geometry
   of the page beneath.

## Accessibility notes

- `lang="en"` on `<html>`.
- Landmarks: `<header>` for the loading screen, `<main>` for the gallery,
  `<nav>` for primary navigation, `<section>` for the info panel.
- Images carry descriptive `alt` text and the gallery itself has an
  `aria-label` describing the click-to-advance behaviour.
- `prefers-reduced-motion` is honoured — all transitions collapse to 0.01ms.
- Focus rings are visible on every interactive control (both the page and
  the editor UI), and the toolbar uses `aria-pressed` / `aria-expanded` for
  state and `role="toolbar"` for structure.
- A WCAG AA contrast check runs in the colour panel; a warning surfaces when
  text/surface contrast falls below 4.5:1.
