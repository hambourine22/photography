// ─── GUIDANCE LAYER ──────────────────────────────────────────────────────────
// Screen-space art direction behind the 3D sheet, after the instrument
// references: a perspective fan that runs toward the horizon while the route
// is driven, full-height day columns, edge scales, scattered marks, and film
// grain over everything. The marks are deliberately uneven — differing
// opacities, one drifting now and then — so the read stays hand-set.

const FAN_LINES = 26
const MARK_TEXT = 'тисяча'

const rnd = (a, b) => a + Math.random() * (b - a)

export class Guidance {
    constructor(app) {
        this.app    = app
        this.canvas = document.querySelector('canvas.backdrop')
        this.ctx    = this.canvas.getContext('2d')
        this.grain  = document.querySelector('.grain')
        this.phase  = 0
        this.clock  = 0
        this.nextDrift = 2.6

        this._seed()
        this._makeGrain()
        this.resize()
        window.addEventListener('resize', () => this.resize())
    }

    // ── Scatter · dots, target rings and тисяча marks ─────────────────────────
    _seed() {
        this.dots = Array.from({ length: 18 }, (_, i) => ({
            x: rnd(0.03, 0.97), y: rnd(0.14, 0.8),
            r: rnd(1, 3.2), a: rnd(0.25, 0.9), ring: i % 5 === 0,
        }))
        this.marks = Array.from({ length: 12 }, () => this._mark())
    }

    _mark() {
        return { x: rnd(0.04, 0.92), y: rnd(0.16, 0.8), size: Math.round(rnd(10, 13)), a: rnd(0.1, 0.7) }
    }

    // ── Grain · one noise tile, stepped about by CSS ──────────────────────────
    _makeGrain() {
        const c = document.createElement('canvas')
        c.width = c.height = 256
        const g = c.getContext('2d'), img = g.createImageData(256, 256)
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.pow(Math.random(), 2.4) * 255      // mostly dark, sparse bright specks
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v
            img.data[i + 3] = 255
        }
        g.putImageData(img, 0, 0)
        this.grain.style.backgroundImage = `url(${c.toDataURL()})`
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio, 2)
        this.W = window.innerWidth
        this.H = window.innerHeight
        this.canvas.width  = Math.round(this.W * dpr)
        this.canvas.height = Math.round(this.H * dpr)
        this.dpr = dpr
    }

    update(dt) {
        const { ctx, W, H, app } = this
        const p   = app.params
        const pal = app.palette
        this.clock += dt
        this.grain.style.opacity = p.grain

        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
        ctx.clearRect(0, 0, W, H)
        ctx.strokeStyle = pal.text
        ctx.fillStyle   = pal.text
        ctx.lineWidth   = 1

        if (p.backdrop > 0) {
            // the fan comes toward the viewer at the pace of the drive
            this.phase = (this.phase + dt * (p.play ? 0.06 + p.speed / 2400 : 0.012)) % 1
            this._fan(p.backdrop)
            this._columns(p.backdrop, pal)
        }
        if (p.details) {
            if (this.clock > this.nextDrift) {
                this.marks[Math.floor(Math.random() * this.marks.length)] = this._mark()
                this.nextDrift = this.clock + rnd(1.8, 4.2)
            }
            this._scatter(pal)
            if (W >= 760) this._edges(pal)
        }
        ctx.globalAlpha = 1
    }

    // Ceiling and floor of a corridor in perspective: each chevron's vertex sits
    // on the centre line and its arms rise to the screen edge, flattening toward
    // the horizon (after the guidance reference).
    _fan(alpha) {
        const { ctx, W, H } = this
        const cx = W / 2, cy = H * 0.48, half = H * 0.5, gap = H * 0.035
        for (let i = 0; i < FAN_LINES; i++) {
            const u = ((i / FAN_LINES) - this.phase + 1) % 1      // 0 near · 1 far
            const s = 1 / (1 + 40 * u)
            const v = 0.37 * s * half, e = Math.pow(s, 0.525) * half
            const fade = Math.min(1, u / 0.08) * Math.min(1, (1 - u) / 0.15)
            ctx.globalAlpha = alpha * fade * (0.45 + 0.55 * Math.pow(s, 0.3))
            ctx.beginPath()
            for (const dir of [-1, 1]) {
                const vy = cy + dir * (gap + v), ey = cy + dir * (gap + e)
                ctx.moveTo(0, ey); ctx.lineTo(cx, vy); ctx.lineTo(W, ey)
            }
            ctx.stroke()
        }
    }

    // Full-height hairlines at the route plane's day boundaries, labelled at
    // the head of the screen like the reference's column codes.
    _columns(alpha, pal) {
        const { ctx, H } = this
        ctx.font = '500 9px "JetBrains Mono", monospace'
        ctx.textAlign = 'center'
        for (const c of this.app._columns()) {
            if (c.x < -2 || c.x > this.W + 2) continue
            ctx.globalAlpha = Math.min(0.6, alpha * 2.6)
            ctx.fillRect(Math.round(c.x), 0, 1, H)
            ctx.globalAlpha = Math.min(1, alpha * 6)
            ctx.fillStyle = pal.muted
            ctx.fillText(c.label, c.x, 12)
            ctx.fillStyle = pal.text
        }
    }

    _scatter(pal) {
        const { ctx, W, H } = this
        for (const d of this.dots) {
            ctx.globalAlpha = d.a * 0.6
            ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2); ctx.fill()
            if (d.ring) { ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.r + 4, 0, Math.PI * 2); ctx.stroke() }
        }
        ctx.textAlign = 'left'
        for (const m of this.marks) {
            // now and then a mark drops out for a frame
            ctx.globalAlpha = Math.random() < 0.004 ? 0 : m.a * 0.7
            ctx.font = `400 ${m.size}px "JetBrains Mono", monospace`
            ctx.fillText(MARK_TEXT, m.x * W, m.y * H)
        }
    }

    // Mirrored edge scales, as on the reference's left and right margins.
    _edges(pal) {
        const { ctx, W } = this
        const r = this.app._safeRect()
        const vals = this.app._edgeValues()
        ctx.font = '500 10px "JetBrains Mono", monospace'
        ctx.fillStyle = pal.text
        vals.forEach((v, i) => {
            const y = r.t + [0.08, 0.36, 0.7, 0.78][i] * (r.b - r.t)
            ctx.globalAlpha = 0.85
            ctx.textAlign = 'left';  ctx.fillText(v, 14, y)
            ctx.textAlign = 'right'; ctx.fillText(v, W - 14, y)
            if (i < 2) {
                ctx.globalAlpha = 0.7
                ctx.beginPath(); ctx.arc(20, y + 24, 2, 0, Math.PI * 2); ctx.arc(W - 20, y + 24, 2, 0, Math.PI * 2); ctx.fill()
            }
        })
    }
}
