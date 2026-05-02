import { watchAuthState, loginUser, logoutUser } from './auth.js';
import { state, showToast, icon, syncSelectedFromDate, getISOWeekStart, getMonthFromWeek, closeModal } from './utils.js';
import { renderDashboard } from './dashboard.js';
import { renderTransactions, openTransactionForm } from './transactions.js';
import { renderSettings } from './settings.js';
import { initDriving } from './driving.js';

function applyTheme() {
  const lightMode = !!state.settings.lightMode;
  document.body.classList.toggle('light-mode', lightMode);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', lightMode ? '#F4F7FB' : '#04070D');
}

export function renderAll() {
  applyTheme();
  document.querySelectorAll('.period-tab').forEach(b => b.classList.toggle('active', b.dataset.period === state.period));
  renderDashboard(); renderTransactions(); renderSettings(); bindDynamicFilters(); bindTransactionFilter(); initSwipeLists(); updateFabVisibility();
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
  state.currentView = viewId;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active-screen', s.id === viewId));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  updateFabVisibility();
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
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'dashboardView'));
  state.period = period;
  localStorage.setItem('rodapay.period', state.period);
  renderAll();
}

document.addEventListener('click', event => {
  const tab = event.target.closest('.period-tab');
  if (tab) setDashboardPeriod(tab.dataset.period);
});

function initEvents() {
  const loginForm = document.getElementById('loginForm');
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const headerLogout = document.getElementById('headerLogout');
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

  headerLogout?.addEventListener('click', logoutUser);
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  document.querySelectorAll('.period-tab').forEach(btn => btn.addEventListener('click', () => setDashboardPeriod(btn.dataset.period)));
  document.querySelectorAll('[data-transaction-tab]').forEach(btn => btn.addEventListener('click', () => {
    state.transactionTab = btn.dataset.transactionTab;
    renderAll();
  }));
  floatingAdd?.addEventListener('click', () => openTransactionForm(state.transactionTab));
  floatingDrive?.addEventListener('click', () => showView('drivingView'));
  document.querySelectorAll('[data-close-form]').forEach(b => b.addEventListener('click', () => closeModal(formModal)));
  document.querySelectorAll('[data-close-confirm]').forEach(b => b.addEventListener('click', () => closeModal(confirmModal)));
  document.querySelectorAll('[data-back-dashboard]').forEach(b => b.addEventListener('click', () => showView('dashboardView')));
}


// Global delegated modal closing. Keeps X, Back and Cancel working
// even when modal content is recreated dynamically.
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


// Permite excluir no primeiro toque em qualquer ponto do campo vermelho aberto,
// inclusive fora do texto "Excluir". O clique real e reenviado para o botao
// de exclusao para manter as regras existentes de cada tela.
function triggerSwipeDelete(shell, event) {
  if (!shell || shell.dataset.deleteTapLock === '1') return;
  const deleteBtn = shell.querySelector('.swipe-delete-btn');
  if (!deleteBtn) return;

  shell.dataset.deleteTapLock = '1';
  window.setTimeout(() => { delete shell.dataset.deleteTapLock; }, 450);

  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();

  deleteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
}

function handleSwipeDeleteTap(event) {
  const directDelete = event.target.closest('.swipe-delete-btn');
  if (directDelete) {
    const shell = directDelete.closest('[data-swipe-shell]');
    triggerSwipeDelete(shell, event);
    return;
  }

  const shell = event.target.closest('[data-swipe-shell].open, [data-swipe-shell].revealing-delete');
  if (!shell) return;

  const deleteBtn = shell.querySelector('.swipe-delete-btn');
  if (!deleteBtn) return;

  const point = event.changedTouches?.[0] || event.touches?.[0] || event;
  const rect = shell.getBoundingClientRect();
  const width = Math.max(88, Math.round(deleteBtn.offsetWidth || 108));
  const inDeleteField = point.clientX >= rect.right - width && point.clientX <= rect.right;

  if (inDeleteField) triggerSwipeDelete(shell, event);
}

['click', 'pointerup', 'touchend'].forEach(type => {
  document.addEventListener(type, handleSwipeDeleteTap, true);
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
