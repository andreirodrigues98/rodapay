import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateKeyPairSync, sign as signNode } from 'node:crypto';
import worker from '../admin/online/worker.mjs';

const g = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...g.publicKey.export({ format: 'jwk' }), kid: 'test-kid', alg: 'RS256', use: 'sig' };
const adminId = 'owner-uid-99';
const publicKey = key => Buffer.from(JSON.stringify(key)).toString('base64url');
const jwt = (uid, overrides = {}) => {
  const now = Math.floor(Date.now()/1000);
  const payload = { iss:'https://securetoken.google.com/rodapay-c5490', aud:'rodapay-c5490', sub:uid, auth_time:now, iat:now, exp:now+3600, email:'owner@example.com', ...overrides };
  const unsigned = `${publicKey({alg:'RS256',kid:'test-kid'})}.${publicKey(payload)}`;
  return `${unsigned}.${signNode('RSA-SHA256', Buffer.from(unsigned), g.privateKey).toString('base64url')}`;
};
const serviceKey = g.privateKey.export({ type:'pkcs8',format:'pem' });
const env = {
  FIREBASE_PROJECT_ID:'rodapay-c5490', ADMIN_UID:adminId,
  FIREBASE_SERVICE_ACCOUNT:JSON.stringify({ type:'service_account', project_id:'rodapay-c5490', client_email:'service@rodapay-c5490.iam.gserviceaccount.com', private_key:serviceKey }),
  ASSETS:{ fetch:async()=>new Response('painel seguro', { status:200 }) }
};
const reply = (json, status = 200) => new Response(JSON.stringify(json), { status, headers:{'Content-Type':'application/json'} });
let calls = [];
const originalFetch = globalThis.fetch;
const fakeFetch = async (url, options = {}) => {
  const u = String(url); calls.push({u, options});
  if (u.includes('service_accounts/v1/jwk')) return reply({ keys:[jwk] });
  if (u.includes('/token')) return reply({access_token:'fake-test-oauth', expires_in:3600});
  if (u.includes('/accounts:lookup')) return reply({users:[{localId:adminId,email:'owner@example.com', disabled:false,validSince:'0'}]});
  if (u.includes('/accounts:batchGet')) return reply({users:[{localId:'driver-uid',email:'driver@example.com',createdAt:'1730000000000'}]});
  if (u.includes('/documents/users/driver-uid') && options.method !== 'PATCH') return reply({},404);
  if (u.includes('/accounts:update')) return reply({localId:'driver-uid'});
  if (u.includes('/projects/rodapay-c5490/accounts?key=')) return reply({localId:'new-driver'});
  if (u.includes('/accounts:sendOobCode')) return reply({email:'new-driver@example.com'});
  if (u.includes('/documents/adminAuditLogs')) return reply({name:'audit'});
  return reply({});
};
const req = (path, {token,method='GET',body,origin} = {}) => new Request(`https://rodapay-admin.example.workers.dev${path}`, {
  method, headers:{ ...(token?{Authorization:`Bearer ${token}`} :{}), ...(origin?{Origin:origin}:{}), ...(body?{'Content-Type':'application/json'}:{}) }, ...(body?{body:JSON.stringify(body)}:{})
});

test('sem configuração o Admin não atende API', async () => {
  const res = await worker.fetch(req('/api/session'), { ...env, ADMIN_UID:'' });
  assert.equal(res.status,503);
});
test('sem token, não permite consultar contas', async () => {
  calls=[]; globalThis.fetch=fakeFetch;
  const res = await worker.fetch(req('/api/users'), env);
  assert.equal(res.status,401);assert.equal(calls.length,0);
});
test('token assinado de motorista não concede acesso administrativo', async () => {
  globalThis.fetch=fakeFetch;
  const res = await worker.fetch(req('/api/session',{token:jwt('driver-uid')}), env);
  assert.equal(res.status,401);
});
test('token de outro Firebase falha mesmo com UID de administrador', async () => {
  globalThis.fetch=fakeFetch;
  const res = await worker.fetch(req('/api/session',{token:jwt(adminId,{aud:'outro-projeto'})}), env);
  assert.equal(res.status,401);
});
test('assinatura falsificada não passa a verificação', async () => {
  globalThis.fetch=fakeFetch;
  const token=jwt(adminId).replace(/.$/, 'x');
  const res = await worker.fetch(req('/api/session',{token}),env);
  assert.equal(res.status,401);
});
test('origem de terceiro não pode operar a API', async()=>{
  globalThis.fetch=fakeFetch;
  const res = await worker.fetch(req('/api/suspend',{token:jwt(adminId),method:'POST',origin:'https://third.party',body:{uid:'driver-uid'}}),env);
  assert.equal(res.status,403);
});
test('token legítimo do proprietário libera sessão e lista somente via API autenticada', async () => {
  globalThis.fetch=fakeFetch;
  let res=await worker.fetch(req('/api/session',{token:jwt(adminId)}),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).uid,adminId);
  res=await worker.fetch(req('/api/users',{token:jwt(adminId)}),env);
  assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.users[0].email,'driver@example.com');
  assert.equal(result.users[0].initialized,false);
  assert.equal(result.users[0].uid,'driver-uid');
});
test('suspensão altera Auth sem apagar os dados de motorista', async () => {
  globalThis.fetch=fakeFetch; calls=[];
  const res=await worker.fetch(req('/api/suspend',{token:jwt(adminId),method:'POST',body:{uid:'driver-uid'}}),env);
  assert.equal(res.status,200);
  assert.equal((await res.json()).disabled,true);
  const authUpdate=calls.find(x=>x.u.includes('/accounts:update'));
  assert.equal(JSON.parse(authUpdate.options.body).disableUser,true);
  assert.equal(calls.filter(x=>x.u.includes('accounts:delete')).length,0);
});
test('criação fornece senha aleatória, prepara perfil e solicita e-mail', async () => {
  globalThis.fetch=fakeFetch;calls=[];
  const res=await worker.fetch(req('/api/create',{token:jwt(adminId),method:'POST',body:{email:'new-driver@example.com'}}),env);
  assert.equal(res.status,200);
  const result=await res.json();
  assert.equal(result.uid,'new-driver');assert.equal(result.resetSent,true);
  const accountPost=calls.find(x=>x.u.includes('/projects/rodapay-c5490/accounts?key='));
  assert.ok(JSON.parse(accountPost.options.body).password.length>=24);
  assert.ok(calls.some(x=>x.u.includes('/documents/users?documentId=new-driver')));
  assert.ok(calls.some(x=>x.u.includes('/accounts:sendOobCode')));
});
test('não suspende a própria conta administradora', async () => {
  globalThis.fetch=fakeFetch;
  const res=await worker.fetch(req('/api/suspend',{token:jwt(adminId),method:'POST',body:{uid:adminId}}),env);
  assert.equal(res.status,400);
});
test('não serve o código administrativo e backups como arquivos web', async () => {
  const res=await worker.fetch(req('/admin/server.mjs'),env);
  assert.equal(res.status,404);
  const html=await readFile(new URL('../admin/online/public/index.html',import.meta.url),'utf8');
  assert.match(html,/type="email"/);assert.match(html,/type="password"/);
  assert.doesNotMatch(html,/Seu código temporário/);
});
test.after(()=>{globalThis.fetch=originalFetch;});
