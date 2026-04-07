import * as THREE from 'three'
import Patterns from './Patterns.js'

/**
 * HUX Patterns — Lattice
 * Isometric wireframe lattice with pulsing opacity.
 */

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
scene.background = new THREE.Color('#0D0D0D')

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

/**
 * Camera — Orthographic, true isometric angle.
 */
const FRUSTUM = 14
let asp = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
    -FRUSTUM * asp / 2, FRUSTUM * asp / 2,
     FRUSTUM / 2,      -FRUSTUM / 2,
    0.1, 1000
)
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)
scene.add(camera)

/**
 * Init lattice scene.
 */
const patterns = new Patterns()
patterns.init(scene)

/**
 * Animate
 */
let lastTime = performance.now()
const tick = () => {
    const now = performance.now()
    const delta = (now - lastTime) / 1000
    lastTime = now
    patterns.animate(delta)
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}
tick()

/**
 * Resize
 */
window.addEventListener('resize', () => {
    asp = window.innerWidth / window.innerHeight
    camera.left  = -FRUSTUM * asp / 2
    camera.right =  FRUSTUM * asp / 2
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
