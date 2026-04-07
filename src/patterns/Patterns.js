import * as THREE from 'three'

/**
 * HUX Patterns — Isometric Wireframe Lattice
 * Hex grid of connected nodes with pulsing opacity via vertex colors.
 */

const COLOR_WHITE = new THREE.Color('#FFFFFF')
const COLOR_PINK = new THREE.Color('#FF2D78')
const COLOR_BLUE = new THREE.Color('#201FFF')

/**
 * Generate hex grid node positions in isometric layout.
 * Returns array of { x, y, z, isAccent }
 */
function generateHexGrid(cols, rows, spacing) {
    const nodes = []
    const accentIndices = new Set([4, 11, 19, 27])
    let index = 0
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * spacing + (row % 2) * (spacing * 0.5)
            const z = row * spacing * 0.866
            nodes.push({
                x: x - (cols * spacing) / 2,
                y: 0,
                z: z - (rows * spacing * 0.866) / 2,
                isAccent: accentIndices.has(index),
                index
            })
            index++
        }
    }
    return nodes
}

/**
 * Find neighbours within a distance threshold.
 */
function findNeighbours(nodes, threshold) {
    const edges = []
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dz = nodes[i].z - nodes[j].z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist < threshold) {
                edges.push([i, j])
            }
        }
    }
    return edges
}

export default class Patterns {
    constructor() {
        this.linesMesh = null
        this.pointsMesh = null
        this.nodes = []
        this.edges = []
        this.lineColorAttr = null
        this.pointColorAttr = null
        this.nodeToLineVertices = {}
        this.elapsedTime = 0
    }

    init(scene) {
        const SPACING = 2.0
        const COLS = 6
        const ROWS = 6
        const NEIGHBOUR_THRESHOLD = SPACING * 1.15

        this.nodes = generateHexGrid(COLS, ROWS, SPACING)
        this.edges = findNeighbours(this.nodes, NEIGHBOUR_THRESHOLD)

        // --- Line Segments ---
        const lineVertexCount = this.edges.length * 2
        const positions = new Float32Array(lineVertexCount * 3)
        const colors = new Float32Array(lineVertexCount * 3)

        // Map: nodeIndex -> array of vertex indices in the line geometry
        for (let i = 0; i < this.nodes.length; i++) {
            this.nodeToLineVertices[i] = []
        }

        for (let e = 0; e < this.edges.length; e++) {
            const [a, b] = this.edges[e]
            const nA = this.nodes[a]
            const nB = this.nodes[b]
            const vi = e * 2

            positions[vi * 3]     = nA.x
            positions[vi * 3 + 1] = nA.y
            positions[vi * 3 + 2] = nA.z

            positions[(vi + 1) * 3]     = nB.x
            positions[(vi + 1) * 3 + 1] = nB.y
            positions[(vi + 1) * 3 + 2] = nB.z

            // Each vertex of a line segment belongs to the node at that end
            this.nodeToLineVertices[a].push(vi)
            this.nodeToLineVertices[b].push(vi + 1)

            // Init colors to white
            colors[vi * 3] = 1; colors[vi * 3 + 1] = 1; colors[vi * 3 + 2] = 1
            colors[(vi + 1) * 3] = 1; colors[(vi + 1) * 3 + 1] = 1; colors[(vi + 1) * 3 + 2] = 1
        }

        const lineGeom = new THREE.BufferGeometry()
        lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        lineGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.lineColorAttr = lineGeom.attributes.color

        const lineMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 1.0
        })

        this.linesMesh = new THREE.LineSegments(lineGeom, lineMat)
        scene.add(this.linesMesh)

        // --- Points at nodes ---
        const pointPositions = new Float32Array(this.nodes.length * 3)
        const pointColors = new Float32Array(this.nodes.length * 3)

        for (let i = 0; i < this.nodes.length; i++) {
            pointPositions[i * 3]     = this.nodes[i].x
            pointPositions[i * 3 + 1] = this.nodes[i].y
            pointPositions[i * 3 + 2] = this.nodes[i].z
            pointColors[i * 3] = 1; pointColors[i * 3 + 1] = 1; pointColors[i * 3 + 2] = 1
        }

        const pointGeom = new THREE.BufferGeometry()
        pointGeom.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3))
        pointGeom.setAttribute('color', new THREE.BufferAttribute(pointColors, 3))
        this.pointColorAttr = pointGeom.attributes.color

        const pointMat = new THREE.PointsMaterial({
            size: 2.0,
            vertexColors: true,
            transparent: true,
            sizeAttenuation: false
        })

        this.pointsMesh = new THREE.Points(pointGeom, pointMat)
        scene.add(this.pointsMesh)
    }

    animate(delta) {
        this.elapsedTime += delta
        const t = this.elapsedTime

        const lineColors = this.lineColorAttr.array
        const pointColors = this.pointColorAttr.array

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i]
            const phase = node.index * 0.6
            const brightness = 0.15 + 0.85 * Math.abs(Math.sin(t * 0.8 + phase))

            // Determine base color for this node
            let r, g, b
            if (node.isAccent) {
                // Accent nodes pulse out of phase by 1.2
                const accentBrightness = 0.15 + 0.85 * Math.abs(Math.sin(t * 0.8 + phase + 1.2))
                // Alternate between pink and blue accents
                if (node.index % 2 === 0) {
                    r = COLOR_PINK.r * accentBrightness
                    g = COLOR_PINK.g * accentBrightness
                    b = COLOR_PINK.b * accentBrightness
                } else {
                    r = COLOR_BLUE.r * accentBrightness
                    g = COLOR_BLUE.g * accentBrightness
                    b = COLOR_BLUE.b * accentBrightness
                }
            } else {
                r = brightness
                g = brightness
                b = brightness
            }

            // Update line vertices belonging to this node
            const verts = this.nodeToLineVertices[i]
            for (let v = 0; v < verts.length; v++) {
                const vi = verts[v]
                lineColors[vi * 3]     = r
                lineColors[vi * 3 + 1] = g
                lineColors[vi * 3 + 2] = b
            }

            // Update point color with phase shift of 0.3
            const pointPhase = phase + 0.3
            const pointBrightness = 0.15 + 0.85 * Math.abs(Math.sin(t * 0.8 + pointPhase))
            if (node.isAccent) {
                const accentPB = 0.15 + 0.85 * Math.abs(Math.sin(t * 0.8 + pointPhase + 1.2))
                if (node.index % 2 === 0) {
                    pointColors[i * 3]     = COLOR_PINK.r * accentPB
                    pointColors[i * 3 + 1] = COLOR_PINK.g * accentPB
                    pointColors[i * 3 + 2] = COLOR_PINK.b * accentPB
                } else {
                    pointColors[i * 3]     = COLOR_BLUE.r * accentPB
                    pointColors[i * 3 + 1] = COLOR_BLUE.g * accentPB
                    pointColors[i * 3 + 2] = COLOR_BLUE.b * accentPB
                }
            } else {
                pointColors[i * 3]     = pointBrightness
                pointColors[i * 3 + 1] = pointBrightness
                pointColors[i * 3 + 2] = pointBrightness
            }
        }

        this.lineColorAttr.needsUpdate = true
        this.pointColorAttr.needsUpdate = true
    }

    cleanup() {
        if (this.linesMesh) {
            this.linesMesh.geometry.dispose()
            this.linesMesh.material.dispose()
        }
        if (this.pointsMesh) {
            this.pointsMesh.geometry.dispose()
            this.pointsMesh.material.dispose()
        }
    }
}
