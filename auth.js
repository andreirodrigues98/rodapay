import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdToken,
  setPersistence, browserLocalPersistence,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';
import { state, showToast } from './utils.js';
import { ensureDefaults, watchUserData, clearWatchers } from './data.js';
import { renderAll, scheduleDataRender } from './app.js';
import { restoreDrivingSession, pauseDrivingSessionForLogout } from './driving.js';
import { ensureLegalAccess } from './legal.js';
import { readLastActivity, shouldRequireLogin, saveLastActivity } from './session-policy.js';

export function getAuthErrorMessage(error) {
  const code = String(error?.code || '');
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'E-mail ou senha inválidos.';
  if (code.includes('too-many-requests')) return 'Muitas tentativas. Tente novamente mais tarde.';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'Sem conexão. Confira sua internet e tente novamente.';
  if (code.includes('operation-not-allowed')) return 'Não foi possível entrar. Procure nosso atendimento.';
  if (code.includes('unauthorized-domain')) return 'Não foi possível entrar neste endereço. Procure nosso atendimento.';
  if (code.includes('requires-recent-login')) return 'Confirme sua senha atual e tente novamente.';
  if (code.includes('weak-password')) return 'Escolha uma senha mais forte.';
  if (code.includes('user-disabled')) return 'Este acesso foi desativado. Entre em contato com o suporte.';
  if (code.includes('permission-denied')) return 'Seu acesso não está disponível. Procure nosso atendimento.';
  return /^(Sua conta ainda não foi liberada|Este acesso está suspenso|Acesso interrompido)/.test(error?.message || '') ? error.message : 'Não foi possível concluir. Tente novamente.';
}

let interactiveLoginPending = false;
let recentlySignedInUid = null;

export async function loginUser(email, password) {
  interactiveLoginPending = true;
  try {
    // Sessão persistente no mesmo navegador (inclusive após fechar a aba).
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
    recentlySignedInUid = credential.user.uid;
    saveLastActivity(localStorage, credential.user.uid);
  } catch (error) {
    throw new Error(getAuthErrorMessage(error));
  } finally {
    interactiveLoginPending = false;
  }
}

export async function logoutUser() { pauseDrivingSessionForLogout(); await signOut(auth); }

export async function requestPasswordReset(email) {
  const normalized = String(email || '').trim();
  if (!normalized) throw new Error('Digite seu e-mail para recuperar a senha.');
  try { await sendPasswordResetEmail(auth, normalized); }
  catch (error) { throw new Error(getAuthErrorMessage(error)); }
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Entre novamente na sua conta.');
  if (!currentPassword) throw new Error('Informe sua senha atual.');
  if (typeof newPassword !== 'string' || newPassword.length < 10)
    throw new Error('A nova senha precisa ter pelo menos 10 caracteres.');
  if (newPassword === currentPassword) throw new Error('A nova senha deve ser diferente da atual.');
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    // A senha foi trocada: esta sessão também deve exigir novo login.
    await logoutUser();
  } catch (error) { throw new Error(getAuthErrorMessage(error)); }
}

const TOKEN_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000;
let authSequence = 0;
let lastTokenCheck = 0;
let lastActivityWrite = 0;
let sessionReady = false;
let checkingOnResume = false;
let sessionListenersRegistered = false;

function isRevokedAuth(error) {
  const code = String(error?.code || '');
  return /user-token-expired|invalid-user-token|user-disabled|user-not-found/.test(code);
}

async function validatePasswordNotChanged(user) {
  try {
    // Força a validação com o Firebase. Uma troca/redefinição de senha
    // revoga os refresh tokens das outras sessões.
    await getIdToken(user, true);
    lastTokenCheck = Date.now();
    return true;
  } catch (error) {
    if (isRevokedAuth(error)) {
      showToast('Sua sessão foi encerrada. Entre novamente com sua senha atual.');
      await logoutUser();
      return false;
    }
    // Internet indisponível: preservar a sessão e tentar novamente ao voltar.
    // A revogação remota só pode ser confirmada quando houver conexão.
    console.warn('Não foi possível verificar a sessão agora:', error?.code || 'erro-de-conexao');
    lastTokenCheck = 0;
    return true;
  }
}

async function requireLoginAfterInactivity(user) {
  if (!user || !shouldRequireLogin(readLastActivity(localStorage, user.uid))) return false;
  sessionReady = false;
  showToast('Você ficou 7 dias sem acessar. Entre novamente para continuar.');
  await logoutUser();
  return true;
}

async function handleReturnToApp() {
  if (!sessionReady || checkingOnResume || document.visibilityState === 'hidden') return;
  const user = auth.currentUser;
  if (!user) return;
  checkingOnResume = true;
  try {
    if (await requireLoginAfterInactivity(user)) return;
    saveLastActivity(localStorage, user.uid);
    lastActivityWrite = Date.now();
    if (Date.now() - lastTokenCheck >= TOKEN_CHECK_INTERVAL_MS) await validatePasswordNotChanged(user);
  } finally {
    checkingOnResume = false;
  }
}

function noteUserInteraction() {
  if (!sessionReady || document.visibilityState === 'hidden' || !auth.currentUser) return;
  const user = auth.currentUser;
  // Verificar antes de registrar uma nova atividade, inclusive se a aba ficou aberta.
  if (shouldRequireLogin(readLastActivity(localStorage, user.uid))) {
    void requireLoginAfterInactivity(user);
    return;
  }
  const now = Date.now();
  if (now - lastActivityWrite >= ACTIVITY_WRITE_INTERVAL_MS) {
    saveLastActivity(localStorage, user.uid, now);
    lastActivityWrite = now;
  }
}

function registerSessionListeners() {
  if (sessionListenersRegistered) return;
  sessionListenersRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void handleReturnToApp();
  });
  window.addEventListener('pageshow', () => { void handleReturnToApp(); });
  window.addEventListener('focus', () => { void handleReturnToApp(); });
  window.addEventListener('online', () => { lastTokenCheck = 0; void handleReturnToApp(); });
  document.addEventListener('pointerdown', noteUserInteraction, { passive: true });
  document.addEventListener('keydown', noteUserInteraction);
  // Verifica também uma sessão deixada aberta enquanto a pessoa usa o app.
  window.setInterval(() => {
    if (!sessionReady || document.visibilityState !== 'visible' || !auth.currentUser) return;
    const user = auth.currentUser;
    if (shouldRequireLogin(readLastActivity(localStorage, user.uid))) {
      void requireLoginAfterInactivity(user);
    } else if (Date.now() - lastTokenCheck >= TOKEN_CHECK_INTERVAL_MS) {
      void validatePasswordNotChanged(user);
    }
  }, TOKEN_CHECK_INTERVAL_MS);
}

export function watchAuthState() {
  registerSessionListeners();
  onAuthStateChanged(auth, async user => {
    const sequence = ++authSequence;
    const loginView = document.getElementById('loginView');
    const appShell = document.getElementById('appShell');
    const appStarting = document.getElementById('appStarting');
    sessionReady = false;
    clearWatchers();
    if (!user) {
      lastTokenCheck = 0;
      recentlySignedInUid = null;
      appStarting?.classList.add('hidden');
      state.user = null;
      state.profile = { displayName: '', avatar: '' };
      pauseDrivingSessionForLogout();
      state.settings = { incomeTaxRate: 0.6, lightMode: false, themePreference: 'dark' };
      document.body.classList.remove('light-mode');
      for (const key of ['entries','expenses','origins','paymentMethods','expenseCategories','goals','drivingSessions']) state[key] = [];
      loginView.classList.remove('hidden');
      appShell.classList.add('hidden');
      return;
    }
    loginView.classList.add('hidden');
    appShell.classList.add('hidden');
    appStarting?.classList.remove('hidden');
    state.user = user;
    try {
      const freshLogin = interactiveLoginPending || recentlySignedInUid === user.uid;
      recentlySignedInUid = null;
      if (!freshLogin && await requireLoginAfterInactivity(user)) return;
      // Primeiro acesso à nova política: inicia a contagem de sete dias sem
      // desconectar quem já usava uma versão antiga do RodaPay.
      saveLastActivity(localStorage, user.uid);
      lastActivityWrite = Date.now();
      if (!(await validatePasswordNotChanged(user))) return;
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      await ensureLegalAccess(user, () => sequence === authSequence);
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      await ensureDefaults();
      if (sequence !== authSequence || auth.currentUser?.uid !== user.uid) return;
      watchUserData(
        name => { if (auth.currentUser?.uid === user.uid) scheduleDataRender(name); },
        () => { showToast('Acesso suspenso. Entre em contato com o suporte.'); logoutUser(); },
        error => { console.error('Falha ao sincronizar dados:', error?.code); showToast('Não foi possível sincronizar os dados. Verifique as permissões ou conexão.'); }
      );
      loginView.classList.add('hidden');
      appShell.classList.remove('hidden');
      appStarting?.classList.add('hidden');
      sessionReady = true;
      restoreDrivingSession();
      renderAll();
    } catch (error) {
      console.error('Falha ao iniciar conta:', error?.code || 'initialization-error');
      showToast(getAuthErrorMessage(error));
      appStarting?.classList.add('hidden');
      if (auth.currentUser?.uid === user.uid) await logoutUser();
    }
  });
}
