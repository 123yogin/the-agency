// Request guards: DNS-rebinding host check, per-launch action token, same-origin checks, LAN key.
import crypto from 'node:crypto';

export const newSecret = () => crypto.randomBytes(24).toString('hex');

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a === '') return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Only IP literals, localhost, and explicitly allowed names (stops DNS rebinding).
// Adapted from humaedihume/kantor-agent runtime/lib/node/http.mjs (MIT, Copyright (c) 2026 humaedihume).
export function hostAllowed(hostHeader, extra = '') {
  if (typeof hostHeader !== 'string' || hostHeader === '') return false;
  const h = hostHeader.toLowerCase();
  const m = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/.exec(h);
  if (!m) return false;
  const name = m[1];
  if (name.startsWith('[')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return true;
  if (name === 'localhost' || name.endsWith('.localhost')) return true;
  for (const x of String(extra || '').toLowerCase().split(',')) {
    const e = x.trim();
    if (e !== '' && (name === e || (e.startsWith('.') && name.endsWith(e)))) return true;
  }
  return false;
}

export function isLoopback(addr) {
  const a = String(addr || '');
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1' || a.startsWith('127.');
}

export function cookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// LAN access: loopback always; other addresses need the LAN key (cookie, or ?key= on first visit).
export function lanAccess(req, url, lanKey) {
  if (isLoopback(req.socket?.remoteAddress)) return { ok: true };
  if (!lanKey) return { ok: false, status: 403, error: 'HQ only accepts connections from this computer. Start it with /hq lan to open it on your network.' };
  if (safeEqual(cookie(req, 'hq_key') || '', lanKey)) return { ok: true };
  if (safeEqual(url.searchParams.get('key') || '', lanKey)) return { ok: true, setCookie: `hq_key=${lanKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200` };
  return { ok: false, status: 401, error: 'This HQ link needs its access key. Scan the QR code shown in HQ on your computer.' };
}

// Every state-changing request: POST, JSON body, same origin, and the per-launch token in a header.
export function checkAction(req, token) {
  if (req.method !== 'POST') return 'Use POST for actions.';
  const ct = String(req.headers['content-type'] || '');
  if (!ct.startsWith('application/json')) return 'Actions must send JSON.';
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return 'Cross-site requests are not allowed.';
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    let o;
    try {
      o = new URL(origin);
    } catch {
      return 'Bad Origin header.';
    }
    if (o.host !== String(req.headers.host || '')) return 'Cross-origin requests are not allowed.';
  } else if (origin === 'null') return 'Cross-origin requests are not allowed.';
  if (!safeEqual(String(req.headers['x-hq-token'] || ''), token)) return 'Missing or wrong HQ token. Reload the page.';
  return null;
}

export const SECURITY_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};
