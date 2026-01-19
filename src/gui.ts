// noinspection D

import {ImGui, ImGuiImplWeb} from "@mori2003/jsimgui";
import {AnimationClient} from "./network.ts";
import {type GlobalData, SESSION_TYPES} from "./DataInterface.ts";
import {sendDeleteRequest, sendPostRequest} from "./tools.ts";

export class GUI {
    private stopRotation: [boolean] = [false];
    private cubeColor: [number, number, number] = [0.0, 0.0, 0.5];

    public onDeleteSessionCallback: (() => void) | null = null;
    public onCreateSessionCallback: (() => void) | null = null;

    public async initialize(myCanvas: HTMLCanvasElement): Promise<void> {
        await ImGuiImplWeb.Init({
            canvas: myCanvas,
            // device: myGPUDevice, // Required for WebGPU
        });
    }

    public render(globalData: GlobalData): void {
        if (ImGui.CollapsingHeader("Connection Info", ImGui.TreeNodeFlags.DefaultOpen)) {
            ImGui.Text("SESSION ID");
            ImGui.SameLine();
            ImGui.InputText("##SESSION ID", globalData.SESSION_ID, 256);

            ImGui.Text("SESSION Type");
            ImGui.SameLine();
            if (ImGui.Combo("##Type", globalData.SESSION_TYPE, SESSION_TYPES.join("\0") + "\0")) {
                console.log("Selected Session Type:", SESSION_TYPES[globalData.SESSION_TYPE[0]]);
            }

            ImGui.Text("API URL");
            ImGui.SameLine();
            ImGui.InputText("##API URL", globalData.API_URL, 256);

            ImGui.Text("WS URL");
            ImGui.SameLine();
            ImGui.InputText("##WS URL", globalData.WS_URL, 256);

            ImGui.Text("Available Animations");
            ImGui.SameLine();
            if (ImGui.Combo("##Animation", globalData.SELECTED_ANIMATION, globalData.ANIMATIONS.join("\0") + "\0")) {
                console.log("Selected animation:", globalData.ANIMATIONS[globalData.SELECTED_ANIMATION[0]]);
            }

            if (ImGui.Button(globalData.connected[0] ? "Stop Session" : "Start Session")) {
                globalData.connected[0] = !globalData.connected[0];

                if (globalData.connected[0]) {
                    console.log("Starting session...");
                    sendPostRequest(`${globalData.API_URL}/sessions`, JSON.stringify({
                        session_id: globalData.SESSION_ID[0],
                        session_type: SESSION_TYPES[globalData.SESSION_TYPE[0]],
                        animation_file: globalData.ANIMATIONS[globalData.SELECTED_ANIMATION[0]]
                    })).then(_ => {
                        this.onCreateSessionCallback?.();
                    });

                } else {
                    console.log("Stopping session...");
                    sendDeleteRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}`);
                    this.onDeleteSessionCallback?.();
                }
            }
        }

        if (ImGui.CollapsingHeader("Animation Controls", ImGui.TreeNodeFlags.DefaultOpen)) {
            ImGui.SeparatorText("Global");
            if (ImGui.Button(globalData.play[0] ? "Pause" : "Play")) {
                globalData.play[0] = !globalData.play[0];

                if (globalData.play[0]) {
                    console.log("Animation started");
                    sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/play`, {});
                } else {
                    console.log("Animation paused");
                    sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/pause`, {});
                }
            }

            if (ImGui.SliderFloat("Playback Speed", globalData.playbackSpeed, 0.0, 10.0, "%.2f")) {
                sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/speed`, JSON.stringify({
                    playback_speed: globalData.playbackSpeed[0]
                }));
            }


            ImGui.SeparatorText("VAE");
            if (ImGui.SliderFloat("Vae_1", globalData.vae_values[0], 0.0, 1.0, "%.2f")) {
                sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/vae_values`, JSON.stringify({
                    vae_values: globalData.vae_values.map(vae_float => vae_float[0])
                }));
            }

            if (ImGui.SliderFloat("Vae_2", globalData.vae_values[1], 0.0, 1.0, "%.2f")) {
                sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/vae_values`, JSON.stringify({
                    vae_values: globalData.vae_values.map(vae_float => vae_float[0])
                }));
            }

            if (ImGui.SliderFloat("Vae_3", globalData.vae_values[2], 0.0, 1.0, "%.2f")) {
                sendPostRequest(`${globalData.API_URL[0]}/sessions/${globalData.SESSION_ID[0]}/vae_values`, JSON.stringify({
                    vae_values: globalData.vae_values.map(vae_float => vae_float[0])
                }));
            }
        }

        if (ImGui.CollapsingHeader("Camera Controls", ImGui.TreeNodeFlags.DefaultOpen)) {
            ImGui.Checkbox("Camera Follow", globalData.cameraFollow);
        }

        if (ImGui.CollapsingHeader("Others")) {
            ImGui.Text("Hello, world!");
            ImGui.Checkbox("Stop Rotation", this.stopRotation);
            ImGui.Text("Rotate ? " + (this.stopRotation[0] ? "No" : "Yes"));

            ImGui.ColorPicker3("cube.material.color", this.cubeColor);


            if (ImGui.Button("Add BVH Skeleton")) {
                console.log("Button clicked!");
                AnimationClient.getInstance().AddClient();
            }
        }
    }
}