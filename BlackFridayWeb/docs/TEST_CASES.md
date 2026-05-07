# BlackFridayWeb Test Cases

Tai lieu nay dung de chung minh 2 y chinh cua do an:

- No-lock co the tao race condition khi nhieu request cung mua mot san pham.
- With-lock dung Redis distributed lock de giu ton kho khong am trong moi kich ban tai cao.

## Bang test case

| ID | Ten test case | Input | Expected result | Muc dich |
| --- | --- | --- | --- | --- |
| TC01 | No-lock race condition | `initialStock=1`, `totalRequests=20`, `concurrency=20`, `quantity=1`, mode `no-lock` | `oversellDetected=true` hoac `successCount > initialStock` hoac `finalStock < 0` | Chung minh loi tranh chap du lieu khi nhieu request cung doc stock ban dau. |
| TC02 | With-lock inventory protection | `initialStock=1`, `totalRequests=20`, `concurrency=20`, `quantity=1`, mode `with-lock` | `successCount=1`, `failedCount=19`, `finalStock=0`, `stockNegative=false`, `oversellDetected=false` | Chung minh Redis lock bao ve ton kho. |
| TC03 | With-lock stock = 5 | `initialStock=5`, `totalRequests=20`, `concurrency=20`, `quantity=1`, mode `with-lock` | `successCount=5`, `failedCount=15`, `finalStock=0`, `stockNegative=false` | Dam bao lock cho phep dung so luong con hang, khong ban qua. |
| TC04 | Multi-server no-lock | 2 backend instances dung chung DB, `initialStock=1`, `requests=50`, mode `no-lock` | Co the xay ra `oversellDetected=true` hoac `successCount > 1` | Chung minh race condition khong chi xay ra trong mot process. |
| TC05 | Multi-server with-lock | 2 backend instances dung chung DB + Redis, `initialStock=1`, `requests=50`, mode `with-lock` | `successCount=1`, `finalStock=0`, `stockNegative=false`, log co `serverInstanceId` tu ca 2 server | Chung minh Redis lock la shared lock giua nhieu server. |
| TC06 | Invalid quantity | `quantity=0`, `quantity=-1`, `quantity="abc"`, hoac `quantity=null` | HTTP `400 Bad Request` | Kiem tra validate input, tranh request sai lam thay doi ton kho. |
| TC07 | Product not found | `productId` khong ton tai | HTTP `404 Not Found` | Kiem tra loi nghiep vu khi san pham khong ton tai. |
| TC08 | Out of stock | `initialStock=0`, `requests=20`, `quantity=1` | Tat ca request fail `OUT_OF_STOCK`, `finalStock=0` | Dam bao khong co giao dich thanh cong khi het hang. |
| TC09 | Lock timeout | `LOCK_WAIT_TIMEOUT_MS` rat nho, concurrency cao, mode `with-lock` | Mot so request fail `LOCK_TIMEOUT`, `stockNegative=false` | Kiem tra timeout co kiem soat, khong lam am kho. |
| TC10 | Lock release safety | Lock cu het TTL, request cu release cham, request moi da acquire lock moi | Request cu khong duoc xoa lock cua request moi | Chung minh release lock dung Lua script so sanh token truoc khi delete. |
| TC11 | Stress test | `initialStock=10`, `requests=100` hoac `500`, mode `with-lock` | `successCount <= 10`, `finalStock >= 0`, `oversellDetected=false` | Kiem tra he thong duoi tai lon. |
| TC12 | Report integrity | Chay bat ky load test nao sinh report JSON | `success + failed = totalRequests`; moi log co `requestId`, `timestamp`, `success/status`, `serverInstanceId` | Dam bao bang chung dua vao bao cao day du va co the truy vet. |

## Lenh chay nhanh

Chay Redis truoc khi test with-lock:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
docker compose up -d redis
```

Chay backend:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm install
npm run dev
```

Chay TC01:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-no-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Expected summary:

```text
Mode: NO_LOCK
Initial stock: 1
Total requests: 20
Concurrency: 20
Success: > 1
Final stock: 0 or negative
Oversell detected: true
Requirement passed: true
```

Chay TC02:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-with-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Expected summary:

```text
Mode: WITH_LOCK
Initial stock: 1
Total requests: 20
Concurrency: 20
Success: 1
Failed: 19
Final stock: 0
Oversell detected: false
Stock negative: false
Requirement passed: true
```

Chay TC03:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-with-lock.js --productId 1 --stock 5 --requests 20 --concurrency 20
```

Expected summary:

```text
Success: 5
Failed: 15
Final stock: 0
Requirement passed: true
```

Chay TC04/TC05 multi-server:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev:multi
```

Mo terminal khac:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-multi-server.js --mode no-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
node scripts/load-test-multi-server.js --mode with-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
```

## Dieu kien pass/fail quan trong

- No-lock pass khi co bang chung race condition: `oversellDetected=true`, `successCount > initialStock`, hoac `finalStock < 0`.
- With-lock pass khi `successCount <= initialStock`, `finalStock >= 0`, `oversellDetected=false`.
- Neu Redis chua chay, with-lock phai fail co kiem soat bang `LOCK_TIMEOUT`/Redis error va script phai exit code `1` neu khong dap ung expected inventory result.
- Moi report JSON duoc ghi trong `backend/reports/`.
