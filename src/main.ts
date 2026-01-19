import * as THREE from 'three';
import {BvhSkeleton} from './BvhSkeleton';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as GUI from "./gui.ts";
import {ImGui, ImGuiImplWeb} from "@mori2003/jsimgui";
import {type GlobalData, SESSION_TYPES} from "./DataInterface.ts";
import {sendGetRequest, sendPostRequest} from "./tools.ts";
import {Vector3} from "three";

// Configuration
const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";
// const WS_URL = "ws://localhost:8766";

const globalData: GlobalData = {
    SESSION_ID: ["6543"],
    SESSION_TYPE: [SESSION_TYPES.indexOf("VAE")],
    API_URL: ["http://localhost:8000"],
    WS_URL: ["ws://localhost:8000/ws"],
    ANIMATIONS: [""],
    SELECTED_ANIMATION: [0],
    play: [true],
    connected: [true],
    cameraFollow: [true],
    playbackSpeed: [1.0],
    vae_values: [[0.5], [0.5], [0.5]]
}

const gui = new GUI.GUI();
const stats: Stats = new Stats();
let bvhAnim: BvhSkeleton;

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

    // Récupération de la liste des animations disponibles (API REST)
    // + Formatage pour ImGui Combo
    let anim_response = await sendGetRequest(`${globalData.API_URL[0]}/animations`)
    globalData.ANIMATIONS = anim_response.animations;

    console.log("Création d'une session...");
    let session_id: string = globalData.SESSION_ID[0];
    const sessionInfo = await sendPostRequest(`${globalData.API_URL[0]}/sessions`, JSON.stringify({
        session_id: globalData.SESSION_ID[0],
        session_type: SESSION_TYPES[globalData.SESSION_TYPE[0]],
        animation_file: "dance1_subject1.bvh"
    }))

    session_id = sessionInfo.session_id || session_id;
    console.log(sessionInfo);
    console.log(session_id);

    async function init_character() {
        // 2. Récupération de la définition du squelette (API REST)
        console.log("Récupération du squelette...");
        const skeletonDef = await sendGetRequest(`${globalData.API_URL[0]}/sessions/${session_id}/skeleton`);

        // 3. Construction du squelette
        bvhAnim = new BvhSkeleton(skeletonDef);
        scene.add(bvhAnim.root);
        console.log("Squelette construit.");
    }

    async function init_ws() {
        // 4. Connexion WebSocket pour le streaming
        // const ws = new WebSocket(WS_URL);
        const ws = new WebSocket(`${globalData.WS_URL[0]}/${session_id}`);
        ws.binaryType = "arraybuffer"; // Crucial pour recevoir des bytes et non du texte

        ws.onopen = () => {
            console.log("Connecté au serveur d'animation !");
            document.getElementById("info")!.hidden = true;
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

        ws.onclose = () => {
            console.log("Déconnecté du serveur d'animation.");
        };
        ws.onerror = (err) => console.error("Erreur WS:", err);
    }

    async function reset_character() {
        console.log("Réinitialisation du personnage...");
        scene.remove(bvhAnim.root);
    }

    await init_character();
    await init_ws();

    // 5. Boucle de rendu
    function animate() {

        ImGuiImplWeb.BeginRender();
        stats.begin();

        gui.render(globalData);
        if (bvhAnim && globalData.cameraFollow[0]) controls.target.copy(bvhAnim.bones[0].position);

        // Mise à jour des contrôles uniquement si ImGui n'utilise pas la souris
        if (ImGui.GetIO().WantCaptureMouse) {
            controls.enabled = false; // Désactive la caméra
        } else {
            controls.enabled = true;  // Réactive la caméra
        }
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

    gui.initialize(renderer.domElement).then(_ => {
        // Boucle de rendu
        renderer.setAnimationLoop(time => {
            animate()
        });
    });
    gui.onDeleteSessionCallback = async () => {
        await reset_character();
    };
    gui.onCreateSessionCallback = async () => {
        await init_character();
        await init_ws();
    };
}

init();