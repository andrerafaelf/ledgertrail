import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4172);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEED_PATH = path.join(DATA_DIR, 'seed.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function send(res, status, body, type = 'application/json') {
	res.writeHead(status, { 'content-type': type });
	res.end(type === 'application/json' ? JSON.stringify(body, null, 2) : body);
}

async function ensureStore() {
	await mkdir(DATA_DIR, { recursive: true });
	if (!existsSync(STORE_PATH)) {
		await writeFile(STORE_PATH, await readFile(SEED_PATH, 'utf8'));
	}
}

async function readStore() {
	await ensureStore();
	return JSON.parse(await readFile(STORE_PATH, 'utf8'));
}

async function writeStore(store) {
	await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}

async function readBody(req) {
	let raw = '';
	for await (const chunk of req) raw += chunk;
	return raw ? JSON.parse(raw) : {};
}

function money(value) {
	const amount = Number(value);
	return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function invoiceError(input) {
	if (!String(input.client || '').trim()) return 'Client is required';
	if (money(input.amount) === null) return 'Amount must be greater than zero';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.due || '')) return 'Due date must be YYYY-MM-DD';
	if (!['draft', 'sent', 'overdue', 'paid'].includes(input.status || 'draft')) return 'Invalid invoice status';
	return null;
}

function expenseError(input) {
	if (!String(input.vendor || '').trim()) return 'Vendor is required';
	if (!String(input.category || '').trim()) return 'Category is required';
	if (money(input.amount) === null) return 'Amount must be greater than zero';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) return 'Date must be YYYY-MM-DD';
	return null;
}

function summary(store) {
	const paid = store.invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
	const unpaid = store.invoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
	const expenses = store.expenses.reduce((sum, expense) => sum + expense.amount, 0);
	const byClient = store.invoices.reduce((acc, invoice) => {
		acc[invoice.client] = (acc[invoice.client] || 0) + invoice.amount;
		return acc;
	}, {});
	return { paid, unpaid, expenses, net: paid - expenses, byClient };
}

async function serveStatic(res, pathname) {
	const safePath = pathname === '/' ? '/index.html' : pathname;
	const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
	if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
	try {
		const file = await readFile(filePath);
		const ext = path.extname(filePath);
		const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html';
		send(res, 200, file, type);
	} catch {
		send(res, 404, 'Not found', 'text/plain');
	}
}

createServer(async (req, res) => {
	try {
		const url = new URL(req.url, `http://${req.headers.host}`);
		const store = await readStore();

		if (req.method === 'GET' && url.pathname === '/api/summary') return send(res, 200, summary(store));
		if (req.method === 'GET' && url.pathname === '/api/invoices') return send(res, 200, store.invoices);
		if (req.method === 'GET' && url.pathname === '/api/expenses') return send(res, 200, store.expenses);

		if (req.method === 'POST' && url.pathname === '/api/invoices') {
			const body = await readBody(req);
			const error = invoiceError(body);
			if (error) return send(res, 400, { error });
			const invoice = {
				id: `inv_${Date.now()}`,
				client: body.client.trim(),
				amount: money(body.amount),
				status: body.status || 'draft',
				due: body.due
			};
			store.invoices.unshift(invoice);
			await writeStore(store);
			return send(res, 201, invoice);
		}

		if (req.method === 'PATCH' && url.pathname.startsWith('/api/invoices/')) {
			const id = url.pathname.split('/').pop();
			const invoice = store.invoices.find((item) => item.id === id);
			if (!invoice) return send(res, 404, { error: 'Invoice not found' });
			const body = await readBody(req);
			if (!['draft', 'sent', 'overdue', 'paid'].includes(body.status)) return send(res, 400, { error: 'Invalid status' });
			invoice.status = body.status;
			await writeStore(store);
			return send(res, 200, invoice);
		}

		if (req.method === 'POST' && url.pathname === '/api/expenses') {
			const body = await readBody(req);
			const error = expenseError(body);
			if (error) return send(res, 400, { error });
			const expense = {
				id: `exp_${Date.now()}`,
				vendor: body.vendor.trim(),
				category: body.category.trim(),
				amount: money(body.amount),
				date: body.date
			};
			store.expenses.unshift(expense);
			await writeStore(store);
			return send(res, 201, expense);
		}

		return serveStatic(res, url.pathname);
	} catch (error) {
		send(res, 500, { error: error.message });
	}
}).listen(PORT, () => {
	console.log(`LedgerTrail running at http://localhost:${PORT}`);
});
