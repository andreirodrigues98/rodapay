import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { sessionActivityKey, readLastActivity, shouldRequireLogin, saveLastActivity, INACTIVITY_LIMIT_MS } from '../session-policy.js';

const load = filename => readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8');
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, val) { values.set(key, val); },
  };
};

test('sete dias sem uso força novo login; acesso recente mantém sessão', () => {
  const storage = memoryStorage();
  const now = Date.UTC(2026, 10, 15, 12);
  assert.equal(readLastActivity(storage, 'usuario-a'), null);
  assert.equal(shouldRequireLogin(readLastActivity(storage, 'usuario-a'), now), false, 'não desconectar usuários existentes na migração');
  saveLastActivity(storage, 'usuario-a', now - INACTIVITY_LIMIT_MS + 1);
  assert.equal(shouldRequireLogin(readLastActivity(storage, 'usuario-a'), now), false);
  saveLastActivity(storage, 'usuario-a', now - INACTIVITY_LIMIT_MS);
  assert.equal(shouldRequireLogin(readLastActivity(storage, 'usuario-a'), now), true);
  saveLastActivity(storage, 'usuario-a', now - INACTIVITY_LIMIT_MS - 1);
  assert.equal(shouldRequireLogin(readLastActivity(storage, 'usuario-a'), now), true);
});

test('último acesso é individual por UID; nenhum dado sensível gravado', () => {
  const storage = memoryStorage();
  saveLastActivity(storage, 'motorista-a', 123456789);
  assert.equal(readLastActivity(storage, 'motorista-a'), 123456789);
  assert.equal(readLastActivity(storage, 'motorista-b'), null);
  assert.match(sessionActivityKey('motorista-a'), /^rodapay\.session\.last-used/);
  assert.equal(shouldRequireLogin(Date.now() + 1000000, Date.now()), true, 'relógio no futuro não cria sessão infinita');
});

test('política não interrompe login por falha no localStorage', () => {
  const storage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  assert.equal(readLastActivity(storage, 'motorista'), null);
  assert.equal(saveLastActivity(storage, 'motorista', Date.now()), false);
});

test('login persiste; mudança de senha encerra sessão; retorno verifica revogação', () => {
  const auth = load('auth.js');
  assert.match(auth, /setPersistence\(auth, browserLocalPersistence\)/);
  assert.match(auth, /await updatePassword\(user, newPassword\);\s*\/\/[^\n]+\n\s*await logoutUser\(\)/);
  assert.match(auth, /await getIdToken\(user, true\)/);
  assert.match(auth, /document\.addEventListener\('visibilitychange'/);
  assert.match(auth, /readLastActivity\(localStorage, user\.uid\)/);
  assert.match(auth, /shouldRequireLogin/);
  assert.match(auth, /sessionReady = false/);
});

test('datas do intervalo exibem DD/MM/AAAA sem perder input date real do iPhone', () => {
  const transactions = load('transactions.js');
  const css = load('refinements.css');
  assert.match(transactions, /compactHistoryDate/);
  assert.match(transactions, /value\.slice\(8,10\)/);
  assert.match(transactions, /historyDateControl\('start','De',historyView\.start\)/);
  assert.match(transactions, /historyDateControl\('end','Até',historyView\.end\)/);
  assert.ok(transactions.includes('data-history-date="${kind}"'));
  assert.match(css, /\.history-date-input input\[type=date\]/);
  assert.match(css, /position:absolute!important/);
  assert.match(css, /\.history-date-value/);
  assert.match(css, /overflow:hidden!important/);
  assert.match(load('index.html'), /refinements\.css\?v=9\.4\.6/);
});

test('distribuição da Cloudflare inclui política de sessão e não inclui ferramentas privadas', () => {
  assert.ok(existsSync(new URL('../dist-public/session-policy.js', import.meta.url)));
  const publishedApp = load('dist-public/app.js');
  const publishedAuth = load('dist-public/auth.js');
  assert.match(publishedApp, /from '\.\/auth\.js\?v=9\.4\.6'/);
  assert.match(publishedAuth, /from '\.\/app\.js\?v=9\.4\.6'/);
  assert.ok(!existsSync(new URL('../dist-public/admin/online/worker.mjs', import.meta.url)));
  assert.ok(!existsSync(new URL('../dist-public/firestore.rules', import.meta.url)));
});
