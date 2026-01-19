export interface GlobalData {
    SESSION_ID: [string];
    SESSION_TYPE: [number];
    API_URL: [string];
    WS_URL: [string];
    ANIMATIONS: [string];
    SELECTED_ANIMATION: [number];
    play: [boolean];
    connected: [boolean];
    cameraFollow: [boolean];
    playbackSpeed: [number];
    vae_values: [[number], [number], [number]];
}

export const SESSION_TYPES: readonly string[] = ["FK", "VAE"];