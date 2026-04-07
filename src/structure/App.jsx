/**
 * App.jsx — Canvas shell for the Structure experience.
 * Structure.jsx is self-contained: lights, OrbitControls, postprocessing,
 * Leva GUI, and export buttons all live there.
 */

import { Canvas }     from '@react-three/fiber'
import { Structure }  from './Structure'

export function StructureApp() {
  return (
    <Canvas
      // preserveDrawingBuffer required for toDataURL / captureStream in Structure.jsx
      gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }}
      shadows
      // 10×10×10 grid spans ≈10 units.  FOV 22 at this distance frames it cleanly.
      // Structure.jsx applies camera.lookAt(0,0,0) synchronously via useLayoutEffect.
      camera={{ fov: 22, position: [22, 17, 22], near: 0.1, far: 200 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <Structure />
    </Canvas>
  )
}
