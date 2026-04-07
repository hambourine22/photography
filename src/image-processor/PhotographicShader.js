/**
 * PhotographicShader.js
 * HUX Image Grading — GPU-side GLSL
 *
 * Pipeline (in order):
 *   Exposure → Contrast/Brightness → Highlights/Shadows →
 *   Whites/Blacks → Clarity (unsharp mask) → Vibrance/Saturation → LUT
 */

export const PhotographicShader = {
  name: 'PhotographicShader',

  uniforms: {
    tDiffuse:    { value: null },   // Input texture (ShaderPass convention)
    tLUT:        { value: null },   // Data3DTexture — set null to bypass
    lutSize:     { value: 32 },     // LUT cube dimension (e.g. 32 → 32³)
    resolution:  { value: null },   // THREE.Vector2 — needed for clarity kernel

    // ── Exposure ──────────────────────────────────────────────────
    exposure:    { value: 0.0 },    // EV stops: 0 = no change, +1 = 1 stop up

    // ── Contrast / Brightness ─────────────────────────────────────
    contrast:    { value: 0.0 },    // -1 → +1
    brightness:  { value: 0.0 },    // -1 → +1

    // ── Highlights / Shadows ──────────────────────────────────────
    highlights:  { value: 0.0 },    // -1 → +1, affects luma > 0.75
    shadows:     { value: 0.0 },    // -1 → +1, affects luma < 0.25

    // ── Whites / Blacks ───────────────────────────────────────────
    whites:      { value: 0.0 },    // -1 → +1, clips/extends near 1.0
    blacks:      { value: 0.0 },    // -1 → +1, clips/extends near 0.0

    // ── Clarity ───────────────────────────────────────────────────
    clarity:     { value: 0.0 },    // 0 → 1, edge-contrast boost

    // ── Vibrance / Saturation ─────────────────────────────────────
    vibrance:    { value: 0.0 },    // -1 → +1, targets under-saturated pixels
    saturation:  { value: 0.0 },    // -1 → +1, global
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;
    precision highp sampler3D;

    uniform sampler2D tDiffuse;
    uniform sampler3D tLUT;
    uniform float     lutSize;
    uniform vec2      resolution;

    uniform float exposure;
    uniform float contrast;
    uniform float brightness;
    uniform float highlights;
    uniform float shadows;
    uniform float whites;
    uniform float blacks;
    uniform float clarity;
    uniform float vibrance;
    uniform float saturation;

    varying vec2 vUv;

    // ── Helpers ───────────────────────────────────────────────────

    float luma(vec3 c) {
      return dot(c, vec3(0.2126, 0.7152, 0.0722));
    }

    // Smooth step mask centred at [centre] with half-width [width]
    float toneMask(float l, float centre, float width) {
      float lo = smoothstep(centre - width, centre, l);
      float hi = smoothstep(centre + width, centre, l);
      return lo * hi;
    }

    // Remap: [-1,+1] → multiplicative gain around 1.0
    float gainFromSlider(float s) {
      return 1.0 + s;
    }

    // Apply LUT — neutral if tLUT is not bound (workaround: check via lutSize <= 0)
    vec3 applyLUT(vec3 col) {
      // Scale into [0.5/N, 1-0.5/N] to land at texel centres
      float scale  = (lutSize - 1.0) / lutSize;
      float offset = 0.5 / lutSize;
      vec3 uvw = col * scale + offset;
      return texture(tLUT, uvw).rgb;
    }

    // ── Clarity kernel (3×3 unsharp mask) ─────────────────────────
    // Samples neighbours to compute a blurred version, then blend.
    vec3 clarityPass(vec2 uv, vec3 col) {
      if (clarity <= 0.0) return col;

      vec2 texel = 1.0 / resolution;

      // 3×3 box blur
      vec3 blur = vec3(0.0);
      float w = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          float k = (x == 0 && y == 0) ? 4.0 : 1.0; // centre-weighted
          blur += texture2D(tDiffuse, uv + vec2(float(x), float(y)) * texel).rgb * k;
          w += k;
        }
      }
      blur /= w;

      // Unsharp: col + amount * (col - blur)
      return col + clarity * (col - blur);
    }

    // ── Main ──────────────────────────────────────────────────────

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // 1. Exposure (linear, in stops)
      col *= pow(2.0, exposure);

      // 2. Contrast & Brightness  (pivot at 0.5)
      col = (col - 0.5) * (1.0 + contrast) + 0.5 + brightness;

      // 3. Highlights — affects luma > 0.75
      {
        float l  = luma(col);
        float m  = smoothstep(0.5, 1.0, l);        // ramps up above 0.5
        col += m * highlights * col;                // additive gain in highlights
      }

      // 4. Shadows — affects luma < 0.25
      {
        float l  = luma(col);
        float m  = 1.0 - smoothstep(0.0, 0.5, l);  // ramps up below 0.5
        col += m * shadows * col;
      }

      // 5. Whites — push/clip near pure white
      {
        float l = luma(col);
        float m = smoothstep(0.75, 1.0, l);
        col = mix(col, vec3(1.0), m * whites * 0.5);
      }

      // 6. Blacks — crush/lift near pure black
      {
        float l = luma(col);
        float m = 1.0 - smoothstep(0.0, 0.25, l);
        col = mix(col, vec3(0.0), m * (-blacks) * 0.5); // negative blacks → crush
        col = mix(col, col + 0.05, m * max(0.0, blacks) * 0.5); // positive → lift
      }

      // 7. Clarity (unsharp mask, sampled from original to avoid feedback)
      col = clarityPass(vUv, col);

      // 8. Saturation (global)
      {
        float l   = luma(col);
        float sat = 1.0 + saturation;
        col = mix(vec3(l), col, sat);
      }

      // 9. Vibrance — boost saturation where it is already low
      {
        float l        = luma(col);
        float maxCh    = max(col.r, max(col.g, col.b));
        float minCh    = min(col.r, min(col.g, col.b));
        float sat      = maxCh - minCh;            // rough saturation estimate [0,1]
        float vMask    = 1.0 - sat;                // inverse: high for dull pixels
        col = mix(vec3(l), col, 1.0 + vibrance * vMask);
      }

      // 10. LUT (only when lutSize > 0 and texture is bound)
      if (lutSize > 0.0) {
        col = applyLUT(clamp(col, 0.0, 1.0));
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
