# Distributed Lock Design

## 1. Problem To Solve
The current `POST /api/purchase/no-lock` flow is intentionally unsafe.

Multiple requests can:
- read the same old stock value
- pass the stock check at the same time
- update stock based on a stale snapshot
- create more successful orders than the initial stock allows

This creates:
- race condition
- overselling
- stock mismatch between `products.stock` and successful order count

Local mutex in Node.js memory is not enough because the target deployment model is multiple backend processes or multiple backend servers sharing the same database.

## 2. Lock Goal
The lock must ensure:
- at most one purchase flow for the same `productId` enters the critical section at a time
- requests for different products can still run in parallel
- waiting requests do not block forever
- dead lock is avoided when a server crashes
- the request that acquired the lock is the only one allowed to release it

## 3. Primary Solution Choice
Primary solution for the project:

```text
Redis distributed lock per productId
```

Why this is the primary solution:
- it works across multiple processes and multiple servers
- it is simple enough for a thesis/demo project
- Redis can act as a lightweight lock coordinator
- it matches the system narrative: many application instances, shared storage, concurrent purchase requests

Alternatives that may be discussed but are not the primary solution in this phase:
- database row lock
- optimistic locking with product version
- queue-based serialization

## 4. Why Not Local Mutex
Local in-memory mutex is rejected as the main solution because:
- it only protects one Node.js process
- if there are two backend instances, each instance has its own memory and its own mutex
- requests routed to different instances would still race against each other

So local mutex can reduce race only in a single-process demo, but it does not solve the distributed problem that this project wants to demonstrate and then fix.

## 5. Lock Scope And Granularity
Lock granularity:

```text
lock per productId
```

Reason:
- all purchase requests for the same product contend on the same stock value
- product-specific locking is enough to protect the critical section
- different products should not block each other

Rejected option:

```text
global system lock
```

Reason rejected:
- unnecessary contention
- poor throughput
- would serialize purchases for unrelated products

## 6. Lock Key Format
Standard key format:

```text
lock:product:{productId}
```

Examples:
- `lock:product:1`
- `lock:product:42`
- `lock:product:BF-LOW-STOCK-001`

Design rule:
- use a configurable prefix
- keep resource type explicit
- keep product identifier at the end for easy inspection

## 7. Critical Section
The critical section for the future `/api/purchase/with-lock` flow must include:
- read latest product stock from database
- validate product existence
- validate stock availability
- update stock
- create success or failed order
- write important attempt log entries for the locked flow

Important note:
- lock acquisition is not enough by itself
- the purchase code inside the lock still needs correct database write ordering
- in Phase 10 or later, transaction inside the lock is still recommended

## 8. Owner Token Strategy
Every lock acquisition attempt must generate a unique owner token.

Owner token purpose:
- identify which request currently owns the lock
- ensure request A cannot release request B's lock
- support safe compare-and-delete release logic

Owner token format:
- generated from `serverId`
- includes `requestId` when available
- always includes a random UUID

Example:

```text
backend-node-1:req-123:550e8400-e29b-41d4-a716-446655440000
```

Why not use only `requestId`:
- requestId alone may be reused accidentally in tests
- requestId alone is less robust for ownership tracing
- adding a UUID keeps the token unique even if the same request id appears again

## 9. TTL Strategy
The lock must always have a TTL.

Reason:
- if a server crashes after acquiring the lock, the lock must expire automatically
- avoids dead lock that lives forever

Default TTL design:

```text
LOCK_TTL_MS = 10000
```

TTL selection rule:
- longer than a normal purchase processing time
- not so long that waiting requests are blocked too long after a crash

Risk if TTL is too short:
- lock may expire before the owner finishes purchase processing
- another request could acquire the same lock too early

Risk if TTL is too long:
- slow recovery when the owner crashes
- longer wait for queued requests

## 10. Retry And Timeout Policy
Lock acquisition policy:
- do not wait forever
- retry on a short interval
- stop after max wait timeout

Default settings:

```text
LOCK_RETRY_INTERVAL_MS = 50
LOCK_WAIT_TIMEOUT_MS = 3000
```

Policy:
- try acquire lock
- if not acquired, sleep retry interval
- continue until lock acquired or wait timeout reached
- if timeout reached, return `LOCK_TIMEOUT`

Why this policy:
- simple to explain
- easy to instrument and log
- enough for a controlled demo environment

## 11. Safe Release Strategy
Release must not simply call:

```text
DEL lockKey
```

because that can delete a lock that now belongs to another request after TTL expiry and reacquisition.

Safe release requirement:
- compare owner token first
- only delete lock when stored token matches the caller token

Redis release strategy for Phase 10:
- use a Lua script or equivalent atomic compare-and-delete

Pseudo release logic:

```text
if GET lockKey == ownerToken
  then DEL lockKey
else
  do nothing and log warning
```

If release fails:
- do not silently ignore
- log `LOCK_RELEASE_FAILED`
- include `lockKey`, `ownerToken`, `requestId`, `productId`

## 12. Logging Events
Required lock-related events:
- `LOCK_ACQUIRE_STARTED`
- `LOCK_ACQUIRED`
- `LOCK_ACQUIRE_RETRY`
- `LOCK_ACQUIRE_TIMEOUT`
- `LOCK_RELEASE_STARTED`
- `LOCK_RELEASED`
- `LOCK_RELEASE_FAILED`
- `PURCHASE_WITH_LOCK_STARTED`
- `PURCHASE_WITH_LOCK_SUCCESS`
- `PURCHASE_WITH_LOCK_FAILED`

Why these events matter:
- they show whether requests are queued or timing out
- they help debug Redis or release issues
- they create evidence comparable with no-lock attempt logs

## 13. Error Codes
Prepared error codes:
- `LOCK_TIMEOUT`
- `LOCK_SERVICE_UNAVAILABLE`
- `LOCK_RELEASE_FAILED`
- `OUT_OF_STOCK`
- `PRODUCT_NOT_FOUND`
- `DUPLICATE_REQUEST`

Usage intent:
- `LOCK_TIMEOUT`: request could not enter critical section in time
- `LOCK_SERVICE_UNAVAILABLE`: Redis or lock coordinator unavailable
- `LOCK_RELEASE_FAILED`: internal operational problem during release

## 14. Planned With-Lock Flow
Pseudo-code for Phase 10:

```text
purchaseWithLock(payload):
    lockKey = buildProductLockKey(productId)
    lockToken = generateLockToken(serverId, requestId)

    acquire lock with retry + timeout
    if not acquired:
        return LOCK_TIMEOUT

    try:
        read latest product from DB

        if product not found:
            create failed order/log
            return PRODUCT_NOT_FOUND

        if stock < quantity:
            create failed order/log
            return OUT_OF_STOCK

        update stock
        create success order
        write success logs
        return success
    finally:
        release lock only if token matches
```

## 15. Comparison With No-Lock
No-lock behavior:
- many requests can read the same stock value
- many requests can pass stock check concurrently
- stale write can create oversell or inconsistent final stock

With-lock target behavior:
- requests for the same product enter one by one
- next request reads stock only after previous request finished updating
- successful orders cannot exceed available stock if the flow inside the lock is implemented correctly

## 16. Limits Of This Solution
This design is appropriate for the project, but it has limits:
- Redis becomes an extra dependency
- if Redis is down, locked purchase flow may fail
- bad TTL tuning can cause early expiry or long waiting
- single Redis lock is simpler than Redlock, but less resilient in some production scenarios
- distributed lock alone is not a substitute for all database safety guarantees

For a real production system, stronger options may include:
- Redis Redlock with careful trade-off analysis
- DB transaction and row lock
- optimistic locking plus retry
- queue-based command serialization

## 17. Why Transaction Is Still Recommended Later
Even with distributed lock, transaction is still recommended inside the critical section because:
- stock update and order creation should commit together
- partial success can still leave inconsistent state if the process crashes mid-flow
- lock controls concurrency, but transaction controls atomicity

So the future ideal flow is:

```text
distributed lock + database transaction
```

## 18. Questions For Review / Defense
### Why not use mutex local?
Because local mutex only protects one process. It fails when multiple backend instances are running.

### Why lock by product instead of whole system?
Because the conflict domain is the stock of one product. Product-level lock prevents unnecessary global serialization.

### Why need TTL?
To avoid permanent dead lock if the lock owner crashes or becomes unresponsive.

### Why need owner token?
To ensure only the true lock owner can release the lock and to avoid deleting another request's lock.

### If Redis is down then what?
The future locked purchase flow should return `LOCK_SERVICE_UNAVAILABLE` or fail closed rather than process unsafely without coordination.

### Why still use transaction later?
Because lock solves concurrent entry, but transaction solves atomic commit of stock update and order creation.

### If two different products are purchased at the same time, are they blocked?
No. Product-level keys are different, so purchases for different products can run in parallel.

## 19. Phase 9 Deliverable Summary
After Phase 9:
- lock design is documented
- config for Redis lock is prepared
- lock events and error codes are prepared
- key builder and token generator are prepared
- skeleton `lock.service.js` exists for Phase 10
- `/api/purchase/no-lock` is unchanged
- no `/api/purchase/with-lock` endpoint exists yet
