// QR code as an inline SVG string, generated locally (no network).
import qrcodegen from '../vendor/qrcodegen.mjs';

export function qrSvg(text, { border = 3 } = {}) {
  const qr = qrcodegen.QrCode.encodeText(String(text), qrcodegen.QrCode.Ecc.MEDIUM);
  const n = qr.size + border * 2;
  let d = '';
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) d += `M${x + border},${y + border}h1v1h-1z`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code for the HQ link"><rect width="100%" height="100%" fill="#ffffff"/><path d="${d}" fill="#111111"/></svg>`;
}

export const qrModules = (text) => {
  const qr = qrcodegen.QrCode.encodeText(String(text), qrcodegen.QrCode.Ecc.MEDIUM);
  return { size: qr.size, get: (x, y) => qr.getModule(x, y) };
};
