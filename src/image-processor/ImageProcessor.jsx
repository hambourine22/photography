/**
 * ImageProcessor.jsx
 * HUX 4K Image Grading Tool
 *
 * Stack: React-Three-Fiber · @react-three/postprocessing · Leva
 *
 * Usage:
 *   import ImageProcessor from './image-processor/ImageProcessor.jsx'
 *   <ImageProcessor src="/images/photo.jpg" lutSrc="/luts/film.cube" />
 *
 * 4K Export:
 *   The "Render to 4K" button triggers an OffscreenCanvas render at the
 *   source image's native resolution, then downloads the result as a PNG.
 */

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useThree, useFrame, extend } from '@react-three/fiber'
import { EffectComposer, ShaderPass } from '@react-three/postprocessing'
import { useControls, button, folder, Leva } from 'leva'
import * as THREE from 'three'

import { PhotographicShader } from './PhotographicShader.js'

// Register ShaderPass so <shaderPass> JSX works
extend({ ShaderPass })

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a .cube LUT file into a flat Float32Array and return { data, size } */
function parseCubeLUT(text) {
  const lines = text.split('\n')
  let size = 32
  const entries = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1], 10)
      continue
    }
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('TITLE')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length === 3 && !isNaN(parseFloat(parts[0]))) {
      entries.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]))
    }
  }

  return { data: new Float32Array(entries), size }
}

/** Build a neutral (identity) LUT for use when no .cube file is provided */
function buildIdentityLUT(size = 16) {
  const data = new Float32Array(size * size * size * 3)
  let i = 0
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        data[i++] = r / (size - 1)
        data[i++] = g / (size - 1)
        data[i++] = b / (size - 1)
      }
    }
  }
  return { data, size }
}

/** Load an image URL → HTMLImageElement (promise) */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GradingEffect — the ShaderPass wired to Leva controls
// ─────────────────────────────────────────────────────────────────────────────

function GradingEffect({ lut, lutSize, params }) {
  const passRef = useRef()
  const { size } = useThree()

  useEffect(() => {
    if (!passRef.current) return
    const u = passRef.current.uniforms
    u.resolution.value.set(size.width, size.height)
  }, [size])

  useFrame(() => {
    if (!passRef.current) return
    const u = passRef.current.uniforms

    u.exposure.value    = params.exposure
    u.contrast.value    = params.contrast
    u.brightness.value  = params.brightness
    u.highlights.value  = params.highlights
    u.shadows.value     = params.shadows
    u.whites.value      = params.whites
    u.blacks.value      = params.blacks
    u.clarity.value     = params.clarity
    u.vibrance.value    = params.vibrance
    u.saturation.value  = params.saturation

    if (lut) {
      u.tLUT.value    = lut
      u.lutSize.value = lutSize
    } else {
      u.lutSize.value = 0  // signal shader to skip LUT
    }
  })

  return (
    <EffectComposer>
      {/* @react-three/postprocessing EffectComposer wraps Three's pipeline */}
      <shaderPass
        ref={passRef}
        args={[PhotographicShader]}
        uniforms-resolution-value={new THREE.Vector2(size.width, size.height)}
      />
    </EffectComposer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene — fullscreen textured quad
// ─────────────────────────────────────────────────────────────────────────────

function Scene({ texture, lut, lutSize, params }) {
  const { viewport } = useThree()

  // Fit image to viewport while preserving aspect
  const imgAspect  = texture ? texture.image.width / texture.image.height : 1
  const viewAspect = viewport.width / viewport.height
  const scale = viewAspect > imgAspect
    ? [viewport.height * imgAspect, viewport.height, 1]
    : [viewport.width,  viewport.width / imgAspect, 1]

  return (
    <>
      <mesh scale={scale}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {texture && <GradingEffect lut={lut} lutSize={lutSize} params={params} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4K Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the graded image at full source resolution using an OffscreenCanvas.
 * Bypasses the viewport size entirely.
 */
async function exportTo4K({ imageSrc, params, lut, lutSize }) {
  const img = await loadImage(imageSrc)
  const W = img.naturalWidth
  const H = img.naturalHeight

  const offscreen = new OffscreenCanvas(W, H)

  const renderer = new THREE.WebGLRenderer({ canvas: offscreen, antialias: false, alpha: false })
  renderer.setSize(W, H, false)
  renderer.setPixelRatio(1)

  const scene  = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1)

  const texture = new THREE.Texture(img)
  texture.needsUpdate = true

  const geo  = new THREE.PlaneGeometry(1, 1)
  const mat  = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  scene.add(new THREE.Mesh(geo, mat))

  // Postprocessing
  const { EffectComposer: EC } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
  const { RenderPass }         = await import('three/examples/jsm/postprocessing/RenderPass.js')
  const { ShaderPass: SP }     = await import('three/examples/jsm/postprocessing/ShaderPass.js')

  const composer = new EC(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const pass = new SP(PhotographicShader)
  const u    = pass.uniforms

  u.resolution.value = new THREE.Vector2(W, H)
  u.exposure.value   = params.exposure
  u.contrast.value   = params.contrast
  u.brightness.value = params.brightness
  u.highlights.value = params.highlights
  u.shadows.value    = params.shadows
  u.whites.value     = params.whites
  u.blacks.value     = params.blacks
  u.clarity.value    = params.clarity
  u.vibrance.value   = params.vibrance
  u.saturation.value = params.saturation
  u.lutSize.value    = lut ? lutSize : 0
  if (lut) u.tLUT.value = lut

  composer.addPass(pass)
  composer.render()

  const blob = await offscreen.convertToBlob({ type: 'image/png' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'hux-graded-4k.png'
  a.click()
  URL.revokeObjectURL(url)

  renderer.dispose()
}

// ─────────────────────────────────────────────────────────────────────────────
// Leva Controls
// ─────────────────────────────────────────────────────────────────────────────

function useGradingControls(onExport) {
  return useControls({
    'Image Grading': folder({
      exposure:   { value: 0, min: -4,  max: 4,   step: 0.01, label: 'Exposure (EV)' },
      brightness: { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Brightness'    },
      contrast:   { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Contrast'      },
    }),
    'Tonal Range': folder({
      highlights: { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Highlights'    },
      shadows:    { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Shadows'       },
      whites:     { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Whites'        },
      blacks:     { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Blacks'        },
    }),
    'Detail': folder({
      clarity:    { value: 0, min: 0,   max: 1,   step: 0.01, label: 'Clarity'       },
    }),
    'Color': folder({
      saturation: { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Saturation'    },
      vibrance:   { value: 0, min: -1,  max: 1,   step: 0.01, label: 'Vibrance'      },
    }),
    'Export': folder({
      'Render to 4K': button(onExport),
    }),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ImageProcessor
 *
 * @param {string}  src      - URL of the source image (required)
 * @param {string}  [lutSrc] - URL of a .cube LUT file (optional)
 */
export default function ImageProcessor({ src, lutSrc }) {
  const [texture, setTexture] = useState(null)
  const [lut,     setLut]     = useState(null)
  const [lutSize, setLutSize] = useState(0)

  // Load source image
  useEffect(() => {
    if (!src) return
    loadImage(src).then(img => {
      const tex = new THREE.Texture(img)
      tex.needsUpdate = true
      setTexture(tex)
    })
  }, [src])

  // Load LUT or fall back to identity
  useEffect(() => {
    if (!lutSrc) {
      const { data, size } = buildIdentityLUT(16)
      const t = new THREE.Data3DTexture(data, size, size, size)
      t.format = THREE.RGBFormat
      t.type   = THREE.FloatType
      t.minFilter = t.magFilter = THREE.LinearFilter
      t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping
      t.needsUpdate = true
      setLut(t)
      setLutSize(size)
      return
    }

    fetch(lutSrc)
      .then(r => r.text())
      .then(text => {
        const { data, size } = parseCubeLUT(text)
        const t = new THREE.Data3DTexture(data, size, size, size)
        t.format = THREE.RGBFormat
        t.type   = THREE.FloatType
        t.minFilter = t.magFilter = THREE.LinearFilter
        t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping
        t.needsUpdate = true
        setLut(t)
        setLutSize(size)
      })
  }, [lutSrc])

  const handleExport = useCallback(() => {
    exportTo4K({ imageSrc: src, params, lut, lutSize })
  }, [src, lut, lutSize]) // params captured via closure from Leva store

  const params = useGradingControls(handleExport)

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', position: 'relative' }}>
      {/* Leva panel — docked top-right */}
      <Leva
        theme={{
          colors: {
            elevation1: '#111',
            elevation2: '#1a1a1a',
            elevation3: '#222',
            accent1:    '#201fff',
            accent2:    '#3d3dff',
            highlight1: '#555',
            highlight2: '#777',
            highlight3: '#fff',
          },
          fontSizes: { root: '11px' },
        }}
        titleBar={{ title: 'HUX · Image Grading', drag: true, filter: false }}
      />

      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        camera={{ near: 0.1, far: 10, position: [0, 0, 1] }}
        orthographic
      >
        <Suspense fallback={null}>
          <Scene
            texture={texture}
            lut={lut}
            lutSize={lutSize}
            params={params}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
