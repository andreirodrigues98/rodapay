import { state, calculateDashboard, formatCurrency, formatCurrencyFull, formatTime, percent, safeDivide, groupSum, daysRemainingInPeriod, getWeeksInMonth, getWeekNumber, getMonthFromWeek, getISOWeekStart, toISODate, icon, getPeriodRange } from './utils.js';

const periodNames = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const palette = ['#1D7CFF', '#00D66B', '#FF9F1A', '#FF4D67', '#8B5CF6', '#00CFFF', '#14E0C3', '#8AA4C8'];
const expenseColors = { 'Combustível':'#FFB020', 'Alimentação':'#FF8A34', 'Lavagem':'#1FC8FF', 'Outro':'#8B5CF6', 'Outros':'#8B5CF6', 'Aluguel/Prestação':'#FF4D67', 'Salário / Prolabore':'#7C3AED', 'Seguro':'#1D7CFF', 'IPVA':'#FF9F1A', 'Tag (SemParar)':'#84CC16', 'Férias':'#EC4899', 'Internet':'#38BDF8', 'MEI / Imposto':'#D97706', 'Licenciamento':'#A3E635', 'Manutenção':'#FB7185', 'Reserva de Emergência':'#00D66B', 'Multas':'#DC2626', '13º Salário':'#C084FC', 'Investimento':'#14B8A6' };
const originColors = {
  'Uber': '#1D7CFF',
  '99 Pop': '#FF9F1A',
  'InDriver': '#00D66B',
  'Particular': '#8AA4C8'
};
const originImages = {
  '99 Pop': 'img/99logo.jpg',
  'InDriver': 'img/indrive logo.png'
};
const weekdayShort = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const weekdayUpper = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

export function renderDashboard() {
  const content = document.getElementById('dashboardContent');
  if (!content) return;

  if (state.period === 'weekly') state.selectedMonth = getMonthFromWeek(Number(state.selectedYear), Number(state.selectedWeek));
  const data = calculateDashboard(state.period);

  if (state.period === 'daily') {
    content.innerHTML = renderDailyDashboard(data);
    return;
  }

  if (state.period === 'weekly') {
    content.innerHTML = renderWeeklyDashboard(data);
    return;
  }

  if (state.period === 'monthly') {
    content.innerHTML = renderMonthlyDashboard(data);
    return;
  }

  if (state.period === 'yearly') {
    content.innerHTML = renderYearlyDashboard(data);
    return;
  }

  content.innerHTML = renderPeriodDashboard(data);
}

function renderDailyDashboard(data) {
  const today = new Date();
  const dayLabel = new Intl.DateTimeFormat('pt-BR').format(today);
  const completed = progressPercent(data.revenue, data.goal);
  const pending = Math.max(0, 100 - completed);

  return `
    <section class="dash-daily-ref">
      <div class="dash-logo-ref">
        <div class="dash-logo-ring"><img class="dash-logo-img" src="img/rodapay-logo.png" alt="RODAPAY"></div>
      </div>

      <div class="day-title-ref">Hoje é dia <span>${dayLabel}</span></div>

      <div class="day-filter-grid">
        <label class="day-search-ref">
          <small>Escolha o dia</small>
          <input id="dashDate" type="date" value="${toISODate(state.selectedDate)}">
        </label>
        <div class="weekly-performance-wrap daily-performance-wrap">
          <div class="weekly-performance-title daily-performance-title">Performance</div>
          <div class="weekly-performance-box daily-performance-box">${Math.max(0, Math.round(data.perf || 0))}%</div>
        </div>
      </div>

      <div class="goal-day-ref">Meta do dia <strong>${formatCurrencyFull(data.goal)}</strong></div>
      <div class="goal-progress-ref">
        <div class="goal-progress-top"><span>${completed}% Completo - ${formatCurrencyFull(Math.min(data.revenue, data.goal || data.revenue))}</span></div>
        <div class="goal-bar-ref"><span style="width:${completed}%"></span></div>
        <div class="goal-progress-bottom"><span>${pending}% Pendente - ${formatCurrencyFull(Math.max(0, (data.goal || 0) - data.revenue))}</span></div>
      </div>

      <div class="summary-triple-ref daily-summary-grid">
        <div class="summary-highlight revenue">
          <span>Faturamento</span>
          <strong>${formatCurrencyFull(data.revenue)}</strong>
        </div>
        <div class="summary-highlight expense">
          <span>Despesas</span>
          <strong>${formatCurrencyFull(data.costs)}</strong>
        </div>
        <div class="summary-highlight balance">
          <span>Saldo</span>
          <strong>${formatCurrencyFull(data.balance)}</strong>
        </div>
      </div>

      ${metricsGrid(data)}
      <section class="daily-insights-grid">
        ${originRevenue(data, 'default')}
        ${expenseBreakdown(data)}
      </section>
    </section>
  `;
}

function renderWeeklyDashboard(data) {
  const completed = progressPercent(data.revenue, data.goal);
  const pendingValue = Math.max(0, (data.goal || 0) - data.revenue);
  const remainingDays = daysRemainingInPeriod('weekly');
  const weekSeries = getWeeklySeries(data);

  return `
    <section class="weekly-dashboard-ref">
      ${weeklyLogo()}

      <div class="weekly-title-ref">Estamos na <span>semana ${state.selectedWeek}</span> • ${monthNames[state.selectedMonth]}</div>

      <div class="weekly-top-grid">
        <div class="weekly-filter-wrap">
          <div class="weekly-filter-label">Escolha a semana</div>
          <div class="weekly-filter-grid">
            <button class="weekly-search-box dark weekly-search-button weekly-week-trigger" type="button" data-week-open>
              <small>Semana</small>
              <strong>Semana ${state.selectedWeek}</strong>
            </button>
            <label class="weekly-search-box light">
              <small>Ano</small>
              <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
            </label>
          </div>
        </div>
        <div class="weekly-performance-wrap">
          <div class="weekly-performance-title">Performance</div>
          <div class="weekly-performance-box">${Math.max(0, Math.round(data.perf || 0))}%</div>
        </div>
      </div>

      <div class="weekly-goal-side-row weekly-goal-row-inline">
        <div class="weekly-goal-main">
          <div class="weekly-goal-title">Meta da Semana <strong>${formatCurrencyFull(data.goal)}</strong></div>
          <div class="weekly-goal-bar"><span style="width:${completed}%"></span></div>
          <div class="weekly-progress-copy">
            <span class="positive">${completed}% Completo - ${formatCurrencyFull(Math.min(data.revenue, data.goal || data.revenue))}</span>
            <span class="negative">${Math.max(0, 100 - completed)}% Pendente - ${formatCurrencyFull(pendingValue)}</span>
          </div>
        </div>
        <div class="weekly-side-grid goal-side-grid">
          <div class="weekly-side-card light"><span>Essa semana restam</span><strong>${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}</strong></div>
          <div class="weekly-side-card dark"><span>Tenho que faturar por dia</span><strong>${targetPerDayLabel(pendingValue, remainingDays)}</strong></div>
        </div>
      </div>

      <div class="weekly-summary-triple">
        <div class="weekly-highlight revenue">
          <span>Faturamento</span>
          <strong>${formatCurrencyFull(data.revenue)}</strong>
        </div>
        <div class="weekly-highlight expense">
          <span>Despesas</span>
          <strong>${formatCurrencyFull(data.costs)}</strong>
        </div>
        <div class="weekly-highlight balance">
          <span>Saldo</span>
          <strong>${formatCurrencyFull(data.balance)}</strong>
        </div>
      </div>

      ${weeklyMetricsGrid(data)}
      ${originRevenue(data, 'weekly')}
      ${weeklyBarChart(weekSeries, 'Faturamento Diário', 'revenue')}
      <section class="weekly-dual-line-grid">
        ${weeklyLineChart(weekSeries, 'Saldo Diário', 'balance', '#B14BFF', false)}
        ${weeklyLineChart(weekSeries, 'Performance', 'performance', '#D4AF37', true)}
      </section>
      <p class="weekly-chart-scroll-hint">Arraste cada gráfico para o lado para ver mais.</p>
      ${weeklyExpenseTable(data)}
      ${weekPickerModal()}
      ${yearPickerModal()}
    </section>
  `;
}

function renderMonthlyDashboard(data) {
  const completed = progressPercent(data.revenue, data.goal);
  const pendingValue = Math.max(0, (data.goal || 0) - data.revenue);
  const remainingDays = daysRemainingInPeriod('monthly');
  const dailySeries = getMonthlyDailySeries(data);
  const weekSeries = getMonthlyWeekSeries(data);

  return `
    <section class="monthly-dashboard-ref">
      ${weeklyLogo()}

      <div class="monthly-title-ref">Mês atual <span>${monthNames[state.selectedMonth]}</span></div>

      <div class="weekly-top-grid">
        <div class="weekly-filter-wrap">
          <div class="weekly-filter-label">Escolha o mês</div>
          <div class="weekly-filter-grid">
            <button class="weekly-search-box dark weekly-search-button" type="button" data-month-open>
              <small>Mês</small>
              <strong>${monthNames[state.selectedMonth]}</strong>
            </button>
            <label class="weekly-search-box light">
              <small>Ano</small>
              <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
            </label>
          </div>
        </div>
        <div class="weekly-performance-wrap">
          <div class="weekly-performance-title">Performance</div>
          <div class="weekly-performance-box">${Math.max(0, Math.round(data.perf || 0))}%</div>
        </div>
      </div>

      <div class="weekly-goal-side-row weekly-goal-row-inline monthly-goal-row-inline">
        <div class="weekly-goal-main monthly-goal-main">
          <div class="weekly-goal-title">Meta do mês <strong>${formatCurrencyFull(data.goal)}</strong></div>
          <div class="weekly-goal-bar"><span style="width:${completed}%"></span></div>
          <div class="weekly-progress-copy monthly-progress-copy">
            <span class="positive">${completed}% Completo - ${formatCurrencyFull(Math.min(data.revenue, data.goal || data.revenue))}</span>
            <span class="negative">${Math.max(0, 100 - completed)}% Pendente - ${formatCurrencyFull(pendingValue)}</span>
          </div>
        </div>
        <div class="weekly-side-grid goal-side-grid">
          <div class="weekly-side-card light"><span>Esse mês restam</span><strong>${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}</strong></div>
          <div class="weekly-side-card dark"><span>Tenho que faturar por dia</span><strong>${targetPerDayLabel(pendingValue, remainingDays)}</strong></div>
        </div>
      </div>

      <div class="monthly-summary-triple">
        <div class="weekly-highlight revenue">
          <span>Faturamento</span>
          <strong>${formatCurrencyFull(data.revenue)}</strong>
        </div>
        <div class="weekly-highlight expense">
          <span>Despesas</span>
          <strong>${formatCurrencyFull(data.costs)}</strong>
        </div>
        <div class="weekly-highlight balance">
          <span>Saldo</span>
          <strong>${formatCurrencyFull(data.balance)}</strong>
        </div>
      </div>

      ${weeklyMetricsGrid(data)}
      ${originRevenue(data, 'monthly')}
      ${monthlyDailyRevenueChart(dailySeries)}
      ${monthlyRevenueVsExpensesChart(weekSeries)}
      <section class="monthly-dual-line-grid">
        ${weeklyLineChart(weekSeries, 'Saldo Semana', 'balance', '#B14BFF', false)}
        ${weeklyLineChart(weekSeries, 'Performance Semana', 'performance', '#D4AF37', true)}
      </section>
      <p class="weekly-chart-scroll-hint monthly-chart-scroll-hint">Arraste cada gráfico para o lado para ver mais.</p>
      ${monthPickerModal()}
      ${yearPickerModal()}
    </section>
  `;
}


function renderYearlyDashboard(data) {
  const completed = progressPercent(data.revenue, data.goal);
  const pendingValue = Math.max(0, (data.goal || 0) - data.revenue);
  const declaredValue = data.revenue * Number(state.settings?.incomeTaxRate ?? 0.6);
  const monthSeries = getYearlyMonthSeries(data);
  const weekSeries = getYearlyWeekSeries(data);

  return `
    <section class="yearly-dashboard-ref">
      ${weeklyLogo()}

      <div class="yearly-top-grid">
        <div class="yearly-filter-wrap">
          <div class="weekly-filter-label">Pesquise aqui</div>
          <label class="weekly-search-box dark yearly-year-box">
            <small>Ano</small>
            <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
          </label>
        </div>

        <div class="yearly-tax-card">
          <div class="yearly-tax-title">Imposto de Renda - ${Math.round(Number(state.settings?.incomeTaxRate ?? 0.6) * 100)}%</div>
          <div class="yearly-tax-content">
            <div class="yearly-tax-icon">⚖</div>
            <div>
              <span>Valor a Declarar</span>
              <strong>${formatCurrencyFull(declaredValue)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="yearly-goal-row yearly-goal-row-inline">
        <div class="yearly-goal-main">
          <div class="weekly-goal-title yearly-goal-title">Meta do Ano <strong>${formatCurrencyFull(data.goal)}</strong></div>
          <div class="weekly-goal-bar"><span style="width:${completed}%"></span></div>
          <div class="weekly-progress-copy yearly-progress-copy">
            <span class="positive">${completed}% Completo - ${formatCurrencyFull(Math.min(data.revenue, data.goal || data.revenue))}</span>
            <span class="negative">${Math.max(0, 100 - completed)}% Pendente - ${formatCurrencyFull(pendingValue)}</span>
          </div>
        </div>
        <div>
          <div class="weekly-performance-title">Performance</div>
          <div class="weekly-performance-box yearly-performance-box">${Math.max(0, Math.round(data.perf || 0))}%</div>
        </div>
      </div>

      <div class="yearly-summary-triple">
        <div class="weekly-highlight revenue">
          <span>Faturamento</span>
          <strong>${formatCurrencyFull(data.revenue)}</strong>
        </div>
        <div class="weekly-highlight expense">
          <span>Despesas</span>
          <strong>${formatCurrencyFull(data.costs)}</strong>
        </div>
        <div class="weekly-highlight balance">
          <span>Saldo</span>
          <strong>${formatCurrencyFull(data.balance)}</strong>
        </div>
      </div>

      ${weeklyMetricsGrid(data)}
      ${originRevenue(data, 'monthly')}
      <section class="yearly-dual-line-grid">
        ${weeklyLineChart(monthSeries, 'Saldo vs Mês', 'balance', '#B14BFF', false)}
        ${weeklyLineChart(weekSeries, 'Performance Semanas', 'performance', '#D4AF37', true)}
      </section>
      <p class="weekly-chart-scroll-hint yearly-chart-scroll-hint">Arraste cada gráfico para o lado para ver mais.</p>
      ${yearlyRevenueVsExpensesChart(monthSeries)}
      ${yearlyWeekRevenueChart(weekSeries)}
      ${weeklyExpenseTable(data)}
      ${yearPickerModal()}
    </section>
  `;
}

function renderPeriodDashboard(data) {
  return `
    <section class="dash-period-shell">
      <div class="dash-period-head">
        <div>
          <small class="dash-kicker">Painel ${periodNames[state.period]}</small>
          <h2>${periodTitle()}</h2>
          <p class="page-intro">Acompanhe faturamento, custos e produtividade do período selecionado.</p>
        </div>
        <div class="dash-logo-mini"><img class="dash-logo-img" src="img/rodapay-logo.png" alt="RODAPAY"></div>
      </div>

      <section class="dashboard-filter-card">
        ${periodFilters()}
      </section>

      <div class="goal-day-ref alt">Meta ${periodNames[state.period].toLowerCase()} <strong>${formatCurrencyFull(data.goal)}</strong></div>
      <div class="goal-progress-ref">
        <div class="goal-progress-top"><span>${progressPercent(data.revenue, data.goal)}% Completo - ${formatCurrencyFull(Math.min(data.revenue, data.goal || data.revenue))}</span></div>
        <div class="goal-bar-ref"><span style="width:${progressPercent(data.revenue, data.goal)}%"></span></div>
        <div class="goal-progress-bottom"><span>Faltam ${daysRemainingInPeriod(state.period)} dias para encerrar o período</span></div>
      </div>

      <div class="summary-triple-ref">
        <div class="summary-highlight revenue"><span>Faturamento</span><strong>${formatCurrencyFull(data.revenue)}</strong></div>
        <div class="summary-highlight expense"><span>Despesas</span><strong>${formatCurrencyFull(data.costs)}</strong></div>
        <div class="summary-highlight balance"><span>Saldo</span><strong>${formatCurrencyFull(data.balance)}</strong></div>
      </div>

      ${metricsGrid(data)}
      ${originRevenue(data, 'default')}
      ${expenseBreakdown(data)}
      ${expenseTable(data)}
    </section>
  `;
}

function weeklyLogo() {
  return `
    <div class="weekly-logo-ref" aria-hidden="true">
      <img class="weekly-logo-img" src="img/rodapay-logo.png" alt="">
    </div>
  `;
}

function weeklySelectOptions() {
  return monthNames.map((name, monthIndex) => {
    const weeks = getWeeksInMonth(Number(state.selectedYear), monthIndex);
    if (!weeks.length) return '';
    return `<optgroup label="${name}">${weeks.map(w => `
      <option value="${w.week}" data-month="${monthIndex}" ${Number(w.week) === Number(state.selectedWeek) && Number(monthIndex) === Number(state.selectedMonth) ? 'selected' : ''}>Semana ${w.week}</option>
    `).join('')}</optgroup>`;
  }).join('');
}

function weekPickerModal() {
  const current = Number(state.selectedWeek);
  const groupedWeeks = monthNames.map((name, monthIndex) => ({
    name,
    monthIndex,
    weeks: getWeeksInMonth(state.selectedYear, monthIndex)
  })).filter(group => group.weeks.length);

  return `
    <div class="selection-modal-overlay hidden" data-week-picker>
      <div class="selection-modal-card selection-week-card">
        <div class="selection-modal-sticky">
          <button class="selection-modal-close" type="button" data-week-close aria-label="Fechar">×</button>
          <div class="selection-modal-header">Selecione a semana</div>
          <div class="selection-modal-subtitle">${state.selectedYear}</div>
        </div>
        <div class="selection-modal-scroll selection-week-scroll">
          <div class="selection-week-list">
            ${groupedWeeks.map(group => `
              <section class="selection-week-section">
                <div class="selection-week-month">${group.name}</div>
                <div class="selection-week-grid">
                  ${group.weeks.map(item => `<button type="button" class="selection-week-option ${Number(item.week) === current && Number(group.monthIndex) === Number(state.selectedMonth) ? 'active' : ''}" data-week-option="${item.week}" data-week-month="${group.monthIndex}">Semana ${item.week}</button>`).join('')}
                </div>
              </section>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function monthPickerModal() {
  return `
    <div class="selection-modal-overlay hidden" data-month-picker>
      <div class="selection-modal-card selection-month-card">
        <div class="selection-modal-sticky">
          <button class="selection-modal-close" type="button" data-month-close aria-label="Fechar">×</button>
          <div class="selection-modal-header">Selecione o mês</div>
        </div>
        <div class="selection-modal-scroll">
          <div class="selection-modal-list">
            ${monthNames.map((name, index) => `
              <button type="button" class="selection-modal-option ${index === Number(state.selectedMonth) ? 'active' : ''}" data-month-option="${index}">${name}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function yearPickerModal() {
  const current = Number(state.selectedYear);
  const start = 2020;
  const end = 2038;
  const years = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return `
    <div class="selection-modal-overlay hidden" data-year-picker>
      <div class="selection-modal-card selection-year-card">
        <div class="selection-modal-sticky">
          <button class="selection-modal-close" type="button" data-year-close aria-label="Fechar">×</button>
          <div class="selection-modal-header">Selecione o ano</div>
        </div>
        <div class="selection-modal-scroll">
          <div class="selection-modal-list">
            ${years.map(year => `<button type="button" class="selection-modal-option ${year === current ? 'active' : ''}" data-year-option="${year}">${year}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function periodTitle() {
  if (state.period === 'weekly') return `Semana ${state.selectedWeek} de ${state.selectedYear}`;
  if (state.period === 'monthly') return `${monthNames[state.selectedMonth]} de ${state.selectedYear}`;
  if (state.period === 'yearly') return `Ano de ${state.selectedYear}`;
  return 'Resumo do dia';
}

function periodFilters() {
  if (state.period === 'weekly') {
    const groupedWeeks = monthNames.map((name, monthIndex) => ({
      name,
      monthIndex,
      weeks: getWeeksInMonth(state.selectedYear, monthIndex)
    })).filter(group => group.weeks.length);

    return `
      <div class="dashboard-inline-fields">
        <label>Semana
          <button class="year-picker-trigger period-picker-trigger" type="button" data-week-open><strong>Semana ${state.selectedWeek}</strong></button>
        </label>
        <label>Ano
          <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
        </label>
      </div>
    `;
  }

  if (state.period === 'monthly') {
    return `
      <div class="dashboard-inline-fields">
        <label>Mês
          <button class="year-picker-trigger period-picker-trigger" type="button" data-month-open><strong>${monthNames[state.selectedMonth]}</strong></button>
        </label>
        <label>Ano
          <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
        </label>
      </div>
    `;
  }

  if (state.period === 'yearly') {
    return `
      <div class="dashboard-inline-fields one">
        <label>Ano
          <button id="dashYear" class="year-picker-trigger" type="button" data-year-open><strong>${state.selectedYear}</strong></button>
        </label>
      </div>
    `;
  }

  return `
    <div class="dashboard-inline-fields one">
      <label>Data
        <input id="dashDate" type="date" value="${toISODate(state.selectedDate)}">
      </label>
    </div>
  `;
}

function metricsGrid(d) {
  const items = metricItems(d);
  return `
    <section class="metric-grid-ref">
      ${items.map(([label, value]) => `<article class="metric-card-ref"><span>${label}</span><strong>${value}</strong></article>`).join('')}
    </section>
  `;
}

function weeklyMetricsGrid(d) {
  const items = metricItems(d);
  return `
    <section class="weekly-metric-grid">
      ${items.map(([label, value]) => `<article class="weekly-metric-card"><span>${label}</span><strong>${value}</strong></article>`).join('')}
    </section>
  `;
}

function metricItems(d) {
  return [
    ['Total de Viagens', d.trips],
    ['Horas trabalhadas', formatTime(d.minutes)],
    ['Km rodados', Number(d.km || 0).toFixed(2)],
    ['Faturamento por viagem', formatCurrency(safeDivide(d.revenue, d.trips))],
    ['Faturamento por hora', formatCurrency(safeDivide(d.revenue, d.hours))],
    ['Faturamento por km', formatCurrency(safeDivide(d.revenue, d.km))],
    ['Custo por viagem', formatCurrency(safeDivide(d.costs, d.trips))],
    ['Custo por hora', formatCurrency(safeDivide(d.costs, d.hours))],
    ['Custo por KM', formatCurrency(safeDivide(d.costs, d.km))],
    ['Lucro por viagem', formatCurrency(safeDivide(d.balance, d.trips))],
    ['Lucro por hora', formatCurrency(safeDivide(d.balance, d.hours))],
    ['Lucro por KM', formatCurrency(safeDivide(d.balance, d.km))]
  ];
}

function originRevenue(d, mode = 'default') {
  const selectedOrigins = state.origins.filter(item => item.selected).slice(0, 5);
  const activeOrigins = selectedOrigins.length
    ? selectedOrigins
    : [
        { name: 'Uber', image: '', short: 'UB' },
        { name: '99 Pop', image: '', short: '99' },
        { name: 'InDriver', image: '', short: 'IN' }
      ];

  const sums = groupSum(d.entries, 'origin');
  const segments = activeOrigins.map(item => ({
    label: item.name,
    value: Number(sums[item.name] || 0),
    image: item.image || originImages[item.name] || '',
    short: item.short || item.name.slice(0, 2),
    color: getOriginColor(item)
  }));

  if (mode === 'weekly') {
    return `
      <section class="weekly-revenue-section weekly-origin-centered">
        <div class="weekly-section-band green">Faturamento por Aplicativo</div>
        ${ringChart(segments.some(item => item.value > 0) ? segments : [{ label: 'Sem dados', value: 1 }], segments.some(item => item.value > 0) ? '100%' : '0%')}
        <div class="weekly-origin-list">
          ${activeOrigins.map(item => {
            const value = Number(sums[item.name] || 0);
            const p = Math.max(0, progressPercent(value, d.revenue || 0));
            return `
              <div class="weekly-origin-row">
                <div class="weekly-origin-logo">${renderOriginMark(item)}</div>
                <div class="weekly-origin-track">
                  <div class="weekly-origin-fill" style="width:${p}%;background:${getOriginColor(item)}"></div>
                  <strong>${formatCurrency(value)}</strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  if (mode === 'monthly') {
    return `
      <section class="monthly-origin-section monthly-origin-centered">
        <div class="weekly-section-band green">Faturamento por Aplicativo</div>
        ${ringChart(segments.some(item => item.value > 0) ? segments : [{ label: 'Sem dados', value: 1 }], segments.some(item => item.value > 0) ? '100%' : '0%')}
        <div class="weekly-origin-list">
          ${activeOrigins.map(item => {
            const value = Number(sums[item.name] || 0);
            const p = Math.max(0, progressPercent(value, d.revenue || 0));
            return `
              <div class="weekly-origin-row">
                <div class="weekly-origin-logo">${renderOriginMark(item)}</div>
                <div class="weekly-origin-track">
                  <div class="weekly-origin-fill" style="width:${p}%;background:${getOriginColor(item)}"></div>
                  <strong>${formatCurrency(value)}</strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  return `
    <section class="dash-card-ref daily-origin-card daily-insight-card">
      <div class="section-band green">Faturamento por Aplicativo</div>
      ${ringChart(segments.length ? segments : [{ label: 'Sem dados', value: 1 }], '100%')}
      <div class="app-revenue-ref daily-origin-list">
        ${activeOrigins.map(item => {
          const value = Number(sums[item.name] || 0);
          const p = Math.max(0, progressPercent(value, d.revenue || 0));
          return `
            <div class="origin-line-ref">
              <div class="origin-logo-ref">${renderOriginMark(item)}</div>
              <div class="origin-track-ref">
                <div class="origin-track-fill" style="width:${p}%;background:${getOriginColor(item)}"></div>
                <strong>${formatCurrency(value)}</strong>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function getExpenseColor(name) {
  if (expenseColors[name]) return expenseColors[name];
  let hash = 0;
  String(name || '').split('').forEach(char => { hash = ((hash << 5) - hash) + char.charCodeAt(0); hash |= 0; });
  return palette[Math.abs(hash) % palette.length];
}

function getOriginColor(origin) {
  const name = typeof origin === 'string' ? origin : origin?.name;
  if (typeof origin === 'object' && origin?.color) return origin.color;
  if (originColors[name]) return originColors[name];
  let hash = 0;
  String(name || '').split('').forEach(char => { hash = ((hash << 5) - hash) + char.charCodeAt(0); hash |= 0; });
  return palette[Math.abs(hash) % palette.length];
}

function renderOriginMark(item) {
  const image = item.image || originImages[item.name] || '';
  return image ? `<img src="${image}" alt="${item.name}">` : `<span>${item.short || item.name.slice(0, 2)}</span>`;
}

function expenseBreakdown(d) {
  const categories = Object.entries(groupSum(d.expenses, 'category'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value, color: getExpenseColor(label) }));

  const rows = categories.length ? categories : [{ label: 'Nenhuma despesa registrada neste período', value: 0 }];

  return `
    <section class="dash-card-ref daily-expense-card daily-insight-card">
      <div class="section-band red">Despesas por Categoria</div>
      ${ringChart(rows.length && rows[0].value ? rows : [{ label: 'Sem despesas', value: 1, color: '#3A3F4B' }], rows.length && rows[0].value ? '100%' : '0%')}
      <div class="expense-rows-ref">
        ${rows.map(row => {
          const p = Math.max(0, progressPercent(row.value, d.costs || 0));
          return `
            <div class="expense-line-ref">
              <span>${row.label}</span>
              <div class="expense-track-ref">
                <div class="expense-track-fill" style="width:${p}%;background:${row.color || getExpenseColor(row.label)}"></div>
                <b>${formatCurrency(row.value)}</b>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function expenseTable(d) {
  const rows = Object.entries(groupSum(d.expenses, 'category')).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
  return `
    <section class="dash-card-ref compact-table">
      <div class="section-band neutral">Tabela de despesas</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Categoria</th><th>Valor</th><th>% das despesas</th><th>% do faturamento</th></tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(([name, value]) => `<tr><td>${name}</td><td>${formatCurrencyFull(value)}</td><td>${percent(value, d.costs)}%</td><td>${percent(value, d.revenue)}%</td></tr>`).join('') : '<tr><td colspan="4">Nenhuma despesa registrada neste período</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function weeklyExpenseTable(d) {
  const grouped = groupSum(d.expenses, 'category');
  const baseCategories = state.expenseCategories.length
    ? state.expenseCategories
    : [
        { name: 'Combustível' },
        { name: 'Alimentação' },
        { name: 'Lavagem' },
        { name: 'Outro' }
      ];
  const knownNames = new Set(baseCategories.map(item => item.name));
  const extraCategories = Object.keys(grouped)
    .filter(name => !knownNames.has(name))
    .map(name => ({ name }));
  const categories = [...baseCategories, ...extraCategories]
    .map(cat => ({ ...cat, value: Number(grouped[cat.name] || 0) }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return String(a.name).localeCompare(String(b.name), 'pt-BR');
    });

  return `
    <section class="weekly-expense-section">
      <div class="weekly-section-band red">Despesas</div>
      <div class="weekly-table-wrap">
        <table class="weekly-expense-table">
          <thead>
            <tr>
              <th>Tipo de despesa</th>
              <th>Valor</th>
              <th>% Desp. vs Geral</th>
              <th>% Desp. vs Faturamento</th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(item => `
              <tr>
                <td class="name-cell">${item.name}</td>
                <td class="value-cell">${formatCurrency(item.value)}</td>
                <td class="value-cell">${percent(item.value, d.costs)}%</td>
                <td class="value-cell">${percent(item.value, d.revenue)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}


function weeklyBarChart(series, title, key) {
  const values = series.map(item => Math.max(0, Number(item[key] || 0)));
  const max = Math.max(...values, 1);
  return `<section class="weekly-chart-section">
      <div class="weekly-chart-title">${title}</div>
      <div class="weekly-divider"></div>
      <div class="weekly-bar-chart" role="img" aria-label="${title}">
        ${series.map(item => {
          const value = Math.max(0, Number(item[key] || 0));
          const height = Math.max(value ? 18 : 0, Math.round((value / max) * 185));
          return `<div class="weekly-bar-col">
            <div class="weekly-bar-track">
              <span style="height:${height}px">
                <b class="weekly-bar-value">${shortMoney(value)}</b>
              </span>
            </div>
            <div class="weekly-bar-label">${item.label}</div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
}

function weeklyLineChart(series, title, key, color, percentMode = false) {
  const values = series.map(item => Number(item[key] || 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, percentMode ? 100 : 0, 1);
  const range = max - min || 1;
  const chartWidth = Math.max(640, 80 + Math.max(1, series.length) * 92);
  const points = series.map((item, index) => {
    const x = 40 + index * 92;
    const y = 180 - ((Number(item[key] || 0) - min) / range) * 140;
    return { ...item, x, y };
  });

  return `<section class="weekly-chart-section">
      <div class="weekly-chart-title">${title}</div>
      <div class="weekly-divider"></div>
      <div class="weekly-line-wrap scrollable-chart">
        <svg viewBox="0 0 ${chartWidth} 210" class="weekly-line-svg" style="width:${chartWidth}px!important;min-width:${chartWidth}px!important;max-width:none!important" role="img" aria-label="${title}">
          <line x1="20" y1="180" x2="${chartWidth - 20}" y2="180" stroke="${color}" stroke-width="2" opacity="0.55"></line>
          <path d="${buildPath(points)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
          ${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="7" style="fill:var(--surface)" stroke="${color}" stroke-width="4"></circle>`).join('')}
          ${points.map(point => `<text x="${point.x}" y="${point.y - 14}" text-anchor="middle" fill="${color}" font-size="12" font-weight="700">${percentMode ? `${Math.round(point[key])}%` : shortMoney(point[key])}</text>`).join('')}
          ${points.map(point => `<text x="${point.x}" y="200" text-anchor="middle" style="fill:var(--muted)" font-size="13" font-weight="700">${percentMode ? point.labelUpper : point.label}</text>`).join('')}
        </svg>
      </div>
    </section>`;
}
function buildPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function shortMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return 'R$ -';
  return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ringChart(items, centerText) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  let cursor = 0;
  const gradient = items.map((item, index) => {
    const size = (Number(item.value || 0) / total) * 100;
    const start = cursor;
    const end = cursor + size;
    cursor = end;
    const color = item.color || palette[index % palette.length];
    return `${color} ${start}% ${end}%`;
  }).join(', ');

  return `
    <div class="ring-block-ref weekly-ring-block">
      <div class="ring-chart-ref weekly-ring-chart" style="background:conic-gradient(${gradient || '#2b2b2b 0 100%'})">
        <div class="ring-hole-ref weekly-ring-hole">${centerText || `${total ? 100 : 0}%`}</div>
      </div>
      <div class="ring-legend-ref weekly-ring-legend">
        ${items.map((item, index) => `<span><i style="background:${item.color || palette[index % palette.length]}"></i>${percent(item.value, total)}%</span>`).join('')}
      </div>
    </div>
  `;
}

function getWeeklySeries(data) {
  const { start, end } = getPeriodRange('weekly');
  const entriesByDate = mapByDate(data.entries);
  const expensesByDate = mapByDate(data.expenses);
  const dailyGoal = safeDivide(data.goal, 7);

  const series = Array.from({ length: 7 }, (_, index) => ({
    label: weekdayShort[index],
    labelUpper: weekdayUpper[index],
    date: '',
    revenue: 0,
    costs: 0,
    balance: 0,
    performance: 0
  }));

  for (let current = new Date(start); current < end; current.setDate(current.getDate() + 1)) {
    const iso = toISODate(current);
    const weekdayIndex = (current.getDay() + 6) % 7;
    const entryItems = entriesByDate[iso] || [];
    const expenseItems = expensesByDate[iso] || [];
    const revenue = sumValue(entryItems);
    const costs = sumValue(expenseItems);

    series[weekdayIndex].date = iso;
    series[weekdayIndex].revenue += revenue;
    series[weekdayIndex].costs += costs;
  }

  return series.map(item => {
    const balance = item.revenue - item.costs;
    return {
      ...item,
      balance,
      performance: dailyGoal ? Math.round((balance / dailyGoal) * 100) : 0
    };
  });
}

function getMonthlyDailySeries(data) {
  const totalDays = new Date(state.selectedYear, state.selectedMonth + 1, 0).getDate();
  const entriesByDate = mapByDate(data.entries);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(state.selectedYear, state.selectedMonth, index + 1);
    const iso = toISODate(date);
    const revenue = sumValue(entriesByDate[iso] || []);
    return { label: index + 1, revenue };
  });
}

function getMonthlyWeekSeries(data) {
  const weeks = getWeeksInMonth(state.selectedYear, state.selectedMonth);
  const entriesByDate = mapByDate(data.entries);
  const expensesByDate = mapByDate(data.expenses);
  const weeklyGoal = safeDivide(data.goal, weeks.length || 1);

  return weeks.map(weekInfo => {
    let revenue = 0;
    let costs = 0;

    const totalDays = new Date(state.selectedYear, state.selectedMonth + 1, 0).getDate();
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(state.selectedYear, state.selectedMonth, day);
      if (getWeekNumber(date) !== Number(weekInfo.week)) continue;
      const iso = toISODate(date);
      revenue += sumValue(entriesByDate[iso] || []);
      costs += sumValue(expensesByDate[iso] || []);
    }

    return {
      label: `Sem${weekInfo.week}`,
      labelUpper: `SEM${weekInfo.week}`,
      week: weekInfo.week,
      revenue,
      costs,
      balance: revenue - costs,
      performance: weeklyGoal ? Math.round(((revenue - costs) / weeklyGoal) * 100) : 0
    };
  });
}

function monthlyDailyRevenueChart(series) {
  const max = Math.max(...series.map(item => Number(item.revenue || 0)), 1);
  return `
    <section class="monthly-chart-section">
      <div class="monthly-chart-title">Faturamento Diário</div>
      <div class="weekly-divider"></div>
      <div class="monthly-day-scroll">
        <div class="monthly-day-bars" style="grid-template-columns:repeat(${series.length}, 54px)">
          ${series.map(item => {
            const value = Number(item.revenue || 0);
            const height = Math.max(value ? 18 : 4, (value / max) * 175);
            return `
            <div class="monthly-day-col">
              <div class="monthly-day-track">
                <span style="height:${height}px">
                  <b class="monthly-day-value">${value > 0 ? shortMoney(value) : 'R$ 0'}</b>
                </span>
              </div>
              <div class="monthly-day-label">${item.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function monthlyRevenueVsExpensesChart(series) {
  const max = Math.max(...series.flatMap(item => [Number(item.revenue || 0), Number(item.costs || 0)]), 1);
  return `
    <section class="monthly-chart-section">
      <div class="monthly-chart-title">Faturamento vs Despesas por Semana</div>
      <div class="weekly-divider"></div>
      <div class="monthly-scroll-shell">
        <div class="monthly-weeks-grid">
          ${series.map(item => {
            const revenue = Number(item.revenue || 0);
            const costs = Number(item.costs || 0);
            const revenueHeight = Math.max(revenue ? 18 : 4, (revenue / max) * 190);
            const costHeight = Math.max(costs ? 18 : 4, (costs / max) * 190);
            return `
            <div class="monthly-week-col">
              <div class="monthly-week-track">
                <span class="bar revenue" style="height:${revenueHeight}px"><b class="monthly-week-value">${revenue > 0 ? shortMoney(revenue) : 'R$ 0'}</b></span>
                <span class="bar expense" style="height:${costHeight}px"><b class="monthly-week-value">${costs > 0 ? shortMoney(costs) : 'R$ 0'}</b></span>
              </div>
              <div class="monthly-week-label">${item.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function mapByDate(items) {
  return items.reduce((acc, item) => {
    const key = item.date || '';
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function sumValue(items) {
  return items.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function progressPercent(value, total) {
  return Math.min(100, Math.max(0, percent(Number(value || 0), Number(total || 0))));
}

function targetPerDayLabel(pendingValue, remainingDays) {
  if (remainingDays <= 0) return pendingValue > 0 ? 'Período encerrado' : formatCurrencyFull(0);
  return formatCurrency(safeDivide(pendingValue, remainingDays));
}


function getYearlyMonthSeries(data) {
  const entriesByMonth = groupByMonth(data.entries);
  const expensesByMonth = groupByMonth(data.expenses);
  const monthlyGoal = safeDivide(data.goal, 12);

  return monthNames.map((name, index) => {
    const revenue = sumValue(entriesByMonth[index] || []);
    const costs = sumValue(expensesByMonth[index] || []);
    return {
      label: name,
      labelUpper: name,
      month: index,
      revenue,
      costs,
      balance: revenue - costs,
      performance: monthlyGoal ? Math.round(((revenue - costs) / monthlyGoal) * 100) : 0
    };
  });
}

function getYearlyWeekSeries(data) {
  const entriesByWeek = groupByWeek(data.entries);
  const expensesByWeek = groupByWeek(data.expenses);
  const weeklyGoal = safeDivide(data.goal, 53);

  return Array.from({ length: 53 }, (_, index) => {
    const week = index + 1;
    const revenue = sumValue(entriesByWeek[week] || []);
    const costs = sumValue(expensesByWeek[week] || []);
    return {
      label: `Sem${week}`,
      labelUpper: `SEM${week}`,
      week,
      revenue,
      costs,
      balance: revenue - costs,
      performance: weeklyGoal ? Math.round(((revenue - costs) / weeklyGoal) * 100) : 0
    };
  });
}

function groupByMonth(items) {
  return items.reduce((acc, item) => {
    const date = new Date(`${item.date}T00:00:00`);
    const month = date.getMonth();
    acc[month] = acc[month] || [];
    acc[month].push(item);
    return acc;
  }, {});
}

function groupByWeek(items) {
  return items.reduce((acc, item) => {
    const date = new Date(`${item.date}T00:00:00`);
    const week = getWeekNumber(date);
    acc[week] = acc[week] || [];
    acc[week].push(item);
    return acc;
  }, {});
}

function yearlyRevenueVsExpensesChart(series) {
  const max = Math.max(...series.flatMap(item => [Number(item.revenue || 0), Number(item.costs || 0)]), 1);
  return `
    <section class="yearly-chart-section">
      <div class="monthly-chart-title">Entradas x Saídas - Mês</div>
      <div class="weekly-divider"></div>
      <div class="yearly-month-scroll">
        <div class="yearly-month-bars">
          ${series.map(item => {
            const revenue = Number(item.revenue || 0);
            const costs = Number(item.costs || 0);
            const revenueHeight = Math.max(revenue ? 18 : 4, (revenue / max) * 175);
            const costHeight = Math.max(costs ? 18 : 4, (costs / max) * 175);
            return `
            <div class="yearly-month-col">
              <div class="yearly-month-track">
                <span class="bar revenue" style="height:${revenueHeight}px"><b class="yearly-month-value">${revenue > 0 ? shortMoney(revenue) : 'R$ 0'}</b></span>
                <span class="bar expense" style="height:${costHeight}px"><b class="yearly-month-value">${costs > 0 ? shortMoney(costs) : 'R$ 0'}</b></span>
              </div>
              <div class="yearly-month-label">${item.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function yearlyWeekRevenueChart(series) {
  const max = Math.max(...series.map(item => Number(item.revenue || 0)), 1);
  return `
    <section class="yearly-chart-section">
      <div class="monthly-chart-title">Faturamento Semanas</div>
      <div class="weekly-divider"></div>
      <div class="yearly-week-scroll">
        <div class="yearly-week-bars" style="grid-template-columns:repeat(${series.length}, 56px)">
          ${series.map(item => {
            const revenue = Number(item.revenue || 0);
            const height = Math.max(revenue ? 18 : 4, (revenue / max) * 170);
            return `
            <div class="yearly-week-col">
              <div class="yearly-week-track">
                <span style="height:${height}px"><b class="yearly-week-value">${revenue > 0 ? shortMoney(revenue) : 'R$ 0'}</b></span>
              </div>
              <div class="yearly-week-label">${item.label}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function syncSelectionModalScrollLock() {
  const hasOpenModal = !!document.querySelector('.selection-modal-overlay:not(.hidden)');
  document.documentElement.classList.toggle('selection-modal-open', hasOpenModal);
  document.body.classList.toggle('selection-modal-open', hasOpenModal);
}

function toggleSelectionModal(selector, open) {
  const modal = document.querySelector(selector);
  if (!modal) return;
  modal.classList.toggle('hidden', !open);
  syncSelectionModalScrollLock();
}

document.addEventListener('click', event => {
  if (event.target.matches('[data-week-picker], [data-month-picker], [data-year-picker]')) {
    event.target.classList.add('hidden');
    syncSelectionModalScrollLock();
    return;
  }

  const openWeek = event.target.closest('[data-week-open]');
  if (openWeek) toggleSelectionModal('[data-week-picker]', true);

  if (event.target.closest('[data-week-close]')) {
    toggleSelectionModal('[data-week-picker]', false);
  }

  const weekOption = event.target.closest('[data-week-option]');
  if (weekOption) {
    state.selectedWeek = Number(weekOption.dataset.weekOption);
    if (weekOption.dataset.weekMonth !== undefined) state.selectedMonth = Number(weekOption.dataset.weekMonth);
    state.selectedDate = getISOWeekStart(Number(state.selectedYear), Number(state.selectedWeek));
    toggleSelectionModal('[data-week-picker]', false);
    window.RodaPayRender?.();
  }

  const openMonth = event.target.closest('[data-month-open]');
  if (openMonth) toggleSelectionModal('[data-month-picker]', true);

  if (event.target.closest('[data-month-close]')) {
    toggleSelectionModal('[data-month-picker]', false);
  }

  const monthOption = event.target.closest('[data-month-option]');
  if (monthOption) {
    state.selectedMonth = Number(monthOption.dataset.monthOption);
    state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), 1);
    toggleSelectionModal('[data-month-picker]', false);
    window.RodaPayRender?.();
  }

  const openYear = event.target.closest('[data-year-open]');
  if (openYear) toggleSelectionModal('[data-year-picker]', true);

  if (event.target.closest('[data-year-close]')) {
    toggleSelectionModal('[data-year-picker]', false);
  }

  const yearOption = event.target.closest('[data-year-option]');
  if (yearOption) {
    state.selectedYear = Number(yearOption.dataset.yearOption);
    if (state.period === 'daily') state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), state.selectedDate.getDate());
    if (state.period === 'monthly') state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), 1);
    if (state.period === 'weekly') {
      state.selectedMonth = getMonthFromWeek(Number(state.selectedYear), Number(state.selectedWeek));
      state.selectedDate = getISOWeekStart(Number(state.selectedYear), Number(state.selectedWeek));
    }
    toggleSelectionModal('[data-year-picker]', false);
    window.RodaPayRender?.();
  }
});
