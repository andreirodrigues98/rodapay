import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../admin/online/public/index.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../admin/online/public/painel.js', import.meta.url), 'utf8');
const worker = await readFile(new URL('../admin/online/worker.mjs', import.meta.url), 'utf8');

test('Admin mostra feedback de autenticação visível na tela de login', () => {
  assert.match(page, /id="loginFeedback"/);
  assert.match(page, /src="\/login-guard\.js"/);
  assert.match(client, /loginFeedback\(error\.message/);
  assert.doesNotMatch(client, /form\.elements\.password\.value='';notice\(''\)/);
});
test('Worker entrega o diagnóstico de login', () => {
  assert.match(worker, /'\/login-guard\.js'/);
});
