import { RigidBody } from '@react-three/rapier'

export function Level() {
    return <>
        {/* The Ice Floor */}
        <RigidBody type="fixed" friction={0.1}>
            <mesh receiveShadow position={[0, -0.5, -25]}>
                <boxGeometry args={[20, 1, 100]} />
                <meshStandardMaterial color="#f0faff" roughness={0.05} metalness={0.2} />
            </mesh>
        </RigidBody>

        {/* The House (Target) */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -54]}>
            <circleGeometry args={[2, 32]} />
            <meshBasicMaterial color="blue" />
        </mesh>
    </>
}