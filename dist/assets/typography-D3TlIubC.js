import{S as R,D as M,M as P,E as k,d as p,a as E,C as H,W as L,P as U}from"./three.module-rN4qoPaD.js";import{G as x}from"./lil-gui.esm-CSNn1Ydq.js";const o={background:"#201fff",weight:0,playing:!0,speed:.4,letter:"H"},C=1.5;function W(){const e=new p;return e.moveTo(0,0),e.lineTo(1.5,0),e.lineTo(1.5,1.75),e.lineTo(3.5,1.75),e.lineTo(3.5,0),e.lineTo(5,0),e.lineTo(5,5),e.lineTo(3.5,5),e.lineTo(3.5,3.25),e.lineTo(1.5,3.25),e.lineTo(1.5,5),e.lineTo(0,5),e.lineTo(0,0),e}function z(){const e=new p;return e.moveTo(0,0),e.lineTo(5,0),e.lineTo(5,5),e.lineTo(3.5,5),e.lineTo(3.5,1.5),e.lineTo(1.5,1.5),e.lineTo(1.5,5),e.lineTo(0,5),e.lineTo(0,0),e}function D(){const e=new p,n=1.2,t=.75;return e.moveTo(0,n),e.lineTo(2.5-t,2.5),e.lineTo(0,5-n),e.lineTo(n,5),e.lineTo(2.5,2.5+t),e.lineTo(5-n,5),e.lineTo(5,5-n),e.lineTo(2.5+t,2.5),e.lineTo(5,n),e.lineTo(5-n,0),e.lineTo(2.5,2.5-t),e.lineTo(n,0),e.lineTo(0,n),e}const G={H:W,U:z,X:D},j=`
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,X=`
    varying vec3 vNormal;
    void main() {
        vec3 n = normalize(vNormal);
        float brightness;
        if (abs(n.z) > 0.5) {
            brightness = 1.0;   // front / back faces — full white
        } else if (abs(n.y) > 0.5) {
            brightness = 0.85;  // top / bottom edges
        } else {
            brightness = 0.70;  // side edges — reads as depth
        }
        gl_FragColor = vec4(vec3(brightness), 1.0);
    }
`;function T(e){const n=G[e];if(!n)return null;const t=n(),a=new k(t,{depth:C,bevelEnabled:!1});return a.center(),a}function A(e){const n=e.captureStream(30),t=new MediaRecorder(n,{mimeType:"video/webm"}),a=[];t.ondataavailable=i=>a.push(i.data),t.onstop=()=>{const i=new Blob(a,{type:"video/webm"}),d=URL.createObjectURL(i),r=document.createElement("a");r.href=d,r.download="hux-typography.webm",r.click(),URL.revokeObjectURL(d)},t.start(),setTimeout(()=>t.stop(),5e3)}function N(e,n){const t=new R({vertexShader:j,fragmentShader:X,side:M});let a=T(o.letter),i=new P(a,t);e.add(i);function d(s){const w=T(s);w&&(i.geometry.dispose(),i.geometry=w)}const r=new x({title:"HUX Typography"});r.add(o,"letter",["H","U","X"]).name("Letter").onChange(d),r.add(o,"weight",0,1,.001).name("Weight").listen(),r.add(o,"playing").name("Play / Pause"),r.add(o,"speed",.05,3,.01).name("Speed");const y=document.querySelector("canvas.webgl"),b={record:()=>A(y)};r.add(b,"record").name("Record 5s");let l=null,g=1;function S(s){if(o.playing){l===null&&(l=s);const w=(s-l)/1e3;l=s,o.weight+=w*o.speed*.25*g,o.weight>=1&&(o.weight=1,g=-1),o.weight<=0&&(o.weight=0,g=1)}else l=s;i.rotation.y=Math.sin(o.weight*Math.PI)*.5}n&&n({mesh:i,update:S})}const f=document.querySelector("canvas.webgl"),m=new E;m.background=new H("#201fff");const h=new L({canvas:f,antialias:!0,preserveDrawingBuffer:!0});h.setPixelRatio(Math.min(window.devicePixelRatio,2));h.setSize(window.innerWidth,window.innerHeight);const c=new U(35,window.innerWidth/window.innerHeight,.1,100);c.position.set(0,0,15);m.add(c);let u=null;N(m,e=>{u=e});window.addEventListener("keydown",e=>{if(e.key.toLowerCase()==="e"){const n=document.createElement("a");n.download="hux-h-4k.png",n.href=f.toDataURL("image/png"),n.click()}});const v=()=>{u&&u.update(performance.now()),h.render(m,c),window.requestAnimationFrame(v)};v();window.addEventListener("resize",()=>{c.aspect=window.innerWidth/window.innerHeight,c.updateProjectionMatrix(),h.setSize(window.innerWidth,window.innerHeight)});
