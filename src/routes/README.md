# Routes (frontend pages)

Each file here is a page, and **its path is the URL** (file-based routing):

| File | URL |
| ---- | --- |
| `login.tsx` | `/login` |
| `_student/index.tsx` | `/` (the `_` folder adds a shared layout without changing the URL) |
| `_student/reports.$id.tsx` | `/reports/123` (`$id` is a URL parameter) |
| `admin/sos.index.tsx` | `/admin/sos` |
| `staff/$id.tsx` | `/staff/123` |

A folder's `route.tsx` is the layout + access guard for every page inside it
(e.g. `admin/route.tsx` lets only admins in). `api/auth/$.ts` is the one backend
endpoint here: sign-in, sign-up and sessions.
