# Demo Checklist

## Environment

- [ ] `npm install` da chay
- [ ] `.env` da copy tu `.env.example`
- [ ] DB local / SQLite san sang
- [ ] Redis dang chay
- [ ] backend chay duoc bang `npm run dev`
- [ ] `/health` tra `200`

## Data

- [ ] Co product test
- [ ] Biet `productId`
- [ ] Da reset `stock = 1`
- [ ] Da clear orders
- [ ] Da clear logs

## No-Lock Demo

- [ ] Da chay `npm run evidence:no-lock`
- [ ] Co report JSON
- [ ] Co report Markdown
- [ ] Neu chua reproduce, da san sang tang `CONCURRENT_REQUESTS`
- [ ] Neu chua reproduce, da san sang tang `NO_LOCK_PURCHASE_DELAY_MS`

## With-Lock Demo

- [ ] Da chay `npm run evidence:with-lock`
- [ ] `successOrders` dung voi stock ban dau
- [ ] `finalStock` dung
- [ ] `oversellDetected = NO`
- [ ] `dataConsistent = YES`
- [ ] report da duoc tao

## Multi-Instance Demo

- [ ] server-A dang chay port `3000`
- [ ] server-B dang chay port `3001`
- [ ] server-A va server-B dung chung Redis
- [ ] server-A va server-B dung chung DB
- [ ] script gui request vao ca 2 `BASE_URLS`
- [ ] logs co `serverId`
- [ ] multi-instance report da tao

## Reports

- [ ] Mo duoc report Markdown
- [ ] Co compare report
- [ ] Co metrics ro rang
- [ ] Biet duong dan thu muc `reports/`

## Backup Plan

- [ ] Neu no-lock chua reproduce, da co plan tang concurrency / delay
- [ ] Neu can, co the dung report cu da tao truoc buoi demo
- [ ] Neu Redis loi, biet chay `npm run redis:up`
- [ ] Neu port bi chiem, biet doi `PORT`
- [ ] Neu DB loi, biet kiem tra `DB_URL`
