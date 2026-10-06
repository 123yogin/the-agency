// Agency HQ — page logic: tabs, polling, the office panels (and lite 2D mode), Ask the Lead, Daily plan, Roster, Dispatch, Health.
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
const STATE = {
  working: 'Working', done: 'Done', idle: 'Idle', stopped: 'Stopped', limit: 'Limit', review: 'Needs approval', queued: 'Queued', running: 'Running', failed: 'Failed', cancelled: 'Cancelled',
  waiting: 'Waiting', blocked: 'Needs you', skipped: 'Skipped', interrupted: 'Interrupted', planning: 'Planning', 'plan-ready': 'Plan ready', 'plan-failed': 'No plan',
  paused: 'Needs you', summarizing: 'Summarising', following: 'Planning more',
};
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
const TABS = ['lead', 'daily', 'office', 'roster', 'dispatch', 'health'];
let tab = 'lead';
const loaded = new Set();
function go(t, { focus = false } = {}) {
  if (!TABS.includes(t)) t = 'lead';
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
  if (t === 'lead') loadLead();
  if (t === 'daily') loadDaily();
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
  fillLeadProjects();
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
    renderBusy(d);
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
  return runs.length ? runs.map((r) => `<div class="run" style="--c:${esc(r.color)}"><span class="c"></span><span class="t" title="${esc(r.task)}">${esc(r.task)}</span>${pill(r.status)}<span class="w">${esc(r.label)}${r.department ? `, ${esc(r.department)}` : ''}${r.fromJob ? ', from Ask the Lead' : r.dispatched ? ', from Dispatch' : ''} · ${esc(hhmm(r.started))} · ${esc(dur(r.started, r.ended))}</span></div>`).join('')
    : '<div class="empty">No agent runs in this project in the last 7 days.</div>';
}
function jobsHistoryHtml(jobs) {
  if (!jobs.length) return '';
  return `<div class="src">Lead jobs in this project.</div>${jobs.map((j) => `<button type="button" class="run jobrun" data-openjob="${esc(j.id)}" style="--c:#1c6e8c"><span class="c"></span><span class="t" title="${esc(j.goal)}">${esc(j.goal)}</span>${pill(j.status)}<span class="w">${esc(j.done)} of ${esc(j.tasks)} tasks done · ${esc(ago(j.created))}${j.summary ? ` · ${esc(j.summary.replace(/\s+/g, ' ').slice(0, 120))}` : ''}</span></button>`).join('')}`;
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
      cards.push(cardHtml({ key: m.key, name: m.name, dep: `${m.department}${r?.fromJob ? ', for the Lead' : r?.dispatched ? ', from Dispatch' : ''}`, color: m.color, state: m.state, task: r?.task || '', act: action, working: m.state === 'working' }));
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
    banner.innerHTML = `${esc(mine[0].text)}${mine[0].kind === 'review' ? ' <button type="button" data-go="dispatch">Review</button>' : mine[0].kind === 'job' ? ` <button type="button" data-openjob="${esc(mine[0].job)}">Open</button>` : mine[0].kind.startsWith('daily') ? ' <button type="button" data-go="daily">Open</button>' : ''}`;
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
  const runs = `${jobsHistoryHtml(d.jobs || [])}<div class="src">Agent runs in ${esc(d.project.name)}, last 7 days, newest first.</div>${runsHtml(d.runs)}`;
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
    $('liteAttn').innerHTML = mine.map((a) => `<div class="banner" style="position:static;transform:none">${esc(a.text)}${a.kind === 'review' ? ' <button type="button" data-go="dispatch">Review</button>' : a.kind === 'job' ? ` <button type="button" data-openjob="${esc(a.job)}">Open</button>` : a.kind.startsWith('daily') ? ' <button type="button" data-go="daily">Open</button>' : ''}</div>`).join('');
    const items = cards.map((c) => `<li>${c}</li>`).join('');
    if ($('liteAgents').innerHTML !== items) $('liteAgents').innerHTML = items;
    const lf = feedHtml(d.feed.slice(0, 40), fresh);
    if ($('liteFeed').innerHTML !== lf) $('liteFeed').innerHTML = lf;
    $('liteRuns').innerHTML = jobsHistoryHtml(d.jobs || []) + runsHtml(d.runs.slice(0, 20));
  }
}

// ------------------------------------------------------------------ needs you
let attention = [];
function renderAttention(list) {
  const seen = new Set();
  attention = list.filter((a) => {
    const k = `${a.kind}|${a.project}|${a.run || ''}|${a.job || ''}|${a.kind.startsWith('daily') ? a.text : ''}`;
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
    const btn = a.kind === 'review' ? `<button type="button" class="primary" data-attn="${i}">Review</button>` : a.kind === 'job' || a.kind === 'daily' || a.kind === 'daily-branch' ? `<button type="button" class="primary" data-attn="${i}">Open</button>` : `<button type="button" class="ghost" data-attn="${i}">Show in office</button>`;
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
  if (a.kind === 'job') {
    openJob(a.job);
  } else if (a.kind === 'daily' || a.kind === 'daily-branch') {
    go('daily');
    setTimeout(() => document.querySelector(`[data-dproj="${CSS.escape(a.project)}"]`)?.scrollIntoView({ block: 'start' }), 300);
  } else if (a.kind === 'review') {
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
    if (r.status === 'queued') body += `<div class="sub">Waiting for a free slot.</div>`;
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

// ------------------------------------------------------------------ ask the lead
let jobs = [];
let jobId = store.get('job', '') || null;
let leadTimer = null;
const drafts = new Map(); // job id -> { tasks, base, dirty }
const ACTIVE_JOB = new Set(['planning', 'following', 'running', 'summarizing']);
const COLS = [
  ['waiting', 'Waiting', (t) => t.status === 'waiting' || (t.status === 'running' && t.live?.status === 'queued')],
  ['running', 'Running', (t) => t.status === 'running' && t.live?.status !== 'queued'],
  ['blocked', 'Needs you', (t) => t.status === 'blocked'],
  ['done', 'Done', (t) => t.status === 'done' || t.status === 'skipped'],
  ['failed', 'Failed', (t) => ['failed', 'cancelled', 'interrupted'].includes(t.status)],
];
function agentInfo(id) {
  if (!id || id === 'general-purpose') return { name: 'general', department: 'No specialist', color: 'var(--muted)' };
  const a = enabledAgents().find((x) => x.id === id);
  return a ? { name: a.name, department: a.department, color: a.color } : { name: id, department: 'Not installed', color: 'var(--muted)' };
}
function agentOptions(selected) {
  const groups = {};
  for (const a of enabledAgents()) (groups[a.department] ||= []).push(a);
  const known = selected === 'general-purpose' || enabledAgents().some((a) => a.id === selected);
  return `<option value="general-purpose"${selected === 'general-purpose' ? ' selected' : ''}>general (no specialist)</option>`
    + (known ? '' : `<option value="${esc(selected)}" selected>${esc(selected)} (not installed)</option>`)
    + Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((a) => `<option value="${esc(a.id)}"${a.id === selected ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
}
function fillLeadProjects() {
  const sel = $('lead-project');
  const cur = sel.value || projectId || projects[0]?.id || '';
  const usable = projects.filter((p) => p.exists);
  sel.innerHTML = usable.length ? usable.map((p) => `<option value="${esc(p.id)}" title="${esc(p.cwd)}">${esc(p.name)}</option>`).join('') : '<option value="">No project folders found</option>';
  if (usable.some((p) => p.id === cur)) sel.value = cur;
}
const jobMeta = (j) => [
  `${fmtNum.format(j.runs || 0)} agent run${j.runs === 1 ? '' : 's'}`,
  j.tokens ? `${fmtCompact.format(j.tokens)} tokens` : '',
  j.costUsd ? `$${j.costUsd.toFixed(j.costUsd < 0.1 ? 3 : 2)}` : '',
  j.started ? dur(j.started, j.ended) : '',
].filter(Boolean);
function jobCard(j) {
  const total = j.tasks.length;
  const done = (j.counts.done || 0) + (j.counts.skipped || 0);
  const progress = total ? `<span class="bar" aria-hidden="true"><i style="width:${Math.round((done / total) * 100)}%"></i></span><span>${done} of ${total} tasks</span>` : '<span>No plan yet</span>';
  return `<button type="button" class="jcard s-${esc(j.status)}" data-job="${esc(j.id)}"><span class="g">${esc(j.goal)}</span><span class="jrow">${pill(j.status)}<span class="where">${esc(j.projectName)} · ${j.mode === 'edit' ? 'can edit files' : 'read-only'} · ${esc(ago(j.created))}</span></span><span class="prog">${progress}</span></button>`;
}
function renderJobList() {
  const box = $('jobs');
  if (jobId && jobs.some((j) => j.id === jobId)) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('job').hidden = true;
  const html = jobs.length
    ? `<div class="jobs-head"><h2>Jobs</h2><span class="sub">${jobs.filter((j) => ACTIVE_JOB.has(j.status)).length} active, ${jobs.length} total</span></div><div class="joblist">${jobs.map(jobCard).join('')}</div>`
    : `<div class="jobs-empty"><h2>How it works</h2><ol class="how"><li><b>You set the goal.</b> Plain words are fine.</li><li><b>The Lead plans.</b> It reads the project and proposes tasks, each with the agent best suited to it.</li><li><b>You check the plan.</b> Change agents, edit instructions, reorder, add or remove tasks.</li><li><b>Agents do the work.</b> Watch them at their desks in the Office. Anything that fails waits for you.</li><li><b>The Lead reports back.</b> A short summary of what was done and what is next.</li></ol></div>`;
  if (box.innerHTML !== html) box.innerHTML = html;
}
function openJob(id) {
  jobId = id;
  store.set('job', id || '');
  if (tab !== 'lead') go('lead');
  else loadLead();
  window.scrollTo(0, 0);
}
function closeJob() {
  jobId = null;
  store.set('job', '');
  renderLead();
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-openjob]');
  if (o) {
    openJob(o.dataset.openjob);
    return;
  }
  const c = e.target.closest('[data-job]');
  if (c && c.closest('#jobs')) openJob(c.dataset.job);
});

function renderLead() {
  renderJobList();
  const j = jobs.find((x) => x.id === jobId);
  const box = $('job');
  $('ask').hidden = !!j; // an open job gets the whole page; "All jobs" brings the form back
  if (!j) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  renderJobHead(j);
  renderJobBody(j);
  renderJobFoot(j);
}
function renderJobHead(j) {
  const btn = [];
  if (ACTIVE_JOB.has(j.status) || j.status === 'paused') btn.push(`<button type="button" class="danger" data-jact="stop">Stop job</button>`);
  if (j.status === 'interrupted' || j.status === 'stopped') btn.push(`<button type="button" class="primary" data-jact="resume">Pick up again</button>`);
  if (['paused', 'stopped', 'interrupted'].includes(j.status) && j.tasks.some((t) => t.status === 'done')) btn.push(`<button type="button" class="ghost" data-jact="finish">Finish and summarise</button>`);
  btn.push(`<button type="button" class="ghost" data-openoffice="${esc(j.project)}">Watch in office</button>`);
  if (!ACTIVE_JOB.has(j.status)) btn.push(`<button type="button" class="ghost" data-jact="discard">Remove</button>`);
  const meta = jobMeta(j);
  const html = `<button type="button" class="back" data-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>All jobs</button>
<div class="jhead"><div class="jtitle"><div class="jrow">${pill(j.status)}<span class="where">${esc(j.projectName)} · ${j.mode === 'edit' ? 'agents may edit files' : 'read-only'} · up to ${esc(j.parallel)} at once · ${esc(ago(j.created))}</span></div><h2 class="goal">${esc(j.goal)}</h2>${meta.length ? `<div class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}</div><div class="btns">${btn.join('')}</div></div>`;
  if ($('jobHead').innerHTML !== html) $('jobHead').innerHTML = html;
}
function leadActivity(j, title) {
  const ev = j.lead?.events || [];
  return `<div class="leadbox"><span class="ava lead-ava" aria-hidden="true">L</span><div><b>${esc(title)}</b><div class="sub"><span class="working-dots">${j.lead?.status === 'queued' ? 'Waiting for a free slot' : 'Working'}</span>${j.lead?.started ? ` for ${esc(dur(j.lead.started))}` : ''}</div>${ev.length ? `<ul class="events">${ev.slice(-4).map((e) => `<li><time>${esc(hhmmss(e.t))}</time><span>${esc(e.text)}</span></li>`).join('')}</ul>` : ''}</div></div>`;
}
function standupHtml(j) {
  const d = j.day;
  if (!d) return '';
  const st = d.standup;
  const notes = d.notes || [];
  if (!st && !notes.length) return '';
  const NOTE = { yourself: 'Only you can do this', denied: 'Not run by an agent', blocked: 'Code change not planned' };
  return `<section class="standup"><h3>Standup, ${esc(d.day)}</h3>${st ? `<dl class="sdl"><dt>Yesterday</dt><dd>${esc(st.yesterday || '—')}</dd><dt>Today</dt><dd>${esc(st.today || '—')}</dd><dt>Blockers</dt><dd>${esc(st.blockers || 'None')}</dd></dl>` : ''}${notes.length ? `<div class="yours"><h4>For you to do</h4><ul>${notes.map((n) => `<li class="k-${esc(n.kind)}"><b>${esc(n.title)}</b><span class="tag">${esc(NOTE[n.kind] || '')}</span><span class="why">${esc(n.why || '')}</span></li>`).join('')}</ul></div>` : ''}</section>`;
}
function renderJobBody(j) {
  const body = $('jobBody');
  if (j.status === 'plan-ready') {
    let d = drafts.get(j.id);
    if (!d || (!d.dirty && d.base !== j.updated)) {
      d = { tasks: j.tasks.filter((t) => t.status === 'waiting').map(({ id, title, prompt, agent, mode, depends_on, note, isNew }) => ({ id, title, prompt, agent, mode, depends_on: [...depends_on], note, isNew })), base: j.updated, dirty: false };
      drafts.set(j.id, d);
      body.dataset.key = '';
    }
    const key = `plan|${j.id}|${d.base}|${d.rev || 0}`;
    if (body.dataset.key !== key) {
      body.dataset.key = key;
      body.innerHTML = standupHtml(j) + planEditor(j, d);
    } else updateConfirm(j, d);
    return;
  }
  body.dataset.key = '';
  let html = '';
  html += standupHtml(j);
  if (j.status === 'planning') html += leadActivity(j, j.daily ? 'The Lead is holding the standup and planning today' : 'The Lead is reading the project and writing a plan');
  if (j.status === 'following') html += leadActivity(j, 'The Lead is planning the extra work');
  if (j.status === 'summarizing') html += leadActivity(j, 'The Lead is writing the summary');
  if (j.status === 'plan-failed') {
    html += `<div class="notice n-bad"><b>The Lead could not make a plan.</b> ${esc(j.planError || '')}${j.planRaw ? `<details><summary>What the Lead said</summary><pre>${esc(j.planRaw)}</pre></details>` : ''}<div class="btns"><button type="button" class="primary" data-jact="replan">Plan again</button></div></div>`;
  }
  if (j.status === 'stopped' && !j.tasks.length) html += `<div class="notice">${esc(j.planError || 'Stopped before a plan was made.')} <button type="button" class="ghost" data-jact="resume">Plan again</button></div>`;
  if (j.status === 'paused') html += `<div class="notice n-attn"><b>Paused.</b> A task failed, so the tasks that depend on it are waiting for you. Retry it, skip it, or finish and summarise.</div>`;
  if (j.followupError) html += `<div class="notice n-bad">The Lead could not plan the extra work: ${esc(j.followupError)}</div>`;
  if (j.summary || j.summaryError) {
    html += `<section class="summary"><h3>${j.daily ? 'Daily report' : "The Lead's summary"}</h3>${j.summary ? `<div class="prose">${esc(j.summary)}</div>` : `<p class="err">${esc(j.summaryError)}</p>`}</section>`;
  }
  if (j.tasks.length) html += board(j);
  if (body.innerHTML !== html) {
    const open = new Set([...body.querySelectorAll('details[open]')].map((x) => x.dataset.k));
    body.innerHTML = html;
    body.querySelectorAll('details[data-k]').forEach((x) => { if (open.has(x.dataset.k)) x.open = true; });
  }
}
function board(j) {
  const byId = new Map(j.tasks.map((t) => [t.id, t]));
  const cols = COLS.map(([k, label, test]) => {
    const list = j.tasks.filter(test);
    if (!list.length) return '';
    return `<section class="col col-${k}" aria-label="${esc(label)}"><h3>${esc(label)} <b class="n">${list.length}</b></h3>${list.map((t) => taskCard(j, t, byId)).join('')}</section>`;
  }).filter(Boolean);
  return `<div class="board" style="--cols:${cols.length}">${cols.join('')}</div>`;
}
function taskCard(j, t, byId) {
  const a = agentInfo(t.agent);
  const deps = (t.depends_on || []).map((d) => byId.get(d)?.title || d);
  const state = t.status === 'running' && t.live?.status === 'queued' ? 'queued' : t.status;
  let body = '';
  if (t.status === 'running' && t.live) {
    const ev = t.live.events || [];
    body += ev.length ? `<ul class="events">${ev.slice(-3).map((e) => `<li><time>${esc(hhmmss(e.t))}</time><span>${esc(e.text)}</span></li>`).join('')}</ul>` : '<div class="sub">Getting started</div>';
  }
  if (t.status === 'blocked') body += `<div class="sub">Waiting on ${esc(deps.filter((x, i) => ['failed', 'cancelled', 'interrupted', 'blocked'].includes(byId.get(t.depends_on[i])?.status)).join(', ') || 'an earlier task')}.</div>`;
  if (t.result && t.status === 'done') body += `<details data-k="r-${esc(t.id)}"><summary>Result</summary><div class="prose small">${esc(t.result.slice(0, 4000))}</div></details>`;
  if (t.error && t.status !== 'done') body += `<div class="err">${esc(t.error)}</div>`;
  const btns = [];
  if (j.status !== 'stopped' || t.status !== 'running') {
    if (t.status === 'running') btns.push(`<button type="button" class="danger sm" data-tact="cancel" data-tid="${esc(t.id)}">Cancel</button>`);
    if (['failed', 'cancelled', 'interrupted'].includes(t.status)) btns.push(`<button type="button" class="primary sm" data-tact="retry" data-tid="${esc(t.id)}">Retry</button>`);
    if (['waiting', 'blocked', 'failed', 'cancelled', 'interrupted'].includes(t.status) && !['planning', 'summarizing', 'following'].includes(j.status)) btns.push(`<button type="button" class="ghost sm" data-tact="skip" data-tid="${esc(t.id)}">Skip</button>`);
  }
  const meta = [t.durationMs ? `${Math.round(t.durationMs / 1000)} s` : t.started && t.ended ? dur(t.started, t.ended) : t.started && t.status === 'running' && t.live?.started ? dur(t.live.started) : '', t.tokens ? `${fmtCompact.format(t.tokens)} tokens` : '', typeof t.costUsd === 'number' && t.costUsd ? `$${t.costUsd.toFixed(3)}` : '', t.attempts > 1 ? `try ${t.attempts}` : ''].filter(Boolean);
  return `<article class="tcard${t.status === 'running' ? ' is-live' : ''}" style="--c:${esc(a.color)}"><div class="tc-top">${pill(state)}${t.mode === 'edit' ? '<span class="etag">edits files</span>' : ''}</div><h4>${esc(t.title)}</h4><div class="who"><span class="agent">${esc(a.name)}</span><span class="dep">${esc(a.department)}</span></div>${deps.length ? `<div class="after">After: ${esc(deps.join(', '))}</div>` : ''}${body}${meta.length ? `<div class="meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}${btns.length ? `<div class="btns">${btns.join('')}</div>` : ''}</article>`;
}
function planEditor(j, d) {
  const locked = j.tasks.filter((t) => t.status !== 'waiting');
  const titleOf = (id) => d.tasks.find((t) => t.id === id)?.title || locked.find((t) => t.id === id)?.title || id;
  const cards = d.tasks.map((t, i) => {
    const a = agentInfo(t.agent);
    const others = [...locked, ...d.tasks].filter((o) => o.id !== t.id);
    return `<li class="pcard" data-i="${i}" style="--c:${esc(a.color)}">
  <div class="pc-top"><span class="num">${i + 1}</span><label class="pc-title"><span class="sr">Task title</span><input type="text" id="pt-title-${esc(t.id)}" value="${esc(t.title)}" maxlength="120" data-f="title"></label>
    <div class="pc-move"><button type="button" class="icon sm" data-pmove="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon sm" data-pmove="1" ${i === d.tasks.length - 1 ? 'disabled' : ''} aria-label="Move down"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><button type="button" class="icon sm" data-pdel aria-label="Remove this task"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>
  <div class="pc-row"><label class="pc-agent"><span class="label">Agent</span><select id="pt-agent-${esc(t.id)}" data-f="agent">${agentOptions(t.agent)}</select></label>${j.mode === 'edit' ? `<label class="pc-edit"><input type="checkbox" id="pt-edit-${esc(t.id)}" data-f="mode"${t.mode === 'edit' ? ' checked' : ''}> Can edit files</label>` : ''}</div>
  ${t.note ? `<p class="note">${esc(t.note)}</p>` : ''}
  <label class="pc-prompt"><span class="label">Instructions for the agent</span><textarea id="pt-prompt-${esc(t.id)}" rows="3" maxlength="4000" data-f="prompt">${esc(t.prompt)}</textarea></label>
  ${others.length ? `<fieldset class="pc-deps"><legend class="label">Starts after</legend>${others.map((o) => `<label class="chip-check"><input type="checkbox" data-dep="${esc(o.id)}"${t.depends_on.includes(o.id) ? ' checked' : ''}><span>${esc(titleOf(o.id))}</span></label>`).join('')}</fieldset>` : ''}
</li>`;
  }).join('');
  const lockedHtml = locked.length ? `<details class="locked"><summary>${locked.length} task${locked.length === 1 ? '' : 's'} already in this job</summary><ul>${locked.map((t) => `<li>${pill(t.status)} ${esc(t.title)} <span class="sub">${esc(agentInfo(t.agent).name)}</span></li>`).join('')}</ul></details>` : '';
  const warn = (j.planWarnings || []).length ? `<ul class="warns">${j.planWarnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '';
  return `<div class="plan">
  <div class="plan-head"><h3>${locked.length ? 'The Lead proposes more work' : j.daily ? 'Today’s plan' : 'The Lead’s plan'}</h3>${j.planSummary && !locked.length ? `<p class="sub">${esc(j.planSummary)}</p>` : ''}<p class="sub">Check each task. Change the agent, rewrite the instructions, reorder, add or remove tasks. Nothing runs until you approve.</p></div>
  ${lockedHtml}${warn}
  <ol class="pcards">${cards}</ol>
  <button type="button" class="ghost add" data-padd>+ Add a task</button>
  <div class="approve" id="approveBox">${approveHtml(j, d)}</div>
</div>`;
}
function approveHtml(j, d) {
  const n = d.tasks.length;
  const edits = d.tasks.filter((t) => t.mode === 'edit');
  const confirm = edits.length ? (j.daily
    ? `<label class="confirm"><input type="checkbox" id="confirmEdit"> <span>I understand ${edits.length === 1 ? 'this task changes' : `these ${edits.length} tasks change`} code: <b>${esc(edits.map((t) => t.title).join(', '))}</b>. Each works on its own local branch (<code>daily/…</code>) and is committed there. Your checkout is not touched and nothing is pushed.</span></label>`
    : `<label class="confirm"><input type="checkbox" id="confirmEdit"> <span>I understand ${edits.length === 1 ? 'this task' : `these ${edits.length} tasks`} can create and change files in <code>${esc(j.cwd)}</code> without asking: <b>${esc(edits.map((t) => t.title).join(', '))}</b></span></label>`) : '';
  return `${confirm}<p class="cost">Approving starts <b>${n} agent run${n === 1 ? '' : 's'}</b>, up to ${esc(j.parallel)} at a time, plus one more for the ${j.daily ? 'evening report' : "Lead's summary"}. Each run uses your Claude plan like any other session.${j.daily ? ' Agents cannot push, merge, deploy, post or send anything.' : ''}</p><div class="formerr" id="planErr" role="alert" hidden></div><div class="btns"><button type="button" class="primary big" data-jact="approve"${n ? '' : ' disabled'}>${j.daily ? "Approve today's plan" : 'Approve plan'}</button><button type="button" class="ghost" data-jact="replan"${j.tasks.some((t) => t.status !== 'waiting') ? ' hidden' : ''}>Plan again</button><button type="button" class="ghost" data-jact="discard">Discard</button></div>`;
}
function updateConfirm(j, d) {
  const box = $('approveBox');
  if (!box) return;
  const was = $('confirmEdit')?.checked;
  const html = approveHtml(j, d);
  if (box.dataset.h !== html) {
    box.innerHTML = html;
    box.dataset.h = html;
    if (was && $('confirmEdit')) $('confirmEdit').checked = true;
  }
}
function draftOf() {
  return drafts.get(jobId);
}
function rerenderPlan() {
  const j = jobs.find((x) => x.id === jobId);
  const d = draftOf();
  if (!j || !d) return;
  d.rev = (d.rev || 0) + 1;
  renderJobBody(j);
}
$('jobBody').addEventListener('input', (e) => {
  const li = e.target.closest('.pcard');
  const d = draftOf();
  if (!li || !d) return;
  const t = d.tasks[Number(li.dataset.i)];
  const f = e.target.dataset.f;
  if (f === 'title' || f === 'prompt') {
    t[f] = e.target.value;
    d.dirty = true;
  }
});
$('jobBody').addEventListener('change', (e) => {
  const li = e.target.closest('.pcard');
  const d = draftOf();
  if (!li || !d) return;
  const t = d.tasks[Number(li.dataset.i)];
  const f = e.target.dataset.f;
  d.dirty = true;
  if (f === 'agent') {
    t.agent = e.target.value;
    t.note = '';
    li.style.setProperty('--c', agentInfo(t.agent).color);
  } else if (f === 'mode') {
    t.mode = e.target.checked ? 'edit' : 'read';
    const j = jobs.find((x) => x.id === jobId);
    updateConfirm(j, d);
  } else if (e.target.dataset.dep) {
    const dep = e.target.dataset.dep;
    t.depends_on = e.target.checked ? [...new Set([...t.depends_on, dep])] : t.depends_on.filter((x) => x !== dep);
  }
});
$('jobBody').addEventListener('click', (e) => {
  const d = draftOf();
  const mv = e.target.closest('[data-pmove]');
  const del = e.target.closest('[data-pdel]');
  if (d && (mv || del)) {
    const i = Number(e.target.closest('.pcard').dataset.i);
    if (mv) {
      const k = i + Number(mv.dataset.pmove);
      [d.tasks[i], d.tasks[k]] = [d.tasks[k], d.tasks[i]];
    } else {
      const gone = d.tasks[i].id;
      d.tasks.splice(i, 1);
      for (const t of d.tasks) t.depends_on = t.depends_on.filter((x) => x !== gone);
    }
    d.dirty = true;
    rerenderPlan();
    return;
  }
  if (d && e.target.closest('[data-padd]')) {
    let n = d.tasks.length + 1;
    while (d.tasks.some((t) => t.id === `new${n}`)) n++;
    d.tasks.push({ id: `new${n}`, title: '', prompt: '', agent: 'general-purpose', mode: 'read', depends_on: [], note: '' });
    d.dirty = true;
    rerenderPlan();
    setTimeout(() => $(`pt-title-new${n}`)?.focus(), 30);
  }
});
async function jobAction(what, extra = {}) {
  const j = jobs.find((x) => x.id === jobId);
  if (!j) return;
  if (what === 'approve') {
    const d = draftOf();
    const err = $('planErr');
    err.hidden = true;
    const empty = d.tasks.find((t) => !t.prompt.trim());
    if (empty) {
      err.textContent = `“${empty.title || 'A new task'}” has no instructions. Write what the agent should do, or remove the task.`;
      err.hidden = false;
      return;
    }
    if (d.tasks.some((t) => t.mode === 'edit') && !$('confirmEdit')?.checked) {
      err.textContent = 'Tick the box to confirm which tasks can change files, or switch them back to read-only.';
      err.hidden = false;
      $('confirmEdit')?.focus();
      return;
    }
    extra = { tasks: d.tasks.map(({ id, title, prompt, agent, mode, depends_on }) => ({ id, title: title.trim() || prompt.trim().split('\n')[0].slice(0, 120), prompt, agent, mode, depends_on })), confirmEdit: !!$('confirmEdit')?.checked };
  }
  try {
    const r = await act(`/api/jobs/${j.id}/${what}`, extra);
    if (what === 'approve') {
      drafts.delete(j.id);
      toast('Plan approved. The agents are starting.');
    }
    if (what === 'discard') {
      drafts.delete(j.id);
      jobs = jobs.filter((x) => x.id !== j.id);
      closeJob();
      return;
    }
    if (r.job) jobs = jobs.map((x) => (x.id === r.job.id ? r.job : x));
    renderLead();
  } catch (ex) {
    if (what === 'approve' && $('planErr')) {
      $('planErr').textContent = ex.message;
      $('planErr').hidden = false;
    } else toast(ex.message, true);
  }
  loadLead();
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-back]')) {
    closeJob();
    return;
  }
  const oo = e.target.closest('[data-openoffice]');
  if (oo) {
    projectId = oo.dataset.openoffice;
    store.set('project', projectId);
    $('project').value = projectId;
    go('office');
    pollNow();
    return;
  }
  const ja = e.target.closest('[data-jact]');
  if (ja && ja.closest('#job')) {
    ja.disabled = true;
    await jobAction(ja.dataset.jact);
    ja.disabled = false;
    return;
  }
  const ta = e.target.closest('[data-tact]');
  if (ta && jobId) {
    ta.disabled = true;
    try {
      const r = await act(`/api/jobs/${jobId}/tasks/${ta.dataset.tid}/${ta.dataset.tact}`);
      jobs = jobs.map((x) => (x.id === r.job.id ? r.job : x));
      renderLead();
    } catch (ex) {
      toast(ex.message, true);
    }
    loadLead();
  }
});
function renderJobFoot(j) {
  const foot = $('jobFoot');
  const can = !ACTIVE_JOB.has(j.status) && j.status !== 'plan-ready' && j.tasks.length > 0;
  const key = `${j.id}|${can}`;
  if (foot.dataset.key === key) return;
  foot.dataset.key = key;
  const past = (j.followups || []).map((f) => `<li><span class="sub">${esc(ago(f.at))}</span> ${esc(f.text)}</li>`).join('');
  foot.innerHTML = can ? `<form class="talk" id="talk" novalidate><label class="field"><span class="label">Talk to the Lead</span><textarea id="lead-followup" rows="2" maxlength="4000" placeholder="For example: also add a privacy policy page"></textarea></label><div class="btns"><button type="submit" class="primary">Send to the Lead</button><span class="sub">The Lead remembers this job and proposes extra tasks for you to approve.</span></div>${past ? `<details><summary>Earlier messages</summary><ul class="past">${past}</ul></details>` : ''}</form>` : '';
}
$('jobFoot').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('lead-followup').value.trim();
  if (!text) {
    $('lead-followup').focus();
    return;
  }
  e.target.querySelector('button[type="submit"]').disabled = true;
  await jobAction('followup', { text });
  $('jobFoot').dataset.key = '';
});
$('ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('askErr');
  err.hidden = true;
  const goal = $('lead-goal').value.trim();
  const project = $('lead-project').value;
  const mode = document.querySelector('input[name="lead-mode"]:checked')?.value || 'read';
  const parallel = Number($('lead-parallel').value);
  if (!goal) {
    err.textContent = 'Tell the Lead what you want done.';
    err.hidden = false;
    $('lead-goal').focus();
    return;
  }
  if (!project) {
    err.textContent = 'Pick a project. HQ lists every folder you have used Claude Code in.';
    err.hidden = false;
    return;
  }
  $('askBtn').disabled = true;
  try {
    const r = await act('/api/jobs', { goal, project, mode, parallel });
    $('lead-goal').value = '';
    jobs = [r.job, ...jobs.filter((x) => x.id !== r.job.id)];
    openJob(r.job.id);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    $('askBtn').disabled = false;
  }
});
document.querySelectorAll('input[name="lead-mode"]').forEach((r) => r.addEventListener('change', () => {
  const edit = $('lead-mode-edit').checked;
  $('askNote').textContent = edit
    ? 'Planning only reads the project. Tasks the Lead marks as editing can change files once you approve the plan and confirm them.'
    : 'Planning only reads the project. Nothing else runs until you approve the plan.';
}));
async function loadLead() {
  clearTimeout(leadTimer);
  if (!roster) await loadRoster(true);
  if (!projects.length) await loadProjects();
  fillLeadProjects();
  try {
    jobs = (await api('/api/jobs')).jobs || [];
  } catch {
    /* keep the last list */
  }
  if (jobId && !jobs.some((j) => j.id === jobId)) jobId = null;
  renderLead();
  renderLeadBadge();
  if (tab === 'lead') {
    const busy = jobs.some((j) => ACTIVE_JOB.has(j.status));
    leadTimer = setTimeout(loadLead, busy ? 1500 : 6000);
  }
}
function renderLeadBadge() {
  const n = jobs.filter((j) => ['plan-ready', 'paused', 'plan-failed', 'interrupted'].includes(j.status)).length;
  $('leadCount').hidden = !n;
  $('leadCount').textContent = n;
}
function renderBusy(d) {
  const busy = (d.busy || 0) + (d.activeJobs || 0);
  $('stopAllBtn').hidden = !busy;
  if (d.attention) {
    const n = d.attention.filter((a) => a.kind === 'job').length;
    $('leadCount').hidden = !n;
    $('leadCount').textContent = n;
    const m = d.attention.filter((a) => a.kind === 'daily' || a.kind === 'daily-branch').length;
    $('dailyCount').hidden = !m;
    $('dailyCount').textContent = m;
  }
}
$('stopAllBtn').onclick = () => {
  $('stopTxt').textContent = 'This stops every running Lead job and cancels every agent run HQ started, including single tasks from Dispatch. Your own Claude Code sessions are not touched. Stopped jobs can be picked up again later.';
  $('stopDlg').showModal();
};
$('stopNo').onclick = () => $('stopDlg').close();
$('stopGo').onclick = async () => {
  $('stopGo').disabled = true;
  try {
    const r = await act('/api/stop-all');
    toast(`Stopped ${r.jobs} job${r.jobs === 1 ? '' : 's'} and ${r.runs} other run${r.runs === 1 ? '' : 's'}.`);
  } catch (ex) {
    toast(ex.message, true);
  } finally {
    $('stopGo').disabled = false;
    $('stopDlg').close();
    pollNow();
    if (tab === 'lead') loadLead();
  }
};

// ------------------------------------------------------------------ daily plan
let daily = null;
let dailyTimer = null;
const bdrafts = new Map(); // project id -> backlog draft
const DSTATE = { planning: 'Standup running', 'plan-ready': 'Waiting for you', running: 'Running', summarizing: 'Writing report', done: 'Done', paused: 'Needs you', 'plan-failed': 'No plan', stopped: 'Stopped', interrupted: 'Interrupted', following: 'Planning more', gone: 'Removed' };
const money = (n) => `$${(n || 0).toFixed(2)}`;
async function loadDaily() {
  clearTimeout(dailyTimer);
  if (!roster) await loadRoster(true);
  try {
    daily = await api('/api/daily');
  } catch (e) {
    $('dailyList').innerHTML = `<div class="empty">Could not load daily plans: ${esc(e.message)}</div>`;
    return;
  }
  renderDaily();
  if (tab === 'daily') {
    const busy = daily.projects.some((p) => p.seeding || (p.today && ['planning', 'running', 'summarizing', 'following'].includes(p.today.status)));
    dailyTimer = setTimeout(loadDaily, busy ? 2000 : 8000);
  }
}
function renderDaily() {
  if (!daily) return;
  $('pauseBtn').setAttribute('aria-checked', String(!daily.paused));
  $('pauseBtn').setAttribute('aria-label', daily.paused ? 'Daily plans paused' : 'Daily plans on');
  $('pauseTxt').textContent = daily.paused ? 'Daily plans are paused' : 'Daily plans are on';
  const have = new Set(daily.projects.map((p) => p.id));
  const free = (daily.available || []).filter((p) => !have.has(p.id));
  const sel = $('daily-add');
  const was = sel.value;
  sel.innerHTML = free.length ? free.map((p) => `<option value="${esc(p.id)}" title="${esc(p.cwd)}">${esc(p.name)}</option>`).join('') : '<option value="">Every project already has a daily plan</option>';
  if (free.some((p) => p.id === was)) sel.value = was;
  $('daddBtn').disabled = !free.length;
  $('dadd').classList.toggle('compact', daily.projects.length > 0);
  const list = $('dailyList');
  // keep typing and open sections intact across refreshes
  if (list.contains(document.activeElement) && document.activeElement.matches('input, textarea, select')) return;
  const open = new Set([...list.querySelectorAll('details[open]')].map((x) => x.dataset.k));
  list.innerHTML = daily.projects.length ? daily.projects.map(dailyCard).join('') : '<div class="jobs-empty"><h2>How the daily plan works</h2><ol class="how"><li><b>Morning, by itself:</b> the Lead reads the project (read-only), writes a short standup and proposes today\'s plan.</li><li><b>You tap Approve</b> (or change the plan first). Nothing runs before that.</li><li><b>Agents work.</b> Code changes go on their own local branch. Nothing is pushed, merged, deployed, posted or sent.</li><li><b>Evening, by itself:</b> a read-only report, and the backlog is updated.</li><li><b>Branches wait for you.</b> Open a PR with one click after seeing the exact commands, or delete the branch.</li></ol></div>';
  list.querySelectorAll('details[data-k]').forEach((x) => { if (open.has(x.dataset.k)) x.open = true; });
}
function dailyCard(p) {
  const t = p.today;
  const c = p.config;
  let today;
  if (!p.enabled) {
    today = `<p class="sub">Off. Switch it on and the Lead holds a standup every day at <b>${esc(c.standupAt)}</b> while HQ is running.</p>`;
  } else if (!t || ['gone', 'stopped', 'plan-failed'].includes(t.status)) {
    const again = t ? `Today's plan ${t.status === 'gone' ? 'was removed' : t.status === 'stopped' ? 'was stopped' : 'could not be made'}. ` : '';
    today = `<div class="dnext"><span>${again}${t ? '' : `Next standup <b>${esc(c.standupAt)}</b>${daily.paused ? ' (paused)' : ''}. If HQ is not running then, it catches up when HQ starts that day.`}</span><button type="button" class="ghost" data-dact="standup" data-p="${esc(p.id)}">${t ? 'Hold the standup again' : "Hold today's standup now"}</button></div>`;
  } else {
    const st = t.standup;
    const go = t.status === 'plan-ready'
      ? `<button type="button" class="primary" data-openjob="${esc(t.jobId)}">Review and approve today's plan</button>`
      : `<button type="button" class="ghost" data-openjob="${esc(t.jobId)}">${t.status === 'planning' ? 'Watch the standup' : 'Open today\'s plan'}</button>`;
    const notes = (t.notes || []);
    today = `<div class="dtoday"><div class="dt-head">${pill(t.status === 'plan-ready' ? 'paused' : t.status, DSTATE[t.status] || t.status)}<span class="sub">${t.tasks ? `${t.done} of ${t.tasks} task${t.tasks === 1 ? '' : 's'} done` : ''}</span>${go}</div>
${st ? `<dl class="sdl"><dt>Yesterday</dt><dd>${esc(st.yesterday || '—')}</dd><dt>Today</dt><dd>${esc(st.today || '—')}</dd><dt>Blockers</dt><dd>${esc(st.blockers || 'None')}</dd></dl>` : t.status === 'planning' ? '<p class="sub"><span class="working-dots">The Lead is holding the standup</span></p>' : ''}
${notes.length ? `<div class="yours"><h4>For you to do</h4><ul>${notes.map((n) => `<li class="k-${esc(n.kind)}"><b>${esc(n.title)}</b><span class="why">${esc(n.why || '')}</span></li>`).join('')}</ul></div>` : ''}
${t.summary ? `<section class="summary"><h3>Daily report</h3><div class="prose">${esc(t.summary)}</div>${t.reportSeen ? '' : `<div class="btns"><button type="button" class="ghost sm" data-dact="seen" data-p="${esc(p.id)}">Mark as read</button></div>`}</section>` : ''}</div>`;
  }
  const ready = p.branches.filter((b) => b.status !== 'deleted');
  const branches = ready.length ? `<section class="dsec"><h3>Branches from the daily plan</h3><div class="rows">${ready.map((b) => `<div class="row" style="--c:${b.status === 'ready' ? 'var(--accent)' : 'var(--ok)'}"><span class="stripe"></span><div class="title"><code>${esc(b.branch)}</code>${b.status === 'pr-opened' ? pill('done', 'PR open') : pill('waiting', 'Local only')}</div><div class="right">${b.status === 'ready' ? `<button type="button" class="primary sm" data-pr="${esc(b.id)}">Open PR</button><button type="button" class="ghost sm" data-bdel="${esc(b.id)}">Delete branch</button>` : b.prUrl ? `<a class="copy" href="${esc(b.prUrl)}" target="_blank" rel="noopener noreferrer">View PR</a>` : ''}</div><div class="detail">${esc(b.title)} · commit <code>${esc(b.commit)}</code> · ${esc(b.day)}</div></div>`).join('')}</div></section>` : '';
  const bd = bdrafts.get(p.id);
  const items = bd ? bd.items : p.backlog.map((b) => ({ ...b }));
  const openItems = items.filter((b) => b.status !== 'done').length;
  const backlog = `<details class="dsec" data-k="bl-${esc(p.id)}"><summary><h3>Backlog <span class="sub">${openItems} open${p.seeding ? ', the Lead is reading the project' : ''}</span></h3></summary>
${p.seedError ? `<p class="err">${esc(p.seedError)}</p>` : ''}<ul class="blist" data-bl="${esc(p.id)}">${items.map((b, i) => `<li class="${b.status === 'done' ? 'done' : ''}"><label class="bcheck"><input type="checkbox" id="bl-done-${esc(p.id)}-${i}" data-bi="${i}" data-bf="status"${b.status === 'done' ? ' checked' : ''}><span class="sr">Done</span></label><input type="text" id="bl-title-${esc(p.id)}-${i}" value="${esc(b.title)}" maxlength="200" data-bi="${i}" data-bf="title" aria-label="Backlog item"><span class="bsrc">${b.source === 'lead' ? 'Lead' : b.source === 'you' ? 'You' : ''}</span><button type="button" class="icon sm" data-bmove="-1" data-bi="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button><button type="button" class="icon sm" data-bdelitem data-bi="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`).join('') || '<li class="empty">Empty. Add what you want the Lead to work through.</li>'}</ul>
<div class="badd"><input type="text" id="bl-new-${esc(p.id)}" maxlength="200" placeholder="Add a backlog item" aria-label="New backlog item" data-bnew="${esc(p.id)}"><button type="button" class="ghost" data-badd="${esc(p.id)}">Add</button>${bd?.dirty ? `<button type="button" class="primary" data-bsave="${esc(p.id)}">Save backlog</button>` : ''}</div></details>`;
  const days = p.days.filter((d) => !t || d.day !== t.day);
  const timeline = days.length ? `<details class="dsec" data-k="tl-${esc(p.id)}"><summary><h3>Earlier days <span class="sub">${days.length}</span></h3></summary><ul class="tline">${days.map((d) => `<li><button type="button" class="jobrun" ${d.status !== 'gone' ? `data-openjob="${esc(d.jobId)}"` : 'disabled'}><b>${esc(d.day)}</b>${pill(d.status === 'plan-ready' ? 'stopped' : d.status, d.status === 'plan-ready' ? 'Not approved' : DSTATE[d.status] || d.status)}<span class="sub">${d.tasks ? `${d.done} of ${d.tasks} done · ` : ''}${money(d.costUsd)}${d.summary ? ` · ${esc(d.summary.replace(/\s+/g, ' ').slice(0, 140))}` : ''}</span></button></li>`).join('')}</ul></details>` : '';
  const settings = `<details class="dsec" data-k="st-${esc(p.id)}"${p.enabled ? '' : ' open'}><summary><h3>Settings</h3></summary><form class="dset" data-dset="${esc(p.id)}" novalidate>
<label class="field dfocus"><span class="label">Focus for the Lead</span><textarea id="d-focus-${esc(p.id)}" name="focus" rows="2" maxlength="1000" placeholder="For example: get to a Play Store launch">${esc(c.focus)}</textarea></label>
<label class="field"><span class="label">Standup</span><input type="time" id="d-standup-${esc(p.id)}" name="standupAt" value="${esc(c.standupAt)}" required></label>
<label class="field"><span class="label">Evening report</span><input type="time" id="d-wrap-${esc(p.id)}" name="wrapAt" value="${esc(c.wrapAt)}" required></label>
<label class="field"><span class="label">Tasks per day</span><select id="d-tasks-${esc(p.id)}" name="maxTasks">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option${n === c.maxTasks ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
<label class="field"><span class="label">Spend limit per day</span><span class="money"><span aria-hidden="true">$</span><input type="number" id="d-usd-${esc(p.id)}" name="maxUsd" min="0.5" max="100" step="0.5" value="${esc(c.maxUsd)}"></span></label>
<div class="btns"><button type="submit" class="primary">Save settings</button><span class="sub">Spend counts the standup, the agents and the report, from what Claude Code reports.</span></div></form></details>`;
  const spent = `${money(p.spentToday)} of ${money(c.maxUsd)} spent today`;
  return `<article class="dcard${p.enabled ? '' : ' off'}" data-dproj="${esc(p.id)}">
<header class="dc-head"><div><h2>${esc(p.name)}</h2><p class="sub"><code>${esc(p.cwd)}</code> · standup ${esc(c.standupAt)}, report ${esc(c.wrapAt)} · up to ${esc(c.maxTasks)} task${c.maxTasks === 1 ? '' : 's'} · ${esc(spent)}</p>${c.focus ? `<p class="dfocus-line">Focus: ${esc(c.focus)}</p>` : ''}</div>
<button type="button" class="switch" role="switch" aria-checked="${p.enabled}" aria-label="Daily plan for ${esc(p.name)} ${p.enabled ? 'on' : 'off'}" data-denable="${esc(p.id)}"></button></header>
${today}${branches}${backlog}${settings}${timeline}</article>`;
}
async function dailyAct(path, body, okMsg) {
  try {
    const r = await act(path, body);
    if (okMsg) toast(okMsg);
    return r;
  } catch (ex) {
    toast(ex.message, true);
    return null;
  } finally {
    loadDaily();
    pollNow();
  }
}
$('dadd').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('daily-add').value;
  if (!id) return;
  $('daddBtn').disabled = true;
  await dailyAct(`/api/daily/projects/${encodeURIComponent(id)}`, {}, 'Added. Set the focus and switch it on when you are ready.');
});
$('pauseBtn').onclick = () => dailyAct('/api/daily/pause', { paused: !daily.paused }, daily.paused ? 'Daily plans are on again.' : 'Daily plans are paused. Nothing is scheduled until you switch them back on.');
function backlogDraft(id) {
  let d = bdrafts.get(id);
  if (!d) {
    const p = daily.projects.find((x) => x.id === id);
    d = { items: p.backlog.map((b) => ({ ...b })), dirty: false };
    bdrafts.set(id, d);
  }
  return d;
}
$('dailyList').addEventListener('input', (e) => {
  const el = e.target.closest('[data-bf="title"]');
  if (!el) return;
  const id = el.closest('[data-bl]').dataset.bl;
  const d = backlogDraft(id);
  d.items[Number(el.dataset.bi)].title = el.value;
  if (!d.dirty) {
    d.dirty = true;
    const box = el.closest('.dsec').querySelector('.badd');
    if (box && !box.querySelector('[data-bsave]')) box.insertAdjacentHTML('beforeend', `<button type="button" class="primary" data-bsave="${esc(id)}">Save backlog</button>`);
  }
});
$('dailyList').addEventListener('change', (e) => {
  const el = e.target.closest('[data-bf="status"]');
  if (!el) return;
  const id = el.closest('[data-bl]').dataset.bl;
  const d = backlogDraft(id);
  d.items[Number(el.dataset.bi)].status = el.checked ? 'done' : 'open';
  d.dirty = true;
  saveBacklog(id);
});
$('dailyList').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-bnew]')) {
    e.preventDefault();
    addBacklog(e.target.dataset.bnew);
  }
});
async function saveBacklog(id) {
  const d = bdrafts.get(id);
  if (!d) return;
  bdrafts.delete(id);
  document.activeElement?.blur();
  await dailyAct(`/api/daily/projects/${encodeURIComponent(id)}/backlog`, { items: d.items.map(({ id: bid, title, detail, status }) => ({ id: bid, title, detail, status })) });
}
function addBacklog(id) {
  const input = $(`bl-new-${id}`);
  const title = input.value.trim();
  if (!title) {
    input.focus();
    return;
  }
  const d = backlogDraft(id);
  d.items.push({ title, detail: '', status: 'open', source: 'you' });
  d.dirty = true;
  saveBacklog(id);
}
$('dailyList').addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-dset]');
  if (!f) return;
  e.preventDefault();
  const id = f.dataset.dset;
  const data = new FormData(f);
  document.activeElement?.blur();
  await dailyAct(`/api/daily/projects/${encodeURIComponent(id)}`, { focus: data.get('focus'), standupAt: data.get('standupAt'), wrapAt: data.get('wrapAt'), maxTasks: Number(data.get('maxTasks')), maxUsd: Number(data.get('maxUsd')) }, 'Settings saved.');
});
$('dailyList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-denable],[data-dact],[data-pr],[data-bdel],[data-bmove],[data-bdelitem],[data-badd],[data-bsave]');
  if (!b) return;
  if (b.dataset.denable) {
    const id = b.dataset.denable;
    const on = b.getAttribute('aria-checked') !== 'true';
    b.disabled = true;
    await dailyAct(`/api/daily/projects/${encodeURIComponent(id)}`, { enabled: on }, on ? 'On. The Lead holds the standup at the set time while HQ is running.' : 'Off. No more standups for this project.');
  } else if (b.dataset.dact === 'standup') {
    b.disabled = true;
    const r = await dailyAct(`/api/daily/projects/${encodeURIComponent(b.dataset.p)}/standup`, {}, 'The Lead is holding the standup. It only reads the project.');
    if (r?.job) openJob(r.job.id);
  } else if (b.dataset.dact === 'seen') {
    await dailyAct(`/api/daily/projects/${encodeURIComponent(b.dataset.p)}/seen`, {});
  } else if (b.dataset.pr) {
    openPrDialog(b.dataset.pr);
  } else if (b.dataset.bdel) {
    b.disabled = true;
    await dailyAct(`/api/daily/branches/${b.dataset.bdel}/delete`, {}, 'Branch deleted.');
  } else if (b.dataset.badd) {
    addBacklog(b.dataset.badd);
  } else if (b.dataset.bsave) {
    saveBacklog(b.dataset.bsave);
  } else {
    const id = b.closest('[data-bl]').dataset.bl;
    const d = backlogDraft(id);
    const i = Number(b.dataset.bi);
    if (b.dataset.bmove) [d.items[i - 1], d.items[i]] = [d.items[i], d.items[i - 1]];
    else d.items.splice(i, 1);
    d.dirty = true;
    saveBacklog(id);
  }
});
async function openPrDialog(id) {
  const body = $('prBody');
  body.innerHTML = '<p class="sub">Loading</p>';
  $('prDlg').showModal();
  let r;
  try {
    r = await api(`/api/daily/branches/${id}/pr`);
  } catch (ex) {
    body.innerHTML = `<p class="err">${esc(ex.message)}</p>`;
    return;
  }
  body.innerHTML = `<p>HQ will run these two commands in <code>${esc(r.cwd)}</code>. The first pushes the branch to GitHub; the second opens the pull request. Nothing is merged.</p><pre class="cmds">${r.commands.map(esc).join('\n\n')}</pre><div class="formerr" id="prErr" role="alert" hidden></div><div class="btns"><button type="button" class="primary" id="prGo">Push and open the PR</button><button type="button" class="ghost" id="prNo">Not now</button></div>`;
  $('prNo').onclick = () => $('prDlg').close();
  $('prGo').onclick = async () => {
    $('prGo').disabled = true;
    try {
      const res = await act(`/api/daily/branches/${id}/pr`, { confirm: true });
      body.innerHTML = `<p>Pull request opened.</p>${res.url ? `<div class="urlbox"><code>${esc(res.url)}</code><a class="copy" href="${esc(res.url)}" target="_blank" rel="noopener noreferrer">Open</a></div>` : ''}`;
      loadDaily();
    } catch (ex) {
      $('prErr').textContent = ex.message;
      $('prErr').hidden = false;
      $('prGo').disabled = false;
    }
  };
}

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
  if (k >= '1' && k <= '6') go(TABS[Number(k) - 1]);
  else if (k === '/') {
    e.preventDefault();
    if (tab === 'dispatch') $('dispatch-task').focus();
    else if (tab === 'lead') $('lead-goal').focus();
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
go((location.hash || '').slice(1) || store.get('tab', 'lead'));
await loadProjects();
poll();
setInterval(loadProjects, 30000);
