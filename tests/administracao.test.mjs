import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMode, validateUid, validateEmail, allowedOrigin, allowedHost, MAX_BODY_BYTES } from '../admin/security.mjs';
globalThis.localStorage = { getItem:()=>null, setItem:()=>{} };
globalThis.window = {};
const { formatWorkedDuration, calculateDashboard, state } = await import('../utils.js');

test('administração local precisa indicar o ambiente explicitamente', () => {
  assert.deepEqual(parseMode('emulator', 'demo-rodapay'), {mode:'emulator',project:'demo-rodapay',emulator:true});
  assert.throws(()=>parseMode('emulator','rodapay-c5490'));
  assert.throws(()=>parseMode('production','rodapay-c5490'));
  assert.equal(parseMode('production','rodapay-c5490','CONFIRMO-PRODUCAO-RODAPAY').emulator,false);
});
test('painel só aceita host e origem de loopback',()=>{
  assert.equal(allowedHost('127.0.0.1:5601'),true);
  for(const input of ['localhost:5601','exemplo.com','127.0.0.1:5500']) assert.equal(allowedHost(input),false);
  assert.equal(allowedOrigin('http://127.0.0.1:5601'),true);
  assert.equal(allowedOrigin('https://teste.com'),false);
  assert.equal(MAX_BODY_BYTES,8192);
});
test('entradas administrativas inválidas são rejeitadas',()=>{
  assert.equal(validateUid('abc_-20'),'abc_-20');
  assert.equal(validateEmail(' Usuario@EXEMPLO.com '),'usuario@exemplo.com');
  for(const uid of ['../../outro','abc/def','<img>',''])assert.throws(()=>validateUid(uid));
  assert.throws(()=>validateEmail('email-sem-domino'));
});
test('duração de horas não exibe minutos decimais',()=>{
  assert.equal(formatWorkedDuration(37/60),'00:00:37');
  assert.equal(formatWorkedDuration(150),'02:30');
  assert.equal(formatWorkedDuration(60.5),'01:00:30');
  assert.equal(formatWorkedDuration(NaN),'00:00');
});
test('indicadores preservam despesas zero e saldo enquanto não existem custos',()=>{
  Object.assign(state,{selectedDate:new Date(2026,10,13),selectedYear:2026,selectedMonth:10, entries:[{date:'2026-11-13',value:39,trips:2}],expenses:[],goals:[],drivingSessions:[]});
  const data=calculateDashboard('daily');
  assert.equal(data.costs,0);
  assert.equal(data.balance,39);
});
