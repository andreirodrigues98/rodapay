import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('refinements.css');
const app = read('app.js');
const transactions = read('transactions.js');
const utils = read('utils.js');

test('a última folha de estilos é publicada com versão nova e contém o gradiente enviado', () => {
  assert.match(html, /premium\.css\?v=9\.4\.3/);
  assert.match(html, /refinements\.css\?v=9\.4\.5/);
  assert.ok(existsSync(new URL('../img/rodapay-gradient.webp', import.meta.url)));
  assert.match(css, /url\("img\/rodapay-gradient\.webp"\)/);
  assert.ok(existsSync(new URL('../dist-public/refinements.css', import.meta.url)));
  assert.ok(existsSync(new URL('../dist-public/img/rodapay-gradient.webp', import.meta.url)));
});

test('filtros de período e datas do Safari ficam em coluna no mobile', () => {
  assert.match(css, /history-filter-top\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /history-filter-pills\s*\{[\s\S]*?repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(css, /history-filter-pill:nth-child\(5\)/);
  assert.match(css, /history-custom-range\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /-webkit-date-and-time-value/);
  assert.match(css, /font-size:16px!important/);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
});

test('a navegação mostra Jornada ativa, inclusive após renderizações', () => {
  assert.match(app, /viewId === 'drivingView' && button\.hasAttribute\('data-open-driving'\)/);
  assert.match(app, /syncActiveNavigation\(state\.currentView\)/);
  assert.match(app, /syncActiveNavigation\(viewId\)/);
  assert.match(css, /\.bottom-nav \.nav-item\.active:not\(\.nav-primary-action\)/);
  assert.equal((app.match(/document\.querySelectorAll\('\[data-open-driving\]'\)\.forEach\(/g) || []).length, 1);
});

test('anexo da despesa oferece upload de galeria e câmera separadamente', () => {
  assert.match(transactions, /name="receiptFile"[^>]+type="file"/);
  assert.match(transactions, /name="receiptCamera"[^>]+capture="environment"/);
  assert.match(transactions, /data-remove-receipt/);
  assert.match(transactions, /refreshReceipt\(base64, file\.name/);
  assert.match(transactions, /receiptValue\.value = ''/);
  assert.match(transactions, /receipt: form\.receiptBase64\.value/);
});

test('foto grande é reduzida no navegador e mantém formato seguro para Firestore', () => {
  assert.match(utils, /export async function imageToBase64/);
  assert.match(utils, /file\.size > 20 \* 1024 \* 1024/);
  assert.match(utils, /canvas\.toDataURL\('image\/jpeg', quality\)/);
  assert.match(utils, /result\.length <= 500000 && safeImageSource\(result\)/);
  assert.match(utils, /URL\.revokeObjectURL\(url\)/);
});

test('checkboxes padronizados não substituem o switch das origens', () => {
  assert.match(css, /\.legal-check,\.manual-duplicate-notice label,\.check-row/);
  assert.match(css, /input\[type=checkbox\]:checked/);
  assert.doesNotMatch(css, /\.origin-visibility-control input\[type=checkbox\]/);
});
