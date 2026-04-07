import * as THREE from 'three'
import { color } from '../tokens.js'

// ── GLSL: Perlin Noise ────────────────────────────────────────────────────────
const GLSL_CNOISE = /* glsl */`
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x,289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159-0.85373472095314*r; }
vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P){
  vec3 Pi0=floor(P), Pi1=Pi0+1.0;
  Pi0=mod(Pi0,289.0); Pi1=mod(Pi1,289.0);
  vec3 Pf0=fract(P), Pf1=Pf0-1.0;
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
  vec4 iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz, iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+iz0), ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0/7.0, gy0=fract(floor(gx0)/7.0)-0.5;
  gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);
  vec4 sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(0.0,gx0)-0.5); gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1/7.0, gy1=fract(floor(gx1)/7.0)-0.5;
  gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);
  vec4 sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(0.0,gx1)-0.5); gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x), g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z), g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x), g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z), g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x; g010*=norm0.y; g100*=norm0.z; g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x; g011*=norm1.y; g101*=norm1.z; g111*=norm1.w;
  float n000=dot(g000,Pf0),          n100=dot(g100,vec3(Pf1.x,Pf0.yz));
  float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)), n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),       n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011=dot(g011,vec3(Pf0.x,Pf1.yz)),       n111=dot(g111,Pf1);
  vec3 fade_xyz=fade(Pf0);
  vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);
  return 2.2*mix(n_yz.x,n_yz.y,fade_xyz.x);
}
`

const vertexShader = /* glsl */`
${GLSL_CNOISE}
uniform float uTime;
uniform float uBigWavesElevation;
uniform float uBigWavesFrequency;
uniform float uBigWavesSpeed;
varying vec3 vOriginalNormal;

void main() {
    vOriginalNormal = normal;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    float elevation = cnoise(vec3(
        worldPos.x * uBigWavesFrequency,
        worldPos.z * uBigWavesFrequency,
        uTime * uBigWavesSpeed
    )) * uBigWavesElevation;

    vec3 displaced = position;
    displaced.y += elevation;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`

const fragmentShader = /* glsl */`
uniform vec3 uColorTop;
uniform vec3 uColorFront;
uniform vec3 uColorSide;
varying vec3 vOriginalNormal;

void main() {
    vec3 col;
    if      (vOriginalNormal.y >  0.9) { col = uColorTop;   }
    else if (vOriginalNormal.x >  0.9) { col = uColorFront; }
    else if (vOriginalNormal.z < -0.9) { col = uColorFront; }
    else                               { col = uColorSide;  }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}
`

export default function initDesignTokens(scene) {
    const uniforms = {
        uTime              : { value: 0 },
        uBigWavesElevation : { value: 0.152 },
        uBigWavesFrequency : { value: 2.5 },
        uBigWavesSpeed     : { value: 1.0 },
        uGapMax            : { value: 0.6 }, 
        uColorTop          : { value: new THREE.Color(color.pink) },
        uColorFront        : { value: new THREE.Color(color.blue100) },
        uColorSide         : { value: new THREE.Color(color.blue85) },
    }

    const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    const boxGeo = new THREE.BoxGeometry(1, 1, 1, 32, 32, 32)
    const cubes = []
    const clusterGrid = []

    for (let xi = 0; xi < 2; xi++)
    for (let yi = 0; yi < 2; yi++)
    for (let zi = 0; zi < 2; zi++) {
        const mesh = new THREE.Mesh(boxGeo, material)
        scene.add(mesh)
        cubes.push(mesh)
        clusterGrid.push({ mesh, xi, yi, zi })
    }

    function update(delta = 0.016) {
        uniforms.uTime.value += delta
        const elapsedTime = uniforms.uTime.value
        const currentGap = (Math.sin(elapsedTime * 1.0) * 0.5 + 0.5) * uniforms.uGapMax.value
        const step = 1 + currentGap

        clusterGrid.forEach(({ mesh, xi, yi, zi }) => {
            mesh.position.set((xi - 0.5) * step, (yi - 0.5) * step, (zi - 0.5) * step)
        })
    }

    return { cubes, uniforms, update, material }
}