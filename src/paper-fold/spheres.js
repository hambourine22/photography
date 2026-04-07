import * as THREE from 'three'

// ── Colour palette ─────────────────────────────────────────────────────────────
const COL = {
    blue   : '#201fff',
    pink   : '#f72e62',
    grey   : '#f4f4f4',
    midGrey: '#c9c9c9',
    slate  : '#a0a0a0',
}

// ── Sphere definitions, grouped by colour ─────────────────────────────────────
// Each entry: { r, x, y, z }
const GROUPS = {
    blue: [
        { r: 0.70, x: -4.2,  y:  1.5,  z: -1.5 },
        { r: 0.18, x:  3.8,  y: -1.2,  z: -1.0 },
    ],
    pink: [
        { r: 0.60, x:  2.8,  y:  2.2,  z: -2.0 },
        { r: 0.35, x: -2.0,  y: -2.0,  z: -1.3 },
    ],
    grey: [
        { r: 0.40, x: -5.0,  y:  0.2,  z: -2.2 },
        { r: 0.12, x:  1.2,  y:  3.2,  z: -1.8 },
    ],
    midGrey: [
        { r: 0.32, x:  4.5,  y:  0.8,  z: -1.8 },
        { r: 0.18, x: -1.5,  y: -3.0,  z: -1.5 },
    ],
    slate: [
        { r: 0.45, x: -3.5,  y:  2.8,  z: -2.3 },
        { r: 0.20, x:  0.5,  y: -1.8,  z: -2.0 },
    ],
}

/**
 * createAccentSpheres — static decorative sphere placer.
 *
 * Caller owns the scene graph: add spheres.meshes to scene yourself.
 * Returns per-colour-group visibility control for GUI checkboxes.
 */
export function createAccentSpheres() {
    const groupMeshes = {}
    const allMeshes   = []

    for (const [groupName, defs] of Object.entries(GROUPS)) {
        const colour  = COL[groupName]
        const meshes  = defs.map(({ r, x, y, z }) => {
            const geo  = new THREE.SphereGeometry(r, 32, 24)
            const mat  = new THREE.MeshBasicMaterial({ color: new THREE.Color(colour) })
            const mesh = new THREE.Mesh(geo, mat)
            mesh.position.set(x, y, z)
            return mesh
        })
        groupMeshes[groupName] = meshes
        allMeshes.push(...meshes)
    }

    // Show/hide all
    const setVisible = v => allMeshes.forEach(m => { m.visible = v })

    // Show/hide a single colour group: setGroupVisible('blue', false)
    const setGroupVisible = (name, v) => {
        groupMeshes[name]?.forEach(m => { m.visible = v })
    }

    return { meshes: allMeshes, setVisible, setGroupVisible }
}
