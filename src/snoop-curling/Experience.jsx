import { Physics } from '@react-three/rapier'
import { Environment, ContactShadows } from '@react-three/drei'
import { Suspense } from 'react'
import Lights from './Lights.jsx'
import { Level } from './Level.jsx'
import Player from './Player.jsx'

export default function Experience() {
    return <>
        {/* Safety net: if the screen is black, this pink/grey will show 
            until the environment map loads. */}
        <color args={['#222222']} attach="background" />

        {/* Wrap in Suspense to prevent the "Black Screen of Death" 
            while the heavy arena image is downloading. */}
        <Suspense fallback={null}>
            <Environment 
                files="./textures/arena_background.jpg" 
                background 
                blur={0.08} 
            />
        </Suspense>
        
        <Physics debug={false} gravity={[0, -9.81, 0]}>
            <Lights />
            <Level />
            <Player />
        </Physics>

        <ContactShadows position={[0, 0, 0]} scale={15} blur={2} far={4.5} opacity={0.4} />
    </>
}