/**
 * StructureGrid.jsx — HUX Design Tokens Visualisation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WAVE MATHEMATICS (useFrame loop)
 * ─────────────────────────────────
 * Each cube sits at a grid position (col, row) ∈ [0, GRID-1]².
 * The world position is:
 *   x = (col − half) × SPACING
 *   z = (row − half) × SPACING
 *   dist = √(x² + z²)   — radial distance from grid centre
 *
 * Y displacement each frame:
 *   y = sin(dist × waveFrequency − t) × currentAmplitude
 *
 * Subtracting t from the phase causes the wavefront to travel outward from
 * the centre over time, mimicking a drop in still water. waveFrequency
 * controls how many wave peaks are visible across the grid.
 *
 * SMOOTH TRANSITIONS
 * ──────────────────
 * currentAmplitude (a ref) tracks the actual rendered amplitude. Each frame
 * it exponential-decays toward targetAmplitude (amplitude or 0 depending on
 * wobbleEnabled). This prevents any snapping when the toggle is flipped:
 *
 *   currentAmplitude += (target − current) × (1 − e^(−dt × decay))
 *
 * With decay = 8, ~99 % convergence occurs within 0.6 s at any frame-rate.
 *
 * EXPORT LOGIC
 * ────────────
 * 4K Still  — temporarily resizes the renderer to 4096 × 2304, waits two
 *   rAF ticks for R3F to re-render into the new backbuffer, reads with
 *   canvas.toDataURL, then restores. Requires preserveDrawingBuffer: true.
 *
 * 4K Video  — resizes to 3840 × 2160, calls canvas.captureStream(30) to
 *   get a 30 fps MediaStream, wraps it in a MediaRecorder at 25 Mbps VP9,
 *   collects chunks for 30 s, assembles a Blob and triggers a download.
 */

import { useRef, useMemo, useLayoutEffect, Suspense } from 'react'
import { useFrame, useThree }                          from '@react-three/fiber'
import { Environment, OrbitControls }                  from '@react-three/drei'
import {
  EffectComposer,
  N8AO,
  Bloom,
  Noise,
  Vignette,
}                                                      from '@react-three/postprocessing'
import { useControls, button, folder }                 from 'leva'
import * as THREE                                      from 'three'

// ─── Grid constants ───────────────────────────────────────────────────────────
const GRID    = 12
const COUNT   = GRID * GRID   // 144 instances
const HALF    = (GRID - 1) / 2
const SPACING = 1.15          // centre-to-centre distance between cubes

// ─── HUX colour tokens ────────────────────────────────────────────────────────
const COLOUR = {
  blue:    '#201fff',
  pink:    '#f72e62',
  light:   '#f4f4f4',
  midGrey: '#c9c9c9',
  bg:      '#1e1e1e',
}

// ─── Export utilities ─────────────────────────────────────────────────────────

/** Returns a Promise that resolves after n animation frames. */
function waitFrames(n = 2) {
  return new Promise(resolve => {
    let count = 0
    const tick = () => (++count >= n ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
}

/**
 * Temporarily resizes the WebGLRenderer to 4096 × 2304 (16:9 4K), waits two
 * frames so R3F can render at the new resolution, captures the backbuffer,
 * triggers a PNG download, then restores the previous size.
 */
async function exportStill(gl) {
  const prevSize  = new THREE.Vector2()
  const prevRatio = gl.getPixelRatio()
  gl.getSize(prevSize)

  gl.setPixelRatio(1)
  gl.setSize(4096, 2304, false)
  await waitFrames(2)

  const url = gl.domElement.toDataURL('image/png')
  Object.assign(document.createElement('a'), {
    href:     url,
    download: `hux-structure-4k-${Date.now()}.png`,
  }).click()

  gl.setPixelRatio(prevRatio)
  gl.setSize(prevSize.x, prevSize.y, false)
}

/**
 * Resizes to 3840 × 2160 (true 4K), starts a MediaRecorder on the canvas
 * stream at 25 Mbps VP9, records for 30 s, downloads the result as a .webm,
 * and restores the renderer to its previous dimensions.
 *
 * @param {function} onStart  Called when recording begins (show HUD)
 * @param {function} onStop   Called when recording ends   (hide HUD)
 */
function exportVideo(gl, onStart, onStop) {
  const prevSize  = new THREE.Vector2()
  const prevRatio = gl.getPixelRatio()
  gl.getSize(prevSize)

  gl.setPixelRatio(1)
  gl.setSize(3840, 2160, false)

  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find(t => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'

  const chunks   = []
  const recorder = new MediaRecorder(gl.domElement.captureStream(30), {
    mimeType,
    videoBitsPerSecond: 25_000_000,
  })

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), {
      href:     url,
      download: `hux-structure-4k-${Date.now()}.webm`,
    }).click()
    URL.revokeObjectURL(url)

    gl.setPixelRatio(prevRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    onStop()
  }

  recorder.start(200)  // buffer in 200 ms chunks
  onStart()
  setTimeout(() => recorder.stop(), 30_000)
}

// ─── Colour assignment ────────────────────────────────────────────────────────

/**
 * Assigns per-instance colours to an InstancedMesh based on each cube's
 * radial distance from the grid centre (t = 0 at centre, 1 at corner).
 *
 * colourMode 'hux'  → blue (#201fff) at centre → pink (#f72e62) at edge
 * colourMode 'grey' → dark (#1e1e1e) at centre → light (#f4f4f4) at edge
 */
function applyColours(mesh, colourMode) {
  const cA      = new THREE.Color(colourMode === 'hux' ? COLOUR.blue    : COLOUR.midGrey)
  const cB      = new THREE.Color(colourMode === 'hux' ? COLOUR.pink    : COLOUR.light)
  const maxDist = Math.sqrt(HALF * HALF + HALF * HALF)
  const tmp     = new THREE.Color()

  for (let i = 0; i < COUNT; i++) {
    const x = (i % GRID) - HALF
    const z = Math.floor(i / GRID) - HALF
    const t = Math.sqrt(x * x + z * z) / maxDist   // 0 (centre) → 1 (corner)
    mesh.setColorAt(i, tmp.lerpColors(cA, cB, t))
  }

  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StructureGrid() {
  const meshRef       = useRef(null)
  const dummy         = useMemo(() => new THREE.Object3D(), [])
  const { gl, camera } = useThree()

  // Tracks the currently rendered amplitude — lerps toward the target
  const currentAmp = useRef(0)

  // ── Leva controls ──────────────────────────────────────────────────────────
  const {
    wobbleEnabled,
    amplitude,
    speed,
    waveFrequency,
    colourMode,
    aoIntensity,
    aoRadius,
    bloomIntensity,
    filmGrain,
  } = useControls({
    'Wave': folder({
      wobbleEnabled: { value: true,  label: 'Wobble' },
      amplitude:     { value: 1.2,   min: 0,    max: 4,   step: 0.05 },
      speed:         { value: 1.0,   min: 0.1,  max: 5,   step: 0.05 },
      waveFrequency: { value: 1.0,   min: 0.1,  max: 5,   step: 0.05, label: 'Frequency' },
    }),
    'Colour': folder({
      colourMode: {
        value:   'hux',
        options: { 'HUX Blue → Pink': 'hux', 'Greyscale': 'grey' },
        label:   'Colour Mode',
      },
    }),
    'Post-Processing': folder({
      aoIntensity:    { value: 5.0,  min: 0, max: 10,  step: 0.1,  label: 'AO Intensity' },
      aoRadius:       { value: 0.4,  min: 0, max: 2,   step: 0.01, label: 'AO Radius' },
      bloomIntensity: { value: 0.25, min: 0, max: 2,   step: 0.05, label: 'Bloom' },
      filmGrain:      { value: 0.04, min: 0, max: 0.5, step: 0.01, label: 'Film Grain' },
    }),
    'Export': folder({
      '4k_still': button(() => exportStill(gl)),
      '4k_video': button(() => exportVideo(
        gl,
        () => console.info('Recording started — 30 s'),
        () => console.info('Recording complete'),
      )),
    }),
  })

  // ── Camera lookAt (synchronous — before first useFrame tick) ──────────────
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera])

  // ── Initialise instance matrices (synchronous — positions set on frame 0) ──
  useLayoutEffect(() => {
    if (!meshRef.current) return

    for (let i = 0; i < COUNT; i++) {
      const x = ((i % GRID) - HALF) * SPACING
      const z = (Math.floor(i / GRID) - HALF) * SPACING
      dummy.position.set(x, 0, z)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  // ── Colour re-assignment when mode changes ─────────────────────────────────
  useLayoutEffect(() => {
    if (!meshRef.current) return
    applyColours(meshRef.current, colourMode)
  }, [colourMode])   // meshRef.current is stable after mount

  // ── Per-frame animation ────────────────────────────────────────────────────
  useFrame((state, dt) => {
    if (!meshRef.current) return

    const t         = state.clock.elapsedTime * speed
    const targetAmp = wobbleEnabled ? amplitude : 0

    // Exponential-decay lerp — frame-rate independent.
    // decay=8 → ~99 % convergence in ≈0.6 s.
    currentAmp.current += (targetAmp - currentAmp.current) * (1 - Math.exp(-dt * 8))

    const amp = currentAmp.current

    for (let i = 0; i < COUNT; i++) {
      const x    = ((i % GRID) - HALF) * SPACING
      const z    = (Math.floor(i / GRID) - HALF) * SPACING
      const dist = Math.sqrt(x * x + z * z)

      // Radial sine wave — phase (dist × freq − t) makes the crest
      // travel outward from the centre, like a ripple on still water.
      const y = Math.sin(dist * waveFrequency - t) * amp

      dummy.position.set(x, y, z)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  // ── Scene ──────────────────────────────────────────────────────────────────
  return (
    <>
      <color attach="background" args={[COLOUR.bg]} />

      {/* ── Lighting ── */}
      {/* Soft fill — prevents the underside of raised cubes going fully black */}
      <ambientLight intensity={0.25} />

      {/* Key light — raking angle to emphasise the wave topology */}
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.001}
      />

      {/* Cool rim — separates rear blocks from the dark background */}
      <directionalLight
        position={[-7, 5, -5]}
        intensity={0.45}
        color="#5566ff"
      />

      {/* Warm ground bounce — softens the shadow on the underside */}
      <directionalLight
        position={[0, -8, 0]}
        intensity={0.12}
        color="#ffe4b0"
      />

      {/* HDRI — Suspense boundary required: Environment calls useLoader */}
      <Suspense fallback={null}>
        <Environment preset="studio" />
      </Suspense>

      {/* Orbit controls — damped for a smooth, cinematic feel */}
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minPolarAngle={Math.PI * 0.08}
        maxPolarAngle={Math.PI * 0.55}
        dampingFactor={0.06}
        enableDamping
      />

      {/* ── Geometry ── */}
      {/*
        Single InstancedMesh — Three.js draws all 144 blocks in one draw call.
        frustumCulled={false} because the InstancedMesh bounding sphere covers
        all possible wave positions, so culling would flash blocks at high amplitude.
      */}
      <instancedMesh
        ref={meshRef}
        args={[null, null, COUNT]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {/* 0.92 side length leaves a subtle 0.08 gap for the AO to bite into */}
        <boxGeometry args={[0.92, 0.92, 0.92]} />
        <meshStandardMaterial roughness={0.42} metalness={0.06} />
      </instancedMesh>

      {/* ── Post-Processing ── */}
      <EffectComposer>
        {/* N8AO — screen-space ambient occlusion; creates contact shadows
            between adjacent cubes for the studio-depth look.
            Does NOT require enableNormalPass — uses its own depth pass. */}
        <N8AO
          aoRadius={aoRadius}
          intensity={aoIntensity}
          aoSamples={16}
          denoiseSamples={4}
          denoiseRadius={12}
          distanceFalloff={1}
          screenSpaceRadius={false}
          color="black"
        />

        {/* Bloom — gentle glow on the HUX blue/pink accents; mipmapBlur
            gives a high-radius soft halo without GPU cost */}
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur
          radius={0.7}
        />

        {/* Noise — filmic grain at 0.04 opacity, barely perceptible but
            removes the "too clean" digital look */}
        <Noise opacity={filmGrain} />

        {/* Vignette — subtle framing that draws the eye to the wave centre */}
        <Vignette offset={0.25} darkness={0.55} eskil={false} />
      </EffectComposer>
    </>
  )
}
