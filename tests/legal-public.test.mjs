import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LEGAL_VERSION, hasAcceptedLegal } from '../legal-policy.mjs';
const root = new URL('../', import.meta.url);
const file = name => readFile(new URL(name, root), 'utf8');

test('termos e privacidade possuem páginas próprias acessíveis', async () => {
  const [terms, privacy, login] = await Promise.all([file('termos.html'),file('privacidade.html'),file('index.html')]);
  for (const document of [terms, privacy]) {
    assert.match(document, /<html lang="pt-BR">/);
    assert.match(document, /Versão de 13 de novembro de 2026/);
  }
  assert.match(login, /id="legalAcceptance"/);
  assert.match(login, /id="legalAcknowledgement"/);
  assert.match(login, /href="termos.html"/);
  assert.match(login, /href="privacidade.html"/);
});

test('aceite é versionado e não pode ser inferido de um checkbox vazio', () => {
  assert.equal(LEGAL_VERSION,'2026-11-13');
  assert.equal(hasAcceptedLegal({}), false);
  assert.equal(hasAcceptedLegal({legalVersion: LEGAL_VERSION}),false);
  assert.equal(hasAcceptedLegal({legalVersion:'2026-01-01',legalAcceptedAt:1}),false);
  assert.equal(hasAcceptedLegal({legalVersion:LEGAL_VERSION,legalAcceptedAt:1}),true);
});

test('conjunto público não inclui painel administrativo nem credenciais privadas', async () => {
  const files=await readdir(new URL('../dist-public/',import.meta.url));
  for(const forbidden of ['admin','scripts','tests','.gitignore','firebase.json','firestore.rules','package.json','README.md'])
    assert.equal(files.includes(forbidden), false, forbidden);
  assert.ok(files.includes('termos.html'));
  assert.ok(files.includes('privacidade.html'));
  const html=await file('dist-public/index.html');
  assert.doesNotMatch(html,/id="localDevBanner"/);
  assert.doesNotMatch(html,/id="createTestAccount"/);
});

test('provisionamento é restrito à administração', async () => {
  const rules=await file('firestore.rules');
  assert.match(rules,/allow create: if false;/);
  assert.match(rules,/legalVersion/);
  const server=await file('admin/server.mjs');
  assert.match(server,/initialUserDocument/);
  assert.match(server,/auth\.createUser/);
});
