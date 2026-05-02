import { state, formatCurrencyFull, parseCurrency, currencyMask, weeksRealInMonth, openConfirmModal, showToast, icon } from './utils.js';
import { saveDocument, updateDocument, deleteDocument } from './data.js';

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function ensureGoalState(){
  if (!state.goalTab) state.goalTab = 'monthly';
  if (!state.goalMode) state.goalMode = 'list';
  if (!state.goalYear) state.goalYear = state.selectedYear;
}

function goalExpense(goal){
  return Math.max(0, Number(goal?.revenueGoal || 0) - Number(goal?.profitGoal || 0));
}

export function renderGoals() {
  ensureGoalState();
  if (state.goalMode === 'form') return renderGoalForm();
  return renderGoalList();
}

function refreshGoalPanel(){
  const panel = document.getElementById('settingsPanel');
  if (!panel || panel.classList.contains('hidden')) return;
  const content = renderGoals();
  if (state.goalMode === 'form') {
    panel.innerHTML = `<div class="settings-page-ref"><div class="settings-goals-wrap">${content}</div></div>`;
  } else {
    panel.innerHTML = `<div class="settings-page-ref"><div class="settings-page-header-ref"><button class="icon-only-back" type="button" data-close-settings>${icon('back')}</button><h2>Metas</h2></div><div class="settings-goals-wrap">${content}</div></div>`;
  }
  setTimeout(() => window.RodaPayInitSwipe?.(), 0);
}

function yearlyTotals(year){
  const goals = state.goals.filter(g=>Number(g.year)===Number(year));
  return goals.reduce((acc,g)=>{
    acc.revenue += Number(g.revenueGoal||0);
    acc.profit += Number(g.profitGoal||0);
    acc.expense += goalExpense(g);
    return acc;
  }, {revenue:0, profit:0, expense:0});
}

function selectedYearGoals(){
  return state.goals
    .filter(g=>Number(g.year)===Number(state.goalYear))
    .sort((a,b)=>Number(a.month||0)-Number(b.month||0));
}

function currentMonthWorkDays(){
  const current = state.goals.find(g=>Number(g.year)===Number(state.goalYear) && Number(g.month)===new Date().getMonth());
  return current?.workDays || '-';
}

function goalYearPickerModal(){
  const current = Number(state.goalYear || state.selectedYear || new Date().getFullYear());
  const start = 2020;
  const end = 2038;
  const years = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return `<div class="selection-modal-overlay hidden" data-goal-year-picker>
    <div class="selection-modal-card selection-year-card goal-selection-year-card">
      <div class="selection-modal-sticky">
        <button class="selection-modal-close" type="button" data-goal-year-close aria-label="Fechar">×</button>
        <div class="selection-modal-header">Selecione o ano</div>
      </div>
      <div class="selection-modal-scroll">
        <div class="selection-modal-list">
          ${years.map(year => `<button type="button" class="selection-modal-option ${year === current ? 'active' : ''}" data-goal-year-option="${year}">${year}</button>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderGoalList(){
  const year = Number(state.goalYear || state.selectedYear);
  const total = yearlyTotals(year);
  return `<section class="goals-page">
    <div class="goals-head">
      <div>
        <h2>Metas</h2>
        <p class="page-intro">Planeje quanto deseja faturar e lucrar. A despesa é calculada automaticamente pelo RODAPAY.</p>
      </div>
      <button class="round-action" data-new-goal title="Nova meta">${icon('plus')}</button>
    </div>

    <div class="goal-summary-ref">
      <div class="goal-subtotal">
        <strong>Subtotal de ${year}:</strong>
        <span>Faturamento: <b class="green">${formatCurrencyFull(total.revenue)}</b></span>
        <span>Lucro: <b class="green-soft">${formatCurrencyFull(total.profit)}</b></span>
        <span>Despesa: <b class="red">${formatCurrencyFull(total.expense)}</b></span>
      </div>
      <div class="goal-days-box">
        <span>Dias trabalhados no mês atual:</span>
        <strong>${currentMonthWorkDays()}</strong>
      </div>
    </div>

    <nav class="goal-tabs-ref" aria-label="Visualização das metas">
      <button class="${state.goalTab==='weekly'?'active':''}" data-goal-tab="weekly">Semanal</button>
      <button class="${state.goalTab==='monthly'?'active':''}" data-goal-tab="monthly">Mensal</button>
      <button class="${state.goalTab==='yearly'?'active':''}" data-goal-tab="yearly">Anual</button>
    </nav>

    <div class="goal-year-filter">
      <div class="goal-year-label">Ano</div>
      <button class="goal-year-trigger year-picker-trigger" type="button" data-goal-year-open aria-label="Selecionar ano">
        <strong>${year}</strong>
      </button>
    </div>

    <p class="swipe-hint goal-delete-help">Para excluir, arraste a meta para o lado esquerdo e toque no campo vermelho para excluir.</p>
    ${goalContent(year)}
    ${goalYearPickerModal()}
  </section>`;
}

function goalContent(year){
  if (state.goalTab === 'weekly') return weeklyContent(year);
  if (state.goalTab === 'yearly') return yearlyContent(year);
  return monthlyContent(year);
}

function emptyGoal(text){
  return `<div class="goal-empty">${icon('folder')}<strong>${text}</strong><small>Toque no botão + para cadastrar a primeira meta.</small></div>`;
}

function goalSwipe(id, content) {
  return `<div class="swipe-shell goal-swipe-shell" data-swipe-shell>
    <button class="swipe-delete-btn" type="button" data-delete-goal="${id}">${icon('trash')}<span>Excluir</span></button>
    <div class="swipe-content">${content}</div>
  </div>`;
}

function monthlyContent(year){
  const rows = selectedYearGoals();
  if (!rows.length) return emptyGoal('Nenhuma meta cadastrada para este período');
  return `<div class="goal-table-cards">${rows.map(g=>goalDetailCard(g)).join('')}</div>`;
}

function weeklyContent(year){
  const rows = selectedYearGoals();
  if (!rows.length) return emptyGoal('Nenhuma meta semanal cadastrada para este período');
  return `<div class="goal-simple-list">${rows.map(g=>{
    const weeks = weeksRealInMonth(Number(g.year), Number(g.month));
    const weekly = Number(g.revenueGoal||0) / weeks;
    const daily = weekly / Number(g.workDays||1);
    return goalSwipe(g.id, `<article class="goal-line-card">
      <div><strong>${months[g.month]}</strong><span>Semana calculada pela quantidade real de semanas do mês.</span></div>
      <div><small>Meta semanal</small><b>${formatCurrencyFull(weekly)}</b></div>
      <div><small>Meta diária</small><b>${formatCurrencyFull(daily)}</b></div>
      <div class="goal-actions"><button class="icon-action" data-edit-goal="${g.id}" title="Editar">${icon('edit')}</button></div>
    </article>`);
  }).join('')}</div>`;
}

function yearlyContent(year){
  const total = yearlyTotals(year);
  const rows = selectedYearGoals();
  if (!rows.length) return emptyGoal('Nenhuma meta anual calculada para este período');
  return `<div class="goal-year-card">
    <span>Ano ${year}</span>
    <strong>${formatCurrencyFull(total.revenue)}</strong>
    <small>Total das metas mensais cadastradas para este ano.</small>
    <div class="goal-year-grid"><p>Lucro planejado <b>${formatCurrencyFull(total.profit)}</b></p><p>Despesa planejada <b>${formatCurrencyFull(total.expense)}</b></p></div>
  </div>${monthlyContent(year)}`;
}

function goalDetailCard(g){
  const weeks = weeksRealInMonth(Number(g.year), Number(g.month));
  const weekly = Number(g.revenueGoal||0) / weeks;
  const daily = weekly / Number(g.workDays||1);
  return goalSwipe(g.id, `<article class="goal-detail-card">
    <div class="goal-card-actions"><button class="floating-edit" data-edit-goal="${g.id}" title="Editar meta">${icon('edit')}</button></div>
    <div class="goal-table-ref">
      <div class="label neutral">Mês</div><div>${months[g.month]}</div>
      <div class="label revenue">Faturamento</div><div>${formatCurrencyFull(g.revenueGoal)}</div>
      <div class="label profit">Lucro</div><div>${formatCurrencyFull(g.profitGoal)}</div>
      <div class="label expense">Despesa</div><div>${formatCurrencyFull(goalExpense(g))}</div>
      <div class="label neutral">Qtd. de Semanas</div><div>${weeks.toFixed(2)}</div>
      <div class="label neutral">Semana</div><div>${formatCurrencyFull(weekly)}</div>
      <div class="label neutral">Dia</div><div>${formatCurrencyFull(daily)}</div>
    </div>
  </article>`);
}

function renderGoalForm(){
  const editing = state.editGoalId ? state.goals.find(g=>g.id===state.editGoalId) : null;
  const year = editing?.year || state.goalYear || state.selectedYear;
  const month = Number(editing?.month ?? state.selectedMonth);
  const weeks = weeksRealInMonth(Number(year), month).toFixed(2);
  const revenue = Number(editing?.revenueGoal || 0);
  const profit = Number(editing?.profitGoal || 0);
  return `<section class="goals-page goal-form-page">
    <button class="back-btn" data-goal-list>← Voltar para metas</button>
    <h2>${editing ? 'Editar meta' : 'Nova meta'}</h2>
    <p class="page-intro">Informe faturamento e lucro. A despesa é calculada automaticamente: faturamento menos lucro.</p>
    <form class="goal-form-ref" data-goal-form>
      <input type="hidden" name="id" value="${editing?.id || ''}">
      <label>Dias trabalhados na semana<input name="workDays" type="number" min="1" max="7" value="${editing?.workDays || 6}" required></label>
      <label>Ano<select name="year" data-goal-form-year>${yearOptions(year)}</select></label>
      <label>Mês<select name="month" data-goal-form-month>${months.map((m,i)=>`<option value="${i}" ${i===month?'selected':''}>${m}</option>`).join('')}</select></label>
      <div class="two-cols"><label>Faturamento<input data-currency name="revenueGoal" inputmode="numeric" required value="${editing?formatCurrencyFull(revenue):''}" placeholder="R$ 0,00"></label><label>Lucro<input data-currency name="profitGoal" inputmode="numeric" value="${editing?formatCurrencyFull(profit):''}" placeholder="R$ 0,00"></label></div>
      <label>Despesa<input name="expenseGoal" value="${editing?formatCurrencyFull(goalExpense(editing)):formatCurrencyFull(0)}" readonly></label>
      <label>Quantidade de semanas<input name="weeksPreview" value="${weeks}" readonly></label>
      <div class="two-cols"><label>Semana<input name="weekPreview" value="${formatCurrencyFull(revenue/Number(weeks||1))}" readonly></label><label>Dia<input name="dayPreview" value="${formatCurrencyFull((revenue/Number(weeks||1))/Number(editing?.workDays||6))}" readonly></label></div>
      <button class="btn primary">${editing ? 'Salvar alterações' : 'Salvar meta'}</button>
    </form>
  </section>`;
}

function yearOptions(selected){
  const current = new Date().getFullYear();
  let years = [];
  for(let y=current-2;y<=current+5;y++) years.push(y);
  if (!years.includes(Number(selected))) years.push(Number(selected));
  return years.sort().map(y=>`<option value="${y}" ${Number(selected)===y?'selected':''}>${y}</option>`).join('');
}

function updateGoalPreview(form){
  const year = Number(form.year.value);
  const month = Number(form.month.value);
  const weeks = weeksRealInMonth(year, month);
  const revenue = parseCurrency(form.revenueGoal.value);
  const profit = parseCurrency(form.profitGoal.value);
  const workDays = Number(form.workDays.value || 6);
  const expense = Math.max(0, revenue - profit);
  form.expenseGoal.value = formatCurrencyFull(expense);
  form.weeksPreview.value = weeks.toFixed(2);
  form.weekPreview.value = formatCurrencyFull(revenue / weeks);
  form.dayPreview.value = formatCurrencyFull((revenue / weeks) / workDays);
}

function syncGoalYearModalScrollLock(){
  const hasOpenModal = !!document.querySelector('.selection-modal-overlay:not(.hidden)');
  document.documentElement.classList.toggle('selection-modal-open', hasOpenModal);
  document.body.classList.toggle('selection-modal-open', hasOpenModal);
}

function toggleGoalYearModal(open) {
  const modal = document.querySelector('[data-goal-year-picker]');
  if (!modal) return;
  modal.classList.toggle('hidden', !open);
  syncGoalYearModalScrollLock();
}

document.addEventListener('input', e => {
  if (e.target.matches('[data-currency]')) currencyMask(e.target);
  const form = e.target.closest('[data-goal-form]');
  if (form) updateGoalPreview(form);
});

document.addEventListener('change', e => {
  const form = e.target.closest('[data-goal-form]');
  if (form) updateGoalPreview(form);
});

document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-goal-form]'); if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id; delete data.id; delete data.weeksPreview; delete data.weekPreview; delete data.dayPreview;
  data.revenueGoal = parseCurrency(data.revenueGoal);
  data.profitGoal = parseCurrency(data.profitGoal);
  data.expenseGoal = Math.max(0, data.revenueGoal - data.profitGoal);
  data.year = Number(data.year); data.month = Number(data.month); data.workDays = Number(data.workDays);
  state.goalYear = data.year;
  if (id) {
    await updateDocument('goals', id, data);
    state.goals = state.goals.map(g => g.id === id ? { ...g, ...data } : g);
    showToast('Meta atualizada.');
  } else {
    const ref = await saveDocument('goals', data);
    state.goals.push({ id: ref.id, ...data });
    showToast('Meta salva.');
  }
  state.goalMode = 'list'; state.editGoalId = null; refreshGoalPanel(); window.RodaPayRender?.();
});

document.addEventListener('click', e => {
  if (e.target.matches('[data-goal-year-picker]')) {
    e.target.classList.add('hidden');
    syncGoalYearModalScrollLock();
    return;
  }

  if (e.target.closest('[data-goal-year-open]')) {
    toggleGoalYearModal(true);
    return;
  }

  if (e.target.closest('[data-goal-year-close]')) {
    toggleGoalYearModal(false);
    return;
  }

  const yearOption = e.target.closest('[data-goal-year-option]')?.dataset.goalYearOption;
  if (yearOption) {
    state.goalYear = Number(yearOption);
    toggleGoalYearModal(false);
    refreshGoalPanel();
    return;
  }

  const tab = e.target.closest('[data-goal-tab]')?.dataset.goalTab;
  if (tab) { state.goalTab = tab; state.goalMode = 'list'; refreshGoalPanel(); }
  if (e.target.closest('[data-new-goal]')) { state.goalMode = 'form'; state.editGoalId = null; refreshGoalPanel(); }
  if (e.target.closest('[data-goal-list]')) { state.goalMode = 'list'; state.editGoalId = null; refreshGoalPanel(); }
  const edit = e.target.closest('[data-edit-goal]')?.dataset.editGoal;
  if (edit) { state.goalMode = 'form'; state.editGoalId = edit; refreshGoalPanel(); }
  const del = e.target.closest('[data-delete-goal]')?.dataset.deleteGoal;
  if (del) openConfirmModal('Essa ação não poderá ser desfeita.', async () => { await deleteDocument('goals', del); state.goals = state.goals.filter(g => g.id !== del); refreshGoalPanel(); window.RodaPayRender?.(); showToast('Meta excluída.'); });
});
