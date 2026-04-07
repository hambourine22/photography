import * as THREE from 'three'
import GUI from 'lil-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass }     from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass }     from 'three/examples/jsm/postprocessing/OutputPass.js'

// ── HUX Design Tokens ─────────────────────────────────────────────────────────
const HEX_BLUE = '#201fff'
const HEX_PINK = '#ff2d78'

// ── Grid constants ─────────────────────────────────────────────────────────────
const COLS          = 13
const ROWS          = 15
const W             = 1.0
const H             = W * Math.sqrt(3) / 2   // ≈ 0.866
const LOOP_DURATION = Math.PI * 2            // seconds (6283 ms)

// ── Shaders ───────────────────────────────────────────────────────────────────
// Triangles never rotate. Instead a travelling sine-product wave displaces
// each vertex on the Y-axis. The analytical gradient of that wave gives the
// surface normal, which the fragment shader maps to colour.
//
// Because adjacent triangles sample the same world-space XZ coordinates their
// normals match at shared edges → no seams, smooth colour flow.

const vertexShader = /* glsl */`
    uniform float uTime;
    uniform float uBigWavesElevation;
    uniform float uBigWavesFrequency;
    uniform float uBigWavesSpeed;

    varying vec3 vWorldNormal;

    void main() {
        // ── World position ────────────────────────────────────────────────────
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

        // ── Sine-product wave (X × Z) ─────────────────────────────────────────
        float t    = uTime * uBigWavesSpeed;
        float xArg = worldPos.x * uBigWavesFrequency + t;
        float zArg = worldPos.z * uBigWavesFrequency + t;

        float sinX = sin(xArg);
        float sinZ = sin(zArg);
        float cosX = cos(xArg);
        float cosZ = cos(zArg);

        // Y-only displacement
        worldPos.y += uBigWavesElevation * sinX * sinZ;

        // ── Analytical surface normal ─────────────────────────────────────────
        // f(x,z) = E · sin(x·F+t) · sin(z·F+t)
        // ∂f/∂x  = E·F · cos(x·F+t) · sin(z·F+t)
        // ∂f/∂z  = E·F · sin(x·F+t) · cos(z·F+t)
        // Normal  = normalize(−∂f/∂x, 1, −∂f/∂z)
        float EF   = uBigWavesElevation * uBigWavesFrequency;
        float dfdx = EF * cosX * sinZ;
        float dfdz = EF * sinX * cosZ;
        vWorldNormal = normalize(vec3(-dfdx, 1.0, -dfdz));

        // ── Project ───────────────────────────────────────────────────────────
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`

const fragmentShader = /* glsl */`
    uniform vec3 uColorTop;
    uniform vec3 uColorFront;
    uniform vec3 uColorSide;

    varying vec3 vWorldNormal;

    void main() {
        vec3 n = vWorldNormal;

        // Slope metrics — both are 0 when perfectly flat
        float slopeY  = 1.0 - n.y;                 // 0 = flat/pink, 1 = vertical
        float slopeXZ = max(abs(n.x), abs(n.z));   // 0 = flat, 1 = steep in X or Z

        // Smooth three-colour blend:
        //   flat         → uColorTop   (pink)
        //   gentle slope → uColorSide  (blue85)
        //   steep slope  → uColorFront (blue100)
        vec3 color = uColorTop;
        color = mix(color, uColorSide,  smoothstep(0.04, 0.22, slopeY));
        color = mix(color, uColorFront, smoothstep(0.28, 0.55, slopeXZ));

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`

// ── Colour utility ─────────────────────────────────────────────────────────────
function hexToVec3(hex) {
    const c = new THREE.Color(hex)
    return new THREE.Vector3(c.r, c.g, c.b)
}

// ─────────────────────────────────────────────────────────────────────────────
export class TriGrid {
    constructor(canvas) {
        this.canvas      = canvas
        this.clock       = new THREE.Clock()
        this.uTime       = 0
        this.meshes      = []
        this.isRecording = false

        // Mutable params (shared with GUI)
        this.params = {
            // Wave
            speed:      1.0,
            elevation:  0.152,
            frequency:  2.5,
            // Colours (hex strings for GUI; uniforms track Vector3)
            colorTop:   HEX_PINK,
            colorFront: HEX_BLUE,
            colorSide:  '#' + new THREE.Color(HEX_BLUE).multiplyScalar(0.85).getHexString(),
        }

        this._initRenderer()
        this._initCamera()
        this._initScene()
        this._initGeometry()   // sets this.material
        this._initComposer()
        this._initGUI()
        this._initExport()
        this._initResize()
        this._loop()
    }

    // ── Renderer ──────────────────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas:                this.canvas,
            antialias:             true,
            preserveDrawingBuffer: true,
        })
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping      = THREE.NoToneMapping
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

        const size = Math.min(window.innerWidth, window.innerHeight)
        this.renderer.setSize(size, size)
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    // Orthographic top-down. Frustum = 13W × 13W (square).
    // Grid = 13W wide × 15H tall ≈ 13 × 13 — fills the frame perfectly.
    _initCamera() {
        const half = (COLS * W) / 2   // 6.5

        this.camera = new THREE.OrthographicCamera(
            -half,  half,   // left, right
             half, -half,   // top, bottom  (camera +Y = world -Z = screen top)
            0.1, 1000
        )

        const cx = COLS * W / 2
        const cz = (ROWS * H) / 2
        this.camera.position.set(cx, 100, cz)
        this.camera.up.set(0, 0, -1)
        this.camera.lookAt(cx, 0, cz)
    }

    // ── Scene ─────────────────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(HEX_BLUE)
    }

    // ── Triangle geometry ─────────────────────────────────────────────────────
    // Downward-pointing equilateral triangle, centroid at origin, in XZ plane.
    // Winding TR → TL → B produces a +Y face normal.
    _makeTriGeo() {
        const h3  = H / 3
        const h23 = (2 * H) / 3

        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(
            new Float32Array([ W/2,0,-h3,  -W/2,0,-h3,  0,0,h23 ]), 3
        ))
        // Initial normals (wave overrides these via analytical gradient)
        geo.setAttribute('normal', new THREE.BufferAttribute(
            new Float32Array([ 0,1,0, 0,1,0, 0,1,0 ]), 3
        ))
        return geo
    }

    // ── Grid ──────────────────────────────────────────────────────────────────
    _initGeometry() {
        const geo = this._makeTriGeo()
        const p   = this.params

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:               { value: 0 },
                uBigWavesElevation:  { value: p.elevation },
                uBigWavesFrequency:  { value: p.frequency },
                uBigWavesSpeed:      { value: p.speed },
                uColorTop:           { value: hexToVec3(p.colorTop)   },
                uColorFront:         { value: hexToVec3(p.colorFront) },
                uColorSide:          { value: hexToVec3(p.colorSide)  },
            },
            vertexShader,
            fragmentShader,
            side: THREE.FrontSide,
        })

        // Even rows: centres x = col + 0.5  (0.5, 1.5, … 12.5)
        // Odd rows:  centres x = col         (0,   1,   … 12)
        for (let row = 0; row < ROWS; row++) {
            const isOdd = row % 2 === 1
            for (let col = 0; col < COLS; col++) {
                const cx = isOdd ? col * W : col * W + W / 2
                const cz = row * H + H / 3

                const mesh = new THREE.Mesh(geo, this.material)
                mesh.position.set(cx, 0, cz)
                this.scene.add(mesh)
                this.meshes.push(mesh)
            }
        }
    }

    // ── Post-processing ───────────────────────────────────────────────────────
    _initComposer() {
        const size = Math.min(window.innerWidth, window.innerHeight)
        this.composer = new EffectComposer(this.renderer)
        this.composer.setSize(size, size)
        this.composer.addPass(new RenderPass(this.scene, this.camera))
        this.composer.addPass(new OutputPass())
    }

    // ── GUI ───────────────────────────────────────────────────────────────────
    _initGUI() {
        const gui = new GUI({ title: 'Tri Grid' })
        const u   = this.material.uniforms
        const p   = this.params

        const wave = gui.addFolder('Wave')
        wave.add(p, 'speed',     0.0, 4.0, 0.01).name('Speed')
            .onChange(v => { u.uBigWavesSpeed.value = v })
        wave.add(p, 'elevation', 0.0, 1.5, 0.001).name('Elevation')
            .onChange(v => { u.uBigWavesElevation.value = v })
        wave.add(p, 'frequency', 0.1, 8.0, 0.01).name('Frequency')
            .onChange(v => { u.uBigWavesFrequency.value = v })

        const colours = gui.addFolder('Colours')
        colours.addColor(p, 'colorTop').name('Top (pink)')
            .onChange(hex => u.uColorTop.value.copy(hexToVec3(hex)))
        colours.addColor(p, 'colorFront').name('Front (blue)')
            .onChange(hex => u.uColorFront.value.copy(hexToVec3(hex)))
        colours.addColor(p, 'colorSide').name('Side (blue85)')
            .onChange(hex => u.uColorSide.value.copy(hexToVec3(hex)))
    }

    // ── Export ────────────────────────────────────────────────────────────────
    _initExport() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'E' || e.key === 'e') this._screenshot4K()
            if (e.key === 'R' || e.key === 'r') this._recordLoop()
        })
    }

    _screenshot4K() {
        const W4K = 3840, H4K = 2160
        const aspect = W4K / H4K

        const prevSize = new THREE.Vector2()
        this.renderer.getSize(prevSize)
        const prevPR = this.renderer.getPixelRatio()
        const { left, right, top, bottom } = this.camera

        const halfH    = (COLS * W) / 2
        const halfW169 = halfH * aspect
        this.camera.left = -halfW169; this.camera.right  =  halfW169
        this.camera.top  =  halfH;    this.camera.bottom = -halfH
        this.camera.updateProjectionMatrix()

        this.renderer.setPixelRatio(1)
        this.renderer.setSize(W4K, H4K, false)
        this.renderer.render(this.scene, this.camera)

        const link = document.createElement('a')
        link.download = 'hux-tri-grid-4k.png'
        link.href     = this.renderer.domElement.toDataURL('image/png')
        link.click()

        this.camera.left = left; this.camera.right  = right
        this.camera.top  = top;  this.camera.bottom = bottom
        this.camera.updateProjectionMatrix()

        this.renderer.setPixelRatio(prevPR)
        this.renderer.setSize(prevSize.x, prevSize.y, false)
        this.composer.setSize(prevSize.x, prevSize.y)
    }

    _recordLoop() {
        if (this.isRecording) return
        this.isRecording = true

        const stream   = this.renderer.domElement.captureStream(60)
        const recorder = new MediaRecorder(stream, {
            mimeType:           'video/webm;codecs=vp9',
            videoBitsPerSecond: 8_000_000,
        })

        const chunks = []
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' })
            const a    = document.createElement('a')
            a.href     = URL.createObjectURL(blob)
            a.download = 'hux-tri-grid.webm'
            a.click()
            URL.revokeObjectURL(a.href)
            this.isRecording = false
        }

        recorder.start()
        setTimeout(() => recorder.stop(), LOOP_DURATION * 1000)
    }

    // ── Resize ────────────────────────────────────────────────────────────────
    _initResize() {
        window.addEventListener('resize', () => {
            const size = Math.min(window.innerWidth, window.innerHeight)
            this.renderer.setSize(size, size)
            this.composer.setSize(size, size)
        })
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    // uTime advances each frame; all wave logic lives in the vertex shader.
    // No JS-side mesh rotation or position mutation.
    update(delta) {
        this.uTime                              += delta
        this.material.uniforms.uTime.value       = this.uTime
    }

    _loop() {
        const tick = () => {
            this.update(this.clock.getDelta())
            this.composer.render()
            requestAnimationFrame(tick)
        }
        tick()
    }
}
