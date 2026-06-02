# SyncUT - Master Operating Guide

## 1. Project Goal

SyncUT is a modular university platform in monorepo format.
Current official modules:
- Authentication and audit.
- Justification of absences.
- Tutor appointment scheduling.
- Email notifications.
- Incident reporting (traffic-light board).
- Student support chatbot.
- Shared dashboard as integration entry point.

## 2. Team Ownership (Updated)

### Team 1 - Justification of absences
Members: Joel, Alfonso, Aaron Trejo, Tania, Karla.
Scope: tardy-to-absence conversion, justification requests, medical/official evidence uploads.
Owner paths:
- apps/web/app/(justificaciones)/
- docs/squad-1-justificaciones/

### Team 2 - Authentication and audit
Members: Alexander, Alan, Wallmach, Erick.
Scope: transversal security layer, access control, audit traceability.
Owner paths:
- apps/web/app/(auth)/
- supabase/migrations/
- packages/sdk/
- packages/types/
- docs/squad-2-auditoría/

### Team 3 - Tutor appointments
Members: Karim, Rivera, Fernando Buendia, Eduardo.
Scope: schedule, manage, and track tutoring sessions.
Owner paths:
- apps/web/app/(citas)/
- docs/squad-3-citas/

### Team 4 - Email notifications
Members: Fernando, Vidales, Ari, Roman.
Scope: asynchronous messaging engine for institutional emails and alerts.
Owner paths:
- apps/web/app/(notificaciones)/
- docs/squad-4-notificaciones/

### Team 5 - Incident reporting
Members: Marvin, Osmara, Kevin, Aaron Mota.
Scope: complaint mailbox, reports, and early alerts with traffic-light board.
Owner paths:
- apps/web/app/(incidencias)/
- docs/squad-5-incidencias/

### Team 6 - Chatbot
Members: Alexis, Samantha, Rey, Pablo.
Scope: automated intelligent support channel for student community.
Owner paths:
- apps/web/app/(chatbot)/
- docs/squad-6-chatbot/

## 3. Dependency Rules

- Team 2 is the main blocker for Teams 1, 3, 4, 5, and 6.
- Team 4 receives events from Teams 1, 3, 5, and 6 to send notifications.
- Dashboard module is shared integration and must expose navigation to all active modules.

## 4. Mandatory Delivery Per Team

- Module README with owner, scope, and dependencies.
- Screens and feature contracts.
- Components, hooks, services, and types within module boundary.
- Tests or validation notes for behavior changes.
