# Backend Testing Guide

## Purpose
This guide explains how to run the automated test suites for the backend of the distributed data contention project.

The automated tests are split into:
- unit tests
- integration tests
- concurrency tests

## Test Environment
The automated tests use:
- `.env.test`
- SQLite in-memory database
- Redis test key prefix: `test-lock`

Key test environment values:

```dotenv
NODE_ENV=test
DB_URL=:memory:
REDIS_URL=redis://127.0.0.1:6379/0
LOCK_KEY_PREFIX=test-lock
NO_LOCK_PURCHASE_DELAY_MS=5
```

## Prerequisites
1. Install dependencies.
2. Start Redis if you want to run lock-related and with-lock concurrency tests.

Install dependencies:

```powershell
npm install
```

Start Redis locally:

```powershell
redis-server
```

Or with Docker:

```powershell
docker run --name blackfridayweb-redis -p 6379:6379 redis:7-alpine
```

## Test Scripts
Run unit tests:

```powershell
npm run test:unit
```

Run integration tests:

```powershell
npm run test:integration
```

Run concurrency tests:

```powershell
npm run test:concurrency
```

Run all automated tests:

```powershell
npm run test:all
```

Shortcut:

```powershell
npm test
```

## What Each Group Covers
### Unit Tests
The unit test suite checks:
- purchase request validation
- lock key utility
- lock token utility
- response helper format
- `AppError` behavior

### Integration Tests
The integration test suite checks:
- health endpoint and standardized errors
- repository operations
- admin APIs
- single-request `POST /api/purchase/no-lock`
- single-request `POST /api/purchase/with-lock`
- Redis lock service behavior

### Concurrency Tests
The concurrency test suite checks:
- multiple concurrent requests to `POST /api/purchase/with-lock`
- final stock remains consistent
- success order count does not exceed available stock
- final stock never becomes negative

## Redis-Dependent Tests
Some tests require Redis:
- lock service tests
- most `/api/purchase/with-lock` tests
- concurrency tests

If Redis is not running, those tests are skipped with a clear message.

Example skip message:

```text
Redis unavailable at redis://127.0.0.1:6379/0: Redis reconnect retry limit reached
```

This keeps the suite honest:
- no fake pass
- no fake fail
- Redis-independent tests still run normally

## Main Automated Scenarios
### No-Lock Single Request Tests
- success purchase
- out of stock
- product not found
- validation fail
- duplicate request id

### With-Lock Single Request Tests
- success purchase
- out of stock
- product not found
- validation fail
- duplicate request id returns existing order
- lock service unavailable

### With-Lock Concurrency Tests
- stock = 1, requests = 10, quantity = 1
- stock = 1, requests = 20, quantity = 1
- stock = 5, requests = 20, quantity = 1
- stock = 5, requests = 10, quantity = 2

Expected consistency rules:
- `successOrders <= floor(initialStock / quantity)`
- `finalStock === initialStock - successOrders * quantity`
- `finalStock >= 0`

## Setup And Teardown Strategy
Before each test:
- reset the in-memory database
- rerun migrations
- restore baseline seed products
- clean Redis test keys when relevant

After all tests:
- close database connection
- close Redis connection

This ensures:
- test reruns are deterministic
- test order does not matter
- no stale DB rows or Redis keys leak between tests

## Reading The Output
Expected successful output pattern:

```text
✔ POST /api/purchase/no-lock succeeds for a single in-stock request
✔ POST /api/admin/products creates a product and GET endpoints return it
✔ validatePurchaseNoLockBody rejects missing productId
```

Redis-dependent skipped output pattern:

```text
﹣ with-lock concurrency keeps consistency for stock=1, requests=20, quantity=1
  # Redis unavailable at redis://127.0.0.1:6379/0: Redis reconnect retry limit reached
```

## Recommended Local Verification Flow
1. Run `npm run test:unit`
2. Run `npm run test:integration`
3. Start Redis
4. Run `npm run test:concurrency`
5. Run `npm test`

## Manual Follow-Up When Redis Is Available
After starting Redis, rerun:

```powershell
npm run test:integration
npm run test:concurrency
```

At that point the Redis-dependent suites should execute instead of being skipped.
