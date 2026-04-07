import * as THREE from 'three'
import GUI from 'lil-gui'
import vertexShader from './shaders/vertex.glsl?raw'
import fragmentShader from './shaders/fragment.glsl?raw'

// ============================================================
// CONFIG — adjust these without touching the rest of the file
// ============================================================

// Show GUI controls and top-left nav only in local dev (npm run dev).
// Vercel production builds will hide both. Set to `true` to force-show.
const SHOW_DEV_UI = import.meta.env.DEV

// Responsive ribbon count by viewport width.
// Listed largest → smallest. First match wins.
const RIBBON_BREAKPOINTS = [
    { minWidth: 1920, ribbons: 22 }, // large desktop
    { minWidth: 1280, ribbons: 18 }, // desktop
    { minWidth: 768,  ribbons: 12 }, // tablet
    { minWidth: 480,  ribbons: 8  }, // large mobile
    { minWidth: 0,    ribbons: 4  }, // iPhone 14 and smaller
]

// iOS-safe viewport width detection.
// window.innerWidth lies on iOS Safari (especially in iframes) — it can return
// the layout viewport (e.g. 980px) instead of the actual visible width.
const getViewportWidth = () => {
    // Prefer visualViewport (most accurate on iOS Safari, accounts for zoom and address bar)
    if (window.visualViewport && window.visualViewport.width) {
        return window.visualViewport.width
    }
    // Fall back to documentElement.clientWidth (more reliable than window.innerWidth on iOS)
    return document.documentElement.clientWidth || window.innerWidth
}

const getRibbonCount = () => {
    const w = getViewportWidth()
    for (const bp of RIBBON_BREAKPOINTS) {
        if (w >= bp.minWidth) return bp.ribbons
    }
    return RIBBON_BREAKPOINTS[RIBBON_BREAKPOINTS.length - 1].ribbons
}

// ============================================================
// Hide top-left nav in production
// ============================================================

if (!SHOW_DEV_UI) {
    const nav = document.querySelector('nav')
    if (nav) nav.style.display = 'none'
}

// ============================================================
// WebGL setup
// ============================================================

const canvas = document.querySelector('canvas.webgl')

let renderer
try {
    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: 'default'
    })
} catch (err) {
    console.warn('WebGL unavailable — keeping fallback image:', err)
}

if (renderer) {
    const scene = new THREE.Scene()

    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const getSize = () => {
        const wrap = canvas.parentElement
        return {
            width: wrap ? wrap.clientWidth : window.innerWidth,
            height: wrap ? wrap.clientHeight : window.innerHeight
        }
    }

    const initialSize = getSize()
    renderer.setSize(initialSize.width, initialSize.height, false)

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const debugObject = {
        refraction: 0.18,
        grainScale: 16.0,
        speed: 1.29,
        lineWidth: getRibbonCount(),
        colorPink: '#f72e62',
        colorBlue: '#201fff'
    }

    const uniforms = {
        uTime: { value: 0 },
        uRefraction: { value: debugObject.refraction },
        uGrainScale: { value: debugObject.grainScale },
        uSpeed: { value: debugObject.speed },
        uLineWidth: { value: debugObject.lineWidth },
        uColorPink: { value: new THREE.Color(debugObject.colorPink) },
        uColorBlue: { value: new THREE.Color(debugObject.colorBlue) },
    }

    // ============================================================
    // GUI — dev only
    // ============================================================

    let lineWidthController = null

    if (SHOW_DEV_UI) {
        const gui = new GUI({ title: 'Perceptual Patterns' })

        const glassFolder = gui.addFolder('Glass & Grain')
        glassFolder.add(debugObject, 'refraction', 0, 0.5, 0.001).name('Refraction').onChange(v => uniforms.uRefraction.value = v)
        lineWidthController = glassFolder.add(debugObject, 'lineWidth', 1, 30, 1).name('Ribbon Count (auto)').onChange(v => uniforms.uLineWidth.value = v)
        glassFolder.add(debugObject, 'grainScale', 1, 50, 0.1).name('Grain Scale').onChange(v => uniforms.uGrainScale.value = v)

        const colorFolder = gui.addFolder('HUX Pattern')
        colorFolder.addColor(debugObject, 'colorPink').name('HUX Pink').onChange(v => uniforms.uColorPink.value.set(v))
        colorFolder.addColor(debugObject, 'colorBlue').name('HUX Blue').onChange(v => uniforms.uColorBlue.value.set(v))
        colorFolder.add(debugObject, 'speed', 0, 3, 0.001).name('Motion Speed').onChange(v => uniforms.uSpeed.value = v)
    }

    // ============================================================
    // Mesh
    // ============================================================

    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1)
    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // ============================================================
    // Render loop
    // ============================================================

    let lastTime = performance.now()
    let firstFrameRendered = false

    const tick = () => {
        const delta = (performance.now() - lastTime) / 1000
        lastTime = performance.now()
        uniforms.uTime.value += delta
        renderer.render(scene, camera)

        if (!firstFrameRendered) {
            canvas.classList.add('ready')
            firstFrameRendered = true
        }

        window.requestAnimationFrame(tick)
    }

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        canvas.classList.remove('ready')
        firstFrameRendered = false
    })

    canvas.addEventListener('webglcontextrestored', () => {
        // Re-render resumes on next tick
    })

    // ============================================================
    // Recorder — desktop only, feature-detected
    // ============================================================

    const recorder = {
        chunks: [],
        stream: null,
        mediaRecorder: null,
        isRecording: false,
        init() {
            if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
                return
            }
            try {
                this.stream = canvas.captureStream(60)
                this.mediaRecorder = new MediaRecorder(this.stream, {
                    mimeType: 'video/webm; codecs=vp9',
                    videoBitsPerSecond: 10000000
                })
                this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data)
                this.mediaRecorder.onstop = () => this.exportVideo()
                window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'r') this.toggle() })
            } catch (err) {
                console.warn('Recorder unavailable:', err)
            }
        },
        toggle() {
            if (!this.mediaRecorder) return
            if (!this.isRecording) {
                const DURATION = Math.round(2 * Math.PI * 1000)
                this.chunks = []
                this.mediaRecorder.start()
                this.isRecording = true
                console.log('🔴 Recording...')
                setTimeout(() => this.toggle(), DURATION)
            } else {
                this.mediaRecorder.stop()
                this.isRecording = false
            }
        },
        exportVideo() {
            const blob = new Blob(this.chunks, { type: 'video/webm' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'perceptual-patterns.webm'
            a.click()
        }
    }

    recorder.init()
    tick()

    // ============================================================
    // Resize — handles canvas size AND responsive ribbon count
    // ============================================================

    const handleResize = () => {
        const { width, height } = getSize()
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(width, height, false)

        // Update ribbon count for current breakpoint
        const newRibbonCount = getRibbonCount()
        if (newRibbonCount !== debugObject.lineWidth) {
            debugObject.lineWidth = newRibbonCount
            uniforms.uLineWidth.value = newRibbonCount
            // Sync the GUI slider if it exists
            if (lineWidthController) lineWidthController.updateDisplay()
        }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    // iOS Safari: visualViewport fires more reliably than window.resize
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize)
    }

    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
        const ro = new ResizeObserver(handleResize)
        ro.observe(canvas.parentElement)
    }
}