/**
 * RodaPay — prova de recuperação de backup, SOMENTE em emuladores locais isolados.
 * Não contém nem aceita qualquer opção de gravação em produção.
 * Modos:
 *  inspect <arquivo> — valida, sem conectar ao Firebase.
 *  restore <arquivo> — restaura no projeto demo-rodapay-recovery (Auth + Firestore locais).
 *  check <arquivo>   — compara todos os documentos com o backup já restaurado.
 *
 * IMPORTANTE: senhas do Firebase Authentication NÃO constam do backup original.
 * As contas no emulador são criadas desativadas, sem credenciais de produção.
 */
import { readFile } from 'node:fs/promises';
import { randomBytes, scryptSync, createDecipheriv } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RECOVERY_PROJECT = 'demo-rodapay-recovery';
const MAX_FILE_SIZE = 350 * 1024 * 1024; // Limite preventivo; ajustar conscientemente se necessário.
const PASS_MIN = 20;
const timestampFields = /(?:At|Timestamp|Time)$/i;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDocId = value => typeof value === 'string' && value.length > 0 && value.length <= 800 && !value.includes('/');

export function safeEmulatorEnv(env = process.env) {
  const auth = String(env.FIREBASE_AUTH_EMULATOR_HOST || '');
  const firestore = String(env.FIRESTORE_EMULATOR_HOST || '');
  // Em caso de host remoto, caminho de proxy ou porta inesperada, recusa operação.
  return /^(127\.0\.0\.1|localhost):9099$/.test(auth) &&
    /^(127\.0\.0\.1|localhost):8080$/.test(firestore) &&
    (!env.GOOGLE_CLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT === RECOVERY_PROJECT) &&
    (!env.GCLOUD_PROJECT || env.GCLOUD_PROJECT === RECOVERY_PROJECT);
}

export function decryptBackup(envelope, password) {
  if (typeof password !== 'string' || password.length < PASS_MIN) throw new Error('Senha inválida: mínimo de 20 caracteres.');
  if (!isObject(envelope) || envelope.format !== 'rodapay-encrypted-backup-v1') throw new Error('Formato de backup inválido.');
  for (const key of ['salt', 'iv', 'tag', 'ciphertext']) {
    if (typeof envelope[key] !== 'string' || !/^[\w+/=]+$/.test(envelope[key])) throw new Error(`Campo criptográfico inválido: ${key}.`);
  }
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error('Parâmetros criptográficos inválidos.');
  const derived = scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv('aes-256-gcm', derived, iv);
  decipher.setAuthTag(tag);
  let payload;
  try {
    payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8'));
  } catch {
    throw new Error('Não foi possível descriptografar. Confira a senha e a integridade do backup.');
  }
  validatePayload(payload);
  return payload;
}

export function validatePayload(payload) {
  if (!isObject(payload) || payload.project !== 'rodapay-c5490' || !Array.isArray(payload.users) || !Array.isArray(payload.audit)) {
    throw new Error('Backup incompatível com o formato esperado do RodaPay.');
  }
  const usedUsers = new Set();
  for (const user of payload.users) {
    if (!isObject(user) || !validDocId(user.id) || usedUsers.has(user.id) || !isObject(user.auth)) throw new Error('Conta inválida ou duplicada no backup.');
    usedUsers.add(user.id);
    if (user.auth.email != null && (typeof user.auth.email !== 'string' || !user.auth.email.includes('@'))) throw new Error('E-mail inválido no backup.');
    if (user.root !== null && !isObject(user.root)) throw new Error('Documento raiz inválido no backup.');
    if (!isObject(user.collections)) throw new Error('Coleções inválidas no backup.');
    for (const [collection, records] of Object.entries(user.collections)) {
      if (!validDocId(collection) || !Array.isArray(records)) throw new Error('Coleção inválida no backup.');
      const usedDocs = new Set();
      for (const doc of records) {
        if (!isObject(doc) || !validDocId(doc.id) || !isObject(doc.data) || usedDocs.has(doc.id)) throw new Error('Documento inválido ou duplicado no backup.');
        usedDocs.add(doc.id);
      }
    }
  }
  const usedAudit = new Set();
  for (const doc of payload.audit) {
    if (!isObject(doc) || !validDocId(doc.id) || !isObject(doc.data) || usedAudit.has(doc.id)) throw new Error('Registro de auditoria inválido no backup.');
    usedAudit.add(doc.id);
  }
  return payload;
}

export function summary(payload) {
  let docs = 0;
  const collections = new Map();
  for (const user of payload.users) {
    if (user.root !== null) docs++;
    for (const [name, records] of Object.entries(user.collections)) {
      docs += records.length;
      collections.set(name, (collections.get(name) || 0) + records.length);
    }
  }
  return {
    project: payload.project,
    backupDate: payload.generatedAt,
    users: payload.users.length,
    firestoreDocuments: docs,
    auditEvents: payload.audit.length,
    collections: Object.fromEntries([...collections].sort(([a], [b]) => a.localeCompare(b)))
  };
}

// Firestore Timestamp é serializado como {seconds,nanoseconds} no JSON do backup V9.
// Reconstituí-lo evita trocar timestamps por objetos simples no banco de recuperação.
export function reviveFirestoreValue(value, Timestamp, key = '') {
  if (Array.isArray(value)) return value.map(item => reviveFirestoreValue(item, Timestamp));
  if (!isObject(value)) return value;
  const keys = Object.keys(value);
  const seconds = value._seconds ?? value.seconds;
  const nanos = value._nanoseconds ?? value.nanoseconds;
  if (keys.length === 2 && Number.isInteger(seconds) && Number.isInteger(nanos) && nanos >= 0 && nanos < 1e9 &&
      ((keys.includes('_seconds') && keys.includes('_nanoseconds')) ||
       ((keys.includes('seconds') && keys.includes('nanoseconds')) && timestampFields.test(key)))) {
    return new Timestamp(seconds, nanos);
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveFirestoreValue(v, Timestamp, k)]));
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  if (typeof value.toDate === 'function' && Number.isFinite(value.seconds)) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  const seconds = value._seconds ?? value.seconds;
  const nanos = value._nanoseconds ?? value.nanoseconds;
  if (Object.keys(value).length === 2 && Number.isInteger(seconds) && Number.isInteger(nanos)) {
    return { seconds, nanoseconds: nanos };
  }
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonicalize(v)]));
}

export function equivalent(expected, actual) {
  return JSON.stringify(canonicalize(expected)) === JSON.stringify(canonicalize(actual));
}

async function readPayload(file, pass) {
  if (!file || !file.endsWith('.rodapay-backup')) throw new Error('Informe o caminho do arquivo .rodapay-backup.');
  const bytes = await readFile(resolve(file));
  if (bytes.length > MAX_FILE_SIZE) throw new Error('Backup excede o limite preventivo de leitura.');
  return decryptBackup(JSON.parse(bytes.toString('utf8')), pass);
}

async function connectEmulators() {
  if (!safeEmulatorEnv(process.env)) throw new Error('RECUSADO: configure ambos os emuladores somente em 127.0.0.1:9099 e 127.0.0.1:8080.');
  if (process.env.RODAPAY_ADMIN_MODE === 'production' || process.env.RODAPAY_ADMIN_PROJECT === 'rodapay-c5490') {
    throw new Error('RECUSADO: variáveis administrativas de produção detectadas.');
  }
  const { initializeApp, getApps, deleteApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: RECOVERY_PROJECT }, `restore-${randomBytes(8).toString('hex')}`);
  return { auth: getAuth(app), db: getFirestore(app), Timestamp, cleanup: async () => deleteApp(app) };
}

async function checkEmpty(auth, db) {
  const [users, roots, audit] = await Promise.all([
    auth.listUsers(1), db.collection('users').limit(1).get(), db.collection('adminAuditLogs').limit(1).get()
  ]);
  if (users.users.length || !roots.empty || !audit.empty) {
    throw new Error('RECUSADO: emulador de recuperação não está vazio. Não faremos sobrescrita.');
  }
}

async function restore(payload, target) {
  await checkEmpty(target.auth, target.db);
  for (const user of payload.users) {
    const email = user.auth.email || undefined;
    const credentials = email ? { password: randomBytes(32).toString('hex') } : {};
    await target.auth.createUser({ uid: user.id, ...(email ? { email } : {}), ...credentials,
      emailVerified: Boolean(user.auth.emailVerified), disabled: true });
    if (user.root !== null) {
      await target.db.doc(`users/${user.id}`).create(reviveFirestoreValue(user.root, target.Timestamp));
    }
    for (const [name, docs] of Object.entries(user.collections)) {
      for (const item of docs) {
        await target.db.doc(`users/${user.id}/${name}/${item.id}`).create(reviveFirestoreValue(item.data, target.Timestamp));
      }
    }
  }
  for (const item of payload.audit) {
    await target.db.doc(`adminAuditLogs/${item.id}`).create(reviveFirestoreValue(item.data, target.Timestamp));
  }
}

async function compare(payload, target) {
  let accountCount = 0;
  let cursor;
  do {
    const batch = await target.auth.listUsers(1000, cursor);
    accountCount += batch.users.length;
    cursor = batch.pageToken;
  } while (cursor);
  const [roots, audits] = await Promise.all([
    target.db.collection('users').get(), target.db.collection('adminAuditLogs').get()
  ]);
  if (accountCount !== payload.users.length || roots.size !== payload.users.filter(u => u.root !== null).length || audits.size !== payload.audit.length) {
    throw new Error('Quantidade de contas/documentos raiz/auditoria diferente da esperada.');
  }
  for (const user of payload.users) {
    const auth = await target.auth.getUser(user.id);
    if ((auth.email || null) !== user.auth.email || !auth.disabled) throw new Error('Conta recuperada não confere com o backup.');
    const root = await target.db.doc(`users/${user.id}`).get();
    if (root.exists !== (user.root !== null) || (root.exists && !equivalent(user.root, root.data()))) throw new Error(`Documento raiz de ${user.id} não confere.`);
    const expectedCollections = Object.keys(user.collections).filter(k => user.collections[k].length);
    const presentCollections = (await target.db.doc(`users/${user.id}`).listCollections()).map(col => col.id);
    if (expectedCollections.length !== presentCollections.length || expectedCollections.some(c => !presentCollections.includes(c))) {
      throw new Error(`Coleções de ${user.id} não conferem.`);
    }
    for (const [name, items] of Object.entries(user.collections)) {
      const snapshot = await target.db.collection(`users/${user.id}/${name}`).get();
      if (snapshot.size !== items.length) throw new Error(`Coleção ${name} de ${user.id} não confere.`);
      for (const item of items) {
        const data = snapshot.docs.find(doc => doc.id === item.id)?.data();
        if (!data || !equivalent(item.data, data)) throw new Error(`Documento ${name}/${item.id} não confere.`);
      }
    }
  }
  for (const item of payload.audit) {
    const doc = await target.db.doc(`adminAuditLogs/${item.id}`).get();
    if (!doc.exists || !equivalent(item.data, doc.data())) throw new Error(`Log ${item.id} não confere.`);
  }
  return summary(payload);
}

export async function main(argv = process.argv.slice(2)) {
  const [command, file, confirmation] = argv;
  if (!['inspect', 'restore', 'check'].includes(command)) throw new Error('Uso: node admin/restore-emulator.mjs inspect|restore|check CAMINHO.rodapay-backup [RESTORE-EMULATOR-ONLY]');
  const payload = await readPayload(file, process.env.RODAPAY_BACKUP_PASSWORD || '');
  if (command === 'inspect') {
    console.log('Backup válido; resumo sem dados pessoais:');
    console.log(JSON.stringify(summary(payload), null, 2));
    console.log('Não houve acesso a bancos de dados.');
    return;
  }
  if (command === 'restore' && confirmation !== 'RESTORE-EMULATOR-ONLY') throw new Error('Confirmação explícita ausente. A restauração não foi iniciada.');
  const target = await connectEmulators();
  try {
    if (command === 'restore') {
      await restore(payload, target);
      console.log('Recuperação escrita SOMENTE nos emuladores locais. Agora verificando os documentos...');
    }
    const result = await compare(payload, target);
    console.log('RECUPERAÇÃO CONFERIDA: contagens e conteúdo dos documentos correspondem ao backup.');
    console.log(JSON.stringify(result, null, 2));
    console.log('Usuários foram criados DESATIVADOS e com novas senhas aleatórias; nenhuma senha real foi restaurada.');
    console.log('Produção não foi acessada.');
  } finally { await target.cleanup(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error('Recuperação não concluída:', error.message);
    process.exitCode = 1;
  });
}
