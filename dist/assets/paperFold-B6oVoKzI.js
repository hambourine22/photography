import{C as m,e as y,S,D as x,M as R,a as P,W as A,P as b}from"./three.module-rN4qoPaD.js";const e={paperRotationX:-1.57,paperSpinY:-.35,paperRollZ:0,wireframe:!0,uFoldDepth:.25,uFoldSpeed:.1,uCreaseSharpness:1.1,uFreq1:.2,uAngle1:.785,uFreq2:.05,uAngle2:3.49,uLineFrequency:45,uPaperRoughness:.15,uColorPink:"#f72e62",uColorBlue:"#201fff"},q=`
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
`,k=`
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
`;function M(o){o.background=null;const t={uTime:{value:0},uFoldDepth:{value:e.uFoldDepth},uFoldSpeed:{value:e.uFoldSpeed},uCreaseSharpness:{value:e.uCreaseSharpness},uLineFrequency:{value:e.uLineFrequency},uPaperRoughness:{value:e.uPaperRoughness},uAngle1:{value:e.uAngle1},uFreq1:{value:e.uFreq1},uAngle2:{value:e.uAngle2},uFreq2:{value:e.uFreq2},uColorPink:{value:new m(e.uColorPink)},uColorBlue:{value:new m(e.uColorBlue)}},u=new y(40,30,300,300),n=new S({vertexShader:q,fragmentShader:k,uniforms:t,side:x,wireframe:e.wireframe,transparent:!0}),i=new R(u,n);return i.rotation.x=e.paperRotationX,i.rotation.y=e.paperSpinY,i.rotation.z=e.paperRollZ,o.add(i),{mesh:i,material:n,uniforms:t,update:C=>{t.uTime.value+=C}}}const l=3.5,L=-2.5,f=11,T=32,D=.05,h=document.querySelector("canvas.webgl"),w=new P,r=new A({canvas:h,antialias:!0,alpha:!0,preserveDrawingBuffer:!0});r.setClearColor(0,0);r.setSize(window.innerWidth,window.innerHeight);r.setPixelRatio(Math.min(window.devicePixelRatio,2));const a=new b(T,window.innerWidth/window.innerHeight,.1,1e3);a.position.set(0,l,f);a.lookAt(0,0,0);const H=M(w);let g=l,c=l;window.addEventListener("message",o=>{if(o.data?.type==="scroll"){const t=Math.min(Math.max(o.data.progress,0),1);g=l+(L-l)*t}});let p=!1,s;const d=[],U=()=>{console.log("Started recording..."),p=!0;const o=h.captureStream(60);s=new MediaRecorder(o,{mimeType:"video/webm; codecs=vp9"}),s.ondataavailable=t=>{t.data.size>0&&d.push(t.data)},s.onstop=()=>{const t=new Blob(d,{type:"video/webm"}),u=URL.createObjectURL(t),n=document.createElement("a");n.href=u,n.download="hux-paper-fold-export.webm",n.click(),d.length=0,p=!1,console.log("Recording saved.")},s.start(),setTimeout(()=>s.stop(),3e4)};window.addEventListener("keydown",o=>{o.key.toLowerCase()==="r"&&!p&&U()});let v=performance.now();const F=()=>{const o=performance.now(),t=(o-v)/1e3;v=o,c+=(g-c)*D,a.position.set(0,c,f),a.lookAt(0,0,0),H.update(t),r.render(w,a),window.requestAnimationFrame(F)};F();window.addEventListener("resize",()=>{a.aspect=window.innerWidth/window.innerHeight,a.updateProjectionMatrix(),r.setSize(window.innerWidth,window.innerHeight),r.setPixelRatio(Math.min(window.devicePixelRatio,2))});
