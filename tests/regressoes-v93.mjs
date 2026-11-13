import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = {scrollY:0};
const { state, availableRideOrigins } = await import('../utils.js');
const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('botão Corrida nunca apaga a seção ativa ao iniciar um formulário', () => {
  const html = source('index.html');
  const app = source('app.js');
  assert.match(html, /class="nav-item nav-primary-action"[^>]*data-new-ride/);
  assert.match(app, /document\.querySelectorAll\('\.nav-item\[data-view\]'\)/);
  assert.match(app, /const target = document\.getElementById\(viewId\)/);
  assert.match(app, /if \(!target\?\.classList\.contains\('screen'\)\) return;/);
});

test('formulário usa imagens dos quatro aplicativos sem repetir nome visível', () => {
  const trx = source('transactions.js');
  assert.match(trx, /ride-origin-choice-logo/);
  assert.match(trx, /alt="\$\{escapeHtml\(origin\.name\)\}"/);
  assert.doesNotMatch(trx, /<span class="ride-origin-name">\$\{escapeHtml\(origin\.name\)\}<\/span><\/label>/);
});

test('origens padrão são selecionáveis e respeitam o valor salvo', () => {
  const values = availableRideOrigins([{ id:'origin_uber', name:'Uber', selected:false }]);
  assert.equal(values[0].selected, false);
  assert.equal(values[1].selected, true);
  assert.equal(values.length,4);
  const config=source('settings.js');
  assert.match(config, /data-origin-name/);
  assert.match(config, /selectedCount >= 5/);
});

test('app público não inclui criação de conta de teste nem aviso técnico', () => {
  assert.doesNotMatch(source('index.html'), /id="createTestAccount"|id="localDevBanner"/);
  assert.doesNotMatch(source('app.js'), /createDevelopmentAccount/);
  assert.equal(state.settings.themePreference,'dark');
});

test('indicador de jornada utiliza a altura real da barra inferior', () => {
  assert.match(source('driving.js'), /getBoundingClientRect\(\)/);
  assert.match(source('premium.css'), /--rp-nav-bottom/);
});
