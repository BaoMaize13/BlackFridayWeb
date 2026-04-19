# BlackFridayWeb Backend

Backend do an mo phong tranh chap du lieu trong moi truong phan tan. He thong giu song song hai luong xu ly:

- `POST /purchase/no-lock`: baseline co chu y de tai hien race condition
- `POST /purchase/with-lock`: dung Redis distributed lock de giu consistency

Codebase hien da co:

- admin APIs de tao/reset product, xem orders, audit logs, stats, metrics
- scripts load test va evidence cho `no-lock`, `with-lock`, `multi-instance`
- reporting JSON, Markdown, CSV cho metrics va compare report
- docs phuc vu demo va viet bao cao

## Quick Start

### 1. Cai dependency

```powershell
npm install
```

### 2. Chay migrate va seed

```powershell
npm run db:migrate
npm run db:seed
```

### 3. Chay backend

```powershell
npm run dev
```

Backend mac dinh chay theo `.env`.

## Redis Commands

```powershell
npm run redis:up
npm run redis:logs
npm run redis:down
```

Neu khong co Redis:

- unit tests van chay
- cac Redis-dependent tests va scripts se skip/bao loi ro rang

## Main Scripts

### Development

```powershell
npm run dev
npm run dev:server-a
npm run dev:server-b
```

### Automated Tests

```powershell
npm test
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run test:edge
npm run test:lock
```

### Load Test / Evidence

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

### Metrics / Reports

```powershell
npm run report:metrics
npm run report:compare
```

Vi du compare:

```powershell
$env:NO_LOCK_REPORT="reports\\no-lock-evidence-xxx.json"
$env:WITH_LOCK_REPORT="reports\\with-lock-evidence-yyy.json"
npm run report:compare
```

## Demo Flow Goi Y

### No-lock

```powershell
npm run evidence:no-lock
```

### With-lock

```powershell
npm run evidence:with-lock
```

### Multi-instance

Mo 2 terminal:

```powershell
npm run dev:server-a
npm run dev:server-b
```

Sau do chay:

```powershell
npx cross-env MODE=with-lock BASE_URLS=http://localhost:3000,http://localhost:3001 PRODUCT_ID=1 INITIAL_STOCK=1 CONCURRENT_REQUESTS=20 QUANTITY=1 npm run test:multi-instance
```

## Docs Index

- [Distributed Lock Design](./docs/distributed-lock-design.md)
- [Testing Guide](./docs/testing-guide.md)
- [Edge Case Testing Guide](./docs/edge-case-testing-guide.md)
- [Multi-Instance Demo Guide](./docs/multi-instance-demo-guide.md)
- [Metrics And Reporting Guide](./docs/metrics-and-reporting-guide.md)
- [Phase 17 Refactor Report](./docs/refactor-report-phase-17.md)

## Architecture Notes

- routes chi khai bao endpoint va wiring middleware
- controllers chi validate input, goi service, tra response
- services chua business flow va goi repository / lock service
- repositories chi phu trach data access
- scripts giu nguyen entry cu de de demo, nhung da dung helper chung nhieu hon sau Phase 17

## Honesty Rules

- khong fake oversell cho `no-lock` neu run hien tai chua reproduce
- khong ket luan `with-lock` pass neu `dataConsistent = false`
- khong ket luan multi-instance pass neu khong co bang chung tu ca nhieu server
