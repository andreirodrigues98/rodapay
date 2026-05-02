const initialToday = new Date();

export const state = {
  user: null,
  currentView: 'dashboardView',
  period: localStorage.getItem('rodapay.period') || 'daily',
  transactionTab: 'entries',
  transactionFilter: 'all',
  goalTab: 'weekly',
  selectedDate: initialToday,
  selectedWeek: getWeekNumber(initialToday),
  selectedMonth: initialToday.getMonth(),
  selectedYear: initialToday.getFullYear(),
  entries: [], expenses: [], origins: [], paymentMethods: [], expenseCategories: [], goals: [], drivingSessions: [],
  settings: { incomeTaxRate: 0.6, lightMode: false }
};

export const defaultOrigins = [
  { name: 'Uber', description: 'Corridas pelo aplicativo Uber', selected: true, image: 'img/uber-logo.png', color: '#1D7CFF' },
  { name: '99 Pop', description: 'Corridas pela 99', selected: true, image: 'img/logo399.png', color: '#FF9F1A' },
  { name: 'InDriver', description: 'Corridas negociadas pelo app', selected: true, image: 'img/indrive logo.png', color: '#00D66B' },
  { name: 'Particular', description: 'Corridas particulares', selected: true, image: 'img/logoparticular.png', color: '#8AA4C8' }
];
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
export function formatDuration(seconds){ const h=String(Math.floor(seconds/3600)).padStart(2,'0'); const m=String(Math.floor((seconds%3600)/60)).padStart(2,'0'); const s=String(seconds%60).padStart(2,'0'); return `${h}:${m}:${s}`; }
export function safeDivide(a,b){ return Number(b)?Number(a||0)/Number(b):0; }
export function percent(value,total){ return total?Math.round((value/total)*100):0; }

let modalLockScrollY = 0;
function hasOpenModal(){ return Array.from(document.querySelectorAll('.modal')).some(modal => !modal.classList.contains('hidden')); }
export function syncModalLock(){
  const body = document.body;
  const shouldLock = hasOpenModal();
  if (shouldLock && !body.classList.contains('modal-open')) {
    modalLockScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    body.dataset.modalScrollY = String(modalLockScrollY);
    document.documentElement.style.setProperty('--modal-lock-top', '-' + modalLockScrollY + 'px');
    body.classList.add('modal-open');
  }
  if (!shouldLock && body.classList.contains('modal-open')) {
    const y = Number(body.dataset.modalScrollY || modalLockScrollY || 0);
    body.classList.remove('modal-open');
    body.removeAttribute('data-modal-scroll-y');
    document.documentElement.style.removeProperty('--modal-lock-top');
    window.scrollTo(0, y);
  }
}
export function openModal(modal){ if(!modal) return; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); syncModalLock(); }
export function closeModal(modal){ if(!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); syncModalLock(); }

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
export function groupSum(items,keyName,valueName='value'){ return items.reduce((acc,item)=>{ const key=item[keyName]||'Sem categoria'; acc[key]=(acc[key]||0)+Number(item[valueName]||0); return acc; },{}); }
export function calculateDashboard(period){ const entries=filterByPeriod(state.entries,period); const expenses=filterByPeriod(state.expenses,period); const revenue=entries.reduce((s,e)=>s+Number(e.value||0),0); const costs=expenses.reduce((s,e)=>s+Number(e.value||0),0); const balance=revenue-costs; const trips=entries.reduce((s,e)=>s+Number(e.trips||0),0); const km=entries.reduce((s,e)=>s+Number(e.km||0),0); const minutes=entries.reduce((s,e)=>s+Number(e.minutes||0),0); const hours=minutes/60; const goal=getGoalValue(period); const perf=goal?Math.round((balance/goal)*100):0; return {entries,expenses,revenue,costs,balance,trips,km,minutes,hours,goal,perf}; }
export function getGoalValue(period){ const year=state.selectedYear; if(period==='daily'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); if(!monthly) return 0; return safeDivide(safeDivide(Number(monthly.revenueGoal||0),weeksRealInMonth(year,state.selectedMonth)),Number(monthly.workDays||6)); } if(period==='weekly'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); return monthly?safeDivide(Number(monthly.revenueGoal||0),weeksRealInMonth(year,Number(monthly.month))):0; } if(period==='monthly'){ const monthly=state.goals.find(g=>Number(g.year)===year&&Number(g.month)===state.selectedMonth); return Number(monthly?.revenueGoal||0); } return state.goals.filter(g=>Number(g.year)===year).reduce((s,g)=>s+Number(g.revenueGoal||0),0); }
export function daysRemainingInPeriod(period){ const today=new Date(); const {end}=getPeriodRange(period); return Math.max(0,Math.ceil((end-today)/86400000)); }
export function normalizeDoc(doc){ return {id:doc.id,...doc.data()}; }
export function imageToBase64(file){ return new Promise((resolve,reject)=>{ if(!file) return resolve(''); const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }
export function icon(name,cls=''){ const p={folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',car:'<path d="M7 17h10"/><path d="M5 17H3v-4l2-1 2-5h10l2 5 2 1v4h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',swap:'<path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/><path d="M20 7l-3 3"/><path d="M4 17l3-3"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.6.1-1Z"/>',chevron:'<path d="m9 18 6-6-6-6"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',tag:'<path d="M20 10 14 4H5v9l6 6 9-9Z"/>',user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>',card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',moon:'<path d="M21 12.8A8 8 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',filter:'<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',back:'<path d="M15 18l-6-6 6-6"/>'}; return `<svg class="svg-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||''}</svg>`; }
export function renderEmpty(text){ return `<div class="empty-state">${icon('folder')}<p>${text}</p></div>`; }
window.RodaPayUtils={state,showToast};
