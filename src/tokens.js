// ─── HUX DESIGN TOKENS ────────────────────────────────────────────────────────
// Single source of truth for all colour, typography, and scene values.
// Import from here rather than using inline strings across experience files.

// ── PRIMITIVE COLOUR TOKENS ───────────────────────────────────────────────────
// Blue scale: 100 = darkest navy → 10 = near-white
export const color = {
  blue100 : '#070726',
  blue95  : '#0c0d4a',
  blue90  : '#11156f',
  blue85  : '#161c94',
  blue80  : '#201fff',
  blue70  : '#3850ff',
  blue60  : '#5a78ff',
  blue50  : '#7e99ff',
  blue40  : '#a9b8ff',
  blue30  : '#d3dcff',
  blue20  : '#e7ebff',
  blue10  : '#f5f7ff',

  pink    : '#f72e62',

  white   : '#ffffff',
  grey10  : '#f4f4f4',
  grey30  : '#c9c9c9',
  grey50  : '#a0a0a0',
  grey70  : '#4e4e4e',
  grey90  : '#1e1e1e',
}

// ── SEMANTIC TOKENS ───────────────────────────────────────────────────────────
// Maps design intent to primitive values.
export const theme = {
  background  : color.blue80,    // scene / page background
  surface     : color.blue100,   // cube sides, card surfaces
  accent      : color.pink,      // highlights, cube tops
  textPrimary : color.white,
  textAccent  : color.pink,
  textMuted   : color.grey10,
  lineColour  : color.grey10,
}

// ── COLOUR PALETTE ────────────────────────────────────────────────────────────
// Ordered array used by the Colour experience for ball materials.
export const colorPalette = [
  color.blue80,  color.pink,    color.white,   color.grey10,  color.grey30,
  color.grey50,  color.grey70,  color.grey90,  color.blue100, color.blue95,
  color.blue90,  color.blue85,  color.blue70,  color.blue60,  color.blue50,
  color.blue40,  color.blue30,  color.blue20,  color.blue10,
]

// ── TYPOGRAPHY TOKENS ─────────────────────────────────────────────────────────
export const typography = {
  fontPath : '/fonts/mfred.json',
  size     : { hero: 2.4, display: 1.6, title: 1.2, body: 0.8 },
  depth    : 0.3,
  bevel    : { enabled: true, thickness: 0.03, size: 0.03, segments: 4 },
}

// Colour subset used for 3D letter materials
export const typographyPalette = [color.pink, color.blue80, color.blue50]
