import { state, formatDuration, showToast } from './utils.js';
import { saveDocument } from './data.js';

let timer = null; let startedAt = null; let elapsed = 0; let sessionStart = null;
export function initDriving() {
  document.getElementById('driveStartPause').addEventListener('click', toggleDrive);
  document.getElementById('driveFinish').addEventListener('click', finishDrive);
}
function toggleDrive() {
  const btn = document.getElementById('driveStartPause');
  const finish = document.getElementById('driveFinish');
  if (!timer) {
    startedAt = Date.now(); if (!sessionStart) sessionStart = new Date();
    timer = setInterval(tick, 1000); btn.textContent = 'PAUSAR'; finish.classList.remove('hidden'); showToast(elapsed ? 'Jornada retomada.' : 'Jornada iniciada.');
  } else {
    elapsed += Math.floor((Date.now() - startedAt) / 1000); clearInterval(timer); timer = null; btn.textContent = 'RETOMAR'; tick(); showToast('Jornada pausada. Toque em Retomar para continuar.');
  }
}
function tick() { const total = elapsed + (timer ? Math.floor((Date.now() - startedAt) / 1000) : 0); document.getElementById('driveTimer').textContent = formatDuration(total); }
async function finishDrive() {
  const total = elapsed + (timer ? Math.floor((Date.now() - startedAt) / 1000) : 0); if (!total) return;
  clearInterval(timer); timer = null;
  const end = new Date(); const start = sessionStart || end;
  await saveDocument('drivingSessions', { userId: state.user.uid, startDate: start.toISOString().slice(0,10), startTime: start.toTimeString().slice(0,5), endDate: end.toISOString().slice(0,10), endTime: end.toTimeString().slice(0,5), totalSeconds: total });
  elapsed = 0; sessionStart = null; document.getElementById('driveTimer').textContent = '00:00:00'; document.getElementById('driveStartPause').textContent = 'INICIAR'; document.getElementById('driveFinish').classList.add('hidden'); showToast('Jornada finalizada!');
}
