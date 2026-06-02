const $ = (selector) => document.querySelector(selector);
const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

async function api(path, options = {}) {
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
