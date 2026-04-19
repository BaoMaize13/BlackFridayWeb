# Multi-Instance Demo Guide

## Purpose
This guide shows how to demonstrate the backend in a real multi-instance setup where:
- backend instance A and backend instance B run at the same time
- both instances share the same database
- both instances share the same Redis
- concurrent purchase requests are distributed across both instances

This is the key Phase 15 proof that Redis distributed lock works across multiple backend servers, not only inside a single process.

## Prerequisites
Before starting the demo, make sure:
- the shared database is reachable
- Redis is running
- both backend instances point to the same `DB_URL`
- both backend instances point to the same `REDIS_URL`

With the default SQLite setup in this project, both instances can share the same SQLite file as long as they use the same `DB_URL`.

## Start Redis
If Docker is available:

```powershell
npm run redis:up
```

Or directly:

```powershell
docker compose up -d redis
```

## Start Backend Instance A
Open terminal 1:

```powershell
npm run dev:server-a
```

This starts:
- `PORT=3000`
- `SERVER_ID=server-A`

## Start Backend Instance B
Open terminal 2:

```powershell
npm run dev:server-b
```

This starts:
- `PORT=3001`
- `SERVER_ID=server-B`

## Verify Both Servers
Check health:

```powershell
curl.exe "http://localhost:3000/health"
curl.exe "http://localhost:3001/health"
```

Expected:
- server on `3000` reports `server-A`
- server on `3001` reports `server-B`

## Prepare Or Reset Product
Use any healthy instance for admin APIs, for example instance A:

```powershell
curl.exe -X POST "http://localhost:3000/admin/products/1/reset" ^
  -H "Content-Type: application/json" ^
  -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

Replace `1` with the product you want to test.

## Run Multi-Instance No-Lock
Example:

```powershell
npx cross-env MODE=no-lock BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance
```

Or with the convenience script:

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:no-lock
```

Expected:
- request distribution should show both base URLs
- server log distribution should show `server-A` and `server-B`
- race condition may reproduce
- if it does not reproduce in that run, the report will say so honestly

## Run Multi-Instance With-Lock
Example:

```powershell
npx cross-env MODE=with-lock BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance
```

Or with the convenience script:

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:with-lock
```

Expected for the classic case `stock = 1`, `requests = 20`, `quantity = 1`:
- `successOrders = 1`
- `finalStock = 0`
- `oversellDetected = NO`
- `negativeStockDetected = NO`
- `dataConsistent = YES`
- server log distribution includes both `server-A` and `server-B`

This is the core evidence that Redis distributed lock works across multiple backend instances.

## Read The Report
If `REPORT_ENABLED=true`, the script writes:
- JSON report
- Markdown report

Check these sections:
- `requestDistribution`
- `responseServerDistribution`
- `serverLogDistribution`
- `serverRequestOutcomeDistribution`
- `consistencyCheck`
- `conclusion`

What to look for:
- requests were sent to both target URLs
- logs came from both `server-A` and `server-B`
- with-lock stayed consistent
- no-lock may show inconsistency or may honestly say race condition was not reproduced in that run

## Demo Conclusion
Use the demo to explain:
- local mutex is not enough in a distributed system because requests are handled by different backend instances
- both instance A and instance B share the same Redis
- both instances compete for the same lock key, for example `lock:product:1`
- because Redis is shared, the lock serializes critical sections across servers
- therefore stock does not go negative and success orders do not exceed available stock

## One Server Down Scenario
You can intentionally stop instance B and rerun:

```powershell
npx cross-env MODE=with-lock BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance
```

Expected:
- requests to the down server fail with network errors
- requests to the healthy server still get processed
- the script does not crash
- the report says the run was partial and does not falsely claim full multi-instance verification

## Redis Down Scenario
Stop Redis, then run the with-lock scenario again.

Expected:
- with-lock requests fail clearly with `LOCK_SERVICE_UNAVAILABLE` or Redis connectivity errors
- the script does not claim lock success
- the report remains honest

## Troubleshooting
### Redis is not running
- start Redis with `npm run redis:up`
- or run `docker compose up -d redis`

### Server B is not running
- start it in a second terminal with `npm run dev:server-b`

### Port 3000 or 3001 is already in use
- stop the conflicting process
- or run the backend manually with different ports and pass matching `BASE_URLS`

### Product ID is wrong
- query the product list:

```powershell
curl.exe "http://localhost:3000/admin/products"
```

### Database is not connected
- verify `DB_URL`
- verify migrations and seed if needed:

```powershell
npm run db:migrate
npm run db:seed
```

### Race condition not reproduced in no-lock run
That can happen because race conditions are nondeterministic.

Try:
- increasing `CONCURRENT_REQUESTS`
- increasing `NO_LOCK_PURCHASE_DELAY_MS`
- rerunning the no-lock scenario
