import * as THREE from 'three'

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
export const BAKED = {
    // Grid
    gridUnits   : 10,        // world-unit size of the factory floor (10 × 10)
    gridCells   : 10,        // cells per side; each cell = 1.0 unit

    // HUX palette (stored as hex; Color() converts to linear internally)
    colorBlue   : '#070726',
    colorPink   : '#f72e62',
    colorWhite  : '#ffffff',

    // Background pulse shader
    pulseIntensity    : 0.12,
    pulseSpeed        : 0.6,
    scanlineFrequency : 40.0,

    // Factory behaviour
    factorySpeed : 1.0,   // multiplier on all sliding speeds
    spawnRate    : 1.8,   // seconds between icon spawns

    // Icon sizes (normalised to 1-unit grid cell, per HUX spec)
    sizeA : 0.24,         // 24pt rule
    sizeB : 0.36,         // 36pt rule
}

// ── BACKGROUND GRID SHADER ────────────────────────────────────────────────────
const gridVertexShader = /* glsl */`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const gridFragmentShader = /* glsl */`
uniform sampler2D uTexture;
uniform float     uTime;
uniform float     uPulseIntensity;
uniform float     uPulseSpeed;
uniform float     uScanlineFrequency;

varying vec2 vUv;

#define PI 3.14159265359

void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 col = tex.rgb;

    // Horizontal scanline shimmer — gives the blueprint a "live CRT" feel
    float scan = sin(vUv.y * uScanlineFrequency * PI) * 0.5 + 0.5;
    col *= (0.88 + scan * 0.12);

    // Breathing pulse — subtle brightness oscillation over time
    float pulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
    col *= (1.0 - uPulseIntensity + pulse * uPulseIntensity);

    gl_FragColor = vec4(col, tex.a);
    #include <colorspace_fragment>
}
`

// ── ICON GEOMETRY HELPERS ─────────────────────────────────────────────────────
function makeSquare(size) {
    return new THREE.PlaneGeometry(size * 0.88, size * 0.88)
}

function makeCircle(size) {
    return new THREE.CircleGeometry(size * 0.44, 32)
}

function makeTriangle(size) {
    const geo = new THREE.BufferGeometry()
    const s = size * 0.5
    const h = s * Math.sqrt(3)
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
         0,    h * 0.667, 0,
        -s,   -h * 0.333, 0,
         s,   -h * 0.333, 0,
    ]), 3))
    geo.setIndex([0, 1, 2])
    geo.computeVertexNormals()
    return geo
}

const GEO_BUILDERS = [makeSquare, makeCircle, makeTriangle]

// ── STAMP SPRING ──────────────────────────────────────────────────────────────
// Damped spring: starts at ~1.38×, undershoots to ~0.86×, settles at 1.0×
function springScale(t) {
    return 1.0 + 0.38 * Math.exp(-6.0 * t) * Math.cos(18.0 * t)
}

const STAMP_DURATION = 0.5    // seconds for spring to settle
const PLACED_DURATION = 3.5   // seconds icon sits on the floor
const FADE_DURATION   = 0.8   // seconds to fade out

// ── MODULE EXPORT ─────────────────────────────────────────────────────────────
export default function initIconFactory(scene) {
    const half = BAKED.gridUnits * 0.5

    // -- Background plane (ShaderMaterial with pulse + scanlines) --
    const texture = new THREE.TextureLoader().load('/HUX--Icon--Factory.png')
    texture.colorSpace = THREE.SRGBColorSpace

    const gridUniforms = {
        uTexture          : { value: texture },
        uTime             : { value: 0 },
        uPulseIntensity   : { value: BAKED.pulseIntensity },
        uPulseSpeed       : { value: BAKED.pulseSpeed },
        uScanlineFrequency: { value: BAKED.scanlineFrequency },
    }

    const gridMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(BAKED.gridUnits, BAKED.gridUnits),
        new THREE.ShaderMaterial({
            vertexShader  : gridVertexShader,
            fragmentShader: gridFragmentShader,
            uniforms      : gridUniforms,
            transparent   : true,
        })
    )
    gridMesh.rotation.x = -Math.PI * 0.5
    scene.add(gridMesh)

    // -- Icon pool --
    const icons = []
    let spawnTimer = 0

    const ICON_COLORS = [
        new THREE.Color(BAKED.colorPink),
        new THREE.Color(BAKED.colorWhite),
    ]

    function spawnIcon() {
        // Random row (Z) and destination column (X), snapped to cell centres
        const startX = -half - 0.5
        const destX  = Math.round(Math.random() * (BAKED.gridCells - 4) - (BAKED.gridCells * 0.25))
        const rowZ   = Math.round((Math.random() * (BAKED.gridCells - 2)) - ((BAKED.gridCells - 2) * 0.5))

        const size    = Math.random() < 0.5 ? BAKED.sizeA : BAKED.sizeB
        const geo     = GEO_BUILDERS[Math.floor(Math.random() * GEO_BUILDERS.length)](size)
        const mat     = new THREE.MeshBasicMaterial({
            color      : ICON_COLORS[Math.floor(Math.random() * ICON_COLORS.length)],
            transparent: true,
            opacity    : 1,
        })
        const mesh = new THREE.Mesh(geo, mat)

        // Icons lie flat on the XZ floor (same rotation as the grid plane)
        mesh.rotation.x = -Math.PI * 0.5
        mesh.position.set(startX, 0.01, rowZ)
        scene.add(mesh)

        icons.push({
            mesh, geo, mat,
            state      : 'sliding',
            destX,
            slideSpeed : (1.5 + Math.random() * 1.5),
            stampTimer : 0,
            placedTimer: 0,
            fadeTimer  : 0,
        })
    }

    // -- Mutable config — GUI binds directly to this object --
    const config = {
        pulseIntensity    : BAKED.pulseIntensity,
        pulseSpeed        : BAKED.pulseSpeed,
        scanlineFrequency : BAKED.scanlineFrequency,
        factorySpeed      : BAKED.factorySpeed,
        spawnRate         : BAKED.spawnRate,
    }

    // -- Update loop --
    function update(delta) {
        gridUniforms.uTime.value           += delta
        gridUniforms.uPulseIntensity.value  = config.pulseIntensity
        gridUniforms.uPulseSpeed.value      = config.pulseSpeed
        gridUniforms.uScanlineFrequency.value = config.scanlineFrequency

        // Spawn
        spawnTimer += delta
        if (spawnTimer >= config.spawnRate) {
            spawnIcon()
            spawnTimer = 0
        }

        // Update each icon state machine
        for (let i = icons.length - 1; i >= 0; i--) {
            const icon = icons[i]

            if (icon.state === 'sliding') {
                icon.mesh.position.x += icon.slideSpeed * config.factorySpeed * delta
                if (icon.mesh.position.x >= icon.destX) {
                    icon.mesh.position.x = icon.destX
                    icon.state           = 'stamping'
                    icon.stampTimer      = 0
                }

            } else if (icon.state === 'stamping') {
                icon.stampTimer += delta
                icon.mesh.scale.setScalar(springScale(icon.stampTimer))
                if (icon.stampTimer >= STAMP_DURATION) {
                    icon.mesh.scale.setScalar(1)
                    icon.state       = 'placed'
                    icon.placedTimer = 0
                }

            } else if (icon.state === 'placed') {
                icon.placedTimer += delta
                if (icon.placedTimer >= PLACED_DURATION) {
                    icon.state     = 'fading'
                    icon.fadeTimer = 0
                }

            } else if (icon.state === 'fading') {
                icon.fadeTimer     += delta
                icon.mat.opacity    = Math.max(0, 1 - icon.fadeTimer / FADE_DURATION)
                if (icon.fadeTimer >= FADE_DURATION) {
                    scene.remove(icon.mesh)
                    icon.geo.dispose()
                    icon.mat.dispose()
                    icons.splice(i, 1)
                }
            }
        }
    }

    return { gridUniforms, gridMesh, config, icons, update }
}
