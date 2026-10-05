# mcp-creative

Open-source design and media tools, plus two optional cloud bridges.

Off by default. Enable with `/plugin` > the-agency > mcp-creative. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+, uv, and the local apps below. Video generation needs a real GPU.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| penpot | Read, create and edit designs in Penpot, the open-source Figma alternative | Run `npx -y @penpot/mcp@latest`, then open Penpot and load its MCP plugin. The server listens on localhost:4401 | none |
| comfyui | Local image (Flux, Qwen), video (Wan, LTX) and audio generation; builds and edits workflows | ComfyUI running locally (auto-detected) or on a LAN/RunPod box | none |
| blender | 3D scenes, objects, materials, assets | Blender, plus `uvx mcp-for-blender install-addon` once | none |
| figma | Figma file context for design-to-code | `figma_api_key` | Figma > Settings > Security > Personal access tokens |
| fal | Frontier image and video models (Kling, Veo, Flux, Wan) billed per use | `fal_key` | fal.ai > Dashboard > Keys. Costs money per generation |

**On replacing Higgsfield:** ComfyUI with open models gives good 5 to 10 second clips at about 720p, image-to-video and custom-character LoRAs. It trails closed models on motion, physics, faces and native audio. Video needs roughly 24 GB of VRAM (RTX 4090 class) for the 14B models, 12 to 16 GB for smaller ones; Apple Silicon is not practical for video. These are estimates, not benchmarks. For Higgsfield-level output, fal runs the same closed models through an open-source client.

fal is pinned to `mcp<2` because the current release does not start under the MCP 2.x SDK.

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
