import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
const firebaseApp = initializeApp({
  apiKey:'AIzaSyCLNcnXs-T8Y-9xaRZS2vkCEtK3Gz8eLPk',
  authDomain:'rodapay-c5490.firebaseapp.com',
  projectId:'rodapay-c5490',
  appId:'1:374832778821:web:d147fa5bca18164ae89d2c'
});
const auth = getAuth(firebaseApp);
auth.languageCode = 'pt';

let cursor=null,busy=false,allUsers=[],ownerUid='';const $=id=>document.getElementById(id);const loginFeedback=(text,bad=false)=>{const e=$('loginFeedback');e.textContent=text;e.classList.toggle('error',bad);};const notice=(text,bad=false)=>{const e=$('notice');e.textContent=text;e.classList.toggle('bad',bad);};
async function call(path,options={}){const user=auth.currentUser;if(!user)throw new Error('Faça login para continuar.');const headers={'Content-Type':'application/json','Authorization':'Bearer '+await user.getIdToken()};const res=await fetch(path,{...options,headers,cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível concluir.');return data;}
function ask(title,text,confirmText='Confirmar',bad=false){return new Promise(resolve=>{const dlg=$('dialog');$('dialogLabel').textContent=bad?'ATENÇÃO':'CONFIRMAÇÃO';$('dialogTitle').textContent=title;$('dialogText').textContent=text;$('dialogBody').replaceChildren();$('dialogCancel').classList.remove('hidden');$('dialogConfirm').classList.remove('hidden');$('dialogConfirm').textContent=confirmText;$('dialogConfirm').className='btn '+(bad?'danger':'accent');dlg.classList.remove('hidden');const end=ok=>{dlg.classList.add('hidden');$('dialogConfirm').removeEventListener('click',yes);$('dialogCancel').removeEventListener('click',no);resolve(ok);};const yes=()=>end(true),no=()=>end(false);$('dialogConfirm').addEventListener('click',yes);$('dialogCancel').addEventListener('click',no);});}
function showAudit(user,events){$('dialogLabel').textContent='ATIVIDADES';$('dialogTitle').textContent='Histórico da conta';$('dialogText').textContent=user.email;$('dialogCancel').classList.add('hidden');$('dialogConfirm').textContent='Fechar';$('dialogConfirm').className='btn accent';const body=$('dialogBody');body.replaceChildren();const list=document.createElement('div');list.className='audit-list';if(!events.length){const p=document.createElement('p');p.textContent='Nenhuma alteração administrativa registrada.';list.append(p);}else for(const event of events){const row=document.createElement('div');row.className='audit-line';const label=document.createElement('span');const names={'create':'Conta criada','provision-existing':'Acesso preparado','suspend':'Acesso suspenso','reactivate':'Acesso reativado'};label.textContent=names[event.action]||'Alteração registrada';const date=document.createElement('small');date.textContent=event.date?new Date(event.date).toLocaleString('pt-BR'):'—';row.append(label,date);list.append(row);}body.append(list);$('dialog').classList.remove('hidden');const close=()=>{$('dialog').classList.add('hidden');$('dialogConfirm').removeEventListener('click',close);};$('dialogConfirm').addEventListener('click',close);}
async function initialize(){const session=await call('/api/session');if(!session.authorized)throw new Error('Acesso negado.');ownerUid=session.uid;$('login').classList.add('hidden');$('dashboard').classList.remove('hidden');loginFeedback('');$('environment').textContent='Produção · '+session.project;notice('');await reload();}
function filterAccounts(){const term=$('search').value.trim().toLowerCase();$('accounts').replaceChildren();const filtered=allUsers.filter(u=>(u.email+' '+u.uid).toLowerCase().includes(term));for(const user of filtered)addAccount(user);$('statAll').textContent=allUsers.length;$('statActive').textContent=allUsers.filter(u=>!u.disabled).length;$('statBlocked').textContent=allUsers.filter(u=>u.disabled).length;$('usersSubtitle').textContent=cursor?'Mostrando as contas já carregadas.':'Lista atualizada';if(!filtered.length){const p=document.createElement('p');p.className='muted';p.style.padding='22px 5px';p.textContent=allUsers.length?'Nenhum resultado para esta busca.':'Nenhuma conta encontrada.';$('accounts').append(p);}}
async function reload(){allUsers=[];cursor=null;await loadNext();}
async function loadNext(){if(busy)return;busy=true;$('more').disabled=true;try{const data=await call('/api/users'+(cursor?'?cursor='+encodeURIComponent(cursor):''));cursor=data.nextCursor;allUsers.push(...data.users);filterAccounts();$('more').classList.toggle('hidden',!cursor);}catch(e){notice(e.message,true)}finally{busy=false;$('more').disabled=false;}}
function button(text,fn,variant='btn'){const e=document.createElement('button');e.className=variant;e.textContent=text;e.type='button';e.addEventListener('click',fn);return e;}
function addAccount(user){const row=document.createElement('article');row.className='account';const avatar=document.createElement('div');avatar.className='account-avatar';avatar.textContent=(user.email||'?').slice(0,1).toUpperCase();const info=document.createElement('div');info.className='account-info';const title=document.createElement('strong');title.textContent=user.email;const meta=document.createElement('small');meta.textContent='Cadastrado: '+(user.createdAt?new Date(user.createdAt).toLocaleDateString('pt-BR'):'—')+' · Último acesso: '+(user.lastLogin?new Date(user.lastLogin).toLocaleDateString('pt-BR'):'—');const status=document.createElement('span');status.className='status '+(user.disabled?'blocked':(!user.initialized?'pending':''));status.textContent=user.disabled?'SUSPENSA':user.initialized?'ATIVA':'AGUARDANDO LIBERAÇÃO';info.append(title,meta,status);const actions=document.createElement('div');actions.className='account-actions';if(!user.initialized&&user.uid!==ownerUid)actions.append(button('Preparar acesso',async()=>{if(!await ask('Preparar acesso?','A conta poderá entrar no aplicativo após aceitar os documentos de uso.','Preparar'))return;await runAction('/api/provision',{uid:user.uid});}));if(user.uid!==ownerUid)actions.append(button(user.disabled?'Reativar':'Suspender',async()=>{if(!await ask(user.disabled?'Reativar acesso?':'Suspender acesso?',user.email+' — o histórico da conta será preservado.',user.disabled?'Reativar':'Suspender',!user.disabled))return;await runAction(user.disabled?'/api/reactivate':'/api/suspend',{uid:user.uid});},user.disabled?'btn':'btn danger'));actions.append(button('Atividades',async()=>{try{const data=await call('/api/audit?uid='+encodeURIComponent(user.uid));showAudit(user,data.events);}catch(e){notice(e.message,true)}}));row.append(avatar,info,actions);$('accounts').append(row);}
async function runAction(url,payload){try{const result=await call(url,{method:'POST',body:JSON.stringify(payload)});notice(result.audited===false?'Alteração realizada, mas o registro de auditoria falhou. Verifique o servidor.':'Alteração realizada.',result.audited===false);await reload();}catch(e){notice(e.message,true);}}
function loginErrorMessage(error){
  const code=String(error?.code||'');
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code))return 'E-mail ou senha incorretos. Confira os dados da sua conta.';
  if (code.includes('too-many-requests'))return 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.';
  if (code.includes('user-disabled'))return 'Essa conta está desativada no Firebase Authentication.';
  if (code.includes('operation-not-allowed'))return 'O login por e-mail e senha está desativado no Firebase Authentication.';
  if (code.includes('network-request-failed'))return 'Erro de conexão com o Firebase. Confira sua internet e tente novamente.';
  return error?.message||'Não foi possível entrar. Tente novamente.';
}
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const form=e.currentTarget,b=form.querySelector('button'),originalLabel=b.textContent;
  b.disabled=true;b.textContent='Entrando...';loginFeedback('Conferindo seu e-mail e sua senha...');
  try{
    await signInWithEmailAndPassword(auth,form.elements.email.value.trim(),form.elements.password.value);
    form.elements.password.value='';
    // Não apagar a mensagem aqui: onAuthStateChanged verifica a permissão do Admin e pode
    // ter retornado uma mensagem importante enquanto o login do Firebase finalizava.
    if(!$('dashboard').classList.contains('hidden'))loginFeedback('');
    else if(!$('loginFeedback').classList.contains('error'))loginFeedback('Login aceito. Verificando sua permissão de administrador...');
  }catch(error){loginFeedback(loginErrorMessage(error),true);}
  finally{b.disabled=false;b.textContent=originalLabel;}
});
$('createForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const result=await call('/api/create',{method:'POST',body:JSON.stringify({email:e.target.elements.email.value})});e.target.reset();await reload();const box=$('createdLink');box.replaceChildren();box.classList.remove('hidden');const title=document.createElement('strong');title.textContent='Acesso criado para '+result.email;box.append(title);if(result.resetSent){const p=document.createElement('small');p.textContent='E-mail enviado para definir a senha. Oriente o motorista a verificar a caixa de entrada.';box.append(p);}else{const p=document.createElement('small');p.textContent='Conta criada, mas o e-mail não foi enviado. Oriente o motorista a recuperar a senha na entrada do aplicativo.';box.append(p);}}catch(e){notice(e.message,true)}finally{b.disabled=false}});
$('reload').addEventListener('click',reload);$('more').addEventListener('click',loadNext);$('search').addEventListener('input',filterAccounts);
$('logout').addEventListener('click',async()=>{await signOut(auth);ownerUid='';allUsers=[];cursor=null;$('dashboard').classList.add('hidden');$('login').classList.remove('hidden');notice('');});
onAuthStateChanged(auth,async user=>{
  if(!user){$('dashboard').classList.add('hidden');$('login').classList.remove('hidden');return;}
  try{loginFeedback('Conta autenticada. Verificando acesso administrativo...');await initialize();}
  catch(error){
    $('dashboard').classList.add('hidden');$('login').classList.remove('hidden');
    loginFeedback(error.message||'Acesso administrativo não permitido.',true);
    if(error.message?.includes('não autorizado')){
      // A conta não tem acesso ao painel. Preserve a mensagem visível depois do logout.
      try{await signOut(auth);}catch{ /* mantém a mensagem de bloqueio */ }
    }
  }
});
window.dispatchEvent(new Event('rodapay-admin-ready'));
