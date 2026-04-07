import * as THREE from 'three'
import initPaperFold from './PaperFold.js'

// ── BAKED CAMERA SETTINGS ─────────────────────────────────────────────────────
const CAM_Y_START =  3.5
const CAM_Y_END   = -2.5
const CAM_Z       =  11.0
const FOV         =  32
const CAM_LERP    =  0.05

// ── BASE SETUP ────────────────────────────────────────────────────────────────
const canvas = document.querySelector('canvas.webgl')
const scene  = new THREE.Scene()

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias           : true,
    alpha               : true,
    preserveDrawingBuffer: true
})
renderer.setClearColor(0x000000, 0)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// ── CAMERA ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, CAM_Y_START, CAM_Z)
camera.lookAt(0, 0, 0)

// ── SCENE ─────────────────────────────────────────────────────────────────────
const paperData = initPaperFold(scene)

// ── SCROLL → CAMERA ───────────────────────────────────────────────────────────
let targetCamY  = CAM_Y_START
let currentCamY = CAM_Y_START

// ── POSTMESSAGE SCROLL (iframe embedding) ─────────────────────────────────────
window.addEventListener('message', (e) => {
    if (e.data?.type === 'scroll') {
        const t = Math.min(Math.max(e.data.progress, 0), 1)
        targetCamY = CAM_Y_START + (CAM_Y_END - CAM_Y_START) * t
    }
})

// ── RECORDING (R key → 30-second VP9 capture) ─────────────────────────────────
let isRecording = false
let mediaRecorder
const chunks = []

const startRecording = () => {
    console.log('Started recording...')
    isRecording = true
    const stream = canvas.captureStream(60)
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = 'hux-paper-fold-export.webm'
        a.click()
        chunks.length = 0
        isRecording   = false
        console.log('Recording saved.')
    }
    mediaRecorder.start()
    setTimeout(() => mediaRecorder.stop(), 30000)
}

window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && !isRecording) startRecording()
})

// ── ANIMATION LOOP ────────────────────────────────────────────────────────────
let lastTime = performance.now()

const tick = () => {
    const now   = performance.now()
    const delta = (now - lastTime) / 1000
    lastTime    = now

    currentCamY += (targetCamY - currentCamY) * CAM_LERP
    camera.position.set(0, currentCamY, CAM_Z)
    camera.lookAt(0, 0, 0)

    paperData.update(delta)
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()

// ── RESIZE ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})
