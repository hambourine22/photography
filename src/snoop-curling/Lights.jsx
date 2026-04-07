import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Lights()
{
    const light = useRef()
    
    // We keep the light following the stone, but we soften the shadow 
    // and increase the intensity for that 'broadcast' look
    useFrame((state) =>
    {
        light.current.position.z = state.camera.position.z + 1 - 4
        light.current.target.position.z = state.camera.position.z - 4
        light.current.target.updateMatrixWorld()
    })

    return <>
        {/* Main "Broadcast" Light */}
        <directionalLight
            ref={ light }
            castShadow
            position={ [ 4, 8, 1 ] } // Higher elevation for better ice reflections
            intensity={ 3.5 }
            shadow-mapSize={ [ 2048, 2048 ] } // Higher resolution for professional shadows
            shadow-camera-near={ 1 }
            shadow-camera-far={ 20 }
            shadow-camera-top={ 10 }
            shadow-camera-right={ 10 }
            shadow-camera-bottom={ - 10 }
            shadow-camera-left={ - 10 }
            shadow-bias={ -0.0001 } // Reduces shadow artifacts on the ice
        />

        {/* Studio Fill Light - Tinted slightly pink to match the Snoop palette */}
        <ambientLight intensity={ 1.2 } color={ '#ffeef2' } />

        {/* Point light over the "House" (The Target) */}
        <pointLight 
            position={[0, 5, -54]} 
            intensity={10} 
            distance={15} 
            color="#ffffff" 
        />
    </>
}