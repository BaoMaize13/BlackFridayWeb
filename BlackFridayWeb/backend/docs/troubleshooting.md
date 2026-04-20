# Troubleshooting

## Port Already In Use

Trieu chung:

- `npm run dev` khong start duoc
- bao loi `EADDRINUSE`

Cach kiem tra tren PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 4000 | Select-Object LocalPort, State, OwningProcess
```

Dung process:

```powershell
Stop-Process -Id <PID> -Force
```

Hoac doi port:

```powershell
$env:PORT="4001"
npm run dev
```

## Redis Connection Refused

Trieu chung:

- `LOCK_SERVICE_UNAVAILABLE`
- `ECONNREFUSED 127.0.0.1:6379`
- `npm run test:lock` that bai

Cach xu ly:

```powershell
npm run redis:up
npm run redis:logs
```

Kiem tra lai `REDIS_URL` trong `.env`:

```dotenv
REDIS_URL=redis://localhost:6379/0
```

## Redis-Dependent Tests Skipped

Trieu chung:

- test suite bao skip Redis-dependent tests

Day khong phai full pass. Nghia la:

- unit va phan khong can Redis van pass
- phan verify distributed lock chua duoc xac nhan day du trong run nay

Muons verify day du:

```powershell
npm run redis:up
npm run test:lock
npm run test:integration
npm run test:with-lock
```

Neu muon buoc test fail thay vi skip:

```powershell
$env:REQUIRE_REDIS_TESTS="true"
npm test
```

## DB Connection Failed

Trieu chung:

- backend khong start duoc
- admin APIs loi database

Voi local demo, DB mac dinh la SQLite:

```dotenv
DB_CLIENT=sqlite3
DB_URL=./data/blackfridayweb.sqlite
```

Chay lai migration va seed:

```powershell
npm run db:migrate
npm run db:seed
```

Neu dung DB khac:

- kiem tra `DB_CLIENT`
- kiem tra `DB_URL`
- dam bao DB server dang chay

## ProductId Missing

Trieu chung:

- script bao thieu `PRODUCT_ID`
- reset API khong biet san pham nao de thao tac

Lay danh sach san pham:

```powershell
curl.exe "http://localhost:4000/admin/products"
```

Hoac tao san pham moi:

```powershell
curl.exe -X POST "http://localhost:4000/admin/products" -H "Content-Type: application/json" -d "{\"code\":\"DEMO-TROUBLE-001\",\"name\":\"Demo Product\",\"price\":100000,\"stock\":10}"
```

## No-Lock Did Not Reproduce Oversell

Race condition khong deterministic. Neu run hien tai chua trung race, khong duoc fake ket qua.

Cach thu lai:

```powershell
$env:CONCURRENT_REQUESTS="50"
$env:NO_LOCK_PURCHASE_DELAY_MS="300"
npm run evidence:no-lock
```

Co the chay lai vai lan. Doc report:

- `RACE_CONDITION_REPRODUCED`
- `RACE_WINDOW_OBSERVED`
- `RACE_CONDITION_NOT_REPRODUCED`

## With-Lock Got LOCK_TIMEOUT

`LOCK_TIMEOUT` khong dong nghia voi oversell. Nghia la request khong lay duoc lock trong thoi gian cho.

Cach xu ly:

```powershell
$env:LOCK_WAIT_TIMEOUT_MS="5000"
npm run evidence:with-lock
```

Kiem tra them:

- `LOCK_TTL_MS`
- `LOCK_RETRY_INTERVAL_MS`
- Redis co on dinh khong

## Multi-Instance Server B Not Receiving Requests

Kiem tra command:

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=<productId> INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:with-lock
```

Kiem tra:

- `BASE_URLS` co du ca 2 URLs
- server B co dang chay that o port `3001`
- `GET /health` cua server B tra OK

Thu:

```powershell
curl.exe "http://localhost:3001/health"
```

Doc report:

- `requestDistribution`
- `responseServerDistribution`
- `serverLogDistribution`

## Reports Not Generated

Kiem tra quyen ghi vao thu muc `reports/` va bien moi truong:

```powershell
$env:REPORT_ENABLED="true"
$env:REPORT_DIR="reports"
```

Neu dung compare hoac metrics script:

```powershell
npm run report:metrics -- --input=reports\\some-report.json
npm run report:compare -- --noLock=reports\\a.json --withLock=reports\\b.json
```

Kiem tra file dau vao co ton tai khong:

```powershell
Get-ChildItem .\reports
```
