# BlackFridayWeb Defense Guide

Tai lieu nay la checklist demo truoc giang vien. Cac lenh ben duoi uu tien PowerShell tren Windows.

## 1. Cai dependency

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

## 2. Chay Redis

Redis bat buoc cho demo distributed lock:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
docker compose up -d redis
```

Kiem tra Redis:

```powershell
docker compose ps
```

Neu khong dung Docker, co the chay Redis local tai `redis://localhost:6379/0`.

## 3. Chay database

Project mac dinh dung SQLite tai `backend/data/blackfridayweb.sqlite`.

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run db:migrate
npm run db:seed
```

Kiem tra san pham:

```powershell
npm run db:list-products
```

## 4. Chay backend mot server

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev
```

Mac dinh backend chay o:

```text
http://localhost:4000
```

Kiem tra API:

```powershell
Invoke-RestMethod http://localhost:4000/api/products
```

## 5. Chay backend hai server

Hai server dung chung SQLite file va Redis:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev:multi
```

Server A:

```text
http://localhost:5000
```

Server B:

```text
http://localhost:5001
```

Trong log va response se co `serverInstanceId` de chung minh request di qua ca hai instance.

## 6. Chay frontend

```powershell
cd D:\Project_2\BlackFridayWeb\frontend
npm run dev
```

Mo URL Vite hien tren terminal, thuong la:

```text
http://localhost:5173
```

## 7. Reset stock

Dung API:

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/api/products/1/reset-stock -ContentType "application/json" -Body '{"stock":1}'
```

Hoac vao frontend:

- Product Detail
- Chon san pham
- Bam reset stock ve `1`, `5`, hoac `10`

## 8. Demo no-lock simulation

Lenh CLI:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-no-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Ket qua can quan sat:

```text
Mode: NO_LOCK
Initial stock: 1
Total requests: 20
Success: > 1
Oversell detected: true
Requirement passed: true
```

Y nghia de noi voi giang vien:

```text
Khi khong co khoa, nhieu request cung doc stock = 1 truoc khi request dau tien ghi lai DB.
Vi moi request deu thay con hang, nhieu request duoc chap nhan, dan den ban vuot ton kho ban dau.
```

Tren frontend:

- Vao No-Lock Simulation
- Nhap `productId=1`, `initialStock=1`, `totalRequests=20`, `concurrency=20`, `quantity=1`
- Bam Run
- Chup man hinh badge `Race condition confirmed` va bang request logs

## 9. Demo with-lock simulation

Lenh CLI:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-with-lock.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Ket qua expected:

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

Y nghia de noi voi giang vien:

```text
Voi Redis distributed lock, moi productId co mot lock key rieng: lock:product:{productId}.
Backend acquire lock bang SET NX PX, chi request giu lock moi duoc doc va tru stock.
Khi release, Lua script chi xoa lock neu token trung voi token cua request dang giu lock.
```

Tren frontend:

- Vao With-Lock Simulation
- Nhap cung thong so voi no-lock
- Bam Run
- Chup man hinh badge `Distributed lock protected inventory`
- Chup cac chi so `successCount=1`, `finalStock=0`, `stockNegative=false`

## 10. Demo compare

Lenh CLI:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-compare.js --productId 1 --stock 1 --requests 20 --concurrency 20
```

Tren frontend:

- Vao Compare
- Chay cung mot scenario
- Chup bang so sanh:
  - No-lock: race condition occurred
  - With-lock: inventory consistency preserved

## 11. Demo multi-server

Terminal 1:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
npm run dev:multi
```

Terminal 2:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/load-test-multi-server.js --mode no-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
node scripts/load-test-multi-server.js --mode with-lock --productId 1 --stock 1 --requests 50 --concurrency 50 --baseUrls http://localhost:5000,http://localhost:5001
```

Ket qua can chup:

- No-lock co `oversellDetected=true` hoac `successCount > 1`.
- With-lock co `successCount=1`, `finalStock=0`, `oversellDetected=false`.
- Report/log co `serverInstanceIds` gom `server-A` va `server-B`.

## 12. Lay report dua vao bao cao

Sau moi test, file JSON duoc sinh trong:

```text
D:\Project_2\BlackFridayWeb\backend\reports
```

Vi du:

```text
reports/no-lock-YYYYMMDD-HHmmss.json
reports/with-lock-YYYYMMDD-HHmmss.json
reports/compare-YYYYMMDD-HHmmss.json
reports/multi-server-YYYYMMDD-HHmmss.json
```

Co the tong hop report:

```powershell
cd D:\Project_2\BlackFridayWeb\backend
node scripts/generate-test-report.js
```

Nen dua vao bao cao:

- Thong so test: stock ban dau, total requests, concurrency, quantity.
- Summary: success, failed, final stock, oversellDetected, stockNegative.
- Evidence logs: requestId, mode, productId, stockBefore, stockAfter, serverInstanceId, durationMs.

## 13. Kich ban noi khi bao ve

Gioi thieu van de:

```text
Trong he thong ban hang phan tan, nhieu server co the cung nhan request mua hang.
Neu thao tac doc stock va ghi stock khong duoc bao ve, cac request co the cung doc stock = 1 va deu tuong con hang.
Ket qua la ban vuot so luong ton kho ban dau.
```

Demo no-lock:

```text
Em reset stock ve 1, sau do ban 20 request dong thoi.
Vi route no-lock co delay giua buoc doc va buoc ghi, nhieu request doc cung mot gia tri stock ban dau.
Ket qua success lon hon 1 trong khi stock ban dau chi co 1, nen race condition da duoc tai hien.
```

Demo with-lock:

```text
Em reset stock ve 1 va ban cung 20 request.
Lan nay route with-lock acquire Redis lock theo key lock:product:{productId} truoc khi doc stock.
Chi request giu lock moi duoc tru kho, cac request con lai se thay het hang hoac timeout co kiem soat.
Ket qua chi 1 request thanh cong, finalStock = 0, khong oversell.
```

Demo multi-server:

```text
Em chay server-A port 5000 va server-B port 5001.
Load test ban request xen ke vao ca hai server.
No-lock van co the oversell vi moi server xu ly doc/ghi rieng.
With-lock khong oversell vi ca hai server dung chung Redis lock.
```

Ket luan:

```text
Giai phap Redis Distributed Lock voi SET NX PX va Lua script release giup tuan tu hoa thao tac mua hang theo productId.
Nho do he thong dam bao ton kho khong am duoi tai cao va trong moi truong nhieu server.
```

## 14. Checklist truoc khi demo

- Docker Desktop/Redis dang chay.
- Backend single server chay duoc o `http://localhost:4000`.
- Frontend goi dung backend va khong dung du lieu fake.
- No-lock voi stock `1`, requests `20` tao `oversellDetected=true`.
- With-lock voi stock `1`, requests `20` co `success=1`, `finalStock=0`.
- With-lock voi stock `5`, requests `20` co `success=5`, `finalStock=0`.
- Multi-server with-lock co log tu `server-A` va `server-B`.
- Report JSON da nam trong `backend/reports`.
- Da chup man hinh No-Lock, With-Lock, Compare, Test Report.
