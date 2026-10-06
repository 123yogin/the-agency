// Agency HQ — page logic: tabs, polling, the office panels (and lite 2D mode), Roster, Dispatch, Health.
// Office panel rendering adapted from humaedihume/kantor-agent runtime/public/assets/kantor.js (MIT, Copyright (c) 2026 humaedihume).
const CFG = window.HQ || {};
let office = null; // the 3D module, loaded on demand
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem(`hq.${k}`); return v === null ? d : v; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(`hq.${k}`, v); } catch { /* storage unavailable */ }
  },
};

// ------------------------------------------------------------------ formatting
const fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtHm = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtNum = new Intl.NumberFormat(undefined);
const fmtCompact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const hhmmss = (iso) => (iso ? fmtTime.format(new Date(iso)) : '');
const hhmm = (iso) => (iso ? fmtHm.format(new Date(iso)) : '');
function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return fmtDate.format(new Date(iso));
}
function dur(a, b) {
  if (!a) return '';
  const s = Math.max(0, ((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 1000);
  if (s < 60) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}
const initial = (s) => Array.from(String(s || '?').replace(/^Desk /, ''))[0].toUpperCase();
const STATE = { working: 'Working', done: 'Done', idle: 'Idle', stopped: 'Stopped', limit: 'Limit', review: 'Needs approval', queued: 'Queued', running: 'Running', failed: 'Failed', cancelled: 'Cancelled' };
const pill = (state, label = STATE[state] || state) => `<span class="pill s-${esc(state)}"><i></i>${esc(label)}</span>`;

// ------------------------------------------------------------------ network
async function api(path) {
  const r = await fetch(path, { cache: 'no-store', credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HQ answered ${r.status}`);
  return r.json();
}
async function act(path, body = {}) {
  const r = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-HQ-Token': CFG.token || '' },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok || !j || j.ok === false) throw new Error((j && j.error) || `HQ answered ${r.status}`);
  return j;
}
function toast(msg, bad = false) {
  const el = document.createElement('div');
  el.className = `toast${bad ? ' bad' : ''}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), bad ? 6500 : 3500);
}
async function copy(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    const was = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = was; btn.classList.remove('done'); }, 1400);
  } catch {
    toast(`Copy this: ${text}`);
  }
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (b) copy(b, b.dataset.copy);
});

// ------------------------------------------------------------------ theme
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : darkMQ.matches);
function setTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  store.set('theme', t || '');
  office?.setTheme(isDark());
}
setTheme(store.get('theme', '') || null);
darkMQ.addEventListener?.('change', () => office?.setTheme(isDark()));
$('themeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');

// ------------------------------------------------------------------ office: 3D or lite
let officeLoading = false;
let forceLite = false;
const liteMQ = matchMedia('(max-width: 759px)');
const glOk = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();
const lite = () => liteMQ.matches || forceLite || !glOk;
function updateLite() {
  const on = lite();
  document.body.classList.toggle('lite-on', on);
  $('lite').hidden = !on;
  for (const id of ['feedPanel', 'sidePanel', 'cards']) $(id).hidden = on;
  if (!on) loadOffice();
  office?.setPaused(on || tab !== 'office');
  if (S) renderOffice(S);
}
liteMQ.addEventListener?.('change', updateLite);
async function loadOffice() {
  if (office || officeLoading || lite()) return;
  officeLoading = true;
  try {
    const mod = await import('/assets/office3d.js');
    if (!mod.hasWebGL) {
      forceLite = true;
    } else {
      office = mod;
      office.setTheme(isDark());
      office.setOnPick((key) => selectCard(key));
      office.setWide(document.body.classList.contains('wide'));
      if (S && S.lead) office.apply(S);
      office.setPaused(tab !== 'office');
    }
  } catch (e) {
    console.error(e);
    forceLite = true;
    toast('The 3D office could not load, so HQ is showing the list view.', true);
  } finally {
    officeLoading = false;
    if (forceLite) updateLite();
  }
}

// panels
function setMin(side, on) {
  const panel = side === 'left' ? $('feedPanel') : $('sidePanel');
  panel.classList.toggle('min', on);
  document.body.classList.toggle(`min-${side}`, on);
  const b = panel.querySelector('.minbtn');
  b.setAttribute('aria-expanded', String(!on));
  b.title = on ? 'Expand' : 'Collapse';
  store.set(`min.${side}`, on ? '1' : '0');
}
for (const side of ['left', 'right']) {
  const saved = store.get(`min.${side}`);
  setMin(side, saved === null ? innerWidth <= 820 : saved === '1');
}
function setWide(on) {
  document.body.classList.toggle('wide', on);
  $('wideBtn').textContent = on ? 'Show panels' : 'Hide panels';
  store.set('wide', on ? '1' : '0');
  office?.setWide(on);
}
if (store.get('wide') === '1') setWide(true);
$('wideBtn').onclick = () => setWide(!document.body.classList.contains('wide'));
$('homeBtn').onclick = () => office?.home();
document.addEventListener('click', (e) => {
  const mb = e.target.closest('[data-min]');
  if (mb) {
    const side = mb.dataset.min;
    setMin(side, !(side === 'left' ? $('feedPanel') : $('sidePanel')).classList.contains('min'));
    return;
  }
  const pt = e.target.closest('[data-ptab]');
  if (pt) {
    if ($('sidePanel').classList.contains('min')) setMin('right', false);
    document.querySelectorAll('[data-ptab]').forEach((b) => b.setAttribute('aria-selected', String(b === pt)));
    document.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('on', p.dataset.pane === pt.dataset.ptab));
    return;
  }
  const f = e.target.closest('[data-focus]');
  if (f) {
    selectCard(f.dataset.focus);
    office?.focusOn(f.dataset.focus);
  }
});
let selected = null;
function selectCard(key) {
  selected = key;
  document.querySelectorAll('[data-focus]').forEach((c) => c.classList.toggle('sel', c.dataset.focus === key));
}

// ------------------------------------------------------------------ tabs
const TABS = ['office', 'roster', 'dispatch', 'health'];
let tab = 'office';
const loaded = new Set();
function go(t, { focus = false } = {}) {
  if (!TABS.includes(t)) t = 'office';
  tab = t;
  document.body.dataset.tab = t;
  document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== t; });
  document.querySelectorAll('[data-go]').forEach((b) => (b.dataset.go === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  if (location.hash !== `#${t}`) history.replaceState(null, '', `#${t}`);
  store.set('tab', t);
  office?.setPaused(t !== 'office' || lite());
  if (t !== 'office') window.scrollTo(0, 0);
  if (t === 'roster') loadRoster(!loaded.has('roster'));
  if (t === 'health') loadHealth();
  if (t === 'dispatch') loadDispatch();
  loaded.add(t);
  if (focus) $('main').focus({ preventScroll: true });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

// ------------------------------------------------------------------ projects
let projects = [];
let projectId = store.get('project', '');
async function loadProjects() {
  try {
    projects = (await api('/api/projects')).projects || [];
  } catch {
    return;
  }
  const sel = $('project');
  const cur = projectId;
  const latest = projects[0];
  sel.innerHTML = `<option value="">${esc(latest ? `Latest activity (${latest.name})` : 'No projects yet')}</option>`
    + projects.map((p) => `<option value="${esc(p.id)}" title="${esc(p.cwd || p.id)}">${esc(p.name)}</option>`).join('');
  sel.value = projects.some((p) => p.id === cur) ? cur : '';
  fillDispatchProjects();
}
$('project').addEventListener('change', (e) => {
  projectId = e.target.value;
  store.set('project', projectId);
  pollNow();
});

// ------------------------------------------------------------------ office state polling
let S = null;
let pollTimer = null;
let prevFeed = new Set();
let firstState = true;
async function poll() {
  clearTimeout(pollTimer);
  try {
    const d = await api(`/api/state${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);
    S = d;
    $('live').classList.remove('off');
    $('liveTxt').textContent = d.now ? `Live ${hhmm(d.now)}` : 'Live';
    renderOffice(d);
    if (d.lead) office?.apply(d);
    renderAttention(d.attention || []);
    renderDispatchBadge(d.dispatch || []);
    if (tab === 'dispatch' && d.dispatch) mergeRuns(d.dispatch);
  } catch {
    $('live').classList.add('off');
    $('liveTxt').textContent = 'Disconnected';
  } finally {
    if (firstState) {
      firstState = false;
      $('loading').classList.add('gone');
      setTimeout(() => $('loading').remove(), 700);
    }
    pollTimer = setTimeout(poll, document.hidden ? 12000 : 3000);
  }
}
const pollNow = () => poll();
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNow(); });

function feedHtml(list, fresh) {
  return list.map((e) => {
    const k = `${e.t}|${e.who}|${e.text}`;
    return `<li class="k-${esc(e.kind)}${fresh.has(k) ? ' fresh' : ''}"><span class="av" style="--c:${esc(e.color)}">${esc(initial(e.name))}</span><div><div class="meta"><span class="who" style="color:${esc(e.color)}">${esc(e.name)}</span><time>${esc(hhmmss(e.t))}</time></div><div class="txt">${esc(e.text)}</div></div></li>`;
  }).join('') || '<li><div class="empty" style="grid-column:1/-1">No activity yet.</div></li>';
}
function runsHtml(runs) {
  return runs.length ? runs.map((r) => `<div class="run" style="--c:${esc(r.color)}"><span class="c"></span><span class="t" title="${esc(r.task)}">${esc(r.task)}</span>${pill(r.status)}<span class="w">${esc(r.label)}${r.department ? `, ${esc(r.department)}` : ''}${r.dispatched ? ', from Dispatch' : ''} · ${esc(hhmm(r.started))} · ${esc(dur(r.started, r.ended))}</span></div>`).join('')
    : '<div class="empty">No agent runs in this project in the last 7 days.</div>';
}
function cardHtml({ key, name, dep, color, state, task, act: action, working }) {
  return `<button type="button" class="card${working ? ' working' : ''}${selected === key ? ' sel' : ''}" data-focus="${esc(key)}" style="--c:${esc(color)}"><span class="ava">${esc(initial(name))}</span><div class="h"><span class="nm">${esc(name)}</span>${pill(state)}</div><div class="dep">${esc(dep || '')}</div><div class="task" title="${esc(task)}">${esc(task || '')}</div><div class="act" title="${esc(action)}">${esc(action || '')}</div></button>`;
}
function cardsFor(d) {
  const k = d.lead;
  const kLast = k.updated ? `last active ${ago(k.updated)}` : 'no main session yet';
  const kSub = k.other_sessions > 0 ? `+${k.other_sessions} other session${k.other_sessions === 1 ? '' : 's'} active`
    : k.activity === 'waiting-team' ? `Waiting for ${k.waiting_on} agent${k.waiting_on === 1 ? '' : 's'}`
      : k.state === 'idle' ? kLast : k.last?.[0]?.text || kLast;
  const cards = [cardHtml({ key: 'lead', name: 'Lead', dep: 'Main session', color: '#1c6e8c', state: k.state, task: k.state === 'idle' ? 'Taking a break' : k.activity === 'tool' ? 'Running a tool' : 'Working in the main session', act: kSub, working: k.state === 'working' })];
  for (const m of d.staff) {
    const r = m.run;
    if (m.state === 'idle') {
      cards.push(cardHtml({ key: m.key, name: `Desk ${m.slot + 1}`, dep: 'Free desk', color: m.look || m.color, state: 'idle', task: r ? `Last: ${r.agent}` : 'Waiting for work', act: r ? `finished ${ago(r.ended)}` : '', working: false }));
    } else {
      const action = m.state === 'working' ? r?.last?.[0]?.text || 'Getting started' : `Finished ${ago(r?.ended)}`;
      cards.push(cardHtml({ key: m.key, name: m.name, dep: `${m.department}${r?.dispatched ? ', from Dispatch' : ''}`, color: m.color, state: m.state, task: r?.task || '', act: action, working: m.state === 'working' }));
    }
  }
  const seated = d.extras.filter((f) => f.desk !== null && f.desk < (d.spare_desks || 4));
  const extra = d.extras.filter((f) => f.desk === null || f.desk >= (d.spare_desks || 4));
  for (const f of seated) {
    cards.push(cardHtml({ key: f.key, name: f.name, dep: `${f.department}, extra desk`, color: f.color, state: f.state, task: f.run?.task || '', act: f.state === 'working' ? f.run?.last?.[0]?.text || 'Getting started' : 'Done, heading out', working: f.state === 'working' }));
  }
  if (extra.length) {
    cards.push(`<div class="card" style="--c:var(--muted)"><span class="ava">+${extra.length}</span><div class="h"><span class="nm">More agents</span></div><div class="dep">no free desk, still counted</div><div class="task">${esc(extra.slice(0, 3).map((f) => f.name).join(', '))}</div><div class="act"></div></div>`);
  }
  return cards;
}

function renderOffice(d) {
  const banner = $('banner');
  if (d.empty || !d.lead) {
    banner.className = 'banner calm';
    banner.innerHTML = 'No Claude Code activity yet. HQ fills in as soon as you use Claude Code. <button type="button" data-go="dispatch">Run your first task</button>';
    banner.hidden = false;
    $('feed').innerHTML = feedHtml([], new Set());
    $('liteStatus').innerHTML = '<h1>Nothing yet</h1><span class="stat">Use Claude Code in any project and it appears here.</span>';
    return;
  }
  const keys = new Set(d.feed.map((e) => `${e.t}|${e.who}|${e.text}`));
  const fresh = new Set(prevFeed.size ? [...keys].filter((k) => !prevFeed.has(k)) : []);
  prevFeed = keys;

  const mine = (d.attention || []).filter((a) => a.project === d.project.id);
  if (mine.length) {
    banner.className = 'banner';
    banner.innerHTML = `${esc(mine[0].text)}${mine[0].kind === 'review' ? ' <button type="button" data-go="dispatch">Review</button>' : ''}`;
    banner.hidden = false;
  } else if (!d.transcripts || (!d.runs.length && !d.lead.updated)) {
    banner.className = 'banner calm';
    banner.innerHTML = 'Nothing happened in this project in the last 7 days. <button type="button" data-go="dispatch">Send it a task</button>';
    banner.hidden = false;
  } else banner.hidden = true;

  const feed = feedHtml(d.feed.slice(0, 100), fresh);
  for (const id of ['feed', 'feed2']) if ($(id).innerHTML !== feed) $(id).innerHTML = feed;
  $('feedCount').textContent = fmtNum.format(d.feed.length);
  $('nRuns').textContent = fmtNum.format(d.runs.length);
  const runs = `<div class="src">Agent runs in ${esc(d.project.name)}, last 7 days, newest first.</div>${runsHtml(d.runs)}`;
  if ($('paneRuns').innerHTML !== runs) $('paneRuns').innerHTML = runs;
  const todos = d.lead.todos;
  $('nTodo').textContent = fmtNum.format(todos ? todos.items.filter((it) => it.status !== 'completed').length : 0);
  $('paneTodo').innerHTML = `<div class="src">The main session's to-do list${todos ? `, updated ${esc(ago(todos.at))}` : ''}.</div>`
    + (todos && todos.items.length ? todos.items.map((it) => `<div class="todo s-${esc(it.status)}"><i>${it.status === 'completed' ? '✓' : it.status === 'in_progress' ? '▶' : '○'}</i><span>${esc(it.text)}</span></div>`).join('') : '<div class="empty">No to-do list in the main session yet.</div>');

  const cards = cardsFor(d);
  const el = $('cards');
  el.style.gridTemplateColumns = `repeat(${cards.length}, minmax(0, 1fr))`;
  el.classList.toggle('compact', cards.length > 6);
  const html = cards.join('');
  if (el.innerHTML !== html) el.innerHTML = html;

  if (lite()) {
    const working = d.staff.filter((m) => m.state === 'working').length + d.extras.filter((f) => f.state === 'working').length;
    $('liteStatus').innerHTML = `<h1>${esc(d.project.name)}</h1><span class="stat"><b>${fmtNum.format(working)}</b> agent${working === 1 ? '' : 's'} working</span><span class="stat">Lead: <b>${esc(STATE[d.lead.state] || d.lead.state)}</b></span><span class="stat"><b>${fmtNum.format(d.runs.length)}</b> runs this week</span>`;
    $('liteAttn').innerHTML = mine.map((a) => `<div class="banner" style="position:static;transform:none">${esc(a.text)}${a.kind === 'review' ? ' <button type="button" data-go="dispatch">Review</button>' : ''}</div>`).join('');
    const items = cards.map((c) => `<li>${c}</li>`).join('');
    if ($('liteAgents').innerHTML !== items) $('liteAgents').innerHTML = items;
    const lf = feedHtml(d.feed.slice(0, 40), fresh);
    if ($('liteFeed').innerHTML !== lf) $('liteFeed').innerHTML = lf;
    $('liteRuns').innerHTML = runsHtml(d.runs.slice(0, 20));
  }
}

// ------------------------------------------------------------------ needs you
let attention = [];
function renderAttention(list) {
  const seen = new Set();
  attention = list.filter((a) => {
    const k = `${a.kind}|${a.project}|${a.run || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const n = attention.length;
  $('attnBtn').hidden = !n;
  $('attnTxt').textContent = `${n} need${n === 1 ? 's' : ''} you`;
  $('attnBtn').setAttribute('aria-label', `${n} item${n === 1 ? '' : 's'} need you`);
  document.title = n ? `(${n}) Agency HQ` : 'Agency HQ';
  if ($('attnDlg').open) fillAttention();
}
function fillAttention() {
  $('attnList').innerHTML = attention.length ? attention.map((a, i) => {
    const btn = a.kind === 'review' ? `<button type="button" class="primary" data-attn="${i}">Review</button>` : `<button type="button" class="ghost" data-attn="${i}">Show in office</button>`;
    return `<li><span>${esc(a.text)}<br><small class="sub">${esc(ago(a.at))}</small></span>${btn}</li>`;
  }).join('') : '<li>Nothing needs you right now.</li>';
}
$('attnBtn').onclick = () => {
  fillAttention();
  $('attnDlg').showModal();
};
$('attnList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-attn]');
  if (!b) return;
  const a = attention[Number(b.dataset.attn)];
  $('attnDlg').close();
  if (a.kind === 'review') {
    go('dispatch');
    setTimeout(() => document.querySelector(`[data-run="${a.run}"]`)?.scrollIntoView({ block: 'center' }), 300);
  } else {
    projectId = a.project;
    store.set('project', projectId);
    $('project').value = projectId;
    go('office');
    pollNow();
  }
});

// ------------------------------------------------------------------ roster
let roster = null;
let rKind = store.get('roster.kind', 'all');
let rQuery = '';
let rInstalled = store.get('roster.installed', '0') === '1';
async function loadRoster(force = false) {
  if (roster && !force) return renderRoster();
  $('rosterBody').innerHTML = '<div class="empty">Loading the roster</div>';
  try {
    roster = await api('/api/roster');
  } catch (e) {
    $('rosterBody').innerHTML = `<div class="empty">Could not load the roster: ${esc(e.message)}</div>`;
    return;
  }
  renderRoster();
  fillDispatchAgents();
}
const KIND_LABEL = { agent: 'Agent', skill: 'Skill', command: 'Command', mcp: 'MCP server' };
function hl(text, q) {
  const s = esc(text);
  if (!q) return s;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return s;
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
}
function renderRoster() {
  if (!roster) return;
  document.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === rKind)));
  $('rosterInstalled').checked = rInstalled;
  const q = rQuery.trim().toLowerCase();
  const all = roster.plugins.flatMap((p) => [...p.agents, ...p.skills, ...p.commands, ...p.mcp]);
  const count = (k) => all.filter((x) => x.kind === k).length;
  $('rosterSub').textContent = roster.plugins.length
    ? `${count('agent')} agents, ${count('skill')} skills, ${count('command')} commands and ${count('mcp')} MCP servers in ${roster.plugins.length} plugins. Usage counts cover the last ${roster.usageDays} days.`
    : 'The Agency marketplace was not found. Add it in Claude Code with /plugin marketplace add 123yogin/the-agency.';
  const order = (p) => (p.enabled ? 0 : p.installed ? 1 : 2);
  const plugins = [...roster.plugins].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name)).filter((p) => !rInstalled || p.installed);
  const html = plugins.map((p) => {
    let items = [...p.agents, ...p.skills, ...p.commands, ...p.mcp];
    if (rKind !== 'all') items = items.filter((x) => x.kind === rKind);
    if (q) items = items.filter((x) => `${x.name} ${x.description} ${p.name}`.toLowerCase().includes(q));
    if ((q || rKind !== 'all') && !items.length) return '';
    const status = p.enabled ? pill('working', 'On') : p.installed ? pill('idle', 'Off') : pill('queued', 'Not installed');
    const counts = [['agent', p.agents.length], ['skill', p.skills.length], ['command', p.commands.length], ['mcp', p.mcp.length]].filter(([, n]) => n).map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}${n === 1 ? '' : 's'}`).join(', ');
    const rows = items.map((x) => `<li class="item"><div class="nm">${hl(x.name, q)}<span class="kind">${KIND_LABEL[x.kind]}</span></div><div class="use">${hl(x.use || x.description || '', q)}${x.notFor ? `<span class="not">${esc(x.notFor)}</span>` : ''}</div><div class="side">${x.used ? `<span class="used">used ${fmtNum.format(x.used)}×</span>` : ''}<button type="button" class="copy" data-copy="${esc(x.invoke)}" title="Copy: ${esc(x.invoke)}">Copy</button></div></li>`).join('');
    return `<details class="plug" style="--c:${esc(p.color)}"${p.installed || q || rKind !== 'all' ? ' open' : ''}><summary><span class="stripe"></span><h2>${esc(p.name)} <small>${esc(p.department)}${counts ? `, ${counts}` : ''}</small></h2>${status}<span class="desc">${esc(p.description)}</span></summary>${p.installed ? '' : `<div class="install">Not installed. In a terminal, run <code>${esc(p.install)}</code><button type="button" class="copy" data-copy="${esc(p.install)}">Copy</button></div>`}<ul class="items">${rows || '<li class="item"><span class="sub">Nothing of this kind in this plugin.</span></li>'}</ul></details>`;
  }).join('');
  $('rosterBody').innerHTML = html || `<div class="empty">Nothing matches “${esc(rQuery)}”. Try a shorter word, or switch the filter to All.</div>`;
}
document.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
  rKind = b.dataset.kind;
  store.set('roster.kind', rKind);
  renderRoster();
}));
let rTimer = null;
$('rosterSearch').addEventListener('input', (e) => {
  clearTimeout(rTimer);
  rTimer = setTimeout(() => {
    rQuery = e.target.value;
    renderRoster();
  }, 120);
});
$('rosterInstalled').addEventListener('change', (e) => {
  rInstalled = e.target.checked;
  store.set('roster.installed', rInstalled ? '1' : '0');
  renderRoster();
});

// ------------------------------------------------------------------ dispatch
let runs = [];
let chosen = 'general-purpose';
let suggestions = [];
let dispatchTimer = null;
$('modeReadTxt').textContent = CFG.modes?.read?.explain || 'Can read and search files. Cannot change anything.';
$('modeEditTxt').textContent = CFG.modes?.edit?.explain || 'Can create and change files in the project.';
function fillDispatchProjects() {
  const sel = $('dispatch-project');
  const cur = sel.value || projectId || projects[0]?.id || '';
  const usable = projects.filter((p) => p.exists);
  sel.innerHTML = usable.length ? usable.map((p) => `<option value="${esc(p.id)}" title="${esc(p.cwd)}">${esc(p.name)} (${esc(p.cwd)})</option>`).join('') : '<option value="">No project folders found</option>';
  if (usable.some((p) => p.id === cur)) sel.value = cur;
}
function enabledAgents() {
  if (!roster) return [];
  return roster.plugins.filter((p) => p.enabled).flatMap((p) => p.agents.map((a) => ({ ...a, plugin: p.name, department: p.department, color: p.color })));
}
function fillDispatchAgents() {
  const sel = $('dispatch-agent');
  const groups = {};
  for (const a of enabledAgents()) (groups[a.department] ||= []).push(a);
  sel.innerHTML = '<option value="">Choose an agent</option><option value="general-purpose">No specialist (general Claude)</option>'
    + Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
}
function renderSuggest() {
  const box = $('suggest');
  const task = $('dispatch-task').value.trim();
  const picked = chosen !== 'general-purpose' && !suggestions.some((s) => s.id === chosen) ? enabledAgents().find((a) => a.id === chosen) : null;
  const opts = [
    ...(picked ? [{ id: picked.id, name: picked.name, department: picked.department, why: 'Your pick' }] : []),
    ...suggestions.map((s) => {
      const a = enabledAgents().find((x) => x.id === s.id);
      return { id: s.id, name: s.name, department: a?.department || s.plugin, why: `${s.confidence === 'strong' ? 'Strong match' : s.confidence === 'possible' ? 'Possible match' : 'Weak match'}: ${s.reasons.join(', ')}` };
    }),
    { id: 'general-purpose', name: 'general', department: 'No specialist', why: 'Claude with no specialist instructions' },
  ];
  box.innerHTML = (task && !suggestions.length && !picked ? '<p class="hint">No specialist matched these words. You can still pick one below.</p>' : '')
    + (!task && !picked ? '<p class="hint">Describe the task and HQ suggests the best agents.</p>' : '')
    + opts.map((o) => `<label class="sug"><input type="radio" name="agent" value="${esc(o.id)}"${o.id === chosen ? ' checked' : ''}><b>${esc(o.name)}</b><span class="dep">${esc(o.department)}</span><span class="why">${esc(o.why)}</span></label>`).join('');
}
$('suggest').addEventListener('change', (e) => {
  if (e.target.name === 'agent') {
    chosen = e.target.value;
    $('dispatch-agent').value = '';
  }
});
$('dispatch-agent').addEventListener('change', (e) => {
  if (!e.target.value) return;
  chosen = e.target.value;
  renderSuggest();
});
let sTimer = null;
let sSeq = 0;
$('dispatch-task').addEventListener('input', () => {
  clearTimeout(sTimer);
  sTimer = setTimeout(async () => {
    const task = $('dispatch-task').value.trim();
    const seq = ++sSeq;
    if (!task) {
      suggestions = [];
      renderSuggest();
      return;
    }
    try {
      const r = await act('/api/route', { task });
      if (seq !== sSeq) return;
      const had = suggestions.some((s) => s.id === chosen) || chosen === 'general-purpose';
      suggestions = r.suggestions || [];
      if (had && suggestions[0] && suggestions[0].confidence !== 'weak') chosen = suggestions[0].id;
      renderSuggest();
    } catch {
      /* suggestions are optional */
    }
  }, 350);
});
$('compose').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('composeErr');
  err.hidden = true;
  const task = $('dispatch-task').value.trim();
  const project = $('dispatch-project').value;
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'read';
  if (!task) {
    err.textContent = 'Describe the task first.';
    err.hidden = false;
    $('dispatch-task').focus();
    return;
  }
  if (!project) {
    err.textContent = 'Pick a project. HQ lists every folder you have used Claude Code in.';
    err.hidden = false;
    return;
  }
  $('reviewBtn').disabled = true;
  try {
    const r = await act('/api/dispatch', { task, project, agent: chosen, mode });
    $('dispatch-task').value = '';
    suggestions = [];
    chosen = 'general-purpose';
    renderSuggest();
    mergeRuns([r.run, ...runs.filter((x) => x.id !== r.run.id)], true);
    setTimeout(() => document.querySelector(`[data-run="${r.run.id}"] [data-approve]`)?.focus(), 50);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    $('reviewBtn').disabled = false;
  }
});
function runCard(r) {
  const color = enabledAgents().find((a) => a.id === r.agent)?.color || 'var(--muted)';
  const label = r.agent === 'general-purpose' ? 'general' : r.agent;
  const head = `<div class="top">${pill(r.status)}<span class="agent">${esc(label)}</span><span class="where">in ${esc(r.projectName)}, ${esc(r.modeLabel)}, ${esc(ago(r.created))}</span></div><div class="task">${esc(r.task)}</div>`;
  let body = '';
  if (r.status === 'review') {
    body = `<div class="cmdlabel">HQ will run this command in <code>${esc(r.cwd)}</code></div><pre>${esc(r.command)}</pre><p class="sub">${esc(r.modeExplain)}</p><div class="btns"><button type="button" class="primary" data-approve="${esc(r.id)}">Run it</button><button type="button" class="ghost" data-edit="${esc(r.id)}">Edit</button><button type="button" class="ghost" data-discard="${esc(r.id)}">Discard</button></div>`;
  } else {
    const ev = (r.events || []).slice(-6);
    if (ev.length) body += `<ul class="events">${ev.map((e) => `<li><time>${esc(hhmmss(e.t))}</time><span>${esc(e.text)}</span></li>`).join('')}</ul>`;
    if (r.status === 'running') body += `<div class="sub"><span class="working-dots">Working</span> for ${esc(dur(r.started))}, ${fmtNum.format(r.tools || 0)} actions</div>`;
    if (r.status === 'queued') body += `<div class="sub">Waiting for a free slot. HQ runs up to two tasks at once.</div>`;
    if (r.result) body += `<details open><summary>Result</summary><pre>${esc(r.result)}</pre></details>`;
    if (r.error && r.status !== 'done') body += `<div class="err">${esc(r.error)}</div>`;
    const meta = [r.durationMs ? `${(r.durationMs / 1000).toFixed(1)} s` : r.started && r.ended ? dur(r.started, r.ended) : '', r.tools ? `${fmtNum.format(r.tools)} actions` : '', r.tokens ? `${fmtCompact.format(r.tokens)} tokens` : '', typeof r.costUsd === 'number' ? `$${r.costUsd.toFixed(r.costUsd < 0.1 ? 3 : 2)}` : ''].filter(Boolean);
    if (meta.length && r.status !== 'running') body += `<div class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>`;
    const btns = r.status === 'running' || r.status === 'queued'
      ? `<button type="button" class="danger" data-cancel="${esc(r.id)}">Cancel</button>`
      : `${r.status !== 'done' ? `<button type="button" class="ghost" data-retry="${esc(r.id)}">Try again</button>` : ''}<button type="button" class="ghost" data-discard="${esc(r.id)}">Remove</button>`;
    body += `<div class="btns">${btns}</div>`;
  }
  return `<article class="rcard${r.status === 'review' ? ' review' : ''}" data-run="${esc(r.id)}" style="--c:${color}">${head}${body}</article>`;
}
function mergeRuns(list, render = true) {
  runs = list;
  if (render) renderRuns();
}
function renderRuns() {
  const active = runs.filter((r) => ['running', 'queued'].includes(r.status)).length;
  $('runsSub').textContent = runs.length ? `${active ? `${active} active, ` : ''}${runs.length} total` : '';
  const html = runs.length ? runs.map(runCard).join('') : '<div class="empty">No runs yet. Describe a task on the left, review the exact command, then run it.</div>';
  const list = $('runList');
  if (list.innerHTML !== html) {
    const open = new Set([...list.querySelectorAll('details')].filter((d) => !d.open).map((d) => d.closest('[data-run]')?.dataset.run));
    list.innerHTML = html;
    list.querySelectorAll('details').forEach((d) => { if (open.has(d.closest('[data-run]')?.dataset.run)) d.open = false; });
  }
  renderDispatchBadge(runs);
}
function renderDispatchBadge(list) {
  const n = list.filter((r) => ['review', 'running', 'queued'].includes(r.status)).length;
  $('dispatchCount').hidden = !n;
  $('dispatchCount').textContent = n;
}
async function loadDispatch() {
  clearTimeout(dispatchTimer);
  if (!roster) await loadRoster(true);
  if (!projects.length) await loadProjects();
  fillDispatchProjects();
  if (!$('dispatch-agent').options.length) fillDispatchAgents();
  renderSuggest();
  try {
    const r = await api('/api/dispatch');
    mergeRuns(r.runs || []);
  } catch {
    /* keep the last list */
  }
  if (tab === 'dispatch') {
    const busy = runs.some((r) => ['running', 'queued'].includes(r.status));
    dispatchTimer = setTimeout(loadDispatch, busy ? 1500 : 6000);
  }
}
$('runList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-approve],[data-cancel],[data-discard],[data-edit],[data-retry]');
  if (!b) return;
  const id = b.dataset.approve || b.dataset.cancel || b.dataset.discard || b.dataset.edit || b.dataset.retry;
  const r = runs.find((x) => x.id === id);
  b.disabled = true;
  try {
    if (b.dataset.approve) {
      await act(`/api/dispatch/${id}/approve`);
      toast(`Started ${r?.agent === 'general-purpose' ? 'the task' : r?.agent}. Watch it in the office.`);
    } else if (b.dataset.cancel) {
      await act(`/api/dispatch/${id}/cancel`);
      toast('Cancelling');
    } else if (b.dataset.discard) {
      await act(`/api/dispatch/${id}/discard`);
    } else {
      // edit or retry: put the task back in the form
      if (b.dataset.edit) await act(`/api/dispatch/${id}/discard`);
      $('dispatch-task').value = r.task;
      $('dispatch-project').value = r.project;
      chosen = r.agent;
      document.getElementById(r.mode === 'edit' ? 'mode-edit' : 'mode-read').checked = true;
      renderSuggest();
      $('dispatch-task').focus();
    }
  } catch (ex) {
    toast(ex.message, true);
  } finally {
    b.disabled = false;
    loadDispatch();
  }
});

// ------------------------------------------------------------------ health
let health = null;
let healthTimer = null;
async function loadHealth() {
  clearTimeout(healthTimer);
  try {
    health = await api('/api/health');
  } catch (e) {
    $('pluginList').innerHTML = `<div class="empty">Could not read health: ${esc(e.message)}</div>`;
    return;
  }
  renderHealth();
  if (health.mcp.running && tab === 'health') healthTimer = setTimeout(loadHealth, 2000);
}
function renderHealth() {
  const h = health;
  const plugs = [...h.plugins].sort((a, b) => (b.installed - a.installed) || a.name.localeCompare(b.name));
  $('pluginList').innerHTML = plugs.length ? plugs.map((p) => {
    const counts = [['agent', p.counts.agents], ['skill', p.counts.skills], ['command', p.counts.commands], ['MCP server', p.counts.mcp]].filter(([, n]) => n).map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`).join(', ');
    const right = p.installed
      ? `<button type="button" class="switch" role="switch" aria-checked="${p.enabled}" aria-label="${esc(p.name)} ${p.enabled ? 'on' : 'off'}" data-toggle="${esc(p.name)}"${p.name === 'hq' ? ' disabled title="HQ cannot switch itself off"' : ''}></button>`
      : `<button type="button" class="copy" data-copy="${esc(p.install)}">Copy install command</button>`;
    return `<div class="row" style="--c:${esc(p.color)}"><span class="stripe"></span><div class="title">${esc(p.name)} ${p.version ? `<code>${esc(p.version)}</code>` : ''}${p.installed ? '' : pill('queued', 'Not installed')}</div><div class="right">${right}</div><div class="detail">${esc(p.description)}${counts ? ` ${esc(counts)}.` : ''}</div></div>`;
  }).join('') : '<div class="empty">The Agency marketplace is not set up. In Claude Code, run /plugin marketplace add 123yogin/the-agency.</div>';

  const m = h.mcp;
  $('mcpBtn').disabled = m.running;
  $('mcpBtn').textContent = m.running ? 'Checking' : m.at ? 'Check again' : 'Check servers';
  $('mcpSub').textContent = m.running ? 'Checking every configured server. This can take a minute.' : m.at ? `Last checked ${ago(m.at)}.` : 'Checking starts every configured server once, so it can take a minute.';
  const MS = { connected: ['working', 'Connected'], failed: ['failed', 'Failed'], 'needs-auth': ['review', 'Needs sign-in'], pending: ['idle', 'Waiting for approval'] };
  const groups = {};
  for (const s of m.servers) (groups[s.plugin ? `Plugin: ${s.plugin}` : 'Your own servers'] ||= []).push(s);
  $('mcpList').innerHTML = m.error ? `<div class="err">${esc(m.error)}</div>` : Object.entries(groups).map(([g, list]) => `<div class="group-h">${esc(g)}</div>${list.map((s) => `<div class="row"><span class="stripe"></span><div class="title">${esc(s.server)}</div><div class="right">${pill(...MS[s.status])}</div><div class="detail">${esc(s.status === 'failed' && s.detail ? s.detail : s.command)}</div></div>`).join('')}`).join('');

  $('preList').innerHTML = h.prereqs.map((p) => `<div class="row" style="--c:${p.found ? 'var(--ok)' : p.required ? 'var(--bad)' : 'var(--warn)'}"><span class="stripe"></span><div class="title">${esc(p.name)} ${p.version ? `<code>${esc(p.version)}</code>` : ''}</div><div class="right">${p.found ? pill('working', 'Found') : `${pill(p.required ? 'failed' : 'stopped', p.required ? 'Missing, required' : 'Missing')}${/^https?:/.test(p.fix) ? `<a class="copy" href="${esc(p.fix)}" target="_blank" rel="noopener noreferrer">Open guide</a>` : `<button type="button" class="copy" data-copy="${esc(p.fix)}">Copy fix</button>`}`}</div><div class="detail">${esc(p.why)}${p.found ? '' : ` Fix: <code>${esc(p.fix)}</code>`}</div></div>`).join('');

  const problems = h.prereqs.filter((p) => !p.found && p.required).length + m.servers.filter((s) => s.status === 'failed').length;
  $('healthCount').hidden = !problems;
  $('healthCount').textContent = problems;
  $('healthSub').textContent = problems ? `${problems} thing${problems === 1 ? ' needs' : 's need'} fixing.` : 'Plugins, MCP servers and the tools they need.';
}
$('pluginList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-toggle]');
  if (!b) return;
  const name = b.dataset.toggle;
  const want = b.getAttribute('aria-checked') !== 'true';
  b.disabled = true;
  try {
    const r = await act('/api/plugins/toggle', { name, enabled: want });
    toast(r.output || `${name} switched ${want ? 'on' : 'off'}. Start a new Claude Code session to use it.`);
  } catch (ex) {
    toast(ex.message, true);
  } finally {
    await loadHealth();
    roster = null;
  }
});
$('mcpBtn').onclick = async () => {
  try {
    await act('/api/health/mcp');
  } catch (ex) {
    toast(ex.message, true);
  }
  loadHealth();
};

// ------------------------------------------------------------------ share on the network
$('shareBtn').onclick = async () => {
  const body = $('shareBody');
  body.innerHTML = '<p class="sub">Loading</p>';
  $('shareDlg').showModal();
  let lan = { enabled: false };
  try {
    lan = await api('/api/lan');
  } catch {
    /* only available on the host computer */
  }
  body.innerHTML = lan.enabled
    ? `<img class="qr" alt="QR code for the HQ link" src="data:image/svg+xml;utf8,${encodeURIComponent(lan.qr)}"><div class="urlbox"><code>${esc(lan.url)}</code><button type="button" class="copy" data-copy="${esc(lan.url)}">Copy link</button></div><p class="note">Scan with your phone's camera while it is on the same Wi-Fi. Anyone with this link can see your agents and dispatch tasks, so share it only with people you trust. Stop sharing with <code>/hq restart</code>.</p>`
    : `<p>HQ is only open to this computer right now. To use it from your phone on the same Wi-Fi, run this in Claude Code:</p><div class="urlbox"><code>/hq lan</code><button type="button" class="copy" data-copy="/hq lan">Copy</button></div><p class="note">HQ then shows a QR code here. The link carries a private key, and HQ never opens to the internet.</p>`;
};

// ------------------------------------------------------------------ keyboard
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const typing = e.target.closest('input, textarea, select, [contenteditable]');
  if (typing) return;
  if (document.querySelector('dialog[open]')) return;
  const k = e.key;
  if (k >= '1' && k <= '4') go(TABS[Number(k) - 1]);
  else if (k === '/') {
    e.preventDefault();
    if (tab === 'dispatch') $('dispatch-task').focus();
    else {
      go('roster');
      $('rosterSearch').focus();
    }
  } else if (k === 'p' || k === 'P') $('project').focus();
  else if (k === 'n' || k === 'N') $('attnBtn').click();
  else if ((k === 'h' || k === 'H') && tab === 'office') setWide(!document.body.classList.contains('wide'));
  else if (k === 't' || k === 'T') $('themeBtn').click();
  else if (k === '?') $('helpDlg').showModal();
});
$('helpBtn').onclick = () => $('helpDlg').showModal();

// ------------------------------------------------------------------ start
updateLite();
go((location.hash || '').slice(1) || store.get('tab', 'office'));
await loadProjects();
poll();
setInterval(loadProjects, 30000);
