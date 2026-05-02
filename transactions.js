import { state, formatCurrencyFull, formatDate, getWeekday, parseCurrency, parseTime, formatTime, currencyMask, timeMask, showToast, openConfirmModal, imageToBase64, renderEmpty, icon, todayISO, syncSelectedFromDate, openModal, closeModal } from './utils.js';
import { saveDocument, updateDocument, deleteDocument } from './data.js';
import { renderAll } from './app.js';

function sortByDateDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));
}

function applyTransactionFilter(items) {
  const mode = state.transactionFilter || 'all';
  const now = new Date();
  return sortByDateDesc(items).filter(item => {
    const d = new Date(item.date + 'T00:00:00');
    if (mode === 'today') return d.toDateString() === now.toDateString();
    if (mode === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (mode === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

const transactionMonthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getTransactionAccordionState(type) {
  if (!state.transactionAccordions) state.transactionAccordions = { entries: {}, expenses: {} };
  if (!state.transactionAccordions[type]) state.transactionAccordions[type] = {};
  return state.transactionAccordions[type];
}

function isTransactionSectionOpen(type, key, defaultOpen = false) {
  const opened = getTransactionAccordionState(type);
  if (opened[key] === undefined) return defaultOpen;
  return !!opened[key];
}

function isTransactionGroupOpen(type, date) {
  return isTransactionSectionOpen(type, date, false);
}

function groupTransactionsByDate(items = []) {
  const groups = new Map();
  sortByDateDesc(items).forEach(item => {
    if (!groups.has(item.date)) groups.set(item.date, []);
    groups.get(item.date).push(item);
  });
  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    items,
    total: items.reduce((sum, item) => sum + Number(item.value || 0), 0)
  }));
}

function groupTransactionsHierarchy(items = []) {
  const yearsMap = new Map();
  groupTransactionsByDate(items).forEach(group => {
    const [year, month] = String(group.date || '').split('-');
    const yearKey = String(year || '');
    const monthKey = `${yearKey}-${month}`;

    if (!yearsMap.has(yearKey)) {
      yearsMap.set(yearKey, { year: yearKey, monthsMap: new Map(), total: 0, count: 0 });
    }

    const yearGroup = yearsMap.get(yearKey);
    yearGroup.total += Number(group.total || 0);
    yearGroup.count += group.items.length;

    if (!yearGroup.monthsMap.has(monthKey)) {
      yearGroup.monthsMap.set(monthKey, {
        key: monthKey,
        year: yearKey,
        month: Number(month),
        monthLabel: transactionMonthNames[Math.max(0, Number(month || 1) - 1)] || month,
        days: [],
        total: 0,
        count: 0
      });
    }

    const monthGroup = yearGroup.monthsMap.get(monthKey);
    monthGroup.days.push(group);
    monthGroup.total += Number(group.total || 0);
    monthGroup.count += group.items.length;
  });

  return Array.from(yearsMap.values())
    .sort((a, b) => Number(b.year) - Number(a.year))
    .map(yearGroup => ({
      year: yearGroup.year,
      total: yearGroup.total,
      count: yearGroup.count,
      months: Array.from(yearGroup.monthsMap.values())
        .sort((a, b) => Number(b.month) - Number(a.month))
        .map(monthGroup => ({
          ...monthGroup,
          dayCount: monthGroup.days.length,
          days: monthGroup.days.sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'))
        }))
    }));
}

function uniqueList(values = []) {
  const seen = new Set();
  return values
    .map(value => String(value || '').trim())
    .filter(value => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function accordionArrow(open) {
  return `<svg class="svg-icon transaction-day-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${open ? 'm6 9 6 6 6-6' : 'm9 18 6-6-6-6'}"/></svg>`;
}

function transactionDayAccordion(type, group) {
  const open = isTransactionGroupOpen(type, group.date);
  const names = type === 'entries'
    ? uniqueList(group.items.map(item => item.origin || 'Origem não informada'))
    : uniqueList(group.items.map(item => item.category || item.description || 'Despesa'));
  const totalLabel = type === 'entries' ? 'Total do dia' : 'Total de despesas';
  const listLabel = type === 'entries' ? 'Apps rodados' : 'Gastos do dia';
  const cards = type === 'entries' ? group.items.map(entryCard).join('') : group.items.map(expenseCard).join('');

  return `
    <section class="transaction-day-group ${open ? 'open' : ''}" data-transaction-group="${type}" data-transaction-date="${group.date}">
      <button class="transaction-day-summary" type="button" data-toggle-transaction-group="${type}" data-date="${group.date}" aria-expanded="${open ? 'true' : 'false'}">
        <div class="transaction-day-summary-copy">
          <strong>${formatDate(group.date)}</strong>
          <span>${listLabel}: ${escapeHtml(names.join(', ') || '-')}</span>
          <b>${totalLabel}: ${formatCurrencyFull(group.total)}</b>
        </div>
        ${accordionArrow(open)}
      </button>
      <div class="transaction-day-items ${open ? '' : 'hidden'}">
        <div class="transaction-day-cards">${cards}</div>
      </div>
    </section>
  `;
}

function transactionMonthAccordion(type, year, monthGroup) {
  const key = `month:${monthGroup.key}`;
  const open = isTransactionSectionOpen(type, key, true);
  const totalLabel = type === 'entries' ? 'Total do mês' : 'Total de despesas';
  const dayLabel = monthGroup.dayCount === 1 ? '1 dia' : `${monthGroup.dayCount} dias`;

  return `
    <section class="transaction-month-group ${open ? 'open' : ''}" data-transaction-month="${monthGroup.key}">
      <button class="transaction-month-summary" type="button" data-toggle-transaction-section="${type}" data-key="${key}" aria-expanded="${open ? 'true' : 'false'}">
        <div class="transaction-month-summary-copy">
          <strong>${monthGroup.monthLabel}</strong>
          <span>${dayLabel}</span>
          <b>${totalLabel}: ${formatCurrencyFull(monthGroup.total)}</b>
        </div>
        ${accordionArrow(open)}
      </button>
      <div class="transaction-month-items ${open ? '' : 'hidden'}">
        ${monthGroup.days.map(group => transactionDayAccordion(type, group)).join('')}
      </div>
    </section>
  `;
}

function transactionYearAccordion(type, yearGroup) {
  const key = `year:${yearGroup.year}`;
  const open = isTransactionSectionOpen(type, key, true);
  const totalLabel = type === 'entries' ? 'Total do ano' : 'Total de despesas';
  const monthLabel = yearGroup.months.length === 1 ? '1 mês' : `${yearGroup.months.length} meses`;

  return `
    <section class="transaction-year-group ${open ? 'open' : ''}" data-transaction-year="${yearGroup.year}">
      <button class="transaction-year-summary" type="button" data-toggle-transaction-section="${type}" data-key="${key}" aria-expanded="${open ? 'true' : 'false'}">
        <div class="transaction-year-summary-copy">
          <strong>${yearGroup.year}</strong>
          <span>${monthLabel}</span>
          <b>${totalLabel}: ${formatCurrencyFull(yearGroup.total)}</b>
        </div>
        ${accordionArrow(open)}
      </button>
      <div class="transaction-year-items ${open ? '' : 'hidden'}">
        ${yearGroup.months.map(monthGroup => transactionMonthAccordion(type, yearGroup.year, monthGroup)).join('')}
      </div>
    </section>
  `;
}

function splitIsoDate(dateString) {
  const value = dateString || todayISO();
  const [year, month, day] = value.split('-');
  return { day, month, year };
}

function buildIsoDate(day, month, year) {
  const d = String(day || '').replace(/\D/g, '').slice(0, 2);
  const m = String(month || '').replace(/\D/g, '').slice(0, 2);
  const y = String(year || '').replace(/\D/g, '').slice(0, 4);
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return '';
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  if (date.getDate() !== Number(d) || date.getMonth() + 1 !== Number(m) || date.getFullYear() !== Number(y)) return '';
  return `${y}-${m}-${d}`;
}

function renderTableCard(rows) {
  return `<div class="transaction-detail-table">${rows.map(row => `
    <div class="label">${row.label}</div>
    <div class="value ${row.className || ''}">${row.value || '-'}</div>
  `).join('')}</div>`;
}

function createEntryRows(item) {
  return [
    { label: 'Data', value: formatDate(item.date) },
    { label: 'Dia da semana', value: item.weekday || getWeekday(item.date) },
    { label: 'Origem', value: item.origin || '-' },
    { label: 'Valor entrada', value: formatCurrencyFull(item.value) },
    { label: 'Qtd viagens', value: String(item.trips || 0) },
    { label: 'Km rodados', value: String(item.km || 0) },
    { label: 'Horas trabalhadas', value: formatTime(item.minutes || 0) },
    { label: 'Observação', value: item.note || 'Sem observações' }
  ];
}

function createExpenseRows(item) {
  return [
    { label: 'Data', value: formatDate(item.date) },
    { label: 'Dia da semana', value: item.weekday || getWeekday(item.date) },
    { label: 'Lançamento', value: item.description || '-' },
    { label: 'Valor saída', value: formatCurrencyFull(item.value) },
    { label: 'Categoria', value: item.category || '-' },
    { label: 'Tipo de gasto', value: item.expenseType || '-' },
    { label: 'Detalhe', value: item.detail || 'Não informado' },
    { label: 'Manutenção item', value: item.maintenanceItem || 'Não informado' },
    { label: 'Forma de pagamento', value: item.paymentMethod || '-' },
    { label: 'Nota fiscal', value: item.receipt ? `<a href="${item.receipt}" target="_blank" rel="noopener noreferrer">Visualizar nota</a>` : 'Não enviada' }
  ];
}


function swipeHint(text) {
  return `<p class="swipe-hint">${text}</p>`;
}

function entryCard(item) {
  return `
    <div class="swipe-shell" data-swipe-shell>
      <button class="swipe-delete-btn" type="button" data-delete-entry="${item.id}">${icon('trash')}<span>Excluir</span></button>
      <div class="swipe-content">
        <article class="transaction-card-premium">
          <div class="transaction-card-top">
            <div>
              <small class="transaction-kicker">Ganho registrado</small>
              <h3>${formatDate(item.date)}</h3>
              <p>${item.origin || 'Origem não informada'} • ${formatCurrencyFull(item.value)}</p>
            </div>
            <div class="transaction-actions">
              <button class="icon-action" data-edit-entry="${item.id}" title="Editar entrada">${icon('edit')}</button>
            </div>
          </div>
          ${renderTableCard(createEntryRows(item))}
          <small class="card-footnote">Deslize o card para a esquerda se quiser apagar. Para ajustar, toque no lápis.</small>
        </article>
      </div>
    </div>
  `;
}

function expenseCard(item) {
  return `
    <div class="swipe-shell" data-swipe-shell>
      <button class="swipe-delete-btn" type="button" data-delete-expense="${item.id}">${icon('trash')}<span>Excluir</span></button>
      <div class="swipe-content">
        <article class="transaction-card-premium">
          <div class="transaction-card-top">
            <div>
              <small class="transaction-kicker">Despesa registrada</small>
              <h3>${formatDate(item.date)}</h3>
              <p>${item.description || 'Despesa'} • ${formatCurrencyFull(item.value)}</p>
            </div>
            <div class="transaction-actions">
              <button class="icon-action" data-edit-expense="${item.id}" title="Editar saída">${icon('edit')}</button>
            </div>
          </div>
          ${renderTableCard(createExpenseRows(item))}
          <small class="card-footnote">Deslize o card para a esquerda se quiser apagar. Mantenha suas saídas atualizadas para ver seus custos reais.</small>
        </article>
      </div>
    </div>
  `;
}

export function renderTransactions() {
  document.querySelectorAll('[data-transaction-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.transactionTab === state.transactionTab));
  const list = document.getElementById('transactionsList');
  list.innerHTML = state.transactionTab === 'entries' ? renderEntries() : renderExpenses();
}

function renderEntries() {
  const rows = applyTransactionFilter(state.entries);
  if (!rows.length) return renderEmpty('Nenhum ganho registrado neste período. Toque em + para lançar uma entrada.');
  const years = groupTransactionsHierarchy(rows);
  return swipeHint('Os lançamentos estão agrupados por ano, mês e data. Abra o período desejado para facilitar a busca, edição e visualização.') + years.map(group => transactionYearAccordion('entries', group)).join('');
}

function renderExpenses() {
  const rows = applyTransactionFilter(state.expenses);
  if (!rows.length) return renderEmpty('Nenhuma despesa registrada neste período. Toque em + para lançar uma despesa.');
  const years = groupTransactionsHierarchy(rows);
  return swipeHint('Os lançamentos estão agrupados por ano, mês e data. Abra o período desejado para facilitar a busca, edição e visualização.') + years.map(group => transactionYearAccordion('expenses', group)).join('');
}

export function openTransactionForm(type = state.transactionTab, item = null) {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  content.innerHTML = type === 'entries' ? entryForm(item) : expenseForm(item);
  openModal(modal);

  content.querySelectorAll('[data-currency]').forEach(input => input.addEventListener('input', () => currencyMask(input)));
  content.querySelectorAll('[data-time]').forEach(input => input.addEventListener('input', () => timeMask(input)));
  content.querySelectorAll('[data-only-digits]').forEach(input => input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '');
  }));
  content.querySelectorAll('[data-decimal-number]').forEach(input => input.addEventListener('input', () => {
    let value = input.value.replace(/[^0-9,.]/g, '').replace(/,/g, '.');
    const parts = value.split('.');
    if (parts.length > 2) value = `${parts.shift()}.${parts.join('')}`;
    input.value = value;
  }));
  content.querySelector('[data-close-form]')?.addEventListener('click', () => closeModal(modal));
  const refreshHoursNotice = () => type === 'entries' && updateHoursNotice(content, item);
  bindSplitDateFields(content, refreshHoursNotice);

  const file = content.querySelector('[name="receiptFile"]');
  file?.addEventListener('change', async e => {
    const base64 = await imageToBase64(e.target.files[0]);
    content.querySelector('[name="receiptBase64"]').value = base64;
    const preview = content.querySelector('.image-preview');
    if (preview) preview.innerHTML = base64 ? `<img src="${base64}" alt="Prévia da nota fiscal">` : `${icon('file')} <span>Toque para selecionar a imagem da nota</span>`;
  });

  content.querySelector('[data-open-date-picker]')?.addEventListener('click', () => {
    const picker = content.querySelector('[name="datePicker"]');
    if (!picker) return;
    if (picker.showPicker) picker.showPicker();
    else picker.click();
  });

  content.querySelector('[name="datePicker"]')?.addEventListener('change', e => {
    const iso = e.target.value;
    if (!iso) return;
    const { day, month, year } = splitIsoDate(iso);
    content.querySelector('[name="day"]').value = day;
    content.querySelector('[name="month"]').value = month;
    content.querySelector('[name="year"]').value = year;
    syncFullDate(content);
    refreshHoursNotice();
  });

  content.querySelector('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const ok = type === 'entries' ? await submitEntry(ev.target, item) : await submitExpense(ev.target, item);
    if (ok === false) return;
    closeModal(modal);
    renderAll();
  });
}

function syncFullDate(content) {
  const day = content.querySelector('[name="day"]')?.value;
  const month = content.querySelector('[name="month"]')?.value;
  const year = content.querySelector('[name="year"]')?.value;
  const iso = buildIsoDate(day, month, year);
  const hidden = content.querySelector('[name="date"]');
  const picker = content.querySelector('[name="datePicker"]');
  const weekday = content.querySelector('[name="weekday"]');

  if (!hidden || !weekday) return;

  hidden.value = iso;
  if (picker) picker.value = iso;
  weekday.value = iso ? getWeekday(iso) : '';
}

function bindSplitDateFields(content, afterSync = null) {
  ['day', 'month', 'year'].forEach(name => {
    const input = content.querySelector(`[name="${name}"]`);
    input?.addEventListener('input', () => {
      syncFullDate(content);
      afterSync?.();
    });
  });
  syncFullDate(content);
  afterSync?.();
}

function getEntriesWithHoursOnDate(date, currentItemId = null) {
  if (!date) return [];
  return state.entries.filter(entry =>
    entry.date === date &&
    entry.id !== currentItemId &&
    Number(entry.minutes || 0) > 0
  );
}

function updateHoursNotice(content, item = null) {
  const notice = content.querySelector('[data-hours-notice]');
  const date = content.querySelector('[name="date"]')?.value;
  if (!notice) return;
  const hasHoursInSameDay = getEntriesWithHoursOnDate(date, item?.id).length > 0;
  notice.classList.toggle('hidden', !hasHoursInSameDay);
}

function confirmHighHoursWarning(totalMinutesForDay) {
  return new Promise(resolve => {
    openConfirmModal(
      `Atenção: este dia ficará com ${formatTime(totalMinutesForDay)} em horas lançadas. Confirme se as horas não foram duplicadas.`,
      () => resolve(true),
      {
        title: 'Revisar horas do dia',
        confirmText: 'Salvar mesmo assim',
        cancelText: 'Voltar',
        onCancel: () => resolve(false)
      }
    );
  });
}


function entryForm(item) {
  const date = item?.date || todayISO();
  const { day, month, year } = splitIsoDate(date);
  return `
    <div class="transaction-form-page">
      <button type="button" class="back-btn form-back" data-close-form>${icon('back')} <span>Voltar</span></button>
      <h2>${item ? 'Editar entrada' : 'Nova entrada'}</h2>
      <p class="page-intro">Registre o que entrou no dia de forma rápida. As horas digitadas aqui já aparecem no painel e ajudam no cálculo de produtividade.</p>
      <form class="transaction-form">
        <input type="hidden" name="date" value="${date}" required>
        <input type="date" class="native-date-picker" name="datePicker" value="${date}" tabindex="-1" aria-hidden="true">

        <div class="transaction-date-grid">
          <label>Dia<input name="day" inputmode="numeric" maxlength="2" value="${day}" placeholder="26" required></label>
          <label>Mês<input name="month" inputmode="numeric" maxlength="2" value="${month}" placeholder="05" required></label>
          <label>Ano<input name="year" inputmode="numeric" maxlength="4" value="${year}" placeholder="2026" required></label>
          <button class="calendar-trigger" type="button" data-open-date-picker aria-label="Selecionar data">${icon('calendar')}</button>
        </div>

        <label>Dia da semana<input name="weekday" value="${item?.weekday || getWeekday(date)}" readonly></label>
        <label>Origem<select name="origin" required>${state.origins.map(o => `<option ${item?.origin === o.name ? 'selected' : ''}>${o.name}</option>`).join('')}</select></label>
        <label>Valor entrada<input data-currency name="value" inputmode="numeric" value="${item ? formatCurrencyFull(item.value) : ''}" placeholder="Digite 25000 para R$ 250,00" required></label>
        <label>Quantidade de viagens<input name="trips" type="text" inputmode="numeric" pattern="[0-9]*" data-only-digits value="${item?.trips || ''}" placeholder="Ex.: 10"></label>

        <div class="transaction-two-cols">
          <label>Km rodados<input name="km" type="text" inputmode="decimal" data-decimal-number value="${item?.km || ''}" placeholder="110"></label>
          <label>Horas trabalhadas<input data-time name="hours" inputmode="numeric" placeholder="0819 vira 08:19" value="${item ? formatTime(item.minutes) : ''}"></label>
          <div class="hours-warning-card hidden" data-hours-notice>
            <strong>Aviso sobre horas trabalhadas</strong>
            <span>Já existem horas lançadas para este dia. Preencha este campo apenas se essas horas forem de outro período de trabalho. Se for o mesmo período, deixe 00:00 para não duplicar.</span>
          </div>
        </div>

        <label>Observação<textarea name="note" placeholder="Opcional. Ex.: Teve greve, chuva forte, corrida particular...">${item?.note || ''}</textarea></label>
        <button class="btn primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

function expenseForm(item) {
  const date = item?.date || todayISO();
  const { day, month, year } = splitIsoDate(date);
  return `
    <div class="transaction-form-page">
      <button type="button" class="back-btn form-back" data-close-form>${icon('back')} <span>Voltar</span></button>
      <h2>${item ? 'Editar saída' : 'Nova saída'}</h2>
      <p class="page-intro">Cadastre cada gasto com calma. Assim o app mostra seus custos reais e ajuda você a entender para onde o dinheiro está indo.</p>
      <form class="transaction-form">
        <input type="hidden" name="date" value="${date}" required>
        <input type="date" class="native-date-picker" name="datePicker" value="${date}" tabindex="-1" aria-hidden="true">

        <div class="transaction-date-grid">
          <label>Dia<input name="day" inputmode="numeric" maxlength="2" value="${day}" placeholder="26" required></label>
          <label>Mês<input name="month" inputmode="numeric" maxlength="2" value="${month}" placeholder="05" required></label>
          <label>Ano<input name="year" inputmode="numeric" maxlength="4" value="${year}" placeholder="2026" required></label>
          <button class="calendar-trigger" type="button" data-open-date-picker aria-label="Selecionar data">${icon('calendar')}</button>
        </div>

        <label>Dia da semana<input name="weekday" value="${item?.weekday || getWeekday(date)}" readonly></label>
        <label>Lançamento<input name="description" value="${item?.description || ''}" placeholder="Ex.: Almoço" required></label>
        <label>Valor saída<input data-currency name="value" inputmode="numeric" value="${item ? formatCurrencyFull(item.value) : ''}" placeholder="Digite 3200 para R$ 32,00" required></label>
        <label>Categoria<select name="category">${state.expenseCategories.map(c => `<option ${item?.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>
        <label>Tipo de gasto<select name="expenseType"><option ${item?.expenseType === 'Diário/Semanal' ? 'selected' : ''}>Diário/Semanal</option><option ${item?.expenseType === 'Mensal/Pontual' ? 'selected' : ''}>Mensal/Pontual</option></select></label>
        <label>Detalhe<input name="detail" value="${item?.detail || ''}" placeholder="Ex.: Bairro Saúde"></label>
        <label>Manutenção item<input name="maintenanceItem" value="${item?.maintenanceItem || ''}" placeholder="Opcional"></label>
        <label>Forma de pagamento<select name="paymentMethod">${state.paymentMethods.map(p => `<option ${item?.paymentMethod === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>
        <label class="receipt-field">Nota fiscal<input name="receiptFile" type="file" accept="image/*" capture="environment"></label>
        <input type="hidden" name="receiptBase64" value="${item?.receipt || ''}">
        <div class="image-preview">${item?.receipt ? `<img src="${item.receipt}" alt="Nota fiscal">` : `${icon('file')} <span>Toque para selecionar a imagem da nota</span>`}</div>
        <button class="btn primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

async function submitEntry(form, item) {
  if (!form.date.value) {
    showToast('Confira o dia, mês e ano antes de salvar.');
    return false;
  }
  const minutes = parseTime(form.hours.value || '0');
  if (minutes === null) {
    showToast('Hora digitada inválida. Use o formato 0819 ou 08:19.');
    return false;
  }
  const existingMinutesInSameDay = getEntriesWithHoursOnDate(form.date.value, item?.id)
    .reduce((total, entry) => total + Number(entry.minutes || 0), 0);
  const totalMinutesForDay = existingMinutesInSameDay + minutes;

  if (minutes > 0 && totalMinutesForDay > 16 * 60) {
    const confirmed = await confirmHighHoursWarning(totalMinutesForDay);
    if (!confirmed) return false;
  }

  const payload = {
    date: form.date.value,
    weekday: form.weekday.value,
    origin: form.origin.value,
    value: parseCurrency(form.value.value),
    trips: Number(String(form.trips.value || '0').replace(/\D/g, '') || 0),
    km: Number(String(form.km.value || '0').replace(',', '.') || 0),
    minutes,
    note: form.note.value.trim()
  };
  item ? await updateDocument('entries', item.id, payload) : await saveDocument('entries', payload);
  syncSelectedFromDate(payload.date);
  showToast(item ? 'Entrada atualizada.' : 'Pronto, entrada salva.');
}

async function submitExpense(form, item) {
  if (!form.date.value) {
    showToast('Confira o dia, mês e ano antes de salvar.');
    return false;
  }
  const payload = {
    date: form.date.value,
    weekday: form.weekday.value,
    description: form.description.value.trim(),
    value: parseCurrency(form.value.value),
    category: form.category.value,
    expenseType: form.expenseType.value,
    detail: form.detail.value.trim(),
    paymentMethod: form.paymentMethod.value,
    maintenanceItem: form.maintenanceItem.value.trim(),
    receipt: form.receiptBase64.value
  };
  item ? await updateDocument('expenses', item.id, payload) : await saveDocument('expenses', payload);
  syncSelectedFromDate(payload.date);
  showToast(item ? 'Despesa atualizada.' : 'Pronto, despesa salva.');
}

async function confirmDelete(collection, id) {
  openConfirmModal('Essa ação não poderá ser desfeita.', async () => {
    await deleteDocument(collection, id);
    state[collection] = (state[collection] || []).filter(item => item.id !== id);
    renderAll();
  });
}

document.addEventListener('click', e => {
  const toggleSection = e.target.closest('[data-toggle-transaction-section]');
  const toggleGroup = e.target.closest('[data-toggle-transaction-group]');
  const entryId = e.target.closest('[data-edit-entry]')?.dataset.editEntry;
  const expenseId = e.target.closest('[data-edit-expense]')?.dataset.editExpense;
  const deleteEntryId = e.target.closest('[data-delete-entry]')?.dataset.deleteEntry;
  const deleteExpenseId = e.target.closest('[data-delete-expense]')?.dataset.deleteExpense;

  if (toggleSection) {
    const type = toggleSection.dataset.toggleTransactionSection;
    const key = toggleSection.dataset.key;
    const opened = getTransactionAccordionState(type);
    opened[key] = !isTransactionSectionOpen(type, key, true);
    renderAll();
    return;
  }

  if (toggleGroup) {
    const type = toggleGroup.dataset.toggleTransactionGroup;
    const date = toggleGroup.dataset.date;
    const opened = getTransactionAccordionState(type);
    opened[date] = !opened[date];
    renderAll();
    return;
  }
  if (entryId) openTransactionForm('entries', state.entries.find(x => x.id === entryId));
  if (expenseId) openTransactionForm('expenses', state.expenses.find(x => x.id === expenseId));
  if (deleteEntryId) confirmDelete('entries', deleteEntryId);
  if (deleteExpenseId) confirmDelete('expenses', deleteExpenseId);
});
