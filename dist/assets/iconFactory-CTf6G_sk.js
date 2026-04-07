import{T as k,b as U,M as T,o as C,S as D,C as g,v as G,x as z,e as O,p as E,a as L,W as _,O as X,y as N}from"./three.module-Dxk6m3Pq.js";import{G as j}from"./lil-gui.esm-CSNn1Ydq.js";const t={gridUnits:10,gridCells:10,colorBlue:"#070726",colorPink:"#f72e62",colorWhite:"#ffffff",pulseIntensity:.12,pulseSpeed:.6,scanlineFrequency:40,factorySpeed:1,spawnRate:1.8,sizeA:.24,sizeB:.36},K=`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,V=`
uniform sampler2D uTexture;
uniform float     uTime;
uniform float     uPulseIntensity;
uniform float     uPulseSpeed;
uniform float     uScanlineFrequency;

varying vec2 vUv;

#define PI 3.14159265359

void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 col = tex.rgb;

    // Horizontal scanline shimmer — gives the blueprint a "live CRT" feel
    float scan = sin(vUv.y * uScanlineFrequency * PI) * 0.5 + 0.5;
    col *= (0.88 + scan * 0.12);

    // Breathing pulse — subtle brightness oscillation over time
    float pulse = sin(uTime * uPulseSpeed) * 0.5 + 0.5;
    col *= (1.0 - uPulseIntensity + pulse * uPulseIntensity);

    gl_FragColor = vec4(col, tex.a);
    #include <colorspace_fragment>
}
`;function Z(n){return new C(n*.88,n*.88)}function J(n){return new z(n*.44,32)}function Q(n){const o=new O,i=n*.5,r=i*Math.sqrt(3);return o.setAttribute("position",new E(new Float32Array([0,r*.667,0,-i,-r*.333,0,i,-r*.333,0]),3)),o.setIndex([0,1,2]),o.computeVertexNormals(),o}const P=[Z,J,Q];function Y(n){return 1+.38*Math.exp(-6*n)*Math.cos(18*n)}const $=.5,ee=3.5,I=.8;function ne(n){const o=new k().load("/HUX--Icon--Factory.png");o.colorSpace=U;const i={uTexture:{value:o},uTime:{value:0},uPulseIntensity:{value:t.pulseIntensity},uPulseSpeed:{value:t.pulseSpeed},uScanlineFrequency:{value:t.scanlineFrequency}},r=new T(new C(t.gridUnits,t.gridUnits),new D({vertexShader:K,fragmentShader:V,uniforms:i,transparent:!0}));r.rotation.x=-Math.PI*.5,n.add(r);const m=[];let h=0;const v=[new g(t.colorPink),new g(t.colorWhite)];function b(){const u=Math.round(Math.random()*(t.gridCells-4)-t.gridCells*.25),e=Math.round(Math.random()*(t.gridCells-2)-(t.gridCells-2)*.5),H=Math.random()<.5?t.sizeA:t.sizeB,x=P[Math.floor(Math.random()*P.length)](H),M=new G({color:v[Math.floor(Math.random()*v.length)],transparent:!0,opacity:1}),w=new T(x,M);w.rotation.x=-Math.PI*.5,w.position.set(-5.5,.01,e),n.add(w),m.push({mesh:w,geo:x,mat:M,state:"sliding",destX:u,slideSpeed:1.5+Math.random()*1.5,stampTimer:0,placedTimer:0,fadeTimer:0})}const d={pulseIntensity:t.pulseIntensity,pulseSpeed:t.pulseSpeed,scanlineFrequency:t.scanlineFrequency,factorySpeed:t.factorySpeed,spawnRate:t.spawnRate};function B(l){i.uTime.value+=l,i.uPulseIntensity.value=d.pulseIntensity,i.uPulseSpeed.value=d.pulseSpeed,i.uScanlineFrequency.value=d.scanlineFrequency,h+=l,h>=d.spawnRate&&(b(),h=0);for(let u=m.length-1;u>=0;u--){const e=m[u];e.state==="sliding"?(e.mesh.position.x+=e.slideSpeed*d.factorySpeed*l,e.mesh.position.x>=e.destX&&(e.mesh.position.x=e.destX,e.state="stamping",e.stampTimer=0)):e.state==="stamping"?(e.stampTimer+=l,e.mesh.scale.setScalar(Y(e.stampTimer)),e.stampTimer>=$&&(e.mesh.scale.setScalar(1),e.state="placed",e.placedTimer=0)):e.state==="placed"?(e.placedTimer+=l,e.placedTimer>=ee&&(e.state="fading",e.fadeTimer=0)):e.state==="fading"&&(e.fadeTimer+=l,e.mat.opacity=Math.max(0,1-e.fadeTimer/I),e.fadeTimer>=I&&(n.remove(e.mesh),e.geo.dispose(),e.mat.dispose(),m.splice(u,1)))}}return{gridUniforms:i,gridMesh:r,config:d,icons:m,update:B}}const s=7,A=document.querySelector("canvas.webgl"),f=new L;f.background=new g(t.colorBlue);const c=new _({canvas:A,antialias:!0,preserveDrawingBuffer:!0});c.outputColorSpace=U;c.setSize(window.innerWidth,window.innerHeight);c.setPixelRatio(Math.min(window.devicePixelRatio,2));const F=window.innerWidth/window.innerHeight,a=new X(-s*F,s*F,s,-s,.1,200);a.position.set(10,10,10);a.lookAt(0,0,0);f.add(new N(16777215,1.2));const p=ne(f),S=new j({title:"Icon Factory"}),y=S.addFolder("Grid FX");y.add(p.config,"pulseIntensity",0,.4).name("Pulse Intensity");y.add(p.config,"pulseSpeed",0,3).name("Pulse Speed");y.add(p.config,"scanlineFrequency",10,120).name("Scanlines");const q=S.addFolder("Factory");q.add(p.config,"factorySpeed",0,4).name("Speed");q.add(p.config,"spawnRate",.3,6).name("Spawn Rate (s)");const te={export4K:()=>{c.setSize(3840,2160),a.left=-s*(3840/2160),a.right=s*(3840/2160),a.updateProjectionMatrix(),c.render(f,a);const i=document.createElement("a");i.download="hux-icon-factory-4k.png",i.href=A.toDataURL("image/png"),i.click();const r=window.innerWidth/window.innerHeight;c.setSize(window.innerWidth,window.innerHeight),a.left=-s*r,a.right=s*r,a.updateProjectionMatrix()}};S.add(te,"export4K").name("Export 4K PNG");let R=performance.now();const W=()=>{const n=performance.now(),o=Math.min((n-R)/1e3,.05);R=n,p.update(o),c.render(f,a),window.requestAnimationFrame(W)};W();window.addEventListener("resize",()=>{const n=window.innerWidth/window.innerHeight;a.left=-s*n,a.right=s*n,a.updateProjectionMatrix(),c.setSize(window.innerWidth,window.innerHeight),c.setPixelRatio(Math.min(window.devicePixelRatio,2))});
