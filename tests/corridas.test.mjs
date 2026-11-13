import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = {getItem:()=>null, setItem:()=>{}};
globalThis.window = {};
const {buildRidePayload,toCents,fromCents,sumMoney,state,calculateDashboard} = await import('../utils.js');
const ride = (overrides={}) => buildRidePayload({date:'2026-11-12',rideTime:'09:41',origin:'Uber',fare:12.35,tip:2.65,km:7.25,note:'',...overrides});
test('corrida tem uma viagem, hora é opcional e gorjeta soma uma só vez',()=>{
  const value=ride();
  assert.deepEqual([value.value,value.fare,value.tip,value.trips,value.minutes,value.km,value.entryType],[15,12.35,2.65,1,0,7.25,'ride']);
});
test('cálculo em centavos evita erros da soma decimal no painel',()=>{
  assert.equal(toCents(0.1)+toCents(0.2),30);
  assert.equal(fromCents(30),.3);
  assert.equal(sumMoney([{value:0.1},{value:0.2}]),.3);
});
test('corrida nova respeita o modelo do dashboard sem duplicar gorjeta',()=>{
  Object.assign(state, { selectedDate:new Date(2026,10,12),selectedMonth:10,selectedYear:2026,
    entries:[ride({fare:10,tip:5}),ride({fare:20,tip:0})],expenses:[{date:'2026-11-12',value:3.1}],goals:[]});
  const d=calculateDashboard('daily');
  assert.equal(d.revenue,35);assert.equal(d.trips,2);assert.equal(d.balance,31.9);
});
test('dados inválidos não podem ser gravados como corrida',()=>{
  for(const overrides of [{fare:0},{tip:-1},{km:-2},{date:'2026-02-31'},{rideTime:'25:61'},{origin:''}]) {
    assert.throws(()=>ride(overrides));
  }
});
