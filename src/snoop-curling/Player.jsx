import * as THREE from 'three'
import { RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useState, useRef } from 'react'
import useGame from './stores/useGame.jsx'

export default function Player() {
    const body = useRef()
    const [ , getKeys] = useKeyboardControls()
    const setDistance = useGame((state) => state.setDistance)
    const targetPosition = useGame((state) => state.targetPosition)

    useFrame((state, delta) => {
        const { forward, backward, leftward, rightward, jump } = getKeys()

        // 1. Sweep Logic: Spacebar (jump) reduces damping
        body.current.setLinearDamping(jump ? 0.1 : 1.2)

        // 2. Movement Logic
        const impulse = { x: 0, y: 0, z: 0 }
        const impulseStrength = 40 * delta 

        if (forward) impulse.z -= impulseStrength
        if (backward) impulse.z += impulseStrength
        if (rightward) impulse.x += impulseStrength
        if (leftward) impulse.x -= impulseStrength

        // Apply impulse and wake up the body to ensure it moves
        body.current.applyImpulse(impulse, true)

        // 3. Camera Follow
        const bodyPosition = body.current.translation()
        const cameraPosition = new THREE.Vector3(bodyPosition.x, bodyPosition.y + 1.5, bodyPosition.z + 4.5)
        state.camera.position.lerp(cameraPosition, 0.1)
        state.camera.lookAt(bodyPosition.x, bodyPosition.y, bodyPosition.z)

        // 4. Distance Update
        const dist = Math.sqrt(Math.pow(bodyPosition.x - targetPosition[0], 2) + Math.pow(bodyPosition.z - targetPosition[2], 2))
        setDistance(dist)
    })

    return (
        <RigidBody 
            ref={body} 
            colliders="hull" 
            position={[0, 0.5, 0]} 
            friction={0.01}
            canSleep={false}
        >
            <mesh castShadow>
                <cylinderGeometry args={[0.35, 0.35, 0.25, 32]} />
                <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.2, 0]}>
                <torusGeometry args={[0.12, 0.03, 16, 32]} rotation={[Math.PI / 2, 0, 0]} />
                <meshStandardMaterial color="gold" metalness={1} roughness={0.1} />
            </mesh>
        </RigidBody>
    )
}