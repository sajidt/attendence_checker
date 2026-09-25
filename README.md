# Saturday School Attendance

A fast, mobile-first attendance checker for a weekly Saturday school. When hosted through the included API, staff members on multiple devices share the same student records and attendance sessions. Opening the HTML directly still provides an offline local-storage mode.

## Run

For offline mode, open `index.html` directly in a browser, or serve the folder with any static web server. For shared mode, install Node.js 20+ and run the API from this directory:

```powershell
npm install
npm start
```

Then open <http://localhost:3000> on a phone or desktop browser. Deploy the folder to a Node host such as Render, Railway, Fly.io, or Azure App Service with `npm start` and a persistent disk for `attendance.db`.

## Included

- 200 pre-populated sample students across split grades such as Grade 1A and Grade 1B
- Instant search by name, grade, parent phone, or parent email
- One-tap check-in and check-out for the selected Saturday
- Date-specific attendance history shared through the API
- CSV student import and attendance export
- Responsive layout sized for phone use

## Student CSV import

The first row should contain these column names:

```text
First Name,Last Name,Birthdate,Parent Phone,Parent Email,Grade
```

Import replaces the shared student list. Attendance data is retained by date.

## Production note

The included API uses SQLite in WAL mode. This is a good fit for a small roster and fast indexed lookups, but the host must provide persistent storage. Set `STAFF_API_KEY` in production and put the same value in `api-config.js` as `window.ATTENDANCE_API_KEY`. Keep that file private if the API is exposed publicly, or use a proper staff login before production use.
