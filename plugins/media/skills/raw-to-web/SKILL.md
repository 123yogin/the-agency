---
name: raw-to-web
description: Use when turning raw camera photos (CR2/NEF/ARW/DNG/RAF) or large stills into professional, optimized, web-ready images — developing RAW, retouching with local open-source AI (background removal, object erase, upscale, face/detail restore), and emitting responsive WebP/AVIF. Chains best-of-breed OSS CLIs; commercial-safe licenses only.
---

# RAW → professional web images (open-source)

Turn raw camera files into clean, consistent, fast-loading web images with a
chain of commercial-safe open-source tools — no proprietary editor, no cloud
API. Prefer the deterministic path (develop → encode); the AI steps are opt-in
per asset.

Verify the tools exist before running (`vips --version`, `darktable-cli
--version`, `rembg`, `iopaint`, `realesrgan-ncnn-vulkan -h`, `gfpgan -h`). If one
is missing, say which and give the install line from this plugin's README rather
than silently skipping a step.

## Hard rules

- **Commercial-licensing is a blocker, not a footnote.** On any product that
  ships or sells, NEVER use: BRIA RMBG-2.0 (paid), CodeFormer (non-commercial),
  FLUX.1 dev weights (non-commercial). Pin rembg to `u2net`/`isnet-general-use`,
  use GFPGAN not CodeFormer, use LaMa/SDXL-inpaint not FLUX. GPL apps (darktable,
  RawTherapee, ComfyUI) are fine only as *separately-invoked binaries*.
- **Deterministic by default.** Develop + encode (steps 1, 2, 3) are
  reproducible and GPU-free — always safe for CI. Steps 4–7 are AI, opt-in, and
  must be reviewed per image (they hallucinate detail).
- **Never upscale-then-claim-real on medical/clinical content.** Super-resolution
  and face restoration INVENT pixels. Keep strength conservative and never apply
  them to anything presented as a diagnostic/record image.
- **One consistent look.** Develop every image in a batch through the SAME
  darktable style/XMP sidecar so colour and exposure match across a gallery.
- **Preserve originals.** Work on copies; write outputs to a separate `out/`.

## The pipeline

A ready `process.sh` ships alongside this skill. One source file → developed →
(optional clean/upscale/restore) → responsive AVIF/WebP/JPEG.

| # | Step | Tool | Notes |
|---|---|---|---|
| 1 | RAW develop → 16-bit TIFF | `darktable-cli SRC style.xmp out.tif` | Deterministic via an XMP style sidecar; one style per batch for a consistent look. Runner-up: `rawtherapee-cli` with a PP3 profile. |
| 2 | Resize / crop / colour | `vips` (or Sharp in Node) | Same libvips engine everywhere; 3–5× faster and lighter than ImageMagick. |
| 3 | Encode WebP/AVIF + srcset | `vips thumbnail … .avif/.webp` / Sharp | Emit 480/768/1200/1920 widths; AVIF `Q≈50`, WebP `Q≈72`, JPEG `Q≈80` mozjpeg. |
| 4 | Background removal *(opt-in)* | `rembg i in out.png` | Pin a safe model via `REMBG_MODEL`. CPU-fine. |
| 5 | Object erase / inpaint *(opt-in)* | `iopaint run --model=lama --device=cpu` | Needs a mask; LaMa erases with no prompt, no GPU. |
| 6 | Upscale 2×/4× *(opt-in)* | `realesrgan-ncnn-vulkan -n realesrgan-x4plus -s 2` | Portable binary, no Python, CPU/any-GPU. |
| 7 | Face/detail restore *(opt-in)* | `gfpgan -v 1.4 -s 2` | Chain after upscale; conservative strength on real subjects. |

### Minimal deterministic run (CI-safe, no AI)

```bash
darktable-cli input.NEF ./styles/batch.xmp ./work/dev.tif --core --disable-opencl
for w in 480 768 1200 1920; do
  vips thumbnail ./work/dev.tif "./out/img_${w}.avif[Q=50]" $w
  vips thumbnail ./work/dev.tif "./out/img_${w}.webp[Q=72]" $w
done
```

### Node encode (drops into Next.js/Gatsby builds)

```js
import sharp from "sharp";
for (const w of [480, 768, 1200, 1920]) {
  const img = sharp("work/dev.tif").resize(w);
  await img.clone().avif({ quality: 50 }).toFile(`out/img_${w}.avif`);
  await img.clone().webp({ quality: 72 }).toFile(`out/img_${w}.webp`);
  await img.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(`out/img_${w}.jpg`);
}
```

## Via MCP (no shell)

This plugin also registers MCP servers (`.mcp.json`) for the common web ops
without touching a shell: **image-optimizer** (Sharp — resize, AVIF/WebP, LQIP,
smart-crop, srcset), **rembg** (background removal), and optionally **comfyui**
(generative graphs). Use these for deterministic steps 2–4; drop to the
`process.sh` chain for RAW develop (1) and the AI upscale/restore binaries (6–7),
which have no good MCP yet.

## Output checklist

- Consistent colour/exposure across the batch (same style sidecar).
- Modern formats with a JPEG fallback; widths cover mobile → desktop.
- `srcset`/`sizes` wired in the markup; explicit `width`/`height` to avoid CLS.
- AI steps, if used, visually reviewed — no invented detail on real/clinical photos.
- Originals untouched; outputs in `out/`.
