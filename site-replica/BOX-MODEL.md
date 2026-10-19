# BOX-MODEL.md — Paul Hempstead replica

A structural breakdown of the original paulhempstead.com and the replica built from it.
The original is a Webflow site. Its visible document is three stacked overlays —
a loading screen, a fullscreen gallery that advances on click, and a fixed nav bar —
all inside a non-scrolling `<body>`.

## 1. Design tokens (extracted from the source CSS)

| Token            | Value         | Role                                          |
| ---------------- | ------------- | --------------------------------------------- |
| `--red`          | `#910d0d`     | Loading screen background, hover/current link |
| `--black`        | `#000`        | Base text, nav logo fill                      |
| `--white`        | `#fff`        | Mobile nav underline on red state             |
| `--cream`        | `#eacbb4`     | "enter" label and secondary nav text on red   |
| Body font        | `C 059 Roman` | Proprietary serif (replica substitutes it)    |
| Body size        | `1em / 1em`   | Base font-size with 1em line-height           |
| Nav title size   | `1.2rem`      | `.project-title-copy`                         |
| Enter label size | `1.8em`       | `.enter-text`                                 |

The replica substitutes the proprietary C 059 Roman with the open-license
**EB Garamond** (Google Fonts), which shares the same didone-flavoured serif
proportions.

## 2. Breakpoints

The original uses Webflow's defaults:

| Range              | Device   | Notes                               |
| ------------------ | -------- | ----------------------------------- |
| `≤ 479px`          | Mobile S | Small-phone adjustments             |
| `≤ 767px`          | Mobile L | Tablet-portrait and under           |
| `≤ 991px`          | Tablet   | Horizontal SVG logo hidden, mobile nav shown |
| `≥ 768px`          | Desktop  | Side images reveal, nav spreads out |

The replica keeps the same breakpoints (480 / 768 / 992) so the layout behaves
the same across devices.

## 3. Page tree

```
<body>                                   # 100vh, overflow:hidden, serif, flex column
├── .loading-screen                      # z:999, position:fixed, inset:0, bg: red
│   └── .loading-screen-wrapper          # flex column, gap:2em, centered
│       ├── .logo-wrapper img            # 40vw max-width, stacked PH logo
│       └── .enter-button
│           └── .enter-text              # font-size:1.8em, color:cream
├── <main id="gallery">                  # position:absolute inset:0, click→advance
│   ├── figure.image-container.center    # position:absolute, translate(-50%,-50%)
│   ├── figure.image-container.left      # position:absolute left:0 (desktop only)
│   └── figure.image-container.right     # position:absolute right:0 (desktop only)
└── <nav>.navbar                         # position:fixed, inset: auto 0 0, z:998
    ├── a.svg-link                       # 6vw horizontal wordmark (desktop)
    └── .nav-menu-wrapper
        ├── a.nav-link (Projects)
        └── a.nav-link (Info)
```

## 4. Box-by-box specification

### `body`
- `display: flex; flex-direction: column`
- `height: 100vh; overflow: hidden`
- `box-sizing: border-box` (replica adds this globally)
- `font-family: var(--font-serif)`

### `.loading-screen`
- `position: fixed; inset: 0`
- `width: 100svw; height: 100svh`
- `background: var(--red)`
- `display: flex; justify-content: center; align-items: center`
- `z-index: 999`
- Dismissed by JS once the user clicks "enter".

### `.loading-screen-wrapper`
- `display: flex; flex-direction: column; gap: 2em`
- `align-items: center; justify-content: center`

### `.logo-wrapper img`
- `width: clamp(220px, 40vw, 420px)` (fluid replacement for the original `40svw`)
- `height: auto`

### `.enter-text`
- `font-size: clamp(1.4rem, 2vw, 1.8rem)`
- `color: var(--cream)`
- `transition: opacity .4s`

### `main#gallery`
- `position: fixed; inset: 0`
- `cursor: pointer` (click advances image)
- `overflow: hidden`

### `.image-container`
- `position: absolute; top: 50%; transform: translateY(-50%)`
- `opacity: 0; transition: transform .3s, opacity .3s`
- `.active` adds `opacity: 1`.
- `.center-image` → `left: 50%; transform: translate(-50%,-50%)` and `z-index: 3`
- `.left-image`  → `left: 0; z-index: 2`
- `.right-image` → `right: 0; z-index: 2`
- At `≤ 768px`: left and right collapse to center (`left: 50% !important`).

### `.image-container img`
- `max-width: 100%; height: 100vh; object-fit: contain`
- `aspect-ratio` is preserved by `object-fit`, so images never stretch.

### `.navbar`
- `position: fixed; inset: auto 0 0`
- `width: 100%; z-index: 998`
- `padding: 1em 2em`
- `background: transparent` (becomes `var(--red)` with white hairline on child routes)
- Child layout: `display: flex; justify-content: space-between; align-items: center; gap: 1em`

### `.svg-link` (horizontal PH wordmark)
- Desktop: `width: 6vw; min-width: 72px; color: var(--black)`
- `≤ 991px`: `display: none`
- Mobile shows a smaller stacked logo in `.mobile-nav` instead.

### `.nav-link`
- `font-family: var(--font-serif); font-size: 1rem; line-height: 1em`
- `color: var(--black); text-decoration: none`
- Hover / current → `color: var(--red)`
- `≤ 991px`: fixed width `50px` so the two links sit at opposite ends of the bar.

## 5. ASCII layout at desktop (≥ 992px)

```
┌─────────────────────────────────────────────────────────────────────┐
│ .loading-screen (visible only on first load)                        │
│                                                                     │
│                       ┌───────────────┐                             │
│                       │  stacked PH   │                             │
│                       │     logo      │                             │
│                       └───────────────┘                             │
│                                                                     │
│                            e n t e r                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Beneath (always rendered, revealed after click):

┌─────────────────────────────────────────────────────────────────────┐
│ main#gallery                                                        │
│  ┌────────┐             ┌─────────────┐             ┌────────┐      │
│  │  left  │             │   centre    │             │ right  │      │
│  │  img   │             │     img     │             │  img   │      │
│  └────────┘             └─────────────┘             └────────┘      │
│                                                                     │
│                                                                     │
│                                                                     │
│  ┌───────┐                                       ┌────────────────┐ │
│  │ PH ▬  │  nav (fixed, bottom)      Projects    Info             │ │
│  └───────┘                                       └────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 6. ASCII layout at mobile (≤ 768px)

```
┌─────────────────────────┐
│ .loading-screen         │
│                         │
│    ┌─────────────┐      │
│    │ stacked PH  │      │
│    │    logo     │      │
│    └─────────────┘      │
│         enter           │
└─────────────────────────┘

Below:
┌─────────────────────────┐
│ main#gallery            │
│                         │
│    ┌───────────────┐    │
│    │               │    │
│    │   centre      │    │
│    │   image only  │    │
│    │               │    │
│    └───────────────┘    │
│                         │
│  nav (bottom)           │
│  Projects      Info     │
└─────────────────────────┘
```

## 7. Replica deviations

1. **Content**: all photographs, the Paul Hempstead wordmark and the proprietary
   C 059 Roman typeface are the artist's own. The replica substitutes placeholder
   photos (Picsum via data-URI fallback), a geometric wordmark drawn in SVG, and
   EB Garamond.
2. **Markup**: the original is Webflow-generated with CMS wrappers (`.w-dyn-list`,
   `.cms-data-source`). The replica uses semantic landmarks (`<header>`, `<nav>`,
   `<main>`, `<footer>`) instead of recreating the Webflow div soup.
3. **Fluid sizing**: the replica expresses lengths with `clamp()` where the
   original used raw `vw` units, so the layout holds up on 1920+ monitors and
   small phones without the horizontal scroll the original can produce at 320px.
4. **Editor overlay**: added by the brief, absent from the original. It is a
   `position: fixed` layer with its own stacking context (z-index above the
   loading screen) so it never alters the page geometry beneath.
