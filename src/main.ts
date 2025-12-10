import * as THREE from 'three';
import {BvhSkeleton} from './BvhSkeleton';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as GUI from "./gui.ts";
import {ImGuiImplWeb} from "@mori2003/jsimgui";

// Configuration
const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

const stats: Stats = new Stats();

async function init() {
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // 1. Scène ThreeJS standard
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 150, 400); // Ajuster selon l'échelle de votre BVH

    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    const grid = new THREE.GridHelper(1000, 50);
    scene.add(grid);

    // 2. Récupération de la définition du squelette (API REST)
    console.log("Récupération du squelette...");
    const response = await fetch(`${API_URL}/skeleton`);
    const skeletonDef = await response.json();

    // 3. Construction du squelette
    const bvhAnim = new BvhSkeleton(skeletonDef);
    scene.add(bvhAnim.root);
    console.log("Squelette construit.");

    // 4. Connexion WebSocket pour le streaming
    const ws = new WebSocket(WS_URL);
    ws.binaryType = "arraybuffer"; // Crucial pour recevoir des bytes et non du texte

    ws.onopen = () => {
        console.log("Connecté au serveur d'animation !");
    };

    let lastMessageTime: number | null = null;
    let messageCount = 0;
    let totalElapsedTime = 0;
    let lastPrintTime = performance.now();
    ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            const currentTime = performance.now();

            if (lastMessageTime !== null) {
                const elapsed = currentTime - lastMessageTime;
                totalElapsedTime += elapsed;

                // Afficher une fois par seconde
                if (currentTime - lastPrintTime >= 1000) {
                    const avgElapsed = totalElapsedTime / messageCount;
                    console.log(`Temps moyen entre chaque frame: ${avgElapsed.toFixed(2)}ms | Messages reçus: ${messageCount}`);
                    lastPrintTime = currentTime;
                    totalElapsedTime = 0;
                    messageCount = 0;
                }
            }

            lastMessageTime = currentTime;
            messageCount++;
            bvhAnim.updateFromBinary(event.data);
        }
    };

    ws.onerror = (err) => console.error("Erreur WS:", err);

    // 5. Boucle de rendu
    function animate() {

        ImGuiImplWeb.BeginRender();
        stats.begin();

        GUI.render();
        controls.update();
        renderer.render(scene, camera);

        stats.end();
        renderer.resetState();
        ImGuiImplWeb.EndRender();
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Gestion du resize
    window.addEventListener('resize', () => onWindowResize(), false);

    GUI.InitializeGUI(renderer.domElement).then(_ => {
        // Boucle de rendu
        renderer.setAnimationLoop(time => {
            animate()
        });
    });
}

init();