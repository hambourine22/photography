import * as THREE from 'three'
import GUI from 'lil-gui'

// ── All values baked in — no tokens.js dependency ─────────────────────────────
const PARAMS = {
    background   : '#201fff',
    weight       : 0.0,
    playing      : true,
    speed        : 0.4,
    letter       : 'H',
}

const EXTRUDE_DEPTH = 1.5

// ── Shape definitions ─────────────────────────────────────────────────────────
// Each letter is a single continuous perimeter path (moveTo → lineTo → close).
// No holes, no internal seams — crossbars and joins are part of the outer contour.
// Proportions: stems ~1.5 wide, total height ~5, blocky monumental feel.

function createH() {
    const shape = new THREE.Shape()
    // Trace the H as one continuous outline:
    // left stem up → across crossbar top → right stem up → across top →
    // right stem down → across crossbar bottom → left stem down → close
    shape.moveTo(0, 0)
    shape.lineTo(1.5, 0)
    shape.lineTo(1.5, 1.75)
    shape.lineTo(3.5, 1.75)
    shape.lineTo(3.5, 0)
    shape.lineTo(5, 0)
    shape.lineTo(5, 5)
    shape.lineTo(3.5, 5)
    shape.lineTo(3.5, 3.25)
    shape.lineTo(1.5, 3.25)
    shape.lineTo(1.5, 5)
    shape.lineTo(0, 5)
    shape.lineTo(0, 0)
    return shape
}

function createU() {
    const shape = new THREE.Shape()
    // Squared-off U: bottom slab connects two vertical stems, open at top
    shape.moveTo(0, 0)
    shape.lineTo(5, 0)
    shape.lineTo(5, 5)
    shape.lineTo(3.5, 5)
    shape.lineTo(3.5, 1.5)
    shape.lineTo(1.5, 1.5)
    shape.lineTo(1.5, 5)
    shape.lineTo(0, 5)
    shape.lineTo(0, 0)
    return shape
}

function createX() {
    const shape = new THREE.Shape()
    // Blocky X with thick diagonal arms
    // s = half-width of arm at the bounding box edge
    // c = half-width of arm at center crossing
    const s = 1.2
    const c = 0.75
    shape.moveTo(0, s)
    shape.lineTo(2.5 - c, 2.5)
    shape.lineTo(0, 5 - s)
    shape.lineTo(s, 5)
    shape.lineTo(2.5, 2.5 + c)
    shape.lineTo(5 - s, 5)
    shape.lineTo(5, 5 - s)
    shape.lineTo(2.5 + c, 2.5)
    shape.lineTo(5, s)
    shape.lineTo(5 - s, 0)
    shape.lineTo(2.5, 2.5 - c)
    shape.lineTo(s, 0)
    shape.lineTo(0, s)
    return shape
}

const SHAPES = { H: createH, U: createU, X: createX }

// ── ShaderMaterial — normal-based flat colouring (no lights needed) ────────────
const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const fragmentShader = /* glsl */ `
    varying vec3 vNormal;
    void main() {
        vec3 n = normalize(vNormal);
        float brightness;
        if (abs(n.z) > 0.5) {
            brightness = 1.0;   // front / back faces — full white
        } else if (abs(n.y) > 0.5) {
            brightness = 0.85;  // top / bottom edges
        } else {
            brightness = 0.70;  // side edges — reads as depth
        }
        gl_FragColor = vec4(vec3(brightness), 1.0);
    }
`

// ── Build geometry from a letter shape ────────────────────────────────────────
function buildGeometry(letter) {
    const shapeFn = SHAPES[letter]
    if (!shapeFn) return null
    const shape = shapeFn()
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: EXTRUDE_DEPTH,
        bevelEnabled: false,
    })
    geometry.center()
    return geometry
}

// ── Recording helper ───────────────────────────────────────────────────────────
function startRecording(threeCanvas) {
    const stream   = threeCanvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks   = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = 'hux-typography.webm'
        a.click()
        URL.revokeObjectURL(url)
    }
    recorder.start()
    setTimeout(() => recorder.stop(), 5000)
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function initTypography(scene, callback) {
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
    })

    let geometry = buildGeometry(PARAMS.letter)
    let mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // ── Swap letter ────────────────────────────────────────────────────────────
    function swapLetter(letter) {
        const newGeometry = buildGeometry(letter)
        if (!newGeometry) return
        mesh.geometry.dispose()
        mesh.geometry = newGeometry
    }

    // ── GUI ──────────────────────────────────────────────────────────────────
    const gui = new GUI({ title: 'HUX Typography' })
    gui.add(PARAMS, 'letter', ['H', 'U', 'X']).name('Letter').onChange(swapLetter)
    gui.add(PARAMS, 'weight', 0, 1, 0.001).name('Weight').listen()
    gui.add(PARAMS, 'playing').name('Play / Pause')
    gui.add(PARAMS, 'speed', 0.05, 3.0, 0.01).name('Speed')

    const threeCanvas = document.querySelector('canvas.webgl')
    const recObj = { record: () => startRecording(threeCanvas) }
    gui.add(recObj, 'record').name('Record 5s')

    // ── Animation state ───────────────────────────────────────────────────────
    let lastTime  = null
    let direction = 1  // 1 = getting heavier, -1 = getting lighter

    function update(now) {
        if (PARAMS.playing) {
            if (lastTime === null) lastTime = now
            const delta = (now - lastTime) / 1000   // seconds
            lastTime = now

            PARAMS.weight += delta * PARAMS.speed * 0.25 * direction
            if (PARAMS.weight >= 1) { PARAMS.weight = 1; direction = -1 }
            if (PARAMS.weight <= 0) { PARAMS.weight = 0; direction =  1 }
        } else {
            lastTime = now
        }

        // Weight drives a gentle Y-rotation to reveal the extruded depth
        mesh.rotation.y = Math.sin(PARAMS.weight * Math.PI) * 0.5
    }

    if (callback) callback({ mesh, update })
}
