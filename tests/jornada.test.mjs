import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window={};
const {splitWorkIntervalsByDay,totalWorkMinutes}=await import('../utils.js');
const local=(y,m,d,h,min=0)=>new Date(y,m-1,d,h,min).getTime();
test('jornada atravessando meia-noite gera um registro por dia',()=>{
  const days=splitWorkIntervalsByDay([{start:local(2026,11,12,23,40),end:local(2026,11,13,0,20)}]);
  assert.deepEqual(days.map(x=>[x.date,x.totalSeconds]),[['2026-11-12',1200],['2026-11-13',1200]]);
});
test('tempo de pausa não é incluído',()=>{
  const days=splitWorkIntervalsByDay([
    {start:local(2026,11,13,8),end:local(2026,11,13,9)},
    {start:local(2026,11,13,10),end:local(2026,11,13,11,30)}
  ]);
  assert.equal(days.length,1);
  assert.equal(days[0].totalSeconds,9000);
});
test('duas sessões do mesmo dia somam corretamente',()=>{
  assert.equal(totalWorkMinutes([],[{startDate:'2026-11-13',totalSeconds:3600},{startDate:'2026-11-13',totalSeconds:5400}]),150);
});
test('sessão registrada não duplica horas antigas em entradas no mesmo dia',()=>{
  const entries=[{date:'2026-11-13',minutes:180},{date:'2026-11-12',minutes:60}];
  assert.equal(totalWorkMinutes(entries,[{startDate:'2026-11-13',totalSeconds:7200}]),180);
});
