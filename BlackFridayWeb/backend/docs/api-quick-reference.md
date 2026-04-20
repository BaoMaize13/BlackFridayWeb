# API Quick Reference

Day khong phai OpenAPI day du. Muc tieu la de demo nhanh.

## Health

### GET /health

Muc dich:

- kiem tra backend da chay
- xem thong tin server, database, Redis

Vi du:

```powershell
curl.exe "http://localhost:4000/health"
```

Response chinh:

- `success`
- `data.appName`
- `data.environment`
- `data.server`
- `data.services`

Loi thuong gap:

- backend chua chay

## Admin Product

### POST /admin/products

Muc dich:

- tao product demo moi

Body mau:

```json
{
  "code": "DEMO-001",
  "name": "Demo Product",
  "price": 199000,
  "stock": 10
}
```

Vi du:

```powershell
curl.exe -X POST "http://localhost:4000/admin/products" -H "Content-Type: application/json" -d "{\"code\":\"DEMO-001\",\"name\":\"Demo Product\",\"price\":199000,\"stock\":10}"
```

Loi thuong gap:

- `VALIDATION_ERROR`
- duplicate `code`

### GET /admin/products

Muc dich:

- lay danh sach product
- tim `productId` de demo

Vi du:

```powershell
curl.exe "http://localhost:4000/admin/products"
```

### GET /admin/products/:productId

Muc dich:

- xem chi tiet mot product

Vi du:

```powershell
curl.exe "http://localhost:4000/admin/products/1"
```

Loi thuong gap:

- `PRODUCT_NOT_FOUND`

### PATCH /admin/products/:productId/stock

Muc dich:

- cap nhat stock nhanh

Body mau:

```json
{
  "stock": 5
}
```

### POST /admin/products/:productId/reset

Muc dich:

- reset stock
- clear orders
- clear logs

Body mau:

```json
{
  "stock": 1,
  "clearOrders": true,
  "clearLogs": true
}
```

Vi du:

```powershell
curl.exe -X POST "http://localhost:4000/admin/products/1/reset" -H "Content-Type: application/json" -d "{\"stock\":1,\"clearOrders\":true,\"clearLogs\":true}"
```

## Admin Orders

### GET /admin/orders

Muc dich:

- xem order sau khi chay test

Vi du:

```powershell
curl.exe "http://localhost:4000/admin/orders?productId=1"
```

Response chinh:

- danh sach orders
- `status`
- `requestId`
- `failureReason` neu co

Loi thuong gap:

- query sai `productId`

## Admin Logs

### GET /admin/attempt-logs

Muc dich:

- xem audit logs / purchase attempt logs

Vi du:

```powershell
curl.exe "http://localhost:4000/admin/attempt-logs?productId=1"
```

Response chinh:

- `action`
- `requestId`
- `result`
- `serverId`
- `stockBefore`
- `stockAfter`

Loi thuong gap:

- query sai `productId`

## Metrics

### GET /admin/metrics

Muc dich:

- xem tong hop orders, errors, consistency check, server breakdown

Vi du:

```powershell
curl.exe "http://localhost:4000/admin/metrics?productId=1&initialStock=1&quantity=1&includeServerBreakdown=true"
```

Query hay dung:

- `productId`
- `initialStock`
- `quantity`
- `includeLogs`
- `includeServerBreakdown`

Response chinh:

- `stock`
- `orders`
- `errors`
- `stockMetrics`
- `consistencyCheck`
- `serverBreakdown`

Loi thuong gap:

- `PRODUCT_NOT_FOUND`
- `VALIDATION_ERROR`

## Purchase

### POST /purchase/no-lock

Muc dich:

- baseline khong khoa de mo phong race condition

Body mau:

```json
{
  "productId": 1,
  "quantity": 1,
  "requestId": "demo-no-lock-001",
  "userId": "student-001"
}
```

Vi du:

```powershell
curl.exe -X POST "http://localhost:4000/purchase/no-lock" -H "Content-Type: application/json" -d "{\"productId\":1,\"quantity\":1,\"requestId\":\"demo-no-lock-001\",\"userId\":\"student-001\"}"
```

Loi thuong gap:

- `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`
- `OUT_OF_STOCK`
- `DUPLICATE_REQUEST`

### POST /purchase/with-lock

Muc dich:

- xu ly mua hang voi Redis distributed lock

Body mau:

```json
{
  "productId": 1,
  "quantity": 1,
  "requestId": "demo-with-lock-001",
  "userId": "student-001"
}
```

Vi du:

```powershell
curl.exe -X POST "http://localhost:4000/purchase/with-lock" -H "Content-Type: application/json" -d "{\"productId\":1,\"quantity\":1,\"requestId\":\"demo-with-lock-001\",\"userId\":\"student-001\"}"
```

Loi thuong gap:

- `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`
- `OUT_OF_STOCK`
- `DUPLICATE_REQUEST`
- `LOCK_TIMEOUT`
- `LOCK_SERVICE_UNAVAILABLE`
