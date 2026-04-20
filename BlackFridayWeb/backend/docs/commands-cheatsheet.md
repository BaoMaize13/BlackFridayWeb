# Commands Cheatsheet

Tat ca command duoi day chay trong thu muc `backend`.

## Install

```powershell
npm install
```

## Copy Env

```powershell
Copy-Item .env.example .env
```

## Run Redis

```powershell
npm run redis:up
npm run redis:logs
npm run redis:down
```

## Run Backend

```powershell
npm run dev
npm run start
```

## Run Multi-Instance

```powershell
npm run dev:server-a
npm run dev:server-b
```

## Database Helpers

```powershell
npm run db:migrate
npm run db:seed
npm run db:reset
npm run db:list-products
```

## Tests

```powershell
npm test
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run test:edge
npm run test:lock
```

## Load Tests / Evidence

```powershell
npm run test:no-lock
npm run evidence:no-lock
npm run test:with-lock
npm run evidence:with-lock
npm run test:multi-instance
npm run test:multi-instance:no-lock
npm run test:multi-instance:with-lock
npm run evidence:multi-instance
```

## Reports

```powershell
npm run report:metrics
npm run report:compare
```

## Example No-Lock Evidence With Env Overrides

PowerShell:

```powershell
$env:BASE_URL="http://localhost:4000"
$env:PRODUCT_ID="1"
$env:INITIAL_STOCK="1"
$env:CONCURRENT_REQUESTS="20"
$env:REQUEST_PREFIX="demo-no-lock"
npm run evidence:no-lock
```

Portable one-liner:

```powershell
npx cross-env BASE_URL=http://localhost:4000 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 REQUEST_PREFIX=demo-no-lock npm run evidence:no-lock
```

## Example With-Lock Evidence With Env Overrides

```powershell
npx cross-env BASE_URL=http://localhost:4000 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 REQUEST_PREFIX=demo-with-lock npm run evidence:with-lock
```

## Example Multi-Instance With-Lock

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:with-lock
```

## Example Multi-Instance No-Lock

```powershell
npx cross-env BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance:no-lock
```

## Compare Reports

PowerShell:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

Portable one-liner:

```powershell
npx cross-env NO_LOCK_REPORT=reports/no-lock-evidence-xxx.json WITH_LOCK_REPORT=reports/with-lock-evidence-yyy.json npm run report:compare
```

## Metrics Summary From One Report

```powershell
npm run report:metrics -- --input=reports\\with-lock-evidence-xxx.json
```
