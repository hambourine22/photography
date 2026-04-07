import{W as P,a as S,b as y,N as C,O as T,C as v,e as k,S as U,M as W}from"./three.module-rN4qoPaD.js";const x=`precision highp float;

varying vec2 vUv;

void main()
{
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,I=`precision highp float;

uniform vec3 uColorPink;
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
    float pattern = sin(refractedUv.x * PI) * cos(refractedUv.y * PI + time);

    // Chromatic Aberration (Splitting RGB for that glass prism look)
    float r = mix(uColorBlue.r, uColorPink.r, refractedUv.y + pattern + 0.03);
    float g = mix(uColorBlue.g, uColorPink.g, refractedUv.y + pattern);
    float b = mix(uColorBlue.b, uColorPink.b, refractedUv.y + pattern - 0.03);

    vec3 color = vec3(r, g, b);

    // 4. RESTORED PI-GRAIN (The Frosted Surface)
    float grain = random(vUv * uGrainScale + (uTime * 0.01));
    color = mix(color, color + (grain - 0.5) * 0.15, 0.4);

    // 5. EDGE LIGHTING
    float edgeHighlight = smoothstep(0.48, 0.5, ribbonPattern) - smoothstep(0.5, 0.52, ribbonPattern);
    color += edgeHighlight * 0.2;

    gl_FragColor = vec4(color, 1.0);

    #include <colorspace_fragment>
}`,u=[{minWidth:1920,ribbons:22},{minWidth:1280,ribbons:18},{minWidth:768,ribbons:12},{minWidth:480,ribbons:8},{minWidth:0,ribbons:4}],b=()=>{const t=window.innerWidth;for(const r of u)if(t>=r.minWidth)return r.ribbons;return u[u.length-1].ribbons};{const t=document.querySelector("nav");t&&(t.style.display="none")}const n=document.querySelector("canvas.webgl");let o;try{o=new P({canvas:n,antialias:!0,failIfMajorPerformanceCaveat:!1,powerPreference:"default"})}catch(t){console.warn("WebGL unavailable — keeping fallback image:",t)}if(o){const t=new S;o.outputColorSpace=y,o.toneMapping=C,o.setPixelRatio(Math.min(window.devicePixelRatio,2));const r=()=>{const e=n.parentElement;return{width:e?e.clientWidth:window.innerWidth,height:e?e.clientHeight:window.innerHeight}},f=r();o.setSize(f.width,f.height,!1);const g=new T(-1,1,1,-1,0,1),i={refraction:.18,grainScale:16,speed:1.29,lineWidth:b(),colorPink:"#f72e62",colorBlue:"#201fff"},s={uTime:{value:0},uRefraction:{value:i.refraction},uGrainScale:{value:i.grainScale},uSpeed:{value:i.speed},uLineWidth:{value:i.lineWidth},uColorPink:{value:new v(i.colorPink)},uColorBlue:{value:new v(i.colorBlue)}},p=new k(2,2,1,1),w=new U({vertexShader:x,fragmentShader:I,uniforms:s}),R=new W(p,w);t.add(R);let m=performance.now(),c=!1;const h=()=>{const e=(performance.now()-m)/1e3;m=performance.now(),s.uTime.value+=e,o.render(t,g),c||(n.classList.add("ready"),c=!0),window.requestAnimationFrame(h)};n.addEventListener("webglcontextlost",e=>{e.preventDefault(),n.classList.remove("ready"),c=!1}),n.addEventListener("webglcontextrestored",()=>{}),{chunks:[],stream:null,mediaRecorder:null,isRecording:!1,init(){if(!(typeof MediaRecorder>"u"||typeof n.captureStream!="function"))try{this.stream=n.captureStream(60),this.mediaRecorder=new MediaRecorder(this.stream,{mimeType:"video/webm; codecs=vp9",videoBitsPerSecond:1e7}),this.mediaRecorder.ondataavailable=e=>this.chunks.push(e.data),this.mediaRecorder.onstop=()=>this.exportVideo(),window.addEventListener("keydown",e=>{e.key.toLowerCase()==="r"&&this.toggle()})}catch(e){console.warn("Recorder unavailable:",e)}},toggle(){if(this.mediaRecorder)if(this.isRecording)this.mediaRecorder.stop(),this.isRecording=!1;else{const e=Math.round(2*Math.PI*1e3);this.chunks=[],this.mediaRecorder.start(),this.isRecording=!0,console.log("🔴 Recording..."),setTimeout(()=>this.toggle(),e)}},exportVideo(){const e=new Blob(this.chunks,{type:"video/webm"}),a=document.createElement("a");a.href=URL.createObjectURL(e),a.download="perceptual-patterns.webm",a.click()}}.init(),h();const l=()=>{const{width:e,height:a}=r();o.setPixelRatio(Math.min(window.devicePixelRatio,2)),o.setSize(e,a,!1);const d=b();d!==i.lineWidth&&(i.lineWidth=d,s.uLineWidth.value=d)};window.addEventListener("resize",l),window.addEventListener("orientationchange",l),typeof ResizeObserver<"u"&&n.parentElement&&new ResizeObserver(l).observe(n.parentElement)}
