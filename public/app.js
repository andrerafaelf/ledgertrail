const $ = (selector) => document.querySelector(selector);
const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const isStaticDemo = location.hostname.endsWith('github.io');
const storageKey = 'ledgertrail-demo-store';
const seed = {
	invoices: [
		{ id: 'inv_1001', client: 'Northwind Labs', amount: 1800, status: 'sent', due: '2026-06-12' },
		{ id: 'inv_1002', client: 'Blue Harbor', amount: 950, status: 'paid', due: '2026-05-28' },
		{ id: 'inv_1003', client: 'Orbit Foods', amount: 1240, status: 'overdue', due: '2026-05-20' }
	],
	expenses: [
		{ id: 'exp_2001', vendor: 'AWS', category: 'Infrastructure', amount: 84, date: '2026-05-31' },
		{ id: 'exp_2002', vendor: 'Figma', category: 'Tools', amount: 15, date: '2026-05-29' }
	]
};

function getStore() {
	const saved = localStorage.getItem(storageKey);
	return saved ? JSON.parse(saved) : structuredClone(seed);
}

function saveStore(store) {
	localStorage.setItem(storageKey, JSON.stringify(store));
}

function getSummary(store) {
	const paid = store.invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
	const unpaid = store.invoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
	const expenses = store.expenses.reduce((sum, expense) => sum + expense.amount, 0);
	return { paid, unpaid, expenses, net: paid - expenses };
}

async function demoApi(path, options = {}) {
	const store = getStore();
	const body = options.body ? JSON.parse(options.body) : {};
	if (path === '/api/summary') return getSummary(store);
	if (path === '/api/invoices') return store.invoices;
	if (path === '/api/expenses') return store.expenses;
	if (path === '/api/invoices' && options.method === 'POST') {
		const invoice = { id: `inv_${Date.now()}`, status: 'draft', ...body, amount: Number(body.amount) };
		store.invoices.unshift(invoice);
		saveStore(store);
		return invoice;
	}
	if (path === '/api/expenses' && options.method === 'POST') {
		const expense = { id: `exp_${Date.now()}`, ...body, amount: Number(body.amount) };
		store.expenses.unshift(expense);
		saveStore(store);
		return expense;
	}
	if (path.startsWith('/api/invoices/') && options.method === 'PATCH') {
		const id = path.split('/').pop();
		const invoice = store.invoices.find((item) => item.id === id);
		if (!invoice) throw new Error('Invoice not found');
		invoice.status = body.status;
		saveStore(store);
		return invoice;
	}
	throw new Error('Route not available in demo mode');
}

async function api(path, options = {}) {
	if (isStaticDemo) return demoApi(path, options);
	const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data;
}

async function load() {
	const [summary, invoices, expenses] = await Promise.all([
		api('/api/summary'),
		api('/api/invoices'),
		api('/api/expenses')
	]);
	renderStats(summary);
	renderInvoices(invoices);
	renderExpenses(expenses);
}

function renderStats(summary) {
	$('#stats').innerHTML = [
		['Paid', summary.paid],
		['Unpaid', summary.unpaid],
		['Expenses', summary.expenses],
		['Net', summary.net]
	]
		.map(([label, value]) => `<article><span>${label}</span><strong>${euro.format(value)}</strong></article>`)
		.join('');
}

function renderInvoices(invoices) {
	$('#invoices').innerHTML = invoices
		.map(
			(invoice) => `
			<article class="row">
				<div>
					<strong>${invoice.client}</strong>
					<span>${euro.format(invoice.amount)} due ${invoice.due}</span>
				</div>
				<select data-id="${invoice.id}">
					${['draft', 'sent', 'overdue', 'paid'].map((status) => `<option ${status === invoice.status ? 'selected' : ''}>${status}</option>`).join('')}
				</select>
			</article>`
		)
		.join('');
}

function renderExpenses(expenses) {
	$('#expenses').innerHTML = expenses
		.map(
			(expense) => `
			<article class="row">
				<div>
					<strong>${expense.vendor}</strong>
					<span>${expense.category} on ${expense.date}</span>
				</div>
				<b>${euro.format(expense.amount)}</b>
			</article>`
		)
		.join('');
}

async function handleForm(form, statusNode, endpoint) {
	const payload = Object.fromEntries(new FormData(form));
	try {
		await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
		statusNode.textContent = 'Saved.';
		form.reset();
		await load();
	} catch (error) {
		statusNode.textContent = error.message;
	}
}

$('#invoice-form').addEventListener('submit', (event) => {
	event.preventDefault();
	handleForm(event.currentTarget, $('#invoice-status'), '/api/invoices');
});

$('#expense-form').addEventListener('submit', (event) => {
	event.preventDefault();
	handleForm(event.currentTarget, $('#expense-status'), '/api/expenses');
});

$('#invoices').addEventListener('change', async (event) => {
	const select = event.target.closest('select[data-id]');
	if (!select) return;
	await api(`/api/invoices/${select.dataset.id}`, {
		method: 'PATCH',
		body: JSON.stringify({ status: select.value })
	});
	await load();
});

load();