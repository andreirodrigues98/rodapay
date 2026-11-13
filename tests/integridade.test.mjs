import test from 'node:test';
import assert from 'node:assert/strict';

// Isolated tests of the same pure business helpers used in the browser.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = {};
const { state, getWeekNumber, getMonthFromWeek, getISOWeekStart,
  getWeeksInMonth, getPeriodRange, calculateDashboard, toISODate,
  formatDuration, percent, parseLocalDate, safeImageSource, escapeHtml } = await import('../utils.js');

test('semana do fim do ano ultrapassa 53, sem perder dados anuais', () => {
  const year = 2026;
  const last = getWeekNumber(new Date(year, 11, 31));
  assert.ok(last > 53);
  assert.equal(getMonthFromWeek(year, last), 11);
  assert.equal(toISODate(getISOWeekStart(year, last)), '2026-12-29');
});

test('todas as semanas de cada mes têm numeros exclusivos no ano', () => {
  const numbers = [];
  for (let month = 0; month < 12; month++) {
    for (const entry of getWeeksInMonth(2026, month)) numbers.push(entry.week);
  }
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
});

test('datas são processadas em horário local, sem deslocamento de dia', () => {
  assert.equal(toISODate(parseLocalDate('2026-11-12')), '2026-11-12');
});

test('indicadores financeiros somam entradas e saídas sem perder precisão inteira', () => {
  Object.assign(state, {
    selectedDate: new Date(2026, 10, 12), selectedYear: 2026, selectedMonth: 10,
    entries: [{date:'2026-11-12', value: 350, trips:3, km: 41, minutes: 120}],
    expenses: [{date:'2026-11-12', value: 90}], goals: []
  });
  assert.equal(getPeriodRange('daily').end.getDate(), 13);
  const d = calculateDashboard('daily');
  assert.equal(d.revenue, 350);
  assert.equal(d.costs, 90);
  assert.equal(d.balance, 260);
  assert.equal(d.hours, 2);
});

test('percentual sem base e tempo vazio', () => {
  assert.equal(percent(100, 0), 0);
  assert.equal(formatDuration(3661), '01:01:01');
});


test('texto controlado pelo usuario nao pode criar HTML executavel', () => {
  assert.equal(escapeHtml('<img src=x onerror="boom()">'), '&lt;img src=x onerror=&quot;boom()&quot;&gt;');
  assert.equal(safeImageSource('javascript:alert(1)'), '');
  assert.equal(safeImageSource('data:image/svg+xml,<svg onload="boom()">'), '');
  assert.equal(safeImageSource('img/uber-logo.png'), 'img/uber-logo.png');
});
