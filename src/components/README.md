# Components (frontend)

Reusable pieces of UI, grouped by who sees them:

| Folder | Contains |
| ------ | -------- |
| `shared/` | Used across the app: logo, theme toggle, map, SOS button, status pills, charts, medical card |
| `auth/` | Frame for the login and sign-up pages |
| `student/` | Student frame (bottom tab bar with SOS), SOS countdown flow, profile & settings panel |
| `responder/` | Responder field-app frame |
| `admin/` | Admin console frame, notification bell, case panels |

Pages that use these live in `src/routes/`.
