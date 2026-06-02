# SyncUT - Arbol de Carpetas para Junta

## Vista simple

```text
SyncUT/
|-- apps/web/app/
|   |-- (auth)            Team 2 - Authentication and audit
|   |-- (citas)           Team 3 - Tutor appointments
|   |-- (justificaciones) Team 1 - Justification of absences
|   |-- (notificaciones)  Team 4 - Email notifications
|   |-- (incidencias)     Team 5 - Incident reporting
|   |-- (chatbot)         Team 6 - Chatbot
|   `-- (dashboard)       Shared integration dashboard
|-- packages/
|-- supabase/
|-- docs/
`-- scripts/
```

## Team ownership map

- Team 1: apps/web/app/(justificaciones), docs/squad-1-justificaciones
- Team 2: apps/web/app/(auth), supabase/migrations, packages/sdk, packages/types, docs/squad-2-auditoría
- Team 3: apps/web/app/(citas), docs/squad-3-citas
- Team 4: apps/web/app/(notificaciones), docs/squad-4-notificaciones
- Team 5: apps/web/app/(incidencias), docs/squad-5-incidencias
- Team 6: apps/web/app/(chatbot), docs/squad-6-chatbot

## Rule for project review meetings

1. Present simple tree first.
2. Then ownership map.
3. Review dependency chain: Team 2 -> Teams 1/3/4/5/6.
4. Confirm every module README matches this assignment.
