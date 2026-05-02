import { state, imageToBase64, openConfirmModal, showToast, renderEmpty, formatDuration, formatDate, formatCurrencyFull, icon, toISODate, getWeekNumber, getISOWeekStart, calculateDashboard, groupSum, safeDivide, openModal, closeModal } from './utils.js';
import { saveDocument, updateDocument, deleteDocument, saveUserSettings } from './data.js';
import { logoutUser } from './auth.js';
import { renderGoals } from './goals.js';

function getHomeSections() {
  return [
    { title: 'Conta', items: [['Perfil', 'profile', 'user']] },
    { title: 'Cadastros', items: [['Jornadas finalizadas', 'drivingSessions', 'clock'], ['Categorias de entradas', 'origins', 'tag'], ['Formas de pagamento', 'paymentMethods', 'card'], ['Categorias de saídas', 'expenseCategories', 'file'], ['Metas', 'goals', 'target']] },
    { title: 'App', items: [['Relatórios', 'reports', 'file'], [state.settings.lightMode ? 'Dark mode' : 'Light mode', 'lightMode', 'swap'], ['Sair', 'logout', 'logout']] }
  ];
}

const crudConfig = {
  origins: {
    title: 'Origens',
    subtitle: 'Selecione as origens que deseja visualizar nos painéis. Máximo de 5.',
    addLabel: 'Nova origem',
    submitLabel: 'Salvar origem'
  },
  paymentMethods: {
    title: 'Formas de pagamento',
    subtitle: '',
    addLabel: 'Nova forma de pagamento',
    submitLabel: 'Salvar forma de pagamento'
  },
  expenseCategories: {
    title: 'Gastos',
    subtitle: '',
    addLabel: 'Nova categoria de saída',
    submitLabel: 'Salvar categoria'
  }
};

let currentPanelKey = null;
let sessionTab = 'all';
let sessionDate = toISODate(new Date());
let sessionMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
let sessionWeek = getWeekNumber(new Date());
let sessionYear = new Date().getFullYear();

const reportMonthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let reportPeriod = 'monthly';
let reportDate = toISODate(new Date());
let reportMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
let reportWeek = getWeekNumber(new Date());
let reportYear = new Date().getFullYear();

const fixedOriginColors = { Uber: '#2F6BFF', '99 Pop': '#FF9F1A', InDriver: '#17C964', Particular: '#64748B' };
function automaticOriginColor(name) {
  const palette = ['#2F6BFF', '#FF8A34', '#17C964', '#FF9F1A', '#8B5CF6', '#14B8A6'];
  if (fixedOriginColors[name]) return fixedOriginColors[name];
  let hash = 0;
  String(name || '').split('').forEach(char => { hash = ((hash << 5) - hash) + char.charCodeAt(0); hash |= 0; });
  return palette[Math.abs(hash) % palette.length];
}

export function renderSettings() {
  const menu = document.getElementById('settingsMenu');
  const panel = document.getElementById('settingsPanel');
  const settingsView = document.getElementById('settingsView');
  if (!menu || !panel) return;
  settingsView?.classList.toggle('panel-open', !!currentPanelKey);

  if (!currentPanelKey) {
    menu.classList.remove('hidden');
    panel.classList.add('hidden');
    menu.innerHTML = renderSettingsMenu();
    setTimeout(() => window.RodaPayInitSwipe?.(), 0);
    return;
  }

  menu.classList.add('hidden');
  panel.classList.remove('hidden');
  panel.innerHTML = panelContent(currentPanelKey);
  setTimeout(() => window.RodaPayInitSwipe?.(), 0);
}

export function openSettingsPanel(key) {
  if (key === 'logout') return logoutUser();
  if (key === 'lightMode') return toggleLightMode();
  currentPanelKey = key;
  renderSettings();
}

function closeSettingsPanel() {
  currentPanelKey = null;
  renderSettings();
}

function renderSettingsMenu() {
  return `
    <div class="settings-home-ref">
      ${getHomeSections().map(section => `
        <section class="settings-home-group">
          ${section.items.map(([label, key, iconName], index) => `
            <button class="settings-home-item" data-settings="${key}">
              <span class="settings-home-icon">${icon(iconName)}</span>
              <em>${label}</em>
            </button>
            ${index !== section.items.length - 1 ? '<div class="settings-home-separator"></div>' : ''}
          `).join('')}
        </section>
      `).join('')}
    </div>
  `;
}

function panelContent(key) {
  if (key === 'profile') {
    return pageShell('Perfil', `
      <div class="settings-simple-card">
        <p><strong>E-mail:</strong> ${state.user?.email || '-'}</p>
        <p class="hint">Seu acesso será criado pela equipe. Use o e-mail e a senha informados para entrar no RODAPAY.</p>
      </div>
    `);
  }

  if (key === 'goals') {
    return pageShell('Metas', `<div class="settings-goals-wrap">${renderGoals()}</div>`);
  }

  if (key === 'drivingSessions') {
    return sessionsPanel();
  }

  if (key === 'reports') {
    return reportsPanel();
  }

  if (crudConfig[key]) {
    return crudPage(key);
  }

  return '';
}

function pageShell(title, content, extraClass = '') {
  return `
    <div class="settings-page-ref ${extraClass}">
      <div class="settings-page-header-ref">
        <button class="icon-only-back" type="button" data-close-settings>${icon('back')}</button>
        <h2>${title}</h2>
      </div>
      ${content}
    </div>
  `;
}

function swipeHint(text) {
  return `<p class="swipe-hint">${text}</p>`;
}

function crudPage(collectionName) {
  const config = crudConfig[collectionName];
  const listHtml = collectionName === 'origins'
    ? originList()
    : collectionName === 'expenseCategories'
      ? categoryList()
      : paymentMethodList();

  return pageShell(config.title, `
    ${config.subtitle ? `<p class="settings-page-intro-ref">${config.subtitle}</p>` : ''}
    <div class="settings-ref-list-wrap">${listHtml && !listHtml.includes('empty-state') ? swipeHint('Para excluir, arraste o card para o lado esquerdo e toque no campo vermelho para excluir.') : ''}${listHtml}</div>
    <button class="settings-page-fab" type="button" data-settings-add="${collectionName}" aria-label="Adicionar item">${icon('plus')}</button>
  `, 'settings-page-has-fab');
}


function reportsPanel() {
  return pageShell('Relatórios', `
    <p class="settings-page-intro-ref">Escolha o período desejado e gere um relatório profissional com suas entradas, saídas, metas e resultados.</p>

    <section class="reports-card">
      <div class="reports-period-tabs">
        ${[
          ['daily', 'Dia'],
          ['weekly', 'Semana'],
          ['monthly', 'Mês'],
          ['yearly', 'Ano']
        ].map(([value, label]) => `<button type="button" class="${reportPeriod === value ? 'active' : ''}" data-report-period="${value}">${label}</button>`).join('')}
      </div>

      ${renderReportFilterControl()}

      <button class="reports-export-btn" type="button" data-export-report>${icon('file')}<span>Exportar relatório em PDF</span></button>
      <p class="reports-note">Para salvar em PDF, use o RodaPay pelo Google Chrome ou Safari, ele irá abrir em formato de impressão, na janela do navegador, escolha “Salvar como PDF”.</p>
    </section>
  `, 'reports-page');
}

function renderReportFilterControl() {
  if (reportPeriod === 'daily') {
    return `
      <div class="report-filter-block">
        <label>Dia do relatório</label>
        <input type="date" id="reportDateFilter" value="${reportDate}">
      </div>
    `;
  }

  if (reportPeriod === 'weekly') {
    return `
      <div class="report-filter-grid">
        <label>Semana
          <input type="number" id="reportWeekFilter" min="1" max="53" value="${reportWeek}">
        </label>
        <label>Ano
          <input type="number" id="reportYearFilter" min="2020" max="2038" value="${reportYear}">
        </label>
      </div>
    `;
  }

  if (reportPeriod === 'monthly') {
    return `
      <div class="report-filter-block">
        <label>Mês do relatório</label>
        <input type="month" id="reportMonthFilter" value="${reportMonth}">
      </div>
    `;
  }

  return `
    <div class="report-filter-block">
      <label>Ano do relatório</label>
      <input type="number" id="reportYearFilter" min="2020" max="2038" value="${reportYear}">
    </div>
  `;
}

function withReportSelection(period, callback) {
  const previous = {
    selectedDate: state.selectedDate,
    selectedWeek: state.selectedWeek,
    selectedMonth: state.selectedMonth,
    selectedYear: state.selectedYear,
    period: state.period
  };

  state.period = period;

  if (period === 'daily') {
    const d = new Date(`${reportDate}T00:00:00`);
    state.selectedDate = d;
    state.selectedMonth = d.getMonth();
    state.selectedYear = d.getFullYear();
  }

  if (period === 'weekly') {
    state.selectedWeek = Number(reportWeek || getWeekNumber(new Date()));
    state.selectedYear = Number(reportYear || new Date().getFullYear());
    state.selectedDate = getISOWeekStart(Number(state.selectedYear), Number(state.selectedWeek));
    state.selectedMonth = state.selectedDate.getMonth();
  }

  if (period === 'monthly') {
    const [year, month] = String(reportMonth || '').split('-');
    state.selectedYear = Number(year || new Date().getFullYear());
    state.selectedMonth = Math.max(0, Number(month || 1) - 1);
    state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), 1);
  }

  if (period === 'yearly') {
    state.selectedYear = Number(reportYear || new Date().getFullYear());
    state.selectedMonth = 0;
    state.selectedDate = new Date(Number(state.selectedYear), 0, 1);
  }

  const result = callback();

  state.selectedDate = previous.selectedDate;
  state.selectedWeek = previous.selectedWeek;
  state.selectedMonth = previous.selectedMonth;
  state.selectedYear = previous.selectedYear;
  state.period = previous.period;

  return result;
}

function reportTitle(period) {
  if (period === 'daily') return `Relatório Diário`;
  if (period === 'weekly') return `Relatório Semanal`;
  if (period === 'monthly') return `Relatório Mensal`;
  return `Relatório Anual`;
}

function reportPeriodLabel(period) {
  if (period === 'daily') return formatDate(reportDate);
  if (period === 'weekly') return `Semana ${reportWeek} de ${reportYear}`;
  if (period === 'monthly') {
    const [year, month] = String(reportMonth || '').split('-');
    return `${reportMonthNames[Math.max(0, Number(month || 1) - 1)]} de ${year}`;
  }
  return `Ano de ${reportYear}`;
}

function escapeReport(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
}

function reportRowsFromObject(obj = {}, formatter = value => formatCurrencyFull(value)) {
  const entries = Object.entries(obj)
    .map(([name, value]) => ({ name, value: Number(value || 0) }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!entries.length) return `<tr><td colspan="3" class="empty-report-cell">Sem dados no período</td></tr>`;

  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return entries.map(item => `
    <tr>
      <td>${escapeReport(item.name)}</td>
      <td>${formatter(item.value)}</td>
      <td>${total ? Math.round((item.value / total) * 100) : 0}%</td>
    </tr>
  `).join('');
}

function transactionReportRows(items = [], type = 'entries') {
  if (!items.length) return `<tr><td colspan="${type === 'entries' ? 6 : 5}" class="empty-report-cell">Nenhum lançamento no período</td></tr>`;

  return [...items]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map(item => type === 'entries'
      ? `<tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeReport(item.origin || '-')}</td>
          <td>${formatCurrencyFull(item.value)}</td>
          <td>${Number(item.trips || 0)}</td>
          <td>${Number(item.km || 0).toLocaleString('pt-BR')}</td>
          <td>${formatDuration(Number(item.minutes || 0) * 60)}</td>
        </tr>`
      : `<tr>
          <td>${formatDate(item.date)}</td>
          <td>${escapeReport(item.description || '-')}</td>
          <td>${escapeReport(item.category || '-')}</td>
          <td>${escapeReport(item.paymentMethod || '-')}</td>
          <td>${formatCurrencyFull(item.value)}</td>
        </tr>`
    ).join('');
}

function professionalReportHtml(period, data) {
  const appRevenue = groupSum(data.entries, 'origin');
  const expenseCategories = groupSum(data.expenses, 'category');
  const revenuePerHour = safeDivide(data.revenue, data.hours);
  const balancePerHour = safeDivide(data.balance, data.hours);
  const revenuePerKm = safeDivide(data.revenue, data.km);
  const revenuePerTrip = safeDivide(data.revenue, data.trips);
  const completed = data.goal ? Math.max(0, Math.round((data.revenue / data.goal) * 100)) : 0;
  const pendingValue = Math.max(0, Number(data.goal || 0) - Number(data.revenue || 0));
  const generatedAt = new Date().toLocaleString('pt-BR');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${reportTitle(period)} - ${reportPeriodLabel(period)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #FFFFFF; }
  .report-page { width: 100%; }
  .report-cover {
    background: linear-gradient(135deg, #13294B 0%, #0B1830 70%);
    color: #FFFFFF;
    border-radius: 18px;
    padding: 28px;
    margin-bottom: 18px;
  }
  .brand { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
  .brand h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
  .brand small { color: #A8C4F7; font-weight: 700; }
  .period-pill { background: #FF7A1A; color: #FFFFFF; padding: 8px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap; }
  .report-cover h2 { margin: 26px 0 6px; font-size: 24px; }
  .report-cover p { margin: 0; color: #DCE7F8; font-size: 13px; line-height: 1.5; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 16px 0; }
  .kpi { border: 1px solid #E5E7EB; border-radius: 14px; padding: 12px; background: #F8FAFC; min-height: 76px; }
  .kpi span { display: block; font-size: 11px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
  .kpi strong { display: block; margin-top: 8px; font-size: 17px; color: #13294B; }
  .kpi.green strong { color: #166534; }
  .kpi.red strong { color: #B91C1C; }
  .kpi.blue strong { color: #1D4ED8; }
  .section { margin-top: 16px; break-inside: avoid; }
  .section h3 {
    margin: 0 0 8px;
    background: #13294B;
    color: #FFFFFF;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 14px;
    letter-spacing: .02em;
  }
  .goal-box { display: grid; grid-template-columns: 1.3fr .7fr; gap: 10px; }
  .goal-card { border: 1px solid #E5E7EB; border-radius: 14px; padding: 14px; background: #FFFFFF; }
  .goal-card strong { font-size: 18px; color: #13294B; }
  .bar { height: 12px; background: #E5E7EB; border-radius: 999px; overflow: hidden; margin: 12px 0 8px; }
  .bar span { display: block; height: 100%; background: #16A34A; border-radius: 999px; }
  .goal-meta { display: flex; justify-content: space-between; gap: 12px; color: #64748B; font-size: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; }
  th { background: #F1F5F9; color: #334155; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  th, td { padding: 9px 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .empty-report-cell { text-align: center; color: #64748B; padding: 18px; }
  .footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #E5E7EB; color: #64748B; font-size: 11px; display: flex; justify-content: space-between; gap: 12px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<main class="report-page">
  <header class="report-cover">
    <div class="brand">
      <div>
        <h1>RODAPAY</h1>
        <small>Relatório profissional para motorista de aplicativo</small>
      </div>
      <div class="period-pill">${escapeReport(reportPeriodLabel(period))}</div>
    </div>
    <h2>${escapeReport(reportTitle(period))}</h2>
    <p>Resumo organizado com faturamento, despesas, saldo, meta e produtividade do período selecionado.</p>
  </header>

  <section class="kpis">
    <div class="kpi green"><span>Faturamento</span><strong>${formatCurrencyFull(data.revenue)}</strong></div>
    <div class="kpi red"><span>Despesas</span><strong>${formatCurrencyFull(data.costs)}</strong></div>
    <div class="kpi blue"><span>Saldo</span><strong>${formatCurrencyFull(data.balance)}</strong></div>
    <div class="kpi"><span>Meta</span><strong>${formatCurrencyFull(data.goal)}</strong></div>
    <div class="kpi"><span>Performance</span><strong>${Math.round(Number(data.perf || 0))}%</strong></div>
    <div class="kpi"><span>Pendente</span><strong>${formatCurrencyFull(pendingValue)}</strong></div>
  </section>

  <section class="section">
    <h3>Acompanhamento da meta</h3>
    <div class="goal-box">
      <div class="goal-card">
        <strong>${completed}% da meta de faturamento</strong>
        <div class="bar"><span style="width:${Math.min(100, completed)}%"></span></div>
        <div class="goal-meta">
          <span>Realizado: ${formatCurrencyFull(data.revenue)}</span>
          <span>Meta: ${formatCurrencyFull(data.goal)}</span>
        </div>
      </div>
      <div class="goal-card">
        <strong>${formatCurrencyFull(pendingValue)}</strong>
        <div class="goal-meta"><span>Valor restante para bater a meta do período.</span></div>
      </div>
    </div>
  </section>

  <section class="section">
    <h3>Produtividade</h3>
    <div class="kpis">
      <div class="kpi"><span>Viagens</span><strong>${Number(data.trips || 0)}</strong></div>
      <div class="kpi"><span>Km rodados</span><strong>${Number(data.km || 0).toLocaleString('pt-BR')}</strong></div>
      <div class="kpi"><span>Horas</span><strong>${formatDuration(Number(data.minutes || 0) * 60)}</strong></div>
      <div class="kpi"><span>Faturamento / hora</span><strong>${formatCurrencyFull(revenuePerHour)}</strong></div>
      <div class="kpi"><span>Saldo / hora</span><strong>${formatCurrencyFull(balancePerHour)}</strong></div>
      <div class="kpi"><span>Faturamento / viagem</span><strong>${formatCurrencyFull(revenuePerTrip)}</strong></div>
    </div>
  </section>

  <section class="section two-cols">
    <div>
      <h3>Faturamento por aplicativo</h3>
      <table>
        <thead><tr><th>Aplicativo</th><th>Valor</th><th>%</th></tr></thead>
        <tbody>${reportRowsFromObject(appRevenue)}</tbody>
      </table>
    </div>
    <div>
      <h3>Despesas por categoria</h3>
      <table>
        <thead><tr><th>Categoria</th><th>Valor</th><th>%</th></tr></thead>
        <tbody>${reportRowsFromObject(expenseCategories)}</tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h3>Entradas registradas</h3>
    <table>
      <thead><tr><th>Data</th><th>Origem</th><th>Valor</th><th>Viagens</th><th>Km</th><th>Horas</th></tr></thead>
      <tbody>${transactionReportRows(data.entries, 'entries')}</tbody>
    </table>
  </section>

  <section class="section">
    <h3>Saídas registradas</h3>
    <table>
      <thead><tr><th>Data</th><th>Lançamento</th><th>Categoria</th><th>Pagamento</th><th>Valor</th></tr></thead>
      <tbody>${transactionReportRows(data.expenses, 'expenses')}</tbody>
    </table>
  </section>

  <footer class="footer">
    <span>Gerado pelo RODAPAY em ${generatedAt}</span>
    <span>Documento de controle financeiro operacional</span>
  </footer>
</main>
<script>
  window.addEventListener('load', () => {
    setTimeout(() => window.print(), 350);
  });
</script>
</body>
</html>`;
}

function exportCurrentReport() {
  try {
    const period = reportPeriod;
    const data = withReportSelection(period, () => calculateDashboard(period));
    const html = professionalReportHtml(period, data);
    const popup = window.open('', '_blank');

    if (!popup) {
      showToast('O navegador bloqueou a janela. Libere pop-ups para exportar o PDF.');
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    showToast('Relatório aberto. Escolha salvar como PDF na tela de impressão.');
  } catch (error) {
    console.error('Erro ao exportar relatório:', error);
    showToast('Não foi possível gerar o relatório. Tente novamente.');
  }
}

function sessionsPanel() {
  const sessions = getFilteredSessions();
  const total = sessions.reduce((sum, item) => sum + Number(item.totalSeconds || 0), 0);

  return pageShell('Jornadas finalizadas', `
    <div class="sessions-total-ref">Total de horas: <strong>${formatDuration(total)}</strong></div>

    <div class="sessions-tabs-ref">
      ${[
        ['all', 'Todos'],
        ['day', 'Dia'],
        ['week', 'Semana'],
        ['month', 'Mês']
      ].map(([value, label]) => `<button class="session-filter-tab ${sessionTab === value ? 'active' : ''}" type="button" data-session-tab="${value}">${label}</button>`).join('')}
    </div>

    ${renderSessionFilterControl()}

    <div class="settings-ref-list-wrap session-list-wrap">
      ${sessions.length ? swipeHint('Para excluir, arraste a jornada para o lado esquerdo e toque no campo vermelho para excluir.') + sessions.map(item => sessionRow(item)).join('') : renderEmpty('Nenhuma jornada registrada neste período.')}
    </div>
  `);
}

function renderSessionFilterControl() {
  if (sessionTab === 'day') {
    return `
      <div class="session-filter-block">
        <label>Selecione o dia</label>
        <input type="date" id="sessionDateFilter" value="${sessionDate}">
      </div>
    `;
  }

  if (sessionTab === 'week') {
    return `
      <div class="session-filter-grid">
        <label>Semana
          <input type="number" id="sessionWeekFilter" min="1" max="53" value="${sessionWeek}">
        </label>
        <label>Ano
          <input type="number" id="sessionYearFilter" value="${sessionYear}">
        </label>
      </div>
    `;
  }

  if (sessionTab === 'month') {
    return `
      <div class="session-filter-block">
        <label>Selecione o mês</label>
        <input type="month" id="sessionMonthFilter" value="${sessionMonth}">
      </div>
    `;
  }

  return '';
}

function getFilteredSessions() {
  const sorted = [...state.drivingSessions].sort((a, b) => `${b.startDate} ${b.startTime}`.localeCompare(`${a.startDate} ${a.startTime}`));

  if (sessionTab === 'day') {
    return sorted.filter(item => item.startDate === sessionDate || item.endDate === sessionDate);
  }

  if (sessionTab === 'week') {
    return sorted.filter(item => {
      const d = new Date(`${item.startDate}T00:00:00`);
      return getWeekNumber(d) === Number(sessionWeek) && d.getFullYear() === Number(sessionYear);
    });
  }

  if (sessionTab === 'month') {
    return sorted.filter(item => item.startDate?.slice(0, 7) === sessionMonth || item.endDate?.slice(0, 7) === sessionMonth);
  }

  return sorted;
}

function sessionRow(item) {
  return swipeWrapper(`drivingSessions:${item.id}`, `
    <article class="session-card-ref">
      <div class="session-card-section primary"><strong>Horas trabalhadas: <span>${formatDuration(item.totalSeconds || 0)}</span></strong></div>
      <div class="session-card-section">
        <p><strong>Dia inicial:</strong> ${formatDate(item.startDate)}</p>
        <p><strong>Hora inicial:</strong> ${item.startTime || '--:--'}</p>
      </div>
      <div class="session-card-section">
        <p><strong>Dia final:</strong> ${formatDate(item.endDate)}</p>
        <p><strong>Hora final:</strong> ${item.endTime || '--:--'}</p>
      </div>
    </article>
  `);
}

function originList() {
  if (!state.origins.length) return renderEmpty('Você ainda não cadastrou nenhuma origem.');
  return state.origins.map(item => swipeWrapper(`origins:${item.id}`, `
    <article class="settings-line-card origin-line-card">
      <div class="origin-inline-check"><input type="checkbox" data-origin-selected="${item.id}" ${item.selected ? 'checked' : ''}></div>
      <div class="settings-line-logo">${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<span>${item.name.slice(0, 2)}</span>`}</div>
      <div class="settings-line-text grow">
        <p><small>Nome:</small> <strong>${item.name}</strong></p>
        <p><small>Descrição:</small> <span>${item.description || item.name}</span></p>
      </div>
      <button class="settings-line-edit" type="button" data-settings-edit="origins:${item.id}" aria-label="Editar origem">${icon('edit')}</button>
    </article>
  `)).join('');
}

function paymentMethodList() {
  if (!state.paymentMethods.length) return renderEmpty('Você ainda não cadastrou nenhuma forma de pagamento.');
  return state.paymentMethods.map(item => swipeWrapper(`paymentMethods:${item.id}`, `
    <article class="settings-line-card simple-line-card">
      <div class="settings-line-text grow">
        <p><small>Nome:</small> <strong>${item.name}</strong></p>
        ${item.description ? `<p><small>Descrição:</small> <span>${item.description}</span></p>` : ''}
      </div>
      <button class="settings-line-edit" type="button" data-settings-edit="paymentMethods:${item.id}" aria-label="Editar forma de pagamento">${icon('edit')}</button>
    </article>
  `)).join('');
}

function categoryList() {
  if (!state.expenseCategories.length) return renderEmpty('Você ainda não cadastrou nenhuma categoria.');
  return state.expenseCategories.map(item => swipeWrapper(`expenseCategories:${item.id}`, `
    <article class="settings-line-card simple-line-card">
      <div class="settings-line-text grow">
        <p><small>Nome:</small> <strong>${item.name}</strong></p>
        ${item.description ? `<p><small>Descrição:</small> <span>${item.description}</span></p>` : ''}
        <p><small>Tipo:</small> <span>${item.type || '-'}</span></p>
      </div>
      <button class="settings-line-edit" type="button" data-settings-edit="expenseCategories:${item.id}" aria-label="Editar categoria">${icon('edit')}</button>
    </article>
  `)).join('');
}

function swipeWrapper(deleteValue, content) {
  return `
    <div class="swipe-shell settings-swipe-shell" data-swipe-shell>
      <button class="swipe-delete-btn" type="button" data-delete="${deleteValue}">${icon('trash')}<span>Excluir</span></button>
      <div class="swipe-content">${content}</div>
    </div>
  `;
}

function openCrudModal(collectionName, itemId = '') {
  const config = crudConfig[collectionName];
  const item = itemId ? (state[collectionName] || []).find(entry => entry.id === itemId) : null;
  const content = document.getElementById('formModalContent');
  if (!content) return;

  content.innerHTML = `
    <div class="settings-modal-head">
      <h3>${item ? `Editar ${config.title.slice(0, -1).toLowerCase()}` : config.addLabel}</h3>
      <p class="page-intro">Preencha as informações para salvar.</p>
    </div>
    ${crudForm(collectionName, item)}
  `;

  openModal(document.getElementById('formModal'));
}

function crudForm(collectionName, item) {
  if (collectionName === 'origins') {
    return `
      <form class="form-stack settings-modal-form" data-settings-form="origins" data-edit-id="${item?.id || ''}">
        <label>Nome<input name="name" required placeholder="Ex.: Uber" value="${item?.name || ''}"></label>
        <label>Descrição<input name="description" placeholder="Ex.: Corridas pelo aplicativo" value="${item?.description || ''}"></label>
        <label>Logo ou imagem<input name="imageFile" type="file" accept="image/*"></label>
        <input type="hidden" name="imageBase64" value="${item?.image || ''}">
        <div class="image-preview settings-image-preview">${item?.image ? `<img src="${item.image}" alt="Prévia">` : 'Prévia da imagem/logo'}</div>
        <button class="btn primary" type="submit">${item ? 'Atualizar origem' : 'Salvar origem'}</button>
      </form>
    `;
  }

  if (collectionName === 'paymentMethods') {
    return `
      <form class="form-stack settings-modal-form" data-settings-form="paymentMethods" data-edit-id="${item?.id || ''}">
        <label>Nome<input name="name" required placeholder="Ex.: Pix" value="${item?.name || ''}"></label>
        <label>Descrição<input name="description" placeholder="Ex.: Pagamento instantâneo" value="${item?.description || ''}"></label>
        <button class="btn primary" type="submit">${item ? 'Atualizar forma de pagamento' : 'Salvar forma de pagamento'}</button>
      </form>
    `;
  }

  return `
    <form class="form-stack settings-modal-form" data-settings-form="expenseCategories" data-edit-id="${item?.id || ''}">
      <label>Nome<input name="name" required placeholder="Ex.: Combustível" value="${item?.name || ''}"></label>
      <label>Descrição<input name="description" placeholder="Ex.: Abastecimentos" value="${item?.description || ''}"></label>
      <label>Tipo
        <select name="type">
          <option value="Custo fixo" ${item?.type === 'Custo fixo' ? 'selected' : ''}>Custo fixo</option>
          <option value="Custo variável" ${item?.type === 'Custo variável' ? 'selected' : ''}>Custo variável</option>
        </select>
      </label>
      <button class="btn primary" type="submit">${item ? 'Atualizar categoria' : 'Salvar categoria'}</button>
    </form>
  `;
}

async function toggleLightMode() {
  const lightMode = !state.settings.lightMode;
  await saveUserSettings({ lightMode });
  document.body.classList.toggle('light-mode', lightMode);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', lightMode ? '#F4F7FB' : '#04070D');
  showToast(lightMode ? 'Modo claro ativado.' : 'Modo escuro ativado.');
  renderSettings();
}

document.addEventListener('click', event => {
  const settingsKey = event.target.closest('[data-settings]')?.dataset.settings;
  if (settingsKey) openSettingsPanel(settingsKey);

  if (event.target.closest('[data-close-settings]')) {
    closeSettingsPanel();
  }

  const addCollection = event.target.closest('[data-settings-add]')?.dataset.settingsAdd;
  if (addCollection) {
    openCrudModal(addCollection);
  }

  const editValue = event.target.closest('[data-settings-edit]')?.dataset.settingsEdit;
  if (editValue) {
    const [collectionName, id] = editValue.split(':');
    openCrudModal(collectionName, id);
  }

  const deleteValue = event.target.closest('[data-delete]')?.dataset.delete;
  if (deleteValue) {
    const [collectionName, id] = deleteValue.split(':');
    openConfirmModal('Essa ação não poderá ser desfeita.', async () => {
      await deleteDocument(collectionName, id);
      state[collectionName] = (state[collectionName] || []).filter(item => item.id !== id);
      renderSettings();
    });
  }

  const reportPeriodValue = event.target.closest('[data-report-period]')?.dataset.reportPeriod;
  if (reportPeriodValue) {
    reportPeriod = reportPeriodValue;
    renderSettings();
    return;
  }

  if (event.target.closest('[data-export-report]')) {
    exportCurrentReport();
    return;
  }

  const sessionTabValue = event.target.closest('[data-session-tab]')?.dataset.sessionTab;
  if (sessionTabValue) {
    sessionTab = sessionTabValue;
    renderSettings();
  }
});

document.addEventListener('change', async event => {
  if (event.target.name === 'imageFile') {
    const form = event.target.closest('form');
    const base64 = await imageToBase64(event.target.files[0]);
    form.querySelector('[name="imageBase64"]').value = base64;
    form.querySelector('.image-preview').innerHTML = base64 ? `<img src="${base64}" alt="Prévia">` : 'Prévia da imagem/logo';
  }

  if (event.target.dataset.originSelected) {
    const selectedCount = state.origins.filter(item => item.selected).length;
    const currentlySelected = state.origins.find(item => item.id === event.target.dataset.originSelected)?.selected;
    if (!currentlySelected && event.target.checked && selectedCount >= 5) {
      event.target.checked = false;
      return showToast('Você pode exibir no máximo 5 origens no painel.');
    }
    await updateDocument('origins', event.target.dataset.originSelected, { selected: event.target.checked });
  }

  if (event.target.id === 'sessionDateFilter') {
    sessionDate = event.target.value;
    renderSettings();
  }

  if (event.target.id === 'sessionWeekFilter') {
    sessionWeek = Number(event.target.value || sessionWeek);
    renderSettings();
  }

  if (event.target.id === 'sessionYearFilter') {
    sessionYear = Number(event.target.value || sessionYear);
    renderSettings();
  }

  if (event.target.id === 'sessionMonthFilter') {
    sessionMonth = event.target.value;
    renderSettings();
  }

  if (event.target.id === 'reportDateFilter') {
    reportDate = event.target.value || reportDate;
    renderSettings();
  }

  if (event.target.id === 'reportWeekFilter') {
    reportWeek = Number(event.target.value || reportWeek);
    renderSettings();
  }

  if (event.target.id === 'reportYearFilter') {
    reportYear = Number(event.target.value || reportYear);
    renderSettings();
  }

  if (event.target.id === 'reportMonthFilter') {
    reportMonth = event.target.value || reportMonth;
    if (reportMonth) reportYear = Number(reportMonth.split('-')[0] || reportYear);
    renderSettings();
  }
});

document.addEventListener('submit', async event => {
  const form = event.target.closest('[data-settings-form]');
  if (!form) return;
  event.preventDefault();
  const collectionName = form.dataset.settingsForm;
  const editId = form.dataset.editId || '';
  const payload = Object.fromEntries(new FormData(form).entries());

  if (payload.imageBase64) payload.image = payload.imageBase64;
  delete payload.imageBase64;
  delete payload.imageFile;

  if (collectionName === 'origins') {
    payload.color = payload.color || automaticOriginColor(payload.name);
    if (!editId) payload.selected = state.origins.filter(item => item.selected).length < 5;
  }

  if (editId) {
    await updateDocument(collectionName, editId, payload);
    showToast('Cadastro atualizado.');
  } else {
    await saveDocument(collectionName, payload);
    showToast('Cadastro salvo.');
  }

  closeModal(document.getElementById('formModal'));
  currentPanelKey = collectionName;
  renderSettings();
});
