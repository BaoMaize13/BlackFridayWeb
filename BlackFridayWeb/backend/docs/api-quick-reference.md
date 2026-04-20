# API Quick Reference

Day khong phai OpenAPI day du. Muc tieu la de frontend va demo flow dung dung contract `/api`.

## Health

### GET /health
### GET /api/health

Muc dich:

- kiem tra backend da chay
- xem thong tin server, database, Redis

Vi du:

```powershell
curl.exe "http://localhost:4000/health"
curl.exe "http://localhost:4000/api/health"
```

## Auth

### POST /api/auth/login

Body mau:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response thanh cong:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt-token",
    "user": {
      "id": 1,
      "email": "admin@example.com",
      "username": "admin",
      "name": "Admin",
      "role": "admin",
      "status": "active"
    }
  }
}
```

### POST /api/auth/register

Body mau:

```json
{
  "email": "demo@example.com",
  "password": "password",
  "name": "Demo User",
  "username": "demo"
}
```

### GET /api/auth/me

Can header:

```text
Authorization: Bearer <token>
```

### POST /api/auth/logout

Hien tai logout theo huong stateless JWT:

- backend tra response thanh cong
- frontend tu xoa local session

## Admin APIs

Tat ca routes duoi day deu can:

```text
Authorization: Bearer <admin-jwt>
```

### POST /api/admin/products

Body mau:

```json
{
  "code": "DEMO-001",
  "name": "Demo Product",
  "price": 199000,
  "stock": 10
}
```

### GET /api/admin/products

Muc dich:

- lay danh sach product
- tim `productId` de demo

### GET /api/admin/products/:productId

### PATCH /api/admin/products/:productId/stock

Body mau:

```json
{
  "stock": 5
}
```

### POST /api/admin/products/:productId/reset

Body mau:

```json
{
  "stock": 1,
  "clearOrders": true,
  "clearLogs": true
}
```

### GET /api/admin/orders

Query hay dung:

- `productId`
- `requestId`
- `status`

### GET /api/admin/orders/:orderId

### DELETE /api/admin/orders

### GET /api/admin/attempt-logs

Query hay dung:

- `productId`
- `requestId`
- `action`
- `result`

### GET /api/admin/attempt-logs/:requestId

### DELETE /api/admin/attempt-logs

### GET /api/admin/stats

### GET /api/admin/metrics

Vi du:

```powershell
curl.exe "http://localhost:4000/api/admin/metrics?productId=1&initialStock=1&quantity=1&includeServerBreakdown=true" -H "Authorization: Bearer <token>"
```

Loi thuong gap:

- `UNAUTHORIZED`
- `INVALID_TOKEN`
- `FORBIDDEN`
- `PRODUCT_NOT_FOUND`
- `VALIDATION_ERROR`

## Purchase APIs

### POST /api/purchase/no-lock

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

### POST /api/purchase/with-lock

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

Loi thuong gap:

- `VALIDATION_ERROR`
- `PRODUCT_NOT_FOUND`
- `OUT_OF_STOCK`
- `DUPLICATE_REQUEST`
- `LOCK_TIMEOUT`
- `LOCK_SERVICE_UNAVAILABLE`
