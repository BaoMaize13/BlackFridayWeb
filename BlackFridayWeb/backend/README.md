# Distributed Inventory Concurrency Control Backend

## 1. Gioi thieu do an

Backend nay mo phong bai toan tranh chap du lieu khi nhieu request hoac nhieu backend server cung luc xu ly viec mua cung mot san pham.

- `POST /purchase/no-lock` giu baseline khong khoa de tai hien race condition va overselling
- `POST /purchase/with-lock` dung Redis distributed lock de serialize theo `productId` va giu inventory consistent

Muc tieu demo:

- cho thay no-lock co rui ro oversell / stock mismatch
- cho thay with-lock ngan oversell
- cho thay multi-instance with-lock van dung khi server-A va server-B cung dung chung DB va Redis

## 2. Tinh nang chinh

- mo phong no-lock race condition
- Redis distributed lock voi owner token + Lua safe release
- audit logs va purchase attempt logs
- admin APIs de tao/reset product, xem orders, xem logs, xem metrics
- load test scripts va evidence scripts
- JSON / Markdown / CSV reports
- multi-instance demo
- automated tests, edge-case tests, concurrency tests
- metrics comparison no-lock vs with-lock

## 3. Tech Stack

- Node.js
- Express
- SQLite mac dinh cho local demo
- Redis cho distributed lock
- Knex cho data access
- `node:test` + `supertest` cho automated tests
- Docker Compose de bat Redis local

## 4. Cau truc thu muc

```text
backend/
├─ src/
│  ├─ config/
│  ├─ controllers/
│  ├─ services/
│  ├─ repositories/
│  ├─ models/
│  ├─ routes/
│  ├─ scripts/
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

Canh cac bien quan trong:

- `DB_URL`: mac dinh la SQLite local `./data/blackfridayweb.sqlite`
- `REDIS_URL`: mac dinh la `redis://localhost:6379/0`
- `PORT`: backend port
- `SERVER_ID`: nen set rieng khi chay multi-instance

Vi du:

```dotenv
PORT=4000
SERVER_ID=server-4000
DB_URL=./data/blackfridayweb.sqlite
REDIS_URL=redis://localhost:6379/0
```

## 7. Chay DB va Redis

DB local mac dinh la SQLite file, nen khong can bat mot DB server rieng cho demo local.

Bat Redis bang Docker Compose:

```powershell
npm run redis:up
```

Hoac:

```powershell
docker compose up -d redis
```

Kiem tra log Redis:

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

```text
GET /health
```

Vi du:

```powershell
curl.exe "http://localhost:4000/health"
```

## 10. Demo nhanh

Recommended demo flow:

1. Liet ke san pham hoac tao san pham moi
2. Reset product ve `stock = 1`
3. Chay `evidence:no-lock`
4. Chay `evidence:with-lock`
5. Chay `report:compare`
6. Neu can chung minh phan tan, chay multi-instance demo

Tim `productId`:

```powershell
curl.exe "http://localhost:4000/admin/products"
```

Reset san pham:

```powershell
curl.exe -X POST "http://localhost:4000/admin/products/1/reset" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

Chay no-lock evidence:

```powershell
npm run evidence:no-lock
```

Chay with-lock evidence:

```powershell
npm run evidence:with-lock
```

Chay compare report:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

## 11. Test

```powershell
npm test
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run test:edge
npm run test:lock
```

Ghi chu trung thuc:

- Neu Redis chua chay, Redis-dependent tests co the skip hoac fail voi message ro rang
- Muon verify day du with-lock va lock-service, hay bat Redis roi chay lai

## 12. Reports

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

Sample note:

- No-lock co the ra `RACE_CONDITION_REPRODUCED`, `RACE_WINDOW_OBSERVED`, hoac `RACE_CONDITION_NOT_REPRODUCED`
- With-lock voi `stock = 1`, `requests = 20` ky vong `successOrders = 1`, `finalStock = 0`, `dataConsistent = YES`
- Multi-instance ky vong co `requestDistribution` qua ca server-A va server-B, va `dataConsistent = YES`

## 13. Docs

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
- [Phase 17 Refactor Report](./docs/refactor-report-phase-17.md)

## 14. Luu y trung thuc

- No-lock race condition khong deterministic, nen co the khong reproduce trong moi lan chay
- Neu no-lock chua reproduce, hay tang `CONCURRENT_REQUESTS` hoac `NO_LOCK_PURCHASE_DELAY_MS`, roi chay lai
- With-lock can Redis dang chay
- Multi-instance can mo it nhat 2 terminal / 2 backend processes
- Khong duoc ket luan pass cho with-lock neu `dataConsistent = false`
