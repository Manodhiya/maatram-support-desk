const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const app = express(); app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
const DB = path.join(__dirname, 'data.json'), UP = path.join(__dirname, 'uploads');
fs.mkdirSync(UP, { recursive: true });
app.use('/uploads', express.static(UP));

// ---- tiny JSON database ----
const hash = (p) => crypto.createHash('sha256').update('maatram' + p).digest('hex');
const H = 3600e3, SLA = { Urgent: 4 * H, High: 24 * H, Medium: 48 * H, Low: 72 * H };
const CATS = ['Admission', 'Scholarship', 'Fees', 'Events', 'Mentoring', 'Technical', 'Other'];
const STATUSES = ['New', 'Assigned', 'In progress', 'Waiting for student', 'Resolved', 'Closed'];
let db;
function save() { fs.writeFileSync(DB, JSON.stringify(db, null, 1)); }
function seed() {
  const now = Date.now(), u = (id, name, role, email) => ({ id, name, role, email, password: hash(role + '123') });
  db = { seq: 10, users: [u(1, 'Admin Anitha', 'admin', 'admin@maatram.org'), u(2, 'Coordinator Karthik', 'coordinator', 'karthik@maatram.org'),
    u(3, 'Coordinator Divya', 'coordinator', 'divya@maatram.org'), u(4, 'Rep Surya', 'student_rep', 'surya@maatram.org')], queries: [], notifications: [] };
  const demo = [['Priya S.', 'Anna University', 'Scholarship', 'WhatsApp', 'High', 'Scholarship status not updated', 30 * H],
    ['Arun K.', 'SRM Institute', 'Admission', 'Phone', 'Urgent', 'Admission documents upload failing', 6 * H],
    ['Meena R.', 'Loyola College', 'Mentoring', 'Email', 'Medium', 'Needs a mentor for data science', 2 * H]];
  demo.forEach((d, i) => { const q = mk({ student: d[0], institution: d[1], category: d[2], channel: d[3], priority: d[4], description: d[5] }, 4, now - d[6]); if (i < 2) assign(q, i + 2, 1, now - d[6] + 1e5); });
  save();
}
function mk(b, by, t = Date.now()) {
  const q = { id: db.seq++, ...b, status: 'New', createdBy: by, assignee: null, attachments: b.attachments || [], createdAt: t, updatedAt: t, due: t + (SLA[b.priority] || SLA.Medium), reminded: 0, escalated: false,
    history: [{ at: t, by, action: 'Query logged', note: '' }] };
  db.queries.push(q); return q;
}
function assign(q, to, by, t = Date.now()) { q.assignee = to; q.status = q.status === 'New' ? 'Assigned' : q.status; q.updatedAt = t; q.history.push({ at: t, by, action: 'Assigned to ' + name(to), note: '' }); }
const name = (id) => (db.users.find((u) => u.id === id) || {}).name || '—';
const open = (q) => !['Resolved', 'Closed'].includes(q.status);
function autoAssign() { // rule: coordinator with the lightest open workload
  const c = db.users.filter((u) => u.role === 'coordinator').map((u) => [u, db.queries.filter((q) => q.assignee === u.id && open(q)).length]).sort((a, b) => a[1] - b[1]);
  return c.length ? c[0][0].id : null;
}
function notify(to, channel, text, qid) {
  db.notifications.unshift({ id: db.seq++, to, channel, text, qid, at: Date.now() });
  console.log(`[${channel} -> ${typeof to === 'number' ? name(to) : to}] ${text}`); // plug Twilio / SMTP here
}
if (fs.existsSync(DB)) db = JSON.parse(fs.readFileSync(DB)); else seed();

// ---- auth ----
const sessions = {};
function auth(...roles) {
  return (req, res, next) => {
    const u = sessions[(req.headers.authorization || '').replace('Bearer ', '')];
    if (!u) return res.status(401).json({ error: 'Please sign in' });
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Not allowed for your role' });
    req.user = u; next();
  };
}
const pub = (u) => ({ id: u.id, name: u.name, role: u.role, email: u.email });
app.post('/api/login', (req, res) => {
  const u = db.users.find((x) => x.email === (req.body.email || '').toLowerCase().trim() && x.password === hash(req.body.password || ''));
  if (!u) return res.status(401).json({ error: 'Wrong email or password' });
  if (req.body.role && u.role !== req.body.role) return res.status(403).json({ error: 'This account is not registered for the selected role' });
  const t = crypto.randomBytes(24).toString('hex'); sessions[t] = u; res.json({ token: t, user: pub(u) });
});
app.get('/api/meta', auth(), (req, res) => res.json({ CATS, STATUSES, users: db.users.filter((u) => u.role !== 'student_rep').map(pub) }));

// ---- queries ----
function visible(u) { return db.queries.filter((q) => u.role === 'admin' || (u.role === 'coordinator' ? q.assignee === u.id : q.createdBy === u.id)); }
app.get('/api/queries', auth(), (req, res) => {
  const { q = '', status, category, coordinator, from, to } = req.query, s = q.toLowerCase();
  const list = visible(req.user).filter((x) => (!s || [x.student, x.institution, x.description, '#' + x.id].join(' ').toLowerCase().includes(s)) && (!status || x.status === status) &&
    (!category || x.category === category) && (!coordinator || String(x.assignee) === coordinator) && (!from || x.createdAt >= Date.parse(from)) && (!to || x.createdAt <= Date.parse(to) + 864e5));
  res.json(list.sort((a, b) => b.updatedAt - a.updatedAt).map((x) => ({ ...x, assigneeName: name(x.assignee), overdue: open(x) && Date.now() > x.due })));
});
app.post('/api/queries', auth(), (req, res) => {
  const b = req.body; if (!b.student || !b.description) return res.status(400).json({ error: 'Student and description are required' });
  const files = (b.files || []).slice(0, 3).map((f) => { const n = Date.now() + '-' + f.name.replace(/[^\w.-]/g, '_'); fs.writeFileSync(path.join(UP, n), Buffer.from(f.data.split(',')[1], 'base64')); return { name: f.name, url: '/uploads/' + n }; });
  const q = mk({ student: b.student, institution: b.institution || '', category: b.category || 'Other', channel: b.channel || 'Other', priority: b.priority || 'Medium', description: b.description, attachments: files }, req.user.id);
  const a = autoAssign(); if (a) { assign(q, a, 0); notify(a, 'Email', `New query #${q.id} assigned: ${q.description.slice(0, 50)}`, q.id); }
  save(); res.json(q);
});
app.patch('/api/queries/:id', auth('admin', 'coordinator'), (req, res) => {
  const q = visible(req.user).find((x) => x.id == req.params.id); if (!q) return res.status(404).json({ error: 'Query not found' });
  const { status, note, assignee } = req.body, t = Date.now();
  if (assignee && req.user.role === 'admin' && +assignee !== q.assignee) assign(q, +assignee, req.user.id);
  if (status && status !== q.status) {
    q.status = status; q.history.push({ at: t, by: req.user.id, action: 'Status → ' + status, note: note || '' });
    if (status === 'Resolved') notify(q.student + ' (student)', 'WhatsApp', `Hi ${q.student}, your query #${q.id} has been resolved.`, q.id);
    if (status === 'Waiting for student') notify(q.student + ' (student)', 'SMS', `Query #${q.id}: we need your reply to continue.`, q.id);
  } else if (note) q.history.push({ at: t, by: req.user.id, action: 'Note added', note });
  q.updatedAt = t; save(); res.json(q);
});

// ---- dashboard / users / notifications ----
app.get('/api/stats', auth('admin', 'coordinator'), (req, res) => {
  const all = visible(req.user), o = all.filter(open), done = all.filter((q) => !open(q));
  const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
  const times = done.map((q) => (q.history.find((h) => /Resolved|Closed/.test(h.action)) || { at: q.updatedAt }).at - q.createdAt);
  res.json({ total: all.length, open: o.length, overdue: o.filter((q) => Date.now() > q.due).length, resolved: done.length,
    avgHours: times.length ? +(times.reduce((a, b) => a + b, 0) / times.length / H).toFixed(1) : 0,
    perCoordinator: count(o, (q) => name(q.assignee)), perCategory: count(all, (q) => q.category) });
});
app.get('/api/users', auth('admin'), (req, res) => res.json(db.users.map(pub)));
app.post('/api/users', auth('admin'), (req, res) => {
  const { name: n, email, role, password } = req.body; if (!n || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (db.users.some((u) => u.email === email.toLowerCase())) return res.status(400).json({ error: 'That email already exists' });
  const u = { id: db.seq++, name: n, email: email.toLowerCase(), role, password: hash(password) }; db.users.push(u); save(); res.json(pub(u));
});
app.get('/api/notifications', auth(), (req, res) => res.json(db.notifications.filter((n) => req.user.role === 'admin' || n.to === req.user.id).slice(0, 50)));

// ---- reminder + escalation job (runs every minute) ----
setInterval(() => {
  const now = Date.now(); let changed = false;
  db.queries.filter(open).forEach((q) => {
    if (q.assignee && now - q.updatedAt > 24 * H && now - q.reminded > 24 * H) { q.reminded = now; notify(q.assignee, 'Email', `Reminder: query #${q.id} has had no update for 24h.`, q.id); changed = true; }
    if (now > q.due + 24 * H && !q.escalated) { q.escalated = true; q.history.push({ at: now, by: 0, action: 'Escalated to admin', note: 'Overdue by more than 24h' });
      db.users.filter((u) => u.role === 'admin').forEach((a) => notify(a.id, 'WhatsApp', `ESCALATION: query #${q.id} is overdue (${name(q.assignee)}).`, q.id)); changed = true; }
    if (q.status === 'Waiting for student' && now - q.updatedAt > 48 * H && now - q.reminded > 48 * H) { q.reminded = now; notify(q.student + ' (student)', 'SMS', `Reminder: query #${q.id} still needs your reply.`, q.id); changed = true; }
  });
  if (changed) save();
}, 60e3);
app.listen(process.env.PORT || 3000, () => console.log('Maatram Support running on http://localhost:3000'));
