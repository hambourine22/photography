import * as THREE from 'three'

/**
 * createNodeNetwork — static background node + line layer.
 *
 * Caller owns the scene graph: add network.meshes to scene yourself.
 * Nodes are generated once; connections are computed at creation time.
 * No per-frame update needed — this layer is fully static.
 *
 * @param {object} options
 * @param {number}   options.count     - number of nodes          (default 100)
 * @param {number}   options.rangeX    - X scatter width           (default 13)
 * @param {number}   options.rangeY    - Y scatter height          (default 8)
 * @param {number}   options.rangeZ    - Z scatter depth           (default 2)
 * @param {number}   options.zCenter   - Z centre position        (default -2.5)
 * @param {number}   options.threshold - connection distance limit  (default 1.5)
 * @param {number}   options.opacity   - initial opacity           (default 0.2)
 * @param {number}   options.dotSize   - point size in world units (default 0.025)
 */
export function createNodeNetwork(options = {}) {
    const {
        count     = 100,
        rangeX    = 13,
        rangeY    = 8,
        rangeZ    = 2,
        zCenter   = -2.5,
        threshold = 1.5,
        opacity   = 0.2,
        dotSize   = 0.025,
    } = options

    // ── Generate node positions ────────────────────────────────────────────────
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * rangeX
        positions[i * 3 + 1] = (Math.random() - 0.5) * rangeY
        positions[i * 3 + 2] = zCenter + (Math.random() - 0.5) * rangeZ
    }

    // ── Points ─────────────────────────────────────────────────────────────────
    const pointGeo = new THREE.BufferGeometry()
    pointGeo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))

    const pointMat = new THREE.PointsMaterial({
        color          : 0x1a1a1a,
        size           : dotSize,
        sizeAttenuation: true,
        transparent    : true,
        opacity,
    })

    const points = new THREE.Points(pointGeo, pointMat)

    // ── Line segments (O(n²) pair scan, computed once) ─────────────────────────
    const thresh2    = threshold * threshold
    const linePairs  = []

    for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
            const dx = positions[i * 3]     - positions[j * 3]
            const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
            const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
            if (dx * dx + dy * dy + dz * dz <= thresh2) {
                linePairs.push(
                    positions[i * 3],     positions[i * 3 + 1], positions[i * 3 + 2],
                    positions[j * 3],     positions[j * 3 + 1], positions[j * 3 + 2],
                )
            }
        }
    }

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePairs, 3))

    const lineMat = new THREE.LineBasicMaterial({
        color      : 0x1a1a1a,
        transparent: true,
        opacity,
    })

    const lines = new THREE.LineSegments(lineGeo, lineMat)

    // ── Helpers ────────────────────────────────────────────────────────────────
    const setVisible = v => { points.visible = v; lines.visible = v }
    const setOpacity = v => { pointMat.opacity = v; lineMat.opacity = v }

    return { meshes: [points, lines], setVisible, setOpacity }
}
