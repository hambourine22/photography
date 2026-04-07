import{C as m,I as C,S as y,M as W,a as P,W as F,b as x,P as q,c as k}from"./three.module-Dxk6m3Pq.js";import{E as B,R as G,O as z}from"./OutputPass-tTvVSQ6w.js";import{G as L}from"./lil-gui.esm-CSNn1Ydq.js";function T(r,u){const a=new L({title:"Wobbly Sphere Pro"}),e={sphereSize:4,rotationSpeed:.2,wobbleStrength:.3,wobbleFrequency:2.5,wobbleSpeed:1,lineFrequency:20,lineSharpness:.5,colorPink:"#f72e62",colorBlue:"#201fff",grainScale:15};r.background=new m("#070726");const S=`
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
    `,h=`
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
    `,g=new C(1,64),n=new y({vertexShader:S,fragmentShader:h,uniforms:{uTime:{value:0},uWobbleStrength:{value:e.wobbleStrength},uWobbleFrequency:{value:e.wobbleFrequency},uWobbleSpeed:{value:e.wobbleSpeed},uColorPink:{value:new m(e.colorPink)},uColorBlue:{value:new m(e.colorBlue)},uLineFrequency:{value:e.lineFrequency},uLineSharpness:{value:e.lineSharpness},uGrainScale:{value:e.grainScale}}}),s=new W(g,n);s.scale.setScalar(e.sphereSize),r.add(s);const f=a.addFolder("Geometry");f.add(e,"sphereSize",1,10).onChange(o=>s.scale.setScalar(o)),f.add(e,"rotationSpeed",0,2);const b=a.addFolder("Wobble");b.add(e,"wobbleStrength",0,2).onChange(o=>n.uniforms.uWobbleStrength.value=o),b.add(e,"wobbleFrequency",0,10).onChange(o=>n.uniforms.uWobbleFrequency.value=o),b.add(e,"wobbleSpeed",0,4).onChange(o=>n.uniforms.uWobbleSpeed.value=o);const c=a.addFolder("Pattern & Color");return c.add(e,"lineFrequency",1,100).onChange(o=>n.uniforms.uLineFrequency.value=o),c.add(e,"lineSharpness",0,1).onChange(o=>n.uniforms.uLineSharpness.value=o),c.addColor(e,"colorPink").onChange(o=>n.uniforms.uColorPink.value.set(o)),c.addColor(e,"colorBlue").onChange(o=>n.uniforms.uColorBlue.value.set(o)),{objects:[{mesh:s,material:n}],debugObject:e}}const w=document.querySelector("canvas.webgl");w||console.error("Canvas not found!");const v=new P,t=new F({canvas:w,antialias:!0,alpha:!0});t.outputColorSpace=x;t.setSize(window.innerWidth,window.innerHeight);t.setPixelRatio(Math.min(window.devicePixelRatio,2));const i=new q(45,window.innerWidth/window.innerHeight,.1,100);i.position.set(0,0,15);v.add(i);let l;try{l=T(v,i)}catch(r){console.error("Shader Initialization Failed:",r)}const d=new B(t);d.addPass(new G(v,i));d.addPass(new z);const M=new k,p=()=>{const r=M.getElapsedTime();if(l&&l.objects[0]){const u=l.objects[0];u.material.uniforms.uTime.value=r;const a=l.debugObject.rotationSpeed;u.mesh.rotation.y=r*a,u.mesh.rotation.x=r*(a*.5)}d.render(),window.requestAnimationFrame(p)};p();window.addEventListener("resize",()=>{i.aspect=window.innerWidth/window.innerHeight,i.updateProjectionMatrix(),t.setSize(window.innerWidth,window.innerHeight),d.setSize(window.innerWidth,window.innerHeight)});
