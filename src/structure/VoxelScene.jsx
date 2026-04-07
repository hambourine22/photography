/**
 * VoxelScene.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * A procedural voxel animation built on Three.js InstancedMesh.
 *
 * MATHEMATICAL APPROACH (useFrame loop)
 * ──────────────────────────────────────
 * Each voxel lives at a grid position (ix, iy, iz) ∈ [0, gridSize-1]³.
 * The instanced transform pipeline has three layers:
 *
 *  1. FORMATION TARGET  — a (x,y,z) position defining where this voxel
 *     "wants to be" for the current structural state (solid, hollow, cross…).
 *     Inactive voxels for a given formation get targetScale = 0.
 *
 *  2. LERP SMOOTHING  — currentPos/currentScale chase their targets each
 *     frame at a lerpSpeed that the state machine raises for snappy snaps
 *     and lowers for idle floating:
 *       current += (target − current) × clamp(lerpSpeed × dt × 60, 0, 1)
 *     This frame-rate-independent lerp gives an exponential ease-out, so
 *     blocks overshoot slightly when lerpSpeed > 1 (giving a springy feel).
 *
 *  3. WAVE DISPLACEMENT  — added on top of the lerped position, creating
 *     organic breathing motion. Three independent sine waves are layered:
 *       waveY = sin(ix × wf + t)  × cos(iz × wf×0.6 + t×0.8)  × nd×0.3
 *       waveX = cos(iy × wf×0.4  + t×1.1)                      × nd×0.1
 *       waveZ = sin(iy × wf×0.6  + t×0.9 + iz)                 × nd×0.1
 *     Using both sin and cos at different frequencies and phase offsets
 *     prevents the motion from ever repeating within the visible loop.
 *     Multiplying X/Z wave factors by waveY couples all three axes so
 *     voxels appear to roll and breathe rather than slide on a single axis.
 *
 * FORMATION STATE MACHINE
 * ───────────────────────
 *   idle (5s) → scattering (1.4s) → assembling (0s) → idle (5s) → …
 *
 *   On SCATTER: all targetPos → random sphere positions, scale → 0.3.
 *   On ASSEMBLE: targetPos → next formation's grid positions, scale → 1|0.
 *   lerpSpeed spikes during scatter (fast fly-out) then during reassembly
 *   (fast snap-in), and drops back to 1 during idle (gentle drift).
 */

import { useRef, useMemo, useEffect, useLayoutEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { useControls, folder } from 'leva'
import * as THREE from 'three'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GRID  = 20
const MAX_COUNT = MAX_GRID ** 3  // 8 000 — InstancedMesh never reallocated

const FORMATION_NAMES = ['solid', 'hollow', 'cross', 'steps', 'sphere', 'diagonal']
const SCATTER_RADIUS  = 9
const IDLE_DURATION   = 5.0
const SCATTER_HOLD    = 1.4

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Writes formation target positions + scales into pre-allocated Float32Arrays.
 * @param {string}       name        One of FORMATION_NAMES
 * @param {number}       gridSize    N (NxNxN grid)
 * @param {Float32Array} scatter     Pre-computed random scatter positions (MAX_COUNT*3)
 * @param {Float32Array} tPos        Output: target positions (MAX_COUNT*3)
 * @param {Float32Array} tScale      Output: target scales (MAX_COUNT)
 */
function computeFormation(name, gridSize, scatter, tPos, tScale) {
  const half = (gridSize - 1) / 2
  const centerIdx = Math.round(half)

  for (let i = 0; i < gridSize ** 3; i++) {
    const ix = i % gridSize
    const iy = Math.floor(i / gridSize) % gridSize
    const iz = Math.floor(i / (gridSize * gridSize))

    const bx = ix - half
    const by = iy - half
    const bz = iz - half

    // Default: grid position, visible
    tPos[i * 3]     = bx
    tPos[i * 3 + 1] = by
    tPos[i * 3 + 2] = bz
    tScale[i]        = 1

    switch (name) {
      case 'solid':
        // All voxels at grid positions — default above covers it
        break

      case 'hollow': {
        // Shell only: voxels where at least one axis is at 0 or gridSize-1
        const surface = ix === 0 || ix === gridSize - 1
                     || iy === 0 || iy === gridSize - 1
                     || iz === 0 || iz === gridSize - 1
        tScale[i] = surface ? 1 : 0
        break
      }

      case 'cross': {
        // Three orthogonal planes intersecting the centre
        const onCross = ix === centerIdx || iy === centerIdx || iz === centerIdx
        tScale[i] = onCross ? 1 : 0
        break
      }

      case 'steps': {
        // Staircase ascending in Y with X. Visible where iy ≤ ix.
        // This creates a geometric step pattern that reads as architecture.
        tScale[i] = iy <= ix ? 1 : 0
        break
      }

      case 'sphere': {
        // Filled sphere — Euclidean distance from centre ≤ radius
        const dist = Math.sqrt(bx * bx + by * by + bz * bz)
        tScale[i] = dist <= half * 0.95 ? 1 : 0
        break
      }

      case 'diagonal': {
        // Diagonal slab: voxels near the plane ix + iy + iz = constant.
        // The ±1 tolerance gives the slab a two-voxel thickness.
        const target = Math.round(gridSize * 0.75)
        tScale[i] = Math.abs(ix + iy + iz - target) <= 1 ? 1 : 0
        break
      }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function VoxelScene() {
  const meshRef = useRef(null)
  // Reusable Object3D for matrix math — never re-created
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // ── Leva Controls ──────────────────────────────────────────────────────────
  const {
    gridSize, spacing, baseScale,
    bgColour, baseBlockColour, accentBlue, accentPink,
    speed, waveFrequency, noiseDisplacement,
    filmGrain, vignetteStrength,
  } = useControls({
    'Geometry': folder({
      gridSize:  { value: 10, min: 5, max: 20, step: 1, label: 'Grid Size' },
      spacing:   { value: 1.1, min: 1.0, max: 2.0, step: 0.01 },
      baseScale: { value: 0.9, min: 0.1, max: 1.0, step: 0.01, label: 'Block Scale' },
    }),
    'Colour Palette (HUX)': folder({
      bgColour:        { value: '#1e1e1e', label: 'Background' },
      baseBlockColour: { value: '#f4f4f4', label: 'Base Block' },
      accentBlue:      { value: '#201fff', label: 'Accent Blue' },
      accentPink:      { value: '#f72e62', label: 'Accent Pink' },
    }),
    'Animation': folder({
      speed:             { value: 1.0, min: 0.1, max: 5.0, step: 0.05 },
      waveFrequency:     { value: 2.0, min: 0.1, max: 10.0, step: 0.1, label: 'Wave Freq' },
      noiseDisplacement: { value: 0.45, min: 0.0, max: 2.0, step: 0.01, label: 'Displacement' },
    }),
    'Post-Processing': folder({
      filmGrain:       { value: 0.28, min: 0.0, max: 1.0, step: 0.01, label: 'Film Grain' },
      vignetteStrength:{ value: 0.55, min: 0.0, max: 1.5, step: 0.01, label: 'Vignette' },
    }),
  })

  const count = gridSize ** 3

  // ── Persistent working arrays (sized to MAX_COUNT, never reallocated) ──────
  const currentPos   = useMemo(() => new Float32Array(MAX_COUNT * 3), [])
  const targetPos    = useMemo(() => new Float32Array(MAX_COUNT * 3), [])
  const currentScale = useMemo(() => new Float32Array(MAX_COUNT).fill(1), [])
  const targetScale  = useMemo(() => new Float32Array(MAX_COUNT).fill(1), [])

  // Scatter positions: random points in a sphere, generated once
  const scatterPos = useMemo(() => {
    const arr = new Float32Array(MAX_COUNT * 3)
    for (let i = 0; i < MAX_COUNT; i++) {
      // Rejection sampling for uniform sphere distribution
      let x, y, z
      do {
        x = (Math.random() - 0.5) * 2
        y = (Math.random() - 0.5) * 2
        z = (Math.random() - 0.5) * 2
      } while (x * x + y * y + z * z > 1)
      arr[i * 3]     = x * SCATTER_RADIUS
      arr[i * 3 + 1] = y * SCATTER_RADIUS
      arr[i * 3 + 2] = z * SCATTER_RADIUS
    }
    return arr
  }, [])

  // Formation state machine (ref — mutated inside useFrame, no re-render)
  const state = useRef({
    formationIdx: 0,
    phase: 'idle',   // 'idle' | 'scattering' | 'assembling'
    timer: 0,
    lerpSpeed: 2.0,
  })

  // ── Initialise / reset on gridSize change ──────────────────────────────────
  // useLayoutEffect runs synchronously in the commit phase — before the first
  // useFrame tick — so arrays are populated before any matrix is written.
  useLayoutEffect(() => {
    if (!meshRef.current) return

    // Recompute solid formation as starting state
    computeFormation('solid', gridSize, scatterPos, targetPos, targetScale)

    // Snap currentPos to match (no lerp on init)
    for (let i = 0; i < count * 3; i++) currentPos[i]   = targetPos[i]
    for (let i = 0; i < count; i++)     currentScale[i] = targetScale[i]

    // Reset state machine
    state.current = { formationIdx: 0, phase: 'idle', timer: 0, lerpSpeed: 2.0 }

    // Tell Three.js how many instances to draw
    meshRef.current.count = count
  }, [gridSize, count, scatterPos, targetPos, targetScale, currentPos, currentScale])

  // ── Per-instance colour (re-applied when palette or grid changes) ──────────
  useLayoutEffect(() => {
    if (!meshRef.current) return
    const col = new THREE.Color()
    const half = Math.floor((gridSize - 1) / 2)

    for (let i = 0; i < count; i++) {
      const ix = i % gridSize
      const iy = Math.floor(i / gridSize) % gridSize
      const iz = Math.floor(i / (gridSize * gridSize))

      // Corner voxels (8 total) → pink accent
      const isCorner = (ix === 0 || ix === gridSize - 1)
                    && (iy === 0 || iy === gridSize - 1)
                    && (iz === 0 || iz === gridSize - 1)

      // Central axis voxels — two directions → blue accent
      const isCentral = (ix === half && iy === half)
                     || (iy === half && iz === half)
                     || (ix === half && iz === half)

      if (isCorner) {
        col.set(accentPink)
      } else if (isCentral) {
        col.set(accentBlue)
      } else {
        // Subtle grey gradient along the main diagonal
        const t = (ix + iy + iz) / (gridSize * 3)
        const base = new THREE.Color(baseBlockColour)
        const mid  = new THREE.Color('#c9c9c9')
        col.lerpColors(mid, base, t)
      }

      meshRef.current.setColorAt(i, col)
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, [gridSize, count, accentPink, accentBlue, baseBlockColour])

  // ── Main animation loop ────────────────────────────────────────────────────
  useFrame((three, dt) => {
    if (!meshRef.current) return

    const s    = state.current
    const t    = three.clock.elapsedTime * speed
    const wf   = waveFrequency
    const nd   = noiseDisplacement

    // ── State machine ────────────────────────────────────────────────────────
    s.timer += dt * speed

    if (s.phase === 'idle' && s.timer >= IDLE_DURATION) {
      // Begin scatter: push all active voxels to random sphere positions
      s.phase     = 'scattering'
      s.timer     = 0
      s.lerpSpeed = 4.0

      for (let i = 0; i < count; i++) {
        targetPos[i * 3]     = scatterPos[i * 3]
        targetPos[i * 3 + 1] = scatterPos[i * 3 + 1]
        targetPos[i * 3 + 2] = scatterPos[i * 3 + 2]
        targetScale[i]        = 0.25
      }
    }

    if (s.phase === 'scattering' && s.timer >= SCATTER_HOLD) {
      // Choose next formation and snap targets to it
      s.formationIdx = (s.formationIdx + 1) % FORMATION_NAMES.length
      computeFormation(
        FORMATION_NAMES[s.formationIdx],
        gridSize, scatterPos, targetPos, targetScale
      )
      s.phase     = 'assembling'
      s.timer     = 0
      s.lerpSpeed = 5.5   // fast snap-in for dramatic reassembly
    }

    if (s.phase === 'assembling' && s.timer >= 1.8) {
      s.phase     = 'idle'
      s.timer     = 0
      s.lerpSpeed = 1.0   // back to gentle drift
    }

    // ── Per-instance update ──────────────────────────────────────────────────
    // Frame-rate-independent lerp factor: approaches 1 as lerpSpeed grows.
    // Clamped to 0.98 to prevent ringing on very high speeds.
    // Frame-rate-independent lerp factor.
    // At 60fps (dt≈0.017): lerpSpeed=1 → lf≈0.017 (gentle), lerpSpeed=5.5 → lf≈0.094 (snappy).
    const lf = Math.min(s.lerpSpeed * dt, 0.98)

    for (let i = 0; i < count; i++) {
      const ix = i % gridSize
      const iy = Math.floor(i / gridSize) % gridSize
      const iz = Math.floor(i / (gridSize * gridSize))

      // 1. Lerp current → target
      currentPos[i * 3]     += (targetPos[i * 3]     - currentPos[i * 3])     * lf
      currentPos[i * 3 + 1] += (targetPos[i * 3 + 1] - currentPos[i * 3 + 1]) * lf
      currentPos[i * 3 + 2] += (targetPos[i * 3 + 2] - currentPos[i * 3 + 2]) * lf
      currentScale[i]        += (targetScale[i]        - currentScale[i])        * lf

      const sc = Math.max(0, currentScale[i]) * baseScale
      if (sc < 0.001) {
        // Invisible — skip matrix upload with a zero-scale sentinel
        dummy.scale.setScalar(0)
        dummy.position.set(0, 0, 0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
        continue
      }

      // 2. Layered sine-wave displacement (organic breathing)
      //    Three waves at incommensurable frequencies prevent periodicity.
      //    Y wave: driven by X and Z grid positions (creates rolling hills)
      //    X/Z waves: driven by Y and cross-axis (creates lateral wobble)
      const waveY = Math.sin(ix * wf * 0.5 + t)
                  * Math.cos(iz * wf * 0.3 + t * 0.8)
                  * nd * 0.28

      const waveX = Math.cos(iy * wf * 0.4 + t * 1.1)
                  * Math.sin(iz * wf * 0.25 + t * 0.6)
                  * nd * 0.09

      const waveZ = Math.sin(iy * wf * 0.6 + t * 0.9 + iz * 0.4)
                  * nd * 0.09

      // 3. Apply to dummy Object3D
      dummy.position.set(
        currentPos[i * 3]     * spacing + waveX,
        currentPos[i * 3 + 1] * spacing + waveY,
        currentPos[i * 3 + 2] * spacing + waveZ,
      )
      dummy.scale.setScalar(sc)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Background clear colour, driven by the Leva control */}
      <color attach="background" args={[bgColour]} />

      {/* ── Lighting ── */}
      {/* Soft fill — lifts the shadow blacks without washing out depth */}
      <ambientLight intensity={0.35} />

      {/* Key light — main directional, casts shadows from upper-right */}
      <directionalLight
        position={[12, 18, 10]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0005}
      />

      {/* Cool rim — blue-tinted back-left light separates blocks from bg */}
      <directionalLight
        position={[-8, 6, -6]}
        intensity={0.5}
        color="#4466ff"
      />

      {/* Warm ground bounce */}
      <directionalLight
        position={[0, -10, 0]}
        intensity={0.15}
        color="#ffe4b0"
      />

      {/* HDRI studio environment — wrapped in Suspense because Environment
          calls useLoader internally, which suspends on first load */}
      <Suspense fallback={null}>
        <Environment preset="studio" />
      </Suspense>

      {/* ── Geometry ── */}
      {/*
        Single InstancedMesh — MAX_COUNT is the hard ceiling.
        meshRef.current.count is set to gridSize³ so Three.js only
        processes and draws the active portion.
      */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_COUNT]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {/* 0.9 face size with 1.0 spacing = 0.1 gap between blocks */}
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial roughness={0.45} metalness={0.08} />
      </instancedMesh>

      {/* ── Post-Processing ── */}
      <EffectComposer>
        {/* Film grain — OVERLAY blending preserves luminosity of the scene
            while adding photographic texture that matches the reference */}
        {/* opacity wires to blendMode.opacity via the @r3f/postprocessing wrapper */}
        <Noise opacity={filmGrain} />
        {/* Vignette — draws the eye to the centre, frames the composition */}
        <Vignette
          offset={0.28}
          darkness={vignetteStrength}
          eskil={false}
        />
      </EffectComposer>
    </>
  )
}
