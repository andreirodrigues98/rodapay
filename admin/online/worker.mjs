/**
 * RodaPay Admin ONLINE — Worker separado do aplicativo dos motoristas.
 * Autenticação: ID token Firebase validado criptograficamente + ADMIN_UID fixado
 * como secret do Worker, mais checagem de usuário ativo/revogação no Firebase Auth.
 * Credencial de serviço: SOMENTE no secret FIREBASE_SERVICE_ACCOUNT, nunca no build.
 * Não distribui nem publica este arquivo como asset estático.
 */
import { validateUid, validateEmail } from '../security.mjs';

const SIGNING_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_WEB_API_KEY = 'AIzaSyCLNcnXs-T8Y-9xaRZS2vkCEtK3Gz8eLPk'; // Configuração web pública, NÃO é uma chave de serviço.
const MAX_BODY = 8192;
let keysCache = null;
let tokenCache = null;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unbase64 = value => {
  if (!/^[\w-]+$/.test(value) || value.length > 8192) throw new Error('Token inválido.');
  const s = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
};
const parseJwt = value => JSON.parse(dec.decode(unbase64(value)));
const prettyIso = ms => Number(ms) > 0 ? new Date(Number(ms)).toISOString() : '';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' } });
const fail = (status, error) => json({ error }, status);

function configuration(env) {
  const project = env.FIREBASE_PROJECT_ID;
  if (project !== 'rodapay-c5490') throw new Error('Projeto Firebase não permitido.');
  const uid = validateUid(env.ADMIN_UID);
  if (!uid || !env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Secrets administrativos ausentes.');
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (account.type !== 'service_account' || account.project_id !== project || !account.client_email || !account.private_key) {
    throw new Error('Service account inválida ou de outro projeto.');
  }
  return { project, uid, account };
}

async function verifyFirebaseIdToken(token, project) {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 12000) throw new Error('Token inválido.');
  const [head64, body64, signature64] = parts;
  const header = parseJwt(head64), claim = parseJwt(body64);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256 ||
    claim.aud !== project || claim.iss !== `https://securetoken.google.com/${project}` ||
    typeof claim.sub !== 'string' || !claim.sub || claim.sub.length > 128 ||
    !Number.isFinite(claim.exp) || !Number.isFinite(claim.iat) || !Number.isFinite(claim.auth_time) ||
    claim.exp <= Date.now() / 1000 || claim.iat > Date.now() / 1000 + 60 || claim.auth_time > Date.now() / 1000 + 60) {
    throw new Error('Token inválido.');
  }
  if (!keysCache || keysCache.expires < Date.now()) {
    const response = await fetch(SIGNING_KEYS);
    if (!response.ok) throw new Error('Não foi possível validar a assinatura do Firebase.');
    const data = await response.json();
    keysCache = { keys: data.keys || [], expires: Date.now() + 30 * 60 * 1000 };
  }
  let jwk = keysCache.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) {
    // Renovação de chave do Firebase: reconsultar imediatamente se o kid mudou.
    keysCache = null;
    const response = await fetch(SIGNING_KEYS);
    if (!response.ok) throw new Error('Não foi possível validar a assinatura do Firebase.');
    const data = await response.json();
    keysCache = { keys: data.keys || [], expires: Date.now() + 30 * 60 * 1000 };
    jwk = keysCache.keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  }
  if (!jwk) throw new Error('Token inválido.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unbase64(signature64), enc.encode(`${head64}.${body64}`));
  if (!valid) throw new Error('Token inválido.');
  return claim;
}

async function accessToken(account) {
  if (tokenCache?.account === account.client_email && tokenCache?.expires > Date.now()) return tokenCache.value;
  const cleanPem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const privateKey = Uint8Array.from(atob(cleanPem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', privateKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ iss: account.client_email, sub: account.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: TOKEN_URL, iat: now, exp: now + 3600 })));
  const signature = b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${body}`))));
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${body}.${signature}` }) });
  if (!response.ok) throw new Error('Credencial Google sem acesso. Confira IAM do Firebase.');
  const result = await response.json();
  if (!result.access_token) throw new Error('Google não forneceu autorização.');
  tokenCache = { account: account.client_email, value: result.access_token, expires: Date.now() + Math.min(3300, Number(result.expires_in || 3600) - 120) * 1000 };
  return result.access_token;
}

async function google(url, account, { method = 'GET', data } = {}) {
  const token = await accessToken(account);
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  if (response.status === 404) return null;
  if (!response.ok) {
    // Não exponha payload de erro do Google (pode conter detalhes internos).
    console.error('RodaPay Admin API Google:', response.status, new URL(url).hostname);
    const error = new Error(response.status === 403 ? 'Permissão insuficiente da conta de serviço.' : 'Serviço Google não concluiu a operação.');
    error.status = response.status; throw error;
  }
  return response.status === 204 ? {} : response.json();
}
const authUrl = (cfg, action) => `https://identitytoolkit.googleapis.com/v1/projects/${cfg.project}/accounts${action}`;
const fsRoot = cfg => `https://firestore.googleapis.com/v1/projects/${cfg.project}/databases/(default)/documents`;
const s = value => ({ stringValue: String(value || '') });
const bool = value => ({ booleanValue: Boolean(value) });
const field = (doc, name) => doc?.fields?.[name];
const toUser = (account, doc) => ({
  uid: account.localId,
  email: account.email || 'Sem e-mail',
  createdAt: prettyIso(account.createdAt),
  lastLogin: prettyIso(account.lastLoginAt),
  disabled: Boolean(account.disabled || field(doc, 'active')?.booleanValue === false),
  authDisabled: Boolean(account.disabled),
  profileBlocked: field(doc, 'active')?.booleanValue === false,
  initialized: Boolean(doc),
  accepted: Boolean(field(doc, 'legalVersion')?.stringValue && field(doc, 'legalAcceptedAt'))
});
async function docGet(cfg, id) { return google(`${fsRoot(cfg)}/users/${encodeURIComponent(validateUid(id))}`, cfg.account); }
async function accountGet(cfg, id) {
  const result = await google(authUrl(cfg, ':lookup'), cfg.account, { method: 'POST', data: { localId: [validateUid(id)] } });
  return result?.users?.[0] || null;
}
async function audit(cfg, action, uid, details = '') {
  try {
    await google(`${fsRoot(cfg)}/adminAuditLogs`, cfg.account, { method: 'POST', data: { fields: {
      action: s(action), uid: s(uid), details: s(String(details).slice(0, 240)), source: s('painel-online-vora'), at: { timestampValue: new Date().toISOString() }
    } } });
    return true;
  } catch (error) { console.error('RodaPay Admin: auditoria falhou após ação', action, error.status || 'indisponível'); return false; }
}
async function listUsers(cfg, cursor) {
  if (cursor && (cursor.length > 2048 || !/^[A-Za-z0-9_+=/.-]+$/.test(cursor))) throw new Error('Paginação inválida.');
  const q = new URLSearchParams({ maxResults: '50' });
  if (cursor) q.set('nextPageToken', cursor);
  const result = await google(`${authUrl(cfg, ':batchGet')}?${q}`, cfg.account);
  const users = await Promise.all((result.users || []).map(async account => {
    let doc = null;
    try { doc = await docGet(cfg, account.localId); } catch { /* mantém Auth visível */ }
    return toUser(account, doc);
  }));
  return { users, nextCursor: result.nextPageToken || null };
}
async function readAudit(cfg, uid) {
  uid = validateUid(uid);
  const result = await google(`${fsRoot(cfg)}:runQuery`, cfg.account, { method: 'POST', data: { structuredQuery: {
    from: [{ collectionId: 'adminAuditLogs' }],
    where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: s(uid) } }, limit: 50
  } } });
  return { events: (Array.isArray(result) ? result : []).filter(x => x.document).map(x => ({
    action: field(x.document, 'action')?.stringValue || '',
    date: field(x.document, 'at')?.timestampValue || '',
    source: field(x.document, 'source')?.stringValue || ''
  })).sort((a, b) => b.date.localeCompare(a.date)) };
}
async function updateActive(cfg, uid, value) {
  await google(`${fsRoot(cfg)}/users/${uid}?updateMask.fieldPaths=active&currentDocument.exists=true`, cfg.account, { method: 'PATCH', data: { fields: { active: bool(value) } } });
}
async function suspension(cfg, uid, suspend) {
  uid = validateUid(uid);
  if (uid === cfg.uid) throw new Error('Não é permitido suspender a conta administradora.');
  const account = await accountGet(cfg, uid);
  if (!account) throw new Error('Conta não encontrada.');
  const profile = await docGet(cfg, uid);
  if (suspend) {
    if (profile) await updateActive(cfg, uid, false);
    await google(authUrl(cfg, ':update'), cfg.account, { method: 'POST', data: { localId: uid, disableUser: true } });
  } else {
    // Mantém o bloqueio no perfil até a atualização de Auth ser concluída.
    await google(authUrl(cfg, ':update'), cfg.account, { method: 'POST', data: { localId: uid, disableUser: false } });
    if (profile) await updateActive(cfg, uid, true);
  }
  return { uid, disabled: suspend, profileExists: Boolean(profile), audited: await audit(cfg, suspend ? 'suspend' : 'reactivate', uid, account.email) };
}
function initialDoc(email, disabled = false) {
  const time = { timestampValue: new Date().toISOString() };
  return { fields: {
    email: s(email), active: bool(!disabled), seededDefaults: bool(false), createdAt: time, updatedAt: time,
    settings: { mapValue: { fields: { incomeTaxRate: { doubleValue: 0.6 }, lightMode: bool(false), themePreference: s('dark') } } }
  } };
}
async function provision(cfg, uid) {
  uid = validateUid(uid);
  if (uid === cfg.uid) throw new Error('A conta administradora não precisa de preparação comercial.');
  const account = await accountGet(cfg, uid);
  if (!account) throw new Error('Conta não encontrada.');
  if (await docGet(cfg, uid)) throw new Error('A conta já está preparada.');
  await google(`${fsRoot(cfg)}/users?documentId=${encodeURIComponent(uid)}`, cfg.account, { method: 'POST', data: initialDoc(account.email, account.disabled) });
  return { uid, initialized: true, audited: await audit(cfg, 'provision-existing', uid, account.email) };
}
async function create(cfg, email) {
  email = validateEmail(email);
  const random = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const created = await google(`https://identitytoolkit.googleapis.com/v1/projects/${cfg.project}/accounts?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, cfg.account, { method: 'POST', data: { email, password: random, emailVerified: false, disabled: false } });
  const uid = validateUid(created.localId);
  try {
    await google(`${fsRoot(cfg)}/users?documentId=${encodeURIComponent(uid)}`, cfg.account, { method: 'POST', data: initialDoc(email) });
  } catch (error) {
    // Em caso de erro de provisionamento, bloqueia a nova conta, sem tocar dados de outras contas.
    try { await google(authUrl(cfg, ':update'), cfg.account, { method: 'POST', data: { localId: uid, disableUser: true } }); } catch { /* mensagem operacional abaixo */ }
    throw new Error('Conta criada no Firebase Auth, mas sem perfil. Revise e use Preparar acesso antes de liberar.');
  }
  let resetSent = false;
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'pt-BR' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
    });
    resetSent = response.ok;
  } catch { /* a conta permanece criada; usuário pode usar recuperação de senha no aplicativo */ }
  return { uid, email, resetSent, audited: await audit(cfg, 'create', uid, email) };
}

async function body(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('Solicitação muito grande.');
  const source = await request.text();
  if (enc.encode(source).length > MAX_BODY) throw new Error('Solicitação muito grande.');
  let obj;
  try { obj = JSON.parse(source); } catch { throw new Error('JSON inválido.'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON inválido.');
  return obj;
}
async function authorized(request, cfg) {
  const match = /^Bearer ([A-Za-z0-9_\-.]+)$/.exec(request.headers.get('Authorization') || '');
  if (!match) return null;
  try {
    const claim = await verifyFirebaseIdToken(match[1], cfg.project);
    if (claim.sub !== cfg.uid) return null;
    const account = await accountGet(cfg, cfg.uid);
    if (!account || account.disabled || Number(account.validSince || 0) > claim.auth_time) return null;
    return { uid: cfg.uid, email: account.email || claim.email };
  } catch (error) { if (error.message?.includes('Permissão insuficiente')) throw error; return null; }
}
function responseWithSecurity(response, html = false) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (html) headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self' https://www.gstatic.com; frame-src https://rodapay-c5490.firebaseapp.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  return new Response(response.body, { status: response.status, headers });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405, 'Método não permitido.');
      if (!['/', '/index.html', '/painel.js', '/login-guard.js'].includes(url.pathname)) return fail(404, 'Não encontrado.');
      const urlAsset = new URL(url.pathname === '/' ? '/index.html' : url.pathname, url.origin);
      const response = await env.ASSETS.fetch(new Request(urlAsset, { method: request.method }));
      return responseWithSecurity(response, url.pathname === '/' || url.pathname === '/index.html');
    }
    if (!['GET', 'POST'].includes(request.method)) return fail(405, 'Método não permitido.');
    // Não existe CORS neste serviço: painel e API sempre na mesma origem.
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return fail(403, 'Origem não autorizada.');
    let cfg;
    try { cfg = configuration(env); } catch (error) { console.error('RodaPay Admin não configurado:', error.message); return fail(503, 'Painel ainda não configurado pelo administrador.'); }
    let actor;
    try { actor = await authorized(request, cfg); } catch (error) { console.error('RodaPay Admin autorização:', error.status || error.message); return fail(503, 'Serviço administrativo indisponível.'); }
    if (!actor) return fail(401, 'Acesso administrativo não autorizado.');
    try {
      if (request.method === 'GET' && url.pathname === '/api/session') return json({ authorized: true, uid: cfg.uid, email: actor.email, project: cfg.project });
      if (request.method === 'GET' && url.pathname === '/api/users') return json(await listUsers(cfg, url.searchParams.get('cursor')));
      if (request.method === 'GET' && url.pathname === '/api/audit') return json(await readAudit(cfg, url.searchParams.get('uid')));
      if (request.method === 'POST') {
        const input = await body(request);
        if (url.pathname === '/api/suspend') return json(await suspension(cfg, input.uid, true));
        if (url.pathname === '/api/reactivate') return json(await suspension(cfg, input.uid, false));
        if (url.pathname === '/api/provision') return json(await provision(cfg, input.uid));
        if (url.pathname === '/api/create') return json(await create(cfg, input.email));
      }
      return fail(404, 'Operação não encontrada.');
    } catch (error) {
      console.error('RodaPay Admin: falha', url.pathname, error.status || error.name);
      const safe = /^(Solicitação|JSON|E-mail|Identificador|Paginação|A conta já|A conta administradora|Conta não encontrada|Não é permitido|Conta criada no Firebase Auth)/.test(error.message);
      return fail(safe ? 400 : 503, safe ? error.message : 'Operação não concluída. Verifique as permissões do serviço administrativo.');
    }
  }
};
