import{a as l,W as d,b as u,N as m,O as v,C as t,o as h,S as f,M as g}from"./three.module-Dxk6m3Pq.js";const p=`varying vec2 vUv;

void main()
{
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,w=`uniform vec3 uColorPink;
uniform vec3 uColorBlue;
uniform float uTime;
uniform float uGrainScale;
uniform float uSpeed;
uniform float uLineWidth;
uniform float uRefraction;

varying vec2 vUv;

#define PI 3.1415926535897932384626433832795

// High-end randomized grain based on PI
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123 * PI);
}

void main()
{
    float time = uTime * uSpeed;
    
    // 1. STATIC VERTICAL RIBBONS (The Glass Panes)
    float ribbonPattern = fract(vUv.x * uLineWidth);
    float ribbonMask = step(0.5, ribbonPattern);

    // 2. MOVING BACKGROUND PATTERN
    vec2 movingUv = vUv;
    movingUv.x += time * 0.2; // Horizontal flow

    // Refraction: The background 'jumps' only inside the glass ribbons
    float distortion = ribbonMask * uRefraction;
    vec2 refractedUv = movingUv + vec2(distortion, 0.0);

    // 3. COLOR GRADIENT (The Vibrant HUX Pattern)
    // We use sin/cos to create the fluid color movement behind the glass
    float pattern = sin(refractedUv.x * PI) * cos(refractedUv.y * PI + time);
    
    // Chromatic Aberration (Splitting RGB for that glass prism look)
    float r = mix(uColorBlue.r, uColorPink.r, refractedUv.y + pattern + 0.03);
    float g = mix(uColorBlue.g, uColorPink.g, refractedUv.y + pattern);
    float b = mix(uColorBlue.b, uColorPink.b, refractedUv.y + pattern - 0.03);
    
    vec3 color = vec3(r, g, b);

    // 4. RESTORED PI-GRAIN (The Frosted Surface)
    // Applied to vUv so it stays on the surface while colors move behind
    float grain = random(vUv * uGrainScale + (uTime * 0.01));
    color = mix(color, color + (grain - 0.5) * 0.15, 0.4);

    // 5. EDGE LIGHTING
    // Sharp highlights on the ribbon edges to give them thickness
    float edgeHighlight = smoothstep(0.48, 0.5, ribbonPattern) - smoothstep(0.5, 0.52, ribbonPattern);
    color += edgeHighlight * 0.2;

    gl_FragColor = vec4(color, 1.0);
    
    #include <colorspace_fragment>
}`,r=document.querySelector("canvas.webgl"),a=new l,n=new d({canvas:r,antialias:!0});n.outputColorSpace=u;n.toneMapping=m;n.setPixelRatio(Math.min(window.devicePixelRatio,2));n.setSize(window.innerWidth,window.innerHeight);const b=new v(-1,1,1,-1,0,1),s={uTime:{value:0},uRefraction:{value:.279},uGrainScale:{value:24.1},uSpeed:{value:.492},uLineWidth:{value:30},uColorPink:{value:new t("#f72e62")},uColorBlue:{value:new t("#201fff")}},R=new h(2,2,1,1),S=new f({vertexShader:p,fragmentShader:w,uniforms:s}),P=new g(R,S);a.add(P);let i=performance.now();const c=()=>{const e=(performance.now()-i)/1e3;i=performance.now(),s.uTime.value+=e,n.render(a,b),window.requestAnimationFrame(c)},C={chunks:[],stream:r.captureStream(60),mediaRecorder:null,isRecording:!1,init(){this.mediaRecorder=new MediaRecorder(this.stream,{mimeType:"video/webm; codecs=vp9",videoBitsPerSecond:1e7}),this.mediaRecorder.ondataavailable=e=>this.chunks.push(e.data),this.mediaRecorder.onstop=()=>this.exportVideo(),window.addEventListener("keydown",e=>{e.key.toLowerCase()==="r"&&this.toggle()})},toggle(){if(this.isRecording)this.mediaRecorder.stop(),this.isRecording=!1;else{const e=Math.round(2*Math.PI*1e3);this.chunks=[],this.mediaRecorder.start(),this.isRecording=!0,console.log("🔴 Recording..."),setTimeout(()=>this.toggle(),e)}},exportVideo(){const e=new Blob(this.chunks,{type:"video/webm"}),o=document.createElement("a");o.href=URL.createObjectURL(e),o.download="perceptual-patterns.webm",o.click()}};C.init();c();window.addEventListener("resize",()=>{n.setSize(window.innerWidth,window.innerHeight)});
