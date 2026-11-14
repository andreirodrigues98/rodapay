import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../premium.css', import.meta.url), 'utf8');
const utils = readFileSync(new URL('../utils.js', import.meta.url), 'utf8');
const transactions = readFileSync(new URL('../transactions.js', import.meta.url), 'utf8');

test('modal mobile mantém cabeçalho acessível e conteúdo com rolagem própria', () => {
  assert.match(css, /#formModal \.modal-card\.large\s*\{[\s\S]*?flex-direction:column!important/);
  assert.match(css, /#formModal #formModalContent\s*\{[\s\S]*?overflow-y:auto!important/);
  assert.match(utils, /area\.scrollTop = 0/);
  assert.doesNotMatch(transactions, /name="fare"[^>]*\bautofocus\b/);
});

test('inputs nativos de data e horário ficam em coluna única nos celulares', () => {
  assert.match(css, /#formModal \.ride-basic-meta\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(css, /#formModal \.ride-basic-meta input\[type="date"\]/);
  assert.match(css, /#formModal \.ride-basic-meta input\[type="time"\]/);
});

test('botão restaurar e cronômetro respeitam largura limitada no mobile', () => {
  assert.match(css, /\.suggested-categories-bar button\[data-restore-expense-categories\]\s*\{[\s\S]*?width:100%!important/);
  assert.match(css, /\.driving-floating-status:not\(\.hidden\)\s*\{[\s\S]*?width:min\(226px/);
});

// Regressão: a correção V9.4.2 chegou ao navegador com "\\n\\n" literal.
// Nesse caso o @media não era interpretado como regra de layout, apesar dos testes de texto passarem.
test('CSS mobile tem @media válido sem caracteres de escape literais', () => {
  assert.doesNotMatch(css, /\\n\\n\/\* V9\.4\.2/);
  assert.match(css, /\n\/\* V9\.4\.2 — iPhone:/);
  assert.match(css, /@media \(max-width: 699px\)\s*\{/);
});

test('campos e seletores têm fonte mínima de 16px no Safari, sem bloquear zoom manual', () => {
  const latest = css.slice(css.lastIndexOf('/* V9.4.3'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(latest, /html body :is\(input,select,textarea\):not\(\[type="radio"\]\)/);
  assert.match(latest, /font-size:16px!important/);
  assert.match(latest, /ride-basic-meta\s*,[\s\S]*?movement-detail-grid/);
  assert.match(html, /premium\.css\?v=9\.4\.3/);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
});

test('correção final mantém restaurar, detalhes e jornada compactos no iPhone', () => {
  const latest = css.slice(css.lastIndexOf('/* V9.4.3'));
  assert.match(latest, /suggested-categories-bar button\[data-restore-expense-categories\]/);
  assert.match(latest, /grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(latest, /width:min\(196px,calc\(100vw - 24px\)\)!important/);
});
