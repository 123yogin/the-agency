# media

Open-source image pipeline for turning **raw camera files into professional, web-ready images** — develop, retouch with local AI, and optimize — entirely with commercial-safe open-source tools. No proprietary editor, no cloud API, no per-image cost.

## What you get

**Skill**

| Skill | What it does |
|---|---|
| [`raw-to-web`](skills/raw-to-web) | Chains the best-of-breed CLIs: `darktable-cli` (RAW develop) → `rembg` / `IOPaint` (background removal / object erase) → `realesrgan-ncnn-vulkan` (upscale) → `GFPGAN` (face/detail restore) → `vips` / Sharp (responsive AVIF/WebP/JPEG). Deterministic `--no-ai` path for CI. |

**MCP servers** (`.mcp.json`)

| Server | Package | Covers | License |
|---|---|---|---|
| `image-optimizer` | `npx -y mcp-image-optimizer` (Sharp/libvips) | Resize, crop, AVIF/WebP, LQIP, smart-crop, srcset — deterministic, GPU-free. The default workhorse. | MIT |
| `rembg` | `uvx --from rembg-mcp rembg-mcp` | Background removal / matting (pin `isnet-general-use` or `u2net`). | MIT |
| `comfyui` | local `comfyui_mcp_server` → ComfyUI at `:8188` | Optional generative inpaint / upscale / bg-removal graphs. Only if you run a GPU box. | Apache-2.0 server |

## Tooling chosen (and why)

Picked by a deep best-of-breed review; every item is **commercially licensed** unless flagged.

| Step | Tool | GitHub | License |
|---|---|---|---|
| RAW develop | **darktable-cli** | https://github.com/darktable-org/darktable | GPL-3.0 *(safe as a separately-invoked binary — do not static-link)* |
| Resize/crop/convert | **libvips** (`vips` CLI) | https://github.com/libvips/libvips | LGPL-2.1 |
| WebP/AVIF + srcset | **Sharp** (libvips) | https://github.com/lovell/sharp | Apache-2.0 |
| Background removal | **rembg** | https://github.com/danielgatis/rembg | MIT *(pin `u2net`/`isnet-general-use`)* |
| Object erase / inpaint | **IOPaint** (LaMa) | https://github.com/Sanster/IOPaint | Apache-2.0 *(archived — pin a version)* |
| Upscaling | **Real-ESRGAN** | https://github.com/xinntao/Real-ESRGAN | BSD-3 *(code **and** weights)* |
| Face/detail restore | **GFPGAN** | https://github.com/TencentARC/GFPGAN | Apache-2.0 |

## ⚠️ Licensing — do NOT ship on a commercial product

- **BRIA RMBG-2.0** (a rembg option) — paid commercial license. Pin rembg to `u2net`/`isnet-general-use`.
- **CodeFormer** (face restore) — NTU S-Lab 1.0 is **non-commercial**. Use GFPGAN instead.
- **FLUX.1 dev** (IOPaint/ComfyUI generative-fill) — **non-commercial** weights. Use LaMa (erase) or SDXL-inpaint (OpenRAIL) instead.
- **GPL apps** (darktable, RawTherapee, ComfyUI) are fine as *external binaries / internal backends*; never static-link or embed them.

## Install the CLIs the skill drives

```bash
# macOS
brew install vips darktable
pip install "rembg[cli]" iopaint==1.6.0 realesrgan gfpgan
# + grab the portable realesrgan-ncnn-vulkan binary from the Real-ESRGAN releases
```
```bash
# Debian/Ubuntu
sudo apt install libvips-tools darktable
pip install "rembg[cli]" iopaint==1.6.0 realesrgan gfpgan
```

## Known gap (good first contribution)

There is **no credible local AI-upscaling MCP server** in the ecosystem. The `raw-to-web` skill calls the BSD-3 `realesrgan-ncnn-vulkan` binary directly, but wrapping it (plus GFPGAN) as a thin stdio MCP exposing `upscale(input, scale, model)` / `restore(input)` would be the highest-leverage addition here.
