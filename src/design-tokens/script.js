import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

import initDesignTokens from './DesignTokens.js'
import { theme } from '../tokens.js'

/**
 * Base Setup
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
scene.background = new THREE.Color(theme.background)

const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    preserveDrawingBuffer: true 
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

/**
 * Camera
 */
const FRUSTUM = 10
let asp = window.innerWidth / window.innerHeight
const camera = new THREE.OrthographicCamera(
    -FRUSTUM * asp / 2, FRUSTUM * asp / 2,
     FRUSTUM / 2,      -FRUSTUM / 2,
    0.1, 1000
)
camera.position.set(10, 10, 10)
camera.lookAt(0, 0, 0)
scene.add(camera)

const { update } = initDesignTokens(scene)

/**
 * Post Processing
 */
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new OutputPass())

/**
 * Export Tools (Keyboard Shortcuts)
 */
const exportTools = {
    // 4K PNG Export (Key: 'E')
    png: () => {
        const width = 3840
        const height = 2160
        renderer.setSize(width, height)
        camera.left = -FRUSTUM * (width / height) / 2
        camera.right = FRUSTUM * (width / height) / 2
        camera.updateProjectionMatrix()
        
        renderer.render(scene, camera)
        const link = document.createElement('a')
        link.download = 'hux-design-tokens-4k.png'
        link.href = canvas.toDataURL('image/png')
        link.click()
        
        // Restore
        const originalAsp = window.innerWidth / window.innerHeight
        renderer.setSize(window.innerWidth, window.innerHeight)
        camera.left = -FRUSTUM * originalAsp / 2
        camera.right = FRUSTUM * originalAsp / 2
        camera.updateProjectionMatrix()
    },

    // Video Recording (Key: 'R')
    recorder: {
        chunks: [],
        stream: canvas.captureStream(60),
        mediaRecorder: null,
        isRecording: false,
        init() {
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'video/webm; codecs=vp9',
                videoBitsPerSecond: 8000000 
            })
            this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data)
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'hux-design-tokens.webm'
                a.click()
                this.chunks = []
            }
        },
        toggle() {
            if (this.isRecording) return
            this.isRecording = true
            this.mediaRecorder.start()
            console.log("Recording...")
            setTimeout(() => {
                this.mediaRecorder.stop()
                this.isRecording = false
                console.log("Saved.")
            }, 6283) // One perfect loop
        }
    }
}

exportTools.recorder.init()

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') exportTools.png()
    if (e.key.toLowerCase() === 'r') exportTools.recorder.toggle()
})

/**
 * Animate
 */
let lastTime = performance.now()
const tick = () => {
    const now = performance.now()
    const delta = (now - lastTime) / 1000
    lastTime = now
    update(delta)
    composer.render()
    window.requestAnimationFrame(tick)
}
tick()

window.addEventListener('resize', () => {
    asp = window.innerWidth / window.innerHeight
    camera.left  = -FRUSTUM * asp / 2
    camera.right =  FRUSTUM * asp / 2
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
})