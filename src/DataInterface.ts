export interface GlobalData {
    SESSION_ID: [string];
    SESSION_TYPE: [number];
    API_URL: [string];
    WS_URL: [string];
    ANIMATIONS: [string];
    SELECTED_ANIMATION: [number];
    SESSION_FPS: [number];
    play: [boolean];
    connected: [boolean];
    cameraFollow: [boolean];
    playbackSpeed: [number];
    vae_values: [[number], [number], [number]];
    infoModal: InfoModal;
    infoText: [string]
}

interface InfoModal {
    isOpen: [boolean];
    title: [string];
    message: [string];
}

export const SESSION_TYPES: readonly string[] = ["FK", "VAE"];
export const SESSION_FPS: readonly number[] = [5, 10, 24, 30, 45, 60, 120, 240];