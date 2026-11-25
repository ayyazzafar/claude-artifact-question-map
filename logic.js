// Question Map v2 logic: the designer's prototype logic, wired to the page's shared db, comments and assets.
// Built into the page by build.py as window.__QM_LOGIC(DCLogic, React) so support.js never needs eval.
window.__QM_LOGIC = function(DCLogic, React){
const CFG = window.QM_CONFIG || { title: 'Question Map', topic: 'Questions', thread: 'this project' };
const MIN = 60000, LS = 'qm2-state';
function load(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }
function save(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function msgsOf(n){ const m = n.msgs || (n.draft ? [n.draft] : []); return (Array.isArray(m) ? m : [m]).filter(x => x && x.text); }
// Same signature as v1, so "seen" marks carry over when this page replaces it.
function sig(n){
  if(!n || n.status !== 'done') return null;
  const t = (n.q||'') + '|' + (n.a||'') + '|' + msgsOf(n).map(m => m.text).join('|');
  let h = 0; for(let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h);
}
function segsOf(line){
  const out = [];
  const re = /(~~[^~\n]+~~|\*\*[^*]+\*\*|(?<![*\w])\*(?![\s*])[^*\n]+?(?<!\s)\*(?![*\w])|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0, m;
  const txt = t => { if(t) out.push({ t, n: true }); };
  while((m = re.exec(line))){
    txt(line.slice(last, m.index)); const p = m[0];
    if(p.startsWith('~~')) out.push({ t: p.slice(2, -2), x: true }); /* v2.55: ~~struck~~ = outdated, don't act on it */
    else if(p.startsWith('**')) out.push({ t: p.slice(2, -2), b: true });
    else if(p.startsWith('*')) out.push({ t: p.slice(1, -1), i: true }); /* v2.47 §21: *italics*, also next to brackets */
    else if(p.startsWith('`')) out.push({ t: p.slice(1, -1), c: true });
    else if(p.startsWith('[')){ const k = p.indexOf(']('); out.push({ t: p.slice(1, k), l: true, href: p.slice(k + 2, -1) }); }
    else { let u = p.replace(/[.,;:!?]+$/, ''); out.push({ t: u, l: true, href: u }); if(u.length < p.length) txt(p.slice(u.length)); }
    last = m.index + p.length;
  }
  txt(line.slice(last));
  return out;
}
function parseA(s, kinds){
  const lines = (s || '').replace(/\r/g, '').split('\n'); const out = []; let pre = null; let tbl = null; let tk = ''; let li = -1; const kOf = () => kinds ? (kinds[li] || '') : '';
  const push0 = out.push.bind(out); out.push = b => push0(Object.assign({ chg: b.isTable ? tk : kOf() }, b));
  const cellsOf = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());
  const endTbl = () => { if(!tbl) return; const rows = tbl.filter(r => !r.every(c => /^:?-{2,}:?$/.test(c))); const hasHead = tbl.length > 1 && tbl[1].every(c => /^:?-{2,}:?$/.test(c));
    out.push({ isTable: true, chg: tk, rows: rows.map((r, i) => ({ cells: r.map(c => ({ segs: segsOf(c).map(x => Object.assign({ b: false, i: false, c: false, l: false, n: false, x: false, href: '' }, x)), fw: hasHead && i === 0 ? 700 : 400, bg: hasHead && i === 0 ? 'var(--soft)' : 'transparent' })) })) }); tbl = null; tk = ''; };
  lines.forEach((raw, ix) => { li = ix;
    if(!pre && /^\s*\|.*\|\s*$/.test(raw)){ (tbl = tbl || []).push(cellsOf(raw)); if(kOf()) tk = 'add'; return; }
    endTbl();
    if(/^\s*```/.test(raw)){ if(pre){ out.push({ isPre: true, text: pre.join('\n') }); pre = null; } else pre = []; return; }
    if(pre){ pre.push(raw); return; }
    let line = raw.replace(/\s+$/, ''); if(!line.trim()) return;
    /* v2.65 (8 Nov): an image on its own line: ![caption](img:key | file:N | https://… | data:image/…){small|medium|full} */
    const im = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)(?:\{(small|medium|full)\})?\s*$/);
    if(im){ out.push({ isImg: true, alt: im[1], src: im[2], size: im[3] || 'medium' }); return; }
    const h = line.match(/^\s*#{1,6}\s+(.*)$/);
    if(h){ out.push({ isH: true, segs: segsOf(h[1]) }); return; }
    const ind = (line.match(/^\s*/)[0].length >= 2) ? '22px' : '0px';
    const n = line.match(/^\s*(\d+)[.)]\s+(.*)$/), b = line.match(/^\s*[-*•]\s+(.*)$/);
    if(n){ out.push({ isBody: true, isLi: true, num: n[1] + '.', pad: ind, segs: segsOf(n[2]) }); return; }
    if(b){ out.push({ isBody: true, isLi: true, num: '•', pad: ind, segs: segsOf(b[1]) }); return; }
    if(/^\s*>\s?/.test(line)){ out.push({ isBody: true, isQuote: true, pad: '0px', segs: segsOf(line.replace(/^\s*>\s?/, '')) }); return; }
    if(/^\s*(---+|\*\*\*+)\s*$/.test(line)){ out.push({ isHr: true }); return; }
    out.push({ isBody: true, pad: '0px', segs: segsOf(line) });
  });
  endTbl();
  if(pre) out.push({ isPre: true, text: pre.join('\n') });
  const CH = { add: { cbg: 'var(--updbg)', cbar: 'inset 3px 0 0 var(--upd)', cpad: '2px 8px', deco: 'none', cop: 1 }, del: { cbg: 'transparent', cbar: 'inset 3px 0 0 var(--line2)', cpad: '2px 8px', deco: 'line-through', cop: .55 }, '': { cbg: 'transparent', cbar: 'none', cpad: '0px', deco: 'none', cop: 1 } };
  return out.map(b => Object.assign({ isTable: false, isChgNote: false, chgText: '', onChg: null, chgBtn: '', chg: '', rows: [], isH: false, isBody: false, isPre: false, isHr: false, isLi: false, isQuote: false, isImg: false, alt: '', src: '', size: '', imgW: '100%', hasCap: false, onImg: null, num: '', pad: '0px', segs: [], text: '' }, b,
    CH[b.chg || ''], { segs: (b.segs || []).map(x => Object.assign({ b: false, i: false, c: false, l: false, n: false, x: false, href: '' }, x)) }));
}
/* v2.55: line diff of the answer he last read (readA) against the current one; removed lines come back struck through */
function diffLines(oldS, newS){
  const A = (oldS || '').replace(/\r/g, '').split('\n'), B = (newS || '').replace(/\r/g, '').split('\n'); const key = l => l.trim();
  if(A.length * B.length > 250000) return { text: newS, kinds: B.map(() => ''), n: 0 };
  const L = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for(let i = A.length - 1; i >= 0; i--) for(let j = B.length - 1; j >= 0; j--) L[i][j] = key(A[i]) === key(B[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const lines = [], kinds = []; let i = 0, j = 0, n = 0; const isTbl = l => /^\s*\|.*\|\s*$/.test(l);
  while(i < A.length || j < B.length){
    if(i < A.length && j < B.length && key(A[i]) === key(B[j])){ lines.push(B[j]); kinds.push(''); i++; j++; }
    else if(j < B.length && (i >= A.length || L[i][j + 1] >= L[i + 1][j])){ lines.push(B[j]); kinds.push(key(B[j]) ? 'add' : ''); if(key(B[j])) n++; j++; }
    else { const l = A[i]; if(key(l) && !isTbl(l) && !/^\s*```/.test(l)){ lines.push(l); kinds.push('del'); n++; } i++; }
  }
  return { text: lines.join('\n'), kinds, n };
}
function plain(s){ return (s || '').replace(/\*\*|`|^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' '); }
/* v2.81: timestamps may arrive as ms numbers, numeric strings or ISO strings (written by other sessions); never NaN. */
function toMs(v){ if(typeof v === 'number') return isFinite(v) ? v : 0; if(typeof v === 'string' && v.trim()){ const n = Number(v); if(isFinite(n)) return n; const p = Date.parse(v); return isFinite(p) ? p : 0; } return 0; }
function ago(t){ t = toMs(t); if(!t) return ''; const m = Math.round((Date.now() - t) / MIN); if(m < 1) return 'just now'; if(m < 60) return m + 'm ago'; const h = Math.round(m / 60); return h < 24 ? h + 'h ago' : Math.round(h / 24) + 'd ago'; }
function clock(t){ if(!t) return ''; const d = new Date(t), now = new Date(); const tm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }); return d.toDateString() === now.toDateString() ? tm : d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + tm; }
// v2.81: menu bar icon for the desktop app: a small tree (three dots, two branches), black on clear so macOS tints it.
let deskIconUrl = null;
const deskIcon = () => { if(deskIconUrl) return deskIconUrl; const c = document.createElement('canvas'); c.width = c.height = 36; const x = c.getContext('2d');
  x.strokeStyle = x.fillStyle = '#000'; x.lineWidth = 3; x.beginPath(); x.moveTo(18, 10); x.lineTo(9, 26); x.moveTo(18, 10); x.lineTo(27, 26); x.stroke();
  [[18, 8], [9, 28], [27, 28]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 5, 0, Math.PI * 2); x.fill(); });
  return (deskIconUrl = c.toDataURL('image/png')); };
// One message = one card. The thread's Claude decides whether to split it into sibling cards (31 Oct: '??' is often just habit).
function splitQs(t){ return [t.trim()]; }
function diffSegs(rew, orig){ const set = new Set(orig.toLowerCase().match(/[a-z0-9#']+/g) || []); return rew.split(/(\s+)/).map(tok => { const w = (tok.toLowerCase().match(/[a-z0-9#']+/) || [''])[0]; const hl = !!w && !set.has(w); return { t: tok, hl, nhl: !hl }; }); }
function quoteMd(q){ return String(q || '').split('\n').map(l => '> ' + l).join('\n'); }
/* v2.58: quote-reply chips -> one Markdown message (quote, then the note under it) */
/* v2.72 (10 Nov): a quote-reply card keeps the quoted words apart from his own words.
   splitQuote: leading "> " lines = the quote; the rest = his note. qParts: what the title shows (his words) + the quote. */
function splitQuote(s){ const L = String(s || '').split('\n'); const qs = []; let i = 0; while(i < L.length && /^\s*>/.test(L[i])){ qs.push(L[i].replace(/^\s*>\s?/, '')); i++; } return { quote: qs.join('\n').trim(), rest: L.slice(i).join('\n').trim() }; }
function qParts(q, raw){ const flat = t => String(t || '').replace(/\s+/g, ' ').trim(); const r = splitQuote(raw); let head = String(q || '').trim();
  if(!r.quote){ const h = splitQuote(head); return h.quote && h.rest ? { quote: h.quote, head: h.rest } : { quote: '', head }; }
  const h = splitQuote(head);
  if(h.quote && h.rest) head = h.rest;
  else if(h.quote){ const fq = flat(r.quote), fh = flat(h.quote); head = fh.indexOf(fq) === 0 ? fh.slice(fq.length).trim() : ''; }
  else if(flat(head).indexOf(flat(r.quote)) === 0) head = flat(head).slice(flat(r.quote).length).trim();
  return { quote: r.quote, head: head || r.rest || '' }; }
function composeQuotes(qs){ let n = 0; /* v2.61: each quote's own images are named under it, numbered in attachment order */
  return qs.map(x => { const im = (x.imgs || []).filter(i => i.status === 'ok'); const lab = im.length ? '\n(' + im.map(i => 'image ' + (++n) + ' "' + i.name + '"').join(', ') + (im.length > 1 ? ' are' : ' is') + ' for this part)' : '';
    return quoteMd(x.quote) + (x.note ? '\n' + x.note : '') + lab; }).join('\n\n'); }
function qImgFiles(qs){ const out = []; qs.forEach(x => (x.imgs || []).forEach(i => { if(i.status === 'ok') out.push({ id: i.id, name: i.name, type: i.type, size: i.size }); })); return out; }
/* v2.68: the keyboard shortcuts cheat sheet (? or Cmd/Ctrl + /). Keep in step with key(). */
const KEYS = m => [
  { title: 'Move around', rows: [ { k: ['j', 'k'], d: 'Next / previous card' }, { k: ['n'], d: 'Next new answer' }, { k: ['u'], d: 'Next unread answer' }, { k: ['Alt ←', 'Alt →'], d: 'Back / Forward' }, { k: [m + ' [', m + ' ]'], d: 'Back / Forward (also works)' }, { k: ['/'], d: 'Search' } ] },
  { title: 'Cards', rows: [ { k: ['e'], d: 'Mark done' }, { k: ['r'], d: 'Mark read' }, { k: ['N'], d: 'New topic in this tree' }, { k: [m + ' Enter'], d: 'Send what you typed' } ] },
  { title: 'View', rows: [ { k: ['h'], d: 'Switch tab: Open, Unread, New, Waiting, All' }, { k: ['f'], d: 'Focus mode (wide reader)' }, { k: ['['], d: 'Show or hide the sidebar' }, { k: ['←', '→'], d: 'Previous / next image in the viewer' } ] },
  { title: 'Close and help', rows: [ { k: ['Esc'], d: 'Close a popup, leave Focus or Select, close the card' }, { k: ['?'], d: 'Show or hide this list' }, { k: [m + ' /'], d: 'Show or hide this list (also works)' } ] }
].map(g => ({ title: g.title, rows: g.rows.map(r => ({ d: r.d, k: r.k.map((t, i) => ({ t, sep: i > 0 })) })) }));
function short(s, n){ s = s || ''; return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
function extOf(n){ const m = (n || '').match(/\.([a-z0-9]+)$/i); return m ? m[1].toUpperCase().slice(0, 4) : 'FILE'; }
const OK_TYPES = ['image/png','image/jpeg','image/gif','image/webp','image/svg+xml','video/mp4','video/webm','application/pdf','text/plain','text/csv','text/markdown','application/json'];
function fileType(f){
  if(OK_TYPES.includes(f.type)) return f.type;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm',pdf:'application/pdf',txt:'text/plain',log:'text/plain',csv:'text/csv',md:'text/markdown',json:'application/json'})[ext] || null;
}
function isSentMsg(m){ if(m.sent === true) return true; if(m.sent === false) return false; return /^\u2705|\(\u2705 sent/i.test(m.label || ''); }

// Turn db nodes into the prototype's card shape.
function buildCards(nodes, seen){
  const cards = {};
  const rootOf = n => { let r = n, guard = 0; while(r && r.parent && nodes[r.parent] && guard++ < 200) r = nodes[r.parent]; return r; };
  const ancDone = n => { let p = n.parent ? nodes[n.parent] : null, g = 0; while(p && g++ < 200){ if(p.resolved) return p.id; p = p.parent ? nodes[p.parent] : null; } return null; };
  Object.values(nodes).forEach(n => {
    const root = rootOf(n);
    const status = n.status === 'pending' ? 'waiting' : n.status === 'error' ? 'failed' : 'answered';
    const flag = n.flag || '';
    const fromThread = /^\(update from/i.test(n.raw || '');
    const origin = flag === 'briefing' ? 'briefing' : (flag === 'update' || (flag && fromThread)) ? 'update' : 'me';
    const g = sig(n);
    const t = toMs(n.createdAt) || (n.order > 1e12 ? n.order : 0), u = toMs(n.updatedAt);
    const raw = (n.raw || '').trim();
    const doneBy = n.resolved ? null : ancDone(n);
    cards[n.id] = {
      id: n.id, tree: (root && root.tree) || 'main', parent: n.parent && nodes[n.parent] ? n.parent : null,
      q: n.q || '', orig: origin === 'me' && raw && !fromThread && raw !== (n.q || '').trim() ? raw : '', raw,
      ...(() => { const qp = qParts(n.q, raw); return { quote: qp.quote, qHead: qp.head }; })(),
      a: n.a || '', readA: typeof n.readA === 'string' ? n.readA : null, origin, tag: flag === 'update' || flag === 'briefing' ? '' : flag,
      drafts: msgsOf(n).map((m, i) => ({ id: n.id + '~' + i, idx: i, to: m.to || '', re: m.replyTo || '', label: m.label || '', text: m.text, sent: isSentMsg(m) || m.cancelled === true, cancelled: m.cancelled === true, why: m.cancelReason || '', useIn: m.useInstead || '' })),
      links: (n.seeAlso ? [{ type: 'dup', to: n.seeAlso, note: '' }] : []).concat((Array.isArray(n.links) ? n.links : []).filter(l => l && l.id).map(l => ({ type: l.kind === 'same' ? 'dup' : 'read', to: l.id, note: l.note || '' }))),
      imgs: n.imgs && typeof n.imgs === 'object' && !Array.isArray(n.imgs) ? n.imgs : {}, /* v2.65: images embedded in the answer (data URIs), keyed */
      files: [].concat(n.files || [], n.afiles || []).filter(f => f && f.id).map(f => ({ id: f.id, name: f.name || 'file', type: f.type || '', url: '/_blob/' + f.id, isImg: /^image\//.test(f.type || '') })),
      t: t ? Math.min(t, u || t) : u, tu: u || t, /* v2.47 §21: never asked after answered */ order: typeof n.order === 'number' ? n.order : 0,
      status, upl: n.upl && typeof n.upl === 'object' ? n.upl : null, /* v2.67: { n, ok, bad: [names] } while files upload after Send */ sig: g, seen: status !== 'answered' || !g || seen[n.id] === g, changed: status === 'answered' && !!g && !!seen[n.id] && seen[n.id] !== g,
      read: !!n.read, resolved: !!n.resolved, done: !!n.resolved || !!doneBy, doneBy, doneAt: n.resolvedAt || 0, pinned: !!n.pinned
    };
  });
  return cards;
}

const MAXF = 3; // folder levels (round 2: up to 3)
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

class Component extends DCLogic {
  rootRef = React.createRef(); fileRef = React.createRef(); mainScrollRef = React.createRef(); readerScrollRef = React.createRef(); treeTa = React.createRef(); cardTa = React.createRef();
  state = this.init();
  init(){
    const p = load(LS, null);
    let collapsed = p && p.collapsed;
    if(!collapsed){ collapsed = {}; const open = load('qm-open', {}); Object.keys(open).forEach(k => { if(open[k] === false) collapsed[k] = true; }); }
    const seen = load('qm-seen', null);
    return Object.assign({ view: 'inbox', openId: null, sheet: null, pop: null, toast: null, query: '', trailOpen: false, compare: {}, origOpen: {}, copied: null, files: {}, errs: {}, width: window.innerWidth,
      nodes: {}, treeDocs: {}, wsDocs: {}, folderDocs: {}, linkDocs: {}, loaded: false, status: 'loading', sendState: 'off', firstSeen: !seen, seen: seen || {}, treeOpen: false, dropOn: null, focus: false, cardW: null, divHover: false, divDrag: false, compFocus: null, sideW: null, rail: null, showAll: {}, lvlShown: {}, runOpen: {}, flyout: false, sdHover: false, sdDrag: false,
      collapsed, foldersShut: {}, curWs: 'main', curTree: 'main', lastTree: null, comp: {}, theme: 'system', sound: false, hlOff: false, hlGone: null },
      p ? { curWs: p.curWs || 'main', curTree: p.curTree || 'main', lastTree: p.lastTree || null, comp: p.comp || {}, theme: p.theme || 'system', sound: !!p.sound, hlOff: !!p.hlOff, foldersShut: p.foldersShut || {}, focus: !!p.focus, cardW: p.cardW || null, sideW: p.sideW || null, showAll: p.showAll || {}, lvlShown: p.lvlShown || {}, rail: typeof p.rail === 'boolean' ? p.rail : null } : {}, { collapsed });
  }
  componentDidMount(){ try{ window.__qmJump = id => this.jump(id); }catch(e){}
    this.mq = window.matchMedia('(prefers-color-scheme: dark)'); this.onMq = () => this.forceUpdate(); this.mq.addEventListener('change', this.onMq);
    this.onResize = () => this.setState({ width: window.innerWidth, pop: null }); window.addEventListener('resize', this.onResize);
    this.onKey = e => this.key(e); window.addEventListener('keydown', this.onKey);
    this.onBU = e => this.onBeforeUnload(e); window.addEventListener('beforeunload', this.onBU); /* v2.67 */
    this.purge = {};
    this.tmr = {}; this.io = new IntersectionObserver(es => es.forEach(e => { const id = e.target.getAttribute('data-newcard'); if(!id) return; if(e.isIntersecting){ if(!this.tmr[id]) this.tmr[id] = setTimeout(() => { delete this.tmr[id]; this.markSeen(id); }, 1000); } else { clearTimeout(this.tmr[id]); delete this.tmr[id]; } }), { threshold: 0.5 });
    this.observe();
    this.clockT = setInterval(() => this.forceUpdate(), 60000);
    this.start();
    this.qrInit(); this.hlInit(); this.cmInit();
    this.onNavMouse = e => { if(e.button === 3 || e.button === 4){ e.preventDefault(); this.navGo(e.button === 3 ? -1 : 1); } }; window.addEventListener('mouseup', this.onNavMouse);
  }
  componentWillUnmount(){ window.removeEventListener('beforeunload', this.onBU); clearTimeout(this.readT); clearTimeout(this.flyT); clearTimeout(this.flyOutT); this.mq.removeEventListener('change', this.onMq); window.removeEventListener('resize', this.onResize); window.removeEventListener('keydown', this.onKey); this.io && this.io.disconnect(); clearInterval(this.clockT); (this.unsubs || []).forEach(u => { try{ u(); }catch(e){} }); this.qrTeardown && this.qrTeardown(); this.hlTeardown && this.hlTeardown(); this.cmTeardown && this.cmTeardown(); window.removeEventListener('mouseup', this.onNavMouse); }
  async start(){
    const C = window.claude;
    if(!C || !C.use){ this.setState({ status: 'nohost' }); return; }
    const [db, comments, assets] = await Promise.all([C.use('db'), C.use('comments').catch(() => null), C.use('assets').catch(() => null)]);
    this.db = db; this.comments = comments; this.assets = assets;
    C.use('desktop').then(d => this.deskInit(d), () => {}); /* v2.81: installed desktop app (badge, menu bar, notifications) */
    if(!db){ this.setState({ status: 'signedout' }); return; }
    let sendState = 'off'; if(comments){ try{ sendState = await comments.canSendToClaude(); }catch(e){} }
    this.setState({ sendState });
    this.legacy = new Set(); this.legacyLoaded = false; this.surfacing = {};
    const err = what => e => this.showToast({ kind: 'info', icon: '!', text: 'Could not load ' + what + ': ' + (e && e.message || e) });
    const coll = (name, key) => db.collection(name).onSnapshot(s => { const next = {}; s.docs.forEach(d => next[d.id] = Object.assign({ id: d.id }, d.data() || {})); this.setState({ [key]: next }); }, err(name));
    this.unsubs = [
      db.doc('meta/legacy').onSnapshot(sn => { const d = sn.exists ? sn.data() : {}; this.legacy = new Set(Array.isArray(d && d.ids) ? d.ids : []); this.legacyLoaded = true; this.stamp(this.state.nodes); }, () => { this.legacyLoaded = true; }),
      coll('trees', 'treeDocs'), coll('workspaces', 'wsDocs'), coll('folders', 'folderDocs'), coll('maplinks', 'linkDocs')
    ];
    // v2.32: "seen" marks (the New glow) sync through the database, so a card seen on one computer stops glowing on the others (2 Nov).
    // Nodes wait for the first seen snapshot (max 2.5 s), so already-seen cards don't flash New on open.
    let nodesOn = false; const startNodes = () => { if(nodesOn) return; nodesOn = true; this.unsubs.push(db.collection('nodes').onSnapshot(s => this.onNodes(s), err('your questions'))); };
    this.unsubs.push(db.collection('seen').onSnapshot(s => { this.mergeSeen(s.docs.map(d => [d.id, (d.data() || {}).g])); startNodes(); }, () => startNodes()));
    setTimeout(startNodes, 2500);
    if(sendState !== 'available') setTimeout(() => this.showToast({ kind: 'info', icon: '!', text: this.sendReason() }), 1500);
  }
  onNodes(s){
    const next = {}; s.docs.forEach(d => next[d.id] = Object.assign({ id: d.id }, d.data() || {}));
    const first = !this.state.loaded;
    let seen = this.state.seen;
    if(first && this.state.firstSeen){ seen = {}; Object.values(next).forEach(n => { const g = sig(n); if(g) seen[n.id] = g; }); save('qm-seen', seen); }
    const wasNew = new Set(Object.values(this.state.nodes).filter(n => { const g = sig(n); return g && seen[n.id] !== g; }).map(n => n.id));
    const arrived = first ? [] : Object.values(next).filter(n => { const g = sig(n); return g && seen[n.id] !== g && !wasNew.has(n.id); }).map(n => n.id);
    this.setState({ nodes: next, loaded: true, status: 'ok', seen });
    if(arrived.length) setTimeout(() => this.arrived(arrived), 0);
    Object.values(next).forEach(n => { const g = sig(n); if(g && seen[n.id] !== g) this.surface(n, next); });
    this.stamp(next);
    if(first){ const m = (location.hash || '').match(/card=([\w-]+)/); let here = null; try{ here = JSON.parse(localStorage.getItem('qm2-here') || 'null'); if(here && !(Date.now() - here.at < 30 * MIN)) here = null; }catch(e){} /* only a recent spot: a reload, not next week's visit */
      if(m && next[m[1]]) setTimeout(() => this.jump(m[1]), 50);
      else if(here && here.openId && next[here.openId]) setTimeout(() => this.jump(here.openId), 50); /* v2.54: a republish reloads the page; reopen the same card */
      else if(here && here.view && here.view !== 'card') this.setState(x => ({ view: here.view, curTree: here.tree && this.treesNow && this.treesNow.some(t => t.id === here.tree) ? here.tree : x.curTree })); }
  }
  // v2.56: readA backfill runs one write at a time, each id once per page load, so it never floods the runtime (uploads hung behind ~900 parallel writes in v2.55)
  queueBackfill(id, a){
    this.bfSeen = this.bfSeen || new Set(); if(this.bfSeen.has(id)) return; this.bfSeen.add(id);
    (this.bfQ = this.bfQ || []).push([id, a]); if(!this.bfBusy) this.pumpBackfill();
  }
  pumpBackfill(){
    const job = (this.bfQ || []).shift(); if(!job){ this.bfBusy = false; return; } this.bfBusy = true;
    let done = false; const next = () => { if(done) return; done = true; setTimeout(() => this.pumpBackfill(), 300); };
    setTimeout(next, 8000); /* a write that never answers must not stall the queue */
    this.db.collection('nodes').doc(job[0]).update({ readA: job[1] }).then(next, next);
  }
  // v1 behaviour kept: an answer stamps asig/updatedAt so "answer changed" works across devices.
  stamp(next){
    if(!this.db || !this.legacyLoaded) return;
    Object.values(next).forEach(n => {
      const g = sig(n); if(g && n.asig === g && n.read && n.readA == null && !this.legacy.has(n.id)){ this.queueBackfill(n.id, n.a || ''); return; } /* v2.55: backfill what he read, so later edits can be shown. v2.56: queued one at a time (the bulk version re-fired on every snapshot and starved uploads) */
      if(!g || n.asig === g || this.legacy.has(n.id)) return;
      const patch = { asig: g, updatedAt: Date.now() }; if(n.asig && n.read) patch.read = false; /* v2.53: a changed answer is unread again (shows in Unread too) */
      if(!toMs(n.createdAt)) patch.createdAt = (n.order > 1e12 ? n.order : Date.now());
      this.db.collection('nodes').doc(n.id).update(patch).catch(() => {});
    });
  }
  // v1 behaviour kept: a new card inside a done branch reopens the path to it, the rest stays done.
  async surface(n, nodes){
    if(!this.db || this.surfacing[n.id]) return;
    const path = []; let c = n, g = 0; while(c && g++ < 200){ path.unshift(c); c = c.parent ? nodes[c.parent] : null; }
    // v2.28 fix (1 Nov, video): only a card answered or created AFTER the branch was marked done reopens it.
    // Before, any card this device hadn't seen did, so a second open window (Dock app + browser tab) undid every Done.
    const t = Math.max(toMs(n.createdAt), toMs(n.updatedAt)); if(!t) return;
    const done = path.slice(0, -1).filter(a => a.resolved && t > (Number(a.resolvedAt) || 0)); if(!done.length) return;
    this.surfacing[n.id] = true;
    const onPath = new Set(path.map(x => x.id));
    try{
      for(const a of done){
        await this.db.collection('nodes').doc(a.id).update({ resolved: false });
        for(const k of Object.values(nodes).filter(x => x.parent === a.id)) if(!onPath.has(k.id) && !k.resolved) await this.db.collection('nodes').doc(k.id).update({ resolved: true, resolvedAt: a.resolvedAt || Date.now() });
      }
    }catch(e){}
    delete this.surfacing[n.id];
  }
  componentDidUpdate(pp, ps){
    this.observe(); this.hlQueue();
    this.navTrack(ps);
    this.readTick(ps);
    if(ps && ps.openId !== this.state.openId && this.readerScrollRef.current) requestAnimationFrame(() => { if(this.readerScrollRef.current) this.readerScrollRef.current.scrollTop = 0; });
    clearTimeout(this.saveT); this.saveT = setTimeout(() => { const s = this.state; save(LS, { showAll: s.showAll, lvlShown: s.lvlShown, collapsed: s.collapsed, foldersShut: s.foldersShut, focus: s.focus, cardW: s.cardW, sideW: s.sideW, rail: s.rail, curWs: s.curWs, curTree: s.curTree, lastTree: s.lastTree, comp: s.comp, theme: s.theme, sound: s.sound, hlOff: s.hlOff }); try{ localStorage.setItem('qm2-here', JSON.stringify({ openId: s.openId, view: s.view, tree: s.curTree, at: Date.now() })); }catch(e){} /* v2.54: survive a republish reload */ }, 250);
    const n = this.inboxN || 0; document.title = (n ? '(' + (n > 99 ? '99+' : n) + ') ' : '') + CFG.title;
    this.deskSync();
    const bg = getComputedStyle(this.rootRef.current || document.body).getPropertyValue('--bg'); if(bg) document.documentElement.style.background = document.body.style.background = bg.trim();
    if(this.pendingScroll){ const id = this.pendingScroll; this.pendingScroll = null; requestAnimationFrame(() => { const root = this.rootRef.current; const sc = this.mainScrollRef.current; const el = root && root.querySelector('[data-row="' + id + '"]'); if(el && sc){ const r = el.getBoundingClientRect(), rs = sc.getBoundingClientRect(); if(r.top < rs.top || r.bottom > rs.bottom) sc.scrollTop += (r.top - rs.top) - rs.height / 3; } if(this.readerScrollRef.current) this.readerScrollRef.current.scrollTop = 0; }); }
    if(this.focusTree){ this.focusTree = false; setTimeout(() => this.treeTa.current && this.treeTa.current.focus(), 30); }
  }
  readTick(ps){ const s = this.state; if(ps && ps.openId !== s.openId && this.noAutoRead && this.noAutoRead !== s.openId) this.noAutoRead = null;
    const c = s.openId && this.cardsNow && this.cardsNow[s.openId]; const want = !!c && this.readerVisible && c.status === 'answered' && (!c.read || !c.seen) && this.noAutoRead !== c.id; /* v2.53: an updated answer on a read card (new again) also clears after 3 s */
    if(want && this.readFor !== c.id){ clearTimeout(this.readT); this.readFor = c.id; const id = c.id; this.readT = setTimeout(() => { this.readFor = null; const cc = this.cardsNow[id]; if(this.state.openId === id && this.readerVisible && this.noAutoRead !== id && cc && (!cc.read || !cc.seen) && document.visibilityState !== 'hidden') this.markRead(id); }, 3000); }
    else if(!want && this.readFor){ clearTimeout(this.readT); this.readFor = null; } }
  markUnread(id){ this.noAutoRead = id; clearTimeout(this.readT); this.readFor = null; this.w(id, { read: false }); }
  observe(){ const root = this.rootRef.current; if(!root || !this.io) return; const els = [...root.querySelectorAll('[data-newcard]')].filter(e => e.getAttribute('data-newcard')); const sig2 = els.map(e => e.getAttribute('data-newcard')).join(',') + '|' + els.length; if(sig2 === this.sig2 && this.els && els.every((e, i) => e === this.els[i])) return; this.sig2 = sig2; this.els = els; this.io.disconnect(); els.forEach(e => this.io.observe(e)); }

  // ---- writes ----
  async w(id, patch){ if(!this.db) return false; try{ await this.db.collection('nodes').doc(id).update(patch); return true; }catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not save: ' + (e.message || e.code) }); return false; } }
  markSeen(id, also){ const ids = [id].concat(also || []); const seen = Object.assign({}, this.state.seen); const ch = []; ids.forEach(i => { const cc = this.cardsNow && this.cardsNow[i]; if(cc && cc.sig && seen[i] !== cc.sig){ seen[i] = cc.sig; ch.push(i); } }); if(!ch.length) return; save('qm-seen', seen); this.setState({ seen }); this.pushSeen(ch.map(i => [i, seen[i]])); }
  pushSeen(pairs){ if(!this.db || !pairs.length) return; pairs.forEach(([i, g]) => { try{ Promise.resolve(this.db.collection('seen').doc(i).set({ g: String(g), at: Date.now() })).catch(() => {}); }catch(e){} }); }
  mergeSeen(pairs){ const cur = this.state.seen || {}; let seen = null; pairs.forEach(([i, g]) => { if(g && cur[i] !== String(g)){ seen = seen || Object.assign({}, cur); seen[i] = String(g); } }); if(!seen) return; save('qm-seen', seen); this.setState({ seen }); }
  markRead(id){ this.markSeen(id); const c = this.cardsNow[id]; if(!c) return; const p = {}; if(!c.read) p.read = true; if(c.status === 'answered' && c.readA !== c.a) p.readA = c.a; /* v2.55: the text he read, for "what changed" */ if(Object.keys(p).length) this.w(id, p); }
  /* v2.66 (8 Nov): bulk select. bsel = { tree, ids: {id: true}, last } while selecting in a tree */
  bulkStart(){ this.setState({ bsel: { tree: this.curTreeId, ids: {}, last: null }, pop: null, swiped: null, lpId: null }); }
  bulkEnd(){ this.setState({ bsel: null }); }
  bulkTap(id, e){ this.setState(x => { const b = x.bsel; if(!b) return null; const ids = Object.assign({}, b.ids); const R = this.rowIds || [];
      if(e && e.shiftKey && b.last && R.includes(b.last) && R.includes(id)){ const a = R.indexOf(b.last), z = R.indexOf(id); const on = !ids[id]; R.slice(Math.min(a, z), Math.max(a, z) + 1).forEach(k => { if(on) ids[k] = true; else delete ids[k]; }); }
      else if(ids[id]) delete ids[id]; else ids[id] = true;
      return { bsel: Object.assign({}, b, { ids, last: id }) }; }); }
  bulkAll(){ const b = this.state.bsel; if(!b) return; const R = this.rowIds || []; const all = R.length && R.every(k => b.ids[k]); const ids = {}; if(!all) R.forEach(k => { ids[k] = true; }); this.setState({ bsel: Object.assign({}, b, { ids }) }); }
  async bulkApply(kind, treeId){ const b = this.state.bsel; if(!b) return; const cards = this.cardsNow; const nodes = this.state.nodes; let ids = Object.keys(b.ids).filter(k => cards[k]); if(!ids.length) return;
    if(kind === 'move'){ const set = new Set(ids); ids = ids.filter(k => { let p = cards[k].parent; while(p){ if(set.has(p)) return false; p = cards[p] && cards[p].parent; } return true; }); }
    const plan = [];
    ids.forEach(k => { const c = cards[k], n = nodes[k] || {}; let p = null, u = null;
      if(kind === 'done' && !c.resolved){ p = { resolved: true, read: true, resolvedAt: Date.now() }; u = { resolved: !!n.resolved, read: !!n.read, resolvedAt: n.resolvedAt || 0 }; }
      else if(kind === 'undone' && c.resolved){ p = { resolved: false }; u = { resolved: true }; }
      else if(kind === 'read' && (!c.read || (c.status === 'answered' && c.readA !== c.a))){ p = { read: true }; u = { read: !!n.read }; if(c.status === 'answered' && c.readA !== c.a){ p.readA = c.a; u.readA = n.readA || ''; } }
      else if(kind === 'unread' && c.read){ p = { read: false }; u = { read: true }; }
      else if(kind === 'move' && c.tree !== treeId){ p = { parent: null, tree: treeId }; u = { parent: n.parent || null, tree: c.tree }; }
      if(p) plan.push({ k, p, u }); });
    const label = { done: 'marked done', undone: 'marked not done', read: 'marked read', unread: 'marked unread', move: 'moved' }[kind];
    this.setState({ bsel: null, sheet: null });
    if(!plan.length){ this.showToast({ kind: 'info', icon: '✓', text: 'Nothing to change: ' + (ids.length > 1 ? 'they are' : 'it is') + ' already ' + label + '.' }); return; }
    if(kind === 'read') plan.forEach(x => this.markSeen(x.k)); if(kind === 'unread'){ this.noAutoRead = this.state.openId; clearTimeout(this.readT); this.readFor = null; }
    const res = await Promise.all(plan.map(x => this.w(x.k, x.p))); const ok = plan.filter((x, i) => res[i]); if(!ok.length) return;
    const tn = kind === 'move' ? ' to ' + short((this.treesNow.find(t => t.id === treeId) || {}).name || 'another tree', 28) : '';
    this.showToast({ kind: 'info', icon: '✓', ms: 8000, text: ok.length + ' card' + (ok.length > 1 ? 's' : '') + ' ' + label + tn, action: 'Undo', onAction: async () => { this.setState({ toast: null }); await Promise.all(ok.map(x => this.w(x.k, x.u))); this.showToast({ kind: 'info', icon: '✓', text: 'Undone' }); } }); }
  /* v2.71: move targets grouped by workspace (current first), then folder path, so two trees with the same name are easy to tell apart */
  fPath(fid){ const out = []; let f = fid ? this.foldersNow[fid] : null, g = 0; while(f && g++ < 20){ out.unshift(f.name); f = f.parent ? this.foldersNow[f.parent] : null; } return out.join(' › '); }
  moveTargets(skipTree, pick){
    const cards = Object.values(this.cardsNow || {}); const open = {}; cards.forEach(c => { if(!c.done) open[c.tree] = (open[c.tree] || 0) + 1; });
    const cur = this.state.curWs; const wsL = this.wsNow.slice().sort((a, b) => (a.id === cur ? -1 : b.id === cur ? 1 : a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })));
    const multiWs = this.wsNow.length > 1; const acts = [];
    wsL.forEach(w => { const ts = this.treesNow.filter(t => t.ws === w.id && t.id !== skipTree).map(t => ({ t, path: this.fPath(t.folder) }));
      if(!ts.length) return;
      ts.sort((a, b) => (a.path ? 1 : 0) - (b.path ? 1 : 0) || a.path.localeCompare(b.path, undefined, { sensitivity: 'base', numeric: true }) || byName(a.t, b.t));
      if(multiWs) acts.push({ head: true, label: (w.name || 'Workspace').toUpperCase() + (w.id === cur ? ' (THIS WORKSPACE)' : '') });
      const dup = {}; ts.forEach(x => { const k = x.t.name.toLowerCase(); dup[k] = (dup[k] || 0) + 1; });
      ts.forEach(x => { const n = open[x.t.id] || 0; acts.push({ label: x.t.name, sub: (x.path ? '📁 ' + x.path : 'Top level') + ' · ' + (n ? n + ' open' : 'no open cards'), tag: dup[x.t.name.toLowerCase()] > 1 ? 'same name' : '', onGo: () => pick(x.t) }); }); });
    return acts;
  }
  bulkMovePick(){ const b = this.state.bsel; if(!b) return; const others = this.moveTargets(b.tree, t => this.bulkApply('move', t.id)); if(!others.length){ this.showToast({ kind: 'info', icon: '!', text: 'There is no other tree to move to yet.' }); return; }
    const n = Object.keys(b.ids).length; this.setState({ pop: null, sheet: { kind: 'actions', title: 'Move ' + n + ' card' + (n > 1 ? 's' : '') + ' to… (each as a new topic, with its replies)', actions: others } }); }
  subIds(id){ const cards = this.cardsNow; const out = [id]; const kids = {}; Object.values(cards).forEach(c => { if(c.parent) (kids[c.parent] = kids[c.parent] || []).push(c.id); }); const w = i => (kids[i] || []).forEach(k => { out.push(k); w(k); }); w(id); return out; }
  async markDone(id){
    const c = this.cardsNow[id]; if(!c) return;
    if(c.resolved){ await this.w(id, { resolved: false }); return; }
    if(c.doneBy){ this.jump(c.doneBy); return; }
    const ids = this.subIds(id); const cards = this.cardsNow;
    const unread = ids.filter(i => cards[i].status === 'answered' && !cards[i].read);
    this.markSeen(id, ids);
    this.justDone = Object.assign({}, this.justDone, { [id]: Date.now() + 6000 }); clearTimeout(this.jdT); this.jdT = setTimeout(() => this.setState({}), 6100);
    const ok = await this.w(id, { resolved: true, read: true, resolvedAt: Date.now() });
    if(!ok) return;
    if(this.state.openId === id){ const nx = this.unreadAfter(new Set(ids)); if(nx) this.jump(nx); }
    await Promise.all(unread.filter(i => i !== id).map(i => this.w(i, { read: true })));
    this.showToast({ kind: 'done', icon: '✓', foldId: id, text: ids.length > 1 ? 'Branch done · ' + ids.length + ' cards cleared' : 'Done · card cleared', action: 'Undo', onAction: async () => { this.setState({ toast: null }); this.justDone = Object.assign({}, this.justDone, { [id]: 0 }); await this.w(id, { resolved: false }); await Promise.all(unread.map(i => this.w(i, { read: false }))); } });
  }
  // v2.81: "Install as app" (Claude desktop app). Only inside the installed app's window does claude.use('desktop') carry
  // app/permissions; elsewhere it holds just `install`, so all of this stays off in a browser tab or the artifact panel.
  // Dock badge = the same count as the Inbox badge (needs no permission). Menu bar item and notifications need the
  // person's OK: asked from a button in a toast (never bare on load), and the page works the same if they say no.
  async deskInit(d){
    if(!d || !d.app || !d.permissions) return;
    this.desk = d;
    try{ this.deskPerm = await d.permissions.state(); }catch(e){ this.deskPerm = {}; }
    this.deskSync(true);
    const p = this.deskPerm || {};
    if(p.notifications === 'prompt' || p['menu-bar'] === 'prompt') setTimeout(() => this.showToast({ kind: 'info', icon: '🔔', ms: 20000, text: 'Get a notification for each new answer and the unread count in the menu bar?', action: 'Turn on', onAction: () => this.deskAsk() }), 2500);
  }
  async deskAsk(){
    this.setState({ toast: null }); const d = this.desk; if(!d) return;
    try{ this.deskPerm = await d.permissions.request(['notifications', 'menu-bar']); }catch(e){}
    this.deskSync(true);
  }
  deskSync(force){
    const d = this.desk; if(!d) return;
    const n = this.inboxN || 0; if(!force && n === this.deskN) return; this.deskN = n;
    const txt = n ? (n > 99 ? '99+' : String(n)) : '';
    d.app.dock.setBadge(txt).catch(() => {});
    if((this.deskPerm || {})['menu-bar'] === 'granted') d.tray.set({ icon: deskIcon(), title: txt, toolTip: (n ? n + ' unread · ' : 'All caught up · ') + CFG.title,
      menu: [{ label: n ? n + ' unread' : 'All caught up', enabled: false }, { type: 'separator' }, { label: 'Open ' + CFG.title, click: () => { d.window.show().catch(() => {}); } }] }).catch(() => {});
  }
  deskNotify(ids){
    const d = this.desk; if(!d || (this.deskPerm || {}).notifications !== 'granted') return;
    if(!document.hidden && document.hasFocus()) return; /* he is looking at the map: the in-page toast is enough */
    const nodes = this.state.nodes || {}; const names = ids.map(i => nodes[i]).filter(Boolean).map(c => String(c.qHead || c.q || 'a card'));
    if(!names.length) return;
    const body = (names.length === 1 ? 'New answer: ' + names[0] : names.length + ' new answers: ' + names.slice(0, 3).join(' · ')).slice(0, 300);
    d.notification.show({ body }).catch(() => {});
  }
  showToast(t){ clearTimeout(this.toastT); this.setState({ toast: Object.assign({}, t, { at: Date.now() }) }); this.toastT = setTimeout(() => this.setState({ toast: null }), t.ms || (t.kind === 'new' ? 9000 : t.icon === '!' ? 8000 : t.action ? 6000 : 5000)); }
  beep(){ try{ const a = this.ac || (this.ac = new AudioContext()); const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 740; g.gain.setValueAtTime(.08, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .25); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .26); }catch(e){} }
  arrived(ids){ this.deskNotify(ids); if(this.state.sound) this.beep(); const s = this.state; const ids2 = ids.filter(i => i !== s.openId); if(!ids2.length) return; const prev = s.toast && s.toast.kind === 'new' && Date.now() - s.toast.at < 9000 ? s.toast.ids : []; this.showToast({ kind: 'new', ids: [...prev, ...ids2] }); }
  // v2.33 round 2 §17: show the parent of a row (hover 400 ms on desktop, long-press on phone)
  rowEl(id){ const root = this.rootRef.current; return root && root.querySelector('[data-row="' + id + '"]'); }
  hoverRow(id){ const c = this.cardsNow && this.cardsNow[id]; if(!c || !c.parent) return; const el = this.rowEl(c.parent); const sc = this.mainScrollRef.current; let off = 0;
    if(el && sc){ const r = el.getBoundingClientRect(), b = sc.getBoundingClientRect(); if(r.bottom < b.top || r.top > b.bottom){ const ids = this.rowIds || []; off = Math.abs(ids.indexOf(id) - ids.indexOf(c.parent)); } }
    this.hoverOff = off; this.setState({ hoverId: id }); }
  showParent(id){ const c = this.cardsNow && this.cardsNow[id]; if(!c || !c.parent) return; const pid = c.parent;
    const go = () => { const el = this.rowEl(pid); if(!el){ this.jump(pid); return; } el.scrollIntoView({ block: 'center', behavior: 'smooth' }); clearTimeout(this.flashT); this.setState({ flashId: pid, hoverId: null }); this.flashT = setTimeout(() => this.setState({ flashId: null }), 1400); };
    const tk = this.runKeyOf && this.runKeyOf[pid]; if(this.threadHidden && this.threadHidden.has(pid) && tk){ this.setState(z => ({ thrOpen: Object.assign({}, z.thrOpen, { [tk]: true }) }), () => requestAnimationFrame(go)); return; }
    go(); }
  // §16: every ancestor of a card, L1 at the top, with a filter; pick = re-root (tree) or open (reader)
  ancestorMenu(e, id, how){ const cards = this.cardsNow; const p = []; let c = cards[id], g = 0; while(c && g++ < 10000){ p.unshift(c.id); c = c.parent ? cards[c.parent] : null; }
    const st = this.statOf || (() => ({ nw: 0 })); const list = how === 'root' ? p : p.slice(0, -1);
    const acts = list.map((x, i) => { const nw = st(x).nw; const cur = how === 'root' ? x === id : false; return { tag: 'L' + (i + 1), oneLine: true, label: String(cards[x].q || cards[x].orig || cards[x].raw || ''), right: cur ? 'current root' : nw ? nw + ' new' : '', rightAcc: !cur && nw > 0, sel: cur, weight: cur ? 600 : 500, onGo: () => how === 'root' ? this.reRoot(x) : this.jump(x) }; });
    this.menu(e, 'Levels', acts, { w: 440, filter: 'Filter ' + list.length + ' levels…', scrollEnd: true }); }
  jump(id){ const s = this.state; const cards = this.cardsNow; const c = cards[id]; if(!c) return; const col = Object.assign({}, s.collapsed); let p = c.parent; while(p){ delete col[p]; p = cards[p] && cards[p].parent; } const tr = this.treesNow.find(t => t.id === c.tree); this.pendingScroll = id; this.setState({ collapsed: col, curTree: c.tree, curWs: tr ? tr.ws : s.curWs, lastTree: c.tree, openId: id, view: 'card', sheet: null, pop: null, trailOpen: false, treeOpen: false }); }
  nextNew(){ const s = this.state; const cards = this.cardsNow; const list = Object.values(cards).filter(c => c.status === 'answered' && !c.seen && c.id !== s.openId).sort((a, b) => a.tu - b.tu); if(s.openId && cards[s.openId] && !cards[s.openId].seen) this.markSeen(s.openId); if(list.length) this.jump(list[0].id); else this.showToast({ kind: 'info', icon: '✓', text: 'You have seen everything new.' }); }
  // round 2 §10: previous / next in tree order (folded branches included); next unread
  isUr(c){ return !!c && c.status === 'answered' && !c.read && !c.done; }
  unreadAfter(ex){ const s = this.state; const o = this.orderNow || []; const cards = this.cardsNow; const i = o.indexOf(s.openId); for(let k = 1; k <= o.length; k++){ const id = o[(i + k + o.length) % o.length]; if(id !== s.openId && !(ex && ex.has(id)) && this.isUr(cards[id])) return id; } return null; }
  nextUnread(){ const id = this.unreadAfter(); if(id) this.jump(id); else this.showToast({ kind: 'info', icon: '✓', text: 'Nothing unread left in this tree.' }); }
  step(dir){ const o = this.orderNow || []; const i = o.indexOf(this.state.openId); if(i < 0){ if(o.length) this.jump(o[0]); return; } const j = i + dir; if(j >= 0 && j < o.length) this.jump(o[j]); }
  pickTree(id){ const t = this.treesNow.find(x => x.id === id); if(!t) return; clearTimeout(this.flyT); this.setState({ curTree: id, curWs: t.ws, lastTree: id, view: 'tree', openId: null, sheet: null, pop: null, treeOpen: false, flyout: false }); }
  // v2.59 (7 Nov): Back / Forward through every place he has been (card, tree, workspace, inbox), like the Claude desktop app.
  // One entry per change of { view, workspace, tree, open card }; changes within 450 ms merge (one click often sets state twice).
  navKey(s){ return [s.view, s.curWs, s.curTree, s.openId || ''].join('|'); }
  navTrack(ps){
    const s = this.state; const snap = { view: s.view, curWs: s.curWs, curTree: s.curTree, lastTree: s.lastTree, openId: s.openId || null };
    // The dc runtime calls componentDidUpdate WITHOUT prevState, so remember the last key ourselves.
    const k = this.navKey(s);
    if(!this.navH){ if(!s.loaded) return; this.navH = [snap]; this.navI = 0; this.navAt = 0; this.navLast = k; return; }
    if(k === this.navLast) return; this.navLast = k;
    if(this.navGoing){ this.navGoing = false; return; }
    const cur = this.navH[this.navI]; if(cur && this.navKey(cur) === this.navKey(s)) return;
    const now = Date.now();
    if(now - (this.navAt || 0) < 450 && this.navI === this.navH.length - 1 && this.navI > 0) this.navH[this.navI] = snap;
    else { this.navH = this.navH.slice(0, this.navI + 1); this.navH.push(snap); if(this.navH.length > 300) this.navH.shift(); this.navI = this.navH.length - 1; }
    this.navAt = now; this.setState(x => ({ navV: (x.navV || 0) + 1 }));
  }
  navGo(d){
    const H = this.navH; if(!H) return; let i = this.navI + d;
    const live = t => !t.openId || (this.cardsNow && this.cardsNow[t.openId]) || t.curTree;
    while(i >= 0 && i < H.length && !live(H[i])) i += d;
    if(i < 0 || i >= H.length) return;
    this.navI = i; this.navAt = 0; const t = H[i]; const c = t.openId && this.cardsNow && this.cardsNow[t.openId];
    const next = { view: t.view, curWs: t.curWs, curTree: t.curTree, lastTree: t.lastTree, openId: c ? t.openId : null };
    if(this.navKey(next) !== this.navKey(this.state)) this.navGoing = true;
    const col = Object.assign({}, this.state.collapsed); if(c){ let p = c.parent; while(p){ delete col[p]; p = this.cardsNow[p] && this.cardsNow[p].parent; } this.pendingScroll = c.id; }
    this.setState(x => Object.assign(next, { collapsed: col, sheet: null, pop: null, flyout: false, trailOpen: false, navV: (x.navV || 0) + 1 }));
  }
  navLabel(t){ if(!t) return ''; const c = t.openId && this.cardsNow && this.cardsNow[t.openId]; if(c) return short(c.q || c.raw || 'card', 48);
    if(t.view === 'inbox') return 'Inbox'; if(t.view === 'trees') return 'All trees'; const tr = (this.treesNow || []).find(x => x.id === t.curTree); return tr ? 'Tree “' + short(tr.name, 36) + '”' : 'the tree'; }
  navVals(){ const H = this.navH || [], i = this.navI || 0; const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const cb = i > 0, cf = i < H.length - 1;
    return { back: () => this.navGo(-1), fwd: () => this.navGo(1), noBack: !cb, noFwd: !cf, backOp: cb ? 1 : .32, fwdOp: cf ? 1 : .32, backCur: cb ? 'pointer' : 'default', fwdCur: cf ? 'pointer' : 'default',
      backAria: cb ? 'Back to ' + this.navLabel(H[i - 1]) : 'Back', fwdAria: cf ? 'Forward to ' + this.navLabel(H[i + 1]) : 'Forward',
      backTip: cb ? 'Back to: ' + this.navLabel(H[i - 1]) + '  (' + (mac ? '⌘[' : 'Alt+←') + ')' : 'Back', fwdTip: cf ? 'Forward to: ' + this.navLabel(H[i + 1]) + '  (' + (mac ? '⌘]' : 'Alt+→') + ')' : 'Forward' }; }
  // v2.73 (10 Nov): reply highlights. Text he replied to stays marked in the answer (CSS Custom Highlight API, no DOM
  // changes), with a count bubble of the DIRECT follow-ups on it: grey when all are read, accent when one has a new answer.
  // Matching uses the quote stored in each child's raw ("> " lines), whitespace-insensitive. Quotes no longer in the answer
  // go to a "Replies on removed text (n)" line under it. Bubbles are plain DOM on document.body (like the Reply pill).
  hlInit(){
    const host = document.createElement('div'); host.setAttribute('data-qm-hl', ''); document.body.appendChild(host);
    const st = document.createElement('style'); st.textContent = '::highlight(qm-hl){background-color:color-mix(in srgb, var(--mute) 16%, transparent);text-decoration:underline;text-decoration-color:var(--mute);text-decoration-thickness:1.5px;text-underline-offset:3px}::highlight(qm-hl-new){background-color:color-mix(in srgb, var(--acc) 22%, transparent);text-decoration:underline;text-decoration-color:var(--acc);text-decoration-thickness:2px;text-underline-offset:3px}';
    document.head.appendChild(st);
    this.hl = { host, groups: [], bubbles: [], sc: null };
    const onMove = () => this.hlPlace();
    const onClick = e => { if(e.target && e.target.closest && e.target.closest('a,button,textarea,input')) return; const g = this.hlHit(e.clientX, e.clientY); if(!g) return; const sel = window.getSelection(); if(sel && !sel.isCollapsed) return; this.hlOpen(g, e.target); };
    window.addEventListener('resize', onMove); document.addEventListener('scroll', onMove, true); document.addEventListener('click', onClick);
    this.hlTeardown = () => { window.removeEventListener('resize', onMove); document.removeEventListener('scroll', onMove, true); document.removeEventListener('click', onClick); host.remove(); st.remove(); try{ CSS.highlights.delete('qm-hl'); CSS.highlights.delete('qm-hl-new'); }catch(e){} };
  }
  hlQueue(){ if(!this.hl) return; cancelAnimationFrame(this.hlRaf); this.hlRaf = requestAnimationFrame(() => this.hlSync()); }
  hlClear(){ const h = this.hl; h.groups = []; try{ CSS.highlights.delete('qm-hl'); CSS.highlights.delete('qm-hl-new'); }catch(e){} h.bubbles.forEach(b => b.remove()); h.bubbles = []; }
  hlSync(){
    const h = this.hl; if(!h) return; const s = this.state; const cards = this.cardsNow || {}; const oc = s.openId && cards[s.openId];
    const sc = this.readerScrollRef.current; const el = sc && sc.querySelector('[data-qm-ans]');
    const kids = oc && oc.status === 'answered' ? Object.values(cards).filter(c => c.parent === oc.id && /^\s*>/m.test(c.raw || '')) : [];
    const sig = (s.hlOff ? 'off' : '') + '|' + (oc ? oc.id + ':' + (oc.a || '').length + ':' + (oc.a || '').slice(-40) : '') + '|' + kids.map(k => k.id + (k.status === 'answered' && !k.read ? '*' : '')).join(',') + '|' + (el ? el.textContent.length : 0) + '|' + (this.diffFor ? 'd' : '');
    if(sig === h.sig && el === h.el){ this.hlPlace(); return; }
    h.sig = sig; h.el = el; this.hlClear();
    const goneWas = s.hlGone && s.hlGone.cid === (oc && oc.id) ? s.hlGone.ids.join(',') : '';
    if(!oc || !el || s.hlOff || typeof CSS === 'undefined' || !CSS.highlights || typeof Highlight === 'undefined' || !kids.length){ if(s.hlGone && (goneWas || !oc || s.hlGone.cid !== (oc && oc.id))) this.setState({ hlGone: null }); return; }
    // whitespace-free text of the answer, with a map back to (node, offset)
    const map = []; let flat = ''; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for(let n = tw.nextNode(); n; n = tw.nextNode()){ const t = n.nodeValue; if(n.parentElement && n.parentElement.closest('button')) continue; for(let i = 0; i < t.length; i++){ if(/\s/.test(t[i])) continue; flat += t[i]; map.push([n, i]); } }
    const norm = t => String(t || '').replace(/…$/, '').replace(/\s+/g, '');
    /* every quote block in the message counts (several parts quoted in one question) */
    const quotesOf = raw => { const out = []; let cur = null; String(raw || '').split('\n').forEach(l => { if(/^\s*>/.test(l)){ cur = cur || []; cur.push(l.replace(/^\s*>\s?/, '')); } else if(cur){ out.push(cur.join('\n')); cur = null; } }); if(cur) out.push(cur.join('\n')); return out; };
    const byQ = {}; kids.forEach(k => { quotesOf(k.raw).forEach(qq => { const q = norm(qq); if(!q) return; const L = (byQ[q] = byQ[q] || []); if(L.indexOf(k) < 0) L.push(k); }); });
    const hlRead = new Highlight(), hlNew = new Highlight(); const gone = [];
    const spans = [];
    Object.keys(byQ).forEach(q => { const ks = byQ[q]; let at = flat.indexOf(q), len = q.length;
      if(at < 0 && q.length > 60){ const head = q.slice(0, 40), tail = q.slice(-20); const a = flat.indexOf(head); const b = a >= 0 ? flat.indexOf(tail, a + head.length) : -1; if(a >= 0 && b > a && b - a < q.length * 1.5){ at = a; len = b + tail.length - a; } }
      if(at < 0){ ks.forEach(k => gone.push(k.id)); return; }
      spans.push({ at, end: at + len, ks: ks.slice() }); });
    // overlapping replies share one highlight and one bubble with the total
    spans.sort((a, b) => a.at - b.at); const merged = [];
    spans.forEach(sp => { const m = merged[merged.length - 1]; if(m && sp.at < m.end){ m.end = Math.max(m.end, sp.end); m.ks = m.ks.concat(sp.ks.filter(k => m.ks.indexOf(k) < 0)); } else merged.push(sp); });
    merged.forEach(m => { const r = document.createRange(); const [sn, so] = map[m.at], [en, eo] = map[m.end - 1]; r.setStart(sn, so); r.setEnd(en, eo + 1);
      const isNew = m.ks.some(k => k.status === 'answered' && !k.read); (isNew ? hlNew : hlRead).add(r);
      h.groups.push({ r, ids: m.ks.sort((a, b) => a.t - b.t).map(k => k.id), isNew, at: m.at }); });
    try{ CSS.highlights.set('qm-hl', hlRead); CSS.highlights.set('qm-hl-new', hlNew); }catch(e){}
    h.groups.sort((a, b) => a.at - b.at);
    h.groups.forEach(g => { const b = document.createElement('button'); b.type = 'button'; b.textContent = String(g.ids.length);
      const ph = this.isPhoneNow; const sz = ph ? 19 : 16;
      b.setAttribute('aria-label', g.ids.length + ' follow-up' + (g.ids.length > 1 ? 's' : '') + ' on this part' + (g.isNew ? ', new answer waiting' : ''));
      b.title = g.ids.length + ' follow-up' + (g.ids.length > 1 ? 's' : '') + ' on this part';
      b.style.cssText = 'position:fixed;z-index:2147482000;min-width:' + sz + 'px;height:' + sz + 'px;padding:0 4px;border-radius:99px;border:0;display:none;align-items:center;justify-content:center;font:700 ' + (ph ? 11.5 : 10) + 'px/1 "Source Sans 3",system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.18);' + (g.isNew ? 'background:var(--acc);color:#fff' : 'background:var(--soft);color:var(--mute);outline:1px solid var(--line2)') + ';' + (ph ? 'touch-action:manipulation' : '');
      b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.hlOpen(g, b); });
      h.host.appendChild(b); g.btn = b; h.bubbles.push(b); });
    const r = this.rootRef.current; h.host.setAttribute('data-theme', (r && r.getAttribute('data-theme')) || 'light');
    if(r){ const cs = getComputedStyle(r); ['--acc', '--soft', '--mute', '--line2'].forEach(v => h.host.style.setProperty(v, cs.getPropertyValue(v))); }
    this.hlPlace();
    const gw = gone.join(','); if(gw !== goneWas) this.setState({ hlGone: gone.length ? { cid: oc.id, ids: gone } : null });
  }
  hlPlace(){ const h = this.hl; if(!h || !h.groups.length) return; const sc = this.readerScrollRef.current; if(!sc) return; const box = sc.getBoundingClientRect();
    h.groups.forEach(g => { const rs = g.r.getClientRects(); const last = rs[rs.length - 1]; const b = g.btn; if(!b) return;
      if(!last || last.bottom < box.top + 4 || last.top > box.bottom - 4){ b.style.display = 'none'; return; }
      /* sits like a footnote mark above the end of the highlight, in the gap between lines, so it never covers words */
      const w = b.offsetWidth || 16, hh = parseInt(b.style.height) || 16; let left = last.right - 3; if(left + w > box.right - 2) left = box.right - w - 2;
      b.style.display = 'flex'; b.style.left = Math.round(left) + 'px'; b.style.top = Math.round(last.top - hh * 0.62) + 'px'; }); }
  hlHit(x, y){ const h = this.hl; if(!h || !h.groups.length) return null; for(const g of h.groups){ for(const rc of g.r.getClientRects()){ if(x >= rc.left && x <= rc.right && y >= rc.top - 2 && y <= rc.bottom + 2) return g; } } return null; }
  hlOpen(g, anchorEl){ const cards = this.cardsNow || {}; const ids = g.ids.filter(i => cards[i]); if(!ids.length) return;
    if(ids.length === 1){ this.jump(ids[0]); return; }
    const acts = ids.map(i => { const c = cards[i]; const nw = c.status === 'answered' && !c.read; return { label: short(c.qHead || c.q || c.raw || '', 90), sub: c.status === 'answered' ? (nw ? 'New answer' : 'Answered') : 'Waiting for an answer', rightAcc: nw, right: nw ? '●' : '', onGo: () => this.jump(i) }; });
    this.setState({ pop: null, sheet: { kind: 'actions', title: ids.length + ' follow-ups on this part', actions: acts } }); }
  hlGoneOpen(){ const g = this.state.hlGone; if(!g) return; this.hlOpen({ ids: g.ids }); }
  // v2.58 (7 Nov): select text in the reader -> "Reply" pill -> popover. Enter sends a follow-up quoting it;
  // Option/Alt+Enter (or "Add to message") parks it as a quote chip in the card's Ask box, so several parts go as one question.
  // Plain DOM on document.body (outside the template) so the selection is never re-rendered away.
  qrInit(){
    const host = document.createElement('div'); host.setAttribute('data-qm-qr', ''); document.body.appendChild(host);
    this.qr = { host, btn: null, pop: null, sel: null, down: false };
    const onDown = e => { this.qr.down = true; const t = e.target; if(this.qr.btn && !this.qr.btn.contains(t)) this.qrHideBtn(); if(this.qr.pop && !this.qr.pop.contains(t) && !(this.qr.btn && this.qr.btn.contains(t))){ const ta = this.qr.pop.querySelector('textarea'); if(this.qr.pop.dataset.edit || !ta || !ta.value.trim()) this.qrClose(); } };
    const onUp = () => { this.qr.down = false; setTimeout(() => this.qrCheck(), 10); };
    const onSel = () => { clearTimeout(this.qrSelT); this.qrSelT = setTimeout(() => { if(!this.qr.down) this.qrCheck(); }, 260); };
    const onScroll = e => { if(this.qr.btn && !(this.qr.pop && this.qr.pop.contains(e.target))) this.qrHideBtn(); };
    const onKey = e => { if(e.key === 'Escape' && this.qr.btn && !this.qr.pop) this.qrHideBtn(); };
    document.addEventListener('mousedown', onDown, true); document.addEventListener('touchstart', onDown, true);
    document.addEventListener('mouseup', onUp); document.addEventListener('touchend', onUp);
    document.addEventListener('selectionchange', onSel); document.addEventListener('scroll', onScroll, true); window.addEventListener('keydown', onKey);
    this.qrTeardown = () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('touchstart', onDown, true); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchend', onUp); document.removeEventListener('selectionchange', onSel); document.removeEventListener('scroll', onScroll, true); window.removeEventListener('keydown', onKey); clearTimeout(this.qrSelT); this.qrClose(); host.remove(); };
  }
  qrTheme(){ const r = this.rootRef.current; this.qr.host.setAttribute('data-theme', (r && r.getAttribute('data-theme')) || 'light'); }
  qrCheck(){
    if(!this.qr || this.qr.pop) return;
    const sel = window.getSelection(); const sc = this.readerScrollRef.current; const cid = this.state.openId;
    if(!sel || sel.isCollapsed || !sel.rangeCount || !sc || !cid || !this.cardsNow || !this.cardsNow[cid]) return this.qrHideBtn();
    const r = sel.getRangeAt(0); if(!sc.contains(r.commonAncestorContainer)) return this.qrHideBtn();
    const anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
    if(anc && anc.closest && anc.closest('textarea,input,button')) return this.qrHideBtn();
    const text = sel.toString().replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if(text.length < 2) return this.qrHideBtn();
    const rs = r.getClientRects(); const box = r.getBoundingClientRect(); const first = rs[0] || box; const last = rs[rs.length - 1] || box;
    this.qr.sel = { text: text.length > 1500 ? text.slice(0, 1499) + '…' : text, cid, first: { l: first.left, t: first.top, b: first.bottom }, last: { r: last.right, t: last.top, b: last.bottom }, box: { l: box.left, r: box.right, t: box.top, b: box.bottom } };
    this.qrShowBtn();
  }
  qrShowBtn(){
    const q = this.qr; this.qrTheme(); let b = q.btn;
    if(!b){ b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Reply to the selected text');
      b.innerHTML = '<span>Reply</span>'; /* v2.60: plain label (7 Nov: the quote mark was noise) */
      b.style.cssText = 'position:fixed;z-index:2147483000;display:flex;align-items:center;gap:5px;height:34px;padding:0 16px;border-radius:99px;border:0;background:var(--ink);color:var(--paper);font:600 14px/1 "Source Sans 3",system-ui,sans-serif;box-shadow:0 8px 22px rgba(0,0,0,.2),0 1px 3px rgba(0,0,0,.18);cursor:pointer;opacity:0;transform:translateY(3px);transition:opacity .12s ease,transform .12s ease;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none';
      b.addEventListener('mousedown', e => e.preventDefault()); b.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true });
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.qrOpen(); });
      q.host.appendChild(b); q.btn = b; }
    const s = q.sel, W = window.innerWidth, H = window.innerHeight, bw = b.offsetWidth || 72, bh = 34;
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    let top = touch ? s.box.b + 14 : s.first.t - bh - 8; if(!touch && top < 8) top = s.last.b + 8; if(touch && top + bh > H - 8) top = s.box.t - bh - 52;
    let left = (touch ? (s.box.l + s.box.r) / 2 : s.last.r) - bw / 2; left = Math.max(8, Math.min(W - bw - 8, left));
    b.style.top = Math.round(Math.max(8, top)) + 'px'; b.style.left = Math.round(left) + 'px';
    requestAnimationFrame(() => { if(q.btn){ q.btn.style.opacity = '1'; q.btn.style.transform = 'none'; } });
  }
  qrHideBtn(){ if(this.qr && this.qr.btn){ this.qr.btn.remove(); this.qr.btn = null; } }
  qrQueued(cid){ return ((this.state.files || {})['card:' + cid] || []).filter(f => f.quote).length; }
  qrOpen(){
    const q = this.qr, s = q.sel; if(!s) return; this.qrHideBtn(); this.qrTheme();
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ''); const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const phone = this.isPhoneNow || window.innerWidth < 560;
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const kbd = t => '<kbd style="font:500 11px/1 \'JetBrains Mono\',monospace;border:1px solid var(--line2);border-radius:5px;padding:2px 5px;color:var(--mute)">' + t + '</kbd>';
    const n = this.qrQueued(s.cid);
    const pop = document.createElement('div'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Reply to the selected text');
    pop.style.cssText = 'position:fixed;z-index:2147483001;box-sizing:border-box;width:' + (phone ? 'auto' : '384px') + ';max-width:calc(100vw - 16px);background:var(--paper);color:var(--ink);border:1px solid var(--line2);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.08);padding:12px 12px 10px;display:flex;flex-direction:column;gap:10px;font:15px/1.4 "Source Sans 3",system-ui,sans-serif;opacity:0;transform:translateY(4px);transition:opacity .14s ease,transform .14s ease';
    pop.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px"><span style="flex:1;font:500 10.5px \'JetBrains Mono\',monospace;letter-spacing:.08em;color:var(--mute)">REPLY TO THIS PART</span>' +
      '<button type="button" data-x aria-label="Close" style="width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--mute);font-size:18px;line-height:1;cursor:pointer">×</button></div>' +
      '<div style="display:flex;gap:10px;min-width:0"><span style="flex:none;width:3px;border-radius:2px;background:var(--acc)"></span><div data-q style="min-width:0;font-size:14px;line-height:1.45;color:var(--mute);white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden">' + esc(s.text) + '</div></div>' +
      '<textarea rows="2" aria-label="Your reply" placeholder="Ask about this part…" style="box-sizing:border-box;width:100%;resize:none;border:1px solid var(--line2);border-radius:12px;background:transparent;color:var(--ink);font:16px/1.4 \'Source Sans 3\',system-ui,sans-serif;padding:9px 12px;outline:none;max-height:148px;transition:border-color .12s"></textarea>' +
      '<div data-thumbs style="display:none;gap:10px;flex-wrap:wrap;padding:4px 2px 0"></div>' +
      '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap">' + this.qrImgBtn() + '<span style="flex:1"></span>' +
      (n ? '<span style="font-size:12.5px;color:var(--mute);white-space:nowrap">' + n + ' waiting</span>' : '') +
      '<button type="button" data-add title="Keep collecting, send later with Ask" style="display:flex;align-items:center;gap:7px;min-height:34px;padding:0 12px;border-radius:99px;border:1px solid var(--line2);background:transparent;color:var(--ink);font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer;white-space:nowrap">Add to message' + (touch ? '' : kbd((mac ? '\u2325' : 'Alt') + '\u21b5')) + '</button>' +
      '<button type="button" data-send style="display:flex;align-items:center;gap:7px;min-height:34px;padding:0 12px 0 15px;border-radius:99px;border:0;background:var(--line);color:var(--mute);font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer;white-space:nowrap">Send' + (touch ? '' : '<kbd data-k style="font:500 11px/1 \'JetBrains Mono\',monospace;border:1px solid currentColor;border-radius:5px;padding:2px 5px;opacity:.7">\u21b5</kbd>') + '</button></div>';
    q.host.appendChild(pop); q.pop = pop;
    const ta = pop.querySelector('textarea'), send = pop.querySelector('[data-send]'), add = pop.querySelector('[data-add]');
    const sync = () => { const has = !!ta.value.trim(); send.style.background = has ? 'var(--accStrong)' : 'var(--line)'; send.style.color = has ? '#fff' : 'var(--mute)'; send.disabled = !has; ta.style.height = 'auto'; ta.style.height = Math.min(148, ta.scrollHeight + 2) + 'px'; };
    ta.addEventListener('input', () => { sync(); this.qrPlace(); });
    q.imgs = []; this.qrWireImgs(pop, q.imgs, ta, () => this.qrPlace());
    ta.addEventListener('focus', () => { ta.style.borderColor = 'var(--acc)'; }); ta.addEventListener('blur', () => { ta.style.borderColor = 'var(--line2)'; });
    ta.addEventListener('keydown', e => { e.stopPropagation();
      if(e.key === 'Escape'){ e.preventDefault(); this.qrClose(); return; }
      if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); if(e.altKey) this.qrAdd(ta.value); else if(ta.value.trim()) this.qrSend(ta.value); } });
    pop.querySelector('[data-x]').addEventListener('click', () => this.qrClose());
    add.addEventListener('click', () => this.qrAdd(ta.value)); send.addEventListener('click', () => { if(ta.value.trim()) this.qrSend(ta.value); });
    pop.addEventListener('mousedown', e => e.stopPropagation()); pop.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    sync(); this.qrPlace();
    this.qrVV = () => this.qrPlace(); if(window.visualViewport){ window.visualViewport.addEventListener('resize', this.qrVV); window.visualViewport.addEventListener('scroll', this.qrVV); } window.addEventListener('resize', this.qrVV);
    requestAnimationFrame(() => { if(q.pop){ q.pop.style.opacity = '1'; q.pop.style.transform = 'none'; } try{ ta.focus({ preventScroll: true }); }catch(e){ ta.focus(); } });
  }
  // v2.61 (7 Nov): images that belong to ONE quote. list = array of {lid,name,type,size,id,status,url}; redraw() repaints.
  qrPickImgs(list, redraw, files){
    [...files].forEach(f => { const type = fileType(f);
      if(!type || !/^image\//.test(type)){ this.showToast({ kind: 'info', icon: '!', text: f.name + ': only images can go with a quote. Use + Attach for other files.' }); return; }
      if(f.size > 20 * 1024 * 1024){ this.showToast({ kind: 'info', icon: '!', text: f.name + ' is over 20 MB.' }); return; }
      if(!this.assets){ this.showToast({ kind: 'info', icon: '!', text: 'Attaching images is unavailable here.' }); return; }
      const ent = { lid: 'i' + Date.now() + Math.random().toString(36).slice(2, 6), name: f.name, type, status: 'up', url: URL.createObjectURL(f) }; list.push(ent); redraw();
      Promise.race([this.assets.upload(f, { type }), new Promise((_, no) => setTimeout(() => no({ message: 'no answer after 90 s' }), 90000))])
        .then(r => { ent.status = 'ok'; ent.id = r.id; ent.size = r.sizeBytes; redraw(); }, e => { ent.status = 'err'; redraw(); this.showToast({ kind: 'info', icon: '!', text: f.name + ' didn\'t upload (' + (e.message || e.code) + '). Remove it and try again.' }); });
    });
  }
  qrThumbs(box, list, redraw){
    box.innerHTML = ''; box.style.display = list.length ? 'flex' : 'none';
    list.forEach((im, i) => { const t = document.createElement('div');
      t.style.cssText = 'position:relative;width:52px;height:52px;flex:none;border-radius:9px;background:var(--soft) center/cover no-repeat;border:1px solid var(--line2);box-sizing:border-box';
      t.style.backgroundImage = 'url("' + im.url + '")'; t.title = im.name + (im.status === 'up' ? ' (uploading…)' : im.status === 'err' ? ' (failed)' : '');
      if(im.status !== 'ok'){ const o = document.createElement('div'); o.style.cssText = 'position:absolute;inset:0;border-radius:8px;display:grid;place-items:center;font:600 11px \'Source Sans 3\',sans-serif;color:#fff;background:' + (im.status === 'err' ? 'rgba(160,40,30,.72)' : 'rgba(0,0,0,.38)'); o.textContent = im.status === 'err' ? 'Failed' : '···'; t.appendChild(o); }
      const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Remove image ' + (i + 1)); x.textContent = '×';
      x.style.cssText = 'position:absolute;top:-7px;right:-7px;width:20px;height:20px;border-radius:99px;border:1px solid var(--line2);background:var(--paper);color:var(--ink);font:600 13px/1 sans-serif;cursor:pointer;display:grid;place-items:center;padding:0';
      x.addEventListener('click', e => { e.stopPropagation(); list.splice(list.indexOf(im), 1); redraw(); }); t.appendChild(x); box.appendChild(t); });
  }
  qrImgBtn(){ return '<button type="button" data-img title="Add an image for this part" aria-label="Add an image for this part" style="display:flex;align-items:center;gap:6px;min-height:34px;padding:0 10px;border:0;border-radius:99px;background:transparent;color:var(--mute);font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer;white-space:nowrap"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2"></rect><circle cx="5.5" cy="6.25" r="1.25"></circle><path d="m14 10.5-3.5-3.5L4 13.25"></path></svg>Image</button>' +
      '<input data-file type="file" accept="image/*" multiple hidden>'; }
  qrWireImgs(pop, list, ta, after){
    const box = pop.querySelector('[data-thumbs]'), btn = pop.querySelector('[data-img]'), inp = pop.querySelector('[data-file]');
    const redraw = () => { if(!pop.isConnected) return; this.qrThumbs(box, list, redraw); if(after) after(); };
    btn.addEventListener('click', () => inp.click()); inp.addEventListener('change', () => { if(inp.files.length) this.qrPickImgs(list, redraw, inp.files); inp.value = ''; });
    ta.addEventListener('paste', e => { const fl = e.clipboardData && e.clipboardData.files; if(fl && fl.length){ e.preventDefault(); this.qrPickImgs(list, redraw, fl); } });
    pop.addEventListener('dragover', e => e.preventDefault()); pop.addEventListener('drop', e => { e.preventDefault(); if(e.dataTransfer.files.length) this.qrPickImgs(list, redraw, e.dataTransfer.files); });
    redraw(); return redraw;
  }
  qrPlace(){
    const q = this.qr, pop = q && q.pop, s = q && q.sel; if(!pop || !s) return;
    const W = window.innerWidth, H = window.innerHeight, phone = this.isPhoneNow || W < 560;
    if(phone){ const vv = window.visualViewport; const kb = vv ? Math.max(0, H - vv.height - vv.offsetTop) : 0; pop.style.left = '8px'; pop.style.right = '8px'; pop.style.top = 'auto'; pop.style.bottom = (kb + 8) + 'px'; return; }
    const w = pop.offsetWidth, h = pop.offsetHeight; let top = s.last.b + 10; if(top + h > H - 8) top = s.first.t - h - 10; if(top < 8) top = Math.max(8, H - h - 8);
    const left = Math.max(8, Math.min(W - w - 8, s.first.l - 6)); pop.style.top = Math.round(top) + 'px'; pop.style.left = Math.round(left) + 'px';
  }
  qrClose(){ const q = this.qr; if(!q) return; if(q.pop){ q.pop.remove(); q.pop = null; } if(this.qrVV){ if(window.visualViewport){ window.visualViewport.removeEventListener('resize', this.qrVV); window.visualViewport.removeEventListener('scroll', this.qrVV); } window.removeEventListener('resize', this.qrVV); this.qrVV = null; } }
  qrDone(){ this.qrClose(); this.qr.sel = null; try{ window.getSelection().removeAllRanges(); }catch(e){} }
  // v2.60 (7 Nov): click a quote chip to see the whole quote and note, and edit either before sending.
  qrEdit(key, lid, el){
    const f = ((this.state.files || {})[key] || []).find(x => x.lid === lid); if(!f) return;
    this.qrClose(); this.qrHideBtn(); this.qrTheme(); const q = this.qr;
    const phone = this.isPhoneNow || window.innerWidth < 560; const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const lab = t => '<span style="font:500 10.5px \'JetBrains Mono\',monospace;letter-spacing:.08em;color:var(--mute)">' + t + '</span>';
    const taCss = 'box-sizing:border-box;width:100%;resize:none;border:1px solid var(--line2);border-radius:12px;background:transparent;font:15px/1.45 \'Source Sans 3\',system-ui,sans-serif;padding:9px 12px;outline:none;transition:border-color .12s;';
    const pop = document.createElement('div'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Edit quoted part'); pop.dataset.edit = '1';
    pop.style.cssText = 'position:fixed;z-index:2147483001;box-sizing:border-box;width:' + (phone ? 'auto' : '420px') + ';max-width:calc(100vw - 16px);background:var(--paper);color:var(--ink);border:1px solid var(--line2);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.2),0 2px 8px rgba(0,0,0,.08);padding:12px 12px 10px;display:flex;flex-direction:column;gap:8px;font:15px/1.4 "Source Sans 3",system-ui,sans-serif;opacity:0;transform:translateY(4px);transition:opacity .14s ease,transform .14s ease';
    pop.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px"><span style="flex:1">' + lab('QUOTED PART') + '</span>' +
      '<button type="button" data-x aria-label="Close" style="width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:var(--mute);font-size:18px;line-height:1;cursor:pointer">×</button></div>' +
      '<div style="display:flex;gap:10px;min-width:0"><span style="flex:none;width:3px;border-radius:2px;background:var(--acc)"></span><textarea data-q rows="1" aria-label="Quoted text" style="' + taCss + 'color:var(--mute);font-style:italic;max-height:180px"></textarea></div>' +
      '<div style="margin-top:4px">' + lab('YOUR NOTE') + '</div>' +
      '<textarea data-n rows="2" aria-label="Your note" placeholder="What do you want to ask about this part?" style="' + taCss + 'color:var(--ink);max-height:148px"></textarea>' +
      '<div data-thumbs style="display:none;gap:10px;flex-wrap:wrap;padding:4px 2px 0"></div>' +
      '<div style="display:flex;align-items:center;gap:4px;margin-top:2px">' + this.qrImgBtn() + '<button type="button" data-rm style="min-height:34px;padding:0 10px;border:0;border-radius:99px;background:transparent;color:var(--mute);font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer">Remove</button><span style="flex:1"></span>' +
      '<button type="button" data-c style="min-height:34px;padding:0 12px;border-radius:99px;border:1px solid var(--line2);background:transparent;color:var(--ink);font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer">Cancel</button>' +
      '<button type="button" data-s style="display:flex;align-items:center;gap:7px;min-height:34px;padding:0 12px 0 15px;border-radius:99px;border:0;background:var(--accStrong);color:#fff;font:600 13.5px \'Source Sans 3\',system-ui,sans-serif;cursor:pointer">Save' + (touch ? '' : '<kbd style="font:500 11px/1 \'JetBrains Mono\',monospace;border:1px solid currentColor;border-radius:5px;padding:2px 5px;opacity:.7">↵</kbd>') + '</button></div>';
    q.host.appendChild(pop); q.pop = pop;
    const tq = pop.querySelector('[data-q]'), tn = pop.querySelector('[data-n]'), sv = pop.querySelector('[data-s]');
    tq.value = f.quote; tn.value = f.note || ''; const imgs = (f.imgs || []).slice();
    const grow = t => { t.style.height = 'auto'; t.style.height = Math.min(parseInt(t.style.maxHeight, 10) || 160, t.scrollHeight + 2) + 'px'; };
    const sync = () => { const ok = !!tq.value.trim(); sv.disabled = !ok; sv.style.opacity = ok ? 1 : .45; grow(tq); grow(tn); place(); };
    const save = () => { const qt = tq.value.trim(); if(!qt) return; const nt = tn.value.trim();
      this.setState(x => ({ files: Object.assign({}, x.files, { [key]: (x.files[key] || []).map(y => y.lid === lid ? Object.assign({}, y, { quote: qt, note: nt, imgs: imgs.slice() }) : y) }) })); this.qrClose(); };
    const rm = () => { this.setState(x => ({ files: Object.assign({}, x.files, { [key]: (x.files[key] || []).filter(y => y.lid !== lid) }) })); this.qrClose(); };
    const place = () => { if(!q.pop) return; const W = window.innerWidth, H = window.innerHeight;
      if(phone){ const vv = window.visualViewport; const kb = vv ? Math.max(0, H - vv.height - vv.offsetTop) : 0; pop.style.left = '8px'; pop.style.right = '8px'; pop.style.top = 'auto'; pop.style.bottom = (kb + 8) + 'px'; return; }
      const r = el && el.isConnected ? el.getBoundingClientRect() : { left: W / 2 - 210, top: H / 2, bottom: H / 2 }; const w = pop.offsetWidth, h = pop.offsetHeight;
      let top = r.top - h - 10; if(top < 8) top = Math.min(H - h - 8, r.bottom + 10); pop.style.top = Math.round(Math.max(8, top)) + 'px'; pop.style.left = Math.round(Math.max(8, Math.min(W - w - 8, r.left - 4))) + 'px'; };
    [tq, tn].forEach(t => { t.addEventListener('input', sync); t.addEventListener('focus', () => { t.style.borderColor = 'var(--acc)'; }); t.addEventListener('blur', () => { t.style.borderColor = 'var(--line2)'; });
      t.addEventListener('keydown', e => { e.stopPropagation(); if(e.key === 'Escape'){ e.preventDefault(); this.qrClose(); return; } if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); save(); } }); });
    pop.querySelector('[data-x]').addEventListener('click', () => this.qrClose()); pop.querySelector('[data-c]').addEventListener('click', () => this.qrClose());
    pop.querySelector('[data-rm]').addEventListener('click', rm); sv.addEventListener('click', save);
    this.qrWireImgs(pop, imgs, tn, () => place());
    pop.addEventListener('mousedown', e => e.stopPropagation()); pop.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    sync();
    this.qrVV = place; if(window.visualViewport){ window.visualViewport.addEventListener('resize', this.qrVV); window.visualViewport.addEventListener('scroll', this.qrVV); } window.addEventListener('resize', this.qrVV);
    requestAnimationFrame(() => { if(q.pop){ q.pop.style.opacity = '1'; q.pop.style.transform = 'none'; } try{ tn.focus({ preventScroll: true }); tn.setSelectionRange(tn.value.length, tn.value.length); }catch(e){ tn.focus(); } });
  }
  qrAdd(note){
    const s = this.qr.sel; if(!s) return; const key = 'card:' + s.cid; note = (note || '').trim();
    const ent = { lid: 'q' + Date.now() + Math.random().toString(36).slice(2, 6), quote: s.text, note, imgs: (this.qr.imgs || []).slice(), status: 'ok', isImg: false, bg: 'none', type: 'text/quote', name: '“' + short(s.text.replace(/\s+/g, ' '), 44) + '”' };
    this.setState(x => ({ files: Object.assign({}, x.files, { [key]: (x.files[key] || []).concat([ent]) }), treeOpen: false }));
    this.qrDone(); /* v2.62 (7 Nov): no toast, the new chip in the Ask box is the feedback */
  }
  async qrSend(note){
    const s = this.qr.sel; if(!s) return; const st = this.state;
    if(!this.db){ this.showToast({ kind: 'info', icon: '!', text: 'Saving is unavailable here. Open the map signed in to claude.ai.' }); return; }
    if(!this.comments || st.sendState !== 'available'){ this.showToast({ kind: 'info', icon: '!', text: this.sendReason() }); return; }
    const imgs = (this.qr.imgs || []).slice(); if(imgs.some(i => i.status === 'up')){ this.showToast({ kind: 'info', icon: '!', text: 'Wait for the image to finish uploading, then send.' }); return; }
    const c = this.cardsNow[s.cid]; if(!c) return; const qx = [{ quote: s.text, note: (note || '').trim(), imgs }]; const text = composeQuotes(qx); const files = qImgFiles(qx);
    const now = Date.now(); const id = 'n' + now.toString(36) + Math.random().toString(36).slice(2, 6);
    const doc = { parent: c.id, q: text, raw: text, a: '', status: 'pending', source: 'page', order: now, createdAt: now }; if(files.length) doc.files = files;
    this.qrDone();
    this.setState(x => { const col = Object.assign({}, x.collapsed); delete col[c.id]; return { collapsed: col }; });
    try{ await this.db.collection('nodes').doc(id).set(doc); }
    catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not save your reply: ' + (e.message || e.code) }); return; }
    this.showToast({ kind: 'info', icon: '✓', text: 'Asked. The answer will land under this card.' });
    this.deliver(id, c.id, c.tree, text, files, this.rootRef.current);
  }
  askName(title, val, save2, note){ this.setState({ pop: null, sheet: { kind: 'name', title, val: val || '', save: save2, note } }); }
  async dbSet(col, id, data, merge){ if(!this.db) return false; try{ if(merge) await this.db.collection(col).doc(id).update(data); else await this.db.collection(col).doc(id).set(data); return true; }catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not save: ' + (e.message || e.code) }); return false; } }
  async dbDel(col, id){ if(!this.db) return false; try{ await this.db.collection(col).doc(id).delete(); return true; }catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not delete: ' + (e.message || e.code) }); return false; } }

  // ---- menus: a popover next to the button on desktop, a bottom sheet on phone ----
  menu(e, title, actions, o){
    o = o || {}; const el = o.at ? { getBoundingClientRect: () => ({ left: o.at.x, right: o.at.x, top: o.at.y, bottom: o.at.y, width: 0, height: 0 }) } : e && e.currentTarget; const root = this.rootRef.current;
    if(this.isPhoneNow || !el || !root || !el.getBoundingClientRect){ this.setState({ pop: null, sheet: { kind: 'actions', title, actions, note: o.note, filter: o.filter, fq: '' } }); return; }
    const r = el.getBoundingClientRect(), b = root.getBoundingClientRect(); const W = b.width, H = b.height;
    const w = o.matchW ? Math.max(220, r.width) : (o.w || 250);
    let left = o.side === 'right' ? r.right - b.left + 6 : o.alignRight ? r.right - b.left - w : r.left - b.left;
    if(o.side === 'right' && left + w > W - 8) left = r.left - b.left - w - 6;
    left = Math.max(8, Math.min(left, W - w - 8));
    /* v2.76: fit the menu inside what is VISIBLE (root may be taller than the window): open on the side with more room, cap the height to that room, scroll inside */
    const vTop = Math.max(b.top, 0), vBot = Math.min(b.bottom, window.innerHeight || b.bottom);
    let top = null, bottom = null, maxH;
    if(o.side === 'right'){ const down = vBot - r.top - 8, up = r.bottom - vTop - 8; if(down >= up){ top = r.top - b.top - 6; maxH = down; } else { bottom = b.bottom - r.bottom - 6; maxH = up; } }
    else { const down = vBot - r.bottom - 14, up = r.top - vTop - 14; if(down >= 260 || down >= up){ top = r.bottom - b.top + 6; maxH = down; } else { bottom = b.bottom - r.top + 6; maxH = up; } }
    maxH = Math.max(120, Math.round(maxH)) + 'px';
    this.setState({ sheet: null, pop: { left, top, bottom, w, maxH, title, actions, filter: o.filter, fq: '' } });
  }
  // ---- folders ----
  async treePatch(t, patch){ const exists = !!this.state.treeDocs[t.id]; return this.dbSet('trees', t.id, exists ? patch : Object.assign({ title: t.name, order: t.order || 0, ws: t.ws }, patch), exists); }
  // Old maps stored a folder as a plain name on the tree. Turn it into a real folder doc before changing it.
  async realFolder(fid){
    if(!fid) return null; if(!/^legacy:/.test(fid)) return fid;
    const f = this.foldersNow[fid]; if(!f) return null; const id = rid('f');
    if(!(await this.dbSet('folders', id, { title: f.name, ws: f.ws, parent: null, order: Date.now() }))) return null;
    for(const t of this.treesNow.filter(x => x.ws === f.ws && x.folderRaw === f.name)) await this.treePatch(t, { folder: id });
    return id;
  }
  async createFolder(ws, parent, name){ const p = await this.realFolder(parent); const id = rid('f'); if(!(await this.dbSet('folders', id, { title: name, ws, parent: p || null, order: Date.now() }))) return null; if(p) this.setState(x => ({ foldersShut: Object.assign({}, x.foldersShut, { [p]: false }) })); return id; }
  fDepth(fid){ let d = 0, f = this.foldersNow[fid], g = 0; while(f && g++ < 20){ d++; f = f.parent ? this.foldersNow[f.parent] : null; } return d; }
  fHeight(fid){ const kids = Object.values(this.foldersNow).filter(f => f.parent === fid); return 1 + (kids.length ? Math.max(...kids.map(k => this.fHeight(k.id))) : 0); }
  fDesc(fid){ const out = new Set(); const w = id => Object.values(this.foldersNow).forEach(f => { if(f.parent === id && !out.has(f.id)){ out.add(f.id); w(f.id); } }); w(fid); return out; }
  // why a thing can't go into folder `to` (null = top level), or '' when it can
  whyNot(item, to){
    if(item.kind === 'tree') return '';
    if(to === item.id) return 'This folder';
    if(to && this.fDesc(item.id).has(to)) return 'Inside this folder';
    if((to ? this.fDepth(to) : 0) + this.fHeight(item.id) > MAXF) return 'Too deep: ' + MAXF + ' levels max';
    return '';
  }
  hereNow(item){ return item.kind === 'tree' ? ((this.treesNow.find(t => t.id === item.id) || {}).folder || null) : ((this.foldersNow[item.id] || {}).parent || null); }
  async moveTo(item, to){
    if(this.whyNot(item, to) || this.hereNow(item) === to) return;
    const dest = await this.realFolder(to); if(to && !dest) return;
    const name = to ? (this.foldersNow[to] || {}).name : 'the top level';
    let ok;
    if(item.kind === 'tree'){ const t = this.treesNow.find(x => x.id === item.id); if(!t) return; ok = await this.treePatch(t, { folder: dest || '' }); }
    else { const src = await this.realFolder(item.id); if(!src) return; ok = await this.dbSet('folders', src, { parent: dest || null }, true); }
    if(dest) this.setState(x => ({ foldersShut: Object.assign({}, x.foldersShut, { [dest]: false }) }));
    if(ok) this.showToast({ kind: 'info', icon: '✓', text: 'Moved to ' + short(name || '', 40) });
  }
  openMove(item){ this.setState({ pop: null, sheet: { kind: 'move', item, sel: undefined } }); }
  folderMenu(e, f, o){
    const n = this.treesNow.filter(t => t.folder === f.id).length, nf = Object.values(this.foldersNow).filter(x => x.parent === f.id).length; const deep = this.fDepth(f.id) >= MAXF;
    const parts = [n ? n + ' tree' + (n > 1 ? 's' : '') : '', nf ? nf + ' folder' + (nf > 1 ? 's' : '') : ''].filter(Boolean);
    this.menu(e, f.name, [
      { label: 'Rename', onGo: () => this.askName('Rename folder', f.name, async v => { const id = await this.realFolder(f.id); if(id) this.dbSet('folders', id, { title: v }, true); }) },
      { label: 'New folder inside', disabled: deep, sub: deep ? MAXF + ' levels max' : '', onGo: () => this.askName('New folder in ' + short(f.name, 30), '', v => this.createFolder(f.ws, f.id, v)) },
      { label: 'New tree inside', onGo: () => this.newTree(f.ws, f.id) },
      { label: 'Move to…', onGo: () => this.openMove({ kind: 'folder', id: f.id }) },
      { div: true },
      { label: 'Delete folder', danger: true, sub: parts.length ? 'Its ' + parts.join(' and ') + ' move up a level' : 'It\'s empty', onGo: () => this.deleteFolder(f) }
    ], o || { side: 'right' });
  }
  async deleteFolder(f){
    const up = f.parent || null;
    if(/^legacy:/.test(f.id)){ for(const t of this.treesNow.filter(x => x.ws === f.ws && x.folderRaw === f.name)) await this.treePatch(t, { folder: '' }); }
    else {
      const upReal = await this.realFolder(up);
      for(const t of this.treesNow.filter(x => x.folder === f.id)) await this.treePatch(t, { folder: upReal || '' });
      for(const k of Object.values(this.foldersNow).filter(x => x.parent === f.id)) await this.dbSet('folders', k.id, { parent: upReal || null }, true);
      await this.dbDel('folders', f.id);
    }
    this.showToast({ kind: 'info', icon: '✓', text: 'Folder deleted. Nothing inside was deleted.' });
  }
  // ---- workspaces ----
  wsNewCount(id){ return (this.wsNewNow || {})[id] || 0; }
  wsPicker(e){
    const cur = this.curWsId; const nT = id => this.treesNow.filter(t => t.ws === id).length;
    const list = [this.wsNow.find(w => w.id === cur)].concat(this.wsNow.filter(w => w.id !== cur)).filter(Boolean);
    const acts = list.map(w => w.id === cur ? { label: w.name, check: true, sel: true, weight: 600, onGo: () => {} } : { label: w.name, right: (() => { const ur = (this.wsUrNow || {})[w.id] || 0, nw = this.wsNewCount(w.id); return ur && nw ? ur + ' · ' + nw + ' new' : ur ? ur + ' unread' : nw ? nw + ' new' : nT(w.id) ? '' : 'Empty'; })(), rightAcc: !!this.wsNewCount(w.id), onGo: () => this.switchWs(w.id) });
    acts.push({ div: true }); acts.push({ label: '+ New workspace', accent: true, onGo: () => this.newWs() });
    const cw = this.wsNow.find(w => w.id === cur); if(cw) acts.push({ label: 'Rename or delete ' + short(cw.name, 24) + '…', muted: true, onGo: () => this.wsManage(cw) });
    this.menu(e, 'Workspaces', acts, { matchW: true });
  }
  // v2.27: maps sit a level above workspaces, so they get their own switcher on the app title (1 Nov)
  mapPicker(e){
    const maps = this.otherMaps(); const acts = [{ label: CFG.title, check: true, sel: true, weight: 600, sub: 'This map · answered by ' + (CFG.thread || CFG.topic), onGo: () => {} }];
    maps.forEach(m => acts.push({ label: m.name, right: 'Copy link', sub: m.sub || '', onGo: () => this.openMap(m) }));
    if(maps.length) acts.push({ label: 'A map can\'t open another map by itself, so picking one copies its link for a new tab.', disabled: true });
    acts.push({ div: true }); acts.push({ label: '+ Add map link', accent: true, onGo: () => this.addMapLink() });
    if(maps.some(m => m.own)) acts.push({ label: 'Remove a map link…', muted: true, onGo: () => this.removeMapLinkPick() });
    this.menu(e, 'Maps', acts, { w: 300 });
  }
  otherMaps(){
    const self = (CFG.selfUrl || '').replace(/[?#].*$/, ''); const seen = new Set(self ? [self] : []); const out = [];
    (CFG.maps || []).forEach(m => { const u = String(m.url || '').replace(/[?#].*$/, ''); if(!u || seen.has(u)) return; seen.add(u); out.push({ name: m.title || 'Question Map', sub: m.thread ? 'Answered by ' + m.thread : (m.topic || ''), url: u }); });
    Object.values(this.state.linkDocs || {}).filter(l => !l.deleted).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(l => { const u = String(l.url || '').replace(/[?#].*$/, ''); if(!u || seen.has(u)) return; seen.add(u); out.push({ name: l.title || 'Map', sub: '', url: u, own: true, id: l.id }); });
    return out;
  }
  openMap(m){
    // v2.25: a tab opened from inside the artifact frame inherits its sandbox, and claude.ai refuses to load there
    // (ERR_BLOCKED_BY_RESPONSE, seen 1 Nov 2026). So copy the link and say how to open it.
    this.setState({ pop: null, sheet: null }); this.copy(m.url, 'map:' + m.url);
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    this.showToast({ kind: 'info', icon: '✓', ms: 9000, text: 'Link to ' + short(m.name, 30) + ' copied. Open a new tab (' + (mac ? '⌘T' : 'Ctrl+T') + ') and paste it (' + (mac ? '⌘V' : 'Ctrl+V') + ').' });
  }
  addMapLink(){
    this.askName('Add map link', '', v => {
      const u = String(v || '').trim().replace(/[?#].*$/, '');
      if(!/^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9-]+$/.test(u)){ this.showToast({ kind: 'info', icon: '!', text: 'That isn\'t a claude.ai artifact link. It should start with https://claude.ai/artifact/' }); return; }
      if(this.otherMaps().some(m => m.url === u) || u === (CFG.selfUrl || '')){ this.showToast({ kind: 'info', icon: '✓', text: 'That map is already in the list.' }); return; }
      setTimeout(() => this.askName('Name this map', '', async n => { if(await this.dbSet('maplinks', rid('l'), { title: n, url: u, order: Date.now() })) this.showToast({ kind: 'info', icon: '✓', text: 'Added ' + short(n, 30) + ' to Maps' }); }, 'Shown in the workspace list, for example "Planning".'), 50);
    }, 'Paste the link of another Question Map. Picking it later copies the link for a new tab.');
  }
  removeMapLinkPick(){
    const own = this.otherMaps().filter(m => m.own);
    this.setState({ pop: null, sheet: { kind: 'actions', title: 'Remove which map link?', note: 'Only the link goes. The map itself and its cards stay as they are.', actions: own.map(m => ({ label: m.name, danger: true, onGo: async () => { if(await this.dbDel('maplinks', m.id)) this.showToast({ kind: 'info', icon: '✓', text: 'Removed ' + short(m.name, 30) }); } })).concat([{ label: 'Cancel', muted: true, onGo: () => {} }]) } });
  }
  switchWs(id){ const t = this.treesNow.filter(x => x.ws === id).sort(byName)[0]; this.setState(x => ({ curWs: id, curTree: t ? t.id : x.curTree, view: this.isPhoneNow ? 'trees' : 'tree', openId: null, sheet: null, pop: null })); }
  wsSave(id, patch){ const ex = !!this.state.wsDocs[id]; const w = this.wsNow.find(x => x.id === id) || {}; return this.dbSet('workspaces', id, ex ? patch : Object.assign({ title: w.name || 'General', order: 0 }, patch), ex); }
  wsManage(w){
    const n = this.treesNow.filter(t => t.ws === w.id).length; const only = this.wsNow.length < 2;
    this.setState({ pop: null, sheet: { kind: 'actions', title: w.name, actions: [
      { label: 'Rename', onGo: () => this.askName('Rename workspace', w.name, v => this.wsSave(w.id, { title: v })) },
      { div: true },
      { label: 'Delete workspace', danger: true, disabled: only, sub: only ? 'It\'s your only workspace, so it stays.' : n ? 'It has ' + n + ' tree' + (n > 1 ? 's' : '') + '. You move them first.' : 'It\'s empty.', onGo: () => n ? this.wsDeleteBlocked(w, n) : this.wsDelete(w) }] } });
  }
  wsDeleteBlocked(w, n){ this.setState({ sheet: { kind: 'actions', title: 'Delete ' + short(w.name, 30) + '?', note: w.name + ' still has ' + n + ' tree' + (n > 1 ? 's' : '') + '. Move them to another workspace, then it is deleted. No cards are lost.', actions: [
    { label: 'Move its trees to another workspace', accent: true, onGo: () => this.wsMovePick(w) }, { label: 'Cancel', muted: true, onGo: () => {} }] } }); }
  wsMovePick(w){ this.setState({ sheet: { kind: 'actions', title: 'Move ' + short(w.name, 24) + '\'s trees to…', actions: this.wsNow.filter(o => o.id !== w.id).map(o => ({ label: o.name, onGo: () => this.wsMoveAllDelete(w, o) })) } }); }
  async wsMoveAllDelete(w, o){
    const ts = this.treesNow.filter(t => t.ws === w.id);
    for(const t of ts) if(!(await this.treePatch(t, { ws: o.id }))) return;
    for(const f of Object.values(this.state.folderDocs).filter(f => (f.ws || 'main') === w.id)) await this.dbSet('folders', f.id, { ws: o.id }, true);
    await this.wsDelete(w, o.id);
    this.showToast({ kind: 'info', icon: '✓', text: 'Moved ' + ts.length + ' tree' + (ts.length > 1 ? 's' : '') + ' to ' + short(o.name, 24) + ' and deleted ' + short(w.name, 24) + '.' });
  }
  async wsDelete(w, to){
    const other = to || (this.wsNow.find(x => x.id !== w.id) || {}).id; if(!other) return;
    this.setState(x => x.curWs === w.id ? { curWs: other, view: this.isPhoneNow ? 'trees' : 'tree', openId: null } : {});
    if(w.id === 'main') await this.wsSave('main', { deleted: true }); else await this.dbDel('workspaces', w.id);
  }
  newWs(){ this.askName('New workspace', '', async n => { const id = rid('w'); if(await this.dbSet('workspaces', id, { title: n, order: Date.now() })) this.setState({ curWs: id, view: this.isPhoneNow ? 'trees' : 'tree', openId: null }); }); }
  // ---- trees ----
  treeMenuFor(e, t, o){
    const n = Object.values(this.cardsNow).filter(c => c.tree === t.id).length; const last = this.treesNow.filter(x => x.ws === t.ws).length < 2; const others = this.wsNow.filter(w => w.id !== t.ws);
    const fd = t.folder ? this.fDepth(t.folder) : 0; const wsName = (this.wsNow.find(w => w.id === t.ws) || {}).name || '';
    const acts = [
      { label: 'Rename', onGo: () => this.askName('Rename tree', t.name, v => this.treePatch(t, { title: v })) },
      { label: 'Move to…', onGo: () => this.openMove({ kind: 'tree', id: t.id }) },
      { label: 'Put in a new folder', disabled: fd >= MAXF, sub: fd >= MAXF ? MAXF + ' levels max here' : '', onGo: () => this.askName('New folder', '', async v => { const id = await this.createFolder(t.ws, t.folder || null, v); if(id) await this.treePatch(t, { folder: id }); }, 'The tree goes inside it.') }];
    if(others.length) acts.push({ label: 'Move to another workspace…', onGo: () => this.setState({ pop: null, sheet: { kind: 'actions', title: 'Move "' + short(t.name, 30) + '" to…', actions: others.map(w => ({ label: w.name, onGo: async () => { this.setState(x => ({ curWs: x.curTree === t.id ? w.id : x.curWs })); if(await this.treePatch(t, { ws: w.id, folder: '' })) this.showToast({ kind: 'info', icon: '✓', text: 'Moved to ' + w.name }); } })) } }) });
    acts.push({ div: true });
    acts.push({ label: 'Delete tree', danger: true, disabled: last, sub: last ? 'It\'s the only tree in ' + short(wsName, 24) + '. Add another tree first.' : n ? 'Its ' + n + ' card' + (n > 1 ? 's' : '') + ' go too. You can undo.' : 'It\'s empty.', onGo: () => this.deleteTree(t) });
    this.menu(e, t.name, acts, o || { side: 'right' });
  }
  async deleteTree(t){
    const others = this.treesNow.filter(x => x.ws === t.ws && x.id !== t.id).sort(byName); if(!others.length) return;
    if(!(await this.treePatch(t, { deleted: true }))) return;
    const ids = Object.values(this._cards || {}).filter(c => c.tree === t.id).map(c => c.id);
    this.setState(x => x.curTree === t.id ? { curTree: others[0].id, openId: null, view: x.view === 'card' ? 'tree' : x.view } : {});
    clearTimeout(this.purge[t.id]); this.purge[t.id] = setTimeout(() => this.purgeTree(t.id, ids), 6500);
    this.showToast({ kind: 'info', icon: '✓', text: 'Tree deleted', action: 'Undo', ms: 6000, onAction: async () => { clearTimeout(this.purge[t.id]); delete this.purge[t.id]; this.setState({ toast: null }); await this.dbSet('trees', t.id, { deleted: false }, true); } });
  }
  async purgeTree(id, ids){ delete this.purge[id]; if(!this.db) return; try{ for(const i of ids) await this.db.collection('nodes').doc(i).delete(); if(id === 'main') await this.db.collection('trees').doc(id).update({ deleted: true }); else await this.db.collection('trees').doc(id).delete(); }catch(e){} }
  newTree(wsId, folder){ this.askName('New tree', '', async n => { const id = rid('t'); const f = await this.realFolder(folder || null); if(await this.dbSet('trees', id, { title: n, order: Date.now(), ws: wsId, folder: f || '' })){ this.focusTree = true; this.setState(x => ({ curTree: id, curWs: wsId, lastTree: id, view: 'tree', openId: null, foldersShut: f ? Object.assign({}, x.foldersShut, { [f]: false }) : x.foldersShut })); } }, 'One topic, for example a client, a meeting or a decision.'); }
  // ---- cards ----
  // v2.75 (11 Nov): one context menu everywhere. Right-click (desktop) or press and hold (phone) on any card row
  // (tree, inbox, unread, updates, follow-ups, links, search, Focus outline) or on a tree or folder in the sidebar.
  // Text inside an open answer keeps the browser's own menu, so selecting and copying still work.
  cmTarget(t){ const root = this.rootRef.current; if(!root || !t || !t.closest) return null; const el = t.closest('[data-cm],[data-row],[data-cmt],[data-cmf],[data-cmr]'); if(!el || !root.contains(el)) return null;
    if(el.hasAttribute('data-cmr')){ /* v2.77 (11 Nov): right-click anywhere on the open card shows its menu. Typing boxes, links and selected text keep the browser's own menu. */
      const id = this.state.openId; if(!id || !this.cardsNow || !this.cardsNow[id]) return null;
      if(t.closest('input,textarea,select,a[href],[contenteditable="true"]')) return null;
      try{ const sel = window.getSelection && window.getSelection(); if(sel && String(sel).trim()) return null; }catch(_){}
      return { kind: 'card', id, el, reader: true }; }
    const a = n => el.getAttribute(n); if(a('data-cmf')) return { kind: 'folder', id: a('data-cmf'), el }; if(a('data-cmt')) return { kind: 'tree', id: a('data-cmt'), el }; const id = a('data-cm') || a('data-row'); return id && this.cardsNow && this.cardsNow[id] ? { kind: 'card', id, el } : null; }
  cmOpen(tg, x, y){ const ev = { currentTarget: tg.el }; const at = { x, y };
    if(tg.kind === 'card') this.rowMenu(tg.id, at);
    else if(tg.kind === 'tree'){ const t = this.treesNow.find(z => z.id === tg.id); if(t) this.treeMenuFor(ev, t, { at, w: 250 }); }
    else { const f = this.foldersNow && this.foldersNow[tg.id]; if(f) this.folderMenu(ev, f, { at }); } }
  cmInit(){
    const onCtx = e => { if(e.shiftKey) return; const tg = this.cmTarget(e.target); if(!tg) return; e.preventDefault(); this.cmOpen(tg, e.clientX, e.clientY); };
    let lp = null; const clear = () => { if(lp){ clearTimeout(lp.t); lp = null; } };
    const onTS = e => { clear(); if(!e.touches || e.touches.length !== 1) return; const tg = this.cmTarget(e.target); if(!tg || tg.reader || tg.kind === 'card' && tg.el.hasAttribute('data-row')) return; /* phone: the open card keeps text selection; its More button has the same menu */ /* tree rows keep their own swipe + hold code */
      const p = e.touches[0]; lp = { x: p.clientX, y: p.clientY, t: setTimeout(() => { lp = null; this.cmFired = Date.now(); try{ navigator.vibrate && navigator.vibrate(12); }catch(_){} this.cmOpen(tg, p.clientX, p.clientY); }, 500) }; };
    const onTM = e => { if(!lp || !e.touches) return; const p = e.touches[0]; if(Math.abs(p.clientX - lp.x) > 8 || Math.abs(p.clientY - lp.y) > 8) clear(); };
    const onClick = e => { if(Date.now() - (this.cmFired || 0) < 700){ e.preventDefault(); e.stopPropagation(); if(e.type === 'click') this.cmFired = 0; } }; /* the finger lifting after a hold must not open the card or close the new menu */
    document.addEventListener('contextmenu', onCtx); document.addEventListener('touchstart', onTS, { passive: true }); document.addEventListener('touchmove', onTM, { passive: true }); document.addEventListener('touchend', clear); document.addEventListener('touchcancel', clear); document.addEventListener('click', onClick, true); document.addEventListener('mousedown', onClick, true); document.addEventListener('mouseup', onClick, true);
    this.cmTeardown = () => { clear(); document.removeEventListener('contextmenu', onCtx); document.removeEventListener('touchstart', onTS); document.removeEventListener('touchmove', onTM); document.removeEventListener('touchend', clear); document.removeEventListener('touchcancel', clear); document.removeEventListener('click', onClick, true); document.removeEventListener('mousedown', onClick, true); document.removeEventListener('mouseup', onClick, true); };
  }
  qText(c){ return String((c.quote ? (c.qHead || '(reply on the quoted part)') : '') || c.q || c.orig || c.raw || '(attachment)'); }
  rowMenu(id, at){ const c = this.cardsNow && this.cardsNow[id]; if(!c) return; const n = this.subIds(c.id).length - 1; const pc = c.parent && this.cardsNow[c.parent];
    this.setState({ lpId: null, hoverId: null });
    this.menu(null, short(this.qText(c), 60), [
      { label: 'Open', onGo: () => this.jump(c.id) },
      ...(pc ? [{ label: 'Open the parent', sub: short(this.qText(pc), 60), onGo: () => this.jump(pc.id) }] : []),
      { label: 'Focus on this branch', onGo: () => { this.jump(c.id); this.setState({ focus: true }); } },
      { div: true },
      c.read && c.seen ? { label: 'Mark unread', onGo: () => this.markUnread(c.id) } : { label: 'Mark read', onGo: () => this.markRead(c.id) },
      c.resolved && !c.doneBy ? { label: 'Reopen', onGo: () => this.w(c.id, { resolved: false }) } : { label: n ? 'Mark done (with ' + n + ' below)' : 'Mark done', disabled: !!c.done, sub: c.done ? 'Already done' : '', onGo: () => this.markDone(c.id) },
      { label: c.pinned ? 'Unpin from the inbox' : 'Pin to the inbox', onGo: () => this.w(c.id, { pinned: !c.pinned }) },
      { label: 'Move to another tree…', onGo: () => this.cardMovePick(c) },
      { div: true },
      { label: 'Copy question', onGo: () => { this.copy(this.qText(c), 'q:' + c.id); this.showToast({ kind: 'info', icon: '✓', text: 'Question copied' }); } },
      ...(c.status === 'answered' ? [{ label: 'Copy answer', onGo: () => { this.copy(c.a || '', 'ans:' + c.id); this.showToast({ kind: 'info', icon: '✓', text: 'Answer copied' }); } }] : []),
      { label: 'Copy link to card', onGo: () => this.copyLink(c) },
      { div: true },
      { label: n ? 'Delete card and ' + n + ' repl' + (n > 1 ? 'ies' : 'y') : 'Delete card', danger: true, onGo: () => this.askDelete(c) }
    ], { w: 280, at: at || null });
  }
  cardMenu(e, c){
    const n = this.subIds(c.id).length - 1;
    this.menu(e, 'Card', [
      ...(c.resolved && !c.doneBy ? [{ label: 'Reopen', onGo: () => this.w(c.id, { resolved: false }) }] : []),
      c.read && c.seen ? { label: 'Mark unread', onGo: () => this.markUnread(c.id) } : { label: 'Mark read', onGo: () => this.markRead(c.id) }, /* v2.53: new-again cards offer Mark read */
      { label: c.pinned ? 'Unpin from the inbox' : 'Pin to the inbox', onGo: () => this.w(c.id, { pinned: !c.pinned }) },
      { label: 'Move to another tree…', onGo: () => this.cardMovePick(c) },
      { label: 'Copy link to card', onGo: () => this.copyLink(c) },
      ...(this.isPhoneNow && c.status === 'answered' ? [{ label: 'Copy answer', onGo: () => this.copy(c.a || '', 'ans:' + c.id) }] : []),
      { div: true },
      { label: n ? 'Delete card and ' + n + ' repl' + (n > 1 ? 'ies' : 'y') : 'Delete card', danger: true, onGo: () => this.askDelete(c) }
    ], { w: 260 });
  }
  cardMovePick(c){
    const acts = [];
    if(c.parent) acts.push({ label: 'Top of this tree', sub: 'It becomes a new topic here, with its replies.', onGo: async () => { if(await this.w(c.id, { parent: null, tree: c.tree })) this.showToast({ kind: 'info', icon: '✓', text: 'Moved to the top of this tree.' }); } });
    const others = this.moveTargets(c.tree, async t => { const n = this.subIds(c.id).length; if(await this.w(c.id, { parent: null, tree: t.id })){ setTimeout(() => this.jump(c.id), 300); this.showToast({ kind: 'info', icon: '✓', text: 'Moved ' + n + ' card' + (n > 1 ? 's' : '') + ' to ' + short(t.name, 30) }); } });
    if(others.length){ acts.push({ head: true, label: 'OTHER TREES (AS A NEW TOPIC)' }); others.forEach(a => acts.push(a)); }
    this.setState({ pop: null, sheet: { kind: 'actions', title: 'Move this card to…', actions: acts } });
  }
  copyLink(c){ const base = CFG.url || location.href.split('#')[0]; this.copy(base + '#card=' + c.id, 'link:' + c.id); this.showToast({ kind: 'info', icon: '✓', text: 'Link copied' }); }
  askDelete(c){
    const ids = this.subIds(c.id); const n = ids.length - 1;
    if(!n){ this.delWithUndo(c.id); return; }
    const att = ids.reduce((s, i) => s + ((this.cardsNow[i] || {}).files || []).length, 0);
    this.setState({ pop: null, sheet: { kind: 'confirm', title: 'Delete this branch?', note: '“' + short(c.q || c.raw || '', 60) + '” and its ' + n + ' repl' + (n > 1 ? 'ies' : 'y') + ' will be deleted. That\'s ' + (n + 1) + ' cards' + (att ? ' and ' + att + ' attachment' + (att > 1 ? 's' : '') : '') + '. You can\'t undo this.',
      btns: [{ label: 'Delete ' + (n + 1) + ' cards', danger: true, onGo: () => this.delBranch(c.id) }, { label: 'Cancel', onGo: () => {} }] } });
  }
  leave(ids){ const c = this.cardsNow[ids[0]]; this.setState(s => ids.includes(s.openId) ? { openId: c && c.parent || null, view: c && c.parent ? s.view : (s.view === 'card' ? 'tree' : s.view), swiped: null } : { swiped: null }); }
  async delBranch(id){ const ids = this.subIds(id); this.leave(ids); try{ for(const i of ids.slice().reverse()) await this.db.collection('nodes').doc(i).delete(); this.showToast({ kind: 'info', icon: '✓', text: 'Deleted ' + ids.length + ' cards.' }); }catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not delete all: ' + (e.message || e.code) }); } }
  async delWithUndo(id){ const n = this.state.nodes[id]; if(!n) return; const copy = Object.assign({}, n); delete copy.id; this.leave([id]);
    if(!(await this.dbDel('nodes', id))) return;
    this.showToast({ kind: 'info', icon: '✓', text: 'Card deleted', action: 'Undo', ms: 6000, onAction: async () => { this.setState({ toast: null }); await this.dbSet('nodes', id, copy); } }); }
  del(id){ return this.delWithUndo(id); }
  settings(){ const s = this.state; this.setState({ pop: null, sheet: { kind: 'settings', title: 'Settings', actions: [
    { head: true, label: 'NOTIFICATIONS' },
    { label: 'Sound for new answers: ' + (s.sound ? 'On' : 'Off'), onGo: () => { this.setState(x => ({ sound: !x.sound })); setTimeout(() => this.settings(), 0); if(!s.sound) this.beep(); } },
    { head: true, label: 'READING' },
    { label: 'Show reply highlights: ' + (s.hlOff ? 'Off' : 'On'), sub: 'Parts of an answer you replied to stay marked, with a count of the follow-ups.', onGo: () => { this.setState(x => ({ hlOff: !x.hlOff })); setTimeout(() => this.settings(), 0); } },
    { head: true, label: 'ABOUT' },
    { label: 'Asking goes to the "' + CFG.thread + '" thread', sub: s.sendState === 'available' ? 'Claude is listening. Answers land on the card.' : this.sendReason(), disabled: true }] } }); }
  sendReason(){ const st = this.state.sendState;
    if(!this.comments) return 'Asking from this page is unavailable here. Open the map on claude.ai as its owner.';
    if(st === 'no_session') return 'Claude isn\'t listening right now. Ask in the "' + CFG.thread + '" thread instead.';
    if(st === 'writers_only') return 'Only the map\'s owner can send questions to Claude.';
    return 'Asking from this page is off in this view. Ask in the "' + CFG.thread + '" thread instead.'; }
  questionText(id, parent, tree, text, files){ const tn = (this.treesNow.find(t => t.id === tree) || {}).name || tree; return 'Question Map question (node ' + id + ', under ' + (parent || 'top') + ', tree ' + tree + ' "' + tn + '"):\n' + text + (files && files.length ? '\nAttachments: ' + files.map(f => f.name + ' (asset ' + f.id + ', ' + f.type + ')').join('; ') : '') + '\n\n[Answering rules, for whichever thread answers] One question = one card. If this holds several questions: when it is under top (tree root), the pending node becomes ONE main card that sums up the message, and every question becomes its own child card under it; deeper in a tree, the pending node takes the first question and each other one becomes its own sibling card (same parent and tree). Messages he should send go in msgs, never in a. A draft goes in msgs ONLY if he should send it right now: never a draft for later (a day, an event or a merge away); hold it out of the map and add it when its time comes. Label guesses "(my guess)". A quote reply (message starts with "> " lines): q is ONLY his own question, never the quoted words (the map shows the quote apart). Updating an answered card: add the news as a child card, AND fix the main card at once if anything on it (facts, steps, drafts) is now wrong or could mislead (correct it or mark the draft outdated; strike wrong lines with ~~like this~~). Link related cards instead of retyping. Full rules: PLAYBOOK.md in github.com/ayyazzafar/claude-artifact-question-map, "How answering works".'; }
  async send(key, ta){
    const s = this.state; let text = (s.comp[key] || '').trim(); const fl = s.files[key] || [];
    if(fl.some(f => (f.imgs || []).some(i => i.status === 'up'))){ this.showToast({ kind: 'info', icon: '!', text: 'Wait for the quote\'s image to finish uploading, then ask.' }); return; }
    const upNow = fl.filter(f => !f.quote && f.status === 'up' && this.upP && this.upP[f.lid]); /* v2.67: these finish after Send */
    const quotes = fl.filter(f => f.quote); const typed = text;
    const files = qImgFiles(quotes).concat(fl.filter(f => f.status === 'ok' && !f.quote).map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size })));
    if(quotes.length) text = (composeQuotes(quotes) + (typed ? '\n\n' + typed : '')).trim(); /* v2.58 */
    if(!text && !files.length && !upNow.length) return;
    if(!this.db){ this.showToast({ kind: 'info', icon: '!', text: 'Saving is unavailable here. Open the map signed in to claude.ai.' }); return; }
    if(!this.comments || s.sendState !== 'available'){ this.showToast({ kind: 'info', icon: '!', text: this.sendReason() }); return; }
    const [kind, ref] = key.split(':'); let tree, parent;
    if(kind === 'tree'){ tree = ref; parent = null; } else { const c = this.cardsNow[ref]; if(!c) return; tree = c.tree; parent = c.id; }
    const parts = splitQs(text || '(see attached)'); const now = Date.now();
    const ids = parts.map((p, i) => 'n' + (now + i).toString(36) + Math.random().toString(36).slice(2, 6));
    this.setState(x => { const col = Object.assign({}, x.collapsed); if(parent) delete col[parent]; return { comp: Object.assign({}, x.comp, { [key]: '' }), files: Object.assign({}, x.files, { [key]: [] }), errs: Object.assign({}, x.errs, { [key]: '' }), collapsed: col, treeOpen: kind === 'tree' ? false : x.treeOpen }; });
    if(kind === 'tree') this.pendingScroll = ids[0];
    const anchorEl = (ta && ta.current) || this.rootRef.current;
    for(let i = 0; i < parts.length; i++){
      const id = ids[i], p = parts[i];
      const doc = { parent: parent || null, q: p, raw: p, a: '', status: 'pending', source: 'page', order: now + i, createdAt: now + i };
      if(files.length) doc.files = files;
      if(upNow.length) doc.upl = { n: files.length + upNow.length, ok: files.length, bad: [] };
      if(!parent) doc.tree = tree;
      try{ await this.db.collection('nodes').doc(id).set(doc); }
      catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Could not save your question: ' + (e.message || e.code) }); this.setState(x => ({ comp: Object.assign({}, x.comp, { [key]: typed }), files: Object.assign({}, x.files, { [key]: fl }) })); return; }
      if(!upNow.length) this.deliver(id, parent, tree, p, files, anchorEl);
    }
    if(upNow.length){ const job = { ids, parts, parent, tree, anchorEl, base: files, done: [], n: files.length + upNow.length, waits: upNow.map(f => this.upP[f.lid]) }; this.upJobs = this.upJobs || {}; ids.forEach(id => { this.upJobs[id] = job; }); this.forceUpdate(); this.runUploads(job); }
  }
  // v2.70 (9 Nov): an artifact holds at most ~1,000 comment threads. Once full, a new thread fails (409 / upstream_error),
  // so the question goes as a reply into an existing thread instead. Thread ids live in db meta/inbox {ids:[...]}, seeded by the thread.
  async sendQ(anchor, text){
    // v2.79 (21 Nov): at most 2 sendToClaude calls per question. Walking every reply thread in meta/inbox
    // fired a burst of sends once the map hit its 1,000-thread cap, and claude.ai then refused them all as rate_limited.
    const MAX_TRIES = 2; let tries = 0, last = null;
    if(!this.capHit){
      tries++;
      try{ await this.comments.sendToClaude({ anchor, text }); return; }
      catch(e){ if(['consent_required', 'claude_unavailable', 'invalid', 'forbidden', 'rate_limited'].includes(e.code)) throw e; this.capHit = true; last = e; }
    }
    let ids = [];
    try{ const sn = await this.db.doc('meta/inbox').get(); const d = sn.exists ? sn.data() : {}; ids = Array.isArray(d && d.ids) ? d.ids : []; }catch(e){}
    // v2.78: start at the thread that worked last (remembered by id) and wrap around.
    const n = ids.length; const at = Math.max(0, ids.indexOf(this.inboxId));
    for(let k = 0; k < n && tries < MAX_TRIES; k++){
      const tid = ids[(at + k) % n]; tries++;
      try{ await this.comments.sendToClaude({ threadId: tid, text }); this.inboxId = tid; return; }
      catch(e){ last = e; if(['consent_required', 'claude_unavailable', 'invalid', 'rate_limited'].includes(e.code)) throw e; }
    }
    throw last || { code: 'upstream_error', message: 'comment thread limit reached and no reply thread left (meta/inbox)' };
  }
  async deliver(id, parent, tree, text, files, anchorEl){
    try{
      // v2.16: the Ask box can unmount right after sending (full box -> pill), so fall back to the page root
      const el = anchorEl && anchorEl.isConnected ? anchorEl : this.rootRef.current;
      const anchor = await this.comments.anchorFor(el);
      // v2.16: comments have a size cap; long questions send a short preview, the full text stays in the node (raw)
      // v2.30: the cap is 4096 BYTES, not characters. Hindi/Urdu letters take 3 bytes each, so a 2,500-character cut still failed (1 Nov).
      const bytes = t => new TextEncoder().encode(t).length; const CAP = 3900;
      let msg = this.questionText(id, parent, tree, text, files);
      if(bytes(msg) > CAP){ const chars = [...text]; let lo = 0, hi = chars.length;
        const mk = n => this.questionText(id, parent, tree, chars.slice(0, n).join('') + '\n[... ' + (chars.length - n) + ' more characters: read the full question from node ' + id + ' (field raw) in the map database]', files);
        while(lo < hi){ const mid = (lo + hi + 1) >> 1; if(bytes(mk(mid)) <= CAP) lo = mid; else hi = mid - 1; }
        msg = mk(lo); }
      await this.sendQ(anchor, msg);
    }catch(e){
      const msg = e.code === 'consent_required' ? 'Not sent: allow the page to comment for you, then tap Try again.' : e.code === 'claude_unavailable' ? 'Not sent: Claude could not be reached. Tap Try again in a minute.' : 'Not sent (' + (e.message || e.code) + '). Tap Try again.';
      await this.w(id, { status: 'error', a: msg });
    }
  }
  async retry(c){
    if(!this.comments || this.state.sendState !== 'available'){ this.showToast({ kind: 'info', icon: '!', text: this.sendReason() }); return; }
    const n = this.state.nodes[c.id] || {};
    const job = (this.upJobs || {})[c.id];
    if(job && job.bad && job.bad.every(b => this.upFile && this.upFile[b.lid])){ const again = job.bad; job.bad = null; job.waits = again.map(b => { const f = this.upFile[b.lid]; return this.upOne(f, b.type).then(r => ({ ok: true, id: r.id, name: f.name, type: b.type, size: r.sizeBytes }), e => ({ ok: false, name: f.name, type: b.type, lid: b.lid, msg: e.message || e.code })); });
      job.ids.forEach(id => this.w(id, { upl: { n: job.n, ok: job.base.length + job.done.length, bad: [] } })); this.forceUpdate(); this.runUploads(job); return; }
    if(job) job.ids.forEach(id => { delete this.upJobs[id]; });
    if(n.upl && !(await this.w(c.id, { upl: null }))) return;
    if(!(await this.w(c.id, { status: 'pending', a: '' }))) return;
    this.deliver(c.id, c.parent, c.tree, n.raw || n.q || '', n.files || [], this.cardTa.current);
  }
  addFiles(key, list){
    const errs = [];
    [...list].forEach(f => {
      if(f.size > 20 * 1024 * 1024){ errs.push(f.name + ' is over 20 MB.'); return; }
      const type = fileType(f); if(!type){ errs.push(f.name + ': this file type can\'t be attached. Use an image, video, PDF or text file.'); return; }
      if(!this.assets){ errs.push('Attaching files is unavailable here.'); return; }
      const lid = 'f' + Date.now() + Math.random().toString(36).slice(2, 6); const isImg = /^image\//.test(type);
      const loc = URL.createObjectURL(f); const ent = { lid, name: f.name, type, status: 'up', isImg, url: loc, bg: isImg ? 'url("' + loc + '")' : 'none' }; /* v2.65: url = local preview before sending */
      (this.upFile = this.upFile || {})[lid] = f;
      this.setState(s => ({ files: Object.assign({}, s.files, { [key]: [...(s.files[key] || []), ent] }) }));
      (this.upP = this.upP || {})[lid] = this.upOne(f, type).then( /* v2.57: an upload that never answers shows an error instead of spinning forever */r => { this.patchFile(key, lid, { status: 'ok', id: r.id, size: r.sizeBytes }); return { ok: true, id: r.id, name: f.name, type, size: r.sizeBytes }; }, e => { const still = (this.state.files[key] || []).some(x => x.lid === lid); this.patchFile(key, lid, { status: 'err' }); if(still) this.setState(s => ({ errs: Object.assign({}, s.errs, { [key]: f.name + ' didn\'t upload (' + (e.message || e.code) + ').' }) })); return { ok: false, name: f.name, type, lid, msg: e.message || e.code }; });
    });
    this.setState(s => ({ errs: Object.assign({}, s.errs, { [key]: errs.join(' ') }) }));
  }
  upOne(f, type){ return Promise.race([this.assets.upload(f, { type }), new Promise((_, no) => setTimeout(() => no({ code: 'timeout', message: 'no answer after 90 s' }), 90000))]); }
  /* v2.67 (8 Nov): Send no longer waits for uploads. The cards are saved at once with upl = { n, ok, bad }; the question reaches the thread
     only after every file is in, so the answer always sees the screenshots. upJobs[id] lives in this tab only: a card whose job is gone shows "Files didn't finish". */
  async runUploads(job){ const live = () => job.ids.every(id => this.upJobs[id] === job);
    const tick = () => job.ids.forEach(id => this.w(id, { upl: { n: job.n, ok: job.done.length + job.base.length, bad: [] } }));
    const res = await Promise.all(job.waits.map(p => p.then(r => { if(r.ok && live()){ job.done.push(r); tick(); } return r; })));
    if(!live()) return; const bad = res.filter(r => !r.ok); const files = job.base.concat(job.done.map(r => ({ id: r.id, name: r.name, type: r.type, size: r.size })));
    if(bad.length){ job.bad = bad; job.ids.forEach(id => this.w(id, { files, upl: { n: job.n, ok: files.length, bad: bad.map(b => b.name) } })); this.forceUpdate();
      this.showToast({ kind: 'info', icon: '!', text: bad.length + ' file' + (bad.length > 1 ? 's' : '') + ' didn\'t upload. Open the card to try again.' }); return; }
    job.ids.forEach(id => { delete this.upJobs[id]; });
    for(let i = 0; i < job.ids.length; i++){ const id = job.ids[i]; if(!this.state.nodes[id]) continue; if(await this.w(id, { files, upl: null })) this.deliver(id, job.parent, job.tree, job.parts[i], files, job.anchorEl); }
    this.forceUpdate(); }
  upState(c){ if(!c || !c.upl || c.status !== 'waiting') return ''; const job = (this.upJobs || {})[c.id]; return job && !job.bad ? 'up' : 'stuck'; }
  stuckText(oc){ return ((this.upJobs || {})[oc.id] ? 'Try again uploads ' + (oc.upl.bad.length > 1 ? 'them' : 'it') + ' again.' : 'The page was closed before they finished. Try again sends your question with the ' + (oc.files.length ? oc.files.length + ' file' + (oc.files.length > 1 ? 's' : '') + ' that made it' : 'text only') + '; attach the rest in a reply.'); }
  upLive(){ return Object.values(this.upJobs || {}).some(x => !x.bad); }
  onBeforeUnload(e){ if(this.upLive()){ e.preventDefault(); e.returnValue = ''; return ''; } }
  patchFile(key, lid, patch){ this.setState(s => ({ files: Object.assign({}, s.files, { [key]: (s.files[key] || []).map(f => f.lid === lid ? Object.assign({}, f, patch) : f) }) })); }
  // v2.42: attachment viewer (images, PDFs, other files) with previous/next across the card's files
  lbDraft(key, lid){ const L = (this.state.files[key] || []).filter(f => !f.quote && f.url); const i = Math.max(0, L.findIndex(f => f.lid === lid)); this.setState({ lb: { key, i } }); }
  lbList(lb){ if(!lb) return []; if(lb.key) return (this.state.files[lb.key] || []).filter(f => !f.quote && f.url); if(lb.items) return lb.items; const c = (this.cardsNow || {})[lb.cid]; return c ? c.files : []; }
  lbStep(dir){ const s = this.state; if(!s.lb) return; const n = this.lbList(s.lb).length; if(n < 2) return; this.setState({ lb: Object.assign({}, s.lb, { i: (s.lb.i + dir + n) % n }) }); }
  copy(text, id){ const done = () => { this.setState({ copied: id }); clearTimeout(this.cpT); this.cpT = setTimeout(() => this.setState({ copied: null }), 2000); }; try{ navigator.clipboard.writeText(text).then(done, () => { this.fallbackCopy(text); done(); }); }catch(e){ this.fallbackCopy(text); done(); } }
  fallbackCopy(t){ const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); }
  async setSent(cid, idx, sent){ const n = this.state.nodes[cid]; if(!n) return; const at = Date.now(); const msgs = msgsOf(n).map((m, i) => i === idx ? Object.assign({}, m, { sent }, sent ? { sentAt: at } : {}) : m); const ok = await this.w(cid, { msgs }); if(ok !== false && sent) this.tellSent(cid, idx, n, at); }
  // v2.26 (1 Nov): pressing Sent tells the thread which exact draft went out, so it can log it without asking
  async tellSent(cid, idx, n, at){
    if(!this.comments || this.state.sendState !== 'available') return;
    const m = msgsOf(n)[idx] || {}; const t = String(m.text || ''); const preview = t.length > 300 ? t.slice(0, 300) + '…' : t;
    const when = new Date(at).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
    const body = 'Question Map draft marked SENT (node ' + cid + ', draft ' + (idx + 1) + ' of ' + msgsOf(n).length + (m.label ? ', "' + m.label + '"' : '') + ', to ' + (m.to || 'someone') + (m.replyTo || m.re ? ', reply to ' + (m.replyTo || m.re) : '') + ', pressed ' + when + ' his time):\n' + preview + '\n\n[For the thread] The owner pressed Sent on this draft. Log it as sent in the owning chat log/thread and update the card label (e.g. "\u2705 sent ' + new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) + '"). No reply needed on the card.';
    try{ const anchor = await this.comments.anchorFor(this.rootRef.current); await this.sendQ(anchor, body); }
    catch(e){ this.showToast({ kind: 'info', icon: '!', text: 'Marked sent, but Claude was not told (' + (e.message || e.code) + ').' }); }
  }
  openTreeBox(){ this.focusTree = true; this.setState({ treeOpen: true, pop: null }); }
  key(e){ const s = this.state; const tag = (e.target.tagName || '').toLowerCase(); const typing = tag === 'textarea' || tag === 'input';
    if(!this.isPhoneNow && ((e.key === '?' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) || (e.key === '/' && (e.metaKey || e.ctrlKey)))){ e.preventDefault(); this.setState(x => ({ keys: !x.keys, pop: null })); return; } /* v2.68 shortcuts cheat sheet */
    if(s.keys){ if(e.key === 'Escape'){ e.preventDefault(); this.setState({ keys: false }); } return; }
    if(s.lb){ if(e.key === 'Escape'){ e.preventDefault(); this.setState({ lb: null }); return; } if(e.key === 'ArrowRight'){ e.preventDefault(); this.lbStep(1); return; } if(e.key === 'ArrowLeft'){ e.preventDefault(); this.lbStep(-1); return; } }
    if(e.key === 'Escape' && s.bsel && !s.sheet && !s.pop){ e.preventDefault(); this.bulkEnd(); return; }
    if(e.key === 'Escape'){ if(s.flyout) this.setState({ flyout: false }); else if(s.pop) this.setState({ pop: null }); else if(s.sheet) this.setState({ sheet: null }); else if(s.treeOpen) this.setState({ treeOpen: false }); else if(s.focus && s.openId && !this.isPhoneNow) this.setState({ focus: false }); else if(s.openId) this.setState({ openId: null, view: s.view === 'card' ? 'tree' : s.view }); return; }
    if(!typing && !s.sheet && ((e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) || ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']')))){ e.preventDefault(); this.navGo(e.key === 'ArrowLeft' || e.key === '[' ? -1 : 1); return; } /* v2.59 Back / Forward */
    if(typing || e.metaKey || e.ctrlKey || e.altKey || s.sheet) return;
    if(e.key === '/'){ e.preventDefault(); this.setState({ pop: null, sheet: { kind: 'search', title: 'Search' } }); }
    else if(e.key === 'N'){ e.preventDefault(); if(s.view === 'inbox' && !this.isPhoneNow) this.setState({ view: 'tree' }); this.openTreeBox(); }
    else if(e.key === 'n') this.nextNew();
    else if(e.key === 'h' || e.key === 'H'){ const t = this.curTreeId; if(t) this.setState(x => { const v = (x.showAll || {})[t]; const nx = v === 'unread' ? 'new' : v === 'new' ? 'waiting' : v === 'waiting' ? true : v ? false : 'unread'; return { showAll: Object.assign({}, x.showAll, { [t]: nx }) }; }); }
    else if((e.key === 'f' || e.key === 'F') && s.openId && !this.isPhoneNow) this.setState(x => ({ focus: !x.focus }));
    else if((e.key === 'u' || e.key === 'U')) this.nextUnread();
    else if(e.key === '['){ if(!this.isPhoneNow) this.setState({ rail: !this.railNow, flyout: false }); }
    else if((e.key === 'j' || e.key === 'k') && s.openId && this.orderNow && this.orderNow.length) this.step(e.key === 'j' ? 1 : -1);
    else if((e.key === 'j' || e.key === 'k') && this.rowIds && this.rowIds.length){ const i = this.rowIds.indexOf(s.openId); const ni = Math.max(0, Math.min(this.rowIds.length - 1, i + (e.key === 'j' ? 1 : -1))); this.jump(this.rowIds[i < 0 ? 0 : ni]); }
    else if(e.key === 'e' && s.openId) this.markDone(s.openId);
    else if(e.key === 'r' && s.openId) this.markRead(s.openId); }
  // An ask box. mode: 'full' (desktop box with a header line), 'pill' (one line that expands), 'phone' (one line, round send).
  comp(key, ref, o){ const s = this.state; const text = s.comp[key] || ''; const files = (s.files[key] || []).map(f => Object.assign({}, f, { name: f.quote ? '“' + short(f.quote.replace(/\s+/g, ' '), 44) + '”' : f.status === 'up' ? 'Uploading… ' + f.name : f.status === 'err' ? 'Failed: ' + f.name : f.name, ext: f.quote ? '“' : extOf(f.name), notImg: !f.isImg, extFont: f.quote ? "600 24px/1 'Newsreader',serif" : "500 10px 'JetBrains Mono',monospace", extInk: f.quote ? 'var(--accInk)' : 'inherit', extPad: f.quote ? '9px' : '0', tip: f.quote ? f.quote + (f.note ? '\n\n' + f.note : '') : f.name, rmLabel: f.quote ? 'Remove quote' : 'Remove file',
      /* v2.60: a quote chip shows the real quote AND his note, and opens an editor on click */
      maxW: f.quote ? '320px' : '260px', l1Style: f.quote ? 'italic' : 'normal', l1Ink: f.quote ? 'var(--mute)' : 'inherit',
      hasL2: !!f.quote, l2: f.quote ? (f.note ? short(f.note.replace(/\s+/g, ' '), (f.imgs || []).length ? 34 : 46) : 'No note · click to add one') + ((f.imgs || []).length ? ' · ' + f.imgs.length + ' image' + (f.imgs.length > 1 ? 's' : '') : '') : '', l2Ink: f.quote && f.note ? 'var(--ink)' : 'var(--mute)', l2W: f.quote && f.note ? 600 : 400,
      cur: f.quote || f.url ? 'pointer' : 'default', role: f.quote || f.url ? 'button' : '', tab: f.quote || f.url ? '0' : '-1', cls: f.quote || f.url ? 'qm-chipq' : '', openLabel: f.quote ? 'Edit this quote and note' : f.url ? 'Preview ' + f.name : f.name,
      onOpen: e => { if(f.quote) this.qrEdit(key, f.lid, e && e.currentTarget); else if(f.url) this.lbDraft(key, f.lid); }, onKey: e => { if(e.key === 'Enter' || e.key === ' '){ if(f.quote){ e.preventDefault(); this.qrEdit(key, f.lid, e.currentTarget); } else if(f.url){ e.preventDefault(); this.lbDraft(key, f.lid); } } },
      onRemove: () => this.setState(x => ({ files: Object.assign({}, x.files, { [key]: (x.files[key] || []).filter(y => y.lid !== f.lid) }) })) }));
    const can = !!text.trim() || files.some(f => f.status === 'ok' || f.status === 'up'); /* v2.67: uploads may still be running */
    return { ref, text, files, hasFiles: files.length > 0, error: s.errs[key] || '', hasError: !!s.errs[key], placeholder: o.ph, rows: text ? 3 : 1, phRows: o.mode === 'line' ? (text || s.compFocus === key ? 3 : 1) : (text.includes('\n') || text.length > 34 ? 3 : 1), cantSend: !can, sendBg: can ? 'var(--accStrong)' : 'var(--line)', sendInk: can ? '#fff' : 'var(--mute)', sendLabel: o.btn,
      isFull: o.mode === 'full', isPill: o.mode === 'pill', isPhoneBox: o.mode === 'phone' || o.mode === 'line', maxW: o.maxW || '100%', inlineAttach: o.mode === 'line', onFocus: () => this.setState({ compFocus: key }), onBlur: () => setTimeout(() => { if(this.state.compFocus === key) this.setState({ compFocus: null }); }, 150), glyph: o.glyph, headPre: o.pre, headStrong: o.strong, headPost: o.post || '', pillPre: o.pillPre || o.pre, hasKey: !!o.keyHint, onExpand: o.onExpand || (() => {}), showAttach: o.mode === 'phone' && (!!text || files.length > 0),
      onChange: e => { const v = e.target.value; this.setState(x => ({ comp: Object.assign({}, x.comp, { [key]: v }) })); }, onKeyDown: e => { if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); this.send(key, ref); } }, onSend: () => this.send(key, ref), onAttach: () => { this.fileKey = key; this.fileRef.current && this.fileRef.current.click(); }, onPaste: e => { const fl = e.clipboardData && e.clipboardData.files; if(fl && fl.length){ e.preventDefault(); this.addFiles(key, fl); } }, onDragOver: e => e.preventDefault(), onDrop: e => { e.preventDefault(); if(e.dataTransfer.files.length) this.addFiles(key, e.dataTransfer.files); } }; }
  // menu items for both the popover and the bottom sheet
  items(list){ const ph = this.isPhoneNow; return (list || []).map(a => ({ isHead: !!a.head, isDiv: !!a.div, isBtn: !a.head && !a.div, label: a.label || '', sub: a.sub || '', hasSub: !!a.sub, right: a.right || '', hasRight: !!a.right, rightInk: a.rightAcc ? 'var(--accInk)' : 'var(--mute)', rightW: a.rightAcc ? 700 : 400, check: !!a.check, disabled: !!a.disabled, op: a.disabled ? .5 : 1, tag: a.tag || '', hasTag: !!a.tag, lws: a.oneLine ? 'nowrap' : 'normal', lwrap: a.oneLine ? 'normal' : 'anywhere',
    ink: a.danger ? 'var(--del)' : a.accent ? 'var(--accInk)' : a.muted ? 'var(--mute)' : 'var(--ink)', weight: a.weight || (a.accent || a.danger ? 600 : ph ? 500 : 500), bg: a.sel ? 'var(--sel)' : 'transparent',
    onGo: () => { if(a.disabled) return; this.setState({ pop: null, sheet: null }); a.onGo && a.onGo(); } })); }
  renderVals(){
    const S = this.state, P = this.props; const device = P.device ?? 'auto';
    const isPhone = device === 'phone' || (device === 'auto' && S.width < 760); const framed = device === 'phone' && S.width >= 480; this.isPhoneNow = isPhone;
    const theme = S.theme === 'system' ? (this.mq && this.mq.matches ? 'dark' : 'light') : S.theme;
    if(this._nodesRef !== S.nodes || this._seenRef !== S.seen){ this._nodesRef = S.nodes; this._seenRef = S.seen; this._cards = buildCards(S.nodes, S.seen); }
    // workspaces + trees ('main' of each is synthesized when it has no doc; deleted ones are hidden)
    const wsD = Object.assign({}, S.wsDocs); if(!wsD.main) wsD.main = { id: 'main', title: 'General', order: 0 };
    const wsArr = Object.values(wsD).filter(w => !w.deleted).sort((a, b) => (a.order || 0) - (b.order || 0)).map(w => ({ id: w.id, name: w.title || 'Untitled' }));
    const wsById = {}; wsArr.forEach(w => wsById[w.id] = w); const defWs = wsById.main ? 'main' : (wsArr[0] || { id: 'main' }).id;
    const trD = Object.assign({}, S.treeDocs); if(!trD.main) trD.main = { id: 'main', title: CFG.topic, order: 0 };
    Object.values(this._cards).forEach(c => { if(!trD[c.tree]) trD[c.tree] = { id: c.tree, title: c.tree, order: 1e15 }; });
    const treesAll = Object.values(trD).sort((a, b) => (a.order || 0) - (b.order || 0)).map(t => ({ id: t.id, name: t.title || 'Untitled', order: t.order || 0, ws: wsById[t.ws] ? t.ws : defWs, folderRaw: String(t.folder || '').trim(), deleted: !!t.deleted, folder: null }));
    const dead = new Set(treesAll.filter(t => t.deleted).map(t => t.id));
    const treesArr = treesAll.filter(t => !t.deleted);
    // folders: docs in 'folders' {title, ws, parent}; an old plain-name folder on a tree shows as a top-level folder
    const fD = {}; Object.values(S.folderDocs).forEach(f => { if(!f.deleted) fD[f.id] = { id: f.id, name: f.title || 'Untitled', ws: wsById[f.ws] ? f.ws : defWs, parent: f.parent || null }; });
    Object.values(fD).forEach(f => { const p = f.parent && fD[f.parent]; if(!p || p.ws !== f.ws) f.parent = null; });
    Object.values(fD).forEach(f => { let p = f, g = 0; while(p && p.parent && g++ < 10) p = fD[p.parent]; if(g >= 10) f.parent = null; });
    treesArr.forEach(t => { if(!t.folderRaw) return; if(fD[t.folderRaw]){ if(fD[t.folderRaw].ws === t.ws) t.folder = t.folderRaw; return; } const lid = 'legacy:' + t.ws + ':' + t.folderRaw; if(!fD[lid]) fD[lid] = { id: lid, name: t.folderRaw, ws: t.ws, parent: null }; t.folder = lid; });
    this.foldersNow = fD;
    let cards = this._cards; if(dead.size){ cards = {}; Object.values(this._cards).forEach(c => { if(!dead.has(c.tree)) cards[c.id] = c; }); }
    this.cardsNow = cards; const all = Object.values(cards);
    this.wsNow = wsArr; this.treesNow = treesArr;
    const kids = {}; all.forEach(c => { const k = c.parent || ('root:' + c.tree); (kids[k] = kids[k] || []).push(c); }); Object.values(kids).forEach(l => l.sort((a, b) => (a.order - b.order) || (a.t - b.t)));
    const isNew = c => c.status === 'answered' && !c.seen;
    // round 2 §9: unseen (never on screen here) → seen, not read → read (synced)
    const isUnread = c => c.status === 'answered' && !c.read && !c.done;
    const isWait = c => c.status === 'waiting';
    const memo = {}; const st = this.statOf = id => { if(memo[id]) return memo[id]; memo[id] = { total: 0, open: 0, nw: 0, ur: 0 }; const r = memo[id]; (kids[id] || []).forEach(k => { const s = st(k.id); r.total += 1 + s.total; r.open += (k.done ? 0 : 1) + s.open; r.nw += (isNew(k) ? 1 : 0) + s.nw; r.ur += (isUnread(k) ? 1 : 0) + s.ur; }); return r; };
    const depthOf = id => { let d = 0, c = cards[id], g = 0; while(c && c.parent && g++ < 200){ d++; c = cards[c.parent]; } return d; };
    const pathOf = id => { const p = []; let c = cards[id], g = 0; while(c && g++ < 200){ p.unshift(c.id); c = c.parent ? cards[c.parent] : null; } return p; };
    const treeById = {}; treesArr.forEach(t => treeById[t.id] = t);
    // v2.31: a long paste no longer fills the screen: titles stop at 280 characters (1 Nov)
    const cap = (t, n) => { const a = [...String(t)]; return a.length > n ? a.slice(0, n).join('').trimEnd() + '…' : t; };
    const qOf = c => cap((c.quote ? (c.qHead || '(reply on the quoted part)') : '') || c.q || c.orig || c.raw || '(attachment)', 280); /* v2.72: his own words only; the quote shows apart */
    // status dots (round 2 §3)
    const dotFor = c => { const base = { width: '10px', height: '10px', borderRadius: '50%', flex: 'none', marginTop: '7px', boxSizing: 'border-box', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 700, lineHeight: 1 };
      if(c.status === 'waiting') return [Object.assign({}, base, { border: '2px dotted var(--acc)', background: 'var(--bg)', animation: 'qmPulse 1.4s ease-in-out infinite' }), ''];
      if(c.status === 'failed') return [Object.assign({}, base, { width: '16px', height: '16px', marginTop: '4px', background: 'var(--accInk)', color: 'var(--bg)' }), '!'];
      if(isNew(c)) return [Object.assign({}, base, { background: 'var(--acc)', boxShadow: '0 0 0 4px var(--newring)' }), ''];
      if(c.done) return [Object.assign({}, base, { width: '14px', height: '14px', marginTop: '5px', color: 'var(--upd)', fontSize: '13px', background: 'var(--bg)' }), '✓'];
      if(isUnread(c)) return [Object.assign({}, base, { width: '9px', height: '9px', marginTop: '7.5px', background: 'var(--acc)' }), ''];
      return [Object.assign({}, base, { width: '8px', height: '8px', marginTop: '8px', marginLeft: '1px', marginRight: '1px', border: '1.5px solid var(--line2)', background: 'var(--bg)' }), '']; };
    const sdot = (nw, ur) => nw ? { width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: 'var(--acc)', boxShadow: '0 0 0 3px var(--newring)' } : ur ? { width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: 'var(--acc)' } : null;
    // "3 unread · 1 new" (round 2 §9): unread in --ink 600, new in --accInk 700
    const cnt = (ur, nw, tail) => ({ hasUr: ur > 0, urText: ur + ' unread', hasNw: nw > 0, nwText: nw + ' new', nwSep: ur > 0 && nw > 0, tail: (ur || nw) ? (tail || '') : '' });
    const where = c => { const t = treeById[c.tree] || {}; const w = wsById[t.ws] || {}; return (wsArr.length > 1 ? w.name + ' › ' : '') + short(t.name || '', 36) + ' · level ' + (depthOf(c.id) + 1); };
    const tStats = tid => { const roots = kids['root:' + tid] || []; const r = { total: 0, open: 0, nw: 0, ur: 0 }; roots.forEach(k => { const s = st(k.id); r.total += 1 + s.total; r.open += (k.done ? 0 : 1) + s.open; r.nw += (isNew(k) ? 1 : 0) + s.nw; r.ur += (isUnread(k) ? 1 : 0) + s.ur; }); return r; };
    const curWsId = wsById[S.curWs] ? S.curWs : defWs; this.curWsId = curWsId;
    const curTree = treeById[S.curTree] && treeById[S.curTree].ws === curWsId ? treeById[S.curTree] : treesArr.filter(t => t.ws === curWsId).sort(byName)[0];
    const curWsO = wsById[curWsId] || wsArr[0] || { name: '' };
    const wsNew = {}, wsUr = {}; all.forEach(c => { const t = treeById[c.tree]; if(!t) return; if(isNew(c)) wsNew[t.ws] = (wsNew[t.ws] || 0) + 1; if(isUnread(c)) wsUr[t.ws] = (wsUr[t.ws] || 0) + 1; }); this.wsNewNow = wsNew; this.wsUrNow = wsUr;
    const wsHasNew = wsArr.some(w => w.id !== curWsId && (wsNew[w.id] || wsUr[w.id]));
    // review fix 4: the badge counts every workspace, so say where the other unread cards are
    const elseWs = wsArr.filter(w => w.id !== curWsId && wsUr[w.id]); const elseN = elseWs.reduce((n, w) => n + wsUr[w.id], 0);
    const elseLine = elseN ? elseN + ' unread in ' + (elseWs.length === 1 ? elseWs[0].name : elseWs.length + ' other workspaces') : '';
    // sidebar list: folders before trees, A–Z at every level, guide line per level
    const step = isPhone ? 19 : 24, off = isPhone ? 14 : 15;
    const guide = d => { const xs = []; for(let i = 0; i < d; i++) xs.push(off + i * step); return { indent: d * step + 'px', gImg: xs.length ? xs.map(() => 'linear-gradient(var(--line2),var(--line2))').join(',') : 'none', gPos: xs.length ? xs.map(x => x + 'px 0').join(',') : '0 0' }; };
    const childF = {}, childT = {}; Object.values(fD).filter(f => f.ws === curWsId).forEach(f => (childF[f.parent || ''] = childF[f.parent || ''] || []).push(f)); treesArr.filter(t => t.ws === curWsId).forEach(t => (childT[t.folder || ''] = childT[t.folder || ''] || []).push(t));
    const fAgg = fid => { const r = { nw: 0, ur: 0, trees: 0 }; (childT[fid] || []).forEach(t => { r.trees++; const q = tStats(t.id); r.nw += q.nw; r.ur += q.ur; }); (childF[fid] || []).forEach(f => { const s = fAgg(f.id); r.trees += s.trees; r.nw += s.nw; r.ur += s.ur; }); return r; };
    const drag = this.dragging; const dropProps = (target) => ({ onDragOver: e => { const d = this.dragging; if(!d || this.whyNot(d, target) || this.hereNow(d) === target) return; e.preventDefault(); const k = target || 'top'; if(this.state.dropOn !== k) this.setState({ dropOn: k }); }, onDragLeave: () => { if(this.state.dropOn === (target || 'top')) this.setState({ dropOn: null }); }, onDrop: e => { e.preventDefault(); const d = this.dragging; this.dragging = null; this.setState({ dropOn: null }); if(d) this.moveTo(d, target); } });
    const dragProps = item => ({ draggable: isPhone ? 'false' : 'true', onDragStart: e => { this.dragging = item; try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }catch(x){} }, onDragEnd: () => { this.dragging = null; if(this.state.dropOn) this.setState({ dropOn: null }); } });
    const navItems = [];
    const treeItem = (t, d) => { const s = tStats(t.id); const isCur = curTree && t.id === curTree.id && S.view !== 'inbox' && S.view !== 'trees'; return Object.assign({ isTree: true, isFolder: false, id: t.id, name: t.name, bg: isCur ? 'var(--sel)' : 'transparent', attn: s.total === 0 ? 'Empty' : (s.ur || s.nw) ? '' : (s.open ? s.open + ' open' : 'All done'), attnInk: 'var(--mute)', c: cnt(s.ur, s.nw, s.open ? ' · ' + s.open + ' open' : ''), onPick: () => this.pickTree(t.id), onMenu: e => this.treeMenuFor(e, t), outline: 'none' }, guide(d), dragProps({ kind: 'tree', id: t.id }), { onDragOver: null, onDragLeave: null, onDrop: null }); };
    const walkNav = (pid, d) => {
      (childF[pid] || []).sort(byName).forEach(f => { const shut = !!S.foldersShut[f.id]; const a = fAgg(f.id);
        navItems.push(Object.assign({ isFolder: true, isTree: false, id: f.id, name: f.name, glyph: shut ? '▸' : '▾', expanded: !shut, right: shut ? ((a.ur || a.nw) ? String(a.ur || a.nw) : a.trees + (a.trees === 1 ? ' tree' : ' trees')) : '', rightInk: (a.ur || a.nw) ? 'var(--ink)' : 'var(--mute)', rightW: (a.ur || a.nw) ? 600 : 400, hasFdot: shut && !!sdot(a.nw, a.ur), fdot: sdot(a.nw, a.ur) || {},
          outline: S.dropOn === f.id ? '1.5px solid var(--acc)' : 'none', onToggle: () => this.setState(x => ({ foldersShut: Object.assign({}, x.foldersShut, { [f.id]: !x.foldersShut[f.id] }) })), onMenu: e => this.folderMenu(e, f) }, guide(d), dragProps({ kind: 'folder', id: f.id }), dropProps(f.id)));
        if(!shut){ walkNav(f.id, d + 1); if(!(childF[f.id] || []).length && !(childT[f.id] || []).length) navItems.push(Object.assign({ isEmptyF: true, isFolder: false, isTree: false, id: 'ef:' + f.id }, guide(d + 1))); } });
      (childT[pid] || []).sort(byName).forEach(t => navItems.push(treeItem(t, d)));
    };
    walkNav('', 0);
    // inbox (v2.29, 1 Nov): only the current workspace; the subline and the workspace dot point to the others
    const inWs = c => (treeById[c.tree] || {}).ws === curWsId; const wsAll = all.filter(inWs);
    const answered = wsAll.filter(c => c.status === 'answered');
    const newMine = answered.filter(c => (isNew(c) || isUnread(c)) && c.origin === 'me').sort((a, b) => ((isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0)) || (b.tu - a.tu));
    const autoList = answered.filter(c => c.origin !== 'me' && !c.read && !c.done && (!c.parent || !cards[c.parent] || cards[c.parent].origin !== 'briefing' || isNew(c))).sort((a, b) => b.tu - a.tu);
    const newCount = answered.filter(isNew).length;
    const needs = []; wsAll.forEach(c => { if(c.done || c.read) return; c.drafts.forEach(d => { if(!d.sent) needs.push({ id: d.id, cid: c.id, title: 'Send to ' + (d.to || 'someone'), sub: qOf(c) + ' · ' + short((treeById[c.tree] || {}).name || '', 30), hasDraft: true, preview: d.text.replace(/\n/g, ' '), copyLabel: S.copied === d.id ? 'Copied ✓' : 'Copy', onCopy: () => this.copy(d.text, d.id), onOpen: () => this.jump(c.id), t: c.tu }); }); if(/needs (your go|attention)/.test(c.tag) && !c.drafts.some(d => !d.sent)) needs.push({ id: c.id, title: qOf(c), sub: c.tag + ' · ' + short((treeById[c.tree] || {}).name || '', 30), hasDraft: false, onOpen: () => this.jump(c.id), t: c.tu }); });
    needs.sort((a, b) => b.t - a.t);
    // Inbox count = new answers not yet seen + messages not yet sent, across all workspaces (round 2 §4)
    // v2.17 (round 2 §9): badge = unread answers + unsent messages; halo while any are unseen
    const unreadAll = answered.filter(isUnread).length;
    const inboxN = unreadAll + needs.filter(n => n.hasDraft).length; this.inboxN = all.filter(c => c.status === 'answered' && isUnread(c)).length + all.filter(c => !c.done && !c.read).reduce((n, c) => n + c.drafts.filter(d => !d.sent).length, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0); const cleared = wsAll.filter(c => c.done && c.doneAt >= today.getTime()).length; const openAll = wsAll.filter(c => !c.done).length; /* v2.45.1: same count as the tree rows (waiting cards are open too) */
    const lastT = treeById[S.lastTree] || null;
    const loading = S.status === 'loading' || (S.status === 'ok' && !S.loaded);
    const statusMsg = S.status === 'nohost' ? 'Open this map on claude.ai to load your questions.' : S.status === 'signedout' ? 'Sign in to claude.ai to load your questions.' : '';
    const noTrees = !all.length && treesArr.length <= 1 && S.loaded && S.view === 'inbox';
    const urN = answered.filter(c => isNew(c) || isUnread(c)).length;
    const headline = loading ? 'Loading your questions…' : statusMsg ? CFG.title : (urN || needs.length) ? [urN ? urN + ' unread' : '', needs.length ? needs.length + ' need' + (needs.length === 1 ? 's' : '') + ' you' : ''].filter(Boolean).join(', ') : 'All caught up';
    const inbox = { dateLabel: new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' }) + (wsArr.length > 1 ? ' · ' + curWsO.name : ''), headline, hasSubline: !!(urN || needs.length || statusMsg || elseLine), subline: statusMsg || [elseLine, autoList.length ? autoList.length + ' update' + (autoList.length > 1 ? 's' : '') + ' from the assistant' : ''].filter(Boolean).join(' · '), firstUse: noTrees && !statusMsg, newCount, hasNew: newCount > 0,
      showMeter: !!all.length, clearedText: cleared + ' card' + (cleared === 1 ? '' : 's') + ' cleared today · ' + openAll + ' open', clearedPct: Math.round(100 * cleared / Math.max(1, cleared + openAll)) + '%', showReadAll: newCount > 1,
      pinned: wsAll.filter(c => c.pinned).map(c => ({ cid: c.id, q: qOf(c), onOpen: () => this.jump(c.id) })),
      needs: needs.slice(0, 5), needsCount: needs.length, hasNeeds: needs.length > 0,
      newList: newMine.slice(0, 30).map(c => { const d = dotFor(c); return { cid: c.id, q: qOf(c), where: where(c) + ' · ' + ago(c.tu), dot: d[0], dotGlyph: d[1], onOpen: () => this.jump(c.id) }; }), newListCount: newMine.length, hasNewList: newMine.length > 0,
      auto: autoList.slice(0, 6).map(c => ({ cid: c.id, q: qOf(c), kind: c.origin === 'briefing' ? 'Briefing' : 'Update', where: short((treeById[c.tree] || {}).name || '', 36) + ' · ' + ago(c.tu) + (isNew(c) ? ' · new' : ''), onOpen: () => this.jump(c.id) })), autoCount: autoList.length, hasAuto: autoList.length > 0,
      caughtUp: !loading && !statusMsg && !!all.length && !newMine.length && !needs.length && !autoList.length, hasLast: !!lastT, lastName: lastT ? lastT.name : '' };
    inbox.hasPinned = inbox.pinned.length > 0; inbox.hasSubline = inbox.hasSubline && !!inbox.subline;
    // rows
    const rows = []; this.rowIds = []; const oc0 = S.openId && cards[S.openId];
    // round 2 §12: indent never stops (28px/level to L5, then 14px; phone 16 then 8), guide lines per parent, open path in --acc
    const openPath = new Set(S.openId && cards[S.openId] ? pathOf(S.openId) : []); let passedOpen = false;
    const stepA = isPhone ? 16 : 28, stepB = isPhone ? 8 : 14; const xAt = i => { let x = 0; for(let k = 1; k <= i; k++) x += k <= 4 ? stepA : stepB; return x; };
    // v2.33 round 2 §16: tab per tree = Open | New | All (stored in showAll: false | 'new' | true)
    const modeOf = t => { const v = (S.showAll || {})[t]; return v === 'new' ? 'new' : v === 'unread' ? 'unread' : v === 'waiting' ? 'waiting' : v ? 'all' : 'open'; }; /* v2.51: Waiting tab (asked, no answer yet) */ /* v2.48: Unread tab (answered, not marked read) */
    const tabMode = curTree ? modeOf(curTree.id) : 'open'; const flatTab = tabMode === 'new' || tabMode === 'unread' || tabMode === 'waiting'; const showAllNk = tabMode === 'all'; if(!flatTab || S.view === 'inbox' || (this.newKeep && this.newKeep.mode !== tabMode)) this.newKeep = null; const showAll = tabMode === 'all'; this.curTreeId = curTree ? curTree.id : null; const jd = this.justDone || {}; const nowT = Date.now();
    // §13 Done folding: in Open, fully-done cards (and their subtrees) fold into "✓ N done" stubs in place
    const foldable = (c, ignoreJd) => c.done && st(c.id).open === 0 && !openPath.has(c.id) && (ignoreJd || !(jd[c.id] > nowT));
    const stubHidden = new Set(); const predFold = {}; const stubOf = {};
    // v2.33 round 2 §15/§17: rows sit at x (px). anc = guide lines [{ id, x }] passing through the row.
    const half = isPhone ? 8 : 14; const colW = isPhone ? Math.max(280, (S.width || 360) - 16) : 760; const floorW = isPhone ? 220 : 360;
    const maxX = Math.max(stepA, Math.min((isPhone ? 4 : 8) * stepA, Math.floor((colW - 86 - floorW) / stepA) * stepA));
    const nk = id => showAllNk ? (kids[id] || []).length : (kids[id] || []).filter(k => !foldable(k)).length;
    const xPath = (fromId, toId) => { const p = pathOf(toId); const i = fromId ? p.indexOf(fromId) : 0; if(i < 0) return Infinity; let x = 0, th = false, ri = 0; for(let k = i; k < p.length - 1; k++){ if(nk(p[k]) >= 2){ x += stepA; th = false; ri = 0; } else if(th){} else if(ri < 3 && x + stepA <= 5 * stepA){ x += stepA; ri++; } else { x += half; th = true; } } return x; };
    // v2.40 §15: the deepest x any visible row would need when the list starts at fromId (same rules as xPath); re-root until it fits, so nothing is clamped
    const spanFrom = fromId => { let mx = 0; const stack = []; const top = fromId ? [fromId] : (kids['root:' + (curTree ? curTree.id : '')] || []).filter(k => showAllNk || !foldable(k)).map(k => k.id);
      top.forEach(id => stack.push([id, 0, false, 0])); let guard = 0;
      while(stack.length && guard++ < 20000){ const [id, x, th, ri] = stack.pop(); if(x > mx) mx = x; if(S.collapsed[id]) continue; const vk = (kids[id] || []).filter(k => showAllNk || !foldable(k)); if(!vk.length) continue;
        let nx, nth, nri; if(vk.length >= 2){ nx = x + stepA; nth = false; nri = 0; } else if(th){ nx = x; nth = true; nri = ri; } else if(ri < 3 && x + stepA <= 5 * stepA){ nx = x + stepA; nth = false; nri = ri + 1; } else { nx = x + half; nth = true; nri = ri; }
        vk.forEach(k => stack.push([k.id, nx, nth, nri])); } return mx; };
    this.rootAt = this.rootAt || {}; let rootId = null;
    if(curTree && !flatTab){ let R = this.rootAt[curTree.id]; if(R && (!cards[R] || cards[R].tree !== curTree.id)) R = null;
      if(oc0 && oc0.tree === curTree.id && this.rootSeenFor !== S.openId){ this.rootSeenFor = S.openId; const p = pathOf(oc0.id); R = null; if(spanFrom(null) > maxX){ R = p.length > 1 ? p[p.length - 2] : oc0.id; } /* v2.40 mock 9a: re-root on the open card's parent ("N levels above › L23") */ this.rootAt[curTree.id] = R; }
      rootId = R; }
    this.reRoot = id => { if(!curTree) return; this.rootAt[curTree.id] = id || null; this.rootSeenFor = S.openId; this.forceUpdate(); };
    const threadHidden = new Set(); const parentRow = {}; this.runKeyOf = {};
    if(curTree){ const rowFor = (c, d, anc, o) => { const s = st(c.id); const hk = (kids[c.id] || []).length > 0; const folded = hk && !!S.collapsed[c.id]; const dt = dotFor(c); const nw = isNew(c); const bOn = !!(S.bsel && curTree && S.bsel.tree === curTree.id); const bChk = bOn && !!S.bsel.ids[c.id]; const sel = bChk || (S.openId === c.id && !isPhone && !bOn); const unsent = c.drafts.filter(x => !x.sent).length;
      let meta, metaInk = 'var(--mute)', metaW = 400; let metaI = '';
      const upS = this.upState(c);
      if(upS === 'up'){ meta = 'Uploading files… ' + c.upl.ok + ' of ' + c.upl.n + ' · keep this tab open'; }
      else if(upS === 'stuck'){ meta = (c.upl.bad && c.upl.bad.length ? c.upl.bad.length + ' file' + (c.upl.bad.length > 1 ? 's' : '') + ' didn\'t upload' : 'Files didn\'t finish uploading') + ' · open to fix'; metaInk = 'var(--accInk)'; metaW = 600; }
      else if(c.status === 'waiting') meta = 'Waiting for the answer… · asked ' + ago(c.t);
      else if(c.status === 'failed'){ meta = 'Couldn\'t get an answer · Try again'; metaInk = 'var(--accInk)'; metaW = 600; }
      let strong = '';
      if(c.status === 'waiting' || c.status === 'failed'){}
      else if(nw){ meta = 'New answer · ' + ago(c.tu); metaInk = 'var(--accInk)'; metaW = 600; }
      else if(o.keepSeen){ meta = tabMode === 'unread' ? 'Read just now · stays until you leave Unread' : tabMode === 'waiting' ? 'Answered just now · stays until you leave Waiting' : 'Seen just now · stays until you leave New'; }
      else if(c.done){ meta = 'Done'; if(o.shownOpen){ meta = 'Done ·'; metaI = 'shown because you opened it'; } else if(o.inGrp && c.doneAt) meta = 'Done ' + ago(c.doneAt); }
      else if(isUnread(c)){ strong = 'Not read'; meta = '· answered ' + ago(c.tu); }
      else meta = 'Answered ' + ago(c.tu);
      if(hk && !metaI && !o.thread && !o.inNew && !o.inChain) meta += ' · ' + s.total + ' below'; /* v2.41: rows inside a shared-line chain don't repeat N below */
      if(o.thread > 1) meta += ' · thread of ' + o.thread; 
      // §15: "Update" / "Briefing" leads the meta line instead of tagging the title
      const isAuto = c.origin !== 'me'; const autoInk = nw ? 'var(--accInk)' : 'var(--upd)';
      const lyr = []; const addL = l => { const f = lyr.find(z => Math.abs(z.x - l.x) < 1); if(f){ f.acc = f.acc || l.acc; f.top = Math.min(f.top, l.top); } else lyr.push(l); };
      anc.forEach(a => addL({ x: a.x - 0.75, top: 0, acc: openPath.has(a.id) && a.id !== S.openId && !passedOpen }));
      if(o.ownLine != null && hk && !folded && !o.noKids) addL({ x: o.ownLine - 0.75, top: 30, acc: openPath.has(c.id) && c.id !== S.openId && !passedOpen });
      if(o.inNew) lyr.length = 0; /* v2.47 §21: New is a flat list, no connector lines */
      const gImg = lyr.length ? lyr.map(l => l.acc ? 'linear-gradient(color-mix(in oklab, var(--line2), var(--mute) 40%),color-mix(in oklab, var(--line2), var(--mute) 40%))' : 'linear-gradient(var(--line2),var(--line2))').join(',') : 'none';
      const gPos = lyr.map(l => l.x + 'px ' + l.top + 'px').join(',') || '0 0'; const gSize = lyr.map(l => '1.5px ' + (l.top ? 'calc(100% - ' + l.top + 'px)' : '100%')).join(',') || 'auto';
      const pc = c.parent && cards[c.parent]; const hov = S.hoverId === c.id && !!pc && S.openId !== c.id; const lp = S.lpId === c.id && !!pc;
      let hovExtra = ''; if(hov || lp){ if(threadHidden.has(c.parent)) hovExtra = '↑ in the folded run'; else if(this.hoverOff) hovExtra = '↑ ' + this.hoverOff + ' row' + (this.hoverOff === 1 ? '' : 's'); }
      /* v2.63 (7 Nov): the "reply to" hint REPLACES the row's own grey meta line (same spot, same height), so nothing below moves */
      const hovIn = hov && !isPhone; if(hovIn){ strong = ''; metaI = ''; meta = '↳ reply to L' + d + ' · ' + short(qOf(pc), 52); metaInk = 'var(--mute)'; metaW = 500; }
      const tagAcc = c.id === S.openId; /* v2.45 §19: only the open card's tag is accented; the path stays grey */
      const elbA = c.id === S.openId && c.parent && !o.inNew ? anc.find(a => a.id === c.parent) : null; const elbX = elbA ? elbA.x - 0.75 : 0;
      if(c.id === S.openId) passedOpen = true;
      const rowBg = sel ? 'var(--sel)' : nw ? 'var(--newbg)' : o.inGrp ? 'var(--soft)' : 'var(--bg)'; if(dt[0].background === 'var(--bg)') dt[0] = Object.assign({}, dt[0], { background: rowBg });
      rows.push({ isCard: !o.slim, isSlim: !!o.slim, hasMetaI: !!metaI, metaI, slimH: isPhone ? '44px' : '30px', grpBg: o.inGrp ? 'var(--soft)' : 'transparent', grpBorder: o.inGrp ? '1px dashed var(--line2)' : '0', grpTop: '0', grpRad: o.inGrp ? '0' : '12px', id: c.id, q: qOf(c), indent: o.x + 'px', gImg, gPos, gSize, showLevel: d >= 1,
        hasAutoM: isAuto, autoM: c.origin === 'briefing' ? 'Briefing' : 'Update', autoInk, dotRing: 'none', /* v2.52: the kept-row ring sits on the dot itself (outline), so it stays round */
        outline: (S.hoverId && parentRow[S.hoverId] === c.id) || S.flashId === c.id ? '1.5px solid var(--acc)' : 'none',
        hasHov: false, hovIn, metaCls: hovIn ? 'qm-hovin' : '', hasLp: lp && isPhone, hovText: pc ? '↳ reply to L' + d + ' · ' + short(qOf(pc), 60) : '', hasHovX: !!hovExtra, hovX: hovExtra, onHovGo: () => this.showParent(c.id),
        onEnter: () => { if(isPhone) return; clearTimeout(this.hovT); this.hovT = setTimeout(() => this.hoverRow(c.id), 600); }, onLeave: () => { clearTimeout(this.hovT); if(this.state.hoverId === c.id) this.setState({ hoverId: null }); },
        onLpParent: () => { this.setState({ lpId: null }); this.showParent(c.id); }, onLpOpen: () => { this.setState({ lpId: null }); this.jump(c.id); }, levelBorder: tagAcc ? 'var(--acc)' : 'var(--line2)', levelInk: tagAcc ? 'var(--accInk)' : 'var(--mute)', elbow: !!elbA, elbowX: elbX + 'px', elbowW: Math.max(8, o.x + 29 - elbX) + 'px', levelFs: isPhone ? '11px' : '12px', level: 'L' + (d + 1), dot: bOn ? { width: '18px', height: '18px', borderRadius: '50%', boxSizing: 'border-box', border: '2px solid ' + (bChk ? 'var(--accStrong)' : 'var(--line2)'), background: bChk ? 'var(--accStrong)' : 'transparent', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1, marginTop: '1px' } : o.keepSeen ? Object.assign({}, dt[0], { outline: '2px solid var(--line2)', outlineOffset: '2px' }) : dt[0], dotGlyph: bOn ? (bChk ? '✓' : '') : dt[1], openAria: bOn ? (bChk ? 'Selected: ' : 'Select: ') + short(qOf(c), 60) : '', isAuto: false, originLabel: c.origin === 'briefing' ? 'Briefing' : 'Update', qInk: c.done ? 'var(--mute)' : 'var(--ink)', hasTag: !!c.tag, tag: c.tag, meta, metaInk, metaW, hasStrong: !!strong, strong, pinned: c.pinned, newInside: folded && (s.nw > 0 || s.ur > 0), c: cnt(s.ur, s.nw, ' below'), hasDraft: unsent > 0 && !c.done, draftText: unsent > 1 ? unsent + ' drafts' : 'draft',
        newAttr: nw ? c.id : '', noKids: !hk || !!o.noKids, foldOp: hk && !o.noKids && !o.inChain ? 1 : 0, foldGlyph: hk && !o.noKids && !o.inChain ? (folded ? '▸' : '▾') : '', foldLabel: folded ? 'Unfold' : 'Fold', expanded: hk && !folded,
        tx: S.swiped === c.id ? '-96px' : '0px', fgBg: sel ? 'var(--sel)' : nw ? 'var(--newbg)' : o.inGrp ? 'var(--soft)' : 'var(--bg)',
        onSwipeDel: () => { this.setState({ swiped: null }); this.askDelete(c); },
        onTS: e => { clearTimeout(this.lpT); this.lpT = setTimeout(() => { if(!this.sw || !this.sw.drag){ this.cmFired = Date.now(); this.rowMenu(c.id); } }, 500); const t = e.touches && e.touches[0]; this.sw = t ? { id: c.id, el: e.currentTarget, x: t.clientX, y: t.clientY, base: this.state.swiped === c.id ? -96 : 0, drag: false, dx: 0 } : null; },
        onTM: e => { const w = this.sw, t = e.touches && e.touches[0]; if(!w || !t || w.id !== c.id) return; const mx = t.clientX - w.x, my = t.clientY - w.y;
          if(Math.abs(mx) > 6 || Math.abs(my) > 6) clearTimeout(this.lpT);
          if(!w.drag){ if(Math.abs(mx) < 8) return; if(Math.abs(mx) < Math.abs(my) * 1.2){ this.sw = null; return; } w.drag = true; w.el.style.transition = 'none'; }
          w.dx = Math.max(-w.el.offsetWidth, Math.min(0, w.base + mx)); w.el.style.transform = 'translateX(' + w.dx + 'px)'; },
        onTE: () => { clearTimeout(this.lpT); const w = this.sw; this.sw = null; if(!w || !w.drag || w.id !== c.id) return; w.el.style.transition = 'background .8s ease, transform .2s ease'; this.swipeAt = Date.now();
          if(w.dx < -w.el.offsetWidth * 0.55){ w.el.style.transform = 'translateX(-100%)'; setTimeout(() => { if(w.el) w.el.style.transform = 'translateX(0px)'; this.askDelete(c); }, 180); this.setState({ swiped: null }); return; }
          const open = w.dx < -44; w.el.style.transform = 'translateX(' + (open ? -96 : 0) + 'px)'; this.setState({ swiped: open ? c.id : (this.state.swiped === c.id ? null : this.state.swiped) }); },
        onFold: () => this.setState(x => ({ collapsed: Object.assign({}, x.collapsed, { [c.id]: !x.collapsed[c.id] }) })), onOpen: e => { if(this.state.bsel){ this.bulkTap(c.id, e); return; } if(Date.now() - (this.swipeAt || 0) < 400) return; if(this.state.lpId){ this.setState({ lpId: null }); return; } if(S.swiped){ this.setState({ swiped: null }); return; } this.jump(c.id); } }); this.rowIds.push(c.id);
      return hk && !folded && !o.noKids; };
      const guide = anc => { const layers = anc.map(a => ({ x: a.x - 0.75, acc: openPath.has(a.id) && a.id !== S.openId && !passedOpen })); return { gImg: layers.length ? layers.map(l => l.acc ? 'linear-gradient(color-mix(in oklab, var(--line2), var(--mute) 40%),color-mix(in oklab, var(--line2), var(--mute) 40%))' : 'linear-gradient(var(--line2),var(--line2))').join(',') : 'none', gPos: layers.map(l => l.x + 'px 0px').join(',') || '0 0', gSize: layers.map(() => '1.5px 100%').join(',') || 'auto' }; };
      const NO = { isEnd: false, isCard: false, isSlim: false, isTick: false, isMore: false, isCap: false, isRun: false, isPath: false };
      const endRow = (o, d, anc, x) => Object.assign({}, NO, { isEnd: true, id: 'end:' + o.key, indent: x + 'px', endH: isPhone ? '48px' : '34px', endTop: x === 0 && !o.shown ? '1px solid var(--line)' : '0', endInk: o.shown ? 'var(--accInk)' : 'var(--mute)', endW: o.shown ? 600 : 400, endGlyph: o.shown ? '' : '✓', endBold: o.shown ? '' : o.n + (o.more ? ' more done' : ' done'), endTail: o.shown ? '▴ Hide ' + o.n + ' done' : '▸', endTailFs: o.shown ? '14px' : '11px',
        onEnd: () => this.setState(x => ({ lvlShown: Object.assign({}, x.lvlShown, { [o.key]: !x.lvlShown[o.key] }) })) }, guide(anc));
      const tickRow = (key, d, anc, x) => Object.assign({}, NO, { isTick: true, id: 'tick:' + key, indent: x + 'px', tickH: isPhone ? '8px' : '10px', tickW: isPhone ? '14px' : '24px' }, guide(anc));
      const moreRow = (key, n, d, anc, x) => Object.assign({}, NO, { isMore: true, id: 'more:' + key, indent: x + 'px', moreText: '+ ' + n + ' more done here', onMore: () => this.setState(x => ({ runOpen: Object.assign({}, x.runOpen, { [key]: true }) })) }, guide(anc));
      // §14: one Done row per level, at the end; gutter ticks where Done cards sat; "show" puts them back in place as slim rows
      // v2.33 §15/§17: a card that is its parent's only reply is a thread reply: half-step inset, a connector, an end cap, long middles folded
      const capRow = (key, anc, x) => Object.assign({}, NO, { isCap: true, id: 'cap:' + key, indent: x + 'px', capX: (x - 0.75) + 'px', capW: (isPhone ? 9 : 10) + 'px', capH: isPhone ? '14px' : '16px' }, guide(anc.slice(0, -1)));
      const runRow = (key, a, b, n, anc, x) => Object.assign({}, NO, { isRun: true, id: 'run:' + key, indent: x + 'px', runText: 'L' + a + (a === b ? '' : '–L' + b) + ' · ' + n + (n === 1 ? ' reply' : ' replies') + ', folded', runX: (anc.length ? anc[anc.length - 1].x : x + 38) - 0.75 + 'px', onRun: () => this.setState(z => ({ thrOpen: Object.assign({}, z.thrOpen, { [key]: true }) })) }, guide(anc.slice(0, -1)));
      const clampX = x => Math.min(x, maxX);
      const walk = (list, d, anc, all, inGrp, x, ri) => { const rI = (all ? list : list.filter(k => !foldable(k))).length === 1 ? (ri || 0) : 0; const key = anc.length ? anc[anc.length - 1].id : 'root:' + curTree.id;
        if(all){ list.forEach(c => one(c, d, anc, true, false, x, rI)); return; }
        const shown = !!(S.lvlShown || {})[key]; let n = 0, odN = 0, moreFlag = false; let i = 0, seenVisible = false, gap = false;
        while(i < list.length){ const c = list[i];
          if(foldable(c)){ const grp = []; while(i < list.length && foldable(list[i])){ grp.push(list[i]); i++; }
            grp.forEach(g => { n += 1 + st(g.id).total; this.subIds(g.id).forEach(z => { if(!shown || z !== g.id) stubHidden.add(z); }); });
            if(shown){ const rk = key + ':' + grp[0].id; const all3 = grp.length <= 3 || (S.runOpen || {})[rk]; (all3 ? grp : grp.slice(0, 3)).forEach(g => { rowFor(g, d, anc, { slim: true, noKids: true, x }); });
              if(!all3){ grp.slice(3).forEach(g => stubHidden.add(g.id)); rows.push(moreRow(rk, grp.length - 3, d, anc, x)); } }
            else gap = true;
            continue; }
          if(c.done && c.id === S.openId && st(c.id).open === 0){ const od = 1 + st(c.id).total; n += od; odN += od; predFold[c.id] = n; }
          if(!all && jd[c.id] > nowT && foldable(c, true)){ let m = 0; list.forEach(z => { if(foldable(z) || z.id === c.id) m += 1 + st(z.id).total; }); predFold[c.id] = m; }
          if(gap && seenVisible) rows.push(tickRow(key + ':' + c.id, d, anc, x)); gap = false; seenVisible = true;
          one(c, d, anc, false, false, x, rI); i++; }
        // v2.39 §13 Case 2: while an opened Done card shows, the end row counts only the hidden ones and says "more"
        if(n) rows.push(endRow({ key, n: odN && n > odN && !shown ? n - odN : n, shown, more: !!(odN && n > odN && !shown) }, d, anc, x)); };
      const slimOf = (c, all) => !all && c.done && c.id !== S.openId && !(jd[c.id] > nowT);
      const one = (c, d, anc, all, inGrp, x, ri) => { const ks = kids[c.id] || []; ri = ri || 0; const vks = vkOf(c.id, all);
        const shownOpen = !all && c.done && c.id === S.openId && st(c.id).open === 0;
        // v2.36 §18: an only-reply indents a full step like any child; the shared-line thread starts at the 4th only-reply in a row, or when one more step would pass 5
        const fullOk = ri < 3 && x + stepA <= 5 * stepA;
        if(vks.length === 1 && !fullOk){ thread(c, d, anc, all, x, shownOpen); return; }
        const fx = clampX(x + stepA); const line = x + 38;
        if(rowFor(c, d, anc, { slim: slimOf(c, all), shownOpen, inGrp, x, ownLine: line })) walk(ks, d + 1, anc.concat({ id: c.id, x: line }), all, inGrp, fx, vks.length === 1 ? ri + 1 : 0); };
      const vkOf = (id, all) => all ? (kids[id] || []) : (kids[id] || []).filter(k => !foldable(k));
      // v2.37: a chain member's folded Done replies get their own "✓ N done" row right under it
      // v2.38 §18: Done replies of chain members fold into ONE "✓ N done" row after the chain's end cap (key 'ch:'+start)
      const hidDone = (m, dr, anc, x, all, ck) => { if(all) return 0; const hk = (kids[m.id] || []).filter(k => foldable(k)); if(!hk.length) return 0; const shownL = !!(S.lvlShown || {})[ck]; let n = 0;
        hk.forEach(k => { n += 1 + st(k.id).total; this.subIds(k.id).forEach(q => { if(!shownL || q !== k.id) stubHidden.add(q); }); if(shownL) rowFor(k, dr, anc, { slim: true, noKids: true, x }); });
        return n; };
      // thread: c starts it; replies sit at x + half, every one at the same inset
      const thread = (c, d, anc, all, x, shownOpen) => {
        const chain = []; let z = vkOf(c.id, all)[0]; while(z){ chain.push(z); const kz = vkOf(z.id, all); if(kz.length !== 1) break; z = kz[0]; }
        const rx = clampX(x + half); const line = x + 38; // v2.38 §18: the connector drops from the starter's dot; reply glyphs sit half a step right of it, beside the line
        const open = rowFor(c, d, anc, { slim: slimOf(c, all), shownOpen, x, ownLine: line, thread: chain.length });
        if(!open) return;
        const tAnc = anc.concat({ id: c.id, x: line }); const ck = 'ch:' + c.id; let chDone = hidDone(c, d + 1, tAnc, rx, all, ck);
        // which replies fold: threads longer than 4 fold their middle; never the open card, unread or new ones
        const tk = 'thr:' + c.id; const canFold = chain.length > 4 && !(S.thrOpen || {})[tk];
        const fold = new Set(); if(canFold) chain.forEach((r, i) => { if(i > 0 && i < chain.length - 1 && r.id !== S.openId && !isNew(r) && !isUnread(r) && !(all ? false : foldable(r))) fold.add(r.id); });
        // v2.40: a folded run must hold 2+ replies; folding one card saves nothing
        chain.forEach((r, i) => { if(fold.has(r.id) && !(chain[i - 1] && fold.has(chain[i - 1].id)) && !(chain[i + 1] && fold.has(chain[i + 1].id))) fold.delete(r.id); });
        let i = 0, endN = 0, endKey = null, openDoneN = 0; const lvlKey = c.id;
        while(i < chain.length){ const r = chain[i]; const dr = d + 1 + i;
          if(!all && foldable(r)){ // the rest of the thread is done: one Done row at the thread's inset
            const shownL = !!(S.lvlShown || {})[ck]; endN = 1 + st(r.id).total; chDone += endN; if(jd[r.id] > nowT) predFold[r.id] = endN;
            this.subIds(r.id).forEach(q => { if(!shownL || q !== r.id) stubHidden.add(q); });
            if(shownL) rowFor(r, dr, tAnc, { slim: true, noKids: true, x: rx });
            openDoneN = 0; i = chain.length; break; }
          if(fold.has(r.id)){ let j = i; while(j < chain.length && fold.has(chain[j].id)) j++; const run = chain.slice(i, j); run.forEach(q => threadHidden.add(q.id));
            run.forEach(q => { this.runKeyOf[q.id] = tk; if(!all) (kids[q.id] || []).filter(k => foldable(k)).forEach(k => this.subIds(k.id).forEach(y => stubHidden.add(y))); }); rows.push(runRow(tk, d + 2 + i, d + 1 + j, run.length, tAnc, rx)); i = j; continue; }
          const last = i === chain.length - 1; const kr = kids[r.id] || [];
          const so = !all && r.done && r.id === S.openId && st(r.id).open === 0; if(so){ openDoneN = 1 + st(r.id).total; predFold[r.id] = openDoneN; }
          if(!last){ if(rowFor(r, dr, tAnc, { slim: slimOf(r, all), shownOpen: so, x: rx, inChain: true })) { chDone += hidDone(r, dr + 1, tAnc, rx, all, ck); i++; continue; } else { i = chain.length; break; } }
          // last reply: 0 kids, or a fork of 2+
          const fx = clampX(rx + stepA); const fl = rx + 38;
          if(rowFor(r, dr, tAnc, { slim: slimOf(r, all), shownOpen: so, x: rx, ownLine: kr.length ? fl : null })) walk(kr, dr + 1, tAnc.concat({ id: r.id, x: fl }), all, false, fx);
          i++; }
        rows.push(capRow(c.id, tAnc, line));
        const chN = chDone + openDoneN; if(chN){ Object.keys(predFold).forEach(k => { if(chain.some(r => r.id === k)) predFold[k] = chN; }); const chS = !!(S.lvlShown || {})[ck]; const mo = !!(openDoneN && chDone && !chS); rows.push(endRow({ key: ck, n: mo ? chDone : chN, shown: chS, more: mo }, d + 1, anc, x)); } };
      all.forEach(c => { parentRow[c.id] = c.parent; });
      // §16 New tab: cards with an unseen answer, grouped by parent, newest first; cards seen here stay until you leave New
      const newList = () => { const inList = tabMode === 'unread' ? isUnread : tabMode === 'waiting' ? isWait : isNew; const keepOk = this.newKeep && this.newKeep.tree === curTree.id && this.newKeep.mode === tabMode; const keep = keepOk ? this.newKeep.ids : new Set();
        const list = all.filter(c => c.tree === curTree.id && (inList(c) || keep.has(c.id)));
        this.newKeep = { tree: curTree.id, mode: tabMode, ids: new Set(list.map(c => c.id)) };
        const groups = {}; list.forEach(c => { const k = c.parent || ''; (groups[k] = groups[k] || []).push(c); });
        const gl = Object.keys(groups).map(k => ({ k, cs: groups[k].sort((a, b) => b.tu - a.tu) })).sort((a, b) => b.cs[0].tu - a.cs[0].tu);
        const order = [];
        gl.forEach(g => { let pathT = 'Top level'; if(g.k){ const p = pathOf(g.k); const cr = p.map((id, i) => 'L' + (i + 1) + ' ' + short(qOf(cards[id]), 40)); pathT = cr.length > 3 ? cr[0] + ' › … › ' + cr[cr.length - 1] : cr.join(' › '); }
          rows.push(Object.assign({}, NO, { isPath: true, id: 'path:' + g.k, pathText: pathT }));
          const anc = g.k ? [{ id: g.k, x: 14 }] : []; const x = g.k ? 0 : 0;
          g.cs.forEach(c => { order.push(c.id); rowFor(c, depthOf(c.id), anc, { x: g.k ? 4 : 0, noKids: true, inNew: true, keepSeen: !inList(c) }); }); });
        this.newOrder = order; this.newEmpty = !list.length; };
      this.newOrder = null; this.newEmpty = false;
      const tsx = tStats(curTree.id); const openInTree = !!(oc0 && oc0.tree === curTree.id);
      if(flatTab) newList();
      else if(rootId && cards[rootId]){ const R = cards[rootId]; one(R, depthOf(R.id), [], showAll, false, 0); }
      else if(showAll || tsx.open > 0 || openInTree) walk(kids['root:' + curTree.id] || [], 0, [], showAll, false, 0); }
    this.predFold = predFold; this.stubHidden = stubHidden; this.threadHidden = threadHidden;
    const ts = curTree ? tStats(curTree.id) : { total: 0, open: 0, nw: 0 }; const waitN = curTree ? all.filter(c => c.tree === curTree.id && c.status === 'waiting').length : 0;
    // reader
    const oc = S.openId && cards[S.openId]; let rd = { rail: { show: false, notches: [] }, trail: [] };
    if(oc){ const path = pathOf(oc.id); const d = path.length; const s = st(oc.id); const ch = kids[oc.id] || [];
      const mk = L => { const id = path[L - 1]; const cur = L === d; return { label: String(L), aria: 'Level ' + L + ': ' + qOf(cards[id]), onGo: () => this.jump(id), border: cur ? 'var(--inv)' : 'var(--line2)', bg: cur ? 'var(--inv)' : 'transparent', ink: cur ? 'var(--invInk)' : 'var(--mute)' }; };
      let trail = []; if(d <= 6 || S.trailOpen){ for(let L = 1; L <= d; L++) trail.push(mk(L)); } else { trail = [mk(1), { label: '···', aria: 'Show all ' + d + ' levels', onGo: e => this.ancestorMenu(e, oc.id, 'open'), border: 'var(--line2)', bg: 'transparent', ink: 'var(--mute)' }, mk(d - 3), mk(d - 2), mk(d - 1), mk(d)]; }
      const allT = []; const wd = (id, lv) => { allT.push({ id, lv }); (kids[id] || []).forEach(k => wd(k.id, lv + 1)); }; wd(path[0], 1); const max = Math.max(...allT.map(x => x.lv)); const sub = new Set(this.subIds(oc.id));
      // round 2 §12: levels below the open card show as dashed chips (--mute); a tap opens the first card at that level below it, else in the tree
      trail.forEach(t => { t.bs = 'solid'; }); const belowL = []; for(let L = d + 1; L <= max; L++) belowL.push(L);
      const mkB = L => { const at = allT.filter(x => x.lv === L); const tg = (at.find(x => sub.has(x.id)) || at[0]); return { label: String(L), aria: 'Level ' + L + ' (below this card)', onGo: () => tg && this.jump(tg.id), border: 'var(--line2)', bg: 'transparent', ink: 'var(--mute)', bs: 'dashed' }; };
      (belowL.length <= 3 ? belowL : [belowL[0], belowL[1], null, belowL[belowL.length - 1]]).forEach(L => trail.push(L == null ? { label: '···', aria: 'More levels below', onGo: () => {}, border: 'var(--line2)', bg: 'transparent', ink: 'var(--mute)', bs: 'dashed' } : mkB(L)));
      const notches = []; let above = null, below = null;
      if(max >= 2){ for(let L = 1; L <= max; L++){ const atL = allT.filter(x => x.lv === L); const newAt = atL.filter(x => x.id !== oc.id && isNew(cards[x.id])); const lit = newAt.length > 0; const kind = L === d ? 'cur' : L < d ? 'path' : atL.some(x => sub.has(x.id)) ? 'below' : 'other'; const tgt = lit ? (newAt.find(x => sub.has(x.id)) || newAt[0]).id : kind === 'path' ? path[L - 1] : (atL.find(x => sub.has(x.id)) || atL[0]).id;
        if(lit && L < d && !above) above = { L, id: tgt, n: newAt.length }; if(lit && L > d && sub.has(tgt) && !below) below = { L, id: tgt };
        const showNum = L === d || L === 1 || L % 5 === 0; notches.push({ num: L, showNum, showBar: !showNum, title: 'Level ' + L + (lit ? ' · ' + newAt.length + ' new' : '') + (L === d ? ' · you are here' : ''), onGo: () => this.jump(tgt), ink: L === d ? 'var(--invInk)' : lit ? '#fff' : 'var(--mute)', bg: L === d ? 'var(--inv)' : lit ? 'var(--accStrong)' : 'transparent', color: lit ? 'var(--acc)' : kind === 'path' ? 'var(--mute)' : kind === 'below' ? 'var(--line2)' : 'var(--line)', w: lit ? '16px' : kind === 'path' ? '12px' : '8px', h: lit ? '5px' : '2px' }); } }
      if(!this.diffFor || this.diffFor.id !== oc.id) this.diffFor = { id: oc.id, base: null, hide: false }; if(this.diffFor.base == null && oc.readA != null && oc.readA !== oc.a && oc.status === 'answered') this.diffFor.base = oc.readA;
      const dfx = this.diffFor.base != null && !this.diffFor.hide ? diffLines(this.diffFor.base, oc.a) : null; const hasDf = this.diffFor.base != null && (this.diffFor.hide || (dfx && dfx.n > 0));
      const blocks = oc.status === 'answered' ? (dfx && dfx.n ? parseA(dfx.text, dfx.kinds) : parseA(oc.a)) : [];
      { const IW = { small: '240px', medium: '440px', full: '100%' }; const ims = [];
        const srcOf = b => { const v = b.src; if(/^img:/.test(v)) return oc.imgs[v.slice(4)] || ''; const fm = v.match(/^file:(\d+)$/); if(fm){ const f = oc.files[Number(fm[1]) - 1]; return f && f.isImg ? f.url : ''; } return /^(https:\/\/|data:image\/)/.test(v) ? v : ''; };
        blocks.forEach(b => { if(!b.isImg) return; const u = srcOf(b); if(!u){ Object.assign(b, { isImg: false, isBody: true, segs: [{ t: '[image not available: ' + (b.alt || b.src) + ']', i: true, b: false, c: false, l: false, n: false, x: false, href: '' }] }); return; }
          const k = ims.length; ims.push({ name: b.alt || 'Image', url: u, isImg: true, type: 'image/*' }); Object.assign(b, { src: u, imgW: IW[b.size] || IW.medium, hasCap: !!b.alt, onImg: () => this.setState({ lb: { items: ims, i: k } }) }); }); }
      if(hasDf) blocks.unshift(Object.assign(parseA('x')[0], { isBody: false, isChgNote: true, chgText: this.diffFor.hide ? 'This answer changed since you read it.' : 'Changed since you read it: green = new, struck through = removed.', chgBtn: this.diffFor.hide ? 'Show changes' : 'Hide changes', onChg: () => { this.diffFor.hide = !this.diffFor.hide; this.forceUpdate(); } })); const linked = all.filter(c => c.links.some(l => l.to === oc.id));
      const links = oc.links.filter(l => cards[l.to]).map(l => ({ cid: l.to, label: l.type === 'dup' ? 'Already answered here' : 'I recommend reading', title: qOf(cards[l.to]), where: (l.note ? l.note + ' · ' : '') + where(cards[l.to]), onGo: () => this.jump(l.to) })).concat(linked.map(c => ({ label: 'Linked from', title: qOf(c), where: where(c), onGo: () => this.jump(c.id) })));
      const order = []; const wo = list => list.forEach(c => { order.push(c.id); wo(kids[c.id] || []); }); wo(kids['root:' + oc.tree] || []); if(!showAll && oc.tree === (curTree && curTree.id)){ const keep = order.filter(id => id === oc.id || !stubHidden.has(id)); order.length = 0; keep.forEach(x => order.push(x)); }
      if(oc.tree === (curTree && curTree.id)){ const keep = order.filter(id => id === oc.id || !threadHidden.has(id)); order.length = 0; keep.forEach(x => order.push(x)); }
      if(flatTab && this.newOrder && this.newOrder.includes(oc.id)){ order.length = 0; this.newOrder.forEach(x => order.push(x)); } this.orderNow = order;
      const oi = order.indexOf(oc.id); const prevC = oi > 0 ? cards[order[oi - 1]] : null; const nextC = oi >= 0 && oi < order.length - 1 ? cards[order[oi + 1]] : null;
      const stateHint = c => isNew(c) ? '• New answer' : isUnread(c) ? '• Not read' : c.status === 'waiting' ? '• Waiting' : c.status === 'failed' ? '• Not sent' : '';
      const dO = depthOf(oc.id);
      const endB = (c, isNext) => { if(!c) return { has: false }; const dc = depthOf(c.id); const rel = isNext ? (c.parent === oc.id ? 'Follow-up' : dc < dO ? 'Back to level ' + (dc + 1) : '') : (c.id === oc.parent ? 'Up a level' : dc > dO ? 'Level ' + (dc + 1) : dc < dO ? 'Level ' + (dc + 1) : ''); const hint = [rel, stateHint(c)].filter(Boolean).join(' · '); return { has: true, label: isNext ? 'NEXT ›' : '‹ PREVIOUS', align: isNext && !isPhone ? 'right' : 'left', ai: isNext && !isPhone ? 'flex-end' : 'flex-start', title: qOf(c), hasHint: !!hint, hint, hintInk: isNew(c) || isUnread(c) ? 'var(--accInk)' : 'var(--mute)', onGo: () => this.jump(c.id) }; };
      const urLeft = order.filter(id => id !== oc.id && isUnread(cards[id])).length;
      const navBtn = on => ({ op: on ? 1 : .35, dis: !on });
      const unsent = oc.drafts.filter(x => !x.sent).length; const moreNew = newCount - (isNew(oc) ? 1 : 0);
      // action bar: Done is the only dark button; after Done it becomes "Next new answer →" while new answers remain
      let pLabel = 'Done ✓', pGo = () => this.markDone(oc.id), pOut = false;
      if(oc.doneBy){ pLabel = 'Branch done ›'; pGo = () => this.jump(oc.doneBy); pOut = true; }
      else if(oc.done && urLeft > 0){ pLabel = 'Next unread (' + urLeft + ') →'; pGo = () => this.nextUnread(); }
      else if(oc.resolved){ pLabel = 'Reopen'; pOut = true; pGo = () => this.w(oc.id, { resolved: false }); }
      const ansAgo = oc.status === 'answered' ? ' · Answered ' + ago(oc.tu) : '';
      const inF = !isPhone && !!S.focus;
      rd = { rail: { show: isPhone && notches.length > 1, notches }, trail, showTrail: !isPhone && d > 1 && !inF, inlineTrail: inF && d > 1, inFocus: inF, focusLabel: inF ? '⤡ Exit focus' : '⤢ Focus', focusTitle: inF ? 'Leave focus (F or Esc)' : 'Read this card in focus (F)', focusBorder: inF ? '1.5px solid var(--acc)' : '1px solid var(--line2)',
        headPad: inF ? '0 16px 0 28px' : '12px 12px 2px 20px', headH: inF ? '60px' : '0px', headBorder: inF ? '1px solid var(--line)' : '0', artW: inF ? '720px' : '640px', artPad: inF ? '40px 28px 40px' : '14px 20px 32px', titleFs: inF ? '34px' : '27px', bodyFs: inF ? '17.5px' : '17px', bodyLh: inF ? '1.65' : '1.55', hasNextNew: false, hasNextUr: urLeft > 0 && !oc.done, nextUrText: 'Next unread (' + urLeft + ') →', showCopyBtn: !isPhone || !(urLeft > 0 && !oc.done), posText: (() => { if(showAll || tabMode === 'new') return (oi + 1) + ' of ' + order.length; const op = order.filter(id => !cards[id].done); return oc.done ? 'Done · ' + op.length + ' open' : (op.indexOf(oc.id) + 1) + ' of ' + op.length; })(), hasPos: order.length > 1, pv: navBtn(oi > 0), nx: navBtn(oi < order.length - 1), goPrev: () => this.step(-1), goNext: () => this.step(1), prevB: endB(prevC, false), nextB: endB(nextC, true), hasEnds: !!(prevC || nextC), endsDir: isPhone ? 'column-reverse' : 'row', hasParent: !!oc.parent, parentLine: oc.parent ? (d - 1) + ' · ' + qOf(cards[oc.parent]) : '', parentGo: () => oc.parent && this.jump(oc.parent),
        hasAbove: !!above, aboveText: above ? (above.n > 1 ? above.n + ' new answers' : 'New answer') + ' at level ' + above.L + ' · Jump' : '', aboveGo: () => above && this.jump(above.id), hasBelow: !!below, belowText: below ? 'New answer below, at level ' + below.L + ' · Jump' : '', belowGo: () => below && this.jump(below.id),
        levelText: 'LEVEL ' + d + ' OF ' + max, isDoneCard: !!oc.done, isAuto: oc.origin !== 'me', originLabel: oc.origin === 'briefing' ? 'Briefing' : 'Update from your work', hasTag: !!oc.tag, tag: oc.tag, changed: oc.changed, pinned: oc.pinned,
        hasTagRow: oc.origin !== 'me' || !!oc.tag || oc.changed || oc.pinned,
        q: oc.quote ? qOf(oc) : oc.status === 'answered' ? qOf(oc) : '“' + cap(oc.raw || oc.q || '', 280) + '”', hasQuote: !!oc.quote, quoteText: cap(oc.quote || '', 600), hasGone: !!(S.hlGone && S.hlGone.cid === oc.id && !S.hlOff), goneText: S.hlGone && S.hlGone.cid === oc.id ? 'Replies on removed text (' + S.hlGone.ids.length + ')' : '', onGone: () => this.hlGoneOpen(), hasOrig: oc.status === 'answered' && !!oc.orig && !oc.quote, orig: (S.origOpen[oc.id] || [...(oc.orig || '')].length <= 400) ? oc.orig : cap(oc.orig, 300), origLong: [...(oc.orig || '')].length > 400, origMoreLabel: S.origOpen[oc.id] ? 'Show less' : 'Show all (' + String(oc.orig || '').split(/\s+/).filter(Boolean).length.toLocaleString() + ' words)', toggleOrig: () => this.setState(x => ({ origOpen: Object.assign({}, x.origOpen, { [oc.id]: !x.origOpen[oc.id] }) })), compareOn: !!S.compare[oc.id], cmpLabel: S.compare[oc.id] ? 'Hide comparison' : 'Compare the two versions', cmpSegs: diffSegs(oc.q || '', oc.orig || ''), onCompare: () => this.setState(x => ({ compare: Object.assign({}, x.compare, { [oc.id]: !x.compare[oc.id] }) })),
        timeText: oc.t ? ((oc.origin === 'me' ? 'Asked ' : 'Arrived ') + ago(oc.t) + ansAgo) : (oc.tu ? 'Updated ' + ago(oc.tu) : ''),
        isWaiting: oc.status === 'waiting' && !this.upState(oc), isFailed: oc.status === 'failed' || this.upState(oc) === 'stuck', failText: this.upState(oc) === 'stuck' ? this.stuckText(oc) : oc.a || 'Your question is saved on this card.',
        isUploading: this.upState(oc) === 'up', upText: oc.upl ? 'Uploading your files: ' + oc.upl.ok + ' of ' + oc.upl.n + ' done. I\'ll send the question as soon as they\'re in. Keep this tab open until then.' : '',
        failHead: this.upState(oc) === 'stuck' ? (oc.upl.bad && oc.upl.bad.length ? 'Not sent yet: ' + oc.upl.bad.join(', ') + (oc.upl.bad.length > 1 ? ' didn\'t upload.' : ' didn\'t upload.') : 'Not sent yet: the files didn\'t finish uploading.') : 'Couldn\'t send this question.', onRetry: () => this.retry(oc), onDelete: () => this.delWithUndo(oc.id), answered: oc.status === 'answered',
        blocks, hasFiles: oc.files.length > 0, files: oc.files.map((f, i) => ({ name: f.name, ext: extOf(f.name), url: f.url, isImg: f.isImg, notImg: !f.isImg, bg: 'url("' + f.url + '")', onOpen: () => this.setState({ lb: { cid: oc.id, i } }) })),
        hasDrafts: oc.drafts.length > 0, draftHead: oc.drafts.length > 1 ? 'MESSAGES TO SEND · ' + unsent + ' OF ' + oc.drafts.length + ' LEFT' : 'MESSAGE TO SEND',
        drafts: oc.drafts.map(dr => ({ isCancelled: dr.cancelled, deco: dr.cancelled ? 'line-through' : 'none', cancelWhy: dr.why || 'Claude replaced this draft.', hasUseIn: !!(dr.cancelled && dr.useIn && this.state.nodes[dr.useIn]), useInLabel: dr.useIn && this.state.nodes[dr.useIn] ? 'Open the draft to send: ' + short(this.state.nodes[dr.useIn].q || '', 60) : '', onUseIn: () => { if(dr.useIn) this.jump(dr.useIn); }, hasOk: !dr.cancelled && /^\u2705/.test(dr.label || ''), head: (dr.cancelled ? 'DON\u2019T SEND · ' : '') + String(dr.label || 'Message to send').replace(/^\u2705\s*/, '') + ' · to ' + (dr.to || 'someone'), hasSub: !!dr.re, sub: dr.re ? (/^new message/i.test(dr.re) ? 'New message, not a reply' : 'Replying to ' + dr.re) : '', to: dr.to || 'Someone', re: dr.re, hasRe: !!dr.re, label: dr.label, hasLabel: !!dr.label, text: dr.text, op: dr.cancelled ? .75 : dr.sent ? .6 : 1, copyLabel: dr.cancelled ? 'Cancelled' : S.copied === dr.id ? 'Copied ✓' : 'Copy', sentLabel: dr.cancelled ? 'Don\u2019t send' : dr.sent ? 'Sent ✓' : 'Mark sent', onCopy: () => { if(!dr.cancelled) this.copy(dr.text, dr.id); }, onSent: () => { if(!dr.cancelled) this.setSent(oc.id, dr.idx, !dr.sent); }, hasOld: false, oldLabel: '', showOld: false, oldText: '', oldReason: '', onToggleOld: () => {} })),
        hasLinks: links.length > 0, links, hasKids: ch.length > 0, kidHead: 'FOLLOW-UPS · ' + ch.length + (s.nw ? ' · ' + s.nw + ' NEW' : ''),
        kids: ch.map(k => { const ks = st(k.id); const dt = dotFor(k); return { cid: k.id, q: (k.origin !== 'me' ? (k.origin === 'briefing' ? 'Briefing: ' : 'Update: ') : '') + qOf(k), qInk: k.done ? 'var(--mute)' : 'var(--ink)', dot: dt[0], dotGlyph: dt[1], meta: (kids[k.id] || []).length ? ks.total + ' below · ' + (ks.open ? ks.open + ' open' : 'all done') : (k.status === 'waiting' ? 'waiting…' : ago(k.tu)), newInside: ks.nw > 0 || ks.ur > 0, c: cnt(ks.ur, ks.nw, ' inside'), hasStrong: !(kids[k.id] || []).length && isUnread(k) && !isNew(k), pinned: k.pinned, onGo: () => this.jump(k.id) }; }),
        hasBar: oc.status === 'answered', pLabel, onPrimary: pGo, pBg: pOut ? 'transparent' : 'var(--inv)', pInk: pOut ? (oc.done && pLabel !== 'Reopen' ? 'var(--upd)' : 'var(--ink)') : 'var(--invInk)', pBorder: pOut ? '1px solid var(--line2)' : '1px solid var(--inv)', pFlex: isPhone ? '1 1 0' : 'none',
        copyLabel: S.copied === 'ans:' + oc.id ? 'Copied ✓' : 'Copy', onCopy: () => this.copy(oc.a || '', 'ans:' + oc.id), onMore: e => this.cardMenu(e, oc), moreNewText: moreNew > 0 ? moreNew + ' more new' : '',
        newAttr: isNew(oc) ? oc.id : '' }; }
    // toast
    let toast = null; if(S.toast){ const t = S.toast; if(t.kind === 'done' && t.foldId && predFold[t.foldId] && !/^Branch/.test(t.text || '')) t.text = 'Done · moved to ✓ ' + predFold[t.foldId] + ' done below';
      if(t.kind === 'new'){ const live = t.ids.filter(i => cards[i] && isNew(cards[i])); if(live.length){ const c = cards[live[0]]; toast = { icon: '●', iconInk: 'var(--acc)', text: live.length > 1 ? live.length + ' new answers just arrived' : 'New in ' + short((treeById[c.tree] || {}).name || '', 28) + ': ' + short(qOf(c), 40), hasAction: true, action: live.length > 1 ? 'Read in order' : 'Show', onAction: () => { this.setState({ toast: null }); live.length > 1 ? this.nextNew() : this.jump(c.id); }, onClose: () => this.setState({ toast: null }) }; } } else toast = { icon: t.icon || '✓', iconInk: t.icon === '!' ? 'var(--accInk)' : 'var(--upd)', text: t.foldId && (this.predFold || {})[t.foldId] ? 'Done · moved to ✓ ' + this.predFold[t.foldId] + ' done below' : t.text, hasAction: !!t.action, action: t.action, onAction: t.onAction, onClose: () => this.setState({ toast: null }) }; }
    // sheet
    const fq = (o, q) => !q ? o : o.filter(a => (a.label + ' ' + (a.sub || '')).toLowerCase().includes(q.toLowerCase()));
    let sheet = null; if(S.sheet){ const k = S.sheet.kind; sheet = { title: S.sheet.title || '', hasNote: !!S.sheet.note, note: S.sheet.note, isName: k === 'name', isSearch: k === 'search', isTheme: k === 'settings', hasActions: k === 'actions' || k === 'settings', isMove: k === 'move', hasBtns: k === 'confirm',
      actions: this.items(S.sheet.filter ? fq(S.sheet.actions || [], S.sheet.fq) : S.sheet.actions), hasFilter: !!S.sheet.filter, filterPh: S.sheet.filter || '', fq: S.sheet.fq || '', onFq: e => { const v = e.target.value; this.setState(x => ({ sheet: x.sheet ? Object.assign({}, x.sheet, { fq: v }) : null })); },
      btns: (S.sheet.btns || []).map(b => ({ label: b.label, bg: b.danger ? 'var(--del)' : 'transparent', ink: b.danger ? '#fff' : 'var(--ink)', border: b.danger ? '1px solid var(--del)' : '1px solid var(--line2)', onGo: () => { this.setState({ sheet: null }); b.onGo && b.onGo(); } })),
      val: S.sheet.val, onInput: e => { const v = e.target.value; this.setState(x => ({ sheet: Object.assign({}, x.sheet, { val: v }) })); }, onSave: () => { const v = (this.state.sheet.val || '').trim(); if(!v) return; const f = this.state.sheet.save; this.setState({ sheet: null }); f(v); }, onKey: e => { if(e.key === 'Enter'){ e.preventDefault(); sheet.onSave(); } } };
      if(k === 'move'){ const item = S.sheet.item; const ws = item.kind === 'tree' ? (treeById[item.id] || {}).ws : (fD[item.id] || {}).ws; const nm = item.kind === 'tree' ? (treeById[item.id] || {}).name : (fD[item.id] || {}).name;
        const here = this.hereNow(item); const sel = S.sheet.sel; const wsName = (wsById[ws] || {}).name || 'Workspace'; const targets = [];
        const add = (id, name, d) => { const why = this.whyNot(item, id); const isHere = here === id; const dis = !!why || isHere; const isSel = sel === id && !dis; targets.push({ name, pad: (12 + d * 12) + 'px', weight: d === 0 ? 600 : 400, ink: dis && d > 0 ? 'var(--mute)' : 'var(--ink)', right: why || (isHere ? 'Here now' : ''), disabled: dis, isSel, bg: isSel ? 'var(--sel)' : 'transparent', onPick: () => { if(!dis) this.setState(x => ({ sheet: Object.assign({}, x.sheet, { sel: id }) })); } }); };
        add(null, wsName + ' (top level)', 0);
        const cf = {}; Object.values(fD).filter(f => f.ws === ws).forEach(f => (cf[f.parent || ''] = cf[f.parent || ''] || []).push(f));
        const wf = (pid, d) => (cf[pid] || []).sort(byName).forEach(f => { add(f.id, f.name, d); wf(f.id, d + 1); }); wf('', 1);
        const hasSel = sel !== undefined && targets.some(t => t.isSel); const selName = sel ? (fD[sel] || {}).name || '' : wsName; const selDeep = sel ? this.fDepth(sel) >= MAXF : false;
        Object.assign(sheet, { title: 'Move "' + short(nm || '', 30) + '" to…', targets, newFolderLabel: '+ New folder in ' + short(selName, 28) + (sel ? '' : ' (top level)'), cantNewFolder: selDeep, newFolderOp: selDeep ? .5 : 1,
          onNewFolder: () => { if(selDeep) return; this.askName('New folder in ' + short(selName, 30), '', async v => { const id = await this.createFolder(ws, sel || null, v); this.setState({ sheet: { kind: 'move', item, sel: id || sel } }); }); },
          confirmLabel: isPhone ? (hasSel ? 'Move to ' + short(selName, 24) : 'Pick a place') : 'Move here', cantConfirm: !hasSel, confirmOp: hasSel ? 1 : .45, onConfirm: () => { if(!hasSel) return; this.setState({ sheet: null }); this.moveTo(item, sel); } }); }
    }
    const pop = S.pop ? { left: S.pop.left + 'px', top: S.pop.top == null ? 'auto' : S.pop.top + 'px', bottom: S.pop.bottom == null ? 'auto' : S.pop.bottom + 'px', w: S.pop.w + 'px', maxH: S.pop.maxH || '72%', actions: this.items(fq(S.pop.actions, S.pop.fq)),
      hasFilter: !!S.pop.filter, filterPh: S.pop.filter || '', fq: S.pop.fq || '', onFq: e => { const v = e.target.value; this.setState(x => ({ pop: x.pop ? Object.assign({}, x.pop, { fq: v }) : null })); } } : null;
    const q = S.query.trim().toLowerCase(); let results = []; if(q.length >= 2){ all.forEach(c => { const hay = [c.q, c.orig, plain(c.a), ...c.drafts.map(d => d.text + ' ' + d.to)].join(' • '); const i = hay.toLowerCase().indexOf(q); if(i < 0) return; results.push({ cid: c.id, q: qOf(c), snippet: (i > 30 ? '…' : '') + hay.slice(Math.max(0, i - 30), i + 70).replace(/\n/g, ' ') + '…', where: where(c), isDone: !!c.done, onGo: () => this.jump(c.id) }); }); results = results.slice(0, 30); }
    const deskW = S.width; const view = isPhone ? S.view : (S.view === 'trees' ? 'tree' : S.view);
    const treeName = curTree ? curTree.name : '';
    const treeMode = isPhone ? 'phone' : (oc && !S.treeOpen ? 'pill' : 'full');
    const cardMode = isPhone ? 'phone' : (S.treeOpen ? 'pill' : 'line');
    const ocL = oc ? 'L' + pathOf(oc.id).length : '';
    const inFocus = !isPhone && !!S.focus && !!oc;
    let ol = { where: '', items: [] };
    if(inFocus){ const path = pathOf(oc.id); const d = path.length; const items = [];
      const og = dd => { const xs = []; for(let i = 0; i < dd; i++) xs.push(7 + i * 16); return { indent: dd * 16 + 'px', gImg: xs.length ? xs.map(() => 'linear-gradient(var(--line2),var(--line2))').join(',') : 'none', gPos: xs.length ? xs.map(x => x + 'px 0').join(',') : '0 0' }; };
      const it = (c, dd, kind) => { const dt = dotFor(c); return Object.assign({ cid: c.id, q: qOf(c), dot: dt[0], dotGlyph: dt[1], bg: c.id === oc.id ? 'var(--sel)' : 'transparent', ink: kind === 'up' || c.done ? 'var(--mute)' : 'var(--ink)', font: kind === 'up' ? "400 14.5px/1.4 'Source Sans 3',sans-serif" : kind === 'kid' ? "500 15px/1.3 'Newsreader',serif" : "500 16px/1.3 'Newsreader',serif", onGo: () => this.jump(c.id) }, og(dd)); };
      /* v2.46 §20: the Focus outline re-roots by width. 280px column: keep row text >= ~160px, so at most 3 indent steps; older ancestors fold into one "Up" row */
      const olMax = 3; const olBase = Math.max(0, d - olMax); const ogR = dd => og(Math.max(0, dd - olBase));
      if(olBase > 0){ const upId = path[olBase - 1]; items.push(Object.assign({ q: '‹ Up · ' + olBase + ' level' + (olBase === 1 ? '' : 's') + ' above', dot: 'color:var(--accInk);font-size:13px', dotGlyph: '', bg: 'transparent', ink: 'var(--accInk)', font: "600 14px/1.4 'Source Sans 3',sans-serif", onGo: () => this.jump(upId) }, og(0))); }
      path.slice(0, -1).forEach((id, i) => { if(i >= olBase) items.push(Object.assign(it(cards[id], i, 'up'), ogR(i))); });
      const sibs = oc.parent ? (kids[oc.parent] || []) : (kids['root:' + oc.tree] || []);
      /* v2.44: Focus outline follows the Open tab: fully-done cards hide behind one "✓ N done" row */
      let olHid = 0; const olShow = c => { if(showAll || c.id === oc.id || !foldable(c, true)) return true; olHid++; return false; };
      sibs.forEach(c => { if(olShow(c)) items.push(Object.assign(it(c, d - 1, 'sib'), ogR(d - 1))); if(c.id === oc.id) (kids[oc.id] || []).forEach(k => { if(olShow(k)) items.push(Object.assign(it(k, d, 'kid'), ogR(d))); }); });
      if(olHid) items.push(Object.assign({ q: '✓ ' + olHid + ' done (show)', dot: 'color:var(--upd);font-weight:700;font-size:13px', dotGlyph: '', bg: 'transparent', ink: 'var(--mute)', font: "600 14px/1.4 'Source Sans 3',sans-serif", onGo: () => { this.newKeep = null; this.setState(x => ({ showAll: Object.assign({}, x.showAll, { [oc.tree]: true }) })); } }, ogR(d - 1)));
      ol = { where: (wsArr.length > 1 || true ? curWsO.name + ' › ' : '') + treeName, items }; }
    // round 2 §11: sidebar width 220–400 (default 280), rail (56px) by choice or under 1100px, flyout from the rail
    const railNow = !isPhone && (S.rail == null ? deskW < 1100 : S.rail); this.railNow = railNow;
    const sidePx = S.sideW ? Math.max(220, Math.min(400, S.sideW)) : 280; this.sidePx = sidePx;
    const wsU = (this.wsUrNow || {})[curWsId] || 0, wsN = wsNew[curWsId] || 0;
    this.readerVisible = isPhone ? (view === 'card' && !!oc) : !!oc;
    const rail = { wsInitial: ((curWsO.name || '?').trim()[0] || '?').toUpperCase(), wsTip: 'Workspace: ' + curWsO.name + ' (switch)', hasTreeDot: !!sdot(wsN, wsU), treeDot: sdot(wsN, wsU) || {},
      treesBg: S.flyout ? 'var(--sel)' : 'transparent', treesOutline: S.flyout ? '1.5px solid var(--acc)' : 'none', inboxBg: S.view === 'inbox' ? 'var(--sel)' : 'transparent',
      flyHead: 'TREES · ' + String(curWsO.name || '').toUpperCase(),
      expand: () => this.setState({ rail: false, flyout: false }), collapse: () => this.setState({ rail: true, flyout: false }),
      treesClick: () => { clearTimeout(this.flyT); clearTimeout(this.flyOutT); this.setState(x => ({ flyout: !x.flyout })); },
      treesIn: () => { clearTimeout(this.flyOutT); if(this.state.flyout) return; clearTimeout(this.flyT); this.flyT = setTimeout(() => this.setState({ flyout: true }), 300); },
      treesOut: () => { clearTimeout(this.flyT); clearTimeout(this.flyOutT); this.flyOutT = setTimeout(() => this.setState({ flyout: false }), 400); },
      flyIn: () => clearTimeout(this.flyOutT), keepOpen: () => this.setState({ rail: false, flyout: false }) };
    const defW = deskW < 1100 ? 380 : deskW < 1400 ? 460 : 540; const cardPx = S.cardW ? Math.max(380, Math.min(S.cardW, Math.round(deskW * .6))) : defW; this.cardPx = cardPx;
    return { rootRef: this.rootRef, fileRef: this.fileRef, mainScrollRef: this.mainScrollRef, readerScrollRef: this.readerScrollRef, theme, framed, isPhone, isDesk: !isPhone, appTitle: CFG.title,
      appW: framed ? '390px' : '100%', appH: framed ? '844px' : '100%', appR: framed ? '46px' : '0', appShadow: framed ? '0 0 0 10px #23211d, 0 30px 70px rgba(0,0,0,.25)' : 'none',
      padTop: framed ? '6px' : (isPhone ? '14px' : '28px'), padTopSmall: framed ? '0px' : '8px', padBottom: framed ? '24px' : 'max(10px, env(safe-area-inset-bottom))',
      sideW: isPhone ? '100%' : sidePx + 'px', rail, showRail: !isPhone && !inFocus && railNow, showFlyout: !isPhone && !inFocus && railNow && !!S.flyout, showSideDiv: !isPhone && !inFocus && !railNow,
      sdBg: S.sdHover || S.sdDrag ? 'var(--line)' : 'transparent', sdGrip: S.sdHover || S.sdDrag, sdIn: () => this.setState({ sdHover: true }), sdOut: () => this.setState({ sdHover: false }), sdReset: () => this.setState({ sideW: 280 }),
      sdDown: e => { e.preventDefault(); const x0 = e.clientX, w0 = this.sidePx; let done = false; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); this.setState({ sdDrag: false, sdHover: false }); }; const mv = ev => { if(done) return; const w = w0 + (ev.clientX - x0); if(w < 200){ done = true; up(); this.setState({ rail: true, flyout: false }); return; } this.setState({ sideW: Math.max(220, Math.min(400, Math.round(w))) }); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); this.setState({ sdDrag: true }); }, sideBorder: isPhone ? '0' : '1px solid var(--line)', sideBg: isPhone ? 'var(--bg)' : 'var(--soft)',
      readerW: isPhone ? '100%' : inFocus ? 'auto' : cardPx + 'px', readerFlex: isPhone || inFocus ? '1' : 'none', readerBorder: isPhone ? '0' : '1px solid var(--line)',
      showSidebar: isPhone ? view === 'trees' : !inFocus && !railNow, showMain: isPhone ? (view === 'inbox' || view === 'tree') : !inFocus, showOutline: inFocus, ol, showDivider: !isPhone && !!oc && !inFocus,
      divBg: S.divHover || S.divDrag ? 'var(--line)' : 'transparent', divGrip: S.divHover || S.divDrag, divIn: () => this.setState({ divHover: true }), divOut: () => this.setState({ divHover: false }), divReset: () => this.setState({ cardW: 540 }),
      divDown: e => { e.preventDefault(); const x0 = e.clientX, w0 = this.cardPx; const mv = ev => { const w = Math.max(380, Math.min(Math.round(window.innerWidth * .6), w0 - (ev.clientX - x0))); this.setState({ cardW: w }); }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); this.setState({ divDrag: false }); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); this.setState({ divDrag: true }); },
      toggleFocus: () => this.setState(x => ({ focus: !x.focus })), exitFocus: () => this.setState({ focus: false }), showReader: isPhone ? (view === 'card' && !!oc) : !!oc, hasOpen: !!oc, noOpen: false,
      isInbox: view === 'inbox' || noTrees || !!statusMsg || loading, isTree: view !== 'inbox' && !!curTree && !noTrees && !statusMsg && !loading, isEmptyWs: view !== 'inbox' && !curTree && !noTrees && !statusMsg && !loading,
      treeHeadPad: isPhone ? '2px 10px 0 22px' : '26px 16px 4px 22px', treeTitleSize: isPhone ? '30px' : '30px',
      inbox, navItems, navEmpty: !navItems.length, wsHasNew, openWsPicker: e => this.wsPicker(e), openMapPicker: e => this.mapPicker(e), inboxNavBg: S.view === 'inbox' ? 'var(--sel)' : 'transparent',
      hasBadge: inboxN > 0, badge: inboxN > 99 ? '99+' : String(inboxN), badgeRing: newCount > 0 ? '0 0 0 3px var(--newring)' : 'none', railBadgeRing: newCount > 0 ? '0 0 0 2px var(--soft),0 0 0 4px var(--newring)' : '0 0 0 2px var(--soft)',
      topOutline: S.dropOn === 'top' ? '1.5px solid var(--acc)' : 'none', topDrop: dropProps(null),
      cur: (() => { const setM = v => () => { this.newKeep = null; this.setState(x => ({ showAll: Object.assign({}, x.showAll, { [curTree.id]: v }) })); }; const tab = (on) => ({ bg: on ? 'var(--inv)' : 'transparent', ink: on ? 'var(--invInk)' : 'var(--mute)' });
        const R = rootId && cards[rootId]; const above = R ? depthOf(R.id) : 0;
        return { wsName: curWsO.name, treeName, statA: ts.total ? '' : 'Empty tree', hasSwitch: ts.total > 0, openLabel: 'Open ' + ts.open, newLabel: 'New ' + ts.nw, unreadLabel: 'Unread ' + ts.ur, uT: tab(tabMode === 'unread'), setUnread: setM('unread'), unreadDot: tabMode === 'unread', waitLabel: 'Waiting ' + waitN, wT: tab(tabMode === 'waiting'), setWaiting: setM('waiting'), waitPulse: waitN > 0, allLabel: 'All ' + ts.total,
          oT: tab(tabMode === 'open'), nT: tab(tabMode === 'new'), aT: tab(tabMode === 'all'), newDot: tabMode === 'new', setOpen: setM(false), setNew: setM('new'), setAll: setM(true), tabFlex: isPhone ? '1' : 'none', tabPad: isPhone ? '4px 4px' : '4px 14px', tabFs: isPhone ? '13px' : '14px', tabW: isPhone ? '100%' : 'auto',
          isNewTab: flatTab, notNewTab: !flatTab, clearSeen: () => { if(this.newKeep) this.newKeep.ids = new Set([...this.newKeep.ids].filter(id => cards[id] && (tabMode === 'unread' ? isUnread : tabMode === 'waiting' ? isWait : isNew)(cards[id]))); this.forceUpdate(); },
          newEmpty: flatTab && !!this.newEmpty, emptyText: tabMode === 'unread' ? 'Nothing unread' : tabMode === 'waiting' ? 'Nothing waiting for Claude' : 'No new answers', clearLabel: tabMode === 'unread' ? 'Clear read' : tabMode === 'waiting' ? 'Clear answered' : 'Clear seen', backOpen: setM(false),
          hasCrumb: !!R && !flatTab, crumbWhole: isPhone ? '‹ Up' : '‹ Whole tree', onWhole: () => this.reRoot(null), crumbAbove: isPhone ? above + ' above' : above + (above === 1 ? ' level above' : ' levels above'), hasAbove: above > 0, onAbove: e => R && this.ancestorMenu(e, R.id, 'root'),
          crumbTag: R ? 'L' + (above + 1) : '', crumbTitle: R ? short(qOf(R), isPhone ? 40 : 70) : '',
          allDone: tabMode === 'open' && !rootId && ts.total > 0 && ts.open === 0 && !(oc0 && oc0.tree === curTree.id), allDoneText: 'All ' + ts.total + ' card' + (ts.total === 1 ? '' : 's') + ' done', hasNewS: false, statNew: '', hasWait: waitN > 0 && !(ts.total > 0), statWait: waitN + ' waiting' }; })(),
      rows, treeEmpty: !!curTree && !all.some(c => c.tree === curTree.id), rd,
      treeComp: this.comp('tree:' + (curTree ? curTree.id : ''), this.treeTa, { mode: treeMode, ph: isPhone ? 'Start a new topic…' : 'Start a new topic…', btn: 'Start topic', glyph: '+', pre: '+ New topic in ', strong: treeName, keyHint: true, onExpand: () => this.openTreeBox() }),
      cardComp: this.comp('card:' + (oc ? oc.id : ''), this.cardTa, { mode: cardMode, ph: isPhone ? 'Ask a follow-up…' : 'Ask a follow-up on this card…', btn: 'Ask', glyph: '↳', pre: '↳ Follow-up to ', strong: ocL, post: oc ? ' · ' + short(qOf(oc), 60) : '', pillPre: '↳ Ask a follow-up on ', maxW: isPhone ? '100%' : inFocus ? '720px' : '640px', onExpand: () => this.setState({ treeOpen: false }) }),
      keysOn: !!S.keys && !isPhone, openKeys: () => this.setState({ keys: true, pop: null, flyout: false }), keys: { onClose: () => this.setState({ keys: false }), onBack: e => { if(e.target === e.currentTarget) this.setState({ keys: false }); }, mod: /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl', groups: KEYS((/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl')) },
      ...(() => { const lb = S.lb; const L = this.lbList(lb); const f = lb && L[Math.min(lb.i, L.length - 1)]; if(!f) return { lbOn: false, lb: {} }; const n = L.length; const isPdf = /pdf$/i.test(f.type || '') || /\.pdf$/i.test(f.name || '');
        return { lbOn: true, lb: { name: f.name, url: f.url, isImg: !!f.isImg, isPdf: !f.isImg && isPdf, isOther: !f.isImg && !isPdf, ext: extOf(f.name), count: (Math.min(lb.i, n - 1) + 1) + ' of ' + n, canRm: !!lb.key, onRm: () => { const k = lb.key; const nx = L.filter(x => x.lid !== f.lid); this.setState(x => ({ files: Object.assign({}, x.files, { [k]: (x.files[k] || []).filter(y => y.lid !== f.lid) }), lb: nx.length ? { key: k, i: Math.min(lb.i, nx.length - 1) } : null })); }, many: n > 1, pad: n > 1 ? '64px' : '0px', onPrev: () => this.lbStep(-1), onNext: () => this.lbStep(1), onClose: () => this.setState({ lb: null }), onBack: e => { if(e.target === e.currentTarget) this.setState({ lb: null }); } } }; })(),
      hasToast: !!toast, toast: toast || {}, toastBottom: isPhone ? (framed ? '130px' : '120px') : '110px',
      hasSheet: !!sheet, sheet: sheet || { actions: [], btns: [], targets: [] }, sheetAlign: isPhone ? 'flex-end' : 'center', sheetW: isPhone ? '100%' : '440px', sheetR: isPhone ? '22px 22px 0 0' : '18px', actH: isPhone ? '52px' : '42px', btnDir: isPhone ? 'column' : 'row-reverse',
      hasPop: !!pop, pop: pop || { actions: [] }, closePop: () => this.setState({ pop: null }),
      themeOpts: ['system', 'light', 'dark'].map(t => ({ label: t === 'system' ? 'Device' : t[0].toUpperCase() + t.slice(1), bg: S.theme === t ? 'var(--paper)' : 'transparent', onPick: () => this.setState({ theme: t }) })),
      query: S.query, onQuery: e => this.setState({ query: e.target.value }), results, noResults: q.length >= 2 && !results.length,
      stop: e => e.stopPropagation(), closeSheet: () => this.setState({ sheet: null }),
      openSearch: () => this.setState({ pop: null, sheet: { kind: 'search', title: 'Search' } }), openSettings: () => this.settings(),
      goInbox: () => this.setState({ view: 'inbox', openId: isPhone ? null : S.openId, pop: null }), goTrees: () => this.setState({ view: 'trees', openId: null, pop: null }), backToLast: () => lastT && this.pickTree(lastT.id),
      askFromInbox: () => { const t = lastT || treesArr[0]; if(t){ this.focusTree = true; this.pickTree(t.id); } },
      firstTree: () => { const t = this.treesNow.find(x => x.ws === curWsId) || this.treesNow[0]; if(t){ this.focusTree = true; this.pickTree(t.id); } else this.newTree(curWsId); }, newTreeHere: () => this.newTree(curWsId, null), newFolderTop: () => this.askName('New folder', '', v => this.createFolder(curWsId, null, v), 'A folder groups trees, for example "Health" or "Clients". Folders can hold folders, up to 3 levels.'), newWs: () => this.newWs(),
      treeMenu: e => curTree && this.treeMenuFor(e, curTree, { alignRight: true, w: 250 }),
      bulk: (() => { const b = S.bsel && curTree && S.bsel.tree === curTree.id ? S.bsel : null; const n = b ? Object.keys(b.ids).filter(k => cards[k]).length : 0; const R = this.rowIds || []; const allOn = !!b && R.length > 0 && R.every(k => b.ids[k]);
        const act = (label, kind) => ({ label, dis: !n, op: n ? 1 : .45, onGo: () => kind === 'move' ? this.bulkMovePick() : this.bulkApply(kind) });
        return { on: !!b, off: !b, btn: b ? 'Cancel' : 'Select', toggle: () => b ? this.bulkEnd() : this.bulkStart(), countText: n ? n + ' selected' : 'Tap cards to select', allLabel: allOn ? 'Clear' : 'Select all', onAll: () => this.bulkAll(), onCancel: () => this.bulkEnd(),
          acts: [act('Done', 'done'), act('Not done', 'undone'), act('Read', 'read'), act('Unread', 'unread'), act('Move to…', 'move')], hint: isPhone ? '' : 'Shift-click selects a range · Esc to cancel', hasHint: !isPhone }; })(),
      foldAll: () => { const col = {}; all.forEach(c => { if(c.tree === (curTree && curTree.id) && (kids[c.id] || []).length) col[c.id] = true; }); this.setState(x => ({ collapsed: Object.assign({}, x.collapsed, col) })); },
      unfoldAll: () => this.setState(x => { const col = Object.assign({}, x.collapsed); all.forEach(c => { if(c.tree === (curTree && curTree.id)) delete col[c.id]; }); return { collapsed: col }; }),
      nav: this.navVals(), backToTree: () => { this.pendingScroll = S.openId; this.setState({ view: 'tree' }); }, closeCard: () => this.setState({ openId: null, treeOpen: false }), nextNew: () => this.nextNew(), nextUnread: () => this.nextUnread(),
      onFilesPicked: e => { if(this.fileKey && e.target.files.length) this.addFiles(this.fileKey, e.target.files); e.target.value = ''; } };
  }
}
return Component;
};
