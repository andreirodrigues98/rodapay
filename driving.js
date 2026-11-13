import {
  state, formatDuration, showToast, toISODate, splitWorkIntervalsByDay,
  escapeHtml, icon, openModal, closeModal, openConfirmModal, todayISO
} from './utils.js';
import { saveDrivingDayRecords, newWorkGroupId } from './data.js';
import { renderAll } from './app.js';

// A duração usa timestamps reais: timers suspensos pelo navegador não somam ticks perdidos.
// Somente intervalos efetivamente trabalhados são enviados ao Firestore.
let ticker = null;
let startAt = null;
let accumulatedSeconds = 0;
let sessionStart = null;
let intervals = [];
let groupId = null;
let uid = null;
let finishing = false;
let lastFinishedSummary = null;
let selectedHistoryDate = todayISO();

const now = () => Date.now();
const storageKey = userId => `rodapay.driving.v2.${userId}`;
const isActive = () => Boolean(sessionStart);
const elapsedSeconds = () => accumulatedSeconds + (startAt === null ? 0 : Math.max(0, Math.floor((now() - startAt) / 1000)));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && toISODate(value) === value;
const dateLabel = date => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${date}T00:00:00`));

function updateDisplay() {
  const clock = document.getElementById('driveTimer');
  const control = document.getElementById('driveStartPause');
  const finish = document.getElementById('driveFinish');
  const notice = document.getElementById('driveFinishNotice');
  const status = document.getElementById('driveStatus');
  const hint = document.getElementById('driveHint');
  const indicator = document.getElementById('activeDriveIndicator');
  const active = isActive();
  const running = startAt !== null;
  const elapsed = elapsedSeconds();

  if (clock) clock.textContent = formatDuration(elapsed);
  if (control) {
    const label = running ? 'PAUSAR' : active ? 'RETOMAR' : lastFinishedSummary ? 'NOVA JORNADA' : 'INICIAR';
    control.textContent = label;
    control.setAttribute('aria-label', label === 'NOVA JORNADA' ? 'Iniciar nova jornada' : label.toLowerCase() + ' jornada');
    control.classList.toggle('is-running', running);
    control.classList.toggle('is-paused', active && !running);
    control.classList.toggle('is-fresh', !active);
  }
  if (status) status.textContent = running ? 'Em andamento' : active ? 'Jornada pausada' : lastFinishedSummary ? 'Última jornada salva' : 'Pronto para começar';
  if (hint) hint.textContent = running ? 'Pause quando fizer uma parada.' : active ? 'Toque em Retomar para continuar a mesma jornada.' : lastFinishedSummary ? 'Para trabalhar novamente, inicie uma nova jornada.' : 'Toque em Iniciar para começar sua jornada.';
  if (finish) finish.classList.toggle('hidden', !active || elapsed <= 0);
  if (notice) notice.classList.toggle('hidden', !active || elapsed <= 0);
  if (indicator) {
    const visible = Boolean(state.user && active && state.currentView !== 'drivingView');
    indicator.classList.toggle('hidden', !visible);
    // Measure the actual nav bar, including iPhone safe area. CSS guesses such as
    // 71px make the journey bar overlap the footer on different devices.
    const nav = document.querySelector('.bottom-nav');
    const navRect = nav?.getBoundingClientRect();
    const gapToBottom = navRect ? Math.max(0, window.innerHeight - navRect.top) : 88;
    document.documentElement.style.setProperty('--rp-nav-bottom', `${Math.ceil(gapToBottom + 9)}px`);
    document.getElementById('appShell')?.classList.toggle('has-running-indicator', visible);
    if (visible) {
      indicator.querySelector('[data-drive-clock]').textContent = formatDuration(elapsed);
      indicator.querySelector('[data-drive-state]').textContent = running ? 'Jornada em andamento' : 'Jornada pausada';
      indicator.classList.toggle('paused', !running);
    }
  }
}

export function refreshDrivingDisplay() { updateDisplay(); }

function renderFinishedFeedback() {
  const feedback = document.getElementById('driveFeedback');
  if (!feedback) return;
  feedback.classList.toggle('hidden', !lastFinishedSummary);
  if (!lastFinishedSummary) {
    feedback.replaceChildren();
    return;
  }
  feedback.innerHTML = `<div class="drive-saved-note">
    <span class="drive-saved-icon" aria-hidden="true">${icon('clock')}</span>
    <span class="drive-saved-copy"><strong>Jornada salva</strong><small>${formatDuration(lastFinishedSummary.totalSeconds)} registrados · ${escapeHtml(lastFinishedSummary.date.split('-').reverse().join('/'))}</small></span>
    <button type="button" data-drive-open-history aria-label="Abrir histórico da jornada salva">Ver</button>
  </div>`;
}

export function renderDrivingScreen() {
  renderFinishedFeedback();
  updateDisplay();
  if (document.querySelector('[data-drive-history-content]')) renderHistoryContent();
}

function stopTicker() { if (ticker) clearInterval(ticker); ticker = null; }
function startTicker() { stopTicker(); ticker = setInterval(updateDisplay, 1000); }

function persist() {
  if (!uid) return;
  try {
    if (!isActive()) localStorage.removeItem(storageKey(uid));
    else localStorage.setItem(storageKey(uid), JSON.stringify({
      start: sessionStart.toISOString(), elapsed: accumulatedSeconds,
      startedAt: startAt, intervals, groupId
    }));
  } catch (error) { console.warn('Jornada local indisponível', error?.name); }
}

function stopCurrentInterval() {
  if (startAt === null) return;
  const end = now();
  accumulatedSeconds += Math.max(0, Math.floor((end - startAt) / 1000));
  intervals.push({ start: startAt, end });
  startAt = null;
  stopTicker();
}

export function pauseDrivingSessionForLogout() {
  if (startAt !== null) stopCurrentInterval();
  persist();
  stopTicker();
  uid = null;
  groupId = null;
  sessionStart = null;
  intervals = [];
  accumulatedSeconds = 0;
  startAt = null;
  lastFinishedSummary = null;
  renderDrivingScreen();
}

export function restoreDrivingSession() {
  const next = state.user?.uid;
  if (!next || next === uid) return;
  pauseDrivingSessionForLogout();
  uid = next;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw) {
      const restored = JSON.parse(raw);
      const startedDate = new Date(restored.start);
      if (!Number.isFinite(startedDate.getTime()) || startedDate.getTime() > now()) throw new Error('Data de início inválida');
      sessionStart = startedDate;
      accumulatedSeconds = Number.isFinite(restored.elapsed) && restored.elapsed >= 0 ? restored.elapsed : 0;
      intervals = Array.isArray(restored.intervals) ? restored.intervals.filter(i => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end >= i.start) : [];
      startAt = Number.isFinite(restored.startedAt) && restored.startedAt > 0 && restored.startedAt <= now() ? restored.startedAt : null;
      groupId = /^work_[A-Za-z0-9]{20}$/.test(restored.groupId || '') ? restored.groupId : newWorkGroupId();
      if (startAt !== null) startTicker();
    }
  } catch (error) {
    // Não apaga o registro bruto quando ele estiver inválido: permite recuperação assistida.
    console.warn('Não foi possível restaurar a jornada', error?.message);
    sessionStart = null;
    accumulatedSeconds = 0;
    intervals = [];
    startAt = null;
  }
  renderDrivingScreen();
}

function toggleDriving() {
  if (!state.user || finishing) return;
  if (uid !== state.user.uid) restoreDrivingSession();
  if (startAt !== null) {
    stopCurrentInterval();
    showToast('Jornada pausada. Você pode retomá-la.');
  } else {
    if (!sessionStart) {
      sessionStart = new Date();
      groupId = newWorkGroupId();
      intervals = [];
      accumulatedSeconds = 0;
    }
    const wasPaused = accumulatedSeconds > 0;
    startAt = now();
    startTicker();
    lastFinishedSummary = null;
    showToast(wasPaused ? 'Jornada retomada.' : 'Jornada iniciada.');
  }
  persist();
  renderDrivingScreen();
}

function askToFinish() {
  if (!isActive() || finishing || elapsedSeconds() <= 0) return;
  openConfirmModal(
    'Encerrar salva definitivamente o tempo trabalhado e impede retomar esta jornada. Para continuar mais tarde, escolha Pausar.',
    () => { void finishDriving(); },
    { title: 'Encerrar esta jornada?', confirmText: 'Encerrar e salvar', cancelText: 'Voltar ao cronômetro' }
  );
}

function updateLocalSessions(group, days, source) {
  const updated = new Map(state.drivingSessions.map(item => [item.id, item]));
  days.forEach(day => {
    const id = `${group}_${day.date}`;
    updated.set(id, {
      ...(updated.get(id) || {}), id, userId: state.user.uid, groupId: group,
      startDate: day.date, endDate: day.date, startTime: day.startTime || '',
      endTime: day.endTime || '', totalSeconds: Math.round(day.totalSeconds), source
    });
  });
  state.drivingSessions = [...updated.values()];
}

async function finishDriving() {
  if (!state.user || finishing || elapsedSeconds() <= 0) return;
  finishing = true;
  const button = document.getElementById('driveFinish');
  if (button) button.disabled = true;
  if (startAt !== null) stopCurrentInterval();
  persist();
  updateDisplay();
  const previousUser = uid;
  const currentGroup = groupId || newWorkGroupId();
  try {
    let days = splitWorkIntervalsByDay(intervals);
    if (!days.length && accumulatedSeconds > 0 && sessionStart) {
      // Compatibilidade com sessões antigas, ainda sem intervalos separados.
      days = splitWorkIntervalsByDay([{ start: sessionStart.getTime(), end: sessionStart.getTime() + accumulatedSeconds * 1000 }]);
    }
    if (!days.length) throw new Error('Nenhum intervalo válido');
    await saveDrivingDayRecords(currentGroup, days, 'timer');
    if (uid !== previousUser) return;
    updateLocalSessions(currentGroup, days, 'timer');
    lastFinishedSummary = { date: days.at(-1).date, totalSeconds: days.reduce((sum, day) => sum + day.totalSeconds, 0) };
    accumulatedSeconds = 0;
    intervals = [];
    sessionStart = null;
    startAt = null;
    groupId = null;
    persist();
    renderAll();
    showToast('Jornada encerrada e salva. Para continuar, inicie uma nova.');
    openHistoryModal(lastFinishedSummary.date);
  } catch (error) {
    // Falha de conexão NÃO zera a jornada: ela permanece em pausa no aparelho.
    console.error('Falha ao salvar jornada', error?.code || error?.message);
    showToast('Não foi possível salvar. Sua jornada continua preservada neste aparelho.');
  } finally {
    finishing = false;
    if (button) button.disabled = false;
    renderDrivingScreen();
  }
}

function getSessionsForDay(date) {
  return state.drivingSessions
    .filter(item => item.startDate === date)
    .sort((a, b) => String(b.startTime || '').localeCompare(String(a.startTime || '')));
}

function historyRowsHtml(date) {
  const sessions = getSessionsForDay(date);
  const total = sessions.reduce((sum, item) => sum + Number(item.totalSeconds || 0), 0);
  return `<div class="drive-history-day-summary">
    <span>${escapeHtml(dateLabel(date))}</span>
    <strong>${formatDuration(total)}</strong>
    <small>${sessions.length} ${sessions.length === 1 ? 'registro' : 'registros'} neste dia</small>
  </div>
  <div class="drive-history-rows">
    ${sessions.length ? sessions.map(item => {
      const manual = item.source === 'manual';
      return `<button type="button" class="drive-history-row" data-drive-session-id="${escapeHtml(item.id)}">
        <span class="drive-history-row-icon">${icon(manual ? 'edit' : 'clock')}</span>
        <span class="drive-history-row-copy"><strong>${manual ? 'Registro manual' : 'Jornada no cronômetro'}</strong><small>${manual ? 'Horas informadas manualmente' : `${escapeHtml(item.startTime || '--:--')} até ${escapeHtml(item.endTime || '--:--')}`}</small></span>
        <span class="drive-history-row-time">${formatDuration(item.totalSeconds || 0)}${icon('chevron')}</span>
      </button>`;
    }).join('') : `<div class="drive-history-empty">${icon('clock')}<strong>Sem jornadas neste dia</strong><span>Você pode escolher outra data ou registrar suas horas.</span></div>`}
  </div>`;
}

function renderHistoryContent() {
  const container = document.querySelector('[data-drive-history-content]');
  if (container && validDate(selectedHistoryDate)) container.innerHTML = historyRowsHtml(selectedHistoryDate);
}

function openHistoryModal(date = todayISO()) {
  selectedHistoryDate = validDate(date) ? date : todayISO();
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  if (!modal || !content) return;
  content.innerHTML = `<div class="drive-history-modal">
    <div class="drive-history-modal-head"><span class="screen-eyebrow">HORAS TRABALHADAS</span><h2>Histórico de jornadas</h2><p>Consulte o tempo registrado em cada dia.</p></div>
    <label class="drive-history-date-field">Selecionar dia<input type="date" data-drive-history-date value="${escapeHtml(selectedHistoryDate)}" aria-label="Selecionar dia do histórico"></label>
    <div data-drive-history-content>${historyRowsHtml(selectedHistoryDate)}</div>
  </div>`;
  openModal(modal);
}

function openSessionDetails(sessionId) {
  const session = state.drivingSessions.find(item => item.id === sessionId);
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  if (!session || !content || !modal) return;
  const manual = session.source === 'manual';
  content.innerHTML = `<div class="drive-history-modal">
    <button class="drive-history-back" type="button" data-drive-history-back>${icon('back')} Voltar ao histórico</button>
    <span class="screen-eyebrow">REGISTRO SALVO</span>
    <h2>${manual ? 'Horas manuais' : 'Jornada finalizada'}</h2>
    <div class="drive-detail-grid">
      <div><span>Data</span><strong>${escapeHtml(session.startDate?.split('-').reverse().join('/') || '—')}</strong></div>
      <div><span>Tipo</span><strong>${manual ? 'Manual' : 'Cronômetro'}</strong></div>
      <div><span>Início</span><strong>${escapeHtml(session.startTime || '—')}</strong></div>
      <div><span>Fim</span><strong>${escapeHtml(session.endTime || '—')}</strong></div>
      <div class="drive-detail-duration"><span>Horas trabalhadas</span><strong>${formatDuration(session.totalSeconds || 0)}</strong></div>
    </div>
    <p class="drive-history-note">Este registro já foi encerrado. Para trabalhar novamente, inicie uma nova jornada.</p>
  </div>`;
  selectedHistoryDate = session.startDate || todayISO();
  openModal(modal);
}

export function initDriving() {
  document.getElementById('driveStartPause')?.addEventListener('click', toggleDriving);
  document.getElementById('driveFinish')?.addEventListener('click', askToFinish);
  document.addEventListener('visibilitychange', updateDisplay);
  window.addEventListener('pageshow', updateDisplay);
  window.addEventListener('resize', updateDisplay, { passive: true });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-manual-hours]')) { openManualHoursForm(); return; }
    if (event.target.closest('[data-drive-open-history]')) {
      openHistoryModal(lastFinishedSummary?.date || todayISO()); return;
    }
    if (event.target.closest('[data-drive-history-back]')) { openHistoryModal(selectedHistoryDate); return; }
    const record = event.target.closest('[data-drive-session-id]');
    if (record) openSessionDetails(record.dataset.driveSessionId || '');
  });
  document.addEventListener('change', event => {
    const input = event.target.closest('[data-drive-history-date]');
    if (input && validDate(input.value)) {
      selectedHistoryDate = input.value;
      renderHistoryContent();
    }
  });
  renderDrivingScreen();
}

// Registros manuais seguem em drivingSessions; não alteram o cronômetro ativo.
export function openManualHoursForm() {
  const modal = document.getElementById('formModal');
  const content = document.getElementById('formModalContent');
  if (!modal || !content || !state.user) return;
  const recordId = newWorkGroupId();
  content.innerHTML = `<div class="manual-work-form">
    <div class="form-modal-heading"><span class="screen-eyebrow">REGISTRO MANUAL</span><h2>Adicionar horas</h2></div>
    <form id="manualWorkForm" class="form-stack">
      <label>Dia<input type="date" name="date" value="${todayISO()}" required></label>
      <div class="form-pair"><label>Horas<input type="number" name="hours" inputmode="numeric" min="0" max="23" value="0" required></label>
      <label>Minutos<input type="number" name="minutes" inputmode="numeric" min="0" max="59" value="0" required></label></div>
      <div class="manual-duplicate-notice hidden" data-manual-existing><strong>Já existem horas neste dia.</strong><p>Confirme somente se este tempo for adicional e não estiver no cronômetro.</p><label><input name="additionalWork" type="checkbox"> São horas adicionais, sem duplicação</label></div>
      <button type="submit" class="btn primary">Salvar horas</button>
    </form>
  </div>`;
  openModal(modal);
  const form = content.querySelector('#manualWorkForm');
  const refreshWarning = () => {
    const hasRecord = state.drivingSessions.some(item => item.startDate === form.elements.date.value);
    form.querySelector('[data-manual-existing]').classList.toggle('hidden', !hasRecord);
    if (!hasRecord) form.elements.additionalWork.checked = false;
  };
  form.elements.date.addEventListener('change', refreshWarning);
  refreshWarning();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const hours = Number(form.elements.hours.value);
    const minutes = Number(form.elements.minutes.value);
    const date = form.elements.date.value;
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || hours + minutes <= 0) {
      showToast('Confira as horas e minutos.'); return;
    }
    if (!validDate(date)) { showToast('Data inválida.'); return; }
    const existing = getSessionsForDay(date).reduce((sum, item) => sum + Number(item.totalSeconds || 0), 0);
    if (existing && !form.elements.additionalWork.checked) { showToast('Confirme que não está repetindo horas já salvas.'); return; }
    const seconds = (hours * 60 + minutes) * 60;
    if (existing + seconds > 86400) { showToast('O tempo do dia não pode ultrapassar 24 horas.'); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const day = { date, totalSeconds: seconds };
      await saveDrivingDayRecords(recordId, [day], 'manual');
      updateLocalSessions(recordId, [day], 'manual');
      closeModal(modal);
      renderAll();
      showToast('Horas registradas.');
      openHistoryModal(date);
    } catch (error) {
      console.error('Erro ao salvar registro manual', error?.code || error?.message);
      showToast('Não foi possível salvar; confira a conexão.');
    } finally { button.disabled = false; }
  });
}
