// ─── 4:5 EXPORT ──────────────────────────────────────────────────────────────
// Instagram stills and clips from the framed stage. Every frame is composited
// into a canvas at the export size: the backdrop and WebGL canvases are drawn
// in, then the CSS3D type is redrawn from display lists — each label's layout
// measured once from an untransformed clone, then drawn through the affine the
// orthographic camera gives its plane — then the title, the readout and grain.
// Nothing is screen-captured, so there is no permission prompt and the type
// stays vector-sharp at any export size.

import * as THREE from 'three'

const MIMES = [
    'video/mp4;codecs=avc1.640028',
    'video/mp4;codecs=avc1.4d0028',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
]

const measure  = document.createElement('canvas').getContext('2d')
const v3       = new THREE.Vector3()
const svgCache = new Map()

const alphaOf = c => {
    if (!c || c === 'transparent') return 0
    const slash = c.match(/\/\s*([\d.]+)(%?)\s*\)$/)
    if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1)
    const rgba = c.match(/^rgba\(([^)]+)\)$/)
    return rgba ? parseFloat(rgba[1].split(',')[3]) : 1
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')

function download(blob, name) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

function svgImage(el, color) {
    const c = el.cloneNode(true)
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    c.style.color = color
    const src = new XMLSerializer().serializeToString(c)
    let img = svgCache.get(src)
    if (!img) {
        img = new Image()
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src)
        svgCache.set(src, img)
    }
    return img
}

// Backgrounds, borders, words and inline SVG of a subtree, in its own CSS px,
// placed exactly where the browser laid them out. origin and scale undo any
// screen offset or 2D scale on the way in.
function displayList(root, origin, scale = 1) {
    const items = [], range = document.createRange()
    const local = r => ({ x: (r.left - origin.x) / scale, y: (r.top - origin.y) / scale, w: r.width / scale, h: r.height / scale })

    const words = (node, cs, op) => {
        const font  = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
        const ls    = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
        const upper = cs.textTransform === 'uppercase'
        measure.font = font
        const re = /\S+/g
        let m
        while ((m = re.exec(node.textContent))) {
            range.setStart(node, m.index)
            range.setEnd(node, m.index + m[0].length)
            const rr = range.getClientRects()[0]
            if (!rr) continue
            const r = local(rr), text = upper ? m[0].toUpperCase() : m[0]
            const asc = measure.measureText(text).fontBoundingBoxAscent ?? r.h * 0.8
            items.push({ t: 'text', x: r.x, y: r.y + asc, text, font, ls, color: cs.color, op })
        }
    }

    const walk = (el, op) => {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden') return
        op *= parseFloat(cs.opacity)
        if (op < 0.004) return
        const r = local(el.getBoundingClientRect())
        if (alphaOf(cs.backgroundColor) > 0) items.push({ t: 'rect', ...r, color: cs.backgroundColor, op })
        for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
            const bw = parseFloat(cs[`border${side}Width`])
            const bc = cs[`border${side}Color`]
            if (!bw || cs[`border${side}Style`] === 'none' || !alphaOf(bc)) continue
            items.push({
                t: 'rect', color: bc, op,
                x: side === 'Right' ? r.x + r.w - bw : r.x,
                y: side === 'Bottom' ? r.y + r.h - bw : r.y,
                w: side === 'Top' || side === 'Bottom' ? r.w : bw,
                h: side === 'Left' || side === 'Right' ? r.h : bw,
            })
        }
        if (el instanceof SVGSVGElement) {
            items.push({ t: 'svg', ...r, img: svgImage(el, cs.color), op })
            return
        }
        for (const n of el.childNodes) {
            if (n.nodeType === Node.ELEMENT_NODE) walk(n, op)
            else if (n.nodeType === Node.TEXT_NODE) words(n, cs, op)
        }
    }

    walk(root, 1)
    return items
}

function drawList(ctx, list, alpha = 1) {
    for (const it of list) {
        ctx.globalAlpha = alpha * it.op
        if (it.t === 'text') {
            ctx.font = it.font
            ctx.letterSpacing = it.ls
            ctx.fillStyle = it.color
            ctx.fillText(it.text, it.x, it.y)
        } else if (it.t === 'rect') {
            ctx.fillStyle = it.color
            ctx.fillRect(it.x, it.y, it.w, it.h)
        } else if (it.img.complete && it.img.naturalWidth) {
            ctx.drawImage(it.img, it.x, it.y, it.w, it.h)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
export class Exporter {
    constructor(app) {
        this.app    = app
        this.canvas = document.createElement('canvas')
        this.ctx    = this.canvas.getContext('2d')
        this.host   = document.querySelector('.export-host')
        this.labels = new Map()
        this.rec    = null
        this.still  = false
        this.invalidate()
    }

    get active() { return !!this.rec || this.still }

    invalidate() {
        this.hud = this.title = this.key = null
    }

    // ── Display lists ─────────────────────────────────────────────────────────
    _clone(src) {
        const c = src.cloneNode(true)
        c.style.cssText = 'position: absolute; left: 0; top: 0'
        this.host.replaceChildren(c)
        const o = c.getBoundingClientRect()
        const out = { list: displayList(c, { x: o.left, y: o.top }), w: o.width, h: o.height }
        this.host.replaceChildren()
        return out
    }

    _labelList(l) {
        const key = `${this.app.themeVersion}|${l.el.innerHTML}`
        let e = this.labels.get(l)
        if (!e || e.key !== key) {
            e = { key, ...this._clone(l.root) }
            this.labels.set(l, e)
        }
        return e
    }

    _keyList() {
        const key = `${this.app.themeVersion}|${this.app.keyVersion}`
        if (!this.key || this.key.key !== key) this.key = { key, ...this._clone(this.app.keyEl) }
        return this.key
    }

    _overlay(name, el) {
        const app = this.app
        if (this[name] && (name !== 'hud' || !app.hudDirty)) return this[name]
        const st = app.$stage.getBoundingClientRect()
        this[name] = displayList(el, { x: st.left, y: st.top }, app.view.s)
        if (name === 'hud') app.hudDirty = false
        return this[name]
    }

    // the affine an orthographic camera gives a CSS3D plane; false if edge-on
    // or seen from behind (labels hide their back faces)
    _affine(ctx, obj, k) {
        const { camera, view } = this.app
        const P = (x, y) => {
            v3.set(x, -y, 0).applyMatrix4(obj.matrixWorld).project(camera)
            return [(v3.x + 1) / 2 * view.w, (1 - v3.y) / 2 * view.h]
        }
        const [ex, ey] = P(0, 0), [xx, xy] = P(1, 0), [yx, yy] = P(0, 1)
        const a = xx - ex, b = xy - ey, c = yx - ex, d = yy - ey
        if (a * d - b * c <= 1e-9) return false
        ctx.setTransform(k * a, k * b, k * c, k * d, k * ex, k * ey)
        return true
    }

    // ── Composite ─────────────────────────────────────────────────────────────
    composite() {
        const app = this.app, p = app.params
        const [W, H] = app.exportSize, { w, h } = app.view, k = W / w
        if (this.canvas.width !== W || this.canvas.height !== H) {
            this.canvas.width = W
            this.canvas.height = H
            this.pattern = null
        }
        const ctx = this.ctx
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.fillStyle = app.palette.ground
        ctx.fillRect(0, 0, W, H)
        ctx.drawImage(app.guidance.canvas, 0, 0, W, H)
        ctx.drawImage(app.renderer.domElement, 0, 0, W, H)

        if (p.showLabels) {
            for (const l of app.labels) {
                if (!l.obj.visible || l.op <= 0.01) continue
                if (this._affine(ctx, l.obj, k)) drawList(ctx, this._labelList(l).list, l.op)
            }
            if (app.keyObj.visible) {
                const K = this._keyList()
                if (this._affine(ctx, app.keyObj, k)) {
                    ctx.translate(-K.w / 2, -K.h / 2)      // CSS3D centres the element on its object
                    drawList(ctx, K.list)
                }
            }
        }

        ctx.setTransform(k, 0, 0, k, 0, 0)
        drawList(ctx, this._overlay('title', app.$title))
        drawList(ctx, this._overlay('hud', app.$hud))

        if (p.grain > 0) {
            this.pattern ??= ctx.createPattern(app.guidance.tile, 'repeat')
            ctx.setTransform(k, 0, 0, k, -Math.random() * 256 * k, -Math.random() * 256 * k)
            ctx.globalAlpha = p.grain
            ctx.fillStyle = this.pattern
            ctx.fillRect(0, 0, w + 256, h + 256)
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
    }

    // ── Still ─────────────────────────────────────────────────────────────────
    saveStill() { this.still = true }

    // ── Clip ──────────────────────────────────────────────────────────────────
    record() {
        if (this.rec) return this.stop()
        const app = this.app, p = app.params
        const mime = MIMES.find(m => window.MediaRecorder?.isTypeSupported(m))
        if (!mime || !this.canvas.captureStream) {
            app.status('this browser cannot record video — try Chrome')
            return
        }
        const [W, H] = app.exportSize
        if (p.restart) app.restartJourney()
        const journey = p.clip === 'journey'
        const seconds = journey ? app.journeySeconds() : Number(p.clip)
        if (p.camMove) app.playMove(seconds)

        this.composite()
        const stream = this.canvas.captureStream(Number(p.fps))
        const rec = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: Math.min(40e6, Math.round(W * H * Number(p.fps) * 0.3)),
        })
        const chunks = []
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
        rec.onstop = () => {
            const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
            download(new Blob(chunks, { type: mime.split(';')[0] }), `distance-travelled-4x5-${W}x${H}-${stamp()}.${ext}`)
            stream.getTracks().forEach(t => t.stop())
            app.status(`saved ${ext} · ${W} × ${H}${ext === 'webm' ? ' · convert to MP4 for Instagram' : ''}`)
        }
        rec.start(500)
        this.rec = { rec, t0: performance.now(), seconds, journey, shown: -1 }
        app.onRecordStart()
    }

    stop() {
        if (!this.rec) return
        this.rec.rec.stop()
        this.rec = null
        this.app.onRecordStop()
    }

    // after each render: composite whatever is being exported
    afterRender() {
        if (this.still) {
            this.still = false
            this.composite()
            const [W, H] = this.app.exportSize
            this.canvas.toBlob(b => download(b, `distance-travelled-4x5-${W}x${H}-${stamp()}.png`), 'image/png')
            this.app.status(`saved still · ${W} × ${H}`)
        }
        if (!this.rec) return
        this.composite()
        const app = this.app, r = this.rec
        const t = (performance.now() - r.t0) / 1000
        if (Math.floor(t * 4) !== r.shown) {
            r.shown = Math.floor(t * 4)
            app.status(`● recording ${t.toFixed(1)} / ${r.seconds.toFixed(1)} s`)
        }
        const arrived = app.params.travelled >= app.totalKm && app.hold > 1
        if ((r.journey && (arrived || t > r.seconds + 5)) || (!r.journey && t >= r.seconds)) this.stop()
    }
}
