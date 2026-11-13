/**
 * Verificação opt-in das permissões do Firestore exclusivamente em emuladores.
 * Uso: terminal 1 npm run emulators ; terminal 2 npm run test:rules
 * Sem credenciais de produção e sem alteração de dados reais.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const projectId = 'demo-rodapay';
const authHost = '127.0.0.1:9099';
const dbHost = '127.0.0.1:8080';
const noUnsafeEnv = ['GOOGLE_APPLICATION_CREDENTIALS', 'RODAPAY_ADMIN_MODE', 'RODAPAY_ADMIN_PROJECT']
  .every(key => !process.env[key] || (key === 'RODAPAY_ADMIN_MODE' && process.env[key] === 'test'));
if (!noUnsafeEnv || (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost)
    || (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST !== dbHost)
    || (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== projectId)
    || (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== projectId)) {
  throw new Error('Verificação abortada: ambiente não é exclusivamente o emulador demo-rodapay.');
}

// Credenciais ADC jamais são usadas: as duas variáveis fazem o Admin SDK operar
// exclusivamente nos serviços locais, em projeto com prefixo demo-.
process.env.FIREBASE_AUTH_EMULATOR_HOST = authHost;
process.env.FIRESTORE_EMULATOR_HOST = dbHost;
process.env.GOOGLE_CLOUD_PROJECT = projectId;
process.env.GCLOUD_PROJECT = projectId;

const abort = AbortSignal.timeout(3000);
for (const url of [`http://${authHost}/`, `http://${dbHost}/`]) {
  try { await fetch(url, {signal: abort}); }
  catch { throw new Error(`Emuladores não disponíveis em ${url}. Inicie npm run emulators.`); }
}
const { initializeApp, deleteApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
const app = initializeApp({ projectId }, 'rodapay-isolation-test');
const auth = getAuth(app);
const db = getFirestore(app);
const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
const emailA = `rodapay-a-${suffix}@example.test`;
const emailB = `rodapay-b-${suffix}@example.test`;
const password = `TesteSeguranca-${suffix}-forte!`;
let userA, userB;
let entryRef, entryBRef;

const signin = async email => {
  const url = `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`;
  const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,password,returnSecureToken:true})});
  assert.equal(response.status,200,`Não foi possível obter token da conta de teste: ${response.status}`);
  return (await response.json()).idToken;
};
const request = async (token, method, uid, rid) => {
  const path = `http://${dbHost}/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/entries/${rid}`;
  return fetch(path,{method,headers:{Authorization:`Bearer ${token}`}});
};
try {
  userA = await auth.createUser({email:emailA,password,disabled:false});
  userB = await auth.createUser({email:emailB,password,disabled:false});
  for (const user of [userA,userB]) {
    await db.doc(`users/${user.uid}`).set({email:user.email,active:true,
      settings:{themePreference:'dark',lightMode:false},legalVersion:'2026-11-13',
      legalAcceptedAt:Timestamp.now()});
  }
  entryRef = db.doc(`users/${userA.uid}/entries/isolation_${suffix}`);
  await entryRef.set({date:'2026-11-13',origin:'Uber',value:29.9,updatedAt:Timestamp.now()});
  entryBRef = db.doc(`users/${userB.uid}/entries/isolation_${suffix}`);
  await entryBRef.set({date:'2026-11-13',origin:'99 Pop',value:11,updatedAt:Timestamp.now()});
  const tokenA = await signin(emailA);
  const tokenB = await signin(emailB);
  assert.equal((await request(tokenA,'GET',userA.uid,entryRef.id)).status,200,'A deve ler a própria corrida');
  assert.equal((await request(tokenB,'GET',userB.uid,entryBRef.id)).status,200,'B deve ler a própria corrida');
  assert.equal((await request(tokenB,'GET',userA.uid,entryRef.id)).status,403,'B não deve ler dados de A');
  assert.equal((await request(tokenB,'DELETE',userA.uid,entryRef.id)).status,403,'B não deve excluir dados de A');
  assert.equal((await request(tokenB,'PATCH',userA.uid,entryRef.id)).status,403,'B não deve modificar dados de A');
  await db.doc(`users/${userA.uid}`).update({active:false});
  assert.equal((await request(tokenA,'GET',userA.uid,entryRef.id)).status,403,'Suspensão deve bloquear acesso direto');
  await db.doc(`users/${userA.uid}`).update({active:true});
  assert.equal((await request(tokenA,'GET',userA.uid,entryRef.id)).status,200,'Reativação deve preservar dados');
  console.log('ISOLAMENTO APROVADO (emuladores): própria conta, outra conta, exclusão negada, suspensão e reativação.');
} finally {
  if (entryRef) await entryRef.delete().catch(() => {});
  if (entryBRef) await entryBRef.delete().catch(() => {});
  for (const user of [userA,userB].filter(Boolean)) {
    await db.doc(`users/${user.uid}`).delete().catch(()=>{});
    await auth.deleteUser(user.uid).catch(()=>{});
  }
  await deleteApp(app);
}
