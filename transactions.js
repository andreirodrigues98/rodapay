import { state, formatCurrencyFull, formatDate, getWeekday, parseCurrency, parseTime, formatTime, currencyMask, timeMask, showToast, buildRidePayload, openConfirmModal, imageToBase64, escapeHtml, safeImageSource, renderEmpty, icon, todayISO, syncSelectedFromDate, availableRideOrigins, defaultOrigins, openModal, closeModal } from './utils.js';
import { saveDocument, saveRideDocument, newRideDraftId, updateDocument, deleteDocument } from './data.js';
import { renderAll } from './app.js';

// Histórico: os documentos seguem nas coleções existentes e mantêm as datas originais.
const historyView = { period: 'month', day: todayISO(), month: todayISO().slice(0,7), year: new Date().getFullYear(), start: todayISO().slice(0,7)+'-01', end:todayISO() };
const historyOpenDays = { entries:new Set(), expenses:new Set() };
const historyMore = { entries: 35, expenses: 35 };
const historyItemsShown = new Map();

function validDate(item) { return /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')); }
function filteredHistory(type) {
  const items = type === 'entries' ? state.entries : state.expenses;
  return [...items].filter(item => {
    if (!validDate(item)) return historyView.period === 'all';
    if (historyView.period === 'day') return item.date === historyView.day;
    if (historyView.period === 'month') return item.date.slice(0, 7) === historyView.month;
    if (historyView.period === 'year') return item.date.slice(0, 4) === String(historyView.year);
    if (historyView.period === 'range') return item.date >= historyView.start && item.date <= historyView.end;
    return true;
  }).sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.rideTime || b.createdAt?.seconds || '').localeCompare(String(a.rideTime || a.createdAt?.seconds || '')));
}
// O texto do date nativo iOS pode ser maior do que a largura da tela.
// Exibimos DD/MM/AAAA numa camada visual e mantemos o input date REAL,
// sobreposto e tocável: o calendário continua sendo o seletor do iPhone.
function compactHistoryDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`
    : 'Selecionar data';
}
function historyDateControl(kind, label, value) {
  const dateId = `history-${kind}-date`;
  const ariaLabel = kind === 'start' ? 'Data inicial' : kind === 'end' ? 'Data final' : 'Dia';
  return `<label class="history-date-control" for="${dateId}"><span>${label}</span>
    <span class="history-date-input">
      <span class="history-date-value" aria-hidden="true">${compactHistoryDate(value)}</span>
      <svg class="history-date-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
      <input id="${dateId}" type="date" data-history-date="${kind}" value="${value}" aria-label="${ariaLabel}">
    </span>
  </label>`;
}
function historyFilterControl() {
  if (historyView.period === 'day') return historyDateControl('day', 'Dia', historyView.day);
  if (historyView.period === 'month') return `<label class="history-date-control">Mês<input type="month" data-history-date="month" value="${historyView.month}"></label>`;
  if (historyView.period === 'year') return `<label class="history-date-control">Ano<input type="number" inputmode="numeric" min="2000" max="2100" data-history-date="year" value="${historyView.year}"></label>`;
  if (historyView.period === 'range') return `<div class="history-custom-range">${historyDateControl('start','De',historyView.start)}${historyDateControl('end','Até',historyView.end)}</div>`;
  return '';
}
function sourceLogo(item) {
  const name=String(item.origin || '');
  const configured=state.origins.find(x=>x.name===name)?.image;
  const match = /(^|\W)99(\W|$)/i.test(name) ? 'img/99logo.jpg'
    : /uber/i.test(name) ? 'img/uber-logo.png'
    : /indrive|in.?driver/i.test(name) ? 'img/indrive logo.png' : /particular/i.test(name) ? 'img/logoparticular.png' : '';
  const source=safeImageSource(match || configured);
  return source ? `<img src="${escapeHtml(source)}" alt="" loading="lazy">` : icon('tag');
}
function historyRow(item,type) {
  const entry=type==='entries';
  const ride=entry && item.entryType==='ride';
  const title=entry ? (ride ? item.origin || 'Corrida' : item.origin || 'Entrada') : item.description || item.category || 'Despesa';
  const detail=ride ? `Corrida • ${escapeHtml(item.rideTime || 'Horário não informado')}`
    : entry ? 'Entrada convencional' : escapeHtml(item.category || 'Despesa');
  return `<button type="button" class="history-row" data-history-item="${escapeHtml(item.id)}" data-history-type="${type}" aria-label="Detalhes de ${escapeHtml(title)}">
    <span class="history-row-icon ${entry?'income':'expense'}">${entry?sourceLogo(item):icon('file')}</span>
    <span class="history-row-copy"><strong>${escapeHtml(title)}</strong><small>${detail}</small></span>
    <span class="history-row-right"><strong class="${entry?'income':'expense'}">${entry?'+':'−'} ${formatCurrencyFull(item.value)}</strong><small>${ride?escapeHtml(item.rideTime || ''):formatDate(item.date)}</small></span>
    <span class="history-row-chevron">${icon('chevron')}</span>
  </button>`;
}
function historyGroups(items,type) {
  if (!items.length) return renderEmpty('Nenhuma movimentação neste período.');
  const groups=new Map();
  for (const item of items) {
    const key=validDate(item)?item.date:'sem-data';
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(item);
  }
  const daily=[...groups].slice(0, historyMore[type]);
  const rendered=daily.map(([date,entries])=>{
    const open=historyOpenDays[type].has(date);
    const total=entries.reduce((sum,item)=>sum+Math.round(Number(item.value||0)*100),0)/100;
    const rides=entries.filter(item=>item.entryType==='ride').length;
    const countText=type==='entries' && rides ? `${rides} ${rides===1?'corrida':'corridas'}` : `${entries.length} ${entries.length===1?'registro':'registros'}`;
    const shown=historyItemsShown.get(type+date) || 30;
    return `<section class="history-day ${open?'is-open':''}">
      <button type="button" class="history-day-toggle" data-history-toggle="${date}" data-history-type="${type}" aria-expanded="${open}">
        <span class="history-day-copy"><strong>${date==='sem-data'?'Sem data':formatDate(date)}</strong><small>${countText}</small></span>
        <span class="history-day-sum"><strong>${formatCurrencyFull(total)}</strong><span class="history-day-arrow">${icon('chevron')}</span></span>
      </button>
      ${open ? `<div class="history-day-list">${entries.slice(0,shown).map(item=>historyRow(item,type)).join('')}${entries.length>shown?`<button type="button" class="history-more-rows" data-history-more-rows="${date}" data-history-type="${type}">Mostrar mais ${Math.min(30,entries.length-shown)} registros</button>`:''}</div>` : ''}
    </section>`;
  }).join('');
  return rendered+(groups.size>historyMore[type]?`<button type="button" class="history-more-days" data-history-more-days="${type}">Mostrar mais dias</button>`:'');
}
export function renderTransactions() {
  document.querySelectorAll('[data-transaction-tab]').forEach(btn => btn.classList.toggle('active',btn.dataset.transactionTab===state.transactionTab));
  const host = document.getElementById('transactionsList');
  if (!host) return;
  const type = state.transactionTab;
  const items = filteredHistory(type);
  const totalCents = items.reduce((sum,item)=>sum+Math.round((Number(item.value)||0)*100),0);
  host.innerHTML = `<div class="history-panel">
    <div class="history-filter-top"><span class="history-filter-label">Consultar por período</span><div class="history-filter-pills" aria-label="Período das movimentações">
      ${[['all','Todos'],['day','Dia'],['month','Mês'],['year','Ano'],['range','Intervalo']].map(([key,label])=>`<button type="button" class="history-filter-pill ${historyView.period===key?'active':''}" data-history-period="${key}" aria-pressed="${historyView.period===key}">${label}</button>`).join('')}
    </div></div>${historyFilterControl()}
    <div class="history-results-head"><div><small>${items.length} ${items.length===1?'movimentação':'movimentações'}</small><strong>${type==='entries'?'Ganhos':'Despesas'} no período</strong></div><strong class="history-total">${formatCurrencyFull(totalCents/100)}</strong></div>
    ${historyGroups(items,type)}
  </div>`;
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

function createEntryRows(item) {
  return [
    { label: 'Data', value: formatDate(item.date) },
    { label: 'Dia da semana', value: item.weekday || getWeekday(item.date) },
    { label: 'Origem', value: item.origin || '-' },
    { label: 'Valor entrada', value: formatCurrencyFull(item.value) },
    ...(item.entryType === 'ride' ? [{label:'Horário da corrida', value:item.rideTime || '-'}, {label:'Gorjeta', value:formatCurrencyFull(item.tip || 0)}] : []),
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
    { label: 'Nota fiscal', safeHtml: safeImageSource(item.receipt) ? `<a href="${escapeHtml(safeImageSource(item.receipt))}" target="_blank" rel="noopener noreferrer">Visualizar nota</a>` : 'Não enviada' }
  ];
}


function detailsModal(type, item) {
  const modal=document.getElementById('formModal');
  const content=document.getElementById('formModalContent');
  const isEntry=type==='entries';
  const title=isEntry?(item.entryType==='ride'?'Corrida registrada':'Entrada registrada'):'Despesa registrada';
  const sub=isEntry?(item.origin||'Entrada'):(item.description||item.category||'Despesa');
  const rows=isEntry?createEntryRows(item):createExpenseRows(item);
  content.innerHTML=`<div class="movement-detail" role="document">
    <div class="movement-detail-eyebrow">${isEntry?'Recebimento':'Pagamento'}</div>
    <h2>${title}</h2>
    <div class="movement-detail-amount ${isEntry?'income':'expense'}">${isEntry?'+':'−'} ${formatCurrencyFull(item.value)}</div>
    <p class="movement-detail-subtitle">${escapeHtml(sub)} · ${formatDate(item.date)}</p>
    <div class="movement-detail-grid">${rows.map(row=>`<div class="movement-detail-field"><span>${escapeHtml(row.label)}</span><strong>${row.safeHtml??escapeHtml(row.value ?? '—')}</strong></div>`).join('')}</div>
    <div class="movement-detail-actions"><button class="btn primary" type="button" data-detail-edit="${escapeHtml(item.id)}" data-detail-type="${type}">${icon('edit')} Editar lançamento</button><button class="btn ghost detail-delete" type="button" data-detail-delete="${escapeHtml(item.id)}" data-detail-type="${type}">${icon('trash')} Excluir</button></div>
  </div>`;
  openModal(modal);
}

// Registro rápido: apenas valor e aplicativo; o resto é opcional e fica recolhido.
export function openRideForm(item = null) {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  if (!modal || !content) return;
  const now = new Date();
  const date = item?.date || todayISO();
  const rideTime = item?.rideTime || `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const rememberKey = `rodapay.lastOrigin.${state.user?.uid || 'local'}`;
  const last = item?.origin || localStorage.getItem(rememberKey) || '';
  const origins = availableRideOrigins(state.origins);
  if (item?.origin && !origins.some(x=>x.name===item.origin)) origins.push({name:item.origin});
  const selected = origins.some(x=>x.name===last) ? last : (origins[0]?.name || '');
  const id = item?.id || newRideDraftId();
  const choices = origins.map((origin,index) => {
    const image = safeImageSource(origin.image || defaultOrigins.find(base => base.name === origin.name)?.image || '');
    return `<label class="ride-origin-choice ${image?'ride-origin-choice-logo':'ride-origin-choice-custom'}" title="${escapeHtml(origin.name)}"><input type="radio" name="origin" aria-label="${escapeHtml(origin.name)}" value="${escapeHtml(origin.name)}" ${(origin.name===selected || (!selected && index===0))?'checked':''} required>${image ? `<span class="ride-origin-logo"><img src="${escapeHtml(image)}" alt="${escapeHtml(origin.name)}" loading="lazy"></span>` : `<span class="ride-origin-name">${escapeHtml(origin.name)}</span>`}</label>`;
  }).join('');
  content.innerHTML = `
    <div class="ride-form-page">
      <div class="ride-form-header"><button class="icon-only-back" type="button" data-close-form aria-label="Fechar">${icon('back')}</button><span class="screen-eyebrow">LANÇAMENTO RÁPIDO</span></div>
      <h2>${item ? 'Editar corrida' : 'Nova corrida'}<span class="ride-title-dot">.</span></h2>
      <p class="ride-form-intro">Registre o ganho agora e acompanhe sua meta em tempo real.</p>
      <form id="quickRideForm" data-draft-id="${escapeHtml(id)}" class="ride-quick-form">
        <div class="ride-amount-block"><label for="rideAmount">Valor da corrida <small>Sem gorjeta</small></label>
          <input id="rideAmount" name="fare" data-currency inputmode="numeric" required placeholder="R$ 0,00" value="${item?formatCurrencyFull(item.fare??(Number(item.value||0)-Number(item.tip||0))):''}" maxlength="22" />
        </div>
        <fieldset class="ride-origin-field"><legend>Qual aplicativo?</legend><div class="ride-origin-grid">${choices}</div></fieldset>
        <div class="ride-basic-meta"><label>Data<input type="date" name="date" value="${escapeHtml(date)}" required></label><label>Horário<input type="time" name="rideTime" value="${escapeHtml(rideTime)}" required></label></div>
        <details class="ride-extra"><summary><span class="summary-label">Mais detalhes</span><span>opcional</span></summary>
          <div class="ride-extra-body"><label>Quilômetros percorridos<input name="km" type="number" inputmode="decimal" step="0.01" min="0" max="100000" placeholder="Ex.: 8,5" value="${escapeHtml(item?.km || '')}"></label>
          <label>Gorjeta <small>Será somada ao total</small><input name="tip" data-currency inputmode="numeric" maxlength="22" placeholder="R$ 0,00" value="${item?.tip?formatCurrencyFull(item.tip):''}"></label>
          <label>Observações<textarea name="note" maxlength="5000" rows="2" placeholder="Opcional">${escapeHtml(item?.note || '')}</textarea></label></div>
        </details>
        <p class="ride-form-safety">Registre somente com o veículo estacionado.</p>
        <button class="btn primary ride-submit" type="submit" >${item?'Salvar alterações':'Salvar corrida'}</button>
      </form>
    </div>`;
  openModal(modal);
  content.querySelectorAll('[data-currency]').forEach(input=>input.addEventListener('input',()=>currencyMask(input)));
  const form = content.querySelector('#quickRideForm');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    if (btn.disabled) return;
    const origin = form.querySelector('[name="origin"]:checked')?.value;
    let payload;
    try {
      payload = buildRidePayload({ fare:parseCurrency(form.elements.fare.value), tip:parseCurrency(form.elements.tip.value),
        origin, date:form.elements.date.value, rideTime:form.elements.rideTime.value,
        km:form.elements.km.value, note:form.elements.note.value });
    } catch(error) { showToast(error.message); return; }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Salvando corrida...';
    try {
      const recordId = item?.id || form.dataset.draftId;
      if (item) await updateDocument('entries', item.id, payload);
      else await saveRideDocument(form.dataset.draftId, payload);
      const localRecord = { ...(item || {}), ...payload, id: recordId };
      state.entries = item
        ? state.entries.map(entry => entry.id === item.id ? localRecord : entry)
        : [localRecord, ...state.entries.filter(entry => entry.id !== recordId)];
      localStorage.setItem(rememberKey, payload.origin);
      syncSelectedFromDate(payload.date);
      closeModal(modal);
      // Restore the previous section and viewport *before* rendering updated values.
      // Avoid a black/blank screen when the browser previously scrolled the page under the modal.
      try { renderAll(); }
      catch (renderError) {
        console.error('Falha ao atualizar a interface após salvar a corrida:', renderError);
        showToast('Corrida salva. Abra o painel para atualizar os indicadores.');
      }
      showToast(item ? 'Corrida atualizada.' : `${formatCurrencyFull(payload.value)} registrados. Boa corrida!`);
    } catch(error) {
      console.error('Falha ao registrar corrida:', error?.code || 'save-error');
      showToast('Não foi possível confirmar o registro. Confira a conexão e tente novamente.');
    } finally { btn.disabled=false; btn.textContent=original; }
  });
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
  const nativeDate = content.querySelector('[name="date"]');
  nativeDate?.addEventListener('change', () => {
    const weekday=content.querySelector('[name="weekday"]');
    if (weekday && /^\d{4}-\d{2}-\d{2}$/.test(nativeDate.value)) weekday.value=getWeekday(nativeDate.value);
    refreshHoursNotice();
  });
  refreshHoursNotice();

  const receiptPreview = content.querySelector('.receipt-upload .image-preview');
  const receiptStatus = content.querySelector('[data-receipt-status]');
  const receiptName = content.querySelector('[data-receipt-name]');
  const receiptRemove = content.querySelector('[data-remove-receipt]');
  const receiptValue = content.querySelector('[name="receiptBase64"]');
  const receiptSubmit = content.querySelector('button[type="submit"]');
  const refreshReceipt = (source, filename = '') => {
    const safe = safeImageSource(source);
    receiptPreview?.replaceChildren();
    if (receiptPreview) {
      if (safe) {
        const image = document.createElement('img');
        image.src = safe;
        image.alt = 'Prévia do comprovante';
        image.loading = 'lazy';
        receiptPreview.append(image);
      } else {
        const empty = document.createElement('span');
        empty.textContent = 'Nenhum comprovante selecionado';
        receiptPreview.append(empty);
      }
    }
    if (receiptName) receiptName.textContent = filename || (safe ? 'Comprovante anexado' : '');
    if (receiptStatus) receiptStatus.textContent = safe ? 'Pronto para salvar com esta despesa' : 'Imagem opcional';
    receiptRemove?.classList.toggle('hidden', !safe);
  };
  content.querySelectorAll('[name="receiptFile"], [name="receiptCamera"]').forEach(input => {
    input.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (receiptStatus) receiptStatus.textContent = 'Preparando sua imagem...';
      if (receiptSubmit) receiptSubmit.disabled = true;
      try {
        const base64 = await imageToBase64(file);
        if (receiptValue) receiptValue.value = base64;
        refreshReceipt(base64, file.name || 'Foto selecionada');
      } catch (error) {
        if (receiptStatus) receiptStatus.textContent = error.message || 'Não foi possível carregar a imagem.';
        showToast(error.message || 'Não foi possível carregar a imagem.');
      } finally {
        input.value = '';
        if (receiptSubmit) receiptSubmit.disabled = false;
      }
    });
  });
  receiptRemove?.addEventListener('click', () => {
    if (receiptValue) receiptValue.value = '';
    content.querySelectorAll('[name="receiptFile"], [name="receiptCamera"]').forEach(input => { input.value = ''; });
    refreshReceipt('');
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
    const button = ev.target.querySelector('button[type="submit"]');
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      const ok = type === 'entries' ? await submitEntry(ev.target, item) : await submitExpense(ev.target, item);
      if (ok === false) return;
      closeModal(modal);
      renderAll();
    } catch (error) {
      console.error('Falha ao salvar lançamento:', error?.code || error?.message);
      showToast('Não foi possível salvar o lançamento. Confira a conexão e as permissões.');
    } finally { if (button) button.disabled = false; }
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
  return `
    <div class="transaction-form-page">
      <button type="button" class="back-btn form-back" data-close-form>${icon('back')} <span>Voltar</span></button>
      <h2>${item ? 'Editar entrada' : 'Nova entrada'}</h2>
      <p class="page-intro">Ganhos agrupados de um período ou outras entradas.</p>
      <form class="transaction-form">
        ${!item ? '<p class="standard-entry-warning">Para não contar ganhos duas vezes, não registre como entrada o faturamento de corridas que você já lançou individualmente.</p>' : ''}
        <div class="form-pair"><label>Data do lançamento<input type="date" name="date" value="${date}" required></label><label>Dia da semana<input name="weekday" value="${escapeHtml(item?.weekday || getWeekday(date))}" readonly></label></div>
        <label>Origem<select name="origin" required>${state.origins.map(o => `<option ${item?.origin === o.name ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select></label>
        <label>Valor entrada<input data-currency name="value" inputmode="numeric" value="${item ? formatCurrencyFull(item.value) : ''}" placeholder="Digite 25000 para R$ 250,00" required></label>
        <label>Quantidade de viagens<input name="trips" type="text" inputmode="numeric" pattern="[0-9]*" data-only-digits value="${escapeHtml(item?.trips || '')}" placeholder="Ex.: 10"></label>

        <div class="transaction-two-cols">
          <label>Km rodados<input name="km" type="text" inputmode="decimal" data-decimal-number value="${escapeHtml(item?.km || '')}" placeholder="110"></label>
          <label>Horas trabalhadas<input data-time name="hours" inputmode="numeric" placeholder="0819 vira 08:19" value="${item ? formatTime(item.minutes) : ''}"></label>
          <div class="hours-warning-card hidden" data-hours-notice>
            <strong>Aviso sobre horas trabalhadas</strong>
            <span>Já existem horas lançadas para este dia. Preencha este campo apenas se essas horas forem de outro período de trabalho. Se for o mesmo período, deixe 00:00 para não duplicar.</span>
          </div>
        </div>

        <label>Observação<textarea name="note" placeholder="Opcional. Ex.: Teve greve, chuva forte, corrida particular...">${escapeHtml(item?.note || '')}</textarea></label>
        <button class="btn primary" type="submit">Salvar</button>
      </form>
    </div>
  `;
}

function expenseForm(item) {
  const date = item?.date || todayISO();
  return `
    <div class="transaction-form-page">
      <button type="button" class="back-btn form-back" data-close-form>${icon('back')} <span>Voltar</span></button>
      <h2>${item ? 'Editar saída' : 'Nova saída'}</h2>
      <p class="page-intro">Registre um gasto para manter suas contas em dia.</p>
      <form class="transaction-form">
        <div class="form-pair"><label>Data do lançamento<input type="date" name="date" value="${date}" required></label><label>Dia da semana<input name="weekday" value="${escapeHtml(item?.weekday || getWeekday(date))}" readonly></label></div>
        <label>Lançamento<input name="description" value="${escapeHtml(item?.description || '')}" placeholder="Ex.: Almoço" required></label>
        <label>Valor saída<input data-currency name="value" inputmode="numeric" value="${item ? formatCurrencyFull(item.value) : ''}" placeholder="Digite 3200 para R$ 32,00" required></label>
        <label>Categoria<select name="category">${state.expenseCategories.map(c => `<option ${item?.category === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>
        <label>Tipo de gasto<select name="expenseType"><option ${item?.expenseType === 'Diário/Semanal' ? 'selected' : ''}>Diário/Semanal</option><option ${item?.expenseType === 'Mensal/Pontual' ? 'selected' : ''}>Mensal/Pontual</option></select></label>
        <details class="form-optional"><summary><span class="summary-label">Mais detalhes</span><span>Opcional</span></summary><div class="form-optional-body"><label>Detalhe<input name="detail" value="${escapeHtml(item?.detail || '')}" placeholder="Ex.: Bairro Saúde"></label>
        <label>Manutenção item<input name="maintenanceItem" value="${escapeHtml(item?.maintenanceItem || '')}" placeholder="Opcional"></label>
        </div></details><label>Forma de pagamento<select name="paymentMethod">${state.paymentMethods.map(p => `<option ${item?.paymentMethod === p.name ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>
        <section class="receipt-upload" aria-label="Comprovante da despesa">
          <div class="receipt-heading"><span class="receipt-heading-icon">${icon('file')}</span><div><strong>Nota fiscal ou comprovante</strong><small>Adicione uma foto da galeria ou tire uma agora. Opcional.</small></div></div>
          <div class="receipt-actions">
            <label class="receipt-pick" for="receiptFile">${icon('file')} <span>Anexar foto</span></label>
            <label class="receipt-pick receipt-pick-camera" for="receiptCamera">${icon('camera')} <span>Tirar foto</span></label>
          </div>
          <input id="receiptFile" name="receiptFile" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" class="file-visually-hidden">
          <input id="receiptCamera" name="receiptCamera" type="file" accept="image/*" capture="environment" class="file-visually-hidden">
          <input type="hidden" name="receiptBase64" value="${escapeHtml(safeImageSource(item?.receipt))}">
          <div class="image-preview">${safeImageSource(item?.receipt) ? `<img src="${escapeHtml(safeImageSource(item.receipt))}" alt="Comprovante anexado">` : '<span>Nenhum comprovante selecionado</span>'}</div>
          <div class="receipt-footer"><span class="receipt-details"><strong data-receipt-name>${safeImageSource(item?.receipt) ? 'Comprovante anexado' : ''}</strong><small data-receipt-status>${safeImageSource(item?.receipt) ? 'Pronto para salvar com esta despesa' : 'Imagem opcional'}</small></span><button type="button" class="receipt-remove ${safeImageSource(item?.receipt) ? '' : 'hidden'}" data-remove-receipt>Remover</button></div>
          <p class="receipt-file-note">JPG, PNG ou foto do iPhone. Imagens grandes são reduzidas antes de salvar.</p>
        </section>
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

  if (parseCurrency(form.value.value) <= 0) { showToast('Informe um valor maior que zero.'); return false; }
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
  if (item) await updateDocument('entries', item.id, payload);
  else await saveDocument('entries', payload);
  const nextEntry = { ...(item || {}), ...payload, id: item?.id || `local_${Date.now()}` };
  state.entries = item
    ? state.entries.map(entry => entry.id === item.id ? nextEntry : entry)
    : [nextEntry, ...state.entries];
  syncSelectedFromDate(payload.date);
  showToast(item ? 'Entrada atualizada.' : 'Pronto, entrada salva.');
}

async function submitExpense(form, item) {
  if (!form.date.value) {
    showToast('Confira o dia, mês e ano antes de salvar.');
    return false;
  }
  if (parseCurrency(form.value.value) <= 0) { showToast('Informe um valor maior que zero.'); return false; }
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
  if (item) await updateDocument('expenses', item.id, payload);
  else await saveDocument('expenses', payload);
  const nextExpense = { ...(item || {}), ...payload, id: item?.id || `local_${Date.now()}` };
  state.expenses = item
    ? state.expenses.map(expense => expense.id === item.id ? nextExpense : expense)
    : [nextExpense, ...state.expenses];
  syncSelectedFromDate(payload.date);
  showToast(item ? 'Despesa atualizada.' : 'Pronto, despesa salva.');
}

async function confirmDelete(collection, id) {
  openConfirmModal('Essa ação não poderá ser desfeita.', async () => {
    try {
      await deleteDocument(collection, id);
      state[collection] = (state[collection] || []).filter(item => item.id !== id);
      renderAll();
    } catch(error) {
      console.error('Falha ao excluir registro:', error?.code || 'delete-error');
      showToast('Não foi possível excluir. Confira a conexão e tente novamente.');
    }
  });
}

document.addEventListener('change', event => {
  const field=event.target.closest('[data-history-date]');
  if(!field) return;
  const type=field.dataset.historyDate;
  if(type==='day' && /^\d{4}-\d{2}-\d{2}$/.test(field.value)) historyView.day=field.value;
  if(type==='month' && /^\d{4}-\d{2}$/.test(field.value)) historyView.month=field.value;
  if(type==='year' && Number(field.value)>=2000 && Number(field.value)<=2100) historyView.year=Number(field.value);
  if((type==='start'||type==='end') && /^\d{4}-\d{2}-\d{2}$/.test(field.value)) historyView[type]=field.value;
  renderTransactions();
});
document.addEventListener('click', event => {
  const period=event.target.closest('[data-history-period]')?.dataset.historyPeriod;
  if(period) {historyView.period=period;renderTransactions();return;}
  const toggle=event.target.closest('[data-history-toggle]');
  if(toggle){const set=historyOpenDays[toggle.dataset.historyType];const day=toggle.dataset.historyToggle;if(set.has(day))set.delete(day);else set.add(day);renderTransactions();return;}
  const moreDays=event.target.closest('[data-history-more-days]');
  if(moreDays){historyMore[moreDays.dataset.historyMoreDays]+=35;renderTransactions();return;}
  const moreRows=event.target.closest('[data-history-more-rows]');
  if(moreRows){const key=moreRows.dataset.historyType+moreRows.dataset.historyMoreRows;historyItemsShown.set(key,(historyItemsShown.get(key)||30)+30);renderTransactions();return;}
  const detail=event.target.closest('[data-history-item]');
  if(detail) {
    const type=detail.dataset.historyType;
    const item=state[type]?.find(x=>x.id===detail.dataset.historyItem);
    if(item) detailsModal(type,item);
    return;
  }
  const edit=event.target.closest('[data-detail-edit]');
  if(edit){
    const type=edit.dataset.detailType;
    const item=state[type]?.find(x=>x.id===edit.dataset.detailEdit);
    if(item) (type==='entries' && item.entryType==='ride' ? openRideForm(item) : openTransactionForm(type,item));
    return;
  }
  const del=event.target.closest('[data-detail-delete]');
  if(del){
    const type=del.dataset.detailType;
    const id=del.dataset.detailDelete;
    closeModal(document.getElementById('formModal'));
    confirmDelete(type,id);
    return;
  }
});
