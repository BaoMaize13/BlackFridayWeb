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
- Redis dang chay
- backend chay duoc
- biet cach mo nhieu terminal cho multi-instance demo

DB local mac dinh la SQLite file, nen demo local khong can mot DB server rieng.

## Step 0: Start Redis

```powershell
npm run redis:up
```

Neu khong dung Docker Compose:

- tu bat Redis theo `REDIS_URL`
- mac dinh: `redis://localhost:6379/0`

## Step 1: Start Backend

```powershell
npm run dev
```

Health check:

```powershell
curl.exe "http://localhost:4000/health"
```

Ky vong:

- HTTP `200`
- response co `success: true`

## Step 2: Create Or Find Product

### Cach 1: Lay product tu seed

```powershell
curl.exe "http://localhost:4000/admin/products"
```

Chon 1 `productId` trong danh sach.

### Cach 2: Tao product moi

```powershell
curl.exe -X POST "http://localhost:4000/admin/products" -H "Content-Type: application/json" -d "{\"code\":\"DEMO-PHASE18-001\",\"name\":\"Distributed Lock Demo Product\",\"price\":199000,\"stock\":10}"
```

Sau do luu lai `productId` tra ve trong response.

## Step 3: Reset Product To Stock = 1

```powershell
curl.exe -X POST "http://localhost:4000/admin/products/<productId>/reset" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

Vi du:

```powershell
curl.exe -X POST "http://localhost:4000/admin/products/1/reset" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

Ky vong:

- stock ve `1`
- orders va logs cu duoc clear

## Step 4: Run No-Lock Test

Neu muon chay nhanh:

```powershell
npm run evidence:no-lock
```

Neu muon chi dinh `productId` ro hon:

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

## Step 5: Run With-Lock Test

```powershell
$env:PRODUCT_ID="<productId>"
$env:INITIAL_STOCK="1"
$env:CONCURRENT_REQUESTS="20"
npm run evidence:with-lock
```

Ky vong voi case co dien `stock = 1`, `requests = 20`, `quantity = 1`:

- `successOrders = 1`
- `finalStock = 0`
- `oversellDetected = NO`
- `negativeStockDetected = NO`
- `dataConsistent = YES`

Neu Redis chua chay:

- with-lock se khong duoc verify day du
- script co the bao `LOCK_SERVICE_UNAVAILABLE` hoac ket noi Redis that bai

## Step 6: Compare Reports

Tim 2 file JSON report vua tao trong thu muc `reports/`, sau do chay:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

Ky vong:

- sinh compare report JSON / Markdown / CSV
- compare report noi ro no-lock khong an toan, with-lock consistent

## Step 7: Multi-Instance Demo

### Terminal 1: server A

```powershell
npm run dev:server-a
```

### Terminal 2: server B

```powershell
npm run dev:server-b
```

### Terminal 3: chay multi-instance with-lock

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=<productId> INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:with-lock
```

Neu muon xem no-lock multi-instance:

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=<productId> INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:no-lock
```

Ky vong multi-instance with-lock:

- request duoc chia qua ca `http://localhost:3000` va `http://localhost:3001`
- logs co `server-A` va `server-B`
- `successOrders = 1`
- `finalStock = 0`
- `dataConsistent = YES`

## Step 8: Show Evidence

Nhung diem nen show cho giang vien:

- terminal output cua `evidence:no-lock`
- terminal output cua `evidence:with-lock`
- compare report Markdown trong `reports/`
- multi-instance report Markdown trong `reports/`
- `GET /admin/metrics`
- `GET /admin/attempt-logs?productId=<productId>`

Admin metrics:

```powershell
curl.exe "http://localhost:4000/admin/metrics?productId=<productId>&initialStock=1&quantity=1&includeServerBreakdown=true"
```

## Step 9: Explain Conclusion

Noi ngan gon:

1. no-lock doc stock cu truoc delay, nen nhieu request co the dua tren stale stock
2. with-lock dung Redis distributed lock theo `productId`, nen critical section duoc serialize
3. multi-instance van dung vi server-A va server-B cung tranh cung mot Redis lock key

## Sample Output Notes

Day la sample minh hoa, khong phai luc nao no-lock cung reproduce y het:

- No-lock:
  - `oversellDetected` co the la `YES` neu reproduce
  - hoac report se noi `RACE_CONDITION_NOT_REPRODUCED` neu run nay chua trung race
- With-lock:
  - `successOrders: 1`
  - `finalStock: 0`
  - `dataConsistent: YES`
- Multi-instance:
  - `requestDistribution` co ca server A va B
  - `serverLogDistribution` co ca `server-A` va `server-B`
  - `dataConsistent: YES`
