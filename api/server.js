const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const database = new Database(process.env.DATABASE_PATH || path.join(__dirname, '..', 'attendance.db'));

database.pragma('journal_mode = WAL');
database.pragma('foreign_keys = ON');
database.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    birthdate TEXT NOT NULL DEFAULT '', parent_phone TEXT NOT NULL DEFAULT '',
    parent_email TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS students_lookup ON students(last_name, first_name, grade, parent_phone);
  CREATE TABLE IF NOT EXISTS attendance (
    session_date TEXT NOT NULL, student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    checked_in_at TEXT NOT NULL, checked_out_at TEXT,
    PRIMARY KEY (session_date, student_id)
  );
`);

if (database.prepare('SELECT COUNT(*) AS count FROM students').get().count === 0) {
  const samplePath = path.join(__dirname, '..', 'sample_students.csv');
  if (fs.existsSync(samplePath)) {
    const rows = fs.readFileSync(samplePath, 'utf8').trim().split(/\r?\n/).slice(1).filter(Boolean);
    const insert = database.prepare('INSERT OR IGNORE INTO students (id, first_name, last_name, birthdate, parent_phone, parent_email, grade) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const seed = database.transaction(() => rows.forEach((row, index) => { const [firstName, lastName, birthdate, parentPhone, parentEmail, grade] = row.split(','); insert.run(`student-${index + 1}`, firstName, lastName, birthdate, parentPhone, parentEmail, grade); }));
    seed();
  }
}

app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});

function authorize(request, response, next) {
  const configuredKey = process.env.STAFF_API_KEY;
  if (!configuredKey || request.get('authorization') === `Bearer ${configuredKey}`) return next();
  return response.status(401).json({ error: 'Unauthorized' });
}
function readStudents() { return database.prepare('SELECT id, first_name AS firstName, last_name AS lastName, birthdate, parent_phone AS parentPhone, parent_email AS parentEmail, grade FROM students ORDER BY last_name, first_name').all(); }
function readAttendance() {
  const rows = database.prepare('SELECT session_date, student_id, checked_in_at, checked_out_at FROM attendance').all();
  return rows.reduce((days, row) => { (days[row.session_date] ||= {})[row.student_id] = { in: row.checked_in_at, ...(row.checked_out_at ? { out: row.checked_out_at } : {}) }; return days; }, {});
}

app.get('/api/health', (request, response) => response.json({ ok: true }));
app.get('/api/bootstrap', authorize, (request, response) => response.json({ students: readStudents(), attendance: readAttendance() }));
app.put('/api/attendance/:date/:studentId', authorize, (request, response) => {
  const { date, studentId } = request.params; const { action } = request.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['check-in', 'check-out', 'undo'].includes(action)) return response.status(400).json({ error: 'Invalid attendance action.' });
  const current = database.prepare('SELECT checked_in_at AS inTime, checked_out_at AS outTime FROM attendance WHERE session_date = ? AND student_id = ?').get(date, studentId); const now = new Date().toISOString();
  if (action === 'check-in' && !current) database.prepare('INSERT INTO attendance (session_date, student_id, checked_in_at) VALUES (?, ?, ?)').run(date, studentId, now);
  else if (action === 'check-out' && current && !current.outTime) database.prepare('UPDATE attendance SET checked_out_at = ? WHERE session_date = ? AND student_id = ?').run(now, date, studentId);
  else if (action === 'undo' && current && current.outTime) database.prepare('DELETE FROM attendance WHERE session_date = ? AND student_id = ?').run(date, studentId);
  else return response.status(409).json({ error: 'Attendance changed by another staff member. Refresh and try again.' });
  response.json({ attendance: readAttendance()[date] || {} });
});
app.post('/api/students', authorize, (request, response) => {
  const students = request.body && request.body.students;
  if (!Array.isArray(students) || students.length === 0 || students.length > 10000) return response.status(400).json({ error: 'Students must be a non-empty array.' });
  const replace = database.transaction(() => { database.prepare('DELETE FROM students').run(); const insert = database.prepare('INSERT INTO students (id, first_name, last_name, birthdate, parent_phone, parent_email, grade) VALUES (@id, @firstName, @lastName, @birthdate, @parentPhone, @parentEmail, @grade)'); students.forEach(student => insert.run({ id: String(student.id), firstName: String(student.firstName || ''), lastName: String(student.lastName || ''), birthdate: String(student.birthdate || ''), parentPhone: String(student.parentPhone || ''), parentEmail: String(student.parentEmail || ''), grade: String(student.grade || '') })); });
  try { replace(); response.json({ students: readStudents() }); } catch (error) { response.status(400).json({ error: 'Could not import students.' }); }
});
app.use(express.static(path.join(__dirname, '..')));
app.listen(port, () => console.log(`Attendance app listening on port ${port}`));