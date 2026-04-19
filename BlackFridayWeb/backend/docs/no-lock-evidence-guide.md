# No-Lock Evidence Guide

## Purpose
This guide explains how to generate evidence showing that the `POST /purchase/no-lock` flow is unsafe under concurrent requests.

## Prerequisites
1. Start the backend server.
2. Ensure the database is migrated.
3. Ensure at least one product exists.

Recommended setup:

```powershell
npm install
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

## Run The Evidence Script

Default run:

```powershell
npm run evidence:no-lock
```

Custom run:

```powershell
npm run evidence:no-lock -- --productId=1 --stock=1 --requests=20 --quantity=1 --requestPrefix=no-lock-evidence
```

Or with environment variables:

```powershell
$env:BASE_URL="http://127.0.0.1:4000"
$env:PRODUCT_ID="1"
$env:INITIAL_STOCK="1"
$env:CONCURRENT_REQUESTS="20"
$env:QUANTITY="1"
npm run evidence:no-lock
```

## What The Script Does
1. Checks whether the backend is reachable via `/health`.
2. Resolves a target product.
3. Resets the product to a clean state with:
   - stock = `INITIAL_STOCK`
   - old orders cleared
   - old attempt logs cleared
4. Sends concurrent requests to `/purchase/no-lock`.
5. Fetches product, orders, attempt logs, and stats after the run.
6. Saves:
   - JSON evidence report
   - Markdown evidence report

## Output Files
Reports are saved in:

```text
reports/no-lock-evidence-<timestamp>.json
reports/no-lock-evidence-<timestamp>.md
```

## How To Read The Result
Look for these fields in terminal output or the Markdown report:

- `Oversell Detected`
- `Negative Stock Detected`
- `Stock Mismatch`
- `Same Stock Read Detected`
- `Data Consistent`

## How To Recognize Oversell
Oversell is detected when:

```text
successOrders > initialStock
```

Example:
- initialStock = 1
- successOrders = 5
- result: oversell detected

## How To Recognize Stock Mismatch
Stock mismatch is detected when:

```text
actualFinalStock !== initialStock - successOrders * quantity
```

## How To Increase Reproduction Probability
If race condition is not reproduced in one run:

1. Increase `CONCURRENT_REQUESTS`
2. Increase backend `NO_LOCK_PURCHASE_DELAY_MS`
3. Run the evidence script multiple times

## Suggested Demo Flow
1. Show product stock before test.
2. Run `npm run evidence:no-lock`.
3. Open the generated Markdown report.
4. Highlight:
   - same stock read evidence
   - number of success orders
   - final stock
   - consistency check conclusion
