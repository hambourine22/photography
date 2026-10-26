import * as THREE from 'three'
import GUI from 'lil-gui'
import gsap from 'gsap'
import { OrbitControls }              from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { LineSegments2 }              from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry }       from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial }               from 'three/examples/jsm/lines/LineMaterial.js'
import { TOTAL_KM, WAYPOINTS, DAYS, LEGS, CROSSINGS, FRAMES } from './data.js'
import { Guidance } from './Guidance.js'
import { Exporter } from './Exporter.js'

// ── Palettes ──────────────────────────────────────────────────────────────────
// guidance — the instrument references: white hairlines on black.
// night    — the 1000 tokens: cream on #141414.
// In both, flag blue and yellow mark two things only: М5 and Т19.
const THEMES = {
    guidance : { ground: '#000000', text: '#ffffff', muted: '#8f8f8f', uaBlue: '#0057b7', uaYellow: '#ffd700' },
    night    : { ground: '#141414', text: '#f3e2b6', muted: '#a8a092', uaBlue: '#0057b7', uaYellow: '#ffd700' },
}
const PAL = { ...THEMES.guidance }

// ── Scale ─────────────────────────────────────────────────────────────────────
const KM        = 0.01                 // world units per km · 1 unit = 100 km
const L         = TOTAL_KM * KM        // 25.92 · the datum
const DAY_W     = L / DAYS.length      // one day's column on the time axis
const CSS       = 0.01                 // world units per CSS px on label planes
const MARGIN_L  = 2.5                  // left column for section titles
const MARGIN_R  = 0.7
const SHEET_GAP = 0.45                 // between strata on the flat sheet
const RISE      = 1.6                  // route plane grows up and down in space
const DROP      = 1.7                  //   mode, to hold the map
const KEY_W     = 13                   // key sheet width (1300 CSS px)
const CAM_DIST  = 150
const FRAME     = { w: 720, h: 900 }   // the 4:5 stage, laid out at a fixed size so every export composes alike
const EXPORT_SIZES = { 1080: [1080, 1350], 1440: [1440, 1800], 2160: [2160, 2700] }
const TIERS     = { long: 2.3, mid: 1.7, short: 1.1 }
const LEAN      = Math.PI / 3          // leaders lean at 60° from the datum
const BAR_KM    = 0.0075               // segment bars: 100 km = 0.75 units
const LAT_BASE  = 49.5                 // latitude plane: 1° = 0.8 units
const LAT_UNIT  = 0.8

// ── Space axis ────────────────────────────────────────────────────────────────
// Equirectangular at 51°N, drawn at the same 1 unit = 100 km as the datum and
// centred under it.
const LAT0  = 51.2
const COS0  = Math.cos(51 * Math.PI / 180)
const projX = lon => (lon - WAYPOINTS[0].lon) * 111.32 * COS0 * KM
const projY = lat => (lat - LAT0) * 110.57 * KM
const MAP_X = (L - projX(WAYPOINTS.at(-1).lon)) / 2
const WP    = WAYPOINTS.map(w => ({ ...w, px: MAP_X + projX(w.lon), py: projY(w.lat) }))

// ── Strata · one plane per layer of the sheet ─────────────────────────────────
// top / bottom are local to each plane's baseline (the datum is y = 0).
const STRATA = [
    { title: '01 · маршрут',  sub: 'route · the datum, its waypoints and crossings', top: 6.3,  bottom: -1.95 },
    { title: '02 · азимут',   sub: 'bearing · heading of each leg',                  top: 1.45, bottom: -0.6  },
    { title: '03 · перегін',  sub: 'segment length · km between waypoints',          top: 2.9,  bottom: -0.25 },
    { title: '04 · широта',   sub: 'latitude · the wobble of the line',              top: 2.75, bottom: -0.6  },
    { title: '05 · кадри',    sub: 'frames · the photographic record',               top: 0.95, bottom: -0.6  },
    { title: '06 · депеші',   sub: "dispatches · the day's reported war",            top: 0.5,  bottom: -1.6  },
]
const SHEET_Y = STRATA.reduce((y, s, i) => {
    y.push(i === 0 ? 0 : y[i - 1] + STRATA[i - 1].bottom - SHEET_GAP - s.top)
    return y
}, [])

const AXES = {
    distance : { D: 1, T: 0, S: 0 },
    time     : { D: 0, T: 1, S: 0 },
    space    : { D: 0, T: 0, S: 1 },
}
const LAYOUTS = {
    sheet  : { sheet: 1, key: 0, strata: 0, days: 0 },
    key    : { sheet: 0, key: 1, strata: 0, days: 0 },
    strata : { sheet: 0, key: 0, strata: 1, days: 0 },
    days   : { sheet: 0, key: 0, strata: 0, days: 1 },
}
const LAYOUT_VIEW = { sheet: 'front', key: 'isometric', strata: 'oblique', days: 'oblique' }
const VIEW_DIR = {
    front     : new THREE.Vector3(0, 0, 1),
    oblique   : new THREE.Vector3(-0.42, 0.3, 1).normalize(),
    isometric : new THREE.Vector3(-1, 1, 1).normalize(),   // the 30° axes
}
const TOUR = [
    { axis: 'distance', planes: 'sheet',  view: 'front'     },
    { axis: 'distance', planes: 'strata', view: 'oblique'   },
    { axis: 'time',     planes: 'strata', view: 'oblique'   },
    { axis: 'time',     planes: 'days',   view: 'isometric' },
    { axis: 'space',    planes: 'sheet',  view: 'front'     },
    { axis: 'distance', planes: 'key',    view: 'isometric' },
]

// ── Route maths ───────────────────────────────────────────────────────────────
// Day boundaries fall on waypoints, so every axis is piecewise linear between
// waypoints and the travelled km maps exactly onto all three.
const clampKm  = k => Math.min(TOTAL_KM, Math.max(0, k))
const dayOf    = km => {
    for (let d = 0; d < DAYS.length; d++) if (km <= DAYS[d].to) return d
    return DAYS.length - 1
}
const wpIndex  = km => {
    for (let i = 1; i < WP.length; i++) if (km <= WP[i].km) return i - 1
    return WP.length - 2
}
const lerpWp   = (km, key) => {
    const i = wpIndex(km), a = WP[i], b = WP[i + 1]
    return a[key] + (b[key] - a[key]) * (km - a.km) / (b.km - a.km)
}
const timeOf   = km => {
    const d = dayOf(km), D = DAYS[d]
    return d + (km - D.from) / (D.to - D.from)
}
const kmOfTime = t => {
    const d = Math.min(DAYS.length - 1, Math.max(0, Math.floor(t)))
    const D = DAYS[d]
    return D.from + Math.min(1, Math.max(0, t - d)) * (D.to - D.from)
}
const kmAtLon  = lon => {
    for (let i = 0; i < WP.length - 1; i++) {
        const a = WP[i], b = WP[i + 1]
        if (lon >= a.lon && lon <= b.lon) return a.km + (b.km - a.km) * (lon - a.lon) / (b.lon - a.lon)
    }
    return lon < WP[0].lon ? 0 : TOTAL_KM
}
const anchorOf = k => {
    const km = clampKm(k)
    return { xD: km * KM, xT: timeOf(km) * DAY_W, xS: lerpWp(km, 'px'), yS: lerpWp(km, 'py') }
}
const haversine = (a, b) => {
    const r = Math.PI / 180
    const h = Math.sin((b.lat - a.lat) * r / 2) ** 2
            + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2
    return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// ── Formatting · Ukrainian decimal comma, spaced thousands ─────────────────────
const nf0     = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const nf2     = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtKm   = n => nf0.format(Math.round(n))
const fmtLat  = v => `${nf2.format(Math.abs(v))}° ${v >= 0 ? 'пн. ш.' : 'пд. ш.'}`
const fmtLon  = v => `${nf2.format(Math.abs(v))}° ${v >= 0 ? 'сх. д.' : 'зх. д.'}`

// ── Vertex spec ───────────────────────────────────────────────────────────────
// Every mark is anchored at a km on the route, then offset (dx, dy) in its
// plane. xD / xT / xS are that km on each axis; the frame blends them.
//   fy  — follows the route's latitude in space mode
//   dyS — extra dy applied in space mode
//   ax  — absolute x on every axis (longitude ticks)
//   t   — km at which the mark counts as travelled (−1: always lit)
function vtx(k, dx = 0, dy = 0, s = 0, o = {}) {
    const a = anchorOf(k)
    return {
        fy  : !!o.fy,
        xD  : o.ax ?? a.xD,
        xT  : o.ax ?? a.xT,
        xS  : o.ax ?? a.xS,
        yS  : o.fy ? a.yS : 0,
        dx, dy,
        dyS : o.dyS || 0,
        s,
        d   : o.d ?? dayOf(clampKm(k)),
        t   : o.t ?? -1,
    }
}

function reanchor(v, k) {
    const a = anchorOf(k)
    v.xD = a.xD; v.xT = a.xT; v.xS = a.xS
    v.yS = v.fy ? a.yS : 0
    v.d  = dayOf(clampKm(k))
}

// ── Strokes · one LineSegments2 per line style ────────────────────────────────
class Strokes {
    constructor(key, opacity = 1, fade = null, weight = 1) {
        this.key     = key
        this.color   = new THREE.Color(PAL[key])
        this.opacity = opacity
        this.fade    = fade
        this.weight  = weight            // the reticle runs heavier than the hairlines
        this.v       = []
        this.dynamic = false
    }

    retheme() { this.color.set(PAL[this.key]) }

    seg(a, b) { this.v.push(a, b) }

    build() {
        const n = this.v.length
        this.pos = new Float32Array(n * 3)
        this.col = new Float32Array(n * 3)
        this.geometry = new LineSegmentsGeometry()
        this.geometry.setPositions(this.pos)
        this.geometry.setColors(this.col)
        this.material = new LineMaterial({
            vertexColors : true,
            linewidth    : 1,
            transparent  : true,
            depthTest    : false,
            depthWrite   : false,
        })
        this.mesh = new LineSegments2(this.geometry, this.material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder   = 1
        return this.mesh
    }

    update(app, moved, recolour) {
        const p = app.params
        if (moved || this.dynamic) {
            const t = app._tmp
            for (let i = 0; i < this.v.length; i++) {
                app._place(this.v[i], t)
                this.pos[i * 3] = t.x; this.pos[i * 3 + 1] = t.y; this.pos[i * 3 + 2] = t.z
            }
            this.geometry.attributes.instanceStart.data.needsUpdate = true
        }
        if (recolour || this.dynamic) {
            // untravelled marks darken toward the ground
            const { r, g, b } = this.color
            for (let i = 0; i < this.v.length; i++) {
                const t   = this.v[i].t
                const lit = t < 0 || t <= p.travelled + 0.01 ? 1 : p.untravelled
                this.col[i * 3] = r * lit; this.col[i * 3 + 1] = g * lit; this.col[i * 3 + 2] = b * lit
            }
            this.geometry.attributes.instanceColorStart.data.needsUpdate = true
        }
        const op = this.opacity * p.lineOpacity * (this.fade ? this.fade() : 1)
        this.material.opacity   = op
        this.material.linewidth = p.lineWidth * this.weight
        this.mesh.visible       = p.showLines && op > 0.003 && (!this.detail || p.details)
    }
}

// ── Nodes · waypoint dots and rings, drawn as screen-facing points ─────────────
const nodeVertex = /* glsl */`
    attribute float aRadius;
    attribute float aKind;
    attribute vec3  aColor;
    attribute vec3  aFill;
    attribute float aLit;

    uniform float uPx;
    uniform float uDpr;

    varying float vR;
    varying float vSize;
    varying float vKind;
    varying vec3  vColor;
    varying vec3  vFill;
    varying float vLit;

    void main() {
        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vR           = aRadius * uPx * uDpr;
        vSize        = 2.0 * (vR + 2.0 * uDpr);
        gl_PointSize = vSize;
        vKind = aKind; vColor = aColor; vFill = aFill; vLit = aLit;
    }
`

const nodeFragment = /* glsl */`
    uniform float uOpacity;
    uniform float uDpr;

    varying float vR;
    varying float vSize;
    varying float vKind;
    varying vec3  vColor;
    varying vec3  vFill;
    varying float vLit;

    // equilateral triangle, centred, after Quilez
    float sdTriangle(vec2 p, float r) {
        const float k = 1.7320508;
        p.x = abs(p.x) - r;
        p.y = p.y + r / k;
        if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
        p.x -= clamp(p.x, -2.0 * r, 0.0);
        return -length(p) * sign(p.y);
    }

    void main() {
        float d    = length(gl_PointCoord - 0.5) * vSize;
        float fill = 1.0 - smoothstep(vR - 0.6 * uDpr, vR + 0.6 * uDpr, d);
        float ring = 1.0 - smoothstep(0.5 * uDpr, 1.4 * uDpr, abs(d - vR));

        // 0: filled dot · 1: 1px ring · 2: filled disc with a 1px ring
        // 3: target, a ring around a dot · 4: solid triangle, apex up
        vec3  col = vColor;
        float a   = fill;
        if (vKind > 0.5 && vKind < 1.5) { a = ring; }
        if (vKind > 1.5 && vKind < 2.5) { col = mix(vFill, vColor, ring); a = max(fill, ring); }
        if (vKind > 2.5 && vKind < 3.5) {
            float dot = 1.0 - smoothstep(vR * 0.42 - 0.6 * uDpr, vR * 0.42 + 0.6 * uDpr, d);
            a = max(ring, dot);
        }
        if (vKind > 3.5) {
            vec2 q = (gl_PointCoord - 0.5) * vSize;
            q.y = -q.y;
            a = 1.0 - smoothstep(-0.6 * uDpr, 0.6 * uDpr, sdTriangle(q, vR * 0.86));
        }

        a *= uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col * vLit, a);
        #include <colorspace_fragment>
    }
`

class Nodes {
    constructor() { this.items = []; this.dynamic = false }

    add(v, r, kind, color = 'text', fill = 'ground') {
        this.items.push({ v, r, kind, key: color, fillKey: fill, color: new THREE.Color(PAL[color]), fill: new THREE.Color(PAL[fill]) })
    }

    retheme() {
        const col = this.geometry.attributes.aColor, fill = this.geometry.attributes.aFill
        this.items.forEach((it, i) => {
            it.color.set(PAL[it.key]).toArray(col.array, i * 3)
            it.fill.set(PAL[it.fillKey]).toArray(fill.array, i * 3)
        })
        col.needsUpdate = fill.needsUpdate = true
    }

    build() {
        const n   = this.items.length
        this.pos  = new Float32Array(n * 3)
        this.lit  = new Float32Array(n).fill(1)
        const rad = new Float32Array(n), kind = new Float32Array(n)
        const col = new Float32Array(n * 3), fill = new Float32Array(n * 3)
        this.items.forEach((it, i) => {
            rad[i] = it.r; kind[i] = it.kind
            it.color.toArray(col, i * 3); it.fill.toArray(fill, i * 3)
        })
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
        g.setAttribute('aRadius',  new THREE.BufferAttribute(rad, 1))
        g.setAttribute('aKind',    new THREE.BufferAttribute(kind, 1))
        g.setAttribute('aColor',   new THREE.BufferAttribute(col, 3))
        g.setAttribute('aFill',    new THREE.BufferAttribute(fill, 3))
        g.setAttribute('aLit',     new THREE.BufferAttribute(this.lit, 1))
        this.geometry = g
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uPx      : { value: 30 },
                uDpr     : { value: 1 },
                uOpacity : { value: 1 },
            },
            vertexShader   : nodeVertex,
            fragmentShader : nodeFragment,
            transparent    : true,
            depthTest      : false,
            depthWrite     : false,
        })
        this.mesh = new THREE.Points(g, this.material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder   = 3
        return this.mesh
    }

    update(app, moved, recolour) {
        const p = app.params
        if (moved || this.dynamic) {
            const t = app._tmp
            this.items.forEach((it, i) => {
                app._place(it.v, t)
                this.pos[i * 3] = t.x; this.pos[i * 3 + 1] = t.y; this.pos[i * 3 + 2] = t.z
            })
            this.geometry.attributes.position.needsUpdate = true
        }
        if (recolour) {
            this.items.forEach((it, i) => {
                this.lit[i] = it.v.t < 0 || it.v.t <= p.travelled + 0.01 ? 1 : p.untravelled
            })
            this.geometry.attributes.aLit.needsUpdate = true
        }
        const u = this.material.uniforms
        u.uPx.value      = app.camera.zoom
        u.uDpr.value     = app.renderer.getPixelRatio()
        u.uOpacity.value = p.lineOpacity
        this.mesh.visible = p.showLines
    }
}

// ── Particles · the travelled filament (after the reference) ───────────────────
const ROUTE_NODES = []
DAYS.forEach((D, d) => WP.forEach(w => { if (w.km >= D.from && w.km <= D.to) ROUTE_NODES.push({ km: w.km, d }) }))

const particleVertex = /* glsl */`
    #define NODES ${ROUTE_NODES.length}

    uniform vec3  uNodePos[NODES];
    uniform float uNodeKm[NODES];
    uniform float uNodeDay[NODES];
    uniform float uDayEnd[${DAYS.length}];
    uniform float uTravelled;
    uniform float uTime;
    uniform float uSpread;
    uniform float uSwirl;
    uniform float uFlow;
    uniform float uBias;
    uniform float uSize;
    uniform float uDpr;
    uniform float uAlphaHead;
    uniform float uAlphaTail;
    uniform float uFade;
    uniform float uScatter;

    attribute vec4 aSeed;
    varying float vAlpha;

    float dayAt(float km) {
        float d = 0.0;
        for (int j = 0; j < ${DAYS.length - 1}; j++) { if (km > uDayEnd[j]) d += 1.0; }
        return d;
    }

    // route position at km, from the per-frame waypoint nodes of each day
    vec3 routeAt(float km) {
        float day = dayAt(km);
        vec3  p   = uNodePos[0];
        for (int i = 0; i < NODES - 1; i++) {
            if (uNodeDay[i] == day && uNodeDay[i + 1] == day && km >= uNodeKm[i] && km <= uNodeKm[i + 1]) {
                p = mix(uNodePos[i], uNodePos[i + 1], (km - uNodeKm[i]) / max(uNodeKm[i + 1] - uNodeKm[i], 1e-4));
            }
        }
        return p;
    }

    void main() {
        // each particle runs from Bristol to the head and wraps
        float ph = fract(aSeed.x + uTime * uFlow * (0.55 + 0.9 * aSeed.y));
        float km = uTravelled * (1.0 - pow(1.0 - ph, uBias));
        vec3  b  = routeAt(km);

        float burst = 1.0 + uScatter * (1.5 + 4.0 * aSeed.w);
        float r     = uSpread * (0.06 + pow(aSeed.z, 2.2)) * burst;
        float a     = aSeed.w * 6.2831853 + uTime * uSwirl * (0.35 + aSeed.y);
        vec3  off   = vec3((aSeed.y - 0.5) * 0.15 * uSpread * burst, cos(a) * r, sin(a) * r);

        gl_Position  = projectionMatrix * modelViewMatrix * vec4(b + off, 1.0);
        gl_PointSize = uSize * uDpr * (0.55 + aSeed.y * 0.9);

        vAlpha  = mix(uAlphaHead, uAlphaTail, smoothstep(0.0, uFade, uTravelled - km));
        vAlpha *= smoothstep(0.0, 0.03, ph) * (1.0 - smoothstep(0.97, 1.0, ph));
        vAlpha *= step(0.5, uTravelled);
        // keep density per km steady: only a share of particles runs early on
        vAlpha *= step(fract(aSeed.x * 7.13 + aSeed.z * 3.71), max(0.06, uTravelled / ${TOTAL_KM}.0));
    }
`

const particleFragment = /* glsl */`
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = vAlpha * (1.0 - smoothstep(0.15, 0.5, d));
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
    }
`

// ── Key sheet (лист 2) ────────────────────────────────────────────────────────
// Glyphs are drawn from the sheet's own marks; stroke follows currentColor.
const GLYPHS = [
    ['origin',      'початок · start of a leg',      '<circle cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="3.5" fill="currentColor" stroke="none"/>'],
    ['waypoint',    'точка · a point on the route, Т', '<path d="M2 20 H38"/><circle cx="20" cy="20" r="4" fill="currentColor" stroke="none"/>'],
    ['destination', 'Київ · Т19',                     `<circle cx="20" cy="20" r="16" stroke="${PAL.uaYellow}"/><circle cx="20" cy="20" r="7" fill="${PAL.uaBlue}" stroke="${PAL.uaYellow}"/>`],
    ['border',      'перехід · a crossing, М',         '<path d="M2 20 H16 M24 20 H38 M11 8 H16 V32 H11 M29 8 H24 V32 H29"/>'],
    ['ferry',       'пором · the sea crossing М1',     '<path d="M2 20 H38" stroke-dasharray="6 5"/>'],
    ['bearing',     'азимут · a leg heading',          '<circle cx="20" cy="20" r="15" stroke-width="0.5"/><path d="M20 5 V1 M15 17 L33 27.5"/><circle cx="20" cy="20" r="2" fill="currentColor" stroke="none"/>'],
    ['frame',       'кадр · a photograph, Ф',          '<rect x="3" y="7" width="34" height="26"/><path d="M8 12 L32 28" stroke-width="0.5"/>'],
    ['leader',      'виноска · leader, −60°',          '<path d="M8 36 L28 1.4" stroke-width="0.75" stroke-dasharray="1.5 1.25"/><circle cx="8" cy="36" r="2.5" fill="currentColor" stroke="none"/>'],
]

function keyMarkup() {
    const days = DAYS.map((D, i) => `
        <tr data-day="${i}"><th scope="row"><span class="mf">${D.n}</span></th><td>${D.date} ${D.short}</td><td>${D.leg}</td><td class="n">${D.to - D.from}</td><td>${D.span}</td></tr>`).join('')
    const legs = LEGS.map((g, i) => `
        <tr data-leg="${i}"><th scope="row">${g.code}</th><td>${g.from} → ${g.to}</td><td>${g.dir.replace(/ /g, '')} ${g.deg}°</td><td class="n">${g.end - g.start}</td></tr>`).join('')
    const wpRow = (w, i) => `
        <tr data-wp="${i}"${w.local ? ' class="ua"' : ''}><th scope="row">${w.code}</th><td>${w.name}${w.local ? ' · ' + w.local : ''}</td><td>${nf2.format(w.lat)}°</td><td class="n">${w.km}</td></tr>`
    const wpHead = '<thead><tr><th>код</th><th>назва</th><th>широта</th><th class="n">км</th></tr></thead>'
    const crossings = CROSSINGS.map((c, i) => `
        <tr data-cross="${i}"${c.border ? ' class="ua"' : ''}><th scope="row">${c.code}</th><td>${c.long}</td></tr>`).join('')
    const glyphs = GLYPHS.map(([name, sub, svg]) => `
        <li><svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">${svg}</svg><span>${name}<small>${sub}</small></span></li>`).join('')

    return `
    <p class="k-run">тисяча · case evac · winter 2024</p>
    <div class="k-head">
        <h2>ключ · key</h2>
        <p class="k-sheet">лист 2 · листів 2<br><b>1000·С002</b></p>
    </div>
    <p class="k-lede">реєстри, позначення та лінії · registers, designation and line weights for 1000·С002</p>

    <section class="k-sec">
        <h3>01 · позначення · designation</h3>
        <div class="k-cols">
            <div>
                <p class="k-code">1000·Е4·Т19·Ф001</p>
                <p class="k-note">у назвах файлів · in filenames: 1000_E4_T19_F001_kyiv-mykhailivska.jpg</p>
            </div>
            <dl class="k-parts">
                <dt>1000</dt><dd>проєкт · the journey and its thousandth day</dd>
                <dt>Е4</dt><dd>етап · leg, Е1 to Е4</dd>
                <dt>Т19</dt><dd>точка · waypoint, Т01 to Т19</dd>
                <dt>Ф001</dt><dd>кадр · frame. Д dispatch, С drawing, М crossing</dd>
            </dl>
        </div>
    </section>

    <div class="k-cols">
        <section class="k-sec">
            <h3>02 · дні · days</h3>
            <table><thead><tr><th>день</th><th>дата</th><th>етап</th><th class="n">км</th><th>точки</th></tr></thead><tbody>${days}</tbody></table>
        </section>
        <section class="k-sec">
            <h3>03 · етапи · legs</h3>
            <table><thead><tr><th>етап</th><th>від → до</th><th>азимут</th><th class="n">км</th></tr></thead><tbody>${legs}</tbody></table>
            <p class="k-note">Headings are taken from the hand-drawn route sheet, not recomputed.</p>
        </section>
    </div>

    <section class="k-sec">
        <h3>04 · точки · waypoints</h3>
        <div class="k-cols">
            <table>${wpHead}<tbody>${WP.slice(0, 10).map((w, i) => wpRow(w, i)).join('')}</tbody></table>
            <table>${wpHead}<tbody>${WP.slice(10).map((w, i) => wpRow(w, i + 10)).join('')}</tbody></table>
        </div>
    </section>

    <div class="k-cols">
        <section class="k-sec">
            <h3>05 · переходи · crossings</h3>
            <table><tbody>${crossings}</tbody></table>
        </section>
        <section class="k-sec">
            <h3>06 · лінії · line weights</h3>
            <ul class="k-weights">
                <li><svg viewBox="0 0 240 8" width="240" height="8" aria-hidden="true"><path d="M0 4 H240" stroke="currentColor" stroke-width="1"/></svg><span>1 px · route, borders</span></li>
                <li><svg viewBox="0 0 240 8" width="240" height="8" aria-hidden="true"><path d="M0 4 H240" stroke="currentColor" stroke-width="0.5"/></svg><span>0,5 px · rules, cells</span></li>
                <li><svg viewBox="0 0 240 8" width="240" height="8" aria-hidden="true"><path d="M0 4 H240" stroke="currentColor" stroke-width="0.75" stroke-dasharray="1.5 1.25"/></svg><span>0,75 px dashed · leaders, ferry</span></li>
            </ul>
            <p class="k-note">Leaders and their labels lean at −60°. Planes sit on a 30° isometric grid.</p>
        </section>
    </div>

    <section class="k-sec">
        <h3>07 · знаки · marks</h3>
        <ul class="k-marks">${glyphs}</ul>
    </section>

    <section class="k-sec">
        <h3>08 · застереження · provisional</h3>
        <div class="k-cols">
            <p class="k-note">Four legs are drawn across five days, so one leg is cut by a night. Е4 is split at Lviv, Т15, which puts the crossing at М5 on day 1002 and the arrival at Т19 on day 1003. This binding is a reading of the route sheet, not a record.</p>
            <p class="k-note">Distances are great-circle between waypoints and run short of road distance. Times are not yet logged: the time axis gives each day an equal column and assumes an even pace within it. The space axis places each waypoint at its town's coordinates.</p>
        </div>
    </section>

    <table class="k-stamp">
        <tr><td><span>назва · title</span>anatomy of distance travelled</td><td><span>позначення</span>1000·С002</td><td><span>аркуш</span>лист 2 · листів 2</td></tr>
        <tr><td><span>проєкт</span>тисяча · 1000 · case evac</td><td><span>дата</span>18–22.11.2024</td><td><span>масштаб</span>1 одиниця = 100 км</td></tr>
        <tr><td><span>маршрут</span>Bristol → Kyiv · Бристоль → Київ</td><td><span>довжина</span>2 592 км</td><td><span>точок · переходів · етапів</span>19 · 5 · 4</td></tr>
        <tr><td><span>на користь · in aid of</span>Driving Ukraine</td><td><span>склав · drawn by</span><em>[DRAWN BY]</em></td><td><span>видання</span>winter 2024</td></tr>
    </table>`
}

// ─────────────────────────────────────────────────────────────────────────────
export class DistanceTravelled {
    constructor(canvas) {
        this.canvas  = canvas
        this.clock   = new THREE.Clock()
        this.time    = 0
        this.hold    = 0
        this.tourAt  = 0
        this.mobile  = window.innerWidth < 760
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        this._tmp    = new THREE.Vector3()
        this.strokes = []
        this.labels  = []
        this.keyH    = 22

        // Mutable params (shared with GUI)
        this.params = {
            axis        : 'distance',
            planes      : 'sheet',
            view        : 'front',
            play        : true,
            speed       : 140,          // km per second
            pace        : 'distance',
            travelled   : 0,
            loop        : true,
            tour        : true,
            spacing     : 3.2,
            morph       : 1.6,
            autoRotate  : false,
            rotateSpeed : 0.6,
            // readout
            distance    : '',
            time        : '',
            space       : '',
            // lines
            showLines   : true,
            lineOpacity : 1,
            lineWidth   : 1,
            untravelled : 0.3,
            planeFill   : 0.03,
            showLabels  : true,
            labelSize   : 1,
            showKey     : true,
            // particles
            showParticles : true,
            count         : this.mobile ? 9000 : 25000,
            size          : 1.05,
            spread        : 0.237,
            swirl         : 1.502,
            flow          : 0.067,
            bias          : 1.3,
            alphaHead     : 0.28,
            alphaTail     : 0.21,
            fade          : 1219,
            blend         : 'add',
            colour        : '#fde3a2',
            // art direction
            theme         : 'guidance',
            grain         : 0.025,
            backdrop      : 0.12,
            details       : true,
            // export · 4:5
            frame         : false,
            exportSize    : '1080',
            fps           : 30,
            clip          : 'journey',
            restart       : true,
            camMove       : false,
            ease          : 'sine.inOut',
            exportStatus  : 'frame 4:5, compose, then record',
        }
        if (this.reduced) Object.assign(this.params, { play: false, travelled: TOTAL_KM, tour: false })

        this.w        = { ...AXES.distance }
        this.targetW  = { ...AXES.distance }
        this.lw       = { ...LAYOUTS.sheet }
        this.targetLW = { ...LAYOUTS.sheet }
        this.offsets  = STRATA.map(() => DAYS.map(() => new THREE.Vector3()))
        this.$stage   = document.querySelector('.stage')
        this.$tag     = document.querySelector('.frame-tag')
        this.view     = { w: window.innerWidth, h: window.innerHeight, s: 1 }
        this.themeVersion = 0
        this.keyVersion   = 0
        this.hudDirty     = true

        this._initRenderer()
        this._initCamera()
        this._initScene()
        this._initControls()
        this._buildMarks()
        this._buildFills()
        this._buildKey()
        this._buildParticles()
        this._initGUI()
        this._initHUD()
        this.guidance = new Guidance(this)
        this.exporter = new Exporter(this)
        this._layout()
        this._initResize()
        this._initKeys()

        // the HUD's height bounds the fit, so fill it before the first frame
        this._updateReadout()
        this._applyState(this.params.tour ? TOUR[0] : this.params, true)
        document.fonts?.ready.then(() => {
            this.keyMeasured = false
            if (!this._userMoved) this._fit(true)
        })
        this._loop()
    }

    // ── Renderer ──────────────────────────────────────────────────────────────
    // WebGL draws the line work and particles; a CSS3D layer on top carries the
    // type, so labels set in JetBrains Mono / PT Mono stay crisp at any zoom.
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(this.view.w, this.view.h)
        this.renderer.setClearColor(0x000000, 0)    // the page ground and backdrop show through

        this.cssRenderer = new CSS3DRenderer({ element: document.querySelector('.css3d') })
        this.cssRenderer.setSize(this.view.w, this.view.h)
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    // Orthographic, frustum in CSS px: camera.zoom is px per world unit.
    _initCamera() {
        const { w, h } = this.view
        this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 1000)
        this.camera.position.set(L / 2, 0, CAM_DIST)
        this.camera.zoom = 30
        this.camera.updateProjectionMatrix()
    }

    _initScene() {
        this.scene      = new THREE.Scene()
        this.cssScene   = new THREE.Scene()
        this.labelLayer = new THREE.Group()
        this.cssScene.add(this.labelLayer)
    }

    _initControls() {
        const c = this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        c.enableDamping      = true
        c.dampingFactor      = 0.08
        c.screenSpacePanning = true
        c.minZoom            = 3
        c.maxZoom            = 800
        c.target.set(L / 2, 0, 0)
        c.addEventListener('start', () => { this._camTween?.kill(); this._userMoved = true })
    }

    // ── Placement ─────────────────────────────────────────────────────────────
    // Blend the three axes, then lift the vertex onto its plane.
    _place(v, out, w = this.w, offsets = this.offsets) {
        const o = offsets[v.s][v.d]
        return out.set(
            w.D * v.xD + w.T * v.xT + w.S * v.xS + v.dx + o.x,
            w.S * (v.yS + v.dyS) + v.dy + o.y,
            o.z,
        )
    }

    // Plane offsets per (stratum, day):
    //   sheet / graphic + key — strata stacked down the sheet
    //   strata                — each stratum on its own plane, back in z
    //   days                  — each day's slice of the sheet, back in z
    _computeOffsets(w, lw, gap, out) {
        const flat = lw.sheet + lw.key + lw.days
        STRATA.forEach((_, s) => {
            const sy = SHEET_Y[s] - (s > 0 ? DROP * w.S : 0)
            DAYS.forEach((__, d) => {
                out[s][d].set(0, flat * sy, -(lw.strata * s + lw.days * d) * gap)
            })
        })
    }

    // The key hinges at the route's far end: flat beside the sheet, or turned
    // 90° toward the viewer as a second projection plane.
    _keyFrame(w, lw) {
        const end = w.D * L + w.T * L + w.S * WP.at(-1).px
        return {
            pos   : new THREE.Vector3(end + MARGIN_R + 0.8, STRATA[0].top + RISE * w.S, 0),
            angle : -Math.PI / 2 * (1 - lw.sheet),
        }
    }

    // ── Marks ─────────────────────────────────────────────────────────────────
    _buildMarks() {
        const S = this.S = {
            cells     : new Strokes('text', 0.16),
            slabs     : new Strokes('text', 0.16, () => this.lw.days),
            route     : new Strokes('text', 1),
            ferry     : new Strokes('text', 0.9),
            border    : new Strokes('uaYellow', 1),
            leaders   : new Strokes('text', 0.7),
            marks     : new Strokes('text', 0.9),
            thin      : new Strokes('text', 0.55),
            grid      : new Strokes('text', 0.3),
            rulerD    : new Strokes('text', 0.85, () => this.w.D),
            rulerT    : new Strokes('text', 0.85, () => this.w.T),
            rulerS    : new Strokes('text', 0.85, () => this.w.S),
            graticule : new Strokes('text', 0.16, () => this.w.S),
            playhead  : new Strokes('text', 0.75),
            reticle   : new Strokes('text', 0.95, null, 2.2),
            guide     : new Strokes('text', 0.4),
        }
        const N = this.nodes = new Nodes()
        const fadeD = () => this.w.D, fadeT = () => this.w.T, fadeS = () => this.w.S

        // A run along the route from k0 to k1, cut at day boundaries and
        // subdivided so the travelled edge stays sharp on every axis.
        const run = (st, k0, k1, s, o = {}) => {
            const { dy = 0, dyAt = null, fy = false, dyS = 0, travel = true, dx0 = 0, dx1 = 0, step = 8 } = o
            const cuts = [k0, ...DAYS.map(D => D.to).filter(k => k > k0 && k < k1), k1]
            for (let c = 0; c < cuts.length - 1; c++) {
                const a = cuts[c], b = cuts[c + 1], d = dayOf((a + b) / 2)
                const n = Math.max(1, Math.ceil((b - a) / step))
                for (let i = 0; i < n; i++) {
                    const ka = a + (b - a) * i / n, kb = a + (b - a) * (i + 1) / n
                    st.seg(
                        vtx(ka, c === 0 && i === 0 ? dx0 : 0, dyAt ? dyAt(ka) : dy, s, { fy, dyS, d, t: travel ? ka : -1 }),
                        vtx(kb, c === cuts.length - 2 && i === n - 1 ? dx1 : 0, dyAt ? dyAt(kb) : dy, s, { fy, dyS, d, t: travel ? kb : -1 }),
                    )
                }
            }
        }
        const dashRun = (st, k0, k1, s, o = {}) => {
            const { dash = 5, gap = 7 } = o
            for (let k = k0; k < k1; k += dash + gap) run(st, k, Math.min(k + dash, k1), s, { ...o, step: dash })
        }
        // straight line in a plane, anchored at one km
        const line = (st, k, s, x0, y0, x1, y1, o = {}) => st.seg(vtx(k, x0, y0, s, o), vtx(k, x1, y1, s, o))
        const dashed = (st, k, s, x0, y0, x1, y1, o = {}, dash = 0.05, gap = 0.042) => {
            const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len
            for (let a = 0; a < len; a += dash + gap) {
                const b = Math.min(a + dash, len)
                line(st, k, s, x0 + ux * a, y0 + uy * a, x0 + ux * b, y0 + uy * b, o)
            }
        }
        const circle = (st, k, s, cx, cy, r, o = {}, n = 48) => {
            for (let i = 0; i < n; i++) {
                const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2
                line(st, k, s, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, o)
            }
        }
        const label = (html, k, dx, dy, s, o = {}, opts = {}) => this._label(html, vtx(k, dx, dy, s, o), opts)

        // ── Cells · one per (stratum, day) ──
        // On the flat sheet their shared edges become the day columns.
        this.cells = STRATA.map((st, s) => DAYS.map((D, d) => {
            const xl = d === 0 ? -MARGIN_L : 0, xr = d === DAYS.length - 1 ? MARGIN_R : 0
            const top = { d, dyS: s === 0 ? RISE : 0 }, bot = { d, dyS: s === 0 ? -DROP : 0 }
            const c = [vtx(D.from, xl, st.bottom, s, bot), vtx(D.to, xr, st.bottom, s, bot),
                       vtx(D.to, xr, st.top, s, top),      vtx(D.from, xl, st.top, s, top)]
            S.cells.seg(c[0], c[1]); S.cells.seg(c[2], c[3]); S.cells.seg(c[1], c[2])
            ;(d === 0 ? S.cells : S.slabs).seg(c[3], c[0])
            return c
        }))
        STRATA.forEach((st, s) => {
            label(`<div class="lbl-sec">${st.title}</div><div class="lbl-sm">${st.sub}</div>`,
                0, -MARGIN_L + 0.15, st.top - 0.15, s, { d: 0, dyS: s === 0 ? RISE : 0 }, { width: 220 })
        })

        // ── 01 · route ──
        const GAP = 0.09
        const solid = [323, ...CROSSINGS.filter(c => !c.ferry).map(c => c.km), TOTAL_KM]
        run(S.route, 0, 280, 0, { fy: true })
        dashRun(S.ferry, 280, 323, 0, { fy: true, dash: 6, gap: 5 })
        for (let i = 0; i < solid.length - 1; i++) {
            run(S.route, solid[i], solid[i + 1], 0, { fy: true, dx0: i > 0 ? GAP : 0, dx1: i < solid.length - 2 ? -GAP : 0 })
        }
        CROSSINGS.filter(c => !c.ferry).forEach(c => {
            const st = c.border ? S.border : S.route, h = c.border ? 0.17 : 0.15, o = { fy: true, t: c.km }
            line(st, c.km, 0, -GAP - 0.06, h, -GAP, h, o);   line(st, c.km, 0, -GAP, h, -GAP, -h, o)
            line(st, c.km, 0, -GAP, -h, -GAP - 0.06, -h, o); line(st, c.km, 0, GAP + 0.06, h, GAP, h, o)
            line(st, c.km, 0, GAP, h, GAP, -h, o);           line(st, c.km, 0, GAP, -h, GAP + 0.06, -h, o)
        })
        CROSSINGS.forEach(c => {
            label(`<b${c.border ? ' class="ua"' : ''}>${c.code}</b><br><span class="m">${c.label}</span>`,
                c.km, 0, -0.25, 0, { fy: true, t: c.km }, { anchor: 'tc', cls: 'lbl-cross' })
        })
        WP.forEach((w, i) => {
            const o = { fy: true, t: w.km }
            if (i === 0) {
                N.add(vtx(w.km, 0, 0, 0, o), 0.13, 2)
                N.add(vtx(w.km, 0, 0, 0, o), 0.05, 0)
            } else if (i === WP.length - 1) {
                N.add(vtx(w.km, 0, 0, 0, o), 0.27, 1, 'uaYellow')
                N.add(vtx(w.km, 0, 0, 0, o), 0.12, 2, 'uaYellow', 'uaBlue')
            } else {
                N.add(vtx(w.km, 0, 0, 0, o), 0.085, 3)      // target, as the reference marks its codes
            }
            const h = TIERS[w.tier], lx = h / Math.tan(LEAN)
            dashed(S.leaders, w.km, 0, 0, i === 0 ? 0.14 : 0, lx, h, o)
            const name = w.local ? `<span class="ua">${w.name} · ${w.local}</span>` : w.name
            label(`${name} <span class="m">${w.code}</span>`, w.km,
                lx + 0.06 * Math.cos(LEAN), h + 0.06 * Math.sin(LEAN), 0, o,
                { anchor: 'ml', cls: 'lbl-wp', rot: LEAN })
        })
        DAYS.forEach((D, d) => {
            label(`<div class="lbl-day">день <span class="mf">${D.n}</span></div><div class="lbl-sm">${D.date} · ${D.dow}</div><div class="lbl-sm">${D.to - D.from} км · ${D.note}</div>`,
                D.from, 0.14, 6.05, 0, { d, dyS: RISE, t: D.from })
        })

        // ── rulers · one per axis, cross-faded ──
        const RY = -1.0, ro = { dyS: -DROP }
        run(S.rulerD, 0, TOTAL_KM, 0, { dy: RY, dyS: -DROP, travel: false })
        for (let k = 0; k <= 2500; k += 250) {
            line(S.rulerD, k, 0, 0, RY, 0, RY + (k === 0 ? 0.12 : 0.07), ro)
            label(String(k), k, 0, RY - 0.08, 0, ro, { anchor: 'tc', cls: 'lbl-ruler', fade: fadeD })
        }
        line(S.rulerD, TOTAL_KM, 0, 0, RY, 0, RY + 0.12, ro)
        label('2592', TOTAL_KM, 0, RY - 0.34, 0, ro, { anchor: 'tr', cls: 'lbl-ruler', fade: fadeD })
        label('відстань від Бристоля · distance from Bristol, km · great-circle between waypoints',
            0, 0, RY - 0.4, 0, ro, { cls: 'lbl-cap', fade: fadeD })

        run(S.rulerT, 0, TOTAL_KM, 0, { dy: RY, dyS: -DROP, travel: false })
        DAYS.forEach((D, d) => {
            line(S.rulerT, D.from, 0, 0, RY, 0, RY + 0.14, { ...ro, d })
            for (let q = 1; q < 4; q++) {
                const k = kmOfTime(d + q / 4)
                line(S.rulerT, k, 0, 0, RY, 0, RY + (q === 2 ? 0.08 : 0.05), { ...ro, d })
            }
            label(`день <span class="mf">${D.n}</span> · ${D.date.slice(0, 5)}`, kmOfTime(d + 0.5), 0, RY - 0.08, 0, { ...ro, d },
                { anchor: 'tc', cls: 'lbl-ruler', fade: fadeT })
        })
        line(S.rulerT, TOTAL_KM, 0, 0, RY, 0, RY + 0.14, ro)
        label('час · time, days on the road · each day an equal column, pace within a day assumed even (times not yet logged)',
            0, 0, RY - 0.4, 0, ro, { cls: 'lbl-cap', fade: fadeT })

        run(S.rulerS, 0, TOTAL_KM, 0, { dy: RY, dyS: -DROP, travel: false })
        for (let lon = 0; lon <= 30; lon += 5) {
            const x = MAP_X + projX(lon), k = kmAtLon(lon), d = dayOf(k)
            line(S.rulerS, k, 0, 0, RY, 0, RY + 0.1, { ...ro, ax: x, d })
            label(lon === 0 ? '0°' : `${lon}°${lon === 30 ? ' сх. д.' : ''}`, k, 0, RY - 0.08, 0, { ...ro, ax: x, d },
                { anchor: 'tc', cls: 'lbl-ruler', fade: fadeS })
            line(S.graticule, k, 0, 0, projY(49.6), 0, projY(52.7), { ax: x, d })
        }
        label('простір · space, longitude east of Greenwich · the route drawn to scale on its towns',
            0, 0, RY - 0.4, 0, ro, { cls: 'lbl-cap', fade: fadeS })
        ;[50, 51, 52].forEach(lat => {
            run(S.graticule, 0, TOTAL_KM, 0, { dy: projY(lat), travel: false, step: 40 })
            line(S.rulerS, 0, 0, -0.22, projY(lat), -0.1, projY(lat))
            label(`${lat}° пн. ш.`, 0, -0.3, projY(lat), 0, {}, { anchor: 'mr', cls: 'lbl-ruler', fade: fadeS })
        })

        // ── 02 · bearing ──
        LEGS.forEach(g => {
            const o = { t: g.start }, cx = 0.5, cy = 0.72, r = 0.3
            run(S.marks, g.start, g.end, 1, { dx0: 0.06, dx1: -0.06 })
            line(S.marks, g.start, 1, 0.06, -0.07, 0.06, 0.07, o)
            line(S.marks, g.end, 1, -0.06, -0.07, -0.06, 0.07, { t: g.end, d: dayOf(g.end) })
            circle(S.thin, g.start, 1, cx, cy, r, o)
            line(S.marks, g.start, 1, cx, cy + r, cx, cy + r + 0.09, o)
            const a = g.deg * Math.PI / 180, ux = Math.sin(a), uy = Math.cos(a)
            line(S.marks, g.start, 1, cx - ux * r * 0.33, cy - uy * r * 0.33, cx + ux * r * 0.87, cy + uy * r * 0.87, o)
            N.add(vtx(g.start, cx, cy, 1, o), 0.028, 0)
            N.add(vtx(g.start, cx + ux * r, cy + uy * r, 1, o), 0.05, 3)
            for (let q = 0; q < 4; q++) {
                N.add(vtx(g.start, cx + Math.sin(q * Math.PI / 2) * r, cy + Math.cos(q * Math.PI / 2) * r, 1, o), 0.018, 0)
            }
            label(`<div class="lbl-dir">${g.dir}</div><div class="lbl-deg">${g.deg}°</div>`,
                g.start, cx + r + 0.15, cy + 0.42, 1, o)
            const note = g.code === 'Е4' ? ' · split at Т15 across days 1002 / 1003' : ''
            label(`${g.code} · ${g.end - g.start} км<br>${g.from} → ${g.to}${note}`,
                g.start, 0.06, -0.12, 1, o, { cls: 'lbl-sm' })
        })

        // ── 03 · segment length ──
        run(S.thin, 0, TOTAL_KM, 2, { travel: false, step: 40 })
        ;[100, 200, 300].forEach(km => {
            dashRun(S.grid, 0, TOTAL_KM, 2, { dy: km * BAR_KM, travel: false })
            label(String(km), 0, -0.12, km * BAR_KM, 2, {}, { anchor: 'mr', cls: 'lbl-ruler' })
        })
        WP.forEach((w, i) => {
            if (i === 0) return
            const h = (w.km - WP[i - 1].km) * BAR_KM, o = { t: w.km }
            line(S.marks, w.km, 2, 0, 0, 0, h, o)
            N.add(vtx(w.km, 0, h, 2, o), 0.03, 0)
        })
        label('найдовший перегін · longest run<br>POZNAŃ → KRAKÓW · 335 км', 1792, 0.12, 335 * BAR_KM, 2, { t: 1792 }, { cls: 'lbl-sm' })
        label('найкоротший · shortest<br>KÖLN → DÜSSELDORF · 35 км', 725, 0.1, 0.36 + 35 * BAR_KM, 2, { t: 725 }, { anchor: 'bl', cls: 'lbl-sm' })

        // ── 04 · latitude ──
        const latY = km => (lerpWp(km, 'lat') - LAT_BASE) * LAT_UNIT
        ;[50, 51, 52].forEach(lat => {
            dashRun(S.grid, 0, TOTAL_KM, 3, { dy: (lat - LAT_BASE) * LAT_UNIT, travel: false })
            label(lat === 52 ? '52° пн. ш.' : `${lat}°`, 0, -0.12, (lat - LAT_BASE) * LAT_UNIT, 3, {}, { anchor: 'mr', cls: 'lbl-ruler' })
        })
        run(S.marks, 0, TOTAL_KM, 3, { dyAt: latY })
        WP.forEach(w => N.add(vtx(w.km, 0, latY(w.km), 3, { t: w.km }), 0.035, 0))
        label('найпівнічніша точка · northernmost<br>BERLIN Т12 · 52,52° пн. ш.', 1218, 0.12, latY(1218) + 0.12, 3, { t: 1218 }, { anchor: 'bl', cls: 'lbl-sm' })
        label('найпівденніша · southernmost<br>LVIV Т15 · 49,84° пн. ш.', 2085, 0.1, latY(2085) - 0.1, 3, { t: 2085 }, { cls: 'lbl-sm' })

        // ── 05 · frames ──
        run(S.marks, 0, TOTAL_KM, 4, {})
        WP.forEach(w => line(S.thin, w.km, 4, 0, 0, 0, 0.09, { t: w.km }))
        FRAMES.forEach(f => {
            const o = { t: f.km }, x0 = f.alignRight ? -0.34 : -0.17, x1 = x0 + 0.34, cx = (x0 + x1) / 2
            line(S.marks, f.km, 4, x0, 0.42, x1, 0.42, o); line(S.marks, f.km, 4, x1, 0.42, x1, 0.68, o)
            line(S.marks, f.km, 4, x1, 0.68, x0, 0.68, o); line(S.marks, f.km, 4, x0, 0.68, x0, 0.42, o)
            line(S.thin, f.km, 4, x0 + 0.05, 0.63, x1 - 0.05, 0.47, o)
            line(S.marks, f.km, 4, cx, 0.42, cx, 0.1, o)
            label(`${f.code}<br><span class="m">${f.slug}</span>`, f.km, f.alignRight ? x0 - 0.1 : x1 + 0.1, 0.68, 4, o,
                { anchor: f.alignRight ? 'tr' : 'tl', cls: 'lbl-code' })
        })
        label('реєстр відкритий · register open — 2 кадри закодовано · [REMAINING FRAMES TO BE LOGGED AGAINST Т01–Т18]',
            0, 0, -0.16, 4, {}, { cls: 'lbl-sm' })

        // ── 06 · dispatches ──
        DAYS.forEach((D, d) => {
            label(`<div class="lbl-disp-h">день <span class="mf">${D.n}</span><br>${D.date}</div><div class="lbl-src">[SOURCE]</div><div class="lbl-disp">[QUOTED REPORT FOR ${d === 1 ? 'THE THOUSANDTH DAY' : d === 4 ? 'THE DAY OF ARRIVAL AT Т19' : 'THIS DAY'}]</div>`,
                D.from, 0.14, 0.35, 5, { d, t: D.from }, { width: 250 })
        })

        // ── Playhead · a cut through every plane at the travelled km ──
        this.head = []
        STRATA.forEach((st, s) => {
            const top = vtx(0, 0, st.top, s, { dyS: s === 0 ? RISE : 0 })
            const bot = vtx(0, 0, st.bottom, s, { dyS: s === 0 ? -DROP : 0 })
            S.playhead.seg(top, bot)
            this.head.push(top, bot)
            if (s < STRATA.length - 1) {
                const next = vtx(0, 0, STRATA[s + 1].top, s + 1)
                S.playhead.seg(bot, next)
                this.head.push(next)
            }
        })
        S.playhead.dynamic = true

        // ── Vehicle · a triangle inside a broken reticle, with guide lines ahead ──
        const V = this.vehicle = new Nodes()
        V.dynamic = true
        this.vehicleV = vtx(0, 0, 0, 0, { fy: true })
        V.add(this.vehicleV, 0.19, 4)

        this.reticle = []
        ;[[0, 150], [196, 334]].forEach(([a0, a1]) => {
            const n = Math.round((a1 - a0) / 6)
            for (let i = 0; i < n; i++) {
                const a = { k: 0, a: a0 + (a1 - a0) * i / n }, b = { k: 0, a: a0 + (a1 - a0) * (i + 1) / n }
                const va = vtx(0, 0, 0, 0, { fy: true }), vb = vtx(0, 0, 0, 0, { fy: true })
                va.deg = a.a; vb.deg = b.a
                S.reticle.seg(va, vb)
                this.reticle.push(va, vb)
            }
        })
        S.reticle.dynamic = S.reticle.detail = true

        this.guideV = [vtx(0, 0, 0, 0, { fy: true }), vtx(0, 0, 0, 0, { fy: true }),
                       vtx(0, 0, 0, 0, { fy: true }), vtx(TOTAL_KM, 0, 0, 0, { fy: true })]
        S.guide.seg(this.guideV[0], this.guideV[1])
        S.guide.seg(this.guideV[2], this.guideV[3])
        S.guide.dynamic = S.guide.detail = true

        // day boundaries of the route plane, for the backdrop's columns
        this.columnV = [...DAYS.map((D, d) => ({ v: vtx(D.from, 0, 0, 0, { d }), pre: `${D.leg} · `, num: String(D.n) })),
                        { v: vtx(TOTAL_KM, 0, 0, 0), pre: 'Т19', num: '' }]
        this.headLabel = this._label('', vtx(0, 0, STRATA[0].top + 0.1, 0, { dyS: RISE }), { anchor: 'bc', cls: 'lbl-head' })
        this.headLabel.dyn = true

        Object.values(S).forEach(st => {
            if (!st.v.length) return
            this.scene.add(st.build())
            this.strokes.push(st)
        })
        this.scene.add(N.build())
        this.scene.add(V.build())
    }

    _label(html, v, { anchor = 'tl', cls = '', rot = 0, fade = null, width = 0 } = {}) {
        const root = document.createElement('div')
        root.className = 'dt-a'
        const el = document.createElement('div')
        el.className = `dt-l dt-${anchor}${cls ? ' ' + cls : ''}`
        if (width) { el.style.width = width + 'px'; el.style.whiteSpace = 'normal' }
        el.innerHTML = html
        root.appendChild(el)
        const obj = new CSS3DObject(root)
        root.style.pointerEvents = 'none'
        obj.rotation.z = rot
        obj.scale.setScalar(CSS)
        this.labelLayer.add(obj)
        const item = { obj, root, el, v, fade, op: -1, dyn: false }
        this.labels.push(item)
        return item
    }

    // ── Plane fills · a faint ground under every cell ─────────────────────────
    _buildFills() {
        const n = STRATA.length * DAYS.length
        this.fillPos = new Float32Array(n * 12)
        const index = []
        for (let i = 0; i < n; i++) index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(this.fillPos, 3))
        g.setIndex(index)
        this.fills = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
            color       : PAL.text,
            transparent : true,
            opacity     : this.params.planeFill,
            depthTest   : false,
            depthWrite  : false,
            side        : THREE.DoubleSide,
        }))
        this.fills.frustumCulled = false
        this.fills.renderOrder   = 0
        this.scene.add(this.fills)
    }

    _updateFills() {
        let i = 0
        for (const row of this.cells) for (const cell of row) for (const v of cell) {
            this._place(v, this._tmp)
            this.fillPos[i++] = this._tmp.x; this.fillPos[i++] = this._tmp.y; this.fillPos[i++] = this._tmp.z
        }
        this.fills.geometry.attributes.position.needsUpdate = true
    }

    // ── Key · лист 2 as a CSS3D sheet ─────────────────────────────────────────
    _buildKey() {
        const el = this.keyEl = document.createElement('div')
        el.className = 'key'
        el.innerHTML = keyMarkup()
        this.keyObj = new CSS3DObject(el)
        el.style.pointerEvents = 'none'
        this.keyObj.scale.setScalar(CSS)
        this.keyHinge = new THREE.Group()
        this.keyHinge.add(this.keyObj)
        this.cssScene.add(this.keyHinge)
        this.keyRows = {
            day   : [...el.querySelectorAll('[data-day]')],
            leg   : [...el.querySelectorAll('[data-leg]')],
            wp    : [...el.querySelectorAll('[data-wp]')],
            cross : [...el.querySelectorAll('[data-cross]')],
        }
        this.keyState = {}
    }

    _updateKey() {
        if (!this.keyMeasured && this.keyEl.offsetHeight) {
            this.keyH = this.keyEl.offsetHeight * CSS
            this.keyMeasured = true
        }
        const kf = this._keyFrame(this.w, this.lw)
        this.keyHinge.position.copy(kf.pos)
        this.keyHinge.rotation.y = kf.angle
        this.keyObj.position.set(KEY_W / 2, -this.keyH / 2, 0)
        this.keyObj.visible = this.params.showKey && this.params.showLabels
    }

    // live registers: done, now, still to come
    _markKey(kind, now, doneUpTo) {
        if (this.keyState[kind] === `${now}:${doneUpTo}`) return
        this.keyState[kind] = `${now}:${doneUpTo}`
        this.keyVersion++
        this.keyRows[kind].forEach((row, i) => {
            row.classList.toggle('is-now',  i === now)
            row.classList.toggle('is-next', i > doneUpTo && i !== now)
        })
    }

    // ── Particles ─────────────────────────────────────────────────────────────
    _buildParticles() {
        const p = this.params
        this.particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uNodePos   : { value: ROUTE_NODES.map(() => new THREE.Vector3()) },
                uNodeKm    : { value: ROUTE_NODES.map(n => n.km) },
                uNodeDay   : { value: ROUTE_NODES.map(n => n.d) },
                uDayEnd    : { value: DAYS.map(D => D.to) },
                uTravelled : { value: 0 },
                uTime      : { value: 0 },
                uSpread    : { value: p.spread },
                uSwirl     : { value: p.swirl },
                uFlow      : { value: p.flow },
                uBias      : { value: p.bias },
                uSize      : { value: p.size },
                uDpr       : { value: this.renderer.getPixelRatio() },
                uAlphaHead : { value: p.alphaHead },
                uAlphaTail : { value: p.alphaTail },
                uFade      : { value: p.fade },
                uScatter   : { value: 0 },
                uColor     : { value: new THREE.Color(p.colour) },
            },
            vertexShader   : particleVertex,
            fragmentShader : particleFragment,
            transparent    : true,
            depthTest      : false,
            depthWrite     : false,
            blending       : THREE.AdditiveBlending,
        })
        this.routeNodes = ROUTE_NODES.map(n => vtx(n.km, 0, 0, 0, { fy: true, d: n.d }))
        this.particles  = new THREE.Points(new THREE.BufferGeometry(), this.particleMaterial)
        this.particles.frustumCulled = false
        this.particles.renderOrder   = 2
        this._seedParticles()
        this.scene.add(this.particles)
    }

    _seedParticles() {
        const n = Math.round(this.params.count), seed = new Float32Array(n * 4)
        for (let i = 0; i < seed.length; i++) seed[i] = Math.random()
        const g = new THREE.BufferGeometry()
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
        // position is unused (the shader places every particle) but keeps the draw count
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
        this.particles.geometry.dispose()
        this.particles.geometry = g
    }

    _updateParticles(moved) {
        const p = this.params, u = this.particleMaterial.uniforms
        if (moved) this.routeNodes.forEach((v, i) => this._place(v, u.uNodePos.value[i]))
        u.uTravelled.value = p.travelled
        u.uTime.value      = this.time
        u.uSpread.value    = p.spread
        u.uSwirl.value     = p.swirl
        u.uFlow.value      = p.flow
        u.uBias.value      = p.bias
        u.uSize.value      = p.size
        u.uAlphaHead.value = p.alphaHead
        u.uAlphaTail.value = p.alphaTail
        u.uFade.value      = p.fade
        this.particles.visible = p.showParticles
    }

    // ── Axis, planes, view ────────────────────────────────────────────────────
    _morphTime() { return this.reduced ? 0.01 : this.params.morph }

    _setAxis(axis) {
        this.targetW = { ...AXES[axis] }
        gsap.to(this.w, { ...this.targetW, duration: this._morphTime(), ease: 'power2.inOut', overwrite: true })
    }

    _setPlanes(planes) {
        this.targetLW = { ...LAYOUTS[planes] }
        gsap.to(this.lw, { ...this.targetLW, duration: this._morphTime(), ease: 'power2.inOut', overwrite: true })
    }

    _applyState({ axis, planes, view }, instant = false) {
        const p = this.params
        p.axis = axis; p.planes = planes; p.view = view
        if (instant) {
            Object.assign(this.w, AXES[axis]);      this.targetW  = { ...AXES[axis] }
            Object.assign(this.lw, LAYOUTS[planes]); this.targetLW = { ...LAYOUTS[planes] }
        } else {
            this._setAxis(axis)
            this._setPlanes(planes)
        }
        this._fit(instant)
        this._syncGUI()
    }

    _nextTour() {
        this.tourAt = (this.tourAt + 1) % TOUR.length
        this._applyState(TOUR[this.tourAt])
    }

    _stopTour() { this.params.tour = false }

    _viewDir(view, lw) {
        if (view !== 'key') return VIEW_DIR[view].clone()
        const a = this._keyFrame(this.targetW, lw).angle
        return new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
    }

    // Fit the target state inside the part of the screen the overlays leave free.
    _fit(instant = false) {
        const p = this.params, view = p.view, w = this.targetW, lw = this.targetLW
        const offsets = STRATA.map(() => DAYS.map(() => new THREE.Vector3()))
        this._computeOffsets(w, lw, p.spacing, offsets)

        const pts = []
        if (view !== 'key') {
            for (const row of this.cells) for (const cell of row) for (const v of cell) {
                pts.push(this._place(v, new THREE.Vector3(), w, offsets))
            }
        }
        if (view === 'key' || (lw.key > 0.5 && p.showKey)) {
            const kf = this._keyFrame(w, lw), c = Math.cos(kf.angle), s = Math.sin(kf.angle)
            for (const lx of [0, KEY_W]) for (const ly of [0, -this.keyH]) {
                pts.push(new THREE.Vector3(kf.pos.x + lx * c, kf.pos.y + ly, kf.pos.z - lx * s))
            }
        }

        const z = this._viewDir(view, lw)
        const x = new THREE.Vector3(0, 1, 0).cross(z).normalize()
        const y = new THREE.Vector3().crossVectors(z, x)
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zs = 0
        for (const q of pts) {
            const px = q.dot(x), py = q.dot(y)
            x0 = Math.min(x0, px); x1 = Math.max(x1, px)
            y0 = Math.min(y0, py); y1 = Math.max(y1, py)
            zs += q.dot(z)
        }
        const r = this._safeRect(), W = this.view.w, H = this.view.h
        const zoom = Math.max(2, Math.min((r.r - r.l) / (x1 - x0), (r.b - r.t) / (y1 - y0)))
        const cx = (x0 + x1) / 2 - ((r.l + r.r) / 2 - W / 2) / zoom
        const cy = (y0 + y1) / 2 - (H / 2 - (r.t + r.b) / 2) / zoom
        const target = x.clone().multiplyScalar(cx).addScaledVector(y, cy).addScaledVector(z, zs / pts.length)
        this._tweenCamera(z, target, zoom, instant)
    }

    _safeRect() {
        const { w: W, h: H } = this.view
        const top    = this._local(this.$title).bottom + 16
        const bottom = this._local(this.$hud).top - 16
        const guiW   = !this.params.frame && !this.gui._closed && W >= 760 ? this.gui.domElement.offsetWidth + 32 : 16
        const r = { l: 16, r: W - guiW, t: top, b: bottom }
        if (r.b - r.t < 160) { r.t = 16; r.b = H - 16 }
        return r
    }

    // an element's box in stage px (the framed stage is scaled to fit the window)
    _local(el) {
        const r = el.getBoundingClientRect(), st = this.$stage.getBoundingClientRect(), s = this.view.s
        return { left: (r.left - st.left) / s, top: (r.top - st.top) / s, right: (r.right - st.left) / s, bottom: (r.bottom - st.top) / s }
    }

    // ── Stage · full window, or a fixed 4:5 frame scaled to fit beside the GUI ─
    _layout() {
        const p = this.params
        let w = window.innerWidth, h = window.innerHeight, s = 1, left = 0, top = 0
        if (p.frame) {
            ({ w, h } = FRAME)
            const guiW = this.gui._closed ? 16 : this.gui.domElement.offsetWidth + 32
            const aw = Math.max(200, window.innerWidth - guiW - 40), ah = Math.max(250, window.innerHeight - 76)
            s = Math.min(aw / w, ah / h)
            left = 24 + (aw - w * s) / 2
            top = 24 + (ah - h * s) / 2
        }
        document.body.classList.toggle('framed', p.frame)
        this.$stage.classList.toggle('framed', p.frame)
        Object.assign(this.$stage.style, p.frame
            ? { width: `${w}px`, height: `${h}px`, left: `${left}px`, top: `${top}px`, transform: `scale(${s})` }
            : { width: '', height: '', left: '', top: '', transform: '' })
        this.$tag.hidden = !p.frame
        if (p.frame) {
            const [W, H] = this.exportSize
            this.$tag.textContent = `4:5 · ${W} × ${H} · ${this.exporter.rec ? 'recording' : 'export frame'}`
            Object.assign(this.$tag.style, { left: `${left}px`, top: `${top + h * s + 8}px` })
        }
        this.view = { w, h, s }

        // in the frame, the drawing buffer is the export size itself
        const ratio = p.frame ? this.exportSize[0] / w : Math.min(window.devicePixelRatio, 2)
        this.renderer.setPixelRatio(ratio)
        this.renderer.setSize(w, h)
        this.cssRenderer.setSize(w, h)
        Object.assign(this.camera, { left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2 })
        this.camera.updateProjectionMatrix()
        this.controls.panSpeed = this.controls.rotateSpeed = 1 / s
        this.particleMaterial.uniforms.uDpr.value = ratio
        this.guidance.resize()
        this.exporter.invalidate()
        this.hudDirty = true
    }

    get exportSize() { return EXPORT_SIZES[this.params.exportSize] }
    get totalKm() { return TOTAL_KM }

    setFrame(on) {
        this.params.frame = on
        this._layout()
        this._fit(true)
        this._syncGUI()
    }

    status(text) { this.params.exportStatus = text }

    restartJourney() {
        this.params.travelled = 0
        this.params.play = true
        this.hold = 0
    }

    journeySeconds() { return TOTAL_KM / this.params.speed + 1.2 }

    onRecordStart() {
        this.ctl.record.name('■ stop recording')
        this.ctl.frame.disable(); this.ctl.size.disable()
        this._layout()
    }

    onRecordStop() {
        this.ctl.record.name('● record clip')
        this.ctl.frame.enable(); this.ctl.size.enable()
        this._moveTween?.kill()
        this.controls.enabled = true
        this._layout()
    }

    // ── Camera · state, blend, keyframed move ─────────────────────────────────
    _camState() {
        return {
            dir    : this.camera.position.clone().sub(this.controls.target).normalize(),
            target : this.controls.target.clone(),
            zoom   : this.camera.zoom,
        }
    }

    _lerpCam(a, b, t) {
        const cam = this.camera, ctl = this.controls
        const d = a.dir.clone().lerp(b.dir, t).normalize()
        ctl.target.lerpVectors(a.target, b.target, t)
        cam.position.copy(ctl.target).addScaledVector(d, CAM_DIST)
        cam.zoom = Math.exp(THREE.MathUtils.lerp(Math.log(a.zoom), Math.log(b.zoom), t))
        cam.lookAt(ctl.target)
        cam.updateProjectionMatrix()
    }

    playMove(seconds) {
        if (!this.camStart || !this.camEnd) { this.status('set a start and an end view first'); return }
        this._camTween?.kill()
        this._moveTween?.kill()
        this.controls.enabled = false
        this._lerpCam(this.camStart, this.camEnd, 0)
        const proxy = { t: 0 }
        this._moveTween = gsap.to(proxy, {
            t: 1, duration: seconds, ease: this.params.ease,
            onUpdate   : () => this._lerpCam(this.camStart, this.camEnd, proxy.t),
            onComplete : () => { if (!this.exporter.rec) this.controls.enabled = true },
        })
    }

    _tweenCamera(dir, target, zoom, instant) {
        const from = this._camState(), to = { dir, target, zoom }
        const apply = t => this._lerpCam(from, to, t)
        this._camTween?.kill()
        if (instant) { apply(1); return }
        const proxy = { t: 0 }
        this._camTween = gsap.to(proxy, {
            t: 1, duration: this._morphTime(), ease: 'power2.inOut',
            onUpdate: () => apply(proxy.t),
        })
    }

    // ── GUI ───────────────────────────────────────────────────────────────────
    // After the reference: one flat "Controls" list, then folders.
    _initGUI() {
        const gui = this.gui = new GUI({ title: 'Controls', width: 320 })
        const p   = this.params

        gui.add(p, 'axis', { 'distance · км': 'distance', 'time · дні': 'time', 'space · lon/lat': 'space' })
            .name('axis').onChange(v => { this._stopTour(); this._setAxis(v); this._fit() })
        gui.add(p, 'planes', { '1 plane · sheet': 'sheet', '2 planes · graphic + key': 'key', '6 planes · strata': 'strata', '5 planes · days': 'days' })
            .name('planes').onChange(v => {
                this._stopTour()
                p.view = LAYOUT_VIEW[v]
                this._setPlanes(v); this._fit(); this._syncGUI()
            })
        gui.add(p, 'view', { front: 'front', oblique: 'oblique', isometric: 'isometric', 'key (face on)': 'key' })
            .name('view').onChange(() => { this._stopTour(); this._fit() })
        gui.add(p, 'play').name('play').listen()
        gui.add(p, 'speed', 10, 1000, 1).name('speed (km/s)')
        gui.add(p, 'pace', { 'distance · even km/s': 'distance', 'time · even days': 'time' }).name('pace')
        gui.add(p, 'travelled', 0, TOTAL_KM, 1).name('travelled (km)').listen()
            .onChange(() => { this.hold = 0 })
        gui.add(p, 'loop').name('loop')
        gui.add(p, 'tour').name('tour (cycle axes)').listen()
        gui.add(p, 'spacing', 0.5, 8, 0.01).name('spacing (plane gap)').onFinishChange(() => this._fit())
        gui.add(p, 'morph', 0.2, 4, 0.05).name('morph (s)')
        gui.add(p, 'autoRotate').name('autoRotate')
        gui.add(p, 'rotateSpeed', -4, 4, 0.01).name('rotateSpeed')

        const read = gui.addFolder('travelled · readout')
        read.add(p, 'distance').name('distance').disable().listen()
        read.add(p, 'time').name('time').disable().listen()
        read.add(p, 'space').name('space').disable().listen()

        const art = gui.addFolder('art direction')
        art.add(p, 'theme', { 'guidance · black / white': 'guidance', '1000 · night': 'night' }).name('theme')
            .onChange(v => this._applyTheme(v))
        art.add(p, 'grain', 0, 0.35, 0.005).name('grain')
        art.add(p, 'backdrop', 0, 0.5, 0.005).name('backdrop (guidance)')
        art.add(p, 'details').name('details (reticle, marks)')

        const lines = gui.addFolder('lines')
        lines.add(p, 'showLines').name('showLines')
        lines.add(p, 'lineOpacity', 0, 1, 0.01).name('lineOpacity')
        lines.add(p, 'lineWidth', 0.5, 4, 0.1).name('lineWidth')
        lines.add(p, 'untravelled', 0, 1, 0.01).name('untravelled').onChange(() => { this._recolour = true })
        lines.add(p, 'planeFill', 0, 0.2, 0.005).name('planeFill')
        lines.add(p, 'showLabels').name('showLabels')
        lines.add(p, 'labelSize', 0.6, 2, 0.05).name('labelSize')
            .onChange(v => this.labels.forEach(l => l.obj.scale.setScalar(CSS * v)))
        lines.add(p, 'showKey').name('showKey').onChange(() => this._fit())

        const parts = gui.addFolder('particles')
        parts.add(p, 'showParticles').name('showParticles')
        parts.add(p, 'count', 0, 120000, 1000).name('count').onFinishChange(() => this._seedParticles())
        parts.add(p, 'size', 0.5, 6, 0.01).name('size')
        parts.add(p, 'spread', 0, 1.5, 0.001).name('spread (radius)')
        parts.add(p, 'swirl', 0, 6, 0.001).name('swirl')
        parts.add(p, 'flow', 0, 0.4, 0.001).name('flow')
        parts.add(p, 'bias', 1, 4, 0.01).name('bias (toward head)')
        parts.add(p, 'alphaHead', 0, 1, 0.01).name('alphaHead (near)')
        parts.add(p, 'alphaTail', 0, 1, 0.01).name('alphaTail (far)')
        parts.add(p, 'fade', 50, TOTAL_KM, 1).name('fade (km behind)')
        parts.add(p, 'blend', { add: 'add', normal: 'normal' }).name('blend').onChange(v => {
            this.particleMaterial.blending    = v === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending
            this.particleMaterial.needsUpdate = true
        })
        parts.addColor(p, 'colour').name('colour').onChange(v => this.particleMaterial.uniforms.uColor.value.set(v))
        parts.close()

        const actions = {
            replay    : () => { p.travelled = 0; p.play = true; this.hold = 0 },
            scatter   : () => gsap.fromTo(this.particleMaterial.uniforms.uScatter, { value: 1.4 }, { value: 0, duration: 2.6, ease: 'power3.out' }),
            randomize : () => {
                const rnd = (a, b) => a + Math.random() * (b - a)
                Object.assign(p, {
                    spread: rnd(0.08, 0.9), swirl: rnd(0, 4), flow: rnd(0.01, 0.2), bias: rnd(1, 3.2),
                    size: rnd(1.2, 4), alphaHead: rnd(0.4, 1), alphaTail: rnd(0, 0.3), fade: rnd(200, TOTAL_KM),
                })
                this._syncGUI()
            },
        }
        const ex = gui.addFolder('export · 4:5 instagram')
        const shot = {
            setStart    : () => { this.camStart = this._camState(); this.status('start view set'); if (this.camEnd) p.camMove = true },
            setEnd      : () => { this.camEnd = this._camState(); this.status('end view set'); if (this.camStart) p.camMove = true },
            previewMove : () => this.playMove(p.clip === 'journey' ? this.journeySeconds() : Number(p.clip)),
            record      : () => {
                if (!p.frame) this.setFrame(true)
                requestAnimationFrame(() => requestAnimationFrame(() => this.exporter.record()))
            },
            still       : () => {
                if (!p.frame) this.setFrame(true)
                requestAnimationFrame(() => this.exporter.saveStill())
            },
        }
        this.ctl = {}
        this.ctl.frame = ex.add(p, 'frame').name('frame 4:5').onChange(v => this.setFrame(v))
        this.ctl.size  = ex.add(p, 'exportSize', { '1080 × 1350 · feed': '1080', '1440 × 1800': '1440', '2160 × 2700': '2160' })
            .name('size').onChange(() => { if (p.frame) this._layout() })
        ex.add(p, 'fps', { '30 fps': 30, '60 fps': 60 }).name('fps')
        ex.add(p, 'clip', { 'one journey': 'journey', '5 s': '5', '10 s': '10', '15 s': '15', '30 s': '30', '60 s': '60' }).name('length')
        ex.add(p, 'restart').name('restart journey on record')
        ex.add(shot, 'setStart').name('set start view')
        ex.add(shot, 'setEnd').name('set end view')
        ex.add(p, 'camMove').name('camera move').listen()
        ex.add(p, 'ease', { 'sine in-out': 'sine.inOut', 'power2 in-out': 'power2.inOut', linear: 'none' }).name('ease')
        ex.add(shot, 'previewMove').name('preview move')
        this.ctl.record = ex.add(shot, 'record').name('● record clip')
        ex.add(shot, 'still').name('save still (PNG)')
        ex.add(p, 'exportStatus').name('status').disable().listen()

        gui.add(actions, 'replay').name('replay')
        gui.add(actions, 'scatter').name('scatter')
        gui.add(actions, 'randomize').name('randomize')

        this._guiClosed = this.mobile
        if (this.mobile) gui.close()
        gui.onOpenClose(() => {
            if (gui._closed !== this._guiClosed) {
                this._guiClosed = gui._closed
                if (this.params.frame) this._layout()
                this._fit()
            }
        })
    }

    _syncGUI() {
        this.gui?.controllersRecursive().forEach(c => c.updateDisplay())
    }

    // ── HUD · distance, time and space travelled ──────────────────────────────
    _initHUD() {
        this.$title = document.querySelector('.dt-title')
        this.$hud   = document.querySelector('.hud')
        this.$r     = {}
        document.querySelectorAll('[data-r]').forEach(el => { this.$r[el.dataset.r] = el })
        this._hudText = {}

        // the bottom component grows with its text; keep the GUI clear of it
        const hudH = () => document.documentElement.style.setProperty('--hud-h', `${this.$hud.offsetHeight}px`)
        new ResizeObserver(hudH).observe(this.$hud)
        hudH()
    }

    // ── Art direction ─────────────────────────────────────────────────────────
    get palette() { return PAL }

    _applyTheme(name) {
        const was = PAL.text
        Object.assign(PAL, THEMES[name])
        const root = document.documentElement.style
        root.setProperty('--ground', PAL.ground)
        root.setProperty('--text', PAL.text)
        root.setProperty('--muted', PAL.muted)
        this.strokes.forEach(st => st.retheme())
        this.nodes.retheme()
        this.vehicle.retheme()
        this.fills.material.color.set(PAL.text)
        if (this.params.colour === was) {
            this.params.colour = PAL.text
            this.particleMaterial.uniforms.uColor.value.set(PAL.text)
        }
        this._recolour = true
        this.themeVersion++
        this.exporter.invalidate()
        this._syncGUI()
    }

    // screen x of each day boundary on the route plane
    _columns() {
        const W = this.view.w
        return this.columnV.map(c => {
            this._place(c.v, this._tmp).project(this.camera)
            return { x: (this._tmp.x + 1) / 2 * W, pre: c.pre, num: c.num }
        })
    }

    _edgeValues() {
        const km = this.params.travelled, g = LEGS.find(l => km <= l.end)
        return [fmtKm(km), fmtKm(TOTAL_KM - km), String(DAYS[dayOf(km)].n), `${g.deg}°`]
    }

    _set(key, text) {
        if (this._hudText[key] === text) return
        this._hudText[key] = text
        if (this.$r[key]) this.$r[key].textContent = text
        this.hudDirty = true
    }

    _updateReadout() {
        const p = this.params, km = p.travelled
        const d = dayOf(km), D = DAYS[d], t = timeOf(km)
        const i = Math.min(WP.length - 1, WP.filter(w => w.km <= km + 0.01).length - 1)
        const w = WP[i], next = WP[i + 1]
        const lat = lerpWp(km, 'lat'), lon = lerpWp(km, 'lon')
        const crow = haversine(WP[0], { lat, lon })
        const legI = LEGS.findIndex(g => km <= g.end), g = LEGS[legI]
        const crossed = CROSSINGS.filter(c => km >= (c.ferry ? c.to : c.km))
        const ahead   = CROSSINGS.find(c => km < (c.ferry ? c.to : c.km))
        const pct     = Math.round(km / TOTAL_KM * 100)
        const dayPct  = Math.round((km - D.from) / (D.to - D.from) * 100)

        this._set('km', fmtKm(km))
        this._set('kmSub', `з ${fmtKm(TOTAL_KM)} · ${pct}% of the route`)
        this._set('day', String(D.n))
        this._set('daySub', `${D.date} · ${D.dow} · ${dayPct}% of the day · ${nf2.format(t)} / ${DAYS.length}`)
        this._set('pos', `${fmtLat(lat)} · ${fmtLon(lon)}`)
        this._set('posSub', `${fmtKm(crow)} км від Бристоля по прямій · straight line`)
        this._set('leg', g.code)
        this._set('legSub', `${g.from} → ${g.to} · ${g.dir} ${g.deg}°`)
        this._set('wp', `${w.code} ${w.name}`)
        this._set('wpSub', next ? `next ${next.code} ${next.name} · ${fmtKm(next.km - km)} км` : 'прибуття · arrived')
        this._set('cross', crossed.length ? crossed.at(-1).code : '—')
        const aboard = ahead?.ferry && km >= ahead.from
        this._set('crossSub', aboard ? `${ahead.code} · на поромі · on the ferry · ${fmtKm(ahead.to - km)} км to go`
            : ahead ? `next ${ahead.code} ${ahead.label} · ${fmtKm((ahead.ferry ? ahead.from : ahead.km) - km)} км`
            : 'all five crossed')
        this._set('code', `1000·С002   ${g.code}   ${w.code}/19   ${String(Math.round(km)).padStart(4, '0')}   ${d + 1}/${DAYS.length}`)

        p.distance = `${fmtKm(km)} км · ${pct}%`
        p.time     = `день ${D.n} · ${nf2.format(t)} / ${DAYS.length}`
        p.space    = `${nf2.format(lat)}° N · ${nf2.format(lon)}° E`
        this.headLabel.el.textContent = `${fmtKm(km)} км`

        this._markKey('day', d, d - 1)
        this._markKey('leg', legI, legI - 1)
        this._markKey('wp', i, i)
        this._markKey('cross', crossed.length - 1, crossed.length - 1)
    }

    // ── Resize / keys ─────────────────────────────────────────────────────────
    _initResize() {
        window.addEventListener('resize', () => {
            this._layout()
            if (!this.params.frame) this._fit(true)
        })
    }

    _initKeys() {
        window.addEventListener('keydown', e => {
            if (e.code !== 'Space' || e.target.closest?.('input, select, button, textarea')) return
            e.preventDefault()
            this.params.play = !this.params.play
        })
    }

    // ── Travel ────────────────────────────────────────────────────────────────
    // pace: distance = even km per second; time = even seconds per day.
    _advance(dt) {
        const p = this.params
        if (!p.play) return
        if (p.travelled >= TOTAL_KM) {
            if (!p.loop) { p.play = false; return }
            this.hold += dt
            if (this.hold > 1.6) {
                this.hold = 0
                p.travelled = 0
                if (p.tour) this._nextTour()
            }
            return
        }
        if (p.pace === 'time') {
            const t = timeOf(p.travelled) + dt * p.speed / (TOTAL_KM / DAYS.length)
            p.travelled = kmOfTime(Math.min(t, DAYS.length))
        } else {
            p.travelled = Math.min(TOTAL_KM, p.travelled + p.speed * dt)
        }
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    update(dt) {
        const p = this.params
        this._advance(dt)
        this.time += dt

        // positions only move while an axis, layout or spacing is changing
        const sig   = [this.w.D, this.w.T, this.w.S, this.lw.sheet, this.lw.key, this.lw.strata, this.lw.days, p.spacing].join()
        const moved = sig !== this._sig
        if (moved) {
            this._sig = sig
            this._computeOffsets(this.w, this.lw, p.spacing, this.offsets)
        }
        const recolour = p.travelled !== this._lastKm || this._recolour
        this._lastKm   = p.travelled
        this._recolour = false

        this.head.forEach(v => reanchor(v, p.travelled))
        reanchor(this.vehicleV, p.travelled)
        reanchor(this.headLabel.v, p.travelled)

        // the reticle turns slowly about the vehicle; guides run to the next
        // waypoint and on to Т19
        const turn = this.time * 24
        for (const v of this.reticle) {
            reanchor(v, p.travelled)
            const a = (v.deg + turn) * Math.PI / 180
            v.dx = Math.cos(a) * 0.62
            v.dy = Math.sin(a) * 0.62
        }
        const next = WP.find(w => w.km > p.travelled + 0.01)
        reanchor(this.guideV[0], p.travelled)
        reanchor(this.guideV[2], p.travelled)
        reanchor(this.guideV[1], next ? next.km : p.travelled)

        for (const st of this.strokes) st.update(this, moved, recolour)
        this.nodes.update(this, moved, recolour)
        this.vehicle.update(this, true, false)
        if (moved) this._updateFills()
        this.fills.material.opacity = p.planeFill
        this.fills.visible = p.planeFill > 0

        this.labelLayer.visible = p.showLabels
        for (const l of this.labels) {
            if (moved || l.dyn) this._place(l.v, l.obj.position)
            const lit = l.v.t < 0 || l.v.t <= p.travelled + 0.01
            const op  = Math.round((lit ? 1 : Math.max(p.untravelled, 0.32)) * (l.fade ? l.fade() : 1) * 100) / 100
            if (op !== l.op) {
                l.op = op
                l.root.style.opacity = op
                l.obj.visible = op > 0.01
            }
        }
        this._updateKey()
        this._updateParticles(moved)
        if (recolour) this._updateReadout()

        this.controls.autoRotate      = p.autoRotate
        this.controls.autoRotateSpeed = p.rotateSpeed
        this.controls.update()
        this.nodes.material.uniforms.uPx.value   = this.camera.zoom
        this.vehicle.material.uniforms.uPx.value = this.camera.zoom
        for (const st of this.strokes) st.material.resolution.set(this.view.w, this.view.h)

        this._set('status', p.travelled >= TOTAL_KM ? 'прибуття · Т19 — arrived'
            : p.travelled < 1 ? 'дані маршруту завантажено — route data loaded'
            : p.play ? 'статус · активний — status active' : 'утримання — hold')
        this.guidance.update(dt)
    }

    _loop() {
        const tick = () => {
            this.update(Math.min(this.clock.getDelta(), 0.1))
            this.renderer.render(this.scene, this.camera)
            this.cssRenderer.render(this.cssScene, this.camera)
            if (this.exporter.active) this.exporter.afterRender()
            requestAnimationFrame(tick)
        }
        tick()
    }
}
