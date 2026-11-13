// Painel EXCLUSIVAMENTE LOCAL da VORA. Nunca hospede ou faça proxy deste servidor.
// Usa ADC/IAM (produção) ou emuladores (demo); jamais envia credenciais ao navegador.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseMode, allowedHost, allowedOrigin, validateUid, validateEmail, MAX_BODY_BYTES } from './security.mjs';

const root = dirname(fileURLToPath(import.meta.url));
let config;
try {
  config = parseMode(process.env.RODAPAY_ADMIN_MODE, process.env.RODAPAY_ADMIN_PROJECT, process.env.RODAPAY_ADMIN_CONFIRM);
} catch (error) { console.error(error.message); process.exit(1); }
if (config.emulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
} else if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Recusado: produção não pode executar com variáveis de emulador definidas.');
  process.exit(1);
}
const app = initializeApp(config.emulator ? { projectId: config.project } : { credential: applicationDefault(), projectId: config.project });
const auth = getAuth(app);
const db = getFirestore(app);
const loginCode = randomBytes(24).toString('base64url');
const sessionId = randomBytes(32).toString('base64url');
const csrf = randomBytes(32).toString('base64url');
let sessionExpiresAt = 0;
let failedLogins = [];
const timingMatch = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
function headers(res, status = 200, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  });
}
function json(res, status, obj) { headers(res, status); res.end(JSON.stringify(obj)); }
function authorized(req) {
  const cookies = req.headers.cookie || '';
  const token = cookies.split(';').map(s => s.trim()).find(s => s.startsWith('rpa_session='))?.slice('rpa_session='.length) || '';
  return sessionExpiresAt > Date.now() && timingMatch(token, sessionId);
}
function protectedRequest(req) {
  return authorized(req) && req.headers['x-rodapay-csrf'] === csrf && allowedOrigin(req.headers.origin);
}
async function body(req) {
  let size = 0; let source = '';
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Solicitação muito grande.');
    source += chunk.toString('utf8');
  }
  let obj;
  try { obj = JSON.parse(source); } catch { throw new Error('JSON inválido.'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON inválido.');
  return obj;
}
async function audit(action, uid, details = '') {
  try {
    await db.collection('adminAuditLogs').add({ action, uid, details: String(details).slice(0, 240), at: FieldValue.serverTimestamp(), source: 'painel-local-vora' });
    return true;
  } catch (error) {
    console.error('ATENÇÃO: ação executada, mas a auditoria não foi gravada:', error.code || error.message);
    return false;
  }
}
async function listUsers(cursor) {
  const batch = await auth.listUsers(50, cursor || undefined);
  const users = await Promise.all(batch.users.map(async u => {
    let profile = null;
    try { const snap = await db.doc(`users/${u.uid}`).get(); profile = snap.exists ? snap.data() : null; } catch { /* manter visibilidade do Auth */ }
    return {
      uid: u.uid, email: u.email || 'Sem e-mail', createdAt: u.metadata.creationTime || '', lastLogin: u.metadata.lastSignInTime || '',
      disabled: Boolean(u.disabled || profile?.active === false), authDisabled: Boolean(u.disabled), profileBlocked: profile?.active === false,
      initialized: Boolean(profile), accepted: Boolean(profile?.legalVersion && profile?.legalAcceptedAt)
    };
  }));
  return { users, nextCursor: batch.pageToken || null };
}
async function changeSuspension(uid, suspend) {
  uid = validateUid(uid);
  const account = await auth.getUser(uid);
  const docRef = db.doc(`users/${uid}`);
  const snap = await docRef.get();
  if (suspend) {
    if (snap.exists) await docRef.update({ active: false });
    await auth.updateUser(uid, { disabled: true });
  } else {
    await auth.updateUser(uid, { disabled: false });
    if (snap.exists) await docRef.update({ active: true });
  }
  const audited = await audit(suspend ? 'suspend' : 'reactivate', uid, account.email || '');
  return { uid, disabled: suspend, profileExists: snap.exists, audited };
}
function initialUserDocument(user, disabled = false) {
  return {
    email: user.email || '',
    active: !disabled,
    settings: { incomeTaxRate: 0.6, lightMode: false, themePreference: 'dark' },
    seededDefaults: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}
async function provisionAccount(uid) {
  uid = validateUid(uid);
  const user = await auth.getUser(uid);
  const ref = db.doc(`users/${uid}`);
  const existing = await ref.get();
  if (existing.exists) throw new Error('A conta já está preparada.');
  await ref.create(initialUserDocument(user, user.disabled));
  const audited = await audit('provision-existing', uid, user.email || '');
  return { uid, initialized: true, audited };
}
async function createAccount(email) {
  email = validateEmail(email);
  const password = randomBytes(32).toString('base64url');
  const account = await auth.createUser({ email, password, disabled: false, emailVerified: false });
  try {
    // Criação administrativa obrigatória para contas comerciais.
    await db.doc(`users/${account.uid}`).create(initialUserDocument(account));
  } catch (error) {
    try { await auth.deleteUser(account.uid); } catch (rollbackError) {
      console.error('AÇÃO NECESSÁRIA: excluir conta sem registro:', account.uid, rollbackError.code || rollbackError.message);
    }
    throw error;
  }
  let resetLink = '';
  try { resetLink = await auth.generatePasswordResetLink(email); }
  catch (error) { console.error('Conta criada, mas link de acesso indisponível:', error.code || error.message); }
  const audited = await audit('create', account.uid, email);
  return { uid: account.uid, email, resetLink, needsManualReset: !resetLink, audited, ...(config.emulator ? { temporaryPassword: password } : {}) };
}

async function listAudit(uid) {
  const userId = validateUid(uid);
  const snap = await db.collection('adminAuditLogs').where('uid', '==', userId).limit(50).get();
  return snap.docs.map(d => ({ action: d.get('action'), date: d.get('at')?.toDate?.()?.toISOString() || '', source: d.get('source') || '' }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
const panelHtml = await readFile(join(root, 'painel.html'), 'utf8');
const server = http.createServer(async (req, res) => {
  if (!allowedHost(req.headers.host)) { json(res, 403, { error: 'Host não autorizado.' }); return; }
  const url = new URL(req.url, 'http://127.0.0.1:5601');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      headers(res, 200, 'text/html; charset=utf-8'); res.end(panelHtml); return;
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      if (!allowedOrigin(req.headers.origin)) { json(res, 403, { error: 'Origem não autorizada.' }); return; }
      failedLogins = failedLogins.filter(t => Date.now() - t < 60000);
      if (failedLogins.length >= 5) { json(res, 429, { error: 'Muitas tentativas. Reinicie o painel quando necessário.' }); return; }
      const input = await body(req);
      if (!timingMatch(input.code, loginCode)) { failedLogins.push(Date.now()); json(res, 401, { error: 'Código inválido.' }); return; }
      failedLogins = []; sessionExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
      res.setHeader('Set-Cookie', `rpa_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200`);
      json(res, 200, { ok: true }); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/session') {
      json(res, 200, authorized(req) ? { authorized: true, csrf, mode: config.mode, project: config.project } : { authorized: false }); return;
    }
    if (!authorized(req)) { json(res, 401, { error: 'Sessão administrativa inválida.' }); return; }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      if (!protectedRequest(req)) { json(res, 403, { error: 'Permissão inválida.' }); return; }
      sessionExpiresAt = 0;
      res.setHeader('Set-Cookie', 'rpa_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      json(res, 200, { ok: true }); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/users') {
      json(res, 200, await listUsers(url.searchParams.get('cursor'))); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/audit') {
      json(res, 200, { events: await listAudit(url.searchParams.get('uid')) }); return;
    }
    if (req.method === 'POST') {
      if (!protectedRequest(req)) { json(res, 403, { error: 'Origem ou permissão inválida.' }); return; }
      const payload = await body(req);
      if (url.pathname === '/api/suspend' || url.pathname === '/api/reactivate') {
        const op = url.pathname.endsWith('suspend');
        json(res, 200, await changeSuspension(payload.uid, op)); return;
      }
      if (url.pathname === '/api/create') {
        json(res, 200, await createAccount(payload.email)); return;
      }
      if (url.pathname === '/api/provision') {
        json(res, 200, await provisionAccount(payload.uid)); return;
      }
    }
    json(res, 404, { error: 'Operação não encontrada.' });
  } catch (error) {
    const safe = /^(Solicitação|JSON|E-mail|Identificador|A conta já)/.test(error.message);
    console.error('Admin:', error.code || error.message);
    json(res, safe ? 400 : 500, { error: safe ? error.message : 'Operação não concluída. Consulte o terminal do administrador.' });
  }
});
server.listen(5601, '127.0.0.1', () => {
  console.log('\n=== VORA / Administração local do RodaPay ===');
  console.log(`Modo: ${config.mode} | Projeto: ${config.project}`);
  console.log('Abra: http://127.0.0.1:5601');
  console.log(`Código temporário desta execução: ${loginCode}`);
  console.log('O código não é armazenado em disco. Não exponha a porta 5601 na internet.\n');
});
