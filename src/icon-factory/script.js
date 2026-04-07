import * as THREE from 'three'
import { GUI } from 'lil-gui'
import initIconFactory, { BAKED } from './IconFactory.js'

// ── ISOMETRIC CAMERA ──────────────────────────────────────────────────────────
// Frustum sized to comfortably frame the 10×10 factory floor
const FRUSTUM = 7

// ── BASE SETUP ────────────────────────────────────────────────────────────────
const canvas   = document.querySelector('canvas.webgl')
const scene    = new THREE.Scene()
scene.background = new THREE.Color(BAKED.colorBlue)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const aspect = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
    -FRUSTUM * aspect,  FRUSTUM * aspect,
     FRUSTUM,          -FRUSTUM,
    0.1, 200
)
// True isometric angle (arctan(1/√2) ≈ 35.264°)
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)

// ── LIGHTING ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.2))

// ── SCENE INIT ────────────────────────────────────────────────────────────────
const factory = initIconFactory(scene)

// ── GUI ───────────────────────────────────────────────────────────────────────
const gui = new GUI({ title: 'Icon Factory' })

const fGrid = gui.addFolder('Grid FX')
fGrid.add(factory.config, 'pulseIntensity', 0, 0.4).name('Pulse Intensity')
fGrid.add(factory.config, 'pulseSpeed',     0, 3.0).name('Pulse Speed')
fGrid.add(factory.config, 'scanlineFrequency', 10, 120).name('Scanlines')

const fFactory = gui.addFolder('Factory')
fFactory.add(factory.config, 'factorySpeed', 0, 4).name('Speed')
fFactory.add(factory.config, 'spawnRate',    0.3, 6).name('Spawn Rate (s)')

const exportObj = {
    export4K: () => {
        const W = 3840, H = 2160
        renderer.setSize(W, H)
        camera.left   = -FRUSTUM * (W / H)
        camera.right  =  FRUSTUM * (W / H)
        camera.updateProjectionMatrix()
        renderer.render(scene, camera)
        const link      = document.createElement('a')
        link.download   = 'hux-icon-factory-4k.png'
        link.href       = canvas.toDataURL('image/png')
        link.click()
        // Restore
        const a = window.innerWidth / window.innerHeight
        renderer.setSize(window.innerWidth, window.innerHeight)
        camera.left   = -FRUSTUM * a
        camera.right  =  FRUSTUM * a
        camera.updateProjectionMatrix()
    }
}
gui.add(exportObj, 'export4K').name('Export 4K PNG')

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
let lastTime = performance.now()

const tick = () => {
    const now   = performance.now()
    const delta = Math.min((now - lastTime) / 1000, 0.05)   // cap at 50ms
    lastTime    = now

    factory.update(delta)

    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()

// ── RESIZE ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    const a = window.innerWidth / window.innerHeight
    camera.left   = -FRUSTUM * a
    camera.right  =  FRUSTUM * a
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
