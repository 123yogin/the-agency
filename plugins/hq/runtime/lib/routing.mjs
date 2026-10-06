// "Auto" agent picking: score each agent's name and "Use when / Not for" text against the task.
// Deterministic and explainable — every suggestion lists the words that matched.

const STOP = new Set(('a an and are as at be but by can could do does for from had has have how i if in into is it its me my '
  + 'need needs of on or our please should so some than that the their them then there these this those to up us use used '
  + 'using via was we what when where which while who why will with without would you your get make want help look see '
  + 'all any each new one two also just like more most only other over such very').split(' '));

// Everyday words → vocabulary the agent descriptions use.
const SYNONYMS = {
  bug: ['debug', 'fix', 'error', 'root'], broken: ['debug', 'fix', 'error'], crash: ['debug', 'error', 'failure'],
  failing: ['failure', 'test'], fails: ['failure'], error: ['error'],
  slow: ['performance', 'profil'], speed: ['performance'], faster: ['performance'], memory: ['performance', 'leak'],
  ui: ['frontend', 'screen', 'component'], ux: ['design', 'research', 'usab'], css: ['frontend', 'style'], screen: ['screen', 'ui'],
  react: ['react', 'frontend'], component: ['component', 'frontend'], page: ['page', 'frontend'],
  api: ['api', 'endpoint', 'backend'], endpoint: ['endpoint', 'api', 'backend'], server: ['backend', 'server'],
  db: ['database', 'postgres', 'sql'], sql: ['sql', 'database', 'postgres', 'query'], query: ['query', 'sql'], migration: ['migration', 'postgres', 'schema'],
  pr: ['review', 'diff', 'pull'], diff: ['diff', 'review'], commit: ['diff', 'review', 'commit'], review: ['review'],
  secure: ['security', 'vulnerab'], security: ['security', 'vulnerab', 'secret'], vulnerability: ['security', 'vulnerab'],
  test: ['test'], tests: ['test'], e2e: ['e2e', 'playwright', 'test'], flaky: ['flaky', 'test', 'playwright'],
  deploy: ['deploy', 'release', 'ship'], release: ['release', 'store', 'ship'], ship: ['ship', 'release', 'deploy'],
  android: ['android', 'mobile', 'capacitor'], ios: ['ios', 'mobile'], apk: ['android', 'capacitor', 'mobile'], capacitor: ['capacitor', 'webview'],
  docs: ['documentation', 'doc', 'writer'], readme: ['readme', 'documentation'], documentation: ['documentation', 'doc'],
  prd: ['prd', 'requirement'], spec: ['spec', 'requirement'], roadmap: ['roadmap', 'prioriti'], backlog: ['backlog', 'prioriti'],
  seo: ['seo', 'search', 'rank'], rank: ['rank', 'seo'], google: ['seo', 'search'], chatgpt: ['ai', 'citation', 'aeo'],
  launch: ['launch'], marketing: ['marketing', 'growth'], email: ['email', 'lifecycle'], pricing: ['pricing', 'price'],
  customer: ['customer', 'support', 'success'], support: ['support', 'customer'], churn: ['churn', 'success'],
  privacy: ['privacy', 'gdpr'], policy: ['policy', 'privacy', 'terms', 'legal'], terms: ['terms', 'legal', 'policy'], gdpr: ['gdpr', 'privacy'], legal: ['legal', 'contract', 'counsel'], contract: ['contract', 'legal'],
  terraform: ['terraform', 'infra'], kubernetes: ['kubernetes', 'infra'], ci: ['github', 'actions', 'workflow'], actions: ['actions', 'github'],
  logs: ['log', 'prod', 'incident'], outage: ['incident', 'prod', 'log'], incident: ['incident', 'prod'],
  rag: ['rag', 'retrieval'], prompt: ['prompt'], llm: ['llm', 'model', 'eval'], eval: ['eval'], mcp: ['mcp', 'server'],
  data: ['data'], pipeline: ['pipeline', 'data'], dashboard: ['dashboard', 'data'], refactor: ['refactor', 'cleanup', 'dead'],
  architecture: ['architect', 'design', 'system'], design: ['design'], accessibility: ['accessib', 'a11y', 'wcag'], a11y: ['a11y', 'accessib'],
};

export function stem(w) {
  w = w.toLowerCase();
  if (w.length > 6 && w.endsWith('ities')) return w.slice(0, -5);
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokens(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w));
}

// Words that say little about which specialist is needed.
const GENERIC = new Set(['draft', 'write', 'build', 'create', 'fix', 'check', 'make', 'change', 'update', 'add', 'app', 'apps', 'project', 'code', 'file', 'files', 'thing', 'work', 'better', 'good', 'old', 'after', 'before', 'show', 'shows']);

// Task words with their stemmed forms and synonyms: Map(typed word → [{w, literal}]).
export function expand(task) {
  const out = new Map();
  for (const word of tokens(task)) {
    if (out.has(word)) continue;
    const forms = [{ w: stem(word), literal: true }];
    for (const s of SYNONYMS[word] || []) if (!forms.some((f) => f.w === stem(s))) forms.push({ w: stem(s), literal: false });
    out.set(word, forms);
  }
  return out;
}

const prefixMatch = (a, b) => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));

// agents: [{id, name, use, notFor}] → top N [{id, name, score, confidence, reasons}]
export function route(task, agents, { top = 3 } = {}) {
  const want = expand(task);
  if (!want.size || !agents.length) return [];
  const docs = agents.map((a) => {
    const use = new Set(tokens(a.use || a.description).map(stem));
    // "Not for X (use other-agent)": the pointers name other agents, so drop them; words also in "Use when" stay neutral
    const notText = String(a.notFor || '').replace(/\([^)]*\)/g, ' ').replace(/\buse (the )?[a-z0-9-]+(-[a-z0-9]+)*\b/gi, ' ');
    const not = new Set(tokens(notText).map(stem).filter((t) => !use.has(t)));
    return { a, name: new Set(tokens(a.name.replace(/-/g, ' ')).map(stem)), use, not };
  });
  const df = new Map();
  for (const d of docs) for (const t of new Set([...d.name, ...d.use])) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;
  const idf = (t) => Math.log(1 + N / (df.get(t) || 1));
  const byWord = want; // each typed word counts once, at its best match
  const scored = docs.map((d) => {
    let score = 0;
    const reasons = [];
    const nameHit = new Set();
    for (const [orig, forms] of byWord) {
      let best = 0;
      let penalty = 0;
      for (const { w, literal } of forms) {
        const k = (literal ? 1 : 0.8) * (GENERIC.has(orig) ? 0.4 : 1); // literal beats synonym; generic words weigh little
        for (const t of d.name) {
          if (prefixMatch(w, t)) {
            best = Math.max(best, 3.5 * idf(t) * k);
            nameHit.add(t);
          }
        }
        for (const t of d.use) if (prefixMatch(w, t)) best = Math.max(best, idf(t) * k);
        for (const t of d.not) if (prefixMatch(w, t)) penalty = Math.max(penalty, 0.5 * idf(t));
      }
      if (best > 0) {
        score += best;
        reasons.push(orig);
      }
      score -= penalty;
    }
    // a name that names a different speciality ("rag-pipeline-", "go-") loses a little against a plain one
    for (const t of d.name) if (!nameHit.has(t) && !GENERIC.has(t)) score -= 0.25 * idf(t);
    return { id: d.a.id, name: d.a.name, plugin: d.a.plugin, score: Math.round(score * 100) / 100, reasons: reasons.slice(0, 5) };
  }).filter((s) => s.score > 0 && s.reasons.length);
  scored.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
  const best = scored[0]?.score || 0;
  return scored.slice(0, top).map((s) => ({ ...s, confidence: s.score >= best * 0.85 && s.reasons.length >= 2 ? 'strong' : s.score >= best * 0.5 ? 'possible' : 'weak' }));
}
