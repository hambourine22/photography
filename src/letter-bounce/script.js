import * as THREE from 'three'

// ── TUNING ────────────────────────────────────────────────────────────────────
// FRUSTUM controls the height of the visible world in units.
// Every letter's size below is defined in the same units.
// e.g. FRUSTUM = 10 → the camera shows 10 units of world height.
const FRUSTUM = 10

// Speed range in world-units per second.
// Raise both values to make all letters move faster; lower to slow them down.
const SPEED_MIN = 1.2
const SPEED_MAX = 2.8

// Rotational speed cap in radians per second.
// Raise to allow faster spinning; lower for a more composed look.
const SPIN_MAX = 0.45

// ── LETTER MANIFEST ───────────────────────────────────────────────────────────
// `file`  — filename inside public/assets/
// `size`  — height of the letter in world units (width is corrected automatically
//            once the texture loads and the real image aspect ratio is known).
//            Capital letters ≈ 1.8, lowercase ≈ 1.1, dots ≈ 0.55.
const LETTERS = [
    { file: 'O_1.png',     size: 1.8 },
    { file: 'T.png',       size: 1.8 },
    { file: 'O_2.png',     size: 1.8 },
    { file: 'D.png',       size: 1.8 },
    { file: 'R.png',       size: 1.8 },
    { file: 'o_small.png', size: 1.1 },
    { file: 'dot_1.png',   size: 0.55 },
    { file: 'dot_2.png',   size: 0.55 },
    { file: 'U.png',       size: 1.8 },
]

// ── BASE SETUP ────────────────────────────────────────────────────────────────
const canvas = document.querySelector('canvas.webgl')
const scene  = new THREE.Scene()
scene.background = new THREE.Color('#7D5556')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// ── ORTHOGRAPHIC CAMERA ───────────────────────────────────────────────────────
// The camera is kept at a fixed world height (FRUSTUM units).
// Width scales with the browser aspect ratio so letters always stay in frame.
//
// Bounding-box maths:
//   cameraHalfH = FRUSTUM / 2                     (fixed)
//   cameraHalfW = FRUSTUM * aspect / 2             (scales on resize)
//
// A letter at (x, y) hits the RIGHT wall when:
//   x + letter.halfW >= cameraHalfW
// It hits the LEFT wall when:
//   x - letter.halfW <= -cameraHalfW
// (same logic on y for TOP / BOTTOM)
let aspect = window.innerWidth / window.innerHeight

const camera = new THREE.OrthographicCamera(
    -FRUSTUM * aspect / 2,  // left
     FRUSTUM * aspect / 2,  // right
     FRUSTUM / 2,           // top
    -FRUSTUM / 2,           // bottom
    0.1,
    100
)
camera.position.z = 10
scene.add(camera)

// ── LETTER OBJECTS ────────────────────────────────────────────────────────────
const loader = new THREE.TextureLoader()

/**
 * letterStates — one entry per letter mesh.
 * @type {Array<{
 *   mesh: THREE.Mesh,
 *   vx: number,    // x velocity (world-units/s)
 *   vy: number,    // y velocity (world-units/s)
 *   spin: number,  // z rotation speed (radians/s)
 *   halfW: number, // half-width of the letter (for collision)
 *   halfH: number, // half-height of the letter (for collision)
 * }>}
 */
const letterStates = []

LETTERS.forEach(({ file, size }) => {
    // PlaneGeometry (1×1) — actual visual size is controlled via mesh.scale.
    // This lets us correct the aspect ratio asynchronously when the image loads
    // without having to rebuild the geometry.
    const geometry = new THREE.PlaneGeometry(1, 1)
    const texture  = new THREE.Texture()

    const material = new THREE.MeshBasicMaterial({
        map        : texture,
        transparent: true,
        depthWrite : false,     // prevents z-fighting between overlapping letters
        alphaTest  : 0.02,      // discard near-transparent pixels for clean edges
    })

    const mesh = new THREE.Mesh(geometry, material)

    // Scatter letters randomly within the visible area.
    // We use ±(halfCamera − halfLetter) so no letter starts clipped.
    const cameraHalfW = (FRUSTUM * aspect) / 2
    const cameraHalfH = FRUSTUM / 2
    mesh.position.set(
        (Math.random() - 0.5) * (cameraHalfW - size) * 2,
        (Math.random() - 0.5) * (cameraHalfH - size) * 2,
        0
    )

    // Random direction (full 360°) at a random speed within the tuned range.
    const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN)
    const angle = Math.random() * Math.PI * 2
    const vx    = Math.cos(angle) * speed
    const vy    = Math.sin(angle) * speed

    // Slow, organic rotation — randomly CW or CCW.
    const spin = (Math.random() - 0.5) * 2 * SPIN_MAX

    scene.add(mesh)

    // State object — halfW / halfH are initially approximated as square
    // and corrected once the real image dimensions are known.
    const state = {
        mesh,
        vx,
        vy,
        spin,
        halfW: size / 2,
        halfH: size / 2,
    }
    letterStates.push(state)

    // Load the PNG and apply it.
    // The onLoad callback fires once the browser has decoded the image, giving
    // us access to its real width/height so we can correct the mesh proportions.
    loader.load(
        `/assets/${file}`,
        (loadedTexture) => {
            loadedTexture.colorSpace = THREE.SRGBColorSpace

            // Correct the mesh's x-scale for the real image aspect ratio.
            // The height stays `size` world units; width adjusts proportionally.
            const imgAspect = loadedTexture.image.width / loadedTexture.image.height
            mesh.scale.set(size * imgAspect, size, 1)

            // Update collision half-extents with the corrected dimensions.
            state.halfW = (size * imgAspect) / 2
            state.halfH = size / 2

            // Swap in the loaded texture and signal Three.js to upload it.
            material.map         = loadedTexture
            loadedTexture.needsUpdate = true
            material.needsUpdate = true
        },
        undefined,  // onProgress — not needed
        (err) => {
            // Log missing assets clearly so the poster is easy to debug.
            console.warn(`[letter-bounce] Could not load /assets/${file}`, err)
        }
    )
})

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
let lastTime = performance.now()

const tick = () => {
    const now   = performance.now()
    const delta = Math.min((now - lastTime) / 1000, 0.05)  // cap delta (tab-background safety)
    lastTime = now

    // Live camera half-extents — recalculated each frame so they always
    // reflect the current window size after a resize event.
    const cameraHalfW = (FRUSTUM * aspect) / 2
    const cameraHalfH = FRUSTUM / 2

    letterStates.forEach((s) => {
        const { mesh } = s

        // Integrate position
        mesh.position.x += s.vx   * delta
        mesh.position.y += s.vy   * delta
        mesh.rotation.z += s.spin * delta

        // ── BOUNDING-BOX COLLISION ─────────────────────────────────────────
        // The letter's edges in world space:
        //   right  edge = x + halfW
        //   left   edge = x - halfW   (etc. for y)
        //
        // When an edge crosses the camera boundary, clamp the position back
        // and negate the relevant velocity component (elastic reflection).
        //
        // To tighten or loosen the bounce zone, adjust the cameraHalf* values
        // here — e.g. multiply by 0.9 to keep letters 10% away from the edge.

        const rightBound  =  cameraHalfW - s.halfW
        const leftBound   = -cameraHalfW + s.halfW
        const topBound    =  cameraHalfH - s.halfH
        const bottomBound = -cameraHalfH + s.halfH

        if (mesh.position.x > rightBound) {
            mesh.position.x = rightBound
            s.vx *= -1
        }
        if (mesh.position.x < leftBound) {
            mesh.position.x = leftBound
            s.vx *= -1
        }
        if (mesh.position.y > topBound) {
            mesh.position.y = topBound
            s.vy *= -1
        }
        if (mesh.position.y < bottomBound) {
            mesh.position.y = bottomBound
            s.vy *= -1
        }
    })

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()

// ── RESIZE ────────────────────────────────────────────────────────────────────
// The camera height (FRUSTUM) is fixed; only the width changes.
// Updating left/right keeps the world-space bounding box in sync with
// the letter physics without re-scattering or resetting velocities.
window.addEventListener('resize', () => {
    aspect = window.innerWidth / window.innerHeight

    camera.left  = -FRUSTUM * aspect / 2
    camera.right =  FRUSTUM * aspect / 2
    camera.updateProjectionMatrix()

    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
