# LedgerTrail

LedgerTrail is a lightweight invoice and expense tracker for small freelance or studio-style workflows.

I built it as a compact full stack project: a Node.js REST API, a browser dashboard, backend validation, status updates, and local JSON persistence. It is deliberately small, but it still behaves like a real internal finance tool.

## What it does

- Create invoices with client, amount, due date, and status
- Track draft, sent, overdue, and paid invoices
- Record expenses by vendor and category
- Show paid income, unpaid income, expenses, and net cashflow
- Update invoice status directly from the dashboard

## Links

- Live demo: https://andrerafaelf.github.io/ledgertrail/
- Repository: https://github.com/andrerafaelf/ledgertrail

The live demo runs as a static GitHub Pages version, so changes are stored in your browser. Running locally with `npm start` uses the Node API and JSON store.

## Running it

```bash
npm start
```

Then open `http://localhost:4172`.

The app creates `data/store.json` from `data/seed.json` the first time it runs.

## API

- `GET /api/summary`
- `GET /api/invoices`
- `POST /api/invoices`
- `PATCH /api/invoices/:id`
- `GET /api/expenses`
- `POST /api/expenses`

## Stack

Node.js, native HTTP server, REST API, vanilla JavaScript, HTML, CSS, and JSON file persistence.
