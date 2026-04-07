import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { createWavySphere } from './sphere.js';

// Setup Scene
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const scene = new THREE.Scene();
const gui = new GUI();

// Camera
const sizes = { width: window.innerWidth, height: window.innerHeight };
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 0, 5);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor('#e0e0e0'); // Match background

// Build Sphere and add to scene
const sphereMesh = createWavySphere(gui);
scene.add(sphereMesh);

// Resize handler
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
});

// --- 4K RENDER & RECORDING LOGIC ---
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

window.addEventListener('keydown', (event) => {
    // 4K STILL IMAGE (Press 's')
    if (event.key === 's' || event.key === 'S') {
        render4KStill();
    }
    
    // 4K RECORDING (Press 'r')
    if (event.key === 'r' || event.key === 'R') {
        toggleRecording();
    }
});

function render4KStill() {
    const originalWidth = sizes.width;
    const originalHeight = sizes.height;
    const originalPixelRatio = renderer.getPixelRatio();

    // Set to 4K resolution (3840 x 2160)
    renderer.setPixelRatio(1); // Force pixel ratio to 1 for exact dimensions
    renderer.setSize(3840, 2160);
    camera.aspect = 3840 / 2160;
    camera.updateProjectionMatrix();

    // Render one frame
    renderer.render(scene, camera);

    // Export
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'algorithmic_art_4k.png';
    link.href = dataURL;
    link.click();

    // Revert back to screen size
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalWidth, originalHeight);
    camera.aspect = originalWidth / originalHeight;
    camera.updateProjectionMatrix();
}

function toggleRecording() {
    if (!isRecording) {
        // Start Recording
        recordedChunks = [];
        
        // Note: Real-time 4K recording is heavily dependent on the user's GPU.
        // We set the canvas to 4K while recording.
        renderer.setPixelRatio(1);
        renderer.setSize(3840, 2160);
        camera.aspect = 3840 / 2160;
        camera.updateProjectionMatrix();

        const stream = canvas.captureStream(60); // 60 FPS
        const options = { mimeType: 'video/webm; codecs=vp9' };
        
        try {
            mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.error('MediaRecorder error:', e);
            alert("Your browser doesn't support 4K webm recording.");
            return;
        }

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'algorithmic_art_video.webm';
            link.click();
            URL.revokeObjectURL(url);
            
            // Revert canvas size after recording
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setSize(sizes.width, sizes.height);
            camera.aspect = sizes.width / sizes.height;
            camera.updateProjectionMatrix();
        };

        mediaRecorder.start();
        isRecording = true;
        console.log("Recording started...");
        document.body.style.border = "5px solid red"; // Visual indicator
    } else {
        // Stop Recording
        mediaRecorder.stop();
        isRecording = false;
        console.log("Recording stopped. Saving...");
        document.body.style.border = "none";
    }
}

// Animation Loop
const clock = new THREE.Clock();

function tick() {
    const elapsedTime = clock.getElapsedTime();

    sphereMesh.material.uniforms.uTime.value = elapsedTime;

    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(tick);
}

tick();