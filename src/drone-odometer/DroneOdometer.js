import * as THREE from 'three'
import GUI from 'lil-gui'
import { TOTAL_KM, WAYPOINTS, LEGS } from '../distance-travelled/data.js'
import { Contacts, BANDS } from './contacts.js'

// ── Palettes · as the distance-travelled sheet ────────────────────────────────
// guidance — white hairlines on black; night — the 1000 tokens. Flag blue and
// yellow still mark М5 and Т19 only, so an alert inverts rather than taking a
// colour of its own.
const THEMES = {
    guidance : { ground: '#000000', text: '#ffffff', muted: '#8f8f8f', uaBlue: '#0057b7', uaYellow: '#ffd700' },
    night    : { ground: '#141414', text: '#f3e2b6', muted: '#a8a092', uaBlue: '#0057b7', uaYellow: '#ffd700' },
}
const PAL = { ...THEMES.guidance }

// ── Stage · 4:5, laid out at a fixed size and scaled to fit beside the GUI ────
const W = 720, H = 900, G = 32, R_EDGE = W - G
const EXPORT_SIZES = { 1080: [1080, 1350], 1440: [1440, 1800], 2160: [2160, 2700] }
const MIMES = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4;codecs=avc1.4d0028',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
]

// ── Odometer · six whole km and the tenths ─────────────────────────────────────
const DRUMS    = 7
const DRUM_R   = 96             // a 36° cell is 60 px of arc
const DRUM_W   = 58
const DRUM_GAP = 8
const DOT_GAP  = 16             // before the tenths drum
const DRUM_Y   = 194
const WIN_H    = 112

// ── Scope · heading up, relative bearings ─────────────────────────────────────
const SCOPE = { x: 360, y: 508, r: 156 }
const RINGS = { 2: [0.5, 1, 1.5], 3: [0.5, 1, 2], 5: [1, 2, 3, 4] }

// ── Route strip · Kraków to Kyiv ──────────────────────────────────────────────
const STRIP = { from: 1792, to: TOTAL_KM, y: 858 }
const START = { 'М5 · 1 973 км': 1973, 'Т15 Lviv · 2 085 км': 2085, 'Т14 Kraków · 1 792 км': 1792 }

const mono = (w, s) => `${w} ${s}px "JetBrains Mono", ui-monospace, monospace`
const mf   = s => `700 ${s}px MFred, "JetBrains Mono", ui-monospace, monospace`
const rad  = d => d * Math.PI / 180
const nf1  = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf0  = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 })
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')

// A drum: an open cylinder on the x axis. v runs round the circumference, so a
// texture of digits stacked top to bottom reads upright on the front face.
function drumGeometry(r, w, seg = 96) {
    const pos = [], uv = [], index = []
    for (let i = 0; i <= seg; i++) {
        const t = i / seg, a = t * Math.PI * 2
        pos.push(-w / 2, Math.sin(a) * r, Math.cos(a) * r, w / 2, Math.sin(a) * r, Math.cos(a) * r)
        uv.push(0, t, 1, t)
    }
    for (let i = 0; i < seg; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3
        index.push(a, b, d, a, d, c)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(index)
    return g
}

function download(blob, name) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

// ─────────────────────────────────────────────────────────────────────────────
export class DroneOdometer {
    constructor() {
        this.$stage  = document.querySelector('.stage')
        this.$tag    = document.querySelector('.frame-tag')
        this.back    = document.querySelector('canvas.backdrop')
        this.hud     = document.querySelector('canvas.hud')
        this.$grain  = document.querySelector('.grain')
        this.bctx    = this.back.getContext('2d')
        this.hctx    = this.hud.getContext('2d')
        this.clock   = new THREE.Clock()
        this.mobile  = window.innerWidth < 760
        this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        this.time    = 0
        this.hold    = 0
        this.phase   = 0
        this.levels  = BANDS.map(() => ({ level: 0.06, peak: 0.06 }))
        this.state   = { seen: [], alert: false, state: 'clear' }
        this.out     = document.createElement('canvas')
        this.octx    = this.out.getContext('2d')

        // Mutable params (shared with GUI)
        this.params = {
            play       : !this.reduced,
            speed      : 30,             // km per second
            start      : 1973,
            travelled  : 1973,
            loop       : true,
            // scope
            range      : 3,
            alertKm    : 1,
            sweep      : !this.reduced,
            sweepSpeed : 0.45,           // turns per second
            trails     : true,
            timeScale  : 24,             // simulated seconds per animation second
            // contacts
            count      : 7,
            seed       : 1000,
            // art direction
            theme      : 'guidance',
            grain      : 0.025,
            backdrop   : 0.12,
            details    : true,
            // export · 4:5
            exportSize : '1080',
            fps        : 30,
            clip       : 'run',
            status     : 'compose, then record',
        }

        this.contacts = new Contacts()
        this._plan()
        this._seedScatter()
        this._makeGrain()
        this._initRenderer()
        this._initGUI()
        this._layout()
        window.addEventListener('resize', () => this._layout())
        window.addEventListener('keydown', e => {
            if (e.code !== 'Space' || e.target.closest?.('input, select, button, textarea')) return
            e.preventDefault()
            this.params.play = !this.params.play
        })
        Promise.all([document.fonts.load(mf(92)), document.fonts.load(mono(500, 12))])
            .finally(() => this._buildDrums())
        this._loop()
    }

    _plan() {
        const p = this.params
        this.contacts.plan(p.seed, p.count, p.start, TOTAL_KM)
        if (p.travelled < p.start) p.travelled = p.start
        this.contacts.reset(p.travelled)
    }

    // ── Renderer · the drums are the only 3D; everything else is drawn flat ───
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas.webgl'), antialias: true, alpha: true })
        this.renderer.setClearColor(0x000000, 0)
        this.scene  = new THREE.Scene()
        // stage px, y down: world (x, −y)
        this.camera = new THREE.OrthographicCamera(0, W, 0, -H, 1, 2000)
        this.camera.position.set(0, 0, 1000)
    }

    _digitTexture(inverted, tex) {
        const c = tex?.image ?? document.createElement('canvas')
        c.width = 128
        c.height = 1280
        const g = c.getContext('2d')
        const body = inverted ? PAL.text : PAL.ground, ink = inverted ? PAL.ground : PAL.text
        g.fillStyle = body
        g.fillRect(0, 0, 128, 1280)
        g.fillStyle = ink
        g.font = mf(96)
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        for (let k = 0; k < 10; k++) g.fillText(String(k), 64, k * 128 + 68)
        g.globalAlpha = 0.18
        for (let k = 0; k < 10; k++) g.fillRect(14, k * 128, 100, 1)
        if (tex) { tex.needsUpdate = true; return tex }
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        return t
    }

    _buildDrums() {
        this.tex = [this._digitTexture(false), this._digitTexture(true)]
        const geo = drumGeometry(DRUM_R, DRUM_W)
        this.drums = []
        let x = G + DRUM_W / 2
        for (let i = 0; i < DRUMS; i++) {
            const tenths = i === DRUMS - 1
            if (tenths) x += DOT_GAP - DRUM_GAP
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.tex[tenths ? 1 : 0] }))
            mesh.position.set(x, -DRUM_Y, 0)
            this.scene.add(mesh)
            this.drums.push(mesh)
            x += DRUM_W + DRUM_GAP
        }
        this.drumX = this.drums.map(d => d.position.x)
    }

    // Each drum carries only while every drum to its right reads 9, as a real
    // odometer does; the tenths roll continuously.
    _drumPositions(km) {
        const t = km * 10
        const out = []
        for (let k = 0; k < DRUMS; k++) {
            const unit = 10 ** k
            const base = Math.floor(t / unit) % 10
            const carry = k === 0 ? t % 1 : Math.max(0, (t % unit) - (unit - 1))
            out.unshift((base + carry) % 10)
        }
        return out
    }

    // ── Stage ─────────────────────────────────────────────────────────────────
    _layout() {
        const guiW = this.gui._closed ? 16 : this.gui.domElement.offsetWidth + 32
        const aw = Math.max(200, window.innerWidth - guiW - 40), ah = Math.max(250, window.innerHeight - 64)
        const s = Math.min(aw / W, ah / H)
        const left = 24 + (aw - W * s) / 2, top = 20 + (ah - H * s) / 2
        Object.assign(this.$stage.style, { left: `${left}px`, top: `${top}px`, transform: `scale(${s})` })
        const [EW, EH] = EXPORT_SIZES[this.params.exportSize]
        this.$tag.textContent = `4:5 · ${EW} × ${EH} · ${this.rec ? 'recording' : 'export frame'}`
        Object.assign(this.$tag.style, { left: `${left}px`, top: `${top + H * s + 8}px` })

        // the drawing buffers are the export size itself
        this.ratio = EW / W
        this.renderer.setPixelRatio(this.ratio)
        this.renderer.setSize(W, H)
        for (const c of [this.back, this.hud]) {
            c.width = Math.round(W * this.ratio)
            c.height = Math.round(H * this.ratio)
            c.style.width = `${W}px`
            c.style.height = `${H}px`
        }
        this.pattern = null
    }

    // ── Grain · the same stepped noise tile as the distance-travelled page ────
    _makeGrain() {
        const c = document.createElement('canvas')
        c.width = c.height = 256
        const g = c.getContext('2d'), img = g.createImageData(256, 256)
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.pow(Math.random(), 2.4) * 255
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v
            img.data[i + 3] = 255
        }
        g.putImageData(img, 0, 0)
        this.tile = c
        this.$grain.style.backgroundImage = `url(${c.toDataURL()})`
    }

    // scattered dots, target rings and тисяча marks, set unevenly on purpose
    _seedScatter() {
        let a = 1000
        const r = () => ((a = (a * 16807) % 2147483647) / 2147483647)
        this.dots  = Array.from({ length: 14 }, (_, i) => ({ x: 20 + r() * 680, y: 120 + r() * 700, r: 1 + r() * 2.4, a: 0.2 + r() * 0.5, ring: i % 5 === 0 }))
        this.marks = Array.from({ length: 7 }, () => ({ x: 30 + r() * 620, y: 140 + r() * 680, s: 9 + Math.round(r() * 3), a: 0.1 + r() * 0.4 }))
    }

    // ── Travel ────────────────────────────────────────────────────────────────
    _advance(dt) {
        const p = this.params
        if (!p.play) return
        if (p.travelled >= TOTAL_KM) {
            if (!p.loop) { p.play = false; return }
            this.hold += dt
            if (this.hold > 1.6) {
                this.hold = 0
                p.travelled = p.start
                this.contacts.reset(p.start)
            }
            return
        }
        p.travelled = Math.min(TOTAL_KM, p.travelled + p.speed * dt)
    }

    update(dt) {
        const p = this.params
        this.time += dt
        this._advance(dt)
        this.state = this.contacts.update(dt, p.travelled, p.range, p.alertKm, p.timeScale)

        // RF: a noise floor per band, each contact lifting its own band
        BANDS.forEach((_, i) => {
            let target = 0.05 + Math.random() * 0.05
            for (const a of this.contacts.active) {
                if (a.e.band === i) target += a.signal * 0.92
                else if (Math.abs(a.e.band - i) === 1) target += a.signal * 0.08
            }
            const L = this.levels[i]
            L.level += (Math.min(1, target) - L.level) * Math.min(1, dt * 9)
            L.peak = Math.max(L.peak - dt * 0.12, L.level)
        })

        if (this.drums) {
            this._drumPositions(p.travelled).forEach((pos, i) => { this.drums[i].rotation.x = -rad((pos + 0.5) * 36) })
        }
        this.$grain.style.opacity = p.grain
        this._drawBack(dt)
        this._drawHud()
    }

    // ── Backdrop · the guidance fan and scatter, behind the drums ─────────────
    _drawBack(dt) {
        const ctx = this.bctx, p = this.params
        ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0)
        ctx.globalAlpha = 1
        ctx.fillStyle = PAL.ground
        ctx.fillRect(0, 0, W, H)
        ctx.strokeStyle = PAL.text
        ctx.fillStyle = PAL.text
        ctx.lineWidth = 1
        if (p.backdrop > 0) {
            this.phase = (this.phase + dt * (p.play ? 0.06 + p.speed / 800 : 0.012)) % 1
            const cx = W / 2, cy = H * 0.48, half = H * 0.5, gap = H * 0.035
            for (let i = 0; i < 26; i++) {
                const u = ((i / 26) - this.phase + 1) % 1
                const s = 1 / (1 + 40 * u)
                const v = 0.37 * s * half, e = Math.pow(s, 0.525) * half
                ctx.globalAlpha = p.backdrop * Math.min(1, u / 0.08) * Math.min(1, (1 - u) / 0.15) * (0.45 + 0.55 * Math.pow(s, 0.3))
                ctx.beginPath()
                for (const dir of [-1, 1]) {
                    ctx.moveTo(0, cy + dir * (gap + e)); ctx.lineTo(cx, cy + dir * (gap + v)); ctx.lineTo(W, cy + dir * (gap + e))
                }
                ctx.stroke()
            }
        }
        if (p.details) {
            for (const d of this.dots) {
                ctx.globalAlpha = d.a
                ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
                if (d.ring) { ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 5, 0, Math.PI * 2); ctx.stroke() }
            }
            ctx.font = mono(400, 11)
            for (const m of this.marks) {
                ctx.globalAlpha = Math.random() < 0.004 ? 0 : m.a
                ctx.font = mono(400, m.s)
                ctx.fillText('тисяча', m.x, m.y)
            }
        }
        ctx.globalAlpha = 1
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    _text(ctx, str, x, y, { font = mono(400, 10), color = PAL.text, align = 'left', ls = 0, alpha = 1 } = {}) {
        ctx.globalAlpha = alpha
        ctx.font = font
        ctx.fillStyle = color
        ctx.textAlign = align
        ctx.letterSpacing = `${ls}px`
        ctx.fillText(str, x, y)
        ctx.letterSpacing = '0px'
    }

    _rule(ctx, y, alpha = 0.22) {
        ctx.globalAlpha = alpha
        ctx.fillStyle = PAL.text
        ctx.fillRect(G, y, R_EDGE - G, 1)
    }

    _section(ctx, y, title, note) {
        this._text(ctx, title.toUpperCase(), G, y, { font: mono(500, 11), ls: 1.5 })
        if (note) this._text(ctx, note, R_EDGE, y, { font: mono(400, 9), color: PAL.muted, align: 'right' })
    }

    _drawHud() {
        const ctx = this.hctx
        ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0)
        ctx.clearRect(0, 0, W, H)
        ctx.lineWidth = 1
        this._odometer(ctx)
        this._header(ctx)
        this._scope(ctx)
        this._rf(ctx)
        this._register(ctx)
        this._strip(ctx)
        this._status(ctx)
        ctx.globalAlpha = 1
    }

    _blink() { return this.reduced || (this.time % 0.85) < 0.6 }

    _header(ctx) {
        const st = this.state, a = st.seen.find(c => c.range < this.params.alertKm) ?? st.seen[0]
        this._text(ctx, 'ТИСЯЧА · CASE EVAC · WINTER 2024 · 1000·С003 · MOTION', G, 40, { font: mono(500, 10), color: PAL.muted, ls: 1.6 })
        this._text(ctx, 'ODOMETER · DRONE WATCH', G, 82, { font: mf(34), ls: 0.3 })
        this._text(ctx, 'одометр · виявлення дронів — each contact stamped with its km', G, 104, { font: mono(400, 11), color: PAL.muted })

        // alert block: clear · contact · alert (inverted, blinking)
        const x = 476, y = 52, w = R_EDGE - x, h = 32
        const label = st.state === 'alert' ? `ТРИВОГА · ALERT · ${a.e.id}`
            : st.state === 'contact' ? `КОНТАКТ · CONTACT · ${a.e.id}` : 'ЧИСТО · CLEAR'
        if (st.state === 'alert' && this._blink()) {
            ctx.globalAlpha = 1
            ctx.fillStyle = PAL.text
            ctx.fillRect(x, y, w, h)
            this._text(ctx, label, x + w / 2, y + 20, { font: mono(700, 11), color: PAL.ground, align: 'center', ls: 1.2 })
        } else {
            ctx.globalAlpha = st.state === 'clear' ? 0.55 : 1
            ctx.strokeStyle = PAL.text
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
            this._text(ctx, label, x + w / 2, y + 20, { font: mono(700, 11), color: st.state === 'clear' ? PAL.muted : PAL.text, align: 'center', ls: 1.2 })
        }
        this._text(ctx, 'симуляція · simulated contacts', R_EDGE, 100, { font: mono(400, 9), color: PAL.muted, align: 'right' })
    }

    _odometer(ctx) {
        const p = this.params
        if (this.drumX) {
            // housing: hide the drums outside the window, then shade the curve
            const x0 = G - 6, x1 = this.drumX.at(-1) + DRUM_W / 2 + 6
            const top = DRUM_Y - WIN_H / 2, bot = DRUM_Y + WIN_H / 2
            ctx.globalAlpha = 1
            ctx.fillStyle = PAL.ground
            ctx.fillRect(x0, DRUM_Y - DRUM_R - 6, x1 - x0, top - (DRUM_Y - DRUM_R - 6))
            ctx.fillRect(x0, bot, x1 - x0, DRUM_Y + DRUM_R + 6 - bot)
            const shade = (y0, y1) => {
                const g = ctx.createLinearGradient(0, y0, 0, y1)
                g.addColorStop(0, PAL.ground)
                g.addColorStop(1, 'rgba(0, 0, 0, 0)')
                ctx.globalAlpha = 0.92
                ctx.fillStyle = g
                ctx.fillRect(x0, Math.min(y0, y1), x1 - x0, Math.abs(y1 - y0))
            }
            shade(top, top + 34)
            shade(bot, bot - 34)
            ctx.globalAlpha = 0.55
            ctx.strokeStyle = PAL.text
            for (const x of this.drumX) ctx.strokeRect(x - DRUM_W / 2 + 0.5, top + 0.5, DRUM_W - 1, WIN_H - 1)
            // reading line and the decimal point
            ctx.globalAlpha = 0.9
            ctx.fillStyle = PAL.text
            ctx.fillRect(x0 - 8, DRUM_Y, 6, 1)
            ctx.fillRect(x1 + 2, DRUM_Y, 6, 1)
            ctx.beginPath()
            ctx.arc(this.drumX.at(-1) - DRUM_W / 2 - DOT_GAP / 2, bot - 14, 2.4, 0, Math.PI * 2)
            ctx.fill()
            this._text(ctx, 'км', x1 + 14, DRUM_Y + 6, { font: mono(500, 16), color: PAL.muted })
        }
        this._section(ctx, 124, '01 · одометр · odometer', 'км від Бристоля · km from Bristol')

        const leg = LEGS.find(l => p.travelled <= l.end) ?? LEGS.at(-1)
        this._text(ctx, 'КУРС · HEADING', R_EDGE, 158, { font: mono(500, 9), color: PAL.muted, align: 'right', ls: 1.2 })
        this._text(ctx, `${String(leg.deg).padStart(3, '0')}°`, R_EDGE, 186, { font: mf(26), align: 'right' })
        this._text(ctx, `ЕТАП · LEG ${leg.code}`, R_EDGE, 214, { font: mono(500, 9), color: PAL.muted, align: 'right', ls: 1.2 })
        this._text(ctx, `${leg.from} → ${leg.to}`, R_EDGE, 232, { font: mono(500, 10), align: 'right' })

        const last = this.contacts.register[0]
        const cells = [
            ['етап е4 · trip', nf1.format(Math.max(0, p.travelled - 1792)), 'км'],
            ['від контакту · since contact', last ? nf1.format(Math.max(0, p.travelled - last.km)) : '—', last ? 'км' : ''],
            ['контактів · contacts', String(this.contacts.register.length).padStart(2, '0'), ''],
        ]
        cells.forEach(([lab, val, unit], i) => {
            const x = G + i * 228
            this._text(ctx, lab.toUpperCase(), x, 270, { font: mono(500, 9), color: PAL.muted, ls: 1.2 })
            this._text(ctx, val, x, 294, { font: mf(20) })
            if (unit) {
                ctx.font = mf(20)
                this._text(ctx, unit, x + ctx.measureText(val).width + 6, 294, { font: mono(400, 11), color: PAL.muted })
            }
        })
        this._rule(ctx, 306)
    }

    _scope(ctx) {
        const p = this.params, st = this.state
        const { x: cx, y: cy, r: R } = SCOPE, k = R / p.range
        const P = (b, d) => [cx + Math.sin(rad(b)) * d * k, cy - Math.cos(rad(b)) * d * k]
        const circle = (r, alpha, width = 1) => {
            ctx.globalAlpha = alpha
            ctx.lineWidth = width
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
        }
        this._section(ctx, 322, '02 · виявлення · detection', `радіус ${p.range} км · відносний пеленг · relative bearing`)
        ctx.strokeStyle = PAL.text
        ctx.fillStyle = PAL.text

        circle(R, 0.9)
        for (const d of RINGS[p.range] ?? RINGS[3]) {
            circle(d * k, 0.22)
            this._text(ctx, `${nf1.format(d).replace(',0', '')} км`, cx + 4, cy - d * k - 4, { font: mono(400, 9), color: PAL.muted })
        }
        // the alert radius, dashed; lit while anything is inside it
        ctx.setLineDash([3, 4])
        circle(p.alertKm * k, st.alert ? (this._blink() ? 1 : 0.35) : 0.45)
        ctx.setLineDash([])

        // bearing ring
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        for (let i = 0; i < 72; i++) {
            const len = i % 6 === 0 ? 10 : i % 2 === 0 ? 5 : 3
            const s = Math.sin(rad(i * 5)), c = Math.cos(rad(i * 5))
            ctx.moveTo(cx + s * R, cy - c * R)
            ctx.lineTo(cx + s * (R + len), cy - c * (R + len))
        }
        ctx.stroke()
        for (let b = 0; b < 360; b += 30) {
            const [x, y] = P(b, (R + 21) / k)
            this._text(ctx, String(b).padStart(3, '0'), x, y + 3, { font: mono(400, 9), color: PAL.muted, align: 'center' })
        }
        // north, relative to the heading
        const leg = LEGS.find(l => p.travelled <= l.end) ?? LEGS.at(-1)
        const [nx, ny] = P(360 - leg.deg, (R + 36) / k)
        this._text(ctx, 'N', nx, ny + 4, { font: mono(700, 11), align: 'center' })

        // faint cross
        ctx.globalAlpha = 0.12
        ctx.beginPath()
        ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy)
        ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R)
        ctx.stroke()

        // sweep with a fading wake
        const sweep = (this.time * p.sweepSpeed * 360) % 360
        if (p.sweep) {
            for (let j = 14; j >= 0; j--) {
                const [x, y] = P(sweep - j * 3, p.range)
                ctx.globalAlpha = j === 0 ? 0.9 : 0.3 * (1 - j / 15)
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke()
            }
        }

        // the vehicle: triangle in a broken reticle
        const turn = this.time * 24
        ctx.globalAlpha = 0.95
        ctx.lineWidth = 2
        for (const [a0, a1] of [[15, 165], [211, 349]]) {
            ctx.beginPath()
            ctx.arc(cx, cy, 22, rad(-a0 - turn), rad(-a1 - turn), true)
            ctx.stroke()
        }
        ctx.lineWidth = 1
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx + 8.7, cy + 5); ctx.lineTo(cx - 8.7, cy + 5); ctx.closePath()
        ctx.fill()

        // contacts
        for (const a of st.seen) {
            const [x, y] = P(a.bearing, a.range)
            const lag = ((sweep - a.bearing) % 360 + 360) % 360
            const lit = p.sweep ? 0.55 + 0.45 * Math.exp(-lag / 50) : 1
            if (p.trails) {
                a.trail.forEach(([tx, ty], i) => {
                    const r = Math.hypot(tx, ty)
                    if (r > p.range) return
                    ctx.globalAlpha = (i / a.trail.length) * 0.5 * lit
                    ctx.beginPath(); ctx.arc(cx + tx * k, cy - ty * k, 1.2, 0, Math.PI * 2); ctx.fill()
                })
            }
            ctx.globalAlpha = 0.22
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke()
            ctx.globalAlpha = 0.4
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a.vx * 0.45 * k, y - a.vy * 0.45 * k); ctx.stroke()
            // node on the ring at its bearing
            const [ox, oy] = P(a.bearing, p.range)
            ctx.globalAlpha = 0.9
            ctx.fillStyle = PAL.ground
            ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
            ctx.fillStyle = PAL.text
            ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill()
            // target
            ctx.globalAlpha = lit
            ctx.lineWidth = 1.5
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke()
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill()
            if (a.range < p.alertKm && this._blink()) { ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.stroke() }
            // labels sit outward from the vehicle so close passes stay legible
            const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1
            const lx = x + dx / d * 16, ly = y + dy / d * 12, align = dx >= 0 ? 'left' : 'right'
            this._text(ctx, `${a.e.id} · ${a.e.type.split(' · ').at(-1).toUpperCase()}`, lx, ly - 2, { font: mono(700, 10), align, alpha: lit })
            this._text(ctx, `${BANDS[a.e.band].label} · ${nf1.format(a.range)} км · ${String(Math.round(a.bearing)).padStart(3, '0')}°`, lx, ly + 10, { font: mono(400, 9), color: PAL.muted, align })
        }
        this._rule(ctx, 696)
    }

    _rf(ctx) {
        this._section(ctx, 712, '03 · ефір · rf', 'пасивний приймач · passive · чотири смуги')
        const active = new Set(this.state.seen.map(a => a.e.band))
        BANDS.forEach((b, i) => {
            const y = 726 + i * 14, x0 = 118, x1 = 590, L = this.levels[i]
            const on = active.has(i)
            this._text(ctx, b.label, G, y + 6, { font: mono(on ? 700 : 500, 10), color: on ? PAL.text : PAL.muted })
            ctx.globalAlpha = 0.35
            ctx.strokeStyle = PAL.text
            ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0, 6)
            ctx.globalAlpha = on ? 0.95 : 0.6
            ctx.fillStyle = PAL.text
            ctx.fillRect(x0 + 1, y + 1, (x1 - x0 - 1) * Math.min(1, L.level), 5)
            ctx.globalAlpha = 0.9
            ctx.fillRect(x0 + (x1 - x0) * Math.min(1, L.peak), y - 2, 1, 11)
            this._text(ctx, `${nf0.format(-95 + 60 * L.level)} дБм`, R_EDGE, y + 6, { font: mono(400, 10), color: on ? PAL.text : PAL.muted, align: 'right' })
        })
        this._rule(ctx, 784)
    }

    _register(ctx) {
        this._section(ctx, 798, '04 · реєстр · register', 'км — з одометра в мить виявлення · km read off the odometer')
        const rows = this.contacts.register.slice(0, 3)
        if (!rows.length) {
            this._text(ctx, '— реєстр порожній · register empty', G, 814, { font: mono(400, 10), color: PAL.muted })
            return
        }
        rows.forEach((r, i) => {
            const y = 814 + i * 13, alpha = i === 0 ? 1 : 0.6
            const state = r.alerted ? 'ТРИВОГА · ALERT' : r.closed ? 'ЗАКРИТО · CLOSED' : 'КОНТАКТ · CONTACT'
            this._text(ctx, r.id, G, y, { font: mono(700, 10), alpha })
            this._text(ctx, `${nf1.format(r.km)} км`, G + 44, y, { font: mf(12), alpha })
            this._text(ctx, BANDS[r.band].label, G + 150, y, { font: mono(400, 10), alpha })
            this._text(ctx, r.type, G + 226, y, { font: mono(400, 10), alpha })
            this._text(ctx, `мін. ${nf1.format(r.min)} км`, G + 450, y, { font: mono(400, 10), alpha })
            this._text(ctx, state, R_EDGE, y, { font: mono(r.alerted ? 700 : 500, 10), align: 'right', alpha })
        })
    }

    _strip(ctx) {
        const p = this.params, y = STRIP.y
        const X = km => G + (km - STRIP.from) / (STRIP.to - STRIP.from) * (R_EDGE - G)
        ctx.fillStyle = PAL.text
        ctx.globalAlpha = 0.35
        ctx.fillRect(G, y, R_EDGE - G, 1)
        ctx.globalAlpha = 1
        ctx.fillRect(X(Math.max(STRIP.from, p.start)), y, Math.max(0, X(p.travelled) - X(Math.max(STRIP.from, p.start))), 1)
        for (const w of WAYPOINTS.filter(w => w.km >= STRIP.from)) {
            ctx.globalAlpha = 0.7
            ctx.fillRect(X(w.km), y - 4, 1, 4)
        }
        this._text(ctx, 'Т14 KRAKÓW', G, y + 13, { font: mono(400, 9), color: PAL.muted })
        this._text(ctx, 'Т15 LVIV', X(2085), y + 13, { font: mono(400, 9), color: PAL.muted, align: 'center' })
        this._text(ctx, 'Т16', X(2265), y + 13, { font: mono(400, 9), color: PAL.muted, align: 'center' })
        this._text(ctx, 'Т17', X(2440), y + 13, { font: mono(400, 9), color: PAL.muted, align: 'center' })
        this._text(ctx, 'Т19 КИЇВ', R_EDGE, y + 13, { font: mono(700, 9), color: PAL.uaYellow, align: 'right' })
        // М5 and Т19 in flag colours, as on the sheet
        const m5 = X(1973)
        ctx.globalAlpha = 1
        ctx.strokeStyle = PAL.uaYellow
        ctx.beginPath()
        ctx.moveTo(m5 - 6, y - 5); ctx.lineTo(m5 - 3, y - 5); ctx.lineTo(m5 - 3, y + 5); ctx.lineTo(m5 - 6, y + 5)
        ctx.moveTo(m5 + 6, y - 5); ctx.lineTo(m5 + 3, y - 5); ctx.lineTo(m5 + 3, y + 5); ctx.lineTo(m5 + 6, y + 5)
        ctx.stroke()
        this._text(ctx, 'М5', m5, y + 13, { font: mono(700, 9), color: PAL.uaYellow, align: 'center' })
        ctx.globalAlpha = 1
        ctx.fillStyle = PAL.uaBlue
        ctx.beginPath(); ctx.arc(R_EDGE, y, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.arc(R_EDGE, y, 5.5, 0, Math.PI * 2); ctx.stroke()
        // detections, alerts taller
        ctx.fillStyle = PAL.text
        for (const r of this.contacts.register) {
            ctx.globalAlpha = 0.9
            ctx.fillRect(X(r.km), y - (r.alerted ? 14 : 9), 1, r.alerted ? 12 : 7)
        }
        // the vehicle
        const vx = X(p.travelled)
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.moveTo(vx + 6, y); ctx.lineTo(vx - 4, y - 5); ctx.lineTo(vx - 4, y + 5); ctx.closePath()
        ctx.fill()
    }

    _status(ctx) {
        const p = this.params
        this._rule(ctx, 876)
        const status = p.travelled >= TOTAL_KM ? 'ПРИБУТТЯ · Т19 — ARRIVED' : p.play ? 'СТАТУС · АКТИВНИЙ — STATUS ACTIVE' : 'УТРИМАННЯ — HOLD'
        this._text(ctx, '1000·С003 · СИМУЛЯЦІЯ — CONTACTS ARE SIMULATED, NOT LOGGED', G, 892, { font: mono(500, 9), color: PAL.muted, ls: 1 })
        this._text(ctx, status, R_EDGE, 892, { font: mono(500, 9), align: 'right', ls: 1 })
    }

    // ── Theme ─────────────────────────────────────────────────────────────────
    _applyTheme(name) {
        Object.assign(PAL, THEMES[name])
        const root = document.documentElement.style
        root.setProperty('--ground', PAL.ground)
        root.setProperty('--text', PAL.text)
        root.setProperty('--muted', PAL.muted)
        if (this.tex) { this._digitTexture(false, this.tex[0]); this._digitTexture(true, this.tex[1]) }
    }

    // ── GUI ───────────────────────────────────────────────────────────────────
    _initGUI() {
        const gui = this.gui = new GUI({ title: 'Controls', width: 300 })
        const p = this.params
        const replan = () => this._plan()

        gui.add(p, 'play').name('play').listen()
        gui.add(p, 'speed', 5, 200, 1).name('speed (km/s)')
        gui.add(p, 'start', START).name('start').onChange(v => { p.travelled = v; this.hold = 0; replan() })
        gui.add(p, 'travelled', STRIP.from, TOTAL_KM, 0.1).name('odometer (km)').listen().onChange(() => { this.hold = 0 })
        gui.add(p, 'loop').name('loop')

        const sc = gui.addFolder('scope')
        sc.add(p, 'range', { '2 км': 2, '3 км': 3, '5 км': 5 }).name('range')
        sc.add(p, 'alertKm', 0.2, 2, 0.05).name('alert radius (km)')
        sc.add(p, 'sweep').name('sweep')
        sc.add(p, 'sweepSpeed', 0.05, 2, 0.01).name('sweep (turns/s)')
        sc.add(p, 'trails').name('trails')
        sc.add(p, 'timeScale', 4, 80, 1).name('time × (contacts)')

        const ct = gui.addFolder('contacts · simulated')
        ct.add(p, 'count', 0, 16, 1).name('passes').onFinishChange(replan)
        ct.add(p, 'seed', 1, 9999, 1).name('seed').onFinishChange(replan)
        ct.add({ reseed: () => { p.seed = 1 + Math.floor(Math.random() * 9999); replan(); this._sync() } }, 'reseed').name('reseed')

        const art = gui.addFolder('art direction')
        art.add(p, 'theme', { 'guidance · black / white': 'guidance', '1000 · night': 'night' }).name('theme').onChange(v => this._applyTheme(v))
        art.add(p, 'grain', 0, 0.35, 0.005).name('grain')
        art.add(p, 'backdrop', 0, 0.5, 0.005).name('backdrop (guidance)')
        art.add(p, 'details').name('details (marks)')

        const ex = gui.addFolder('export · 4:5 instagram')
        this.sizeCtl = ex.add(p, 'exportSize', { '1080 × 1350 · feed': '1080', '1440 × 1800': '1440', '2160 × 2700': '2160' })
            .name('size').onChange(() => this._layout())
        ex.add(p, 'fps', { '30 fps': 30, '60 fps': 60 }).name('fps')
        ex.add(p, 'clip', { 'one run': 'run', '5 s': '5', '10 s': '10', '15 s': '15', '30 s': '30', '60 s': '60' }).name('length')
        this.recordCtl = ex.add({ record: () => this._record() }, 'record').name('● record clip')
        ex.add({ still: () => { this.still = true } }, 'still').name('save still (PNG)')
        ex.add(p, 'status').name('status').disable().listen()

        gui.add({ replay: () => { p.travelled = p.start; p.play = true; this.hold = 0; this.contacts.reset(p.start) } }, 'replay').name('replay')

        this._guiClosed = this.mobile
        if (this.mobile) gui.close()
        gui.onOpenClose(() => { if (gui._closed !== this._guiClosed) { this._guiClosed = gui._closed; this._layout() } })
    }

    _sync() { this.gui.controllersRecursive().forEach(c => c.updateDisplay()) }

    // ── Export · composite the three layers and the grain at the export size ──
    _composite() {
        const [EW, EH] = EXPORT_SIZES[this.params.exportSize], k = EW / W
        if (this.out.width !== EW || this.out.height !== EH) { this.out.width = EW; this.out.height = EH; this.pattern = null }
        const ctx = this.octx
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.drawImage(this.back, 0, 0, EW, EH)
        ctx.drawImage(this.renderer.domElement, 0, 0, EW, EH)
        ctx.drawImage(this.hud, 0, 0, EW, EH)
        if (this.params.grain > 0) {
            this.pattern ??= ctx.createPattern(this.tile, 'repeat')
            ctx.setTransform(k, 0, 0, k, -Math.random() * 256 * k, -Math.random() * 256 * k)
            ctx.globalAlpha = this.params.grain
            ctx.fillStyle = this.pattern
            ctx.fillRect(0, 0, W + 256, H + 256)
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.globalAlpha = 1
        }
    }

    _record() {
        if (this.rec) return this._stop()
        const p = this.params
        const mime = MIMES.find(m => window.MediaRecorder?.isTypeSupported(m))
        if (!mime || !this.out.captureStream) { p.status = 'this browser cannot record video — try Chrome'; return }
        const [EW, EH] = EXPORT_SIZES[p.exportSize]
        p.travelled = p.start; p.play = true; this.hold = 0
        this.contacts.reset(p.start)
        const run = p.clip === 'run'
        const seconds = run ? (TOTAL_KM - p.start) / p.speed + 1.2 : Number(p.clip)
        this._composite()
        const stream = this.out.captureStream(Number(p.fps))
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(40e6, Math.round(EW * EH * Number(p.fps) * 0.3)) })
        const chunks = []
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        rec.onstop = () => {
            const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
            download(new Blob(chunks, { type: mime.split(';')[0] }), `drone-odometer-4x5-${EW}x${EH}-${stamp()}.${ext}`)
            stream.getTracks().forEach(t => t.stop())
            p.status = `saved ${ext} · ${EW} × ${EH}${ext === 'webm' ? ' · convert to MP4 for Instagram' : ''}`
        }
        rec.start(500)
        this.rec = { rec, t0: performance.now(), seconds, run, shown: -1 }
        this.recordCtl.name('■ stop recording')
        this.sizeCtl.disable()
        this._layout()
    }

    _stop() {
        if (!this.rec) return
        this.rec.rec.stop()
        this.rec = null
        this.recordCtl.name('● record clip')
        this.sizeCtl.enable()
        this._layout()
    }

    _afterRender() {
        const p = this.params
        if (this.still) {
            this.still = false
            this._composite()
            const [EW, EH] = EXPORT_SIZES[p.exportSize]
            this.out.toBlob(b => download(b, `drone-odometer-4x5-${EW}x${EH}-${stamp()}.png`), 'image/png')
            p.status = `saved still · ${EW} × ${EH}`
        }
        if (!this.rec) return
        this._composite()
        const r = this.rec, t = (performance.now() - r.t0) / 1000
        if (Math.floor(t * 4) !== r.shown) { r.shown = Math.floor(t * 4); p.status = `● recording ${t.toFixed(1)} / ${r.seconds.toFixed(1)} s` }
        const arrived = p.travelled >= TOTAL_KM && this.hold > 1
        if ((r.run && (arrived || t > r.seconds + 5)) || (!r.run && t >= r.seconds)) this._stop()
    }

    // ── Loop ──────────────────────────────────────────────────────────────────
    _loop() {
        const tick = () => {
            this.update(Math.min(this.clock.getDelta(), 0.1))
            this.renderer.render(this.scene, this.camera)
            if (this.rec || this.still) this._afterRender()
            requestAnimationFrame(tick)
        }
        tick()
    }
}
