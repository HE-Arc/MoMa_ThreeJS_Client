import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import {ImGui, ImGuiImplWeb, ImVec2} from "@mori2003/jsimgui";
import {BvhSkeleton} from './BvhSkeleton';
import * as GUI from "./gui.ts";
import {type GlobalData, SESSION_FPS, SESSION_TYPES} from "./DataInterface.ts";
import {sendGetRequest, sendPostRequest} from "./tools.ts";
import {Vector3} from "three";

/**
 * Classe principale de l'application
 * Gère la scène 3D, le rendu et les connexions WebSocket de manière découplée
 */
export class App {
    // Composants Three.js
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;

    // Stats et GUI
    private stats: Stats;
    private gui: GUI.GUI;

    // Animation
    private bvhAnim: BvhSkeleton | null = null;

    // Connexion WebSocket
    private ws: WebSocket | null = null;
    private sessionId: string;

    // Données globales
    public globalData: GlobalData;

    constructor() {
        this.stats = new Stats();
        this.gui = new GUI.GUI();

        // Initialisation des données globales
        this.globalData = {
            SESSION_ID: [String(import.meta.env.VITE_SESSION_ID)],
            SESSION_TYPE: [SESSION_TYPES.indexOf(String(import.meta.env.VITE_SESSION_TYPE))],
            API_URL: [`http://${String(import.meta.env.VITE_SERVER_IP)}:${String(import.meta.env.VITE_SERVER_PORT)}`],
            WS_URL: [`ws://${String(import.meta.env.VITE_SERVER_IP)}:${String(import.meta.env.VITE_SERVER_PORT)}/ws`],
            ANIMATIONS: [""],
            SELECTED_ANIMATION: [0],
            SESSION_FPS: [SESSION_FPS.indexOf(60)],
            play: [true],
            connected: [false],
            cameraFollow: [String(import.meta.env.VITE_CAMERA_FOLLOW).toLowerCase() === 'true'],
            playbackSpeed: [1],
            vae_values: [[0.5], [0.5], [0.5]]
        };

        this.sessionId = this.globalData.SESSION_ID[0];

        // Initialisation de la scène
        this.scene = this.initScene();
        this.camera = this.initCamera();
        this.renderer = this.initRenderer();
        this.controls = this.initControls();
        this.initGrid();

        // Setup des callbacks
        this.setupCallbacks();
        this.setupEventListeners();
    }

    /**
     * Initialise la scène Three.js
     */
    private initScene(): THREE.Scene {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x333333);
        return scene;
    }

    /**
     * Initialise la caméra
     */
    private initCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 150, 400);
        return camera;
    }

    /**
     * Initialise le renderer
     */
    private initRenderer(): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
        return renderer;
    }

    /**
     * Initialise les contrôles de la caméra
     */
    private initControls(): OrbitControls {
        return new OrbitControls(this.camera, this.renderer.domElement);
    }

    /**
     * Initialise la grille
     */
    private initGrid(): void {
        const grid = new THREE.GridHelper(1000, 50);
        this.scene.add(grid);
    }

    /**
     * Configure les callbacks du GUI
     */
    private setupCallbacks(): void {
        this.gui.onDeleteSessionCallback = async () => {
            await this.disconnectSession();
        };

        this.gui.onCreateSessionCallback = async () => {
            await this.connectSession();
        };
    }

    /**
     * Configure les event listeners
     */
    private setupEventListeners(): void {
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    /**
     * Gère le redimensionnement de la fenêtre
     */
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Charge la liste des animations disponibles
     */
    async loadAnimations(): Promise<void> {
        try {
            const response = await sendGetRequest(`${this.globalData.API_URL[0]}/animations`);
            this.globalData.ANIMATIONS = response.animations;
            console.log("Animations chargées:", this.globalData.ANIMATIONS);
        } catch (error) {
            console.error("Erreur lors du chargement des animations:", error);
        }
    }

    /**
     * Crée une session sur le serveur
     */
    async createSession(): Promise<string> {
        console.log("Création d'une session...");
        const sessionInfo = await sendPostRequest(
            `${this.globalData.API_URL[0]}/sessions`,
            JSON.stringify({
                session_id: this.globalData.SESSION_ID[0],
                session_type: SESSION_TYPES[this.globalData.SESSION_TYPE[0]],
                animation_file: this.globalData.ANIMATIONS[this.globalData.SELECTED_ANIMATION[0]] || "dance1_subject1.bvh"
            })
        );

        this.sessionId = sessionInfo.session_id || this.sessionId;
        console.log("Session créée:", this.sessionId);
        return this.sessionId;
    }

    /**
     * Charge le personnage (squelette)
     */
    async loadCharacter(): Promise<void> {
        console.log("Récupération du squelette...");
        const skeletonDef = await sendGetRequest(
            `${this.globalData.API_URL[0]}/sessions/${this.sessionId}/skeleton`
        );

        this.bvhAnim = new BvhSkeleton(skeletonDef);
        this.scene.add(this.bvhAnim.root);
        console.log("Squelette construit.");
    }

    /**
     * Connecte le WebSocket pour le streaming
     */
    async connectWebSocket(): Promise<void> {
        if (this.ws) {
            console.warn("WebSocket déjà connecté");
            return;
        }

        console.log("Connexion WebSocket...");
        this.ws = new WebSocket(`${this.globalData.WS_URL[0]}/${this.sessionId}`);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
            console.log("Connecté au serveur d'animation !");
            this.globalData.connected[0] = true;
        };

        let lastMessageTime: number | null = null;
        let messageCount = 0;
        let totalElapsedTime = 0;
        let lastPrintTime = performance.now();

        this.ws.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const currentTime = performance.now();

                if (lastMessageTime !== null) {
                    const elapsed = currentTime - lastMessageTime;
                    totalElapsedTime += elapsed;

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

                if (this.bvhAnim) {
                    this.bvhAnim.updateFromBinary(event.data);
                }
            }
        };

        this.ws.onclose = () => {
            console.log("Déconnecté du serveur d'animation.");
            this.ws = null;
            this.globalData.connected[0] = false;
        };

        this.ws.onerror = (err) => {
            console.error("Erreur WebSocket:", err);
        };
    }

    /**
     * Déconnecte et nettoie le personnage
     */
    async disconnectSession(): Promise<void> {
        console.log("Déconnexion de la session...");

        // Fermer le WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Retirer le personnage de la scène
        if (this.bvhAnim) {
            this.scene.remove(this.bvhAnim.root);
            this.bvhAnim = null;
        }

        this.globalData.connected[0] = false;
        console.log("Session déconnectée.");
    }

    /**
     * Connecte une session complète (création + personnage + WebSocket)
     */
    async connectSession(): Promise<void> {
        try {
            await this.createSession();
            await this.loadCharacter();
            await this.connectWebSocket();
        } catch (error) {
            console.error("Erreur lors de la connexion:", error);
            await this.disconnectSession();
        }
    }

    /**
     * Boucle de rendu principale
     */
    private animate(_time: number): void {
        ImGuiImplWeb.BeginRender();
        this.stats.begin();

        // Rendu du GUI
        this.gui.render(this.globalData);

        // Suivi de la caméra si activé
        if (this.bvhAnim && this.globalData.cameraFollow[0]) {
            this.controls.target.copy(this.bvhAnim.bones[0].position.multiply(new Vector3(1, 0, 1)));
        }

        // Gestion des interactions caméra/ImGui
        this.controls.enabled = !ImGui.GetIO().WantCaptureMouse;

        this.controls.update();
        this.renderer.render(this.scene, this.camera);

        this.stats.end();
        this.renderer.resetState();

        // Exemple de modal ImGui (à garder ou retirer selon besoin)
        this.renderDebugModal();

        ImGuiImplWeb.EndRender();
    }

    /**
     * Modal de debug ImGui (exemple)
     */
    private renderDebugModal(): void {
        if (ImGui.Button("Open Modal")) {
            ImGui.OpenPopup("MyModal");
        }

        const io = ImGui.GetIO();
        ImGui.SetNextWindowPos(
            new ImVec2(io.DisplaySize.x * 0.5, io.DisplaySize.y * 0.5),
            ImGui.Cond.FirstUseEver,
            new ImVec2(0.5, 0.5)
        );

        if (ImGui.Begin("My GUI")) {
            ImGui.Text("SESSION ID");
            ImGui.SameLine();
            ImGui.InputText("##SESSION ID", this.globalData.SESSION_ID, 256);
        }
        ImGui.End();

        // ImGui.OpenPopup("MyModal");
        if (ImGui.BeginPopupModal("MyModal", [true], ImGui.WindowFlags.AlwaysAutoResize)) {
            ImGui.Text("All other windows are now blocked.");
            ImGui.Separator();
            ImGui.EndPopup();
        }
    }

    /**
     * Démarre l'application
     */
    async start(): Promise<void> {
        // Afficher les stats
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);

        // Initialiser ImGui
        await this.gui.initialize(this.renderer.domElement);

        // Démarrer la boucle de rendu
        this.renderer.setAnimationLoop((time) => this.animate(time));

        // Charger les animations disponibles
        await this.loadAnimations();

        // Auto-connexion si configurée
        const autoConnect = String(import.meta.env.VITE_AUTO_CONNECT).toLowerCase() === 'true';
        if (autoConnect) {
            await this.connectSession();
        }

        console.log("Application démarrée !");
    }
}
