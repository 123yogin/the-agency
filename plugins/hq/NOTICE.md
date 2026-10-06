# Notices: hq plugin

| Item | Source | Licence |
|---|---|---|
| `runtime/public/office3d.js` (scene, people, desks, lounge, boards), `runtime/lib/transcripts.mjs`, `runtime/lib/office.mjs`, `runtime/lib/util.mjs`, host check in `runtime/lib/auth.mjs`, office panels in `runtime/public/app.js` | humaedihume/kantor-agent, `skills/kantor-agent/runtime` (Node half) | MIT, Copyright (c) 2026 humaedihume. Translated to English, desks relabelled with real agent and plugin names, dispatch runs, needs-you beacon, theme support and multi-project support added; the PHP runtime was not used. |
| `runtime/public/vendor/three/` (three.js r170: build, OrbitControls, CSS2DRenderer, RoomEnvironment, RoundedBoxGeometry) | mrdoob/three.js, as bundled by kantor-agent | MIT, Copyright © 2010-2024 three.js authors. See `runtime/public/vendor/three/LICENSE`. |
| `runtime/vendor/qrcodegen.mjs` | nayuki/QR-Code-generator, `typescript-javascript/qrcodegen.ts`, compiled to JavaScript | MIT, Copyright (c) Project Nayuki. See `runtime/vendor/QRCODEGEN-LICENSE.txt`. |
| Everything else (server, roster, routing, dispatch, health, LAN mode, page design) | Original to the-agency | MIT |

Ideas, not code, were taken from AgentSystemLabs/agent-office (needs-you
beacons, a 2D mode for phones) and bryanfrds/agents-warehouse (task routing,
approve before running).

## MIT License (kantor-agent)

Copyright (c) 2026 humaedihume

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
