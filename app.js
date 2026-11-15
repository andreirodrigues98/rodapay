import { watchAuthState, loginUser, logoutUser, requestPasswordReset } from './auth.js';
import { state, showToast, icon, syncSelectedFromDate, getISOWeekStart, getMonthFromWeek, closeModal } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderTransactions, openTransactionForm, openRideForm } from './transactions.js';
import { renderSettings, openSettingsPanel } from './settings.js';
import { avatarMarkup } from './profile.js';
import { initDriving, refreshDrivingDisplay, openManualHoursForm, renderDrivingScreen } from './driving.js';

function syncActiveNavigation(viewId) {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(button => {
    const active = button.dataset.view === viewId ||
      (viewId === 'drivingView' && button.hasAttribute('data-open-driving'));
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function applyTheme() {
  const lightMode = state.settings.themePreference === 'light';
  document.body.classList.toggle('light-mode', lightMode);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', lightMode ? '#FFFFFF' : '#0A0A0A');
}

function renderAvatar() {
  const avatarEl = document.getElementById('headerAvatar');
  if (avatarEl) avatarEl.innerHTML = avatarMarkup(state.profile.avatar, 'Seu perfil');
}
function safeRenderStep(label, action) {
  try {
    action();
    return true;
  } catch (error) {
    console.error(`Erro ao renderizar ${label}:`, error);
    return false;
  }
}

export function renderAll() {
  applyTheme();
  renderAvatar();
  document.querySelectorAll('.screen').forEach(screen =>
    screen.classList.toggle('active-screen', screen.id === state.currentView));
  syncActiveNavigation(state.currentView);
  document.querySelectorAll('.period-tab').forEach(b => b.classList.toggle('active', b.dataset.period === state.period));

  const dashboardOk = safeRenderStep('dashboard', () => renderDashboard());
  const transactionsOk = safeRenderStep('movimentações', () => renderTransactions());
  const settingsOk = safeRenderStep('ajustes', () => renderSettings());
  const drivingOk = safeRenderStep('jornada', () => renderDrivingScreen());

  if (dashboardOk) safeRenderStep('filtros do dashboard', () => bindDynamicFilters());
  if (transactionsOk) safeRenderStep('filtros das movimentações', () => bindTransactionFilter());
  if (transactionsOk || settingsOk || drivingOk) safeRenderStep('listas com swipe', () => initSwipeLists());
  safeRenderStep('ações flutuantes', () => updateFabVisibility());

  if (!dashboardOk && !transactionsOk && !settingsOk && !drivingOk) {
    showToast('Houve um problema ao atualizar a tela. Tente abrir a seção novamente.');
  }
}

const dashboardCollections = new Set(['entries', 'expenses', 'origins', 'expenseCategories', 'goals']);
const transactionCollections = new Set(['entries', 'expenses', 'origins', 'paymentMethods', 'expenseCategories']);
const settingsCollections = new Set(['origins', 'paymentMethods', 'expenseCategories', 'goals', 'drivingSessions']);
const drivingCollections = new Set(['drivingSessions']);
const pendingRenderChanges = new Set();
let renderFrame = null;

// Coalesce Firestore's initial snapshots, then render only the visible screen and relevant modules.
export function scheduleDataRender(collectionName) {
  pendingRenderChanges.add(collectionName);
  if (renderFrame !== null) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    const changes = new Set(pendingRenderChanges);
    pendingRenderChanges.clear();
    if (!state.user) return;
    if (changes.has('profile')) renderAvatar();
    if (state.currentView === 'dashboardView' && [...changes].some(key => dashboardCollections.has(key))) {
      renderDashboard(); bindDynamicFilters();
    }
    if (state.currentView === 'transactionsView' && [...changes].some(key => transactionCollections.has(key))) {
      renderTransactions(); bindTransactionFilter(); initSwipeLists();
    }
    if (state.currentView === 'settingsView' && [...changes].some(key => settingsCollections.has(key))) {
      renderSettings(); initSwipeLists();
    }
    if (state.currentView === 'drivingView' && [...changes].some(key => drivingCollections.has(key))) {
      renderDrivingScreen(); initSwipeLists();
    }
  });
}

function renderVisibleScreen() {
  if (state.currentView === 'dashboardView') { renderDashboard(); bindDynamicFilters(); }
  if (state.currentView === 'transactionsView') { renderTransactions(); bindTransactionFilter(); initSwipeLists(); }
  if (state.currentView === 'settingsView') { renderSettings(); initSwipeLists(); }
  if (state.currentView === 'drivingView') { renderDrivingScreen(); initSwipeLists(); }
}
function initSwipeLists() {
  document.querySelectorAll('[data-swipe-shell]').forEach(shell => {
    if (shell.dataset.swipeBound) return;
    shell.dataset.swipeBound = '1';
    const content = shell.querySelector('.swipe-content');
    const deleteBtn = shell.querySelector('.swipe-delete-btn');
    if (!content) return;
    const swipeWidth = () => {
      const width = Math.max(88, Math.round(deleteBtn?.offsetWidth || 108));
      shell.style.setProperty('--swipe-open-width', `${width}px`);
      return width;
    };
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    const closeOthers = () => document.querySelectorAll('[data-swipe-shell].open').forEach(other => {
      if (other === shell) return;
      other.classList.remove('open');
      other.classList.remove('revealing-delete');
      other.querySelector('.swipe-content')?.style.removeProperty('transform');
    });
    const start = x => { dragging = true; startX = x; currentX = x; swipeWidth(); shell.classList.add('swiping'); closeOthers(); };
    const move = x => {
      if (!dragging) return;
      currentX = x;
      const width = swipeWidth();
      const dx = Math.max(-width, Math.min(0, x - startX));
      shell.classList.toggle('revealing-delete', dx < -6);
      content.style.transform = `translateX(${dx}px)`;
    };
    const end = () => {
      if (!dragging) return;
      dragging = false;
      shell.classList.remove('swiping');
      const dx = currentX - startX;
      const width = swipeWidth();
      if (dx < -(width / 3)) {
        shell.classList.add('open');
        shell.classList.add('revealing-delete');
        content.style.transform = `translateX(-${width}px)`;
      } else {
        shell.classList.remove('open');
        shell.classList.remove('revealing-delete');
        content.style.removeProperty('transform');
      }
    };
    content.addEventListener('touchstart', e => start(e.touches[0].clientX), { passive: true });
    content.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
    content.addEventListener('touchend', end);
    content.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') start(e.clientX); });
    content.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') move(e.clientX); });
    content.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); });
    content.addEventListener('pointercancel', end);
  });
}
function showView(viewId) {
  const target = document.getElementById(viewId);
  if (!target?.classList.contains('screen')) return;
  state.currentView = viewId;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active-screen', s.id === viewId));
  syncActiveNavigation(viewId);
  // On mobile the former section can be much taller; returning to top prevents
  // landing in an empty part of the viewport when switching sections.
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  updateFabVisibility();
  safeRenderStep('tela selecionada', renderVisibleScreen);
  refreshDrivingDisplay();
}
function updateFabVisibility() {
  const activeScreen = document.querySelector('.screen.active-screen')?.id || state.currentView;
  const add = document.getElementById('floatingAdd');
  const drive = document.getElementById('floatingDrive');
  const isDashboardScreen = activeScreen === 'dashboardView' && ['daily', 'weekly', 'monthly', 'yearly'].includes(state.period);
  if (add) add.classList.toggle('hidden', activeScreen !== 'transactionsView');
  if (drive) drive.classList.toggle('hidden', !isDashboardScreen);
}
function bindTransactionFilter() {
  const btn = document.getElementById('transactionFilterBtn');
  if (!btn) return;
  const labels = { all: 'Todos', today: 'Hoje', month: 'Este mês', year: 'Este ano' };
  btn.innerHTML = `${icon('filter')}<span>Filtrar por: ${labels[state.transactionFilter || 'all']}</span>`;
  btn.onclick = () => { const order = ['all','today','month','year']; state.transactionFilter = order[(order.indexOf(state.transactionFilter || 'all') + 1) % order.length]; renderAll(); };
}
function bindDynamicFilters() {
  const date = document.getElementById('dashDate');
  if (date) date.onchange = e => { syncSelectedFromDate(e.target.value); renderAll(); };

  const week = document.getElementById('dashWeek');
  if (week) week.onchange = e => {
    state.selectedWeek = Number(e.target.value);
    const selected = e.target.selectedOptions?.[0];
    if (selected?.dataset.month !== undefined) state.selectedMonth = Number(selected.dataset.month);
    else state.selectedMonth = getMonthFromWeek(Number(state.selectedYear), Number(state.selectedWeek));
    state.selectedDate = getISOWeekStart(Number(state.selectedYear), Number(state.selectedWeek));
    renderAll();
  };

  const month = document.getElementById('dashMonth');
  if (month) month.onchange = e => {
    state.selectedMonth = Number(e.target.value);
    state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), 1);
    renderAll();
  };

  document.querySelectorAll('#dashYear').forEach(el => el.onchange = e => {
    state.selectedYear = Number(e.target.value);
    if (state.period === 'daily') state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), state.selectedDate.getDate());
    if (state.period === 'monthly') state.selectedDate = new Date(Number(state.selectedYear), Number(state.selectedMonth), 1);
    if (state.period === 'weekly') { state.selectedMonth = getMonthFromWeek(Number(state.selectedYear), Number(state.selectedWeek)); state.selectedDate = getISOWeekStart(Number(state.selectedYear), Number(state.selectedWeek)); }
    renderAll();
  });
}
function setDashboardPeriod(period) {
  if (!period || !['daily','weekly','monthly','yearly'].includes(period)) return;
  state.currentView = 'dashboardView';
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active-screen', s.id === 'dashboardView'));
  syncActiveNavigation('dashboardView');
  state.period = period;
  localStorage.setItem('rodapay.period', state.period);
  renderAll();
}

document.addEventListener('click', event => {
  if (event.target.closest('[data-new-ride]')) { event.preventDefault(); if (state.user) openRideForm(); return; }
  const tab = event.target.closest('.period-tab');
  if (tab) setDashboardPeriod(tab.dataset.period);
});

function initEvents() {
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const headerLogout = document.getElementById('headerLogout');
  const headerProfile = document.getElementById('headerProfile');
  const passwordResetBtn = document.getElementById('passwordResetBtn');
  const floatingAdd = document.getElementById('floatingAdd');
  const floatingDrive = document.getElementById('floatingDrive');
  const formModal = document.getElementById('formModal');
  const confirmModal = document.getElementById('confirmModal');

  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Entrando...';
    }
    try {
      await loginUser(loginEmail?.value, loginPassword?.value);
    } catch (error) {
      showToast(error?.message || 'Não foi possível entrar agora.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Entrar';
      }
    }
  });

  const resetForm = document.getElementById('resetPasswordForm');
  const resetEmail = document.getElementById('resetPasswordEmail');
  passwordResetBtn?.addEventListener('click', () => {
    if (resetEmail) resetEmail.value = loginEmail?.value?.trim() || '';
    loginForm.classList.add('hidden');
    resetForm?.classList.remove('hidden');
    resetEmail?.focus();
  });
  document.getElementById('resetPasswordBack')?.addEventListener('click', () => {
    resetForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
  });
  resetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = resetForm.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await requestPasswordReset(resetEmail?.value);
      showToast('Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.');
      resetForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    } catch (error) { showToast(error.message); }
    finally { button.disabled = false; }
  });
  headerProfile?.addEventListener('click', () => { showView('settingsView'); openSettingsPanel('profile'); });
  headerLogout?.addEventListener('click', logoutUser);
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  document.querySelectorAll('[data-transaction-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.transactionTab = btn.dataset.transactionTab;
    renderAll();
  }));
  document.getElementById('addTransactionExpense')?.addEventListener('click',()=>openTransactionForm('expenses'));
  document.querySelectorAll('[data-open-driving]').forEach(btn=>btn.addEventListener('click',()=>showView('drivingView')));
  floatingAdd?.addEventListener('click', () => openTransactionForm(state.transactionTab));
  floatingDrive?.addEventListener('click', () => showView('drivingView'));

  document.querySelectorAll('[data-close-form]').forEach(b => b.addEventListener('click', () => closeModal(formModal)));
  document.querySelectorAll('[data-close-confirm]').forEach(b => b.addEventListener('click', () => closeModal(confirmModal)));
  document.querySelectorAll('[data-back-dashboard]').forEach(b => b.addEventListener('click', () => showView('dashboardView')));
}


document.addEventListener('click', event => {
  const closeForm = event.target.closest('[data-close-form]');
  if (closeForm) {
    event.preventDefault();
    closeModal(document.getElementById('formModal'));
    return;
  }
  const closeConfirm = event.target.closest('[data-close-confirm]');
  if (closeConfirm) {
    event.preventDefault();
    closeModal(document.getElementById('confirmModal'));
    return;
  }
});


// Botão vermelho é um botão real: o evento click precisa chegar ao listener
// de Configurações para abrir a confirmação. Não interceptar touchend/pointerup.
document.addEventListener('click', event => {
  const button = event.target.closest('.swipe-delete-btn');
  if (button) return; // permitir propagação normal do clique no botão Excluir
  const shell = event.target.closest('[data-swipe-shell].open');
  if (!shell) return;
  const content = event.target.closest('.swipe-content');
  if (content) return;
  const deleteBtn = shell.querySelector('.swipe-delete-btn');
  if (!deleteBtn) return;
  const rect = shell.getBoundingClientRect();
  const width = Math.round(deleteBtn.getBoundingClientRect().width || 108);
  if (event.clientX >= rect.right - width && event.clientX <= rect.right) {
    deleteBtn.click();
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const confirmModal = document.getElementById('confirmModal');
  const formModal = document.getElementById('formModal');
  if (confirmModal && !confirmModal.classList.contains('hidden')) {
    closeModal(confirmModal);
    return;
  }
  if (formModal && !formModal.classList.contains('hidden')) {
    closeModal(formModal);
  }
});

document.addEventListener('DOMContentLoaded', () => { window.RodaPayRender = renderAll; window.RodaPayInitSwipe = initSwipeLists; initEvents(); initDriving(); watchAuthState(); });
