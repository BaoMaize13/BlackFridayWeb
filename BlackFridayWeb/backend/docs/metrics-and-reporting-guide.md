# Metrics And Reporting Guide

## Purpose
Phase 16 adds a shared metrics and reporting layer so the project can present:
- request metrics
- business metrics
- stock consistency checks
- multi-instance server participation
- Markdown, JSON, and CSV evidence for the final thesis report or demo

The goal is not only to run tests, but also to turn the results into clear numbers.

## What Metrics Are Collected
### Request Metrics
- `totalRequests`
- `httpSuccessResponses`
- `httpFailedResponses`
- `averageLatencyMs`
- `minLatencyMs`
- `maxLatencyMs`
- `p95LatencyMs`
- `networkFailures`

### Business Metrics
- `successOrders`
- `failedOrders`
- `outOfStockCount`
- `lockTimeoutCount`
- `lockServiceUnavailableCount`
- `productNotFoundCount`
- `duplicateRequestCount`
- `validationErrorCount`

### Stock Metrics
- `initialStock`
- `finalStock`
- `expectedFinalStock`

### Consistency Check
- `maxSuccessOrders`
- `oversellDetected`
- `negativeStockDetected`
- `stockMismatch`
- `dataConsistent`

### Server Breakdown
When the source data contains `serverId`, the reporting layer also computes:
- `requestDistribution` by target base URL
- `responseServerDistribution`
- `logDistribution`
- `successOrdersByServerId`
- `failedOrdersByServerId`
- per-server summary buckets

## How The Metrics Are Calculated
### Request Metrics
Request metrics are derived from `requestResults`.

Latency values come from each request `durationMs`.

`p95LatencyMs` is calculated by:
1. sorting durations in ascending order
2. taking index `ceil(0.95 * n) - 1`
3. reading the value at that index

### Business Metrics
Business metrics are derived from:
- `orders`
- `requestResults`
- `attemptLogs`

The code prefers request-level error codes when available, then falls back to orders and logs.

### Consistency Check
Consistency is evaluated from:
- `initialStock`
- `finalStock`
- `successOrders`
- `quantity`

Formula:

```text
maxSuccessOrders = floor(initialStock / quantity)
expectedFinalStock = initialStock - successOrders * quantity
```

Checks:
- `oversellDetected = successOrders > maxSuccessOrders`
- `negativeStockDetected = finalStock < 0`
- `stockMismatch = finalStock !== expectedFinalStock`
- `dataConsistent = !oversellDetected && !negativeStockDetected && !stockMismatch`

## Report Formats
The reporting layer supports:
- JSON
- Markdown
- CSV

JSON is best for automation.
Markdown is best for demo slides and thesis write-ups.
CSV is best for Excel or Google Sheets.

## Generate No-Lock Evidence
Run the existing no-lock evidence flow:

```powershell
npm run evidence:no-lock
```

This creates the raw evidence JSON and Markdown report.

To convert a raw report into the standardized Phase 16 metrics summary:

```powershell
$env:INPUT_REPORT="reports\\no-lock-evidence-2026-04-19T10-00-00-000Z.json"
npm run report:metrics
```

## Generate With-Lock Evidence
Run the existing with-lock evidence flow:

```powershell
npm run evidence:with-lock
```

Then convert the raw report into the standardized Phase 16 summary:

```powershell
$env:INPUT_REPORT="reports\\with-lock-evidence-2026-04-19T10-05-00-000Z.json"
npm run report:metrics
```

## Generate Multi-Instance Evidence
Make sure Redis and both backend instances are running first.

Then run:

```powershell
npm run evidence:multi-instance
```

The Phase 15 multi-instance script still generates the raw evidence.

To standardize that raw output into Phase 16 metrics:

```powershell
$env:INPUT_REPORT="reports\\multi-instance-with-lock-2026-04-19T10-10-00-000Z.json"
npm run report:metrics
```

## Compare No-Lock vs With-Lock
Use the compare script on two JSON reports.

PowerShell:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-2026-04-19T10-00-00-000Z.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-2026-04-19T10-05-00-000Z.json"
npm run report:compare
```

POSIX shell:

```bash
NO_LOCK_REPORT=reports/no-lock-evidence-2026-04-19T10-00-00-000Z.json WITH_LOCK_REPORT=reports/with-lock-evidence-2026-04-19T10-05-00-000Z.json npm run report:compare
```

The compare script accepts raw evidence JSON and internally normalizes both sources into the shared summary model.

## Admin Metrics Endpoint
The backend now includes:

```text
GET /api/admin/metrics
```

Supported query params:
- `productId` optional
- `initialStock` optional
- `quantity` optional
- `includeLogs=true|false` optional
- `includeServerBreakdown=true|false` optional

Example:

```text
GET /api/admin/metrics?productId=1&initialStock=1&quantity=1&includeServerBreakdown=true
```

This endpoint returns:
- current stock
- order counts
- failure breakdown
- attempt log totals
- consistency check
- server breakdown when requested

## How To Read JSON / Markdown / CSV
### JSON
Use JSON when:
- comparing runs programmatically
- feeding data into another script
- preserving all fields exactly

### Markdown
Use Markdown when:
- pasting into the thesis report
- showing the result live in a demo
- comparing no-lock vs with-lock clearly

### CSV
Use CSV when:
- importing into Excel
- building charts
- creating summary tables for the final report

## How To Use The Numbers In The Thesis Report
Recommended structure:

1. Describe the unsafe baseline:
   - no-lock may allow stale stock reads
   - overselling may occur under concurrency

2. Present the corrected solution:
   - with-lock serializes critical sections using Redis distributed lock
   - stock remains consistent

3. Show the trade-off:
   - no-lock can be faster in latency
   - with-lock may have higher latency because requests wait for the lock
   - with-lock provides correctness

4. Present multi-instance proof:
   - server-A and server-B both participate
   - both use the same DB and Redis
   - stock remains consistent even when requests are split across instances

## Trade-Off Note
The report should explicitly mention:
- no-lock can be faster because it does not wait for Redis lock acquisition
- with-lock can be slower because the same product requests are serialized
- correctness is the reason for choosing with-lock in the distributed environment

## Honesty Rules
Do not claim:
- race condition definitely happened if the no-lock run did not reproduce it
- with-lock passed if `dataConsistent` is false
- multi-instance lock proof succeeded if the run did not actually involve more than one server

If no-lock does not reproduce the bug in one run, say:
- the race condition was not reproduced in this run
- the endpoint is still unsafe by design because it reads stock before delay and updates stale data

If Redis or a backend instance is unavailable, keep that limitation visible in the report and do not fake success.
