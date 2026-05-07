# BlackFridayWeb

BlackFridayWeb la project mo phong ban hang duoi tai cao. Muc tieu chinh la tai hien race condition khi nhieu request cung mua mot san pham, sau do chung minh Redis Distributed Lock giu ton kho khong am trong moi truong mot server va nhieu server.

## Kien truc

| Thanh phan | Cong nghe | Vai tro |
| --- | --- | --- |
| Backend | Node.js, Express | API san pham, mua hang, simulation, lock monitor |
| Database | SQLite mac dinh, co cau hinh PostgreSQL | Luu products, purchases, activity logs |
| Redis | Redis 7 | Distributed lock dung `SET key value NX PX ttl` va Lua script release |
| Frontend | React, Vite | Dashboard demo, Product Detail, No-Lock, With-Lock, Compare, Test Report |
| Load test | Node.js scripts | Ban request dong thoi, sinh summary va report JSON |

## Thu muc quan trong

```text
backend/src/services/purchase.service.js      Logic no-lock va with-lock purchase
backend/src/services/lock.service.js          Redis distributed lock
backend/src/services/simulation.service.js    Simulation no-lock, with-lock, compare
backend/scripts/load-test-*.js                Load test scripts
backend/reports/                              Report JSON sinh sau khi test
frontend/src/pages/                           Cac man hinh demo
docs/TEST_CASES.md                            Test cases cho do an
docs/DEFENSE_GUIDE.md                         Huong dan bao ve
```

## Cai dat

Backend:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm install
```

Frontend:

```powershell
cd D:\Project_2\BlackFridayWeb\frontend
npm install
```

## Chay Redis

```powershell
cd D:\Project_2\BlackFridayWeb\backend
docker compose up -d redis
```

Kiem tra:

```powershell
docker compose ps
```

Neu Redis khong chay, route with-lock se khong the acquire distributed lock va load test with-lock phai fail co kiem soat.

## Chay database

Mac dinh project dung SQLite tai `backend/data/blackfridayweb.sqlite`.

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run db:migrate
npm run db:seed
```

## Chay backend

Mot server:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev
```

Backend mac dinh:

```text
http://localhost:4000
```

Hai server:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev:multi
```

Server A va B:

```text
http://localhost:5000
http://localhost:5001
```

## Chay frontend

```powershell
cd D:\Project_2\BlackFridayWeb\frontend
npm run dev
```

Mo URL Vite in ra terminal, thuong la `http://localhost:5173`.

## API chinh

Product APIs:

```text
GET  /api/products
GET  /api/products/:id
POST /api/products/:id/reset-stock
POST /api/products/reset-all
```

Purchase APIs:

```text
POST /api/purchase/no-lock
POST /api/purchase/with-lock
POST /api/purchase/optimistic-lock
GET  /api/purchase/history
GET  /api/activities
```

Simulation APIs:

```text
POST /api/simulation/no-lock
POST /api/simulation/with-lock
POST /api/simulation/compare
GET  /api/simulation/reports
GET  /api/simulation/reports/:id
```

Lock monitor APIs:

```text
GET  /api/locks/status
GET  /api/locks/metrics
POST /api/locks/clear-expired
```

Purchase request body:

```json
{
  "productId": "1",
  "quantity": 1,
  "requestId": "optional-client-request-id"
}
```

Purchase success response co cac truong chinh:

```json
{
  "success": true,
  "mode": "WITH_LOCK",
  "productId": "1",
  "quantity": 1,
  "stockBefore": 1,
  "stockAfter": 0,
  "message": "Purchase successful"
}
```

Out-of-stock response:

```json
{
  "success": false,
  "reason": "OUT_OF_STOCK",
  "stockBefore": 0,
  "stockAfter": 0,
  "message": "Insufficient stock"
}
```

## Load test no-lock

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-no-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Expected result:

```text
Mode: NO_LOCK
Initial stock: 1
Total requests: 20
Success: > 1
Oversell detected: true
Requirement passed: true
```

## Load test with-lock

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-with-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Expected result khi Redis dang chay:

```text
Mode: WITH_LOCK
Initial stock: 1
Total requests: 20
Success: 1
Failed: 19
Final stock: 0
Oversell detected: false
Stock negative: false
Requirement passed: true
```

## Load test compare

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-compare.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Expected:

- No-lock: co race condition.
- With-lock: giu ton kho nhat quan.

## Load test multi-server

Chay 2 server:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev:multi
```

Chay test:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-multi-server.js --mode no-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
node scripts/load-test-multi-server.js --mode with-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
```

Expected:

- No-lock multi-server co the oversell.
- With-lock multi-server khong oversell va report co `server-A`, `server-B`.

## Doc report

Moi script ghi report vao:

```text
backend/reports/
```

Ten file vi du:

```text
no-lock-YYYYMMDD-HHmmss.json
with-lock-YYYYMMDD-HHmmss.json
compare-YYYYMMDD-HHmmss.json
multi-server-YYYYMMDD-HHmmss.json
```

Report chua:

- `totalRequests`
- `successCount`
- `failedCount`
- `initialStock`
- `finalStock`
- `oversellDetected`
- `raceConditionConfirmed`
- `stockNegative`
- `serverInstanceIds`
- `evidenceLogs`

## Troubleshooting

Redis connection failed:

- Dam bao Docker Desktop dang chay.
- Chay lai `docker compose up -d redis` trong `backend`.
- Kiem tra `REDIS_URL=redis://localhost:6379/0`.

Port already in use:

- Doi `PORT` trong `.env`.
- Khi demo multi-server, dam bao port `5000` va `5001` dang ranh.

Database empty:

- Chay `npm run db:migrate`.
- Chay `npm run db:seed`.
- Kiem tra `npm run db:list-products`.

Frontend goi sai API:

- Kiem tra backend dang chay o `http://localhost:4000`.
- Kiem tra `frontend/src/services/api/endpoints.js`.

CORS loi:

- Chay frontend bang Vite local.
- Kiem tra backend Express CORS config trong `backend/src/app.js`.

## Tai lieu bao ve

- Test cases: `docs/TEST_CASES.md`
- Huong dan demo: `docs/DEFENSE_GUIDE.md`
