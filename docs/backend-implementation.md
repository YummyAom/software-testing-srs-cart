# Backend implementation — Supabase Auth API

The current `backend/` implementation contains Supabase email/password login and current-session logout.
The previous mock identity, in-memory persistence, business routes, reset and payment simulator
have been removed. Product specifications and reusable domain packages remain separate from
the current Auth implementation.

| Path | Responsibility |
| --- | --- |
| `backend/src/modules/auth/auth-routes.ts` | Register Login/Logout routes and preflights |
| `backend/src/modules/auth/auth-controller.ts` | Validate requests and translate outcomes to HTTP |
| `backend/src/modules/auth/auth-service.ts` | Login/Logout logic and authentication errors |
| `backend/src/modules/auth/repositories/supabase-auth-repository.ts` | Call Supabase Auth password grant and local logout |
| `backend/src/modules/auth/repositories/app-user-repository.ts` | Read username/role/member_tier by authenticated Auth ID |
| `backend/src/app.ts` | Fastify, CORS, bounded request bodies and HTTP errors |
| `backend/src/config.ts` | Read the two Supabase env values plus local server settings |
| `backend/src/docs/swagger.ts` | Swagger UI at `/docs/` and Auth OpenAPI JSON/YAML |

Set only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `backend/.env`.
Profile queries use the user's Supabase access token plus the publishable key. Apply
`backend/sql/enable-own-profile-read.sql` once to grant selected-column, own-row reads.
It has not been applied remotely. Auth IDs and app_users IDs must match.
See the [Auth runbook](../backend/README.md) for the request and response format.

```sh
npm ci
npm run dev
npm run typecheck
npm run build
```

`POST /auth/login` receives `{email,password}` and returns a Supabase JWT, refresh token,
expiry duration, and `data.user` containing `userId`, `username`, `email`, `role`, `memberTier`.
Profile values come from `app_users`: roles are lowercase, `normal`/Admin `NULL` tier become
`free`, and `prime` stays `prime`. Missing profiles return 403, lookup failures return 503.
`POST /auth/logout` uses a Bearer access token to revoke only the current Supabase session and returns 204.
It does not implement refresh or JWT verification middleware for other protected routes. This remains a local development
API with the existing production startup restriction. Live-project authentication acceptance has not been verified.
