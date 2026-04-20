# Demo Guide

## Demo Goal

Can chung minh 3 diem:

- khong khoa thi co rui ro overselling / stock mismatch
- co Redis distributed lock thi khong oversell
- nhieu backend instances cung luc van dung khi dung chung DB va Redis

## Prerequisites

- Node.js da cai
- dependency da cai bang `npm install`
- `.env` da duoc tao tu `.env.example`
- migration va seed da chay
- Redis dang chay
- backend chay duoc

Tai khoan demo mac dinh sau `npm run db:seed`:

- `admin@example.com`
- `password`

## Step 0: Start Redis

```powershell
npm run redis:up
```

## Step 1: Run Migration And Seed

```powershell
npm run db:migrate
npm run db:seed
```

## Step 2: Start Backend

```powershell
npm run dev
```

Health check:

```powershell
curl.exe "http://localhost:4000/api/health"
```

## Step 3: Login And Capture JWT

PowerShell:

```powershell
$login = Invoke-RestMethod -Method POST -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"email":"admin@example.com","password":"password"}'
$token = $login.data.token
```

Ky vong:

- login thanh cong
- co `token`
- co `user.role = admin`

## Step 4: Create Or Find Product

Lay product list:

```powershell
curl.exe "http://localhost:4000/api/admin/products" -H "Authorization: Bearer $token"
```

Neu can tao product moi:

```powershell
curl.exe -X POST "http://localhost:4000/api/admin/products" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"code\":\"DEMO-PHASE18-001\",\"name\":\"Distributed Lock Demo Product\",\"price\":199000,\"stock\":10}"
```

## Step 5: Reset Product To Stock = 1

```powershell
curl.exe -X POST "http://localhost:4000/api/admin/products/<productId>/reset" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

Ky vong:

- stock ve `1`
- orders va logs cu duoc clear

## Step 6: Run No-Lock Test

CLI script tu dang nhap bang seeded admin mac dinh:

```powershell
$env:PRODUCT_ID="<productId>"
$env:INITIAL_STOCK="1"
$env:CONCURRENT_REQUESTS="20"
npm run evidence:no-lock
```

Ky vong:

- co the thay `oversellDetected = YES` hoac `stockMismatch = YES`
- neu run nay chua reproduce, report co the ra `RACE_WINDOW_OBSERVED` hoac `RACE_CONDITION_NOT_REPRODUCED`

Neu chua reproduce:

- tang `CONCURRENT_REQUESTS`
- tang `NO_LOCK_PURCHASE_DELAY_MS`
- chay lai 2-3 lan

## Step 7: Run With-Lock Test

```powershell
$env:PRODUCT_ID="<productId>"
$env:INITIAL_STOCK="1"
$env:CONCURRENT_REQUESTS="20"
npm run evidence:with-lock
```

Ky vong:

- `successOrders = 1`
- `finalStock = 0`
- `oversellDetected = NO`
- `negativeStockDetected = NO`
- `dataConsistent = YES`

Neu Redis chua chay:

- with-lock se khong duoc verify day du
- script co the bao `LOCK_SERVICE_UNAVAILABLE`

## Step 8: Compare Reports

Tim 2 file JSON report vua tao trong thu muc `reports/`, sau do chay:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

Ky vong:

- sinh compare report JSON / Markdown / CSV
- compare report noi ro no-lock khong an toan, with-lock consistent

## Step 9: Multi-Instance Demo

### Terminal 1: server A

```powershell
npm run dev:server-a
```

### Terminal 2: server B

```powershell
npm run dev:server-b
```

### Terminal 3: multi-instance with-lock

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=<productId> INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:with-lock
```

Ky vong:

- request duoc chia qua ca `http://localhost:3000` va `http://localhost:3001`
- logs co `server-A` va `server-B`
- `successOrders = 1`
- `finalStock = 0`
- `dataConsistent = YES`

## Step 10: Show Evidence

Nhung diem nen show cho giang vien:

- terminal output cua `evidence:no-lock`
- terminal output cua `evidence:with-lock`
- compare report Markdown trong `reports/`
- multi-instance report Markdown trong `reports/`
- `GET /api/admin/metrics`
- `GET /api/admin/attempt-logs?productId=<productId>`

Vi du:

```powershell
curl.exe "http://localhost:4000/api/admin/metrics?productId=<productId>&initialStock=1&quantity=1&includeServerBreakdown=true" -H "Authorization: Bearer $token"
```

## Step 11: Explain Conclusion

Noi ngan gon:

1. no-lock doc stock cu truoc delay, nen nhieu request co the dua tren stale stock
2. with-lock dung Redis distributed lock theo `productId`, nen critical section duoc serialize
3. multi-instance van dung vi server-A va server-B cung tranh cung mot Redis lock key
