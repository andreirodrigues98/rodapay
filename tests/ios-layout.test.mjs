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
