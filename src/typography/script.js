import * as THREE from 'three'
import initTypography from './Typography.js'

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
scene.background = new THREE.Color('#201fff')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 15)
scene.add(camera)

let typography = null
initTypography(scene, (data) => {
    typography = data
})

/**
 * Keyboard Shortcuts
 */
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') {
        const link = document.createElement('a')
        link.download = 'hux-h-4k.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
    }
})

const tick = () => {
    if (typography) typography.update(performance.now())
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
})
