import{C as u,S as C,B as W,M,a as B,W as T,b as _,N as O,O as E}from"./three.module-rN4qoPaD.js";import{E as F,R as G,O as L}from"./OutputPass-LkdMt5vd.js";const m={blue100:"#070726",blue85:"#161c94",blue80:"#201fff",pink:"#f72e62"},q={background:m.blue80},N=`
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
`,H=`
${N}
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
`,j=`
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
`;function U(o){const i={uTime:{value:0},uBigWavesElevation:{value:.152},uBigWavesFrequency:{value:2.5},uBigWavesSpeed:{value:1},uGapMax:{value:.6},uColorTop:{value:new u(m.pink)},uColorFront:{value:new u(m.blue100)},uColorSide:{value:new u(m.blue85)}},a=new C({vertexShader:H,fragmentShader:j,uniforms:i}),l=new W(1,1,1,32,32,32),y=[],p=[];for(let c=0;c<2;c++)for(let s=0;s<2;s++)for(let v=0;v<2;v++){const r=new M(l,a);o.add(r),y.push(r),p.push({mesh:r,xi:c,yi:s,zi:v})}function P(c=.016){i.uTime.value+=c;const s=i.uTime.value,r=1+(Math.sin(s*1)*.5+.5)*i.uGapMax.value;p.forEach(({mesh:S,xi:b,yi:R,zi:k})=>{S.position.set((b-.5)*r,(R-.5)*r,(k-.5)*r)})}return{cubes:y,uniforms:i,update:P,material:a}}const w=document.querySelector("canvas.webgl"),d=new B;d.background=new u(q.background);const t=new T({canvas:w,antialias:!0,preserveDrawingBuffer:!0});t.outputColorSpace=_;t.toneMapping=O;t.setPixelRatio(Math.min(window.devicePixelRatio,2));t.setSize(window.innerWidth,window.innerHeight);const n=10;let g=window.innerWidth/window.innerHeight;const e=new E(-n*g/2,n*g/2,n/2,-n/2,.1,1e3);e.position.set(10,10,10);e.lookAt(0,0,0);d.add(e);const{update:I}=U(d),f=new F(t);f.addPass(new G(d,e));f.addPass(new L);const x={png:()=>{t.setSize(3840,2160),e.left=-n*(3840/2160)/2,e.right=n*(3840/2160)/2,e.updateProjectionMatrix(),t.render(d,e);const a=document.createElement("a");a.download="hux-design-tokens-4k.png",a.href=w.toDataURL("image/png"),a.click();const l=window.innerWidth/window.innerHeight;t.setSize(window.innerWidth,window.innerHeight),e.left=-n*l/2,e.right=n*l/2,e.updateProjectionMatrix()},recorder:{chunks:[],stream:w.captureStream(60),mediaRecorder:null,isRecording:!1,init(){this.mediaRecorder=new MediaRecorder(this.stream,{mimeType:"video/webm; codecs=vp9",videoBitsPerSecond:8e6}),this.mediaRecorder.ondataavailable=o=>this.chunks.push(o.data),this.mediaRecorder.onstop=()=>{const o=new Blob(this.chunks,{type:"video/webm"}),i=document.createElement("a");i.href=URL.createObjectURL(o),i.download="hux-design-tokens.webm",i.click(),this.chunks=[]}},toggle(){this.isRecording||(this.isRecording=!0,this.mediaRecorder.start(),console.log("Recording..."),setTimeout(()=>{this.mediaRecorder.stop(),this.isRecording=!1,console.log("Saved.")},6283))}}};x.recorder.init();window.addEventListener("keydown",o=>{o.key.toLowerCase()==="e"&&x.png(),o.key.toLowerCase()==="r"&&x.recorder.toggle()});let z=performance.now();const h=()=>{const o=performance.now(),i=(o-z)/1e3;z=o,I(i),f.render(),window.requestAnimationFrame(h)};h();window.addEventListener("resize",()=>{g=window.innerWidth/window.innerHeight,e.left=-n*g/2,e.right=n*g/2,e.updateProjectionMatrix(),t.setSize(window.innerWidth,window.innerHeight),f.setSize(window.innerWidth,window.innerHeight)});
