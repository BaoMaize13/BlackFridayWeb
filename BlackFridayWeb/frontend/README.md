# BlackFridayWeb Frontend

React + Vite admin workspace for the distributed inventory concurrency demo.

The frontend expects the backend API contract to be mounted under `/api`:

- `/api/auth/login`
- `/api/auth/me`
- `/api/admin/*`
- `/api/purchase/no-lock`
- `/api/purchase/with-lock`

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Environment

Copy `.env.example` to `.env` and point the app to the backend:

```powershell
Copy-Item .env.example .env
```

Core variables:

- `VITE_API_BASE_URL`
- `VITE_AUTH_LOGIN_PATH`
- `VITE_AUTH_ME_PATH`
- `VITE_AUTH_REGISTER_PATH`
- `VITE_AUTH_LOGOUT_PATH`
- `VITE_SESSION_STORAGE_KEY`

Default local demo backend:

```dotenv
VITE_API_BASE_URL=http://localhost:4000
```

## Demo Login

After the backend runs `npm run db:seed`, you can sign in with the seeded admin:

- `admin@example.com`
- `password`

The frontend stores the JWT session locally and sends `Authorization: Bearer <token>` automatically on protected requests.
