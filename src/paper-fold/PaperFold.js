import * as THREE from 'three'

// ── THE BAKERY ───────────────────────────────────────────────────────────────
export const BAKED = {
    paperRotationX  : -1.57, // Tilt
    paperSpinY      : -0.35, // Spin
    paperRollZ      : 0.0,   // NEW: Angle for the entire plane
    wireframe       : true,

    uFoldDepth      : 0.25,  // Increased default depth
    uFoldSpeed      : 0.1,
    uCreaseSharpness: 1.1,

    uFreq1          : 0.2,
    uAngle1         : 0.785,
    uFreq2          : 0.05,
    uAngle2         : 3.49,

    uLineFrequency  : 45.0,
    uPaperRoughness : 0.15,
    uColorPink      : '#f72e62',
    uColorBlue      : '#201fff',
}

const vertexShader = /* glsl */`
uniform float uTime;
uniform float uFoldDepth;
uniform float uFoldSpeed;
uniform float uCreaseSharpness;
uniform float uAngle1;
uniform float uFreq1;
uniform float uAngle2;
uniform float uFreq2;

varying vec2  vUv;
varying float vHeight;

vec2 rotate(vec2 uv, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c) * uv;
}

void main() {
    vUv = uv;
    vec3 pos = position;

    // Layer 1: Main Wave
    vec2 rot1 = rotate(pos.xy, uAngle1);
    float phase1 = (rot1.x * uFreq1) + (uTime * uFoldSpeed);
    float fold1 = pow(abs(fract(phase1) - 0.5) * 2.0, uCreaseSharpness);

    // Layer 2: Harmonic
    vec2 rot2 = rotate(pos.xy, uAngle2);
    float phase2 = (rot2.x * uFreq2) + (uTime * uFoldSpeed * 0.8);
    float fold2 = pow(abs(fract(phase2) - 0.5) * 2.0, uCreaseSharpness);

    float combinedFold = (fold1 + fold2) * 0.5;
    
    // Masking the edges so the plane stays flat at the boundaries
    float mask = smoothstep(1.0, 0.4, uv.y) * smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x);

    float disp = combinedFold * uFoldDepth * mask;
    pos.z += disp;
    vHeight = combinedFold * mask;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = /* glsl */`
uniform vec3 uColorPink;
uniform vec3 uColorBlue;
uniform float uLineFrequency;
uniform float uPaperRoughness;
uniform float uTime;

varying vec2 vUv;
varying float vHeight;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec3 col = mix(uColorBlue, uColorPink, vUv.y + vHeight * 0.3);
    float shadow = smoothstep(-0.2, 1.2, vHeight);
    col *= (0.4 + shadow * 0.6);

    float grid = step(0.98, fract(vUv.x * uLineFrequency)) + step(0.98, fract(vUv.y * uLineFrequency));
    col = mix(col, col * 0.3, grid * 0.3);

    float grain = random(vUv + uTime * 0.01);
    col = mix(col, col + (grain - 0.5) * 0.1, uPaperRoughness);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}
`

export default function initPaperFold(scene) {
    scene.background = null

    const uniforms = {
        uTime           : { value: 0 },
        uFoldDepth      : { value: BAKED.uFoldDepth },
        uFoldSpeed      : { value: BAKED.uFoldSpeed },
        uCreaseSharpness: { value: BAKED.uCreaseSharpness },
        uLineFrequency  : { value: BAKED.uLineFrequency },
        uPaperRoughness : { value: BAKED.uPaperRoughness },
        uAngle1         : { value: BAKED.uAngle1 },
        uFreq1          : { value: BAKED.uFreq1 },
        uAngle2         : { value: BAKED.uAngle2 },
        uFreq2          : { value: BAKED.uFreq2 },
        uColorPink      : { value: new THREE.Color(BAKED.uColorPink) },
        uColorBlue      : { value: new THREE.Color(BAKED.uColorBlue) },
    }

    // Increased segments to 300x300 for high-depth smoothness
    const geometry = new THREE.PlaneGeometry(40, 30, 300, 300)
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
        side        : THREE.DoubleSide,
        wireframe   : BAKED.wireframe,
        transparent : true,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = BAKED.paperRotationX
    mesh.rotation.y = BAKED.paperSpinY
    mesh.rotation.z = BAKED.paperRollZ
    scene.add(mesh)

    return {
        mesh,
        material,
        uniforms,
        update: (delta) => { uniforms.uTime.value += delta }
    }
}