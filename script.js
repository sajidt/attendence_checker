const STORAGE_KEY = 'saturday-school-students-v1';
const ATTENDANCE_KEY = 'saturday-school-attendance-v1';
const API_BASE_URL = window.ATTENDANCE_API_URL || '/api';
let remoteData = false;
const apiHeaders = () => window.ATTENDANCE_API_KEY ? { Authorization: `Bearer ${window.ATTENDANCE_API_KEY}` } : {};

const firstNames = ['Aanya', 'Aaron', 'Amelia', 'Arjun', 'Ben', 'Camila', 'Chloe', 'Daniel', 'Elena', 'Ethan', 'Fatima', 'Grace', 'Hana', 'Isaac', 'Jasmine', 'Jonah', 'Kai', 'Liam', 'Maya', 'Noah'];
const lastNames = ['Adams', 'Bennett', 'Brooks', 'Carter', 'Chen', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris', 'Ibrahim', 'Johnson', 'Kim', 'Lewis', 'Martin', 'Nguyen', 'Patel', 'Robinson', 'Singh', 'Williams'];

const state = { students: [], attendance: {}, filter: 'all', query: '', date: todayISO() };
const elements = {
  sessionDate: document.querySelector('#sessionDate'), sessionDateLabel: document.querySelector('#sessionDateLabel'), dateButton: document.querySelector('#dateButton'),
  search: document.querySelector('#searchInput'), clearSearch: document.querySelector('#clearSearch'), studentList: document.querySelector('#studentList'), emptyState: document.querySelector('#emptyState'),
  resultSummary: document.querySelector('#resultSummary'), resultCount: document.querySelector('#resultCount'), checkedIn: document.querySelector('#checkedInCount'), checkedOut: document.querySelector('#checkedOutCount'), remaining: document.querySelector('#remainingCount'), total: document.querySelector('#totalStudentCount'),
  allCount: document.querySelector('#allCount'), outCount: document.querySelector('#outCount'), inCount: document.querySelector('#inCount'), toolsDialog: document.querySelector('#toolsDialog'), importInput: document.querySelector('#importInput'), toolMessage: document.querySelector('#toolMessage')
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function makeSeedStudents() {
  return Array.from({ length: 200 }, (_, index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const gradeNumber = (index % 8) + 1;
    const section = index % 2 === 0 ? 'A' : 'B';
    const month = String((index % 9) + 1).padStart(2, '0');
    const day = String((index % 25) + 1).padStart(2, '0');
    return { id: `student-${index + 1}`, firstName, lastName, birthdate: `201${8 - Math.min(7, gradeNumber)}-${month}-${day}`, parentPhone: `(555) ${String(210 + Math.floor(index / 10)).padStart(3, '0')}-${String(1000 + index).padStart(4, '0')}`, parentEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@example.com`, grade: `Grade ${gradeNumber}${section}` };
  });
}
async function loadData() {
  try {
    const response = await fetch(`${API_BASE_URL}/bootstrap`, { headers: apiHeaders() });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    state.students = data.students;
    state.attendance = data.attendance;
    remoteData = true;
    return;
  } catch (error) {
    remoteData = false;
    try { state.students = JSON.parse(localStorage.getItem(STORAGE_KEY)) || makeSeedStudents(); state.attendance = JSON.parse(localStorage.getItem(ATTENDANCE_KEY)) || {}; }
    catch { state.students = makeSeedStudents(); state.attendance = {}; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
  }
}
function saveAttendance() { if (!remoteData) localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(state.attendance)); }
function currentAttendance() { return state.attendance[state.date] || {}; }
function formatDate(dateString) { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${dateString}T12:00:00`)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character])); }
function initials(student) { return `${student.firstName[0]}${student.lastName[0]}`.toUpperCase(); }
function matches(student) { const query = state.query.trim().toLowerCase(); return !query || [student.firstName, student.lastName, student.grade, student.parentPhone, student.parentEmail].join(' ').toLowerCase().includes(query); }
function visibleStudents() { const attendance = currentAttendance(); return state.students.filter(student => { const record = attendance[student.id]; const visibleByFilter = state.filter === 'all' || (state.filter === 'in' ? record && !record.out : state.filter === 'out' ? !record : true); return matches(student) && visibleByFilter; }).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)); }
function render() {
  const attendance = currentAttendance(); const arrived = Object.keys(attendance).length; const present = Object.values(attendance).filter(record => !record.out).length; const checkedOut = Object.values(attendance).filter(record => record.out).length; const total = state.students.length; const visible = visibleStudents();
  elements.sessionDate.value = state.date; elements.sessionDateLabel.textContent = formatDate(state.date).replace(/^\w+, /, ''); elements.checkedIn.textContent = present; elements.checkedOut.textContent = checkedOut; elements.remaining.textContent = Math.max(total - arrived, 0); elements.total.textContent = total;
  elements.allCount.textContent = state.students.filter(matches).length; elements.outCount.textContent = state.students.filter(student => matches(student) && !attendance[student.id]).length; elements.inCount.textContent = state.students.filter(student => matches(student) && attendance[student.id] && !attendance[student.id].out).length;
  elements.resultSummary.textContent = state.query ? `Results for "${state.query}"` : state.filter === 'all' ? 'Showing all students' : state.filter === 'in' ? 'Students present' : 'Students not arrived'; elements.resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'student' : 'students'}`; elements.clearSearch.hidden = !state.query;
  document.querySelectorAll('.filter-tab').forEach(tab => { const active = tab.dataset.filter === state.filter; tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', active); });
  elements.studentList.innerHTML = visible.map(student => cardTemplate(student, attendance[student.id])).join(''); elements.emptyState.hidden = visible.length !== 0;
}
function cardTemplate(student, record) { const checkedIn = Boolean(record && !record.out); const checkedOut = Boolean(record && record.out); const time = record ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(record.in)) : ''; const outTime = checkedOut ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(record.out)) : ''; return `<article class="student-card ${checkedIn ? 'is-present' : ''}"><div class="avatar" aria-hidden="true">${initials(student)}</div><div class="student-info"><div class="student-name">${escapeHtml(student.firstName)} ${escapeHtml(student.lastName)}</div><div class="student-meta"><span class="grade-tag">${escapeHtml(student.grade)}</span><span>${escapeHtml(student.parentPhone)}</span></div>${checkedIn ? `<span class="time-label">In at ${time}</span>` : checkedOut ? `<span class="time-label">Out at ${outTime}</span>` : ''}</div><button class="check-button ${checkedIn ? 'checkout' : ''}" data-student-id="${student.id}" type="button">${checkedIn ? 'Check out' : checkedOut ? 'Undo out' : 'Check in'}</button></article>`; }
async function toggleAttendance(studentId) {
  const day = currentAttendance(); const record = day[studentId]; const action = !record ? 'check-in' : !record.out ? 'check-out' : 'undo';
  if (remoteData) {
    const response = await fetch(`${API_BASE_URL}/attendance/${state.date}/${encodeURIComponent(studentId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...apiHeaders() }, body: JSON.stringify({ action }) });
    if (!response.ok) { elements.toolMessage.textContent = 'Could not save attendance. Try again.'; return; }
    const result = await response.json(); state.attendance[state.date] = result.attendance; render(); return;
  }
  if (!record) day[studentId] = { in: new Date().toISOString() }; else if (!record.out) record.out = new Date().toISOString(); else delete day[studentId]; state.attendance[state.date] = day; saveAttendance(); render();
}
function parseCSV(text) { const lines = text.trim().split(/\r?\n/).filter(Boolean); if (lines.length < 2) return []; const headers = lines.shift().split(',').map(header => header.trim().toLowerCase()); return lines.map((line, index) => { const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, '')); const row = Object.fromEntries(headers.map((header, i) => [header, values[i] || ''])); return { id: `imported-${Date.now()}-${index}`, firstName: row['first name'] || row.firstname || '', lastName: row['last name'] || row.lastname || '', birthdate: row.birthdate || '', parentPhone: row['parent phone'] || row.phone || '', parentEmail: row['parent email'] || row.email || '', grade: row.grade || '' }; }).filter(student => student.firstName && student.lastName); }
function exportAttendance() { const attendance = currentAttendance(); const rows = [['First Name', 'Last Name', 'Grade', 'Parent Phone', 'Check In']]; state.students.filter(student => attendance[student.id]).forEach(student => rows.push([student.firstName, student.lastName, student.grade, student.parentPhone, attendance[student.id].in])); const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `attendance-${state.date}.csv`; link.click(); URL.revokeObjectURL(link.href); }

elements.search.addEventListener('input', event => { state.query = event.target.value; render(); });
elements.clearSearch.addEventListener('click', () => { state.query = ''; elements.search.value = ''; elements.search.focus(); render(); });
elements.dateButton.addEventListener('click', () => { if (elements.sessionDate.showPicker) elements.sessionDate.showPicker(); else elements.sessionDate.click(); });
elements.sessionDate.addEventListener('change', event => { state.date = event.target.value || todayISO(); render(); });
document.querySelectorAll('.filter-tab').forEach(tab => tab.addEventListener('click', () => { state.filter = tab.dataset.filter; render(); }));
elements.studentList.addEventListener('click', event => { const button = event.target.closest('[data-student-id]'); if (button) toggleAttendance(button.dataset.studentId); });
document.querySelector('#settingsButton').addEventListener('click', () => { elements.toolMessage.textContent = ''; elements.toolsDialog.showModal(); });
document.querySelector('#exportButton').addEventListener('click', exportAttendance);
elements.importInput.addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; const imported = parseCSV(await file.text()); if (!imported.length) { elements.toolMessage.textContent = 'No valid student rows found.'; return; } if (remoteData) { const response = await fetch(`${API_BASE_URL}/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...apiHeaders() }, body: JSON.stringify({ students: imported }) }); if (!response.ok) { elements.toolMessage.textContent = 'Could not import students. Try again.'; return; } } else localStorage.setItem(STORAGE_KEY, JSON.stringify(imported)); state.students = imported; elements.toolMessage.textContent = `${imported.length} students imported.`; render(); event.target.value = ''; });

loadData().then(render);
