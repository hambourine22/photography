import * as THREE from 'three';
import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';

export function createWavySphere(gui) {
    // 1. Shaders loaded via Vite ?raw imports

    // 2. Geometry (High segment count for smooth displacement)
    const geometry = new THREE.SphereGeometry(1.5, 256, 256);

    // 3. Uniforms & Debug Setup
    const debugObject = {
        depthColor: '#999999',
        surfaceColor: '#ffffff'
    };

    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uBigWavesElevation: { value: 0.2 },
            uBigWavesFrequency: { value: new THREE.Vector2(4.0, 1.5) },
            uBigWavesSpeed: { value: 0.75 },
            uDepthColor: { value: new THREE.Color(debugObject.depthColor) },
            uSurfaceColor: { value: new THREE.Color(debugObject.surfaceColor) },
            uColorOffset: { value: 0.08 },
            uColorMultiplier: { value: 5.0 }
        },
        wireframe: false
    });

    // 4. GUI Setup
    const folder = gui.addFolder('Wave Parameters');
    folder.add(material.uniforms.uBigWavesElevation, 'value').min(0).max(1).step(0.01).name('uBigWavesElevation');
    folder.add(material.uniforms.uBigWavesFrequency.value, 'x').min(0).max(10).step(0.1).name('uBigWavesFrequencyX');
    folder.add(material.uniforms.uBigWavesFrequency.value, 'y').min(0).max(10).step(0.1).name('uBigWavesFrequencyY');
    folder.add(material.uniforms.uBigWavesSpeed, 'value').min(0).max(4).step(0.01).name('uBigWavesSpeed');
    
    const colorFolder = gui.addFolder('Colors');
    colorFolder.addColor(debugObject, 'depthColor').name('Depth Color').onChange(() => {
        material.uniforms.uDepthColor.value.set(debugObject.depthColor);
    });
    colorFolder.addColor(debugObject, 'surfaceColor').name('Surface Color').onChange(() => {
        material.uniforms.uSurfaceColor.value.set(debugObject.surfaceColor);
    });
    colorFolder.add(material.uniforms.uColorOffset, 'value').min(-1).max(1).step(0.01).name('uColorOffset');
    colorFolder.add(material.uniforms.uColorMultiplier, 'value').min(0).max(10).step(0.01).name('uColorMultiplier');

    return new THREE.Mesh(geometry, material);
}