# Maatram Support Desk (MH26-04)
Student Support and Follow-up System for Maatram Foundation.

## Run
```
npm install
npm start      # http://localhost:3000
```
Delete `data.json` to reset the demo data.

## Roles
Student, Anchor, Zone Incharge, Admin, Alumni. Everyone can create an account from the sign-in page. Anchor, Zone Incharge and Admin sign-ups need a registration code (defaults: `ANCHOR-2026`, `ZONE-2026`, `ADMIN-2026`; change them in `server.js` or with the `ANCHOR_CODE`, `ZONE_CODE`, `ADMIN_CODE` environment variables). Admins can also add people from the People page.

## Demo logins (dummy data) - pick the matching role on the sign-in page
| Role | Email | Password |
|---|---|---|
| Admin | admin@maatram.org | admin123 |
| Zone Incharge | zone@maatram.org | zone123 |
| Anchor | anchor@maatram.org | anchor123 |
| Student | student@maatram.org | student123 |
| Alumni | alumni@maatram.org | alumni123 |

More: suresh@ (admin), karthik@ (zone), arjun@ (anchor), rahul@ and nisha@ (student, nisha has an empty profile), sneha@ (alumni), all @maatram.org with the same role passwords.

## How a query is routed
The student picks who should solve it (anchor, zone incharge, Maatram office or an alumni mentor); the app recommends one based on the category. The receiver sees the student's full profile and can resolve, ask for details, or forward it with a reason. The student sees the whole route. Overdue queries are escalated automatically (anchor, zone incharge, admin). Edit `CAP` and `REC` at the top of `server.js` to change who handles what.

## Student privacy
Dummy data only while building. Use HTTPS in production, keep role-based visibility (students see only their own queries; handlers see queries sent to them or from their students), hashed passwords, and delete old attachments on a schedule.
