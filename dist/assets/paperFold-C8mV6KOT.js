import{C as V,V as ce,o as le,S as de,D as ue,M as te,e as ee,p as fe,q as ve,r as me,F as ge,s as pe,t as ye,u as we,v as he,W as xe,a as ze,P as Se,c as Pe}from"./three.module-Dxk6m3Pq.js";import{G as Ce}from"./lil-gui.esm-CSNn1Ydq.js";const be=`
vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec3 P){
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
}
`,We=`
uniform float uTime;

// Big waves
uniform float uBigWavesElevation;
uniform vec2  uBigWavesFrequency;
uniform float uBigWavesSpeed;

// Small waves (Perlin noise)
uniform float uSmallWavesElevation;
uniform float uSmallWavesFrequency;
uniform float uSmallWavesSpeed;
uniform float uSmallIterations;

varying float vElevation;
varying vec2  vUv;

${be}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    // Big waves — sin(x) * sin(y) displacement along Z (depth)
    float elevation = sin(modelPosition.x * uBigWavesFrequency.x + uTime * uBigWavesSpeed)
                    * sin(modelPosition.y * uBigWavesFrequency.y + uTime * uBigWavesSpeed)
                    * uBigWavesElevation;

    // Small waves — layered Perlin noise for organic detail
    for (float i = 1.0; i <= 5.0; i++) {
        if (i > uSmallIterations) break;
        elevation -= abs(
            cnoise(vec3(modelPosition.xy * uSmallWavesFrequency * i, uTime * uSmallWavesSpeed))
            * uSmallWavesElevation / i
        );
    }

    modelPosition.z += elevation;

    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    vElevation = elevation;
    vUv = uv;
}
`,Me=`
uniform vec3  uDepthColor;
uniform vec3  uSurfaceColor;
uniform float uColorOffset;
uniform float uColorMultiplier;
uniform float uOpacity;

varying float vElevation;
varying vec2  vUv;

void main() {
    float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
    mixStrength = clamp(mixStrength, 0.0, 1.0);
    vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);
    gl_FragColor = vec4(color, uOpacity);
}
`;function Fe(e={}){const{segmentsW:t=256,segmentsH:C=64,opacity:h=.4,wireframe:v=!0}=e,s={uTime:{value:0},uBigWavesElevation:{value:.35},uBigWavesFrequency:{value:new ce(2,1.2)},uBigWavesSpeed:{value:.75},uSmallWavesElevation:{value:.15},uSmallWavesFrequency:{value:3},uSmallWavesSpeed:{value:.2},uSmallIterations:{value:4},uDepthColor:{value:new V("#201fff")},uSurfaceColor:{value:new V("#f72e62")},uColorOffset:{value:.08},uColorMultiplier:{value:5},uOpacity:{value:h}},d={rotX:0,rotY:0,rotZ:0},p=Math.PI/180;function b(r,m,q,_){const o=new le(r,m,t,C),u=new de({vertexShader:We,fragmentShader:Me,uniforms:s,transparent:!0,wireframe:v,depthWrite:!1,side:ue}),B=new te(o,u);return B.position.set(0,q,_),{mesh:B,mat:u}}const a=b(14,2.5,0,0),W=b(10,1.5,-2.2,-.8),y=[a,W];function M(r){s.uTime.value=r;const m=d.rotX*p,q=d.rotY*p,_=d.rotZ*p;for(const{mesh:o}of y)o.rotation.set(m,q,_)}const R=r=>{s.uOpacity.value=r},S=r=>{y.forEach(m=>{m.mat.wireframe=r})},k=r=>{y.forEach(m=>{m.mesh.visible=r})};return{meshes:y.map(r=>r.mesh),params:d,uniforms:s,update:M,setOpacity:R,setWireframe:S,setVisible:k}}function Ee(e={}){const{count:t=100,rangeX:C=13,rangeY:h=8,rangeZ:v=2,zCenter:s=-2.5,threshold:d=1.5,opacity:p=.2,dotSize:b=.025}=e,a=new Float32Array(t*3);for(let o=0;o<t;o++)a[o*3]=(Math.random()-.5)*C,a[o*3+1]=(Math.random()-.5)*h,a[o*3+2]=s+(Math.random()-.5)*v;const W=new ee;W.setAttribute("position",new fe(a.slice(),3));const y=new ve({color:1710618,size:b,sizeAttenuation:!0,transparent:!0,opacity:p}),M=new me(W,y),R=d*d,S=[];for(let o=0;o<t;o++)for(let u=o+1;u<t;u++){const B=a[o*3]-a[u*3],J=a[o*3+1]-a[u*3+1],Q=a[o*3+2]-a[u*3+2];B*B+J*J+Q*Q<=R&&S.push(a[o*3],a[o*3+1],a[o*3+2],a[u*3],a[u*3+1],a[u*3+2])}const k=new ee;k.setAttribute("position",new ge(S,3));const r=new pe({color:1710618,transparent:!0,opacity:p}),m=new ye(k,r);return{meshes:[M,m],setVisible:o=>{M.visible=o,m.visible=o},setOpacity:o=>{y.opacity=o,r.opacity=o}}}const Ge={blue:"#201fff",pink:"#f72e62",grey:"#f4f4f4",midGrey:"#c9c9c9",slate:"#a0a0a0"},Re={blue:[{r:.7,x:-4.2,y:1.5,z:-1.5},{r:.18,x:3.8,y:-1.2,z:-1}],pink:[{r:.6,x:2.8,y:2.2,z:-2},{r:.35,x:-2,y:-2,z:-1.3}],grey:[{r:.4,x:-5,y:.2,z:-2.2},{r:.12,x:1.2,y:3.2,z:-1.8}],midGrey:[{r:.32,x:4.5,y:.8,z:-1.8},{r:.18,x:-1.5,y:-3,z:-1.5}],slate:[{r:.45,x:-3.5,y:2.8,z:-2.3},{r:.2,x:.5,y:-1.8,z:-2}]};function Be(){const e={},t=[];for(const[v,s]of Object.entries(Re)){const d=Ge[v],p=s.map(({r:b,x:a,y:W,z:y})=>{const M=new we(b,32,24),R=new he({color:new V(d)}),S=new te(M,R);return S.position.set(a,W,y),S});e[v]=p,t.push(...p)}return{meshes:t,setVisible:v=>t.forEach(s=>{s.visible=v}),setGroupVisible:(v,s)=>{e[v]?.forEach(d=>{d.visible=s})}}}const X=document.querySelector("canvas.webgl"),f=new xe({canvas:X,antialias:!0,alpha:!1,preserveDrawingBuffer:!0});f.setClearColor(16777215,1);f.setSize(window.innerWidth,window.innerHeight);f.setPixelRatio(Math.min(window.devicePixelRatio,2));const L=new ze,c=new Se(65,window.innerWidth/window.innerHeight,.1,100);c.position.set(0,2,11);c.lookAt(0,0,0);const x=Fe(),j=Ee(),E=Be();j.meshes.forEach(e=>{e.renderOrder=0,L.add(e)});E.meshes.forEach(e=>{e.renderOrder=1,L.add(e)});x.meshes.forEach(e=>{e.renderOrder=2,L.add(e)});const Oe=new Pe,F=2,oe=-2;let Z=F,I=F;window.addEventListener("scroll",()=>{const e=document.body.scrollHeight-window.innerHeight;if(e<=0)return;const t=Math.min(Math.max(window.scrollY/e,0),1);Z=F+(oe-F)*t});window.addEventListener("message",e=>{if(e.data?.type==="scroll"){const t=Math.min(Math.max(e.data.progress,0),1);Z=F+(oe-F)*t}});let i=null,A=0,U=0,g=null,N=[];const n={resolution:"4K",duration:30,fps:30,format:"WebM",status:"idle"};let w=null;function ke(){n.resolution==="4K"?(f.setSize(3840,2160),c.aspect=3840/2160):(f.setSize(1920,1080),c.aspect=1920/1080),c.updateProjectionMatrix()}function ae(){f.setSize(window.innerWidth,window.innerHeight),f.setPixelRatio(Math.min(window.devicePixelRatio,2)),c.aspect=window.innerWidth/window.innerHeight,c.updateProjectionMatrix()}function qe(){if(!window.CCapture){console.warn("CCapture not found — falling back to native MediaRecorder."),_e();return}ke();const e=n.format==="PNG Sequence"?"png":"webm",t=n.fps*n.duration;i=new window.CCapture({format:e,framerate:n.fps,name:"hux-mesh",quality:99}),i.start(),U=t,A=t,n.status=`recording 0 / ${t}`,w&&w.updateDisplay()}function _e(){const e=X.captureStream(n.fps);g=new MediaRecorder(e,{mimeType:"video/webm; codecs=vp9"}),g.ondataavailable=t=>{t.data.size>0&&N.push(t.data)},g.onstop=()=>{const t=new Blob(N,{type:"video/webm"}),C=URL.createObjectURL(t),h=document.createElement("a");h.href=C,h.download="hux-mesh.webm",h.click(),N=[],g=null,n.status="complete",w&&w.updateDisplay()},g.start(),setTimeout(()=>{g?.state!=="inactive"&&g.stop()},n.duration*1e3),n.status="recording (native)…",w&&w.updateDisplay()}const ne={startRecording(){i||g||qe()},stopRecording(){i&&(i.stop(),i.save(),i=null,ae(),n.status="complete",w&&w.updateDisplay()),g?.state!=="inactive"&&g.stop()}},G=new Ce({title:"HUX MESH"}),l=x.uniforms,D=G.addFolder("BIG WAVES");D.add(l.uBigWavesElevation,"value",0,1,.001).name("elevation");D.add(l.uBigWavesFrequency.value,"x",0,10,.001).name("frequency X");D.add(l.uBigWavesFrequency.value,"y",0,10,.001).name("frequency Y");D.add(l.uBigWavesSpeed,"value",0,4,.001).name("speed");const H=G.addFolder("SMALL WAVES");H.add(l.uSmallWavesElevation,"value",0,1,.001).name("elevation");H.add(l.uSmallWavesFrequency,"value",0,30,.001).name("frequency");H.add(l.uSmallWavesSpeed,"value",0,4,.001).name("speed");H.add(l.uSmallIterations,"value",0,5,1).name("iterations");const T=G.addFolder("COLOUR"),re={depthColor:"#201fff",surfaceColor:"#f72e62"};T.addColor(re,"depthColor").name("depth").onChange(e=>l.uDepthColor.value.set(e));T.addColor(re,"surfaceColor").name("surface").onChange(e=>l.uSurfaceColor.value.set(e));T.add(l.uColorOffset,"value",0,1,.001).name("colour offset");T.add(l.uColorMultiplier,"value",0,10,.001).name("colour multiplier");const K=G.addFolder("MESH"),ie={meshOpacity:.4,showWireframe:!0};K.add(ie,"meshOpacity",0,1,.01).name("opacity").onChange(e=>x.setOpacity(e));K.add(ie,"showWireframe").name("wireframe").onChange(e=>x.setWireframe(e));const $=K.addFolder("rotation");$.add(x.params,"rotX",-180,180,.1).name("X °");$.add(x.params,"rotY",-180,180,.1).name("Y °");$.add(x.params,"rotZ",-180,180,.1).name("Z °");const Y=G.addFolder("SCENE"),z={showNetwork:!0,networkOpacity:.2,bgColor:"#ffffff",showBlue:!0,showPink:!0,showGrey:!0,showMidGrey:!0,showSlate:!0};Y.add(z,"showNetwork").onChange(e=>j.setVisible(e));Y.add(z,"networkOpacity",0,1,.01).onChange(e=>j.setOpacity(e));Y.addColor(z,"bgColor").onChange(e=>f.setClearColor(new V(e),1));const O=Y.addFolder("spheres");O.add(z,"showBlue").name("blue    #201fff").onChange(e=>E.setGroupVisible("blue",e));O.add(z,"showPink").name("pink    #f72e62").onChange(e=>E.setGroupVisible("pink",e));O.add(z,"showGrey").name("grey    #f4f4f4").onChange(e=>E.setGroupVisible("grey",e));O.add(z,"showMidGrey").name("mid grey #c9c9c9").onChange(e=>E.setGroupVisible("midGrey",e));O.add(z,"showSlate").name("slate   #a0a0a0").onChange(e=>E.setGroupVisible("slate",e));const P=G.addFolder("RECORD — 4K 30s for Socials");P.add(n,"resolution",["1080p","4K"]);P.add(n,"duration",5,60,1);P.add(n,"fps",[24,30,60]);P.add(n,"format",["WebM","PNG Sequence"]);P.add(ne,"startRecording").name("▶  Start Recording");P.add(ne,"stopRecording").name("■  Stop Recording");w=P.add(n,"status").name("status").disable().listen();const se=()=>{const e=Oe.getElapsedTime();if(I+=(Z-I)*.05,c.position.set(0,I,11),c.lookAt(0,0,0),x.update(e),f.render(L,c),i){i.capture(X),A--;const t=U-A;n.status=`recording ${t} / ${U}`,A<=0&&(i.stop(),i.save(),i=null,ae(),n.status="complete")}window.requestAnimationFrame(se)};se();window.addEventListener("resize",()=>{i||(c.aspect=window.innerWidth/window.innerHeight,c.updateProjectionMatrix(),f.setSize(window.innerWidth,window.innerHeight),f.setPixelRatio(Math.min(window.devicePixelRatio,2)))});
