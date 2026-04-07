import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import initColour from './Colour.js'

const canvas = document.querySelector('canvas.webgl')
if (!canvas) console.error("Canvas not found!")

const scene = new THREE.Scene()

const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true,
    alpha: true 
})
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Set camera further back (Z: 15) to ensure we aren't inside the 4.0 size sphere
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(0, 0, 15)
scene.add(camera)

// Initialize Colour (Catch errors to see if shader compilation failed)
let colourData
try {
    colourData = initColour(scene, camera)
} catch (error) {
    console.error("Shader Initialization Failed:", error)
}

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
composer.addPass(new OutputPass())

const clock = new THREE.Clock()

const tick = () => {
    const elapsedTime = clock.getElapsedTime()

    if (colourData && colourData.objects[0]) {
        const hero = colourData.objects[0]
        
        // Update Time Uniform
        hero.material.uniforms.uTime.value = elapsedTime
        
        // Update Rotation logic
        const speed = colourData.debugObject.rotationSpeed
        hero.mesh.rotation.y = elapsedTime * speed
        hero.mesh.rotation.x = elapsedTime * (speed * 0.5)
    }

    composer.render()
    window.requestAnimationFrame(tick)
}

tick()

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
})