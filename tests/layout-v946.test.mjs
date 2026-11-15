import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {compactPickerValue} from '../picker-ui.js';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('datas e meses são curtos para iPhone, sem modificar o valor real do input', () => {
  assert.equal(compactPickerValue('date', '2026-11-15'), '15/11/2026');
  assert.equal(compactPickerValue('month', '2026-11'), '11/2026');
  assert.equal(compactPickerValue('time', '08:05'), '08:05');
  assert.equal(compactPickerValue('datetime-local', '2026-11-15T22:45'), '15/11/2026 22:45');
  assert.equal(compactPickerValue('date', ''), 'Selecionar data');
});

test('seletores nativos são aprimorados em qualquer tela sem mudar seu tipo ou eventos', () => {
  const picker = read('picker-ui.js');
  assert.match(picker, /MutationObserver/);
  assert.match(picker, /input\[type="date"\],input\[type="month"\],input\[type="time"\]/);
  assert.match(picker, /closest\('\.rp-picker-ui,\.history-date-input'\)/);
  assert.match(picker, /input\.addEventListener\('change', refresh\)/);
  assert.ok(!/setAttribute\(['"]type['"]/.test(picker));
  assert.match(read('index.html'), /picker-ui\.js\?v=9\.4\.6/);
  assert.ok(existsSync(new URL('../dist-public/picker-ui.js',import.meta.url)));
});

test('cores de semana e ano e seletores ativos ficam dentro da identidade RodaPay', () => {
  const css = read('refinements.css');
  assert.match(css, /#dashboardContent \.yearly-tax-content/);
  assert.match(css, /#dashboardContent \.yearly-tax-icon/);
  assert.match(css, /background:rgba\(232,80,2,\.14\)!important/);
  assert.match(css, /\.year-picker-option\)\.active/);
  assert.match(css, /background:#E85002!important/);
});

test('toast fica acima da navegação inferior e da jornada no iPhone', () => {
  const css = read('refinements.css');
  assert.match(css, /#toast\.toast\s*\{[\s\S]*?z-index:230!important/);
  assert.match(css, /bottom:calc\(120px \+ env\(safe-area-inset-bottom,0px\)\)!important/);
  assert.match(css, /driving-floating-status:not\(\.hidden\)\) #toast\.toast/);
});
