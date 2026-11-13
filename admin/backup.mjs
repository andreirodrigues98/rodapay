// Exportação de segurança criptografada e verificação local. Não altera Firestore/Auth.
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { parseMode } from './security.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const pass = process.env.RODAPAY_BACKUP_PASSWORD || '';
if (pass.length < 20) throw new Error('Defina RODAPAY_BACKUP_PASSWORD com pelo menos 20 caracteres antes de prosseguir.');
const command = process.argv[2];
const file = process.argv[3];
const keyFor = salt => scryptSync(pass, salt, 32, {N: 1<<15, r:8, p:1, maxmem: 64*1024*1024});
function decrypt(envelope) {
  if (envelope.format !== 'rodapay-encrypted-backup-v1') throw new Error('Formato de backup inválido.');
  const decipher = createDecipheriv('aes-256-gcm',keyFor(Buffer.from(envelope.salt,'base64')),Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8'));
}
if (command==='verify') {
  if (!file || !file.endsWith('.rodapay-backup')) throw new Error('Informe um arquivo .rodapay-backup.');
  const decoded = decrypt(JSON.parse(await readFile(resolve(file),'utf8')));
  if(decoded?.project!=='rodapay-c5490'||!Array.isArray(decoded.users)) throw new Error('Arquivo não corresponde ao RodaPay.');
  console.log(`Backup válido. Data: ${decoded.generatedAt}. Contas: ${decoded.users.length}. Não houve acesso ao banco.`);
} else if (command==='create') {
  parseMode(process.env.RODAPAY_ADMIN_MODE,process.env.RODAPAY_ADMIN_PROJECT,process.env.RODAPAY_ADMIN_CONFIRM);
  if(process.env.RODAPAY_ADMIN_MODE!=='production') throw new Error('Este exportador só opera com modo de produção confirmado.');
  if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Variáveis de emulador não podem estar presentes.');
  const app=initializeApp({credential:applicationDefault(),projectId:'rodapay-c5490'});
  const auth=getAuth(app),db=getFirestore(app);
  const users=[];
  let pageToken;
  do {
    const batch=await auth.listUsers(100,pageToken);
    for(const user of batch.users){
      const ref=db.doc(`users/${user.uid}`),snapshot=await ref.get();
      const collections={};
      for(const collection of await ref.listCollections()){
        const snap=await collection.get();
        collections[collection.id]=snap.docs.map(doc=>({id:doc.id,data:doc.data()}));
      }
      users.push({id:user.uid,auth:{email:user.email||null,disabled:!!user.disabled,emailVerified:!!user.emailVerified},root:snapshot.exists?snapshot.data():null,collections});
    }
    pageToken=batch.pageToken;
  } while(pageToken);
  const audit=await db.collection('adminAuditLogs').get();
  const payload={project:'rodapay-c5490',generatedAt:new Date().toISOString(),users,audit:audit.docs.map(d=>({id:d.id,data:d.data()}))};
  const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',keyFor(salt),iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
  const envelope={format:'rodapay-encrypted-backup-v1',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
  const folder=join(dir,'..','backups');await mkdir(folder,{recursive:true});
  const path=join(folder,`rodapay-${new Date().toISOString().replace(/[:.]/g,'-')}.rodapay-backup`);
  await writeFile(path,JSON.stringify(envelope),{flag:'wx',mode:0o600});
  const check=decrypt(JSON.parse(await readFile(path,'utf8')));
  if(check.users.length!==users.length) throw new Error('Falha na verificação do backup.');
  console.log(`Backup gerado e validado. Contas: ${users.length}. Arquivo: ${path}`);
  console.log('Guarde o arquivo e a senha em locais separados. Não envie em mensagens.');
} else {
  console.log('Uso: node admin/backup.mjs create  |  node admin/backup.mjs verify CAMINHO.rodapay-backup');
  process.exitCode=1;
}
