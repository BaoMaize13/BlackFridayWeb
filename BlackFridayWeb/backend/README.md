# Distributed Inventory Concurrency Control Backend

## 1. Gioi thieu do an

Backend nay mo phong bai toan tranh chap du lieu khi nhieu request, hoac nhieu backend instances, cung luc mua mot san pham co ton kho thap.

- `POST /api/purchase/no-lock` giu baseline co chu y khong khoa de tai hien race condition
- `POST /api/purchase/with-lock` dung Redis distributed lock de giu inventory consistent
- `/api/admin/*` la nhom API quan tri duoc bao ve bang JWT + role `admin`
- `/api/auth/*` cap session JWT that de frontend login va goi protected APIs

## 2. Tinh nang chinh

- mo phong no-lock race condition
- Redis distributed lock voi owner token + Lua safe release
- auth backend bang JWT
- audit logs va purchase attempt logs
- admin APIs de tao/reset product, xem orders, xem logs, xem stats, xem metrics
- load test scripts va evidence scripts
- JSON / Markdown / CSV reports
- multi-instance demo
- automated tests, edge-case tests, concurrency tests
- compare report no-lock vs with-lock

## 3. Tech Stack

- Node.js
- Express
- SQLite mac dinh cho local demo
- Redis cho distributed lock
- Knex cho data access va migrations
- `node:test` + `supertest` cho automated tests
- Docker Compose de bat Redis local

## 4. Cau truc thu muc

```text
backend/
├─ src/
│  ├─ config/
│  ├─ constants/
│  ├─ controllers/
│  ├─ database/
│  ├─ middlewares/
│  ├─ models/
│  ├─ repositories/
│  ├─ routes/
│  ├─ scripts/
│  ├─ services/
│  ├─ reporting/
│  └─ utils/
├─ tests/
├─ docs/
├─ reports/
└─ package.json
```

## 5. Cai dat

Chay trong thu muc `backend`:

```powershell
npm install
```

## 6. Cau hinh moi truong

Copy file mau:

```powershell
Copy-Item .env.example .env
```

Nhung bien quan trong:

- `DB_URL`
- `REDIS_URL`
- `PORT`
- `SERVER_ID`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Mac dinh local:

```dotenv
PORT=4000
SERVER_ID=server-4000
DB_URL=./data/blackfridayweb.sqlite
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=change_me_for_demo_and_production
JWT_EXPIRES_IN=1d
```

## 7. Chay DB va Redis

DB local mac dinh la SQLite file, nen demo local khong can mot DB server rieng.

Chay migration va seed:

```powershell
npm run db:migrate
npm run db:seed
```

Bat Redis:

```powershell
npm run redis:up
```

Hoac:

```powershell
docker compose up -d redis
```

Kiem tra Redis:

```powershell
npm run redis:logs
```

## 8. Chay backend

```powershell
npm run dev
```

Neu muon demo multi-instance:

```powershell
npm run dev:server-a
npm run dev:server-b
```

## 9. Health Check

Co the dung:

- `GET /health`
- `GET /api/health`

Vi du:

```powershell
curl.exe "http://localhost:4000/health"
curl.exe "http://localhost:4000/api/health"
```

## 10. Demo nhanh

### B1. Dang nhap lay JWT

Sau khi seed, mac dinh co tai khoan:

- email: `admin@example.com`
- password: `password`

Lay token bang PowerShell:

```powershell
$login = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"email":"admin@example.com","password":"password"}'
$token = $login.data.token
```

### B2. Tim `productId`

```powershell
curl.exe "http://localhost:4000/api/admin/products" -H "Authorization: Bearer $token"
```

### B3. Reset product ve `stock = 1`

```powershell
curl.exe -X POST "http://localhost:4000/api/admin/products/1/reset" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

### B4. Chay no-lock evidence

```powershell
npm run evidence:no-lock
```

### B5. Chay with-lock evidence

```powershell
npm run evidence:with-lock
```

### B6. Compare report

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

Ghi chu:

- CLI scripts tu dang nhap bang seeded admin mac dinh
- co the override bang `ADMIN_EMAIL` va `ADMIN_PASSWORD`

## 11. API Contract Chinh

Auth:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/auth/validate`
- `POST /api/auth/logout`

Admin:

- `GET /api/admin/products`
- `POST /api/admin/products`
- `GET /api/admin/orders`
- `GET /api/admin/attempt-logs`
- `GET /api/admin/stats`
- `GET /api/admin/metrics`

Purchase:

- `POST /api/purchase/no-lock`
- `POST /api/purchase/with-lock`

## 12. Test

```powershell
npm test
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run test:edge
npm run test:lock
```

Ghi chu trung thuc:

- neu Redis chua chay, Redis-dependent tests co the skip hoac fail ro rang
- muon verify day du with-lock va lock service, hay bat Redis roi chay lai

## 13. Reports

Report duoc ghi vao:

```text
reports/
```

Thuong gap:

- no-lock evidence report
- with-lock evidence report
- multi-instance report
- compare report
- metrics summary report

## 14. Docs

- [Demo Guide](./docs/demo-guide.md)
- [Demo Checklist](./docs/demo-checklist.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [API Quick Reference](./docs/api-quick-reference.md)
- [Commands Cheatsheet](./docs/commands-cheatsheet.md)
- [Distributed Lock Design](./docs/distributed-lock-design.md)
- [Testing Guide](./docs/testing-guide.md)
- [Edge Case Testing Guide](./docs/edge-case-testing-guide.md)
- [Multi-Instance Demo Guide](./docs/multi-instance-demo-guide.md)
- [Metrics And Reporting Guide](./docs/metrics-and-reporting-guide.md)

## 15. Luu y trung thuc

- no-lock race condition khong deterministic, nen co the khong reproduce trong moi lan chay
- neu no-lock chua reproduce, hay tang `CONCURRENT_REQUESTS` hoac `NO_LOCK_PURCHASE_DELAY_MS`
- with-lock can Redis dang chay
- multi-instance can it nhat 2 backend processes
- admin APIs khong con public; can JWT admin token
- khong duoc ket luan with-lock pass neu `dataConsistent = false`
