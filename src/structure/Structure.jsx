/**
 * Structure.jsx — GPU-driven voxel visualisation
 * ─────────────────────────────────────────────────────────────────────────────
 * Performance contract:
 *   • CPU work per frame: zero matrix uploads. One InstancedMesh, 1 000 identity
 *     matrices set once in useLayoutEffect and never touched again.
 *   • All position/scale/colour logic lives in the GLSL vertex shader (VoxelShader.js).
 *   • Per-frame CPU cost: 5 uniform.value writes + OrbitControls damping update.
 *
 * Post-processing stack:
 *   N8AO  — ambient occlusion for architectural contact shadows in carved state.
 *   Bloom — gentle glow on HUX blue/pink colours; low threshold so only the
 *            bright accent colours bloom, not the grey masses.
 *   Noise — filmic grain at low opacity to match the Vercel reference aesthetic.
 *
 * Export:
 *   4K Still — resize renderer → 4096 × 2304, wait 2 rAF frames, toDataURL, restore.
 *   4K WebM  — resize → 3840 × 2160, MediaRecorder @ 25 Mbps VP9, 30 s, restore.
 *   Both require `preserveDrawingBuffer: true` on the parent Canvas.
 */

import {
  useRef, useMemo, useLayoutEffect, Suspense, useCallback,
} from 'react'
import { useFrame, useThree }       from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import {
  EffectComposer, N8AO, Bloom, Noise, Vignette,
} from '@react-three/postprocessing'
import { useControls, button, folder } from 'leva'
import * as THREE                      from 'three'
import { patchMaterial, COUNT, GRID_SIZE } from './VoxelShader'

// ─── Export utilities ─────────────────────────────────────────────────────────

function waitFrames(n = 2) {
  return new Promise(resolve => {
    let count = 0
    const tick = () => (++count >= n ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
}

async function exportStill(gl) {
  const prevSize  = new THREE.Vector2()
  const prevRatio = gl.getPixelRatio()
  gl.getSize(prevSize)

  gl.setPixelRatio(1)
  gl.setSize(4096, 2304, false)
  await waitFrames(2)

  const url = gl.domElement.toDataURL('image/png')
  Object.assign(document.createElement('a'), {
    href: url, download: `hux-structure-4k-${Date.now()}.png`,
  }).click()

  gl.setPixelRatio(prevRatio)
  gl.setSize(prevSize.x, prevSize.y, false)
}

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
    mimeType, videoBitsPerSecond: 25_000_000,
  })

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
    Object.assign(document.createElement('a'), {
      href: url, download: `hux-structure-4k-${Date.now()}.webm`,
    }).click()
    URL.revokeObjectURL(url)
    gl.setPixelRatio(prevRatio)
    gl.setSize(prevSize.x, prevSize.y, false)
    onStop()
  }

  recorder.start(200)
  onStart()
  setTimeout(() => recorder.stop(), 30_000)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Structure() {
  const meshRef    = useRef(null)
  const matRef     = useRef(null)
  const uniformsRef = useRef(null)   // populated by patchMaterial at compile time
  const { gl, camera } = useThree()

  // ── Leva controls ──────────────────────────────────────────────────────────
  const {
    transition,
    wobbleEnabled,
    wobbleAmplitude,
    huxTheme,
    aoIntensity,
    aoRadius,
    bloomIntensity,
    filmGrain,
  } = useControls({
    'Structure': folder({
      transition: {
        value: 0, min: 0, max: 3, step: 0.01,
        label: 'Transition (0 → 3)',
      },
      wobbleEnabled:   { value: true,  label: 'Wobble' },
      wobbleAmplitude: { value: 0.4,   min: 0, max: 2, step: 0.05, label: 'Wobble Strength' },
    }),
    'Colour': folder({
      huxTheme: {
        value: 'Greyscale',
        options: ['Greyscale', 'HUX Blue', 'HUX Pink'],
        label: 'Theme',
      },
    }),
    'Post-Processing': folder({
      aoIntensity:    { value: 5,    min: 0, max: 15,  step: 0.5,  label: 'AO Intensity' },
      aoRadius:       { value: 0.4,  min: 0, max: 2,   step: 0.01, label: 'AO Radius' },
      bloomIntensity: { value: 0.3,  min: 0, max: 2,   step: 0.05, label: 'Bloom' },
      filmGrain:      { value: 0.04, min: 0, max: 0.5, step: 0.01, label: 'Film Grain' },
    }),
    'Export': folder({
      'Render 4K Still':        button(() => exportStill(gl)),
      'Render 4K 30s Video (WebM)': button(() => exportVideo(
        gl,
        () => console.info('[HUX] Recording 4K — 30 s'),
        () => console.info('[HUX] Download complete'),
      )),
    }),
  })

  // ── Camera orientation (synchronous — before first useFrame tick) ──────────
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera])

  // ── Material — patched MeshStandardMaterial ────────────────────────────────
  // useMemo so the material is created once; patchMaterial runs onBeforeCompile
  // which Three.js calls on first render when the GPU program is compiled.
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.42,
      metalness: 0.06,
      color:     0xffffff,   // white so vVoxelColour multiply shows correctly
    })
    patchMaterial(mat, uniformsRef)
    return mat
  }, [])   // never recreated

  // ── InstancedMesh setup — identity matrices, set once ─────────────────────
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const identity = new THREE.Matrix4()
    for (let i = 0; i < COUNT; i++) mesh.setMatrixAt(i, identity)
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)   // hint to GPU: never changes
  }, [])

  // ── Per-frame uniform update — the ONLY CPU work per frame ────────────────
  useFrame(({ clock }) => {
    const u = uniformsRef.current
    if (!u) return

    u.uTime.value          = clock.elapsedTime
    u.uTransition.value    = transition
    u.uWobbleEnabled.value = wobbleEnabled ? 1.0 : 0.0
    u.uWobbleAmp.value     = wobbleAmplitude
    u.uTheme.value         = huxTheme === 'Greyscale' ? 0.0
                           : huxTheme === 'HUX Blue'  ? 1.0 : 2.0
  })

  // ── Scene ──────────────────────────────────────────────────────────────────
  return (
    <>
      <color attach="background" args={['#1e1e1e']} />

      {/* ── Lighting ── */}
      {/* Low ambient keeps the shadow crevices dark — N8AO fills the AO detail */}
      <ambientLight intensity={0.2} />

      {/* Key light — raking angle to reveal the wave topology */}
      <directionalLight
        position={[10, 16, 8]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0006}
      />

      {/* Cool rim — separates rear voxels from the dark background */}
      <directionalLight position={[-7, 6, -6]}  intensity={0.4} color="#ffffff" />

      {/* Warm fill — softens shadow underside of raised voxels */}
      <directionalLight position={[2, -10, 3]} intensity={0.1} color="#ffe4b0" />

      {/* HDRI — Suspense required: Environment uses useLoader which suspends */}
      <Suspense fallback={null}>
        <Environment preset="studio" />
      </Suspense>

      {/* Orbit controls — damped for a cinematic, weighty feel */}
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minPolarAngle={Math.PI * 0.06}
        maxPolarAngle={Math.PI * 0.52}
        dampingFactor={0.05}
        enableDamping
      />

      {/* ── Geometry ── */}
      {/*
        Single InstancedMesh — 1 draw call for all 1 000 voxels.
        StaticDrawUsage on instanceMatrix tells the GPU driver the buffer
        won't change, enabling further optimisations on the driver side.
        frustumCulled=false because the bounding sphere is computed for the
        solid cube; exploded state extends well beyond it and would cull.
      */}
      <instancedMesh
        ref={meshRef}
        args={[null, null, COUNT]}
        material={material}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {/* 0.92 side length → 0.08 gap between cubes for N8AO to shade */}
        <boxGeometry args={[0.92, 0.92, 0.92]} />
      </instancedMesh>

      {/* ── Post-Processing ── */}
      <EffectComposer>
        {/*
          N8AO — screen-space ambient occlusion.
          Reads from the depth buffer (no separate normalPass needed).
          Creates the contact shadows between adjacent voxels that give
          the architectural carved state its depth.
        */}
        <N8AO
          aoRadius={aoRadius}
          intensity={aoIntensity}
          aoSamples={16}
          denoiseSamples={4}
          denoiseRadius={12}
          distanceFalloff={1.0}
          screenSpaceRadius={false}
          color="black"
        />

        {/*
          Bloom — luminanceThreshold=0.65 means only the HUX blue/pink
          fragments (which are bright) bloom; the grey masses do not.
          mipmapBlur gives a wide, soft halo at minimal GPU cost.
        */}
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.65}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.75}
        />

        {/* Film grain — barely perceptible at 0.04; removes the synthetic look */}
        <Noise opacity={filmGrain} />

        {/* Vignette — frames the composition, eye drawn to wave centre */}
        <Vignette offset={0.25} darkness={0.55} eskil={false} />
      </EffectComposer>
    </>
  )
}
