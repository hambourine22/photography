// ─── SIMULATED CONTACTS ──────────────────────────────────────────────────────
// The detector's contacts are generated for the animation, not logged: a seeded
// plan of passes, each triggered when the odometer reaches its km. Every pass
// is a straight track through the vehicle's frame (heading up) with a miss
// distance, so range closes, bottoms out and opens again. Nothing here models
// a real detector; it drives the instrument's read.

export const BANDS = [
    { label: '900 МГц' },
    { label: '1,2 ГГц' },
    { label: '2,4 ГГц' },
    { label: '5,8 ГГц' },
]

// type · band index · nominal speed range (m/s)
const KINDS = [
    { type: 'FPV',                 band: 3, speed: [28, 46] },
    { type: 'розвідка · recon',    band: 2, speed: [12, 22] },
    { type: 'далекий · long-range', band: 0, speed: [34, 52] },
    { type: 'ретранслятор · relay', band: 1, speed: [12, 18] },
]

// mulberry32 · small, fast, and the same plan every time for a given seed
function rng(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6D2B79F5) >>> 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export class Contacts {
    constructor() {
        this.events   = []
        this.active   = []
        this.register = []
        this.lastKm   = null
    }

    // spread `count` passes over [fromKm, toKm], one per slot with jitter
    plan(seed, count, fromKm, toKm) {
        const r = rng(seed), span = toKm - fromKm - 55
        this.events = Array.from({ length: count }, (_, i) => {
            const kind = r() < 0.5 ? 0 : Math.floor(r() * KINDS.length)
            const k = KINDS[kind]
            return {
                id      : `Д${String(i + 1).padStart(2, '0')}`,
                km      : fromKm + 30 + span * (i + 0.2 + r() * 0.6) / Math.max(1, count),
                kind,
                band    : k.band,
                type    : k.type,
                bearing : r() * 360,
                miss    : 0.25 + r() * 1.4,
                side    : r() < 0.5 ? -1 : 1,
                speed   : k.speed[0] + r() * (k.speed[1] - k.speed[0]),
            }
        }).sort((a, b) => a.km - b.km)
        this.register = []
        this.reset(fromKm)
    }

    // back to a km: passes beyond it are pending again, none is in the air
    reset(km) {
        this.active = []
        this.register = this.register.filter(e => e.km <= km)
        this.events.forEach(e => { e.fired = e.km <= km && this.register.some(r => r.id === e.id) })
        this.lastKm = km
    }

    // dt in seconds; timeScale = simulated seconds per animation second
    update(dt, km, rangeKm, alertKm, timeScale) {
        if (this.lastKm !== null && km < this.lastKm - 0.5) this.reset(km)
        this.lastKm = km

        for (const e of this.events) {
            if (e.fired || e.km > km) continue
            e.fired = true
            const r0 = rangeKm * 1.06
            const sx = Math.sin(e.bearing * Math.PI / 180) * r0, sy = Math.cos(e.bearing * Math.PI / 180) * r0
            const off = e.side * Math.asin(Math.min(0.95, e.miss / r0))
            const ux = -sx / r0, uy = -sy / r0
            const c = Math.cos(off), s = Math.sin(off)
            const entry = { id: e.id, km, band: e.band, type: e.type, min: r0, alerted: false, closed: false }
            this.register.unshift(entry)
            this.active.push({
                e, entry, x: sx, y: sy,
                vx: (ux * c - uy * s), vy: (ux * s + uy * c),     // unit direction
                travelled: 0, chord: 2 * Math.sqrt(Math.max(0, r0 * r0 - e.miss * e.miss)),
                trail: [],
            })
        }

        for (const a of this.active) {
            const step = a.e.speed / 1000 * dt * timeScale            // km this frame
            a.travelled += step
            a.x += a.vx * step
            a.y += a.vy * step
            a.range = Math.hypot(a.x, a.y)
            a.bearing = (Math.atan2(a.x, a.y) * 180 / Math.PI + 360) % 360
            a.signal = 1 / (1 + (a.range / 0.9) ** 2)
            a.trail.push([a.x, a.y])
            if (a.trail.length > 36) a.trail.shift()
            if (a.range <= rangeKm) a.entry.min = Math.min(a.entry.min, a.range)
            if (a.range < alertKm) a.entry.alerted = true
        }
        for (const a of this.active) if (a.travelled >= a.chord) a.entry.closed = true
        this.active = this.active.filter(a => a.travelled < a.chord)

        const seen  = this.active.filter(a => a.range <= rangeKm)
        const alert = seen.some(a => a.range < alertKm)
        return { seen, alert, state: alert ? 'alert' : seen.length ? 'contact' : 'clear' }
    }
}
