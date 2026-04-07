import * as THREE from 'three'
import GUI from 'lil-gui'

export default function initColour(scene, camera) {
    const gui = new GUI({ title: 'Wobbly Sphere Pro' })
    
    const debugObject = {
        sphereSize: 4.0,
        rotationSpeed: 0.2,
        wobbleStrength: 0.3,
        wobbleFrequency: 2.5,
        wobbleSpeed: 1.0,
        lineFrequency: 20.0,
        lineSharpness: 0.5,
        colorPink: '#f72e62',
        colorBlue: '#201fff',
        grainScale: 15.0,
    }

    scene.background = new THREE.Color('#070726')

    const vertexShader = `
        uniform float uTime;
        uniform float uWobbleStrength;
        uniform float uWobbleFrequency;
        uniform float uWobbleSpeed;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vWobble;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);

            float wobble = sin(position.x * uWobbleFrequency + uTime * uWobbleSpeed) 
                         * cos(position.y * uWobbleFrequency + uTime * uWobbleSpeed)
                         * sin(position.z * uWobbleFrequency + uTime * uWobbleSpeed);
            
            vWobble = wobble;
            
            vec3 newPosition = position + normal * (wobble * uWobbleStrength);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
    `

    const fragmentShader = `
        uniform vec3 uColorPink;
        uniform vec3 uColorBlue;
        uniform float uTime;
        uniform float uGrainScale;
        uniform float uLineFrequency;
        uniform float uLineSharpness;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying float vWobble;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
            // Pattern
            float stripes = fract(vUv.x * uLineFrequency + vWobble * 0.4);
            stripes = step(uLineSharpness, stripes);

            // Base Gradient
            float mixValue = vUv.y + vWobble * 0.1;
            
            // RGB Split
            float r = mix(uColorBlue.r, uColorPink.r, mixValue + 0.05 * stripes);
            float g = mix(uColorBlue.g, uColorPink.g, mixValue);
            float b = mix(uColorBlue.b, uColorPink.b, mixValue - 0.05 * stripes);
            
            vec3 color = vec3(r, g, b);

            // Fresnel
            float fresnel = pow(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            color += fresnel * 0.4;

            // Grain
            float grain = random(vUv + uTime * 0.001);
            color = mix(color, color + (grain - 0.5) * 0.2, 0.4);

            gl_FragColor = vec4(color, 1.0);
            #include <colorspace_fragment>
        }
    `

    // Reduced detail to 64 for testing; if screen is still blank, lower this further.
    const geometry = new THREE.IcosahedronGeometry(1, 64)
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uTime: { value: 0 },
            uWobbleStrength: { value: debugObject.wobbleStrength },
            uWobbleFrequency: { value: debugObject.wobbleFrequency },
            uWobbleSpeed: { value: debugObject.wobbleSpeed },
            uColorPink: { value: new THREE.Color(debugObject.colorPink) },
            uColorBlue: { value: new THREE.Color(debugObject.colorBlue) },
            uLineFrequency: { value: debugObject.lineFrequency },
            uLineSharpness: { value: debugObject.lineSharpness },
            uGrainScale: { value: debugObject.grainScale }
        }
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.setScalar(debugObject.sphereSize)
    scene.add(mesh)

    // GUI Folders
    const f1 = gui.addFolder('Geometry')
    f1.add(debugObject, 'sphereSize', 1, 10).onChange(v => mesh.scale.setScalar(v))
    f1.add(debugObject, 'rotationSpeed', 0, 2)

    const f2 = gui.addFolder('Wobble')
    f2.add(debugObject, 'wobbleStrength', 0, 2).onChange(v => material.uniforms.uWobbleStrength.value = v)
    f2.add(debugObject, 'wobbleFrequency', 0, 10).onChange(v => material.uniforms.uWobbleFrequency.value = v)
    f2.add(debugObject, 'wobbleSpeed', 0, 4).onChange(v => material.uniforms.uWobbleSpeed.value = v)

    const f3 = gui.addFolder('Pattern & Color')
    f3.add(debugObject, 'lineFrequency', 1, 100).onChange(v => material.uniforms.uLineFrequency.value = v)
    f3.add(debugObject, 'lineSharpness', 0, 1).onChange(v => material.uniforms.uLineSharpness.value = v)
    f3.addColor(debugObject, 'colorPink').onChange(v => material.uniforms.uColorPink.value.set(v))
    f3.addColor(debugObject, 'colorBlue').onChange(v => material.uniforms.uColorBlue.value.set(v))

    return { objects: [{ mesh, material }], debugObject }
}