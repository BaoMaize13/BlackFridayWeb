# Edge-Case Testing Guide

## Purpose
This guide explains how to run the Phase 14 reliability and edge-case tests for the distributed inventory backend.

The focus is:
- Redis availability and honesty of test results
- lock timeout behavior
- lock TTL and safe release behavior
- duplicate request idempotency
- validation edge cases
- out-of-stock edge cases
- product-not-found behavior
- transaction rollback when a database error happens inside the locked purchase flow

## Important Redis Note
If Redis local chưa chạy, các Redis-dependent tests có thể bị skip có điều kiện.  
Điều này không có nghĩa là with-lock concurrency đã được xác nhận end-to-end.  
Để xác nhận đầy đủ, bật Redis ở `127.0.0.1:6379` rồi chạy:

```powershell
npm test
```

hoặc:

```powershell
npm run test:integration
npm run test:concurrency
```

## Redis Local Setup
The backend now includes `docker-compose.yml` for a local Redis instance.

Start Redis:

```powershell
npm run redis:up
```

View Redis logs:

```powershell
npm run redis:logs
```

Stop Redis:

```powershell
npm run redis:down
```

If Docker is not available, install and start Redis manually at:

```text
127.0.0.1:6379
```

## Redis Availability Behavior In Tests
Redis-dependent tests use a shared availability helper.

When Redis is unavailable:
- non-Redis tests still run
- Redis-dependent tests are skipped with a clear message
- the test output explicitly says Redis-dependent tests were skipped

Example skip message:

```text
Redis is not available at redis://127.0.0.1:6379/0. Redis-dependent tests were skipped. Reason: connect ECONNREFUSED 127.0.0.1:6379
```

When Redis is available:
- the helper prints:

```text
Redis available at redis://127.0.0.1:6379/0. Running Redis-dependent tests.
```

- lock tests run for real
- with-lock integration tests run for real
- concurrency tests run for real
- edge-case tests run for real

## Forcing Redis-Dependent Tests
If you want the test run to fail when Redis is missing, set:

```powershell
$env:REQUIRE_REDIS_TESTS="true"
```

Then run:

```powershell
npm run test:integration
npm run test:concurrency
npm run test:edge
```

If Redis is unavailable in this mode, the test run fails with a clear message:

```text
Redis is required for this test run but is unavailable.
```

## Phase 14 Edge Cases Covered
### Lock Timeout
- hold a product lock manually
- call `POST /api/purchase/with-lock` on the same product
- expect `LOCK_TIMEOUT`
- verify:
  - no success order
  - stock unchanged
  - `LOCK_TIMEOUT_FOR_PURCHASE` audit log exists

### Redis Unavailable
- simulate lock-service failure
- call `POST /api/purchase/with-lock`
- expect `LOCK_SERVICE_UNAVAILABLE`
- verify:
  - no success order
  - stock unchanged
  - failure audit log exists

### TTL Expiry And Safe Release
- acquire lock with short TTL
- wait until it expires
- acquire the same key again
- verify stale token cannot release the new lock
- verify new token can release it

### Handler Error Still Releases Lock
- run `withLock()` with a handler that throws
- verify the original error is rethrown
- verify the lock is released because the key can be reacquired

### Database Error Inside Locked Purchase Flow
- simulate a DB write failure during success order creation
- verify transaction rollback:
  - stock remains unchanged
  - no success order is created
  - failure log exists

### Duplicate Request Idempotency
- sequential duplicate request id
- concurrent duplicate request id
- verify:
  - at most one success order row
  - stock is only decremented once
  - duplicate audit log exists

### Out-Of-Stock Edges
- `stock = 0, quantity = 1`
- `stock = 1, quantity = 2`
- `stock = 5, quantity = 2`
- `stock = 5, concurrent requests = 10, quantity = 2`

### Validation Edges
- missing `productId`
- empty `productId`
- missing `userId`
- empty `userId`
- missing `requestId`
- empty `requestId`
- missing `quantity`
- `quantity = 0`
- `quantity < 0`
- decimal quantity
- invalid string quantity

The validation edge test also verifies the request is rejected before lock acquisition.

### Product Not Found
- call `POST /api/purchase/with-lock` with a missing product id
- verify:
  - `PRODUCT_NOT_FOUND`
  - no crash
  - lock gets released after the request

### Audit Log Checks
The edge suites verify important logs such as:
- `LOCK_TIMEOUT_FOR_PURCHASE`
- `PURCHASE_WITH_LOCK_FAILED`
- `STOCK_CHECK_FAILED_WITH_LOCK`
- `DUPLICATE_REQUEST_DETECTED`
- `PURCHASE_WITH_LOCK_SUCCESS`

## Transaction Note
The current with-lock flow already uses a database transaction inside the distributed lock.

This means:
- Redis distributed lock handles concurrency
- database transaction handles atomicity for stock update + order creation

The Phase 14 DB error test is important because it proves rollback behavior instead of only assuming it.

## Recommended Verification Flow
### 1. Run tests without requiring Redis

```powershell
npm test
```

Expected:
- unit tests run
- repository/admin/no-lock tests run
- Redis-dependent suites either run or skip honestly

### 2. Start Redis

```powershell
npm run redis:up
```

### 3. Run Redis-dependent suites for real

```powershell
npm run test:integration
npm run test:edge
npm run test:concurrency
```

### 4. Force a strict run

```powershell
$env:REQUIRE_REDIS_TESTS="true"
npm run test:integration
npm run test:edge
npm run test:concurrency
```

### 5. Shut Redis down

```powershell
npm run redis:down
```

## Honesty Rule
Do not claim:
- with-lock concurrency is fully verified
- Redis-dependent tests passed
- all distributed-lock scenarios were checked end-to-end

unless Redis was actually running and those suites actually executed.
