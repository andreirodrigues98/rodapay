const initialToday = new Date();

export const state = {
  user: null,
  profile: { displayName: '', avatar: '' },
  currentView: 'dashboardView',
  period: localStorage.getItem('rodapay.period') || 'daily',
  transactionTab: 'entries',
  transactionFilter: 'all',
  goalTab: 'monthly',
  selectedDate: initialToday,
  selectedWeek: getWeekNumber(initialToday),
  selectedMonth: initialToday.getMonth(),
  selectedYear: initialToday.getFullYear(),
  entries: [], expenses: [], origins: [], paymentMethods: [], expenseCategories: [], goals: [], drivingSessions: [],
  settings: { incomeTaxRate: 0.6, lightMode: false, themePreference: 'dark' }
};

export const defaultOrigins = [
  { name: 'Uber', description: 'Corridas pelo aplicativo Uber', selected: true, image: 'img/uber-logo.png', color: '#111111' },
  { name: '99 Pop', description: 'Corridas pela 99', selected: true, image: 'img/logo399.png', color: '#E85002' },
  { name: 'InDriver', description: 'Corridas negociadas pelo app', selected: true, image: 'img/indrive logo.png', color: '#FF8B25' },
  { name: 'Particular', description: 'Corridas particulares', selected: true, image: 'img/logoparticular.png', color: '#C84A16' }
];
// As quatro modalidades principais fazem parte do produto, mesmo em contas antigas
// que ainda não possuem todos os documentos de origem.
export function canonicalRideOriginName(name) {
  const key = String(name || '').trim().toLocaleLowerCase('pt-BR').replace(/[\s-]/g, '');
  if (key === 'uber') return 'Uber';
  if (key === '99' || key === '99pop') return '99 Pop';
  if (key === 'indriver' || key === 'indrive') return 'InDriver';
  if (key === 'particular') return 'Particular';
  return String(name || '').trim();
}

// Quatro opções padrão sempre disponíveis no cadastro, mas o usuário escolhe
// quais origens aparecem nos gráficos (limite de cinco). A escolha é persistida.
export function availableRideOrigins(storedOrigins = []) {
  const stored = Array.isArray(storedOrigins) ? storedOrigins : [];
  const result = defaultOrigins.map(base => {
    const existing = stored.find(item => canonicalRideOriginName(item?.name) === base.name);
    return { ...base, ...(existing || {}), name:base.name, image:base.image, selected:existing?.selected !== false };
  });
  const names = new Set(result.map(item => item.name.toLocaleLowerCase('pt-BR')));
  for (const origin of stored) {
    const key = canonicalRideOriginName(origin?.name).toLocaleLowerCase('pt-BR');
    if (key && !names.has(key)) { result.push(origin); names.add(key); }
  }
  return result;
}

export const defaultPaymentMethods = [
  { name: 'Dinheiro', description: 'Recebimentos ou pagamentos em espécie' },
  { name: 'Cartão de crédito', description: 'Pagamentos feitos no cartão' },
  { name: 'Pix', description: 'Pagamentos instantâneos' }
];
export const defaultExpenseCategories = [
  { name: 'Combustível', description: 'Abastecimentos do carro', type: 'Custo variável' }, { name: 'Alimentação', description: 'Refeições durante a jornada', type: 'Custo variável' }, { name: 'Lavagem', description: 'Limpeza do veículo', type: 'Custo variável' }, { name: 'Outro', description: 'Outros gastos do dia a dia', type: 'Custo variável' }, { name: 'Aluguel/Prestação', description: 'Prestação ou aluguel do veículo', type: 'Custo fixo' }, { name: 'Salário / Prolabore', description: 'Retirada pessoal planejada', type: 'Custo fixo' }, { name: 'Seguro', description: 'Seguro do veículo', type: 'Custo fixo' }, { name: 'IPVA', description: 'Imposto anual do veículo', type: 'Custo fixo' }, { name: 'Tag (SemParar)', description: 'Pedágios e tags', type: 'Custo variável' }, { name: 'Férias', description: 'Reserva para descanso', type: 'Custo fixo' }, { name: 'Internet', description: 'Plano de dados usado no trabalho', type: 'Custo fixo' }, { name: 'MEI / Imposto', description: 'Guias, impostos e obrigações', type: 'Custo fixo' }, { name: 'Licenciamento', description: 'Licenciamento do veículo', type: 'Custo fixo' }, { name: 'Manutenção', description: 'Peças, serviços e revisões', type: 'Custo variável' }, { name: 'Reserva de Emergência', description: 'Reserva financeira do motorista', type: 'Custo fixo' }, { name: 'Multas', description: 'Infrações e cobranças', type: 'Custo variável' }, { name: '13º Salário', description: 'Reserva anual planejada', type: 'Custo fixo' }, { name: 'Investimento', description: 'Investimentos no negócio', type: 'Custo fixo' }
];

export function formatCurrency(value){ const n=Number(value||0); return n?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'R$ -'; }
export function formatCurrencyFull(value){ return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
export function parseCurrency(input){ const digits=String(input||'').replace(/\D/g,''); return Number(digits||0)/100; }
export function currencyMask(input){ input.value=formatCurrencyFull(parseCurrency(input.value)); }
export function timeMask(input){ const d=String(input.value||'').replace(/\D/g,'').slice(0,4); input.value=!d?'':(d.length<=2?d:d.slice(0,2)+':'+d.slice(2)); }
export function parseLocalDate(value){ if(value instanceof Date) return new Date(value.getFullYear(),value.getMonth(),value.getDate()); const text=String(value||''); const m=text.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); const d=new Date(value); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
export function todayISO(){ return toISODate(new Date()); }
export function formatDate(date){ return parseLocalDate(date).toLocaleDateString('pt-BR'); }
export function toISODate(date){ const d=parseLocalDate(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function getWeekday(date){ return parseLocalDate(date).toLocaleDateString('pt-BR',{weekday:'long'}); }
export function syncSelectedFromDate(date){ const d=parseLocalDate(date); state.selectedDate=d; state.selectedYear=d.getFullYear(); state.selectedMonth=d.getMonth(); state.selectedWeek=getWeekNumber(d); }
export function parseTime(input){ const raw=String(input||'').trim(); if(raw==='0'||raw==='00'||raw==='00:00'||raw==='') return 0; const digits=raw.replace(/\D/g,'').padStart(4,'0'); const hours=Number(digits.slice(0,-2)); const minutes=Number(digits.slice(-2)); if(minutes>59||hours>23) return null; return hours*60+minutes; }
export function formatTime(minutes){ const total=Math.max(0,Number(minutes||0)); return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0'); }
// Duração financeira: HH:MM; quando há segundos, HH:MM:SS. Nunca exibe frações decimais.
export function formatWorkedDuration(minutes) {
  const raw = Number(minutes || 0);
  if (!Number.isFinite(raw) || raw < 0) return '00:00';
  const seconds = Math.max(0, Math.round(raw * 60));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const sec = seconds % 60;
  return `${hours}:${mins}${sec ? ':' + String(sec).padStart(2, '0') : ''}`;
}
export function formatDuration(seconds){ const h=String(Math.floor(seconds/3600)).padStart(2,'0'); const m=String(Math.floor((seconds%3600)/60)).padStart(2,'0'); const s=String(seconds%60).padStart(2,'0'); return `${h}:${m}:${s}`; }
export function safeDivide(a,b){ return Number(b)?Number(a||0)/Number(b):0; }
export function percent(value,total){ return total?Math.round((value/total)*100):0; }

// Não fixa o body: no iOS, restaurar scrollTo após position:fixed pode
// deixar a tela principal fora do viewport (parecendo uma tela preta/vazia).
function hasOpenModal() {
  return Array.from(document.querySelectorAll('.modal')).some(modal => !modal.classList.contains('hidden'));
}
export function syncModalLock() {
  const body = document.body;
  const shouldLock = hasOpenModal();
  body.classList.toggle('modal-open', shouldLock);
  if (!shouldLock) {
    body.style.removeProperty('top');
    body.removeAttribute('data-modal-scroll-y');
    document.documentElement.style.removeProperty('--modal-lock-top');
  }
}
export function openModal(modal) {
  if (!modal) return;
  // Capture viewport position before the iPhone keyboard and overlay can resize it.
  if (modal.classList.contains('hidden') && modal.dataset) modal.dataset.returnScrollY = String(window.scrollY || 0);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  syncModalLock();
  // Em iOS/Safari, a rolagem da abertura anterior pode ser reaproveitada.
  // Sempre começar no cabeçalho, sem esconder o começo do formulário.
  const scrollAreas = [modal, modal.querySelector?.('.modal-card'), modal.querySelector?.('#formModalContent')];
  for (const area of scrollAreas) {
    if (area) { area.scrollTop = 0; area.scrollLeft = 0; }
  }
}
export function closeModal(modal) {
  if (!modal) return;
  const wasOpen = !modal.classList.contains('hidden');
  const scrollBefore = Number(modal.dataset?.returnScrollY || 0);
  if (modal.contains?.(document.activeElement)) document.activeElement?.blur?.();
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (modal.dataset) delete modal.dataset.returnScrollY;
  syncModalLock();
  if (!wasOpen || hasOpenModal()) return;
  // The modal's close must not leave an inactive or offscreen application.
  if (state.user) {
    const active = document.querySelector('.screen.active-screen');
    if (!active || active.id !== state.currentView) {
      document.querySelectorAll('.screen').forEach(screen =>
        screen.classList.toggle('active-screen', screen.id === state.currentView));
    }
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
    if (typeof window.scrollTo !== 'function') return;
    const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.max(0, Math.min(scrollBefore, maximum)));
  });
}

export function showToast(message){ const el=document.getElementById('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.classList.remove('show'),2600); }
export function openConfirmModal(message,onConfirm,options={}){ const modal=document.getElementById('confirmModal'); const titleEl=document.getElementById('confirmTitle'); const textEl=document.getElementById('confirmText'); const actionEl=document.getElementById('confirmAction'); const cancelEl=document.getElementById('confirmCancel'); const config=typeof options==='string'?{title:options}:options||{}; if(titleEl) titleEl.textContent=config.title||'Excluir este item?'; if(textEl) textEl.textContent=message||'Essa ação não poderá ser desfeita.'; if(actionEl) actionEl.textContent=config.confirmText||'Excluir'; if(cancelEl) cancelEl.textContent=config.cancelText||'Cancelar'; openModal(modal); const close=()=>{ closeModal(modal); if(actionEl) actionEl.onclick=null; if(cancelEl) cancelEl.onclick=null; }; if(cancelEl) cancelEl.onclick=()=>{ close(); config.onCancel?.(); }; if(actionEl) actionEl.onclick=()=>{ close(); onConfirm?.(); }; }
function weeksBeforeMonth(year, month){ let total=0; for(let m=0;m<Number(month);m+=1) total += Math.ceil(new Date(Number(year),m+1,0).getDate()/7); return total; }
export function getWeekNumber(date){ const d=parseLocalDate(date); return weeksBeforeMonth(d.getFullYear(), d.getMonth()) + Math.ceil(d.getDate()/7); }
export function getWeeksInMonth(year,month){ const total=Math.ceil(new Date(Number(year),Number(month)+1,0).getDate()/7); const start=weeksBeforeMonth(year, month)+1; return Array.from({length:total},(_,index)=>({ week:start+index, month:Number(month), label:`Semana ${start+index}` })); }
export function weeksRealInMonth(year,month){ return new Date(year,month+1,0).getDate()/7; }
export function getMonthFromWeek(year, week){ let current=1; for(let month=0;month<12;month+=1){ const count=Math.ceil(new Date(Number(year),month+1,0).getDate()/7); if(Number(week)>=current && Number(week)<current+count) return month; current += count; } return 11; }
export function getISOWeekStart(year,week){ const month=getMonthFromWeek(year, week); const monthStart=weeksBeforeMonth(year, month)+1; const index=Math.max(0, Number(week)-monthStart); const start=new Date(Number(year), month, index*7+1); start.setHours(0,0,0,0); return start; }
export function getPeriodRange(period){ const selected=parseLocalDate(state.selectedDate); if(period==='daily'){ const start=new Date(selected.getFullYear(),selected.getMonth(),selected.getDate()); const end=new Date(start); end.setDate(end.getDate()+1); return {start,end}; } if(period==='weekly'){ const start=getISOWeekStart(state.selectedYear,state.selectedWeek); const month=start.getMonth(); const end=new Date(start); end.setDate(start.getDate()+7); const monthEnd=new Date(Number(state.selectedYear),month+1,1); return {start,end:end>monthEnd?monthEnd:end}; } if(period==='monthly') return {start:new Date(Number(state.selectedYear),Number(state.selectedMonth),1),end:new Date(Number(state.selectedYear),Number(state.selectedMonth)+1,1)}; return {start:new Date(Number(state.selectedYear),0,1),end:new Date(Number(state.selectedYear)+1,0,1)}; }
export function filterByPeriod(items,period){ const {start,end}=getPeriodRange(period); return items.filter(item=>{ const d=parseLocalDate(item.date); return d>=start&&d<end; }); }
export function groupSum(items,keyName,valueName='value'){ return items.reduce((acc,item)=>{ const key=item[keyName]||'Sem categoria'; acc[key]=fromCents(toCents(acc[key])+toCents(item[valueName])); return acc; },{}); }
// Valores armazenados continuam em reais para compatibilidade; operações usam centavos inteiros.
export function toCents(value) { const n=Number(value||0); if (!Number.isFinite(n) || Math.abs(n)>100000000) throw new Error('Valor monetário inválido.'); return Math.round((n+Number.EPSILON)*100); }
export function fromCents(cents) { return Number(cents)/100; }
export function sumMoney(items) { return fromCents(items.reduce((sum,item)=>sum+toCents(item?.value),0)); }
export function buildRidePayload(input) {
  const fare = toCents(input.fare);
  const tip = toCents(input.tip || 0);
  const km = Number(input.km || 0);
  const origin = String(input.origin || '').trim();
  const date = String(input.date || '').trim();
  const rideTime = String(input.rideTime || '').trim();
  const note = String(input.note || '').trim();
  const parsed = parseLocalDate(date);
  if (fare <= 0 || fare > 100000000) throw new Error('Informe o valor da corrida.');
  if (tip < 0 || tip > 100000000) throw new Error('Gorjeta inválida.');
  if (!origin || origin.length > 120) throw new Error('Selecione o aplicativo da corrida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || toISODate(parsed)!==date) throw new Error('Confira a data.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(rideTime)) throw new Error('Confira o horário.');
  if (!Number.isFinite(km) || km < 0 || km > 100000) throw new Error('Distância inválida.');
  if (note.length > 5000) throw new Error('Observação muito longa.');
  return { date, weekday:getWeekday(date), origin, value:fromCents(fare+tip),
    fare:fromCents(fare), tip:fromCents(tip), rideTime, entryType:'ride', trips:1,
    km:Math.round(km*100)/100, minutes:0, note };
}

// A mesma jornada não pode ser contabilizada duas vezes. Em dias com sessões
// registradas, a coleção drivingSessions é a fonte de horas; entradas antigas
// com minutos continuam sendo lidas quando ainda não existe sessão nesse dia.
export function totalWorkMinutes(entries = [], sessions = []) {
  const sessionDates = new Set(sessions.map(item => item.startDate).filter(Boolean));
  const recordedSeconds = sessions.reduce((sum, item) => sum + Math.max(0, Number(item.totalSeconds || 0)), 0);
  const legacyMinutes = entries.reduce((sum, item) => sum + (sessionDates.has(item.date) ? 0 : Math.max(0, Number(item.minutes || 0))), 0);
  return recordedSeconds / 60 + legacyMinutes;
}

// Divide intervalos efetivamente trabalhados pela meia-noite LOCAL.
// Pausas não entram na contagem; sessões antigas sem intervalos são tratadas
// como tempo realizado no dia inicial, sem alterar documentos existentes.
export function splitWorkIntervalsByDay(intervals = []) {
  const days = new Map();
  for (const range of intervals) {
    let cursor = Number(range.start), end = Number(range.end);
    if (!Number.isFinite(cursor) || !Number.isFinite(end) || end <= cursor) continue;
    if (end - cursor > 1000 * 60 * 60 * 24 * 90) throw new Error('Jornada muito longa para registrar.');
    while (cursor < end) {
      const date = new Date(cursor);
      const key = toISODate(date);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const until = Math.min(end, midnight);
      const record = days.get(key) || { date:key, ms:0, start:cursor, end:until };
      record.ms += until - cursor;
      record.start = Math.min(record.start, cursor);
      record.end = Math.max(record.end, until);
      days.set(key, record);
      cursor = until;
    }
  }
  return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(item => ({
    date:item.date, totalSeconds:Math.max(1, Math.round(item.ms/1000)),
    startTime: new Date(item.start).toTimeString().slice(0,5),
    endTime: new Date(item.end).toTimeString().slice(0,5)
  }));
}

export function calculateDashboard(period){ const entries=filterByPeriod(state.entries,period); const expenses=filterByPeriod(state.expenses,period); const revenue=sumMoney(entries); const costs=sumMoney(expenses); const balance=fromCents(toCents(revenue)-toCents(costs)); const trips=entries.reduce((s,e)=>s+Number(e.trips||0),0); const km=entries.reduce((s,e)=>s+Number(e.km||0),0); const minutes=totalWorkMinutes(entries, filterByPeriod(state.drivingSessions.map(item => ({...item, date:item.startDate})),period)); const hours=minutes/60; const goal=getGoalValue(period); const perf=goal?Math.round((balance/goal)*100):0; return {entries,expenses,revenue,costs,balance,trips,km,minutes,hours,goal,perf}; }
export function getGoalValue(period){ const year=state.selectedYear; if(period==='daily'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); if(!monthly) return 0; return safeDivide(safeDivide(Number(monthly.revenueGoal||0),weeksRealInMonth(year,state.selectedMonth)),Number(monthly.workDays||6)); } if(period==='weekly'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); return monthly?safeDivide(Number(monthly.revenueGoal||0),weeksRealInMonth(year,Number(monthly.month))):0; } if(period==='monthly'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); return Number(monthly?.revenueGoal||0); } return state.goals.filter(g=>Number(g.year)===year).reduce((s,g)=>s+Number(g.revenueGoal||0),0); }
export function daysRemainingInPeriod(period){ const today=new Date(); const {end}=getPeriodRange(period); return Math.max(0,Math.ceil((end-today)/86400000)); }
export function normalizeDoc(doc){ return {id:doc.id,...doc.data()}; }
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}

// Refuse executable schemes and SVG. Existing local images and HTTPS URLs are supported.
export function safeImageSource(value) {
  const url = String(value || '').trim();
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= 800000) return url;
  if (/^img\/[A-Za-z0-9_.%/ -]+$/.test(url) && !url.includes('..')) return url;
  if (url.startsWith('https://')) {
    try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; }
    catch { return ''; }
  }
  return '';
}

export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return reject(new Error('Selecione uma imagem JPG, PNG ou WebP.'));
    }
    if (file.size > 520 * 1024) {
      return reject(new Error('A imagem deve ter até 520 KB para ser salva.'));
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!safeImageSource(result)) reject(new Error('Não foi possível validar a imagem.'));
      else resolve(result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}
export function icon(name,cls=''){ const p={folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',car:'<path d="M7 17h10"/><path d="M5 17H3v-4l2-1 2-5h10l2 5 2 1v4h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',swap:'<path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/><path d="M20 7l-3 3"/><path d="M4 17l3-3"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.6.1-1Z"/>',chevron:'<path d="m9 6 6 6-6 6"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',tag:'<path d="M20 10 14 4H5v9l6 6 9-9Z"/>',user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>',card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',moon:'<path d="M21 12.8A8 8 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',filter:'<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',back:'<path d="m14 6-6 6 6 6"/><path d="M8 12h10"/>'}; return `<svg class="svg-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||''}</svg>`; }
export function renderEmpty(text){ return `<div class="empty-state">${icon('folder')}<p>${text}</p></div>`; }
window.RodaPayUtils={state,showToast};
