#!/usr/bin/env bash
#
# raw-to-web: one RAW/large still -> developed -> (optional AI clean/upscale/restore)
#             -> responsive AVIF/WebP/JPEG. All open-source, commercial-safe tools.
#
# Usage:
#   ./process.sh INPUT [--style style.xmp] [--nobg] [--upscale 2] [--restore] [--no-ai]
#
# Deterministic path (always safe for CI): develop (darktable) -> encode (vips).
# AI steps (--nobg / --upscale / --restore) are opt-in and INVENT pixels — review
# each result; never apply to images presented as diagnostic/clinical records.
#
# Deps (see this plugin's README for install): darktable-cli, vips,
# rembg (--nobg), realesrgan-ncnn-vulkan (--upscale), gfpgan (--restore).
set -euo pipefail

SRC="${1:?usage: process.sh INPUT [--style f.xmp] [--nobg] [--upscale N] [--restore] [--no-ai]}"
shift || true

STYLE=""; DO_NOBG=0; UPSCALE=0; DO_RESTORE=0; NO_AI=0
while [ $# -gt 0 ]; do
  case "$1" in
    --style)   STYLE="$2"; shift 2 ;;
    --nobg)    DO_NOBG=1; shift ;;
    --upscale) UPSCALE="$2"; shift 2 ;;
    --restore) DO_RESTORE=1; shift ;;
    --no-ai)   NO_AI=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ "$NO_AI" = 1 ] && { DO_NOBG=0; UPSCALE=0; DO_RESTORE=0; }

STEM="$(basename "${SRC%.*}")"
WORK="./work/$STEM"; mkdir -p "$WORK" ./out
CUR="$WORK/01_dev.tif"

# (1) RAW develop -> 16-bit TIFF. Deterministic via an XMP style sidecar (pass
#     the same --style across a batch for a consistent look).
echo "[1/4] develop: $SRC"
darktable-cli "$SRC" ${STYLE:+"$STYLE"} "$CUR" --core --disable-opencl

# (4) Background removal (opt-in). Pin a commercial-safe model.
if [ "$DO_NOBG" = 1 ]; then
  echo "[ai] background removal"
  REMBG_MODEL="${REMBG_MODEL:-isnet-general-use}" rembg i "$CUR" "$WORK/02_nobg.png"
  CUR="$WORK/02_nobg.png"
fi

# (6) Upscale (opt-in). Portable binary, no Python, CPU/any-GPU.
if [ "$UPSCALE" -gt 0 ] 2>/dev/null && [ "$UPSCALE" != 0 ]; then
  echo "[ai] upscale x$UPSCALE"
  realesrgan-ncnn-vulkan -i "$CUR" -o "$WORK/03_up.png" -n realesrgan-x4plus -s "$UPSCALE"
  CUR="$WORK/03_up.png"
fi

# (7) Face/detail restore (opt-in). Conservative on real subjects.
if [ "$DO_RESTORE" = 1 ]; then
  echo "[ai] face/detail restore"
  gfpgan -i "$CUR" -o "$WORK" -v 1.4 -s 2
  # gfpgan writes to $WORK/restored_imgs/<name>
  RESTORED="$WORK/restored_imgs/$(basename "$CUR")"
  [ -f "$RESTORED" ] && CUR="$RESTORED"
fi

# (2+3) Resize + responsive AVIF/WebP/JPEG in one pass (libvips engine).
echo "[enc] responsive AVIF/WebP/JPEG -> ./out/"
for w in 480 768 1200 1920; do
  vips thumbnail "$CUR" "./out/${STEM}_${w}.avif[Q=50]" $w
  vips thumbnail "$CUR" "./out/${STEM}_${w}.webp[Q=72]" $w
  vips thumbnail "$CUR" "./out/${STEM}_${w}.jpg[Q=80,optimize_coding]" $w
done

echo "done: ./out/${STEM}_{480,768,1200,1920}.{avif,webp,jpg}"
