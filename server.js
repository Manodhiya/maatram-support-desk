const express = require('express'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const app = express(); app.use(express.json({ limit: '8mb' }));
// serves the searchable-dropdown script and adds it to the app page automatically
app.get('/searchable-select.js', (req, res) => res.sendFile(path.join(__dirname, 'searchable-select.js')));
app.get(['/', '/index.html'], (req, res, next) => {
  const f = path.join(__dirname, 'public', 'index.html'); if (!fs.existsSync(f)) return next();
  let html = fs.readFileSync(f, 'utf8'); const tag = '<script src="/searchable-select.js"></script>';
  if (!html.includes('searchable-select.js')) html = html.includes('</body>') ? html.replace('</body>', tag + '</body>') : html + tag;
  res.type('html').send(html);
});
app.use(express.static(path.join(__dirname, 'public')));
const DB = path.join(__dirname, 'data.json'), UP = path.join(__dirname, 'uploads');
fs.mkdirSync(UP, { recursive: true }); app.use('/uploads', express.static(UP));
const AV = path.join(UP, 'avatars'); fs.mkdirSync(AV, { recursive: true });
// saves a profile photo sent as a data URL; returns '' on success or an error message
function savePhoto(u, data) {
  const m = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+\/=]+)$/.exec(data || ''); if (!m) return 'Photo must be a PNG, JPG or WEBP image';
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 2 * 1024 * 1024) return 'Photo must be smaller than 2 MB';
  if ((u.photo || '').startsWith('/uploads/avatars/')) fs.unlink(path.join(__dirname, u.photo), () => {});
  const n = `${u.id}-${Date.now()}.${m[1] === 'webp' ? 'webp' : m[1] === 'png' ? 'png' : 'jpg'}`; fs.writeFileSync(path.join(AV, n), buf); u.photo = '/uploads/avatars/' + n; return '';
}

// ================= configuration (edit these lists to match Maatram) =================
const H = 3600e3, SLA = { Urgent: 4 * H, High: 24 * H, Medium: 48 * H, Low: 72 * H };
const CATS = ['Admission', 'Scholarship', 'Fees', 'Events', 'Mentoring', 'Career guidance', 'Technical', 'Other'];
const STATUSES = ['New', 'In progress', 'Waiting for student', 'Resolved', 'Closed'];
const ROLES = { student: 'Student', anchor: 'Anchor', zone: 'Zone Incharge', admin: 'Admin', alumni: 'Alumni' };
// Which roles can solve which categories, and who a student should ask first
const CODES = { anchor: process.env.ANCHOR_CODE || 'ANCHOR-2026', zone: process.env.ZONE_CODE || 'ZONE-2026', admin: process.env.ADMIN_CODE || 'ADMIN-2026' }; // staff sign-up codes: change these
const CAP = { anchor: ['Events', 'Mentoring', 'Technical', 'Other'], zone: ['Admission', 'Scholarship', 'Events', 'Mentoring', 'Technical', 'Other'], admin: CATS, alumni: ['Mentoring', 'Career guidance'] };
const REC = { Admission: 'zone', Scholarship: 'zone', Fees: 'admin', Events: 'anchor', Mentoring: 'anchor', 'Career guidance': 'mentor', Technical: 'anchor', Other: 'anchor' };
const LISTS = {
  degrees: ["B.E.", "B.Tech.", "M.Tech", "B.Com", "B.SC", "BBA", "B.A", "BCA", "M.Com", "MA.HR(OD)"],
  departments: ["Accounting Finance", "Actuarial Management", "Aeronautical", "Aerospace", "Agricultural", "AI & DS", "AI & ML", "Automobile", "Bank Management", "BBA", "BCA", "Bio Chemistry", "Bio technology", "Biomedical", "Biomedical Engineering", "Business Process Services", "Capital Markets", "CCE", "Chemical", "Chemistry", "Civil", "Clinical Nutrition & Dietetics", "Commerce", "Commerce Computer Application", "Computer Application", "Computer Applications", "Computer Science", "Computer Science and Application", "Computer Technology", "Corporate Secretaryship", "CSBS", "CSD", "CSE", "CSE (IOT)", "CSE Integrated", "CSE(cyber security)", "CSE. AI & DS", "CSE. AI & ML", "Cyber Security", "Data Science", "E & I", "E-Commerce", "ECE", "Economics", "EEE", "EICE", "EIE", "Electronics &VLSI", "Electronics. VLSI design & Technology", "English Literature", "Fashion technology", "Financial Accounting", "Financial Analytics", "Financial Marketing Analytics", "Food Technology", "Forensic Science", "General", "Honours", "HR & OD", "HRM", "ICE", "Information System Management", "Information Technology", "International Business", "Management", "Mathematics", "Mechanical", "Mechanical & Automation", "Mechatronics", "Medical Laboratory Technology", "Microbiology", "Nursing", "Nutrition and Dietetics", "Pharmaceutical", "Physics", "Political science", "Professional Accounting", "Psychology", "Retail Management", "Robotics & Automation", "Sports Science", "Tamil Creative Writing", "Tamil Literature", "Textile technology", "Visual Communication", "Zoology"],
  colleges: ["AVS Engineering College", "Chennai Institute of Technology", "Dr. MGR Janaki College of Arts and Science for Women", "Dr.G. R. Damodaran College of Science", "Hindusthan Institute of Technology", "J.J.College of Engineering and Technology", "J.N.N Institute of Engineering", "Jeppiaar Arts and Science College", "Jeppiaar Engineering college", "Jeppiaar Institute of Technology", "Jeppiaar University", "K.S.R. College of Arts and Science for women", "K.S.Rangasamy College of Technology", "Kalasalingam Academy of Research and Education", "Karpagam Arts and Science College", "Karpagam College of Engineering", "Karpagam Institute of Technology", "KCG College of Technology", "Knowledge Institute of Technology", "Kumaraguru College of Liberal Arts and Science", "Kumaraguru College of Technology", "M.A.M College of Engineering and Technology", "Madras School of Social Work", "Muthayammal College of Arts & Science", "Nandha College of Arts and Science", "Nandha Engineering College", "Omandurar Government Medical College", "Peri Institute of Technology", "Prince Shri Venkateshwara Padmavathy Engineering College", "PSNA College Of Engineering and Technology", "Rajalakshmi Engineering College", "Rajalakshmi Institute of Technology", "Rathinam College of Arts and Science", "Rathinam Engineering College", "Sathyabama Institute of Science and Technology", "Sona College of Technology", "Sri Krishna Arts and Science College", "Sri Krishna College of Engineering and Technology", "Sri Krishna College of Technology", "Sri Sairam Engineering College", "Sri Sairam Institute of Technology", "Sri Venkateswaraa College of Technology", "SRM Arts and Science", "SRM Easwari Engineering College", "SRM TRP Engineering College", "SRM Valliammai Engineering College", "St Joseph's College of Engineering", "St Joseph's Institute of Technology", "Stanley Medical College", "Thanjavur Medical College", "Velammal Engineering College", "Velammal institute of technology", "Vels University"],
  jobStatus: ['Working', 'Higher studies', 'Looking for opportunities', 'Self-employed'] };
const F = (k, label, type, req, x = {}) => ({ k, label, type, req: !!req, ...x });
const common = [F('phone', 'Mobile number', 'tel', 1), F('college', 'College', 'college', 1), F('degree', 'Degree', 'degree', 1), F('department', 'Department', 'dept', 1)];
const PROFILE = {
  student: [...common, F('specialisation', 'Specialisation', 'text', 0), F('yearFrom', 'Year of joining', 'year', 1), F('yearTo', 'Year of passing out', 'year', 1), F('anchorName', 'Your anchor’s name', 'text', 1), F('zoneName', 'Your zone incharge’s name', 'text', 1)],
  alumni: [...common, F('specialisation', 'Specialisation', 'text', 0), F('yearTo', 'Year passed out', 'year', 1), F('jobStatus', 'What are you doing now?', 'jobStatus', 1), F('company', 'Company / organisation', 'text', 0, { showIf: ['jobStatus', ['Working', 'Self-employed']] }),
    F('jobRole', 'Your role', 'text', 0, { showIf: ['jobStatus', ['Working', 'Self-employed']] }), F('city', 'City', 'text', 0), F('linkedin', 'LinkedIn link', 'url', 0), F('mentor', 'I can mentor Maatram students', 'checkbox', 0), F('expertise', 'Areas I can guide in', 'text', 0, { showIf: ['mentor', [true]] })],
  anchor: [...common, F('yearFrom', 'Year of joining', 'year', 1), F('yearTo', 'Year of passing out', 'year', 1), F('zoneName', 'Zone incharge you report to (name)', 'text', 0)],
  zone: [F('phone', 'Mobile number', 'tel', 1), F('college', 'College you are in charge of', 'college', 1), F('city', 'City', 'text', 0), F('designation', 'Designation', 'text', 0)],
  admin: [F('phone', 'Mobile number', 'tel', 0), F('designation', 'Designation', 'text', 0)] };

// ================= database (simple JSON file) =================
const hash = (p) => crypto.createHash('sha256').update('maatram' + p).digest('hex');
let db; const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));
const U = (id) => db.users.find((u) => u.id === id), name = (id) => (U(id) || {}).name || '—';
const open = (q) => !['Resolved', 'Closed'].includes(q.status), entry = (u) => ({ id: u.id, name: u.name, role: u.role });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, photo: u.photo || '', profile: u.profile || {}, profileDone: profileDone(u) });
function profileDone(u) {
  const p = u.profile || {}, f = PROFILE[u.role] || [];
  const ok = f.filter((x) => x.req).every((x) => p[x.k] !== undefined && p[x.k] !== '' && p[x.k] !== null);
  return ok && (u.role !== 'alumni' || !['Working', 'Self-employed'].includes(p.jobStatus) || !!(p.company && p.jobRole));
}
const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z]/g, '');
const nameMatch = (a, b) => { a = norm(a); b = norm(b); return a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a)); };
const zoneFor = (college) => db.users.find((u) => u.role === 'zone' && college && (u.profile || {}).college === college);
function myPeople(me) { // who is linked to this anchor / zone incharge
  const mp = me.profile || {};
  return db.users.filter((u) => u.id !== me.id && (me.role === 'admin' || (me.role === 'zone' ? mp.college && u.profile && u.profile.college === mp.college && ['student', 'anchor'].includes(u.role) : me.role === 'anchor' && u.role === 'student' && nameMatch((u.profile || {}).anchorName, me.name))));
}
function leastLoaded(role) {
  const c = db.users.filter((u) => u.role === role).map((u) => [u, db.queries.filter((q) => q.toId === u.id && open(q)).length]).sort((a, b) => a[1] - b[1]);
  return c.length ? c[0][0] : null;
}
function notify(to, channel, text, qid, type = 'Update') { db.notifications.unshift({ id: db.seq++, to, channel, text, qid, type, at: Date.now() }); console.log(`[${channel} -> ${name(to)}] ${text}`); }
function mk(raiser, b, to, t = Date.now()) {
  const target = U(to), q = { id: db.seq++, raiserId: raiser.id, raiserName: raiser.name, raiserRole: raiser.role, category: b.category, categoryOther: b.categoryOther || '', priority: b.priority || 'Medium', description: b.description,
    deadline: b.deadline || '', contactVia: b.contactVia || '', importantInfo: b.importantInfo || '', attachments: b.attachments || [], status: 'New', toId: to, route: [entry(target)], createdAt: t, updatedAt: t, due: t + (SLA[b.priority] || SLA.Medium), reminded: 0, escLevel: 0,
    history: [{ at: t, by: raiser.id, action: `Query raised and sent to ${target.name} (${ROLES[target.role]})`, note: '' }] };
  db.queries.push(q); notify(to, 'Email', `New query #${q.id} from ${raiser.name}: ${q.description.slice(0, 60)}`, q.id, 'Assignment'); return q;
}
function forward(q, to, by, note, t = Date.now(), auto = false) {
  const from = U(q.toId) || { name: '—' }, target = U(to);
  q.toId = to; q.route.push(entry(target)); q.status = 'New'; q.updatedAt = t;
  q.history.push({ at: t, by, action: `${auto ? 'Auto-escalated' : 'Forwarded'}: ${from.name} → ${target.name} (${ROLES[target.role]})`, note });
  notify(to, 'Email', `Query #${q.id} from ${q.raiserName} was ${auto ? 'escalated' : 'forwarded'} to you.`, q.id, 'Forwarded');
  if (U(q.raiserId)) notify(q.raiserId, 'In-app', `Your query #${q.id} was forwarded to ${target.name} (${ROLES[target.role]}) who can help further.`, q.id, 'Update');
}
function seed() {
  const now = Date.now(), pw = (r) => hash(r + '123'); let id = 1;
  const add = (role, n, email, profile) => { db.users.push({ id: id++, name: n, email, role, password: pw(role), profile }); };
  db = { seq: 100, users: [], queries: [], notifications: [] };
  add('admin', 'Anitha Rao', 'admin@maatram.org', { phone: '9000000001', designation: 'Office Head' });
  add('admin', 'Suresh Babu', 'suresh@maatram.org', { phone: '9000000002', designation: 'Office Coordinator' });
  add('zone', 'Divya Narayanan', 'zone@maatram.org', { phone: '9000000003', college: 'Rajalakshmi Engineering College', city: 'Chennai', designation: 'Zone Incharge' });
  add('zone', 'Karthik Raj', 'karthik@maatram.org', { phone: '9000000004', college: 'SRM Easwari Engineering College', city: 'Chennai', designation: 'Zone Incharge' });
  add('anchor', 'Meena Iyer', 'anchor@maatram.org', { phone: '9000000005', college: 'Rajalakshmi Engineering College', degree: 'B.E.', department: 'CSE', yearFrom: '2023', yearTo: '2027', zoneName: 'Divya Narayanan' });
  add('anchor', 'Arjun Das', 'arjun@maatram.org', { phone: '9000000006', college: 'SRM Easwari Engineering College', degree: 'B.Tech.', department: 'Information Technology', yearFrom: '2023', yearTo: '2027', zoneName: 'Karthik Raj' });
  add('student', 'Priya Sundar', 'student@maatram.org', { phone: '9000000007', college: 'Rajalakshmi Engineering College', degree: 'B.E.', department: 'CSE', specialisation: 'Data Science', yearFrom: '2024', yearTo: '2028', anchorName: 'Meena Iyer', zoneName: 'Divya Narayanan' });
  add('student', 'Rahul Kumar', 'rahul@maatram.org', { phone: '9000000008', college: 'SRM Easwari Engineering College', degree: 'B.Tech.', department: 'Information Technology', specialisation: 'Cyber Security', yearFrom: '2023', yearTo: '2027', anchorName: 'Arjun Das', zoneName: 'Karthik Raj' });
  add('student', 'Nisha Thomas', 'nisha@maatram.org', {});
  add('alumni', 'Vikram Selvam', 'alumni@maatram.org', { phone: '9000000010', college: 'Rajalakshmi Engineering College', degree: 'B.E.', department: 'CSE', yearTo: '2021', jobStatus: 'Working', company: 'Zoho', jobRole: 'Software Engineer', city: 'Chennai', mentor: true, expertise: 'Web development, interview preparation' });
  add('alumni', 'Sneha Raman', 'sneha@maatram.org', { phone: '9000000011', college: 'SRM Easwari Engineering College', degree: 'B.Tech.', department: 'Information Technology', yearTo: '2020', jobStatus: 'Higher studies', city: 'Bengaluru', mentor: true, expertise: 'Higher studies abroad, GRE' });
  const priya = U(7), rahul = U(8), vik = U(10), t = (h) => now - h * H;
  let q = mk(priya, { category: 'Scholarship', priority: 'High', description: 'My scholarship status has not been updated for three weeks.', importantInfo: 'Last date to submit documents is next Friday.', contactVia: 'WhatsApp' }, 5, t(30));
  forward(q, 3, 5, 'Scholarship approvals are handled by the zone incharge of your college.', t(29)); q.status = 'In progress'; q.updatedAt = t(28); q.history.push({ at: t(28), by: 3, action: 'Status → In progress', note: 'Checking the approval list with the scholarship team.' });
  q = mk(priya, { category: 'Events', priority: 'Low', description: 'What time does Saturday’s mentoring session start and what is the link?' }, 5, t(50));
  q.status = 'Resolved'; q.updatedAt = t(46); q.history.push({ at: t(46), by: 5, action: 'Status → Resolved', note: 'It starts at 10 am. Link sent on the batch WhatsApp group.' });
  q = mk(priya, { category: 'Mentoring', priority: 'Medium', description: 'I would like a mentor for data science and internships.' }, 10, t(8)); q.status = 'Waiting for student'; q.updatedAt = t(5); q.history.push({ at: t(5), by: 10, action: 'Status → Waiting for student', note: 'Could you share your resume and the topics you have already covered?' });
  q = mk(rahul, { category: 'Fees', priority: 'Urgent', description: 'Fee receipt not received even after the online payment went through.', deadline: '', contactVia: 'Phone call' }, 1, t(80)); q.status = 'In progress'; q.updatedAt = t(70);
  mk(rahul, { category: 'Admission', priority: 'Urgent', description: 'Admission documents fail to upload on the portal.', importantInfo: 'The portal closes tomorrow.' }, 4, t(6));
  mk(vik, { category: 'Events', priority: 'Medium', description: 'I would like to conduct a session on interview preparation for juniors.' }, 2, t(3));
  save();
}
if (fs.existsSync(DB)) db = JSON.parse(fs.readFileSync(DB)); else seed();
// clean up data saved by the older version of the app (old roles, queries without a route) so pages do not crash
(function migrate() {
  db.users = db.users.filter((u) => ROLES[u.role]); db.users.forEach((u) => { if (!u.profile) u.profile = {}; });
  db.queries = db.queries.filter((q) => Array.isArray(q.route) && q.raiserId && U(q.raiserId));
  db.notifications = db.notifications.filter((n) => typeof n.to === 'number' && U(n.to)); save();
})();

// Dummy anchors, zone incharges, admins and alumni, added once (skipped if the email already exists), so every "Who should solve this?" dropdown has people in it.
(function demoPeople() {
  let added = 0, ph = 9000000100;
  const put = (role, name, profile) => {
    const email = name.toLowerCase().replace(/[^a-z]+/g, '.') + '@maatram.org'; if (db.users.some((u) => u.email === email || u.name === name)) return;
    db.users.push({ id: db.seq++, name, email, role, password: hash(role + '123'), profile: { phone: String(ph++), ...profile } }); added++;
  };
  const SATH = 'Sathyabama Institute of Science and Technology', RAJ = 'Rajalakshmi Engineering College', SRM = 'SRM Easwari Engineering College', SAI = 'Sri Sairam Engineering College', VEL = 'Velammal Engineering College';
  [['Vaitheeswari R', SATH, 'Chennai'], ['Divya Narayanan', RAJ, 'Chennai'], ['Karthik Raj', SRM, 'Chennai'], ['Lakshmi Priya', SAI, 'Chennai'], ['Rohit Menon', VEL, 'Chennai']]
    .forEach(([n, college, city]) => put('zone', n, { college, city, designation: 'Zone Incharge' }));
  [['Shalini S', SATH, 'B.E.', 'ECE', 2024, 2028, 'Vaitheeswari R'], ['Imran Basha', SATH, 'B.Tech.', 'Information Technology', 2023, 2027, 'Vaitheeswari R'], ['Meena Iyer', RAJ, 'B.E.', 'CSE', 2023, 2027, 'Divya Narayanan'],
    ['Pooja Lakshmi', RAJ, 'B.E.', 'AI & DS', 2024, 2028, 'Divya Narayanan'], ['Arjun Das', SRM, 'B.Tech.', 'Information Technology', 2023, 2027, 'Karthik Raj'], ['Harini K', SAI, 'B.E.', 'ECE', 2024, 2028, 'Lakshmi Priya'], ['Naveen Kumar', VEL, 'B.E.', 'Mechanical', 2022, 2026, 'Rohit Menon']]
    .forEach(([n, college, degree, department, a, b, zoneName]) => put('anchor', n, { college, degree, department, yearFrom: String(a), yearTo: String(b), zoneName }));
  [['Suresh Babu', 'Office Coordinator'], ['Revathi N', 'Student Support Lead']].forEach(([n, designation]) => put('admin', n, { designation }));
  [['Vikram Selvam', RAJ, 'B.E.', 'CSE', 2021, 'Zoho', 'Software Engineer', 'Chennai', 'Web development, interview preparation'], ['Sneha Raman', SRM, 'B.Tech.', 'Information Technology', 2020, 'Infosys', 'Systems Engineer', 'Bengaluru', 'Career planning, higher studies'],
    ['Karan Mehta', SATH, 'B.E.', 'ECE', 2019, 'TCS', 'Data Analyst', 'Hyderabad', 'Data analytics, resume reviews'], ['Divya Bharathi', SAI, 'B.E.', 'CSE', 2022, 'Accenture', 'Business Analyst', 'Chennai', 'Consulting, communication skills'],
    ['Aravind S', VEL, 'B.E.', 'Mechanical', 2018, 'Freshworks', 'Product Designer', 'Chennai', 'Design careers, portfolios']]
    .forEach(([n, college, degree, department, yearTo, company, jobRole, city, expertise]) => put('alumni', n, { college, degree, department, yearTo: String(yearTo), jobStatus: 'Working', company, jobRole, city, mentor: true, expertise }));
  if (added) { save(); console.log(`Added ${added} dummy people (password = role + 123, e.g. anchor123).`); }
})();

// ================= auth =================
const sessions = {};
function auth(...roles) {
  return (req, res, next) => {
    const u = sessions[(req.headers.authorization || '').replace('Bearer ', '')];
    if (!u) return res.status(401).json({ error: 'Please sign in' });
    if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'Not allowed for your role' });
    req.user = u; next();
  };
}
const session = (u, res) => { const t = crypto.randomBytes(24).toString('hex'); sessions[t] = u; res.json({ token: t, user: pub(u) }); };
app.post('/api/login', (req, res) => {
  const u = db.users.find((x) => x.email === (req.body.email || '').toLowerCase().trim() && x.password === hash(req.body.password || ''));
  if (!u) return res.status(401).json({ error: 'Wrong email or password' });
  if (u.role !== req.body.role) return res.status(403).json({ error: 'This account is not registered as ' + (ROLES[req.body.role] || 'that role') });
  session(u, res);
});
app.post('/api/register', (req, res) => {
  const { role, name: n, email, password, code } = req.body;
  if (!ROLES[role] || !n || !email || (password || '').length < 6) return res.status(400).json({ error: 'Choose your role and enter name, email and a password of 6+ characters' });
  if (CODES[role] && code !== CODES[role]) return res.status(403).json({ error: `Enter the registration code for ${ROLES[role]}s. Ask the Maatram office for it.` });
  if (db.users.some((u) => u.email === email.toLowerCase().trim())) return res.status(400).json({ error: 'An account with this email already exists' });
  const u = { id: db.seq++, name: n.trim(), email: email.toLowerCase().trim(), role, password: hash(password), profile: {} };
  if (req.body.photo) { const err = savePhoto(u, req.body.photo); if (err) return res.status(400).json({ error: err }); }
  db.users.push(u); save(); session(u, res);
});
app.get('/api/me', auth(), (req, res) => res.json(pub(req.user)));
app.get('/api/meta', auth(), (req, res) => res.json({ CATS, STATUSES, ROLES, REC, CAP, LISTS, PROFILE,
  anchors: db.users.filter((u) => u.role === 'anchor').map((u) => ({ id: u.id, name: u.name, college: (u.profile || {}).college || '', years: (u.profile || {}).yearFrom ? `${u.profile.yearFrom}–${u.profile.yearTo}` : '' })),
  zones: db.users.filter((u) => u.role === 'zone').map((u) => ({ id: u.id, name: u.name, college: (u.profile || {}).college || '' })),
  admins: db.users.filter((u) => u.role === 'admin').map((u) => ({ id: u.id, name: u.name })),
  mentors: db.users.filter((u) => u.role === 'alumni' && (u.profile || {}).mentor && u.id !== req.user.id).map((u) => ({ id: u.id, name: u.name, expertise: (u.profile || {}).expertise || '', company: (u.profile || {}).company || (u.profile || {}).jobStatus || '' })),
  handlers: db.users.filter((u) => u.role !== 'student').map((u) => ({ id: u.id, name: u.name, role: u.role })),
  }));
app.put('/api/profile', auth(), (req, res) => {
  const u = req.user, p = {};
  PROFILE[u.role].forEach((f) => { let v = req.body[f.k]; if (f.type === 'checkbox') v = !!v; else if (f.type.startsWith('user')) v = v === 'none' ? 'none' : +v || ''; else v = String(v || '').trim().slice(0, 200); p[f.k] = v; });
  if (p.phone && !/^\d{10}$/.test(p.phone)) return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
  if (req.body.photo) { const err = savePhoto(u, req.body.photo); if (err) return res.status(400).json({ error: err }); }
  else if (req.body.removePhoto) { delete u.photo; }
  if (req.body.name && req.body.name.trim()) u.name = req.body.name.trim();
  u.profile = p; save(); res.json(pub(u));
});
app.post('/api/password', auth(), (req, res) => {
  const u = U(req.user.id);
  if (u.password !== hash(req.body.old || '')) return res.status(400).json({ error: 'Your current password is wrong' });
  if ((req.body.new || '').length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  u.password = hash(req.body.new); save(); res.json({ ok: true });
});

// ================= queries =================
const isHandler = (u) => u.role !== 'student' && u.role !== 'alumni' || false;
function canSee(u, q) {
  if (u.role === 'admin' || q.raiserId === u.id || q.toId === u.id || q.route.some((r) => r.id === u.id)) return true;
  const p = (U(q.raiserId) || {}).profile || {};
  return (u.role === 'zone' && !!p.college && p.college === (u.profile || {}).college) || (u.role === 'anchor' && nameMatch(p.anchorName, u.name));
}
function view(q, u, full) {
  const to = U(q.toId) || { name: '—', role: '' }, r = U(q.raiserId), rp = (r && r.profile) || {};
  const o = { ...q, toName: to.name, toRole: to.role, overdue: open(q) && Date.now() > q.due };
  const lr = [...q.history].reverse().find((h) => h.note && h.by && h.by !== q.raiserId && /Status|Message/.test(h.action)); o.lastReply = lr ? { by: name(lr.by), note: lr.note, at: lr.at } : null;
  if (u.id !== q.raiserId && r) o.raiser = { id: r.id, name: r.name, role: r.role, email: r.email, photo: r.photo || '', profile: rp };
  return o;
}
app.get('/api/queries', auth(), (req, res) => {
  const { q = '', status, category, handler, from, scope } = req.query, s = q.toLowerCase(), me = req.user;
  const list = db.queries.filter((x) => canSee(me, x) && (scope === 'with' ? x.toId === me.id : scope === 'raised' ? x.raiserId === me.id : true)
    && (!s || [x.raiserName, x.description, x.category, x.categoryOther, '#' + x.id, (U(x.raiserId) || { profile: {} }).profile.college].join(' ').toLowerCase().includes(s))
    && (!status || x.status === status) && (!category || x.category === category) && (!handler || String(x.toId) === handler) && (!from || x.createdAt >= Date.parse(from)));
  res.json(list.sort((a, b) => b.updatedAt - a.updatedAt).map((x) => view(x, me)));
});
app.post('/api/queries', auth('student', 'alumni'), (req, res) => {
  const b = req.body, me = req.user, p = me.profile || {};
  if (!profileDone(me)) return res.status(403).json({ error: 'Please complete your profile first' });
  if (!b.category || !b.description) return res.status(400).json({ error: 'Category and description are required' });
  if (b.category === 'Other' && !(b.categoryOther || '').trim()) return res.status(400).json({ error: 'Please say what the "Other" category is' });
  const to = U(+b.toId), want = { anchor: 'anchor', zone: 'zone', admin: 'admin', alumni: 'alumni' }[b.sendRole];
  if (!to || !want || to.role !== want || to.id === me.id || (to.role === 'alumni' && !(to.profile || {}).mentor)) return res.status(400).json({ error: 'Please choose who should solve this, and then the person' });
  const files = (b.files || []).slice(0, 3).map((f) => { const n = Date.now() + '-' + f.name.replace(/[^\w.-]/g, '_'); fs.writeFileSync(path.join(UP, n), Buffer.from(f.data.split(',')[1], 'base64')); return { name: f.name, url: '/uploads/' + n }; });
  const q = mk(me, { ...b, categoryOther: b.category === 'Other' ? b.categoryOther.trim() : '', attachments: files }, to.id);
  save(); res.json(view(q, me));
});
function options(q, me) { // who this query can be forwarded to
  const cap = (u) => (CAP[u.role] || []).includes(q.category), col = ((U(q.raiserId) || {}).profile || {}).college, out = [];
  const tag = (u) => { const p = u.profile || {}; return u.role === 'anchor' ? `${u.name} — ${p.college || ''}${p.yearFrom ? ' (' + p.yearFrom + '–' + p.yearTo + ')' : ''}` : u.role === 'zone' ? `${u.name} — ${p.college || ''}` : u.role === 'alumni' ? `${u.name} — ${p.company || p.jobStatus || ''}` : u.name; };
  [['anchor', 'Anchors'], ['zone', 'Zone incharges'], ['admin', 'Maatram office'], ['alumni', 'Alumni mentors']].forEach(([role, group]) => {
    if (!CAP[role].includes(q.category)) return;
    db.users.filter((u) => u.role === role && u.id !== me.id && u.id !== q.toId && u.id !== q.raiserId && (role !== 'alumni' || (u.profile || {}).mentor))
      .sort((a, b) => ((b.profile || {}).college === col) - ((a.profile || {}).college === col)).forEach((u) => out.push({ id: u.id, group, label: tag(u) }));
  });
  return out;
}
function suggest(q, me) {
  if ((CAP[me.role] || []).includes(q.category)) return null;
  const t = (me.role !== 'zone' && CAP.zone.includes(q.category) && zoneFor(((U(q.raiserId) || {}).profile || {}).college)) || leastLoaded('admin');
  return t && t.id !== me.id ? { id: t.id, name: t.name, role: t.role } : null;
}
app.get('/api/queries/:id', auth(), (req, res) => {
  const q = db.queries.find((x) => x.id == req.params.id); if (!q || !canSee(req.user, q)) return res.status(404).json({ error: 'Query not found' });
  const mine = q.toId === req.user.id || req.user.role === 'admin';
  res.json({ q: view(q, req.user), options: mine ? options(q, req.user) : [], suggest: mine ? suggest(q, req.user) : null });
});
app.patch('/api/queries/:id', auth(), (req, res) => {
  const q = db.queries.find((x) => x.id == req.params.id), me = req.user; if (!q || !canSee(me, q)) return res.status(404).json({ error: 'Query not found' });
  const { action, status, note, to, text } = req.body, t = Date.now(), handles = q.toId === me.id || me.role === 'admin', mineRaised = q.raiserId === me.id;
  if (action === 'update' && handles) {
    if (!['In progress', 'Waiting for student', 'Resolved', 'Closed'].includes(status)) return res.status(400).json({ error: 'Choose a status' });
    if (status === q.status && !note) return res.status(400).json({ error: 'Change the status or write a message' });
    if (status !== q.status) q.history.push({ at: t, by: me.id, action: 'Status → ' + status, note: note || '' }); else q.history.push({ at: t, by: me.id, action: 'Message to student', note });
    q.status = status; q.updatedAt = t;
    if (U(q.raiserId)) notify(q.raiserId, 'In-app', status === 'Resolved' ? `Your query #${q.id} was resolved by ${me.name}.` : status === 'Waiting for student' ? `${me.name} needs your reply on query #${q.id}.` : `${me.name} updated your query #${q.id}.`, q.id, 'Update');
  } else if (action === 'forward' && handles) {
    const target = U(+to); if (!target || !options(q, me).some((o) => o.id === target.id)) return res.status(400).json({ error: 'Choose who to forward to' });
    if (!(note || '').trim()) return res.status(400).json({ error: 'Please say why you are forwarding it' });
    forward(q, target.id, me.id, note.trim(), t);
  } else if (action === 'reply' && mineRaised && text) {
    q.history.push({ at: t, by: me.id, action: 'Reply from ' + (me.role === 'alumni' ? 'alumni' : 'student'), note: text }); q.updatedAt = t; if (q.status === 'Waiting for student') q.status = 'In progress';
    if (open(q) && U(q.toId)) notify(q.toId, 'In-app', `${me.name} replied on query #${q.id}.`, q.id, 'Update');
  } else if (action === 'close' && mineRaised) { q.status = 'Closed'; q.updatedAt = t; q.history.push({ at: t, by: me.id, action: 'Confirmed solved and closed', note: text || '' }); }
  else if (action === 'reopen' && mineRaised && (text || '').trim()) {
    if (!U(q.toId)) { const a = leastLoaded('admin'); q.toId = a.id; q.route.push(entry(a)); }
    q.status = 'New'; q.updatedAt = t; q.history.push({ at: t, by: me.id, action: 'Reopened — not solved', note: text }); notify(q.toId, 'In-app', `${me.name} reopened query #${q.id}.`, q.id, 'Update');
  } else return res.status(403).json({ error: 'That action is not available to you' });
  save(); res.json(view(q, me));
});

// ================= dashboard, people, users =================
app.get('/api/stats', auth(), (req, res) => {
  const me = req.user, vis = db.queries.filter((q) => canSee(me, q)), o = vis.filter(open), done = vis.filter((q) => !open(q));
  const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
  const times = done.map((q) => ((q.history.find((h) => /Resolved|Closed/.test(h.action)) || { at: q.updatedAt }).at - q.createdAt));
  const mine = vis.filter((q) => q.toId === me.id && open(q)), light = (q) => ({ lastReply: view(q, me).lastReply, id: q.id, raiserId: q.raiserId, category: q.category, raiserName: q.raiserName, status: q.status, priority: q.priority, toName: name(q.toId), overdue: open(q) && Date.now() > q.due, route: q.route, updatedAt: q.updatedAt });
  const raised = db.queries.filter((q) => q.raiserId === me.id), people = myPeople(me);
  res.json({ total: vis.length, open: o.length, overdue: o.filter((q) => Date.now() > q.due).length, resolved: done.length, avgHours: times.length ? +(times.reduce((a, b) => a + b, 0) / times.length / H).toFixed(1) : 0,
    withMe: mine.length, forwardedByMe: vis.filter((q) => q.history.some((h) => h.by === me.id && /^Forwarded/.test(h.action))).length,
    myOpen: raised.filter(open).length, waitingForMe: raised.filter((q) => q.status === 'Waiting for student').length, myResolved: raised.filter((q) => !open(q)).length, myTotal: raised.length,
    perHandler: count(o, (q) => `${name(q.toId)} (${ROLES[(U(q.toId) || {}).role] || ''})`), perCategory: count(vis, (q) => q.category),
    people: count(people, (u) => ROLES[u.role]),
    attention: (me.role === 'student' || me.role === 'alumni' ? raised.filter((q) => q.status === 'Waiting for student') : mine.filter((q) => q.status === 'New' || Date.now() > q.due)).slice(0, 5).map(light),
    recent: raised.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4).map(light) });
});
app.get('/api/people', auth('admin', 'zone', 'anchor'), (req, res) => {
  const s = (req.query.q || '').toLowerCase();
  res.json(myPeople(req.user).filter((u) => (!req.query.role || u.role === req.query.role) && (!s || [u.name, u.email, ROLES[u.role], ...['college', 'department', 'degree', 'phone', 'city', 'company', 'specialisation', 'yearFrom', 'yearTo'].map((k) => (u.profile || {})[k])].join(' ').toLowerCase().includes(s))).map(pub));
});
app.post('/api/users', auth('admin'), (req, res) => {
  const { name: n, email, role } = req.body; let password = (req.body.password || '').trim();
  if (!n || !email || !ROLES[role]) return res.status(400).json({ error: 'Name, email and role are required' });
  if (db.users.some((u) => u.email === email.toLowerCase().trim())) return res.status(400).json({ error: 'That email already exists' });
  if (password && password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!password) password = crypto.randomBytes(4).toString('hex');
  const u = { id: db.seq++, name: n.trim(), email: email.toLowerCase().trim(), role, password: hash(password), profile: {} }; db.users.push(u); save(); res.json({ ...pub(u), password });
});
app.delete('/api/users/:id', auth('admin'), (req, res) => {
  const id = +req.params.id, u = U(id);
  if (!u) return res.status(404).json({ error: 'User not found' }); if (id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
  if (u.role === 'admin' && db.users.filter((x) => x.role === 'admin').length < 2) return res.status(400).json({ error: 'At least one admin must remain' });
  const fallback = leastLoaded('admin') && db.users.filter((x) => x.role === 'admin' && x.id !== id)[0];
  db.queries.filter((q) => q.toId === id && open(q)).forEach((q) => forward(q, fallback.id, req.user.id, u.name + ' was removed from the team', Date.now()));
  db.users = db.users.filter((x) => x.id !== id); Object.keys(sessions).forEach((t) => sessions[t].id === id && delete sessions[t]); save(); res.json({ ok: true });
});
app.get('/api/notifications', auth(), (req, res) => res.json(db.notifications.filter((n) => n.to === req.user.id).slice(0, 100)));

// ================= reminders + automatic escalation =================
function runReminders() {
  const now = Date.now(); let n = 0, changed = false;
  db.queries.filter(open).forEach((q) => {
    const h = U(q.toId); if (!h) return;
    if (now - q.updatedAt > 24 * H && now - q.reminded > 24 * H && q.status !== 'Waiting for student') { q.reminded = now; notify(h.id, 'Email', `Reminder: query #${q.id} from ${q.raiserName} has had no update for 24 hours.`, q.id, 'Reminder'); n++; changed = true; }
    if (q.status === 'Waiting for student' && now - q.updatedAt > 48 * H && now - q.reminded > 48 * H && U(q.raiserId)) { q.reminded = now; notify(q.raiserId, 'In-app', `Reminder: ${h.name} is waiting for your reply on query #${q.id}.`, q.id, 'Reminder'); n++; changed = true; }
    if (q.escLevel < 2 && q.status !== 'Waiting for student' && now > q.due + (q.escLevel + 1) * 24 * H) {
      q.escLevel++; changed = true; const rp = (U(q.raiserId) || {}).profile || {};
      const sup = h.role === 'anchor' ? zoneFor(rp.college) || leastLoaded('admin') : h.role === 'admin' ? null : leastLoaded('admin');
      db.users.filter((u) => u.role === 'admin' && u.id !== (sup || {}).id).forEach((a) => { notify(a.id, 'WhatsApp', `Escalation: query #${q.id} from ${q.raiserName} is overdue with ${h.name} (${ROLES[h.role]}).`, q.id, 'Escalation'); n++; });
      if (sup && sup.id !== h.id) { forward(q, sup.id, 0, 'Overdue — escalated automatically', now, true); n++; }
    }
  });
  if (changed) save(); return n;
}
setInterval(runReminders, 60e3);
app.post('/api/reminders/run', auth('admin'), (req, res) => res.json({ sent: runReminders() }));
app.listen(process.env.PORT || 3000, () => console.log('Maatram Support running on http://localhost:3000'));