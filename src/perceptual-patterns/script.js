import * as THREE from 'three'
import vertexShader from './shaders/vertex.glsl?raw'
import fragmentShader from './shaders/fragment.glsl?raw'

const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })

renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

const uniforms = {
    uTime: { value: 0 },
    uRefraction: { value: 0.279 },
    uGrainScale: { value: 24.1 },
    uSpeed: { value: 0.492 },
    uLineWidth: { value: 30.0 },
    uColorPink: { value: new THREE.Color('#f72e62') },
    uColorBlue: { value: new THREE.Color('#201fff') },
}

const geometry = new THREE.PlaneGeometry(2, 2, 1, 1)
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

let lastTime = performance.now()
const tick = () => {
    const delta = (performance.now() - lastTime) / 1000
    lastTime = performance.now()
    uniforms.uTime.value += delta
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

const recorder = {
    chunks: [],
    stream: canvas.captureStream(60),
    mediaRecorder: null,
    isRecording: false,
    init() {
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: 10000000
        })
        this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data)
        this.mediaRecorder.onstop = () => this.exportVideo()
        window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'r') this.toggle() })
    },
    toggle() {
        if (!this.isRecording) {
            const DURATION = Math.round(2 * Math.PI * 1000)
            this.chunks = []; this.mediaRecorder.start(); this.isRecording = true
            console.log('🔴 Recording...'); setTimeout(() => this.toggle(), DURATION)
        } else {
            this.mediaRecorder.stop(); this.isRecording = false
        }
    },
    exportVideo() {
        const blob = new Blob(this.chunks, { type: 'video/webm' })
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
        a.download = 'perceptual-patterns.webm'; a.click()
    }
}

recorder.init()
tick()

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight)
})
