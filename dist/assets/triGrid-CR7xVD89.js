import{c as C,C as f,W as y,b as z,N as F,O as W,a as _,i as b,j as w,S as R,an as E,M as T,s as P,r as k}from"./three.module-rN4qoPaD.js";import{G as B}from"./lil-gui.esm-CSNn1Ydq.js";import{E as M,R as A,O as q}from"./OutputPass-LkdMt5vd.js";const p="#201fff",G="#ff2d78",d=13,S=15,n=1,l=n*Math.sqrt(3)/2,L=Math.PI*2,O=`
    uniform float uTime;
    uniform float uBigWavesElevation;
    uniform float uBigWavesFrequency;
    uniform float uBigWavesSpeed;

    varying vec3 vWorldNormal;

    void main() {
        // ── World position ────────────────────────────────────────────────────
        vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;

        // ── Sine-product wave (X × Z) ─────────────────────────────────────────
        float t    = uTime * uBigWavesSpeed;
        float xArg = worldPos.x * uBigWavesFrequency + t;
        float zArg = worldPos.z * uBigWavesFrequency + t;

        float sinX = sin(xArg);
        float sinZ = sin(zArg);
        float cosX = cos(xArg);
        float cosZ = cos(zArg);

        // Y-only displacement
        worldPos.y += uBigWavesElevation * sinX * sinZ;

        // ── Analytical surface normal ─────────────────────────────────────────
        // f(x,z) = E · sin(x·F+t) · sin(z·F+t)
        // ∂f/∂x  = E·F · cos(x·F+t) · sin(z·F+t)
        // ∂f/∂z  = E·F · sin(x·F+t) · cos(z·F+t)
        // Normal  = normalize(−∂f/∂x, 1, −∂f/∂z)
        float EF   = uBigWavesElevation * uBigWavesFrequency;
        float dfdx = EF * cosX * sinZ;
        float dfdz = EF * sinX * cosZ;
        vWorldNormal = normalize(vec3(-dfdx, 1.0, -dfdz));

        // ── Project ───────────────────────────────────────────────────────────
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`,H=`
    uniform vec3 uColorTop;
    uniform vec3 uColorFront;
    uniform vec3 uColorSide;

    varying vec3 vWorldNormal;

    void main() {
        vec3 n = vWorldNormal;

        // Slope metrics — both are 0 when perfectly flat
        float slopeY  = 1.0 - n.y;                 // 0 = flat/pink, 1 = vertical
        float slopeXZ = max(abs(n.x), abs(n.z));   // 0 = flat, 1 = steep in X or Z

        // Smooth three-colour blend:
        //   flat         → uColorTop   (pink)
        //   gentle slope → uColorSide  (blue85)
        //   steep slope  → uColorFront (blue100)
        vec3 color = uColorTop;
        color = mix(color, uColorSide,  smoothstep(0.04, 0.22, slopeY));
        color = mix(color, uColorFront, smoothstep(0.28, 0.55, slopeXZ));

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
    }
`;function a(v){const e=new f(v);return new k(e.r,e.g,e.b)}class X{constructor(e){this.canvas=e,this.clock=new C,this.uTime=0,this.meshes=[],this.isRecording=!1,this.params={speed:1,elevation:.152,frequency:2.5,colorTop:G,colorFront:p,colorSide:"#"+new f(p).multiplyScalar(.85).getHexString()},this._initRenderer(),this._initCamera(),this._initScene(),this._initGeometry(),this._initComposer(),this._initGUI(),this._initExport(),this._initResize(),this._loop()}_initRenderer(){this.renderer=new y({canvas:this.canvas,antialias:!0,preserveDrawingBuffer:!0}),this.renderer.outputColorSpace=z,this.renderer.toneMapping=F,this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));const e=Math.min(window.innerWidth,window.innerHeight);this.renderer.setSize(e,e)}_initCamera(){const e=d*n/2;this.camera=new W(-e,e,e,-e,.1,1e3);const o=d*n/2,t=S*l/2;this.camera.position.set(o,100,t),this.camera.up.set(0,0,-1),this.camera.lookAt(o,0,t)}_initScene(){this.scene=new _,this.scene.background=new f(p)}_makeTriGeo(){const e=l/3,o=2*l/3,t=new b;return t.setAttribute("position",new w(new Float32Array([n/2,0,-e,-n/2,0,-e,0,0,o]),3)),t.setAttribute("normal",new w(new Float32Array([0,1,0,0,1,0,0,1,0]),3)),t}_initGeometry(){const e=this._makeTriGeo(),o=this.params;this.material=new R({uniforms:{uTime:{value:0},uBigWavesElevation:{value:o.elevation},uBigWavesFrequency:{value:o.frequency},uBigWavesSpeed:{value:o.speed},uColorTop:{value:a(o.colorTop)},uColorFront:{value:a(o.colorFront)},uColorSide:{value:a(o.colorSide)}},vertexShader:O,fragmentShader:H,side:E});for(let t=0;t<S;t++){const i=t%2===1;for(let r=0;r<d;r++){const s=i?r*n:r*n+n/2,h=t*l+l/3,c=new T(e,this.material);c.position.set(s,0,h),this.scene.add(c),this.meshes.push(c)}}}_initComposer(){const e=Math.min(window.innerWidth,window.innerHeight);this.composer=new M(this.renderer),this.composer.setSize(e,e),this.composer.addPass(new A(this.scene,this.camera)),this.composer.addPass(new q)}_initGUI(){const e=new B({title:"Tri Grid"}),o=this.material.uniforms,t=this.params,i=e.addFolder("Wave");i.add(t,"speed",0,4,.01).name("Speed").onChange(s=>{o.uBigWavesSpeed.value=s}),i.add(t,"elevation",0,1.5,.001).name("Elevation").onChange(s=>{o.uBigWavesElevation.value=s}),i.add(t,"frequency",.1,8,.01).name("Frequency").onChange(s=>{o.uBigWavesFrequency.value=s});const r=e.addFolder("Colours");r.addColor(t,"colorTop").name("Top (pink)").onChange(s=>o.uColorTop.value.copy(a(s))),r.addColor(t,"colorFront").name("Front (blue)").onChange(s=>o.uColorFront.value.copy(a(s))),r.addColor(t,"colorSide").name("Side (blue85)").onChange(s=>o.uColorSide.value.copy(a(s)))}_initExport(){window.addEventListener("keydown",e=>{(e.key==="E"||e.key==="e")&&this._screenshot4K(),(e.key==="R"||e.key==="r")&&this._recordLoop()})}_screenshot4K(){const t=1.7777777777777777,i=new P;this.renderer.getSize(i);const r=this.renderer.getPixelRatio(),{left:s,right:h,top:c,bottom:x}=this.camera,m=d*n/2,g=m*t;this.camera.left=-g,this.camera.right=g,this.camera.top=m,this.camera.bottom=-m,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(1),this.renderer.setSize(3840,2160,!1),this.renderer.render(this.scene,this.camera);const u=document.createElement("a");u.download="hux-tri-grid-4k.png",u.href=this.renderer.domElement.toDataURL("image/png"),u.click(),this.camera.left=s,this.camera.right=h,this.camera.top=c,this.camera.bottom=x,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(r),this.renderer.setSize(i.x,i.y,!1),this.composer.setSize(i.x,i.y)}_recordLoop(){if(this.isRecording)return;this.isRecording=!0;const e=this.renderer.domElement.captureStream(60),o=new MediaRecorder(e,{mimeType:"video/webm;codecs=vp9",videoBitsPerSecond:8e6}),t=[];o.ondataavailable=i=>{i.data.size>0&&t.push(i.data)},o.onstop=()=>{const i=new Blob(t,{type:"video/webm"}),r=document.createElement("a");r.href=URL.createObjectURL(i),r.download="hux-tri-grid.webm",r.click(),URL.revokeObjectURL(r.href),this.isRecording=!1},o.start(),setTimeout(()=>o.stop(),L*1e3)}_initResize(){window.addEventListener("resize",()=>{const e=Math.min(window.innerWidth,window.innerHeight);this.renderer.setSize(e,e),this.composer.setSize(e,e)})}update(e){this.uTime+=e,this.material.uniforms.uTime.value=this.uTime}_loop(){const e=()=>{this.update(this.clock.getDelta()),this.composer.render(),requestAnimationFrame(e)};e()}}const U=document.querySelector("canvas.webgl");new X(U);
