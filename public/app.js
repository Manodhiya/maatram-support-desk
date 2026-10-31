const $ = (s) => document.querySelector(s), app = $('#app');
let S = { token: sessionStorage.token, user: JSON.parse(sessionStorage.user || 'null'), view: 'dashboard', meta: null, f: {} };
const ROLE = { student: 'Student', anchor: 'Anchor', zone: 'Zone Incharge', admin: 'Admin', alumni: 'Alumni' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = (t) => new Date(t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
const toast = (m, e) => { const t = $('#toast'); t.textContent = m; t.className = 'show' + (e ? ' err' : ''); setTimeout(() => (t.className = ''), 3000); };
async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.token }, body: body && JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) { if (r.status === 401 && S.token) logout(); throw new Error(d.error); } return d;
}
const logout = () => { sessionStorage.clear(); S.token = null; S.user = null; S.view = 'dashboard'; S.f = {}; render(); };
function modal(inner, w = 460) {
  const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="panel" style="width:min(${w}px,100%)">${inner}</div>`;
  document.body.appendChild(m); m.onclick = (e) => { if (e.target === m || e.target.dataset.close !== undefined) m.remove(); }; return m;
}
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function avFix(el) { const s = document.createElement('span'); s.className = el.className; s.textContent = initials(el.alt); el.replaceWith(s); } // photo file missing: show initials instead
const avatar = (u, cls = '') => u && u.photo ? `<img class="av ${cls}" src="${esc(u.photo)}" alt="${esc(u.name)}" onerror="avFix(this)">` : `<span class="av ${cls}">${esc(initials(u && u.name))}</span>`;
let newPhoto = null, dropPhoto = false;
function readPhoto(file) { // shrinks the picture to 480px so uploads stay small
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = () => rej(new Error('Could not read that photo'));
    fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('Please choose a PNG, JPG or WEBP picture'));
      im.onload = () => { const k = Math.min(1, 480 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); }; im.src = fr.result; }; fr.readAsDataURL(file); });
}
function wirePhoto(size = 'lg') {
  newPhoto = null; dropPhoto = false; const inp = $('#ph'); if (!inp) return;
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { newPhoto = await readPhoto(f); dropPhoto = false; $('#pv').innerHTML = `<img class="av ${size}" src="${newPhoto}" alt="Your photo">`; $('#ph_h').textContent = '✓ Photo added'; $('#ph_h').className = 'hint good'; } catch (x) { toast(x.message, 1); } };
  const rm = $('#rmph'); if (rm) rm.onclick = () => { newPhoto = null; dropPhoto = true; inp.value = ''; $('#pv').innerHTML = avatar({ name: S.user.name }, size); $('#ph_h').textContent = 'Photo will be removed when you save'; rm.hidden = true; };
}
const stText = (q) => q.status === 'Waiting for student' && q.raiserId === (S.user || {}).id ? 'Waiting for your reply' : q.status;
const catOf = (q) => esc(q.category) + (q.categoryOther ? ': ' + esc(q.categoryOther) : '');
const uname = (id) => { if (!id || id === 'none') return 'Not sure'; const M = S.meta, x = [...M.anchors, ...M.zones].find((u) => u.id == id); return x ? x.name : '—'; };
const stTag = (q) => `<span class="tag st-${q.status.split(' ')[0]}">${stText(q)}</span>${q.overdue ? ' <span class="tag od">Overdue</span>' : ''}`;
const crumbOf = (q, you) => `<div class="crumb"><span class="c">${you ? 'You' : esc(q.raiserName)}</span>${q.route.map((r) => `<span class="c ${r.id === q.toId ? 'now' : ''}">${esc(r.name)}<small>${ROLE[r.role]}</small></span>`).join('')}</div>`;

/* ---------- sign in / sign up ---------- */
function authShell(inner) {
  app.innerHTML = `<div class="login"><section class="hero"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i>
  <div><img class="logo" src="logo-light.png" alt="Maatram Foundation"><h1>No student query<br><em>left behind.</em></h1>
  <p>Ask once. Maatram routes your query to the right person, and you can see exactly who is working on it.</p></div></section>
  <section class="side"><div class="box"><div class="bar-y"></div>${inner}</div></section></div>`;
}
const pwField = (id, label, ac) => `<label for="${id}">${label}</label><div class="pw"><input id="${id}" type="password" autocomplete="${ac}" required><button type="button" class="tg">Show</button></div>`;
function wireToggle() { document.querySelectorAll('.tg').forEach((b) => (b.onclick = () => { const p = b.previousElementSibling, h = p.type === 'password'; p.type = h ? 'text' : 'password'; b.textContent = h ? 'Hide' : 'Show'; })); }
function loginView() {
  authShell(`<h2>Welcome back</h2><p class="muted">Sign in to the Maatram support desk.</p><form id="lf" style="margin-top:14px"><label for="rl">I am signing in as</label>
  <select id="rl" required><option value="">Select your role</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
  <label for="em">Email</label><input id="em" type="email" placeholder="you@example.com" autocomplete="username" required>${pwField('pw', 'Password', 'current-password')}
  <p id="le" style="color:var(--bad);min-height:22px;margin-top:8px"></p><button class="btn">Sign in</button></form>
  <p class="foot">New student or alumni? <a href="#" id="su" style="color:#FFB800;font-weight:600">Create an account</a></p>`);
  wireToggle(); $('#su').onclick = (e) => { e.preventDefault(); registerView(); };
  $('#lf').onsubmit = async (e) => { e.preventDefault(); try { enter(await api('/login', 'POST', { role: $('#rl').value, email: $('#em').value, password: $('#pw').value })); } catch (x) { $('#le').textContent = x.message; } };
}
function registerView() {
  authShell(`<h2>Create your account</h2><p class="muted">Choose your role and set a password. You will complete your profile next.</p><form id="rf" style="margin-top:14px"><label for="rl">I am a</label>
  <select id="rl" required><option value="">Choose your role</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
  <label for="nm">Full name</label><input id="nm" required autocomplete="name"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required>${pwField('pw', 'Password (6+ characters)', 'new-password')}
  <label>Your photo *</label><div class="photo-pick"><div id="pv">${avatar({ name: '?' }, 'lg')}</div><div><label class="pickbtn" for="ph">Choose photo</label><input id="ph" type="file" accept="image/png,image/jpeg,image/webp" hidden><small class="hint" id="ph_h">Required. A clear face photo, JPG or PNG.</small></div></div>
  <div id="cd" hidden><label for="code">Registration code *</label><input id="code" autocomplete="off" placeholder="Ask the Maatram office for this code"></div>
  <p id="le" style="color:var(--bad);min-height:22px;margin-top:8px"></p><button class="btn">Create account</button></form>
  <p class="foot">Already registered? <a href="#" id="si" style="color:#FFB800;font-weight:600">Sign in</a></p>`);
  wireToggle(); wirePhoto(); $('#si').onclick = (e) => { e.preventDefault(); loginView(); };
  $('#rl').onchange = () => { const on = ['anchor', 'zone', 'admin'].includes($('#rl').value); $('#cd').hidden = !on; $('#code').required = on; };
  $('#rf').onsubmit = async (e) => { e.preventDefault(); if (!newPhoto) { $('#le').textContent = 'Please add your photo'; return; } try { enter(await api('/register', 'POST', { role: $('#rl').value, name: $('#nm').value, email: $('#em').value, password: $('#pw').value, code: $('#code').value, photo: newPhoto })); } catch (x) { $('#le').textContent = x.message; } };
}
function enter(d) { sessionStorage.token = S.token = d.token; sessionStorage.user = JSON.stringify(d.user); S.user = d.user; S.view = 'dashboard'; S.f = {}; render(); }

/* ---------- shell ---------- */
const NAV = {
  student: [['dashboard', '▦ Dashboard'], ['queries', '☰ My queries'], ['new', '＋ Raise a query'], ['profile', '👤 My profile'], ['notifications', '🔔 Notifications']],
  alumni: [['dashboard', '▦ Dashboard'], ['queries', '☰ Queries'], ['new', '＋ Raise a query'], ['profile', '👤 My profile'], ['notifications', '🔔 Notifications']],
  anchor: [['dashboard', '▦ Dashboard'], ['queries', '☰ Queries'], ['people', '👥 My students'], ['profile', '👤 My profile'], ['notifications', '🔔 Notifications']],
  zone: [['dashboard', '▦ Dashboard'], ['queries', '☰ Queries'], ['people', '👥 My zone'], ['profile', '👤 My profile'], ['notifications', '🔔 Notifications']],
  admin: [['dashboard', '▦ Dashboard'], ['queries', '☰ All queries'], ['people', '👥 People'], ['notifications', '🔔 Notifications'], ['profile', '👤 My profile']] };
async function render() {
  if (!S.token) return loginView();
  try { [S.user, S.meta] = await Promise.all([api('/me'), api('/meta')]); } catch (x) { return; }
  sessionStorage.user = JSON.stringify(S.user);
  const r = S.user.role, gated = r !== 'admin' && !S.user.profileDone; if (gated) S.view = 'profile';
  const nav = gated ? [['profile', '👤 Complete profile']] : NAV[r];
  app.innerHTML = `<div class="shell"><aside><img src="logo-light.png" alt="Maatram">${nav.map((n) => `<button class="nav ${S.view === n[0] ? 'on' : ''}" data-v="${n[0]}">${n[1]}</button>`).join('')}
  <div class="me"><div class="me-row">${avatar(S.user, 'sm')}<div><b>${esc(S.user.name)}</b><br><span>${ROLE[r]}</span></div></div><a href="#" id="cp" class="muted">Change password</a> · <a href="#" id="lo" class="muted">Sign out</a></div></aside><main id="main"></main></div>`;
  document.querySelectorAll('.nav').forEach((b) => (b.onclick = () => { S.view = b.dataset.v; S.f = {}; render(); }));
  $('#lo').onclick = (e) => { e.preventDefault(); logout(); }; $('#cp').onclick = (e) => { e.preventDefault(); passwordModal(); };
  try { await ({ dashboard, queries, new: newQuery, notifications, people, profile })[S.view](); } catch (e) { console.error(e); $('#main').innerHTML = `<div class="card"><b>Something went wrong loading this page.</b><p class="muted">${esc(e.message)}</p><button class="btn sm" onclick="render()">Try again</button></div>`; }
}

/* ---------- dashboard ---------- */
const cards = (a) => `<div class="cards">${a.map((c, i) => `<div class="card stat ${i === 0 ? 'hot' : ''} ${c[2] || ''}"><b>${c[0]}</b><span>${c[1]}</span></div>`).join('')}</div>`;
const bars = (o) => { const m = Math.max(1, ...Object.values(o)); return Object.entries(o).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><i style="width:${(v / m) * 100}%"></i><b>${v}</b></div>`).join('') || '<p class="muted">Nothing yet</p>'; };
const qitem = (q, who) => `<div class="qi" data-q="${q.id}"><div><b>#${q.id} ${esc(q.category)}</b>${who ? ' · ' + esc(q.raiserName) : ''} ${stTag(q)}<br><small class="muted">With ${esc(q.toName)} · updated ${ago(q.updatedAt)}</small></div><span class="muted">›</span></div>`;
async function dashboard() {
  const s = await api('/stats'), r = S.user.role, first = esc(S.user.name.split(' ')[0]), mine = r === 'student' || r === 'alumni', p = S.user.profile || {};
  const wire = () => document.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => detail(b.dataset.q)));
  if (mine) {
    const reps = s.recent.filter((q) => q.lastReply), team = r === 'student' ? (reps.length ? reps.map((q) => `<div class="qi" data-q="${q.id}"><div><b>#${q.id} ${esc(q.category)}</b><br><small><b>${esc(q.lastReply.by)}:</b> ${esc(q.lastReply.note.slice(0, 110))}</small><br><small class="muted">${ago(q.lastReply.at)}</small></div><span class="muted">›</span></div>`).join('') : '<p class="muted">No replies yet. When someone answers your query, you will see it here.</p>')
      : `<p>${p.mentor ? 'You are listed as a mentor. Students can send mentoring and career queries directly to you.' : 'Turn on “I can mentor Maatram students” in your profile so students can reach you for guidance.'}</p><button class="btn ghost sm" data-go="profile">Update profile</button>`;
    $('#main').innerHTML = `<div class="banner"><div class="bn">${avatar(S.user, 'lg')}<div><h1>Hello, ${first}</h1><p>${s.waitingForMe ? `${s.waitingForMe} ${s.waitingForMe > 1 ? 'queries need' : 'query needs'} your reply.` : 'Ask anything — Maatram will route it to the right person.'}</p></div></div><button class="btn" data-go="new">Raise a query</button></div>
    ${cards(r === 'alumni' ? [[s.myOpen, 'My open queries'], [s.withMe, 'Mentoring requests for you'], [s.waitingForMe, 'Waiting for your reply', s.waitingForMe ? 'red' : ''], [s.myResolved, 'Solved']] : [[s.myOpen, 'Open queries'], [s.waitingForMe, 'Waiting for your reply', s.waitingForMe ? 'red' : ''], [s.myResolved, 'Solved'], [s.myTotal, 'Total raised']])}
    <div class="two"><div class="card"><h3>${s.attention.length ? 'Needs your reply' : 'Recent queries'}</h3>${(s.attention.length ? s.attention : s.recent).map((q) => qitem(q)).join('') || '<p class="muted">You have not raised a query yet.</p>'}</div>
    <div class="card"><h3>${r === 'student' ? 'Latest replies' : 'Your mentoring'}</h3>${team}</div></div>`;
  } else {
    const adm = r === 'admin', top = adm ? [[s.open, 'Open queries'], [s.overdue, 'Overdue', 'red'], [s.resolved, 'Solved'], [s.avgHours + 'h', 'Average time to solve']] : [[s.withMe, 'With you now'], [s.overdue, 'Overdue', 'red'], [s.forwardedByMe, 'Forwarded by you'], [s.resolved, 'Solved']];
    $('#main').innerHTML = `<div class="banner"><div class="bn">${avatar(S.user, 'lg')}<div><h1>Hello, ${first}</h1><p>${adm ? `${s.open} open across Maatram · ${s.overdue} overdue.` : `${s.withMe} ${s.withMe === 1 ? 'query is' : 'queries are'} with you · ${s.overdue} overdue.`}</p></div></div><button class="btn" data-go="queries">Open queries</button></div>${cards(top)}
    <div class="two"><div class="card"><h3>Needs your action</h3>${s.attention.map((q) => qitem(q, 1)).join('') || '<p class="muted">Nothing is waiting for you. Great work.</p>'}</div>
    <div class="card"><h3>${adm ? 'People on Maatram' : r === 'zone' ? 'In your zone' : 'Your students'}</h3>${Object.entries(s.people).map(([k, v]) => `<div class="bar" style="grid-template-columns:1fr auto"><span>${k}</span><b>${v}</b></div>`).join('') || '<p class="muted">No one is linked to you yet.</p>'}</div>
    <div class="card"><h3>Open queries by handler</h3>${bars(s.perHandler)}</div><div class="card"><h3>Most common categories</h3>${bars(s.perCategory)}</div></div>`;
  }
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { S.view = b.dataset.go; S.f = {}; render(); })); wire();
}

/* ---------- queries ---------- */
async function queries() {
  const M = S.meta, r = S.user.role, f = S.f, rep = r === 'student', opt = (arr, v) => arr.map((a) => `<option ${a === v ? 'selected' : ''}>${a}</option>`).join('');
  const tabs = r === 'alumni' ? [['raised', 'Raised by me'], ['with', 'Sent to me']] : rep ? [] : r === 'admin' ? [['all', 'All queries'], ['with', 'With me']] : [['with', 'With me'], ['all', 'All I can see']];
  f.scope = f.scope || (rep || r === 'alumni' ? 'raised' : r === 'admin' ? 'all' : 'with');
  const mineView = rep || (r === 'alumni' && f.scope === 'raised'), stOpts = M.STATUSES.map((a) => `<option value="${a}" ${a === f.status ? 'selected' : ''}>${a === 'Waiting for student' && mineView ? 'Waiting for your reply' : a}</option>`).join('');
  $('#main').innerHTML = `<div class="top"><div><h1>${rep ? 'My queries' : 'Queries'}</h1><p id="cnt"></p></div>${rep || r === 'alumni' ? '<button class="btn" id="nq">Raise a query</button>' : ''}</div>
  ${tabs.length ? `<div class="tabs">${tabs.map((t) => `<button class="tab ${t[0] === f.scope ? 'on' : ''}" data-s="${t[0]}">${t[1]}</button>`).join('')}</div>` : ''}
  <div class="filters" ${rep ? 'style="grid-template-columns:1fr 1fr auto"' : ''}>${rep ? '' : `<input id="fq" type="search" placeholder="Search name, college, text or #id" value="${esc(f.q || '')}" aria-label="Search">`}
  <select id="fs" aria-label="Status"><option value="">All statuses</option>${stOpts}</select><select id="fc" aria-label="Category"><option value="">All categories</option>${opt(M.CATS, f.category)}</select>
  ${rep ? '' : `<select id="fo" aria-label="Handler"><option value="">All handlers</option>${M.handlers.map((u) => `<option value="${u.id}" ${f.handler == u.id ? 'selected' : ''}>${esc(u.name)} (${ROLE[u.role]})</option>`).join('')}</select>
  <input id="fd" type="date" value="${f.from || ''}" title="Raised on or after" aria-label="Raised from">`}<button class="btn ghost sm" id="fx">Show all</button></div><div class="card" id="res" style="padding:0;overflow:hidden"></div>`;
  const val = (i) => ($('#' + i) ? $('#' + i).value : '');
  const reply = (q) => q.status === 'Waiting for student' ? `<span class="tag st-New">Reply needed</span><br>` : '';
  const load = async () => {
    Object.assign(f, { q: val('fq'), status: val('fs'), category: val('fc'), handler: val('fo'), from: val('fd') });
    const list = await api('/queries?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v))), filtered = ['q', 'status', 'category', 'handler', 'from'].some((k) => f[k]);
    $('#cnt').textContent = `${list.length} ${list.length === 1 ? 'query' : 'queries'}`;
    $('#res').innerHTML = list.length ? (rep ? `<table><tr><th>#</th><th>Category</th><th>Status</th><th>With</th><th>Latest reply</th><th>Sent</th></tr>
    ${list.map((q) => `<tr class="row" data-q="${q.id}"><td>${q.id}</td><td>${catOf(q)}<br><span class="muted p-${q.priority}">${q.priority}</span></td><td>${stTag(q)}</td><td>${esc(q.toName)}<br><span class="muted">${ROLE[q.toRole] || ''}</span></td>
    <td style="max-width:300px">${reply(q)}${q.lastReply ? `<b>${esc(q.lastReply.by)}:</b> ${esc(q.lastReply.note.slice(0, 110))}<br><small class="muted">${ago(q.lastReply.at)}</small>` : '<span class="muted">No reply yet</span>'}</td><td class="muted">${when(q.createdAt)}</td></tr>`).join('')}</table>`
      : `<table><tr><th>#</th><th>From</th><th>Category</th><th>Status</th><th>Priority</th><th>With</th><th>Updated</th></tr>
    ${list.map((q) => `<tr class="row" data-q="${q.id}"><td>${q.id}</td><td><b>${esc(q.raiserName)}</b><br><span class="muted">${ROLE[q.raiserRole]}${q.raiser && q.raiser.profile.college ? ' · ' + esc(q.raiser.profile.college) : ''}</span></td><td>${catOf(q)}</td><td>${stTag(q)}</td><td class="p-${q.priority}">${q.priority}</td>
    <td>${esc(q.toName)}<br><span class="muted">${ROLE[q.toRole] || ''}</span></td><td class="muted">${when(q.updatedAt)}</td></tr>`).join('')}</table>`)
      : filtered ? '<div class="empty">No queries match these filters.<br><br><button class="btn sm" id="sa">Show all queries</button></div>' : `<div class="empty"><b>${rep || r === 'alumni' ? 'You have not raised a query yet.' : 'No queries here yet.'}</b>${rep || r === 'alumni' ? '<br><br><button class="btn sm" id="sn">Raise your first query</button>' : ''}</div>`;
    document.querySelectorAll('tr.row').forEach((x) => (x.onclick = () => detail(x.dataset.q)));
    if ($('#sa')) $('#sa').onclick = clear; if ($('#sn')) $('#sn').onclick = () => { S.view = 'new'; render(); };
  };
  const clear = () => { ['fq', 'fs', 'fc', 'fo', 'fd'].forEach((i) => $('#' + i) && ($('#' + i).value = '')); load(); };
  let t; if ($('#fq')) $('#fq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); });
  ['fs', 'fc', 'fo', 'fd'].forEach((i) => $('#' + i) && $('#' + i).addEventListener('change', load));
  document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { S.f = { scope: b.dataset.s }; queries(); }));
  $('#fx').onclick = clear; if ($('#nq')) $('#nq').onclick = () => { S.view = 'new'; render(); }; load();
}
const RECTXT = { zone: 'the Zone Incharge', anchor: 'an Anchor', admin: 'the Maatram office', alumni: 'an Alumni mentor' };
function newQuery() {
  const M = S.meta, r = S.user.role, col = (S.user.profile || {}).college, o = (a) => a.map((x) => `<option>${x}</option>`).join('');
  const roles = [...(r === 'student' ? [['anchor', 'Anchor'], ['zone', 'Zone Incharge']] : []), ['admin', 'Maatram office (Admin)'], ['alumni', 'Alumni mentor']];
  const first = (a) => [...a].sort((x, y) => (y[2] === col) - (x[2] === col));
  const LIST = { anchor: first(M.anchors.map((a) => [a.id, `${a.name} — ${a.college || 'college not set'}${a.years ? ' (' + a.years + ')' : ''}`, a.college])), zone: first(M.zones.map((z) => [z.id, `${z.name} — ${z.college || 'college not set'}`, z.college])),
    admin: M.admins.map((a) => [a.id, a.name]), alumni: M.mentors.map((m) => [m.id, `${m.name} — ${m.company || 'Alumni'}`]) };
  const LBL = { anchor: 'Choose the anchor *', zone: 'Choose the zone incharge *', admin: 'Choose the admin *', alumni: 'Choose the alumni mentor *' };
  $('#main').innerHTML = `<div class="top"><div><h1>Raise a query</h1><p>Choose who should solve it. If they cannot, they will forward it and you will see every step.</p></div></div>
  <form class="card form" id="nf"><div class="grid2"><div><label for="f3">Category *</label><select id="f3" name="category" required><option value="">Choose a category</option>${o(M.CATS)}</select></div>
  <div><label for="f5">Priority *</label><select id="f5" name="priority" required><option value="">Choose a priority</option>${o(['Low', 'Medium', 'High', 'Urgent']).replace('<option>Medium', '<option selected>Medium')}</select></div>
  <div id="oth" hidden style="grid-column:1/-1"><label for="f7">What is this “Other” query about? *</label><input id="f7" name="categoryOther" placeholder="e.g. Hostel accommodation"></div>
  <div><label for="sr">Who should solve this? *</label><select id="sr" name="sendRole" required><option value="">Choose who should solve it</option>${roles.map((x) => `<option value="${x[0]}" data-t="${x[1]}">${x[1]}</option>`).join('')}</select></div>
  <div id="pp"><label for="sp" id="spl">Choose the person *</label><select id="sp" name="toId" required disabled><option value="">First choose who should solve it</option></select></div></div>
  <p class="muted" id="hint" style="font-size:13px;margin-top:8px"></p>
  <label for="f6">Your query *</label><textarea id="f6" name="description" rows="4" required placeholder="Explain what you need. Include names, dates or amounts if they matter."></textarea>
  <div class="imp"><b>Anything important we should know?</b><div class="grid2"><div><label for="dl">Deadline (if any)</label><input id="dl" type="date" name="deadline"></div><div><label for="cv">Best way to reach you</label><select id="cv" name="contactVia"><option value="">No preference</option>${o(['Phone call', 'WhatsApp', 'Email'])}</select></div></div>
  <label for="ii">Extra details</label><textarea id="ii" name="importantInfo" rows="2" placeholder="e.g. Documents close tomorrow, I can only talk after 5 pm"></textarea></div>
  <label for="fl">Attachments (up to 3)</label><input type="file" id="fl" multiple accept="image/*,.pdf"><br><br><button class="btn">Send query</button></form>`;
  const cat = () => { const c = $('#f3').value, on = c === 'Other', rec = M.REC[c] === 'mentor' ? 'alumni' : M.REC[c]; $('#oth').hidden = !on; $('#f7').required = on;
    [...$('#sr').options].forEach((x) => { if (x.value) x.textContent = x.dataset.t + (c && x.value === rec ? ' — recommended' : ''); });
    $('#hint').textContent = c ? `${c} queries are usually solved by ${RECTXT[rec] || RECTXT.admin}. You are free to choose anyone — if they cannot solve it, they will forward it for you.` : ''; };
  const who = () => { const k = $('#sr').value, l = LIST[k] || [], sp = $('#sp'); $('#spl').textContent = LBL[k] || 'Choose the person *'; sp.disabled = !k;
    sp.innerHTML = !k ? '<option value="">First choose who should solve it</option>' : l.length ? `<option value="">Choose a person</option>${l.map((x) => `<option value="${x[0]}">${esc(x[1])}</option>`).join('')}` : '<option value="">No one is available yet</option>'; };
  $('#f3').onchange = cat; $('#sr').onchange = who;
  $('#nf').onsubmit = async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    b.files = await Promise.all([...$('#fl').files].slice(0, 3).map((f) => new Promise((res) => { const x = new FileReader(); x.onload = () => res({ name: f.name, data: x.result }); x.readAsDataURL(f); })));
    try { const q = await api('/queries', 'POST', b); toast(`Query #${q.id} sent to ${q.toName}`); S.f = {}; S.view = 'queries'; render(); } catch (x) { toast(x.message, 1); } };
}
function profileRows(u) {
  const p = u.profile || {}, rows = [['Email', u.email]];
  (S.meta.PROFILE[u.role] || []).forEach((f) => { let v = p[f.k]; if (v === undefined || v === '' || v === false) return; if (f.type.startsWith('user')) v = uname(v); if (v === true) v = 'Yes'; rows.push([f.label, v, f.type === 'url']); });
  return `<div class="pgrid">${rows.map((x) => `<div><small>${esc(x[0])}</small><b>${x[2] && /^https?:/i.test(x[1]) ? `<a href="${esc(x[1])}" target="_blank" rel="noopener">${esc(x[1])}</a>` : esc(x[1])}</b></div>`).join('')}</div>`;
}
const profileCard = (u) => `<div class="phead mini">${avatar(u, 'lg')}<div><h2>${esc(u.name)}</h2><p><span class="tag">${ROLE[u.role]}</span> ${u.role === 'admin' ? '' : `<span class="tag ${u.profileDone ? 'st-Resolved' : 'st-New'}">${u.profileDone ? 'Profile complete' : 'Profile incomplete'}</span>`}${(u.profile || {}).mentor ? ' <span class="tag st-Resolved">Mentor</span>' : ''}</p></div></div>${profileRows(u)}`;
async function detail(id) {
  let d; try { d = await api('/queries/' + id); } catch (x) { return toast(x.message, 1); }
  const { q, options, suggest } = d, me = S.user, M = S.meta, handles = q.toId === me.id || me.role === 'admin', raiser = q.raiserId === me.id;
  const who = (i) => i === 0 ? 'System' : i === q.raiserId ? q.raiserName : (q.route.find((r) => r.id === i) || M.handlers.find((h) => h.id === i) || { name: 'Maatram team' }).name;
  const groups = [...new Set(options.map((o) => o.group))], sl = (t) => raiser && t === 'Waiting for student' ? 'Waiting for your reply' : t;
  const talk = q.history.filter((h) => h.note && /^(Status|Message|Reply|Reopened|Confirmed)/.test(h.action)),
    talkHtml = talk.length ? `<h3 style="margin-top:18px">Conversation</h3><div class="talk">${talk.map((h) => { const st = /^Status/.test(h.action) ? h.action.replace('Status → ', '') : ''; return `<div class="msg ${h.by === me.id ? 'me' : ''}"><b>${esc(h.by === me.id ? 'You' : who(h.by))}</b>${st ? ` <span class="tag st-${st.split(' ')[0]}">${esc(sl(st))}</span>` : ''}<br>${esc(h.note)}<small>${when(h.at)}</small></div>`; }).join('')}</div>` : '';
  const m = modal(`<div class="top"><div><h1>#${q.id} · ${catOf(q)}</h1><p>${stTag(q)} · <span class="p-${q.priority}">${q.priority}</span> priority · due ${when(q.due)}</p></div><button class="btn ghost sm" data-close>Close</button></div>
  ${crumbOf(q, raiser)}
  ${q.raiser ? `<div class="card" style="background:var(--s2);margin-bottom:12px"><div class="pcell" style="margin-bottom:6px">${avatar(q.raiser, 'lg')}<div><b>${esc(q.raiser.name)}</b> <span class="tag">${ROLE[q.raiser.role]}</span></div></div>${profileRows(q.raiser)}</div>` : ''}
  <p style="white-space:pre-wrap">${esc(q.description)}</p>
  ${q.importantInfo || q.deadline || q.contactVia ? `<div class="imp" style="margin-top:12px"><b>Important information</b><p>${q.deadline ? 'Deadline: <b>' + esc(q.deadline) + '</b><br>' : ''}${q.contactVia ? 'Prefers: <b>' + esc(q.contactVia) + '</b><br>' : ''}${esc(q.importantInfo)}</p></div>` : ''}
  ${q.attachments.map((a) => `<a class="tag" href="${a.url}" target="_blank">📎 ${esc(a.name)}</a> `).join('')}
  ${talkHtml}
  ${handles ? `${suggest ? `<div class="notice">This looks outside your usual scope. <b>${esc(suggest.name)}</b> (${ROLE[suggest.role]}) can solve it. <button class="btn sm" id="sg">Forward to ${esc(suggest.name)}</button></div>` : ''}
  <h3 style="margin-top:18px">Reply to ${esc(q.raiserName)}</h3><div class="grid2"><div><label for="ds">Status</label><select id="ds">${['In progress', 'Waiting for student', 'Resolved', 'Closed'].map((s) => `<option ${s === q.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
  <label for="dn">Message (they will see this)</label><textarea id="dn" rows="2" placeholder="What happened, or what do you need from them?"></textarea><br><button class="btn" id="sv">Save update</button>
  ${options.length ? `<h3 style="margin-top:18px">Can’t solve it? Forward it</h3><label for="fw">Forward to</label><select id="fw"><option value="">Choose a person</option>${groups.map((g) => `<optgroup label="${esc(g)}">${options.filter((o) => o.group === g).map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('')}</optgroup>`).join('')}</select>
  <label for="fn">Why are you forwarding it? *</label><textarea id="fn" rows="2" placeholder="e.g. Scholarship approvals are handled by the zone incharge"></textarea><br><button class="btn ghost" id="fb">Forward query</button>` : ''}` : ''}
  ${raiser && q.status !== 'Closed' ? `<h3 style="margin-top:18px">${q.status === 'Resolved' ? 'Was your query solved?' : 'Reply'}</h3><textarea id="rt" rows="2" placeholder="${q.status === 'Resolved' ? 'Tell us what is still pending (needed to reopen)' : 'Write your reply'}"></textarea><br>
  ${q.status === 'Resolved' ? '<button class="btn" id="rc">Yes, close it</button> <button class="btn ghost" id="ro">No, reopen</button>' : '<button class="btn" id="rs">Send reply</button>'}` : ''}
  <h3 style="margin-top:22px">History</h3><div class="tl">${[...q.history].reverse().map((h) => `<div><b>${esc(h.action)}</b>${h.note ? ' — ' + esc(h.note) : ''}<small>${esc(who(h.by))} · ${when(h.at)}</small></div>`).join('')}</div>`, 760);
  const go = async (body) => { try { await api('/queries/' + q.id, 'PATCH', body); m.remove(); toast('Done'); render(); } catch (x) { toast(x.message, 1); } };
  if ($('#sv')) $('#sv').onclick = () => go({ action: 'update', status: $('#ds').value, note: $('#dn').value });
  if ($('#fb')) $('#fb').onclick = () => go({ action: 'forward', to: $('#fw').value, note: $('#fn').value });
  if ($('#sg')) $('#sg').onclick = () => { const s = $('#fw'); if (!s) return; if (![...s.options].some((o) => o.value == suggest.id)) s.add(new Option(`${suggest.name} — ${ROLE[suggest.role]}`, suggest.id)); s.value = suggest.id; $('#fn').focus(); toast('Add a short reason, then click Forward query'); };
  if ($('#rs')) $('#rs').onclick = () => go({ action: 'reply', text: $('#rt').value }); if ($('#rc')) $('#rc').onclick = () => go({ action: 'close', text: $('#rt').value }); if ($('#ro')) $('#ro').onclick = () => go({ action: 'reopen', text: $('#rt').value });
}

/* ---------- notifications ---------- */
async function notifications(tab = 'All') {
  const all = await api('/notifications'), adm = S.user.role === 'admin';
  const TABS = { All: () => 1, 'For you': (n) => ['Assignment', 'Forwarded'].includes(n.type), Reminders: (n) => n.type === 'Reminder', Escalations: (n) => n.type === 'Escalation', Updates: (n) => n.type === 'Update' };
  const ICO = { Assignment: '📌', Forwarded: '↪️', Reminder: '⏰', Escalation: '🚨', Update: '✅' }, LBL = { Assignment: 'New query for you', Forwarded: 'Query forwarded', Reminder: 'Reminder', Escalation: 'Escalation', Update: 'Update' };
  const list = all.filter(TABS[tab]);
  $('#main').innerHTML = `<div class="top"><div><h1>Notifications</h1><p>Newest first.</p></div>${adm ? '<button class="btn" id="rr">Run reminder check now</button>' : ''}</div>
  <div class="tabs">${Object.keys(TABS).map((t) => `<button class="tab ${t === tab ? 'on' : ''}" data-t="${t}">${t} (${all.filter(TABS[t]).length})</button>`).join('')}</div>
  <div class="card">${list.length ? list.map((n) => `<div class="nrow ${n.type === 'Escalation' ? 'esc' : ''}"><div class="ico">${ICO[n.type] || '🔔'}</div><div style="flex:1"><b>${LBL[n.type] || 'Notification'}</b> <span class="tag">${esc(n.channel)}</span><br>${esc(n.text)}<br><small class="muted">${ago(n.at)}</small></div>${n.qid ? `<button class="btn ghost sm" data-q="${n.qid}">Open #${n.qid}</button>` : ''}</div>`).join('') : '<div class="empty">Nothing here yet.</div>'}</div>`;
  document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => notifications(b.dataset.t))); document.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => detail(b.dataset.q)));
  if (adm) $('#rr').onclick = async () => { const r = await api('/reminders/run', 'POST'); toast(r.sent ? r.sent + ' new notification(s) sent' : 'Nothing needs a reminder right now'); notifications(tab); };
}

/* ---------- people ---------- */
async function people() {
  const r = S.user.role, adm = r === 'admin', f = S.f, ttl = adm ? 'People' : r === 'zone' ? 'My zone' : 'My students';
  $('#main').innerHTML = `<div class="top"><div><h1>${ttl}</h1><p id="cnt">Loading…</p></div>${adm ? '<button class="btn" id="au">Add user</button>' : ''}</div>
  <div class="filters" style="grid-template-columns:2fr 1fr"><input id="pq" type="search" placeholder="Search by name, college, department, phone, company…" value="${esc(f.q || '')}" aria-label="Search">
  ${r === 'anchor' ? '' : `<select id="pr" aria-label="Role"><option value="">All roles</option>${Object.entries(ROLE).filter(([k]) => adm || ['student', 'anchor'].includes(k)).map(([k, v]) => `<option value="${k}" ${f.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`}</div>
  <div class="card" id="res" style="padding:0;overflow:hidden"></div>`;
  const load = async () => {
    f.q = $('#pq').value; f.role = $('#pr') ? $('#pr').value : '';
    const list = await api('/people?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v))); $('#cnt').textContent = `${list.length} ${list.length === 1 ? 'person' : 'people'}`;
    $('#res').innerHTML = list.length ? `<table><tr><th>Name</th><th>Role</th><th>College · Department</th><th>Profile</th>${adm ? '<th></th>' : ''}</tr>${list.map((u) => `<tr class="row" data-u="${u.id}"><td><div class="pcell">${avatar(u, 'sm')}<div><b>${esc(u.name)}</b><br><span class="muted">${esc(u.email)}</span></div></div></td><td>${ROLE[u.role]}</td>
    <td>${esc(u.profile.college || '—')}<br><span class="muted">${esc([u.profile.degree, u.profile.department].filter(Boolean).join(' · '))}</span></td><td><span class="tag ${u.profileDone ? 'st-Resolved' : 'st-New'}">${u.profileDone ? 'Complete' : 'Incomplete'}</span></td>${adm ? `<td><button class="btn danger sm" data-rm="${u.id}">Remove</button></td>` : ''}</tr>`).join('')}</table>` : '<div class="empty">No one found.</div>';
    document.querySelectorAll('tr.row').forEach((x) => (x.onclick = (e) => { if (e.target.dataset.rm) return; const u = list.find((y) => y.id == x.dataset.u); modal(`<div class="top" style="margin-bottom:8px"><div></div><button class="btn ghost sm" data-close>Close</button></div>${profileCard(u)}`, 640); }));
    document.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { const x = list.find((y) => y.id == b.dataset.rm);
      const m = modal(`<h2>Remove ${esc(x.name)}?</h2><p class="muted" style="margin:8px 0">They lose access immediately.${['anchor', 'zone', 'admin', 'alumni'].includes(x.role) ? ' Their open queries will be forwarded to the admin team.' : ''} This cannot be undone.</p><label>Type <b>REMOVE</b> to confirm</label><input id="cf" autocomplete="off"><br><br><button class="btn danger" id="go" disabled>Remove user</button> <button class="btn ghost" data-close>Cancel</button>`);
      $('#cf').oninput = () => ($('#go').disabled = $('#cf').value.trim() !== 'REMOVE'); $('#go').onclick = async () => { try { await api('/users/' + x.id, 'DELETE'); m.remove(); toast('User removed'); load(); } catch (e) { toast(e.message, 1); } }; }));
  };
  let t; $('#pq').addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 250); }); if ($('#pr')) $('#pr').addEventListener('change', load);
  if (adm) $('#au').onclick = () => { const m = modal(`<h2>Add a user</h2><form id="uf"><label for="u1">Name</label><input id="u1" name="name" required><label for="u2">Email</label><input id="u2" name="email" type="email" required><label for="u3">Role</label><select id="u3" name="role" required><option value="">Choose a role</option>${Object.entries(ROLE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <label for="u4">Password <span class="muted">(optional)</span></label><input id="u4" name="password" placeholder="Leave blank to create one automatically"><p class="muted" style="font-size:13px;margin-top:6px">Everyone signs in with email and password. A blank password is generated and shown once.</p><br><button class="btn">Add user</button> <button type="button" class="btn ghost" data-close>Cancel</button></form>`);
    $('#uf').onsubmit = async (e) => { e.preventDefault(); try { const d = await api('/users', 'POST', Object.fromEntries(new FormData(e.target))); m.remove(); modal(`<h2>User added</h2><p class="muted" style="margin:8px 0">Share these details with ${esc(d.name)}. The password is shown only now.</p><div class="card" style="background:var(--s2)"><b>Role:</b> ${ROLE[d.role]}<br><b>Email:</b> ${esc(d.email)}<br><b>Password:</b> <code>${esc(d.password)}</code></div><br><button class="btn" data-close>Done</button>`); load(); } catch (x) { toast(x.message, 1); } }; };
  load();
}

/* ---------- profile ---------- */
function profileView() {
  const u = S.user, p = u.profile || {};
  $('#main').innerHTML = `<div class="top"><div><h1>My profile</h1><p>This is how the Maatram team sees you.</p></div><button class="btn" id="ep">✎ Edit profile</button></div>
  <div class="pcard"><div class="pcover"></div><div class="phead">${avatar(u, 'xl')}<div><h2>${esc(u.name)}</h2><p><span class="tag">${ROLE[u.role]}</span>${p.mentor ? ' <span class="tag st-Resolved">Mentor</span>' : ''}</p><p class="muted">${esc([p.college, [p.degree, p.department].filter(Boolean).join(' · ')].filter(Boolean).join(' — ') || u.email)}</p></div></div>
  <div class="pbody">${u.photo ? '' : '<div class="notice" style="margin:0 0 14px">You have not added a photo yet. <button class="btn sm" id="ep2">Add photo</button></div>'}${profileRows(u)}</div></div>`;
  const go = () => { S.f.edit = true; profile(); }; $('#ep').onclick = go; if ($('#ep2')) $('#ep2').onclick = go;
}
function profile() {
  const u = S.user, M = S.meta, p = u.profile || {}, fields = M.PROFILE[u.role], gated = u.role !== 'admin' && !u.profileDone;
  if (!gated && !S.f.edit) return profileView();
  const years = Array.from({ length: 41 }, (_, i) => 2035 - i), LISTF = { college: M.LISTS.colleges, degree: M.LISTS.degrees, dept: M.LISTS.departments };
  const sel = (id, arr, v, ph, req) => `<select id="${id}" name="${id}" ${req ? 'required' : ''}><option value="">${ph}</option>${arr.map((a) => `<option value="${a[0]}" ${String(a[0]) === String(v) ? 'selected' : ''}>${esc(a[1])}</option>`).join('')}</select>`;
  const field = (f) => { const v = p[f.k] ?? '', rq = f.req ? 'required' : '', lab = `<label for="${f.k}">${f.label}${f.req ? ' *' : ''}</label>`; let h;
    if (f.type === 'checkbox') h = `<label class="chk"><input type="checkbox" id="${f.k}" name="${f.k}" ${v ? 'checked' : ''}> ${f.label}</label>`;
    else if (f.type === 'year') h = lab + sel(f.k, years.map((y) => [y, y]), v, 'Choose year', f.req);
    else if (f.type === 'jobStatus') h = lab + sel(f.k, M.LISTS.jobStatus.map((y) => [y, y]), v, 'Choose one', f.req);
    else if (LISTF[f.type]) { const l = LISTF[f.type], other = v && !l.includes(v); h = lab + `<select id="${f.k}" name="${f.k}" data-other ${rq}><option value="">Choose from the list</option>${l.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__other" ${other ? 'selected' : ''}>Other</option></select><input id="${f.k}_o" class="oth-in" placeholder="Type it here" value="${other ? esc(v) : ''}" ${other ? '' : 'hidden'}>`; }
    else if (f.type === 'tel') h = `${lab}<input id="${f.k}" name="${f.k}" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number" value="${esc(v)}" ${rq} autocomplete="tel"><small class="hint" id="${f.k}_h"></small>`;
    else h = `${lab}<input id="${f.k}" name="${f.k}" type="${f.type === 'url' ? 'url' : 'text'}" value="${esc(v)}" ${rq} autocomplete="off">`;
    return `<div class="fld" ${f.showIf ? `data-k="${f.showIf[0]}" data-v='${JSON.stringify(f.showIf[1])}'` : ''}>${h}</div>`; };
  $('#main').innerHTML = `<div class="top"><div><h1>My profile</h1><p>${gated ? 'Complete the fields marked * to continue.' : 'Keep your details up to date so the right people can help you.'}</p></div></div>
  <form class="card form" id="pf" novalidate><div class="photo-pick" style="margin-bottom:8px"><div id="pv">${avatar(u, 'xl')}</div><div><b>Profile photo</b><br><label class="pickbtn" for="ph">${u.photo ? 'Change photo' : 'Choose photo'}</label><input id="ph" type="file" accept="image/png,image/jpeg,image/webp" hidden>${u.photo ? ' <button type="button" class="btn ghost sm" id="rmph">Remove</button>' : ''}<small class="hint" id="ph_h">JPG, PNG or WEBP</small></div></div><div class="grid2"><div><label for="nm">Full name *</label><input id="nm" name="name" value="${esc(u.name)}" required></div><div><label>Email</label><input value="${esc(u.email)}" disabled></div>${fields.map(field).join('')}</div>
  <br><button class="btn">Save profile</button>${gated ? '' : ' <button type="button" class="btn ghost" id="pc">Cancel</button>'}</form>`;
  wirePhoto('xl'); if ($('#pc')) $('#pc').onclick = () => { S.f = {}; profile(); };
  const other = () => document.querySelectorAll('select[data-other]').forEach((s) => { const t = $('#' + s.id + '_o'), on = s.value === '__other'; t.hidden = !on; t.required = on && s.required; });
  document.querySelectorAll('select[data-other]').forEach((s) => s.addEventListener('change', other)); other();
  const ph = $('#phone'); if (ph) { const chk = () => { ph.value = ph.value.replace(/\D/g, '').slice(0, 10); const n = ph.value.length, h = $('#phone_h'); h.textContent = n === 0 ? '' : n === 10 ? '✓ 10 digits' : `${n} of 10 digits — a mobile number must be exactly 10 digits`; h.className = 'hint ' + (n === 10 ? 'good' : 'bad'); ph.setCustomValidity(n === 10 || (n === 0 && !ph.required) ? '' : 'Enter exactly 10 digits'); }; ph.addEventListener('input', chk); chk(); }
  const vis = () => document.querySelectorAll('.fld[data-k]').forEach((d) => { const el = $('#' + d.dataset.k), v = el.type === 'checkbox' ? el.checked : el.value; d.hidden = !JSON.parse(d.dataset.v).includes(v); }); vis();
  document.querySelectorAll('#pf select,#pf input[type=checkbox]').forEach((e) => e.addEventListener('change', vis));
  $('#pf').onsubmit = async (e) => { e.preventDefault(); const form = e.target; if (!form.checkValidity()) { form.reportValidity(); return; }
    const b = {}; new FormData(form).forEach((v, k) => (b[k] = v)); document.querySelectorAll('select[data-other]').forEach((s) => { if (s.value === '__other') b[s.id] = $('#' + s.id + '_o').value.trim(); });
    fields.filter((f) => f.type === 'checkbox').forEach((f) => (b[f.k] = $('#' + f.k).checked));
    if (newPhoto) b.photo = newPhoto; else if (dropPhoto) b.removePhoto = true;
    try { const d = await api('/profile', 'PUT', b); toast(d.profileDone ? 'Profile saved' : 'Saved — some required fields are still empty'); S.f = {}; S.view = 'profile'; render(); } catch (x) { toast(x.message, 1); } };
}
function passwordModal() {
  const m = modal(`<h2>Change password</h2><label>Current password</label><input id="p1" type="password"><label>New password (6+ characters)</label><input id="p2" type="password"><br><br><button class="btn" id="ps">Save</button> <button class="btn ghost" data-close>Cancel</button>`);
  $('#ps').onclick = async () => { try { await api('/password', 'POST', { old: $('#p1').value, new: $('#p2').value }); m.remove(); toast('Password changed'); } catch (x) { toast(x.message, 1); } };
}
render();