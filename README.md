# Maatram Support Desk (MH26-04)
Student Support and Follow-up System for the Maatram office team.

## Run
```
npm install
npm start      # http://localhost:3000
```
Demo logins (dummy data). Pick the matching role in the dropdown, then enter: admin@maatram.org / admin123 · karthik@maatram.org / coordinator123 · surya@maatram.org / student_rep123

## Features
Query logging with attachments, auto/manual assignment, status workflow with full history, reminders and escalation (job runs every minute; notifications are logged as Email/SMS/WhatsApp stubs), 3 roles, dashboard, search and filters.

## Moving from scattered channels to one platform
1. Week 1: every office member logs queries here as they arrive from WhatsApp, calls, email and walk-ins. 2. Week 2: pin the link in WhatsApp groups and reply "logged as #ID". 3. Week 3: stop tracking elsewhere; review the dashboard in the weekly meeting.

## Student privacy
Only dummy data during development. In production: use HTTPS, role-based access (reps see only their own queries, coordinators only assigned ones), hashed passwords, collect only the details needed, restrict file access and delete old attachments on a schedule.
