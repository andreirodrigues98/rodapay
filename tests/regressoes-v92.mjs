import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window={};
const { availableRideOrigins, defaultExpenseCategories, defaultOrigins, openModal, closeModal } = await import('../utils.js');

test('Uber, 99 Pop, InDriver e Particular estão disponíveis mesmo sem cadastros antigos',()=>{
  const items=availableRideOrigins([]);
  assert.deepEqual(items.map(item=>item.name).slice(0,4),['Uber','99 Pop','InDriver','Particular']);
  assert.ok(items.slice(0,4).every(item=>item.image.startsWith('img/')));
  const stored=[{name:'Uber',color:'#000000',selected:false,image:'img/invalida.png'},
    {name:'Meu aplicativo',selected:true,image:''}];
  const result=availableRideOrigins(stored);
  assert.equal(result.filter(x=>x.name==='Uber').length,1);
  assert.equal(result.find(x=>x.name==='Uber').image,'img/uber-logo.png');
  assert.ok(result.some(x=>x.name==='Meu aplicativo'));
});

test('categorias sugeridas de saída continuam no projeto e não são recriadas automaticamente',()=>{
  assert.ok(defaultExpenseCategories.length>=12);
  for(const name of ['Combustível','Manutenção','Alimentação','IPVA']){
    assert.ok(defaultExpenseCategories.some(x=>x.name===name));
  }
  assert.equal(defaultOrigins.length,4);
});

test('abrir e fechar formulários não fixa body nem deixa modal invisível ativo',()=>{
  const classes=new Set();
  const bodyClasses={contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)};
  const style={removeProperty:()=>{}};
  const modal={classes:new Set(['hidden']),classList:null,attrs:{},setAttribute(k,v){this.attrs[k]=v}};
  modal.classList={contains:x=>modal.classes.has(x),add:x=>modal.classes.add(x),remove:x=>modal.classes.delete(x)};
  globalThis.document={body:{classList:bodyClasses,style,removeAttribute:()=>{}},
    documentElement:{style},querySelectorAll:()=>[modal]};
  openModal(modal);
  assert.equal(bodyClasses.contains('modal-open'),true);
  closeModal(modal);
  assert.equal(bodyClasses.contains('modal-open'),false);
  assert.equal(modal.classList.contains('hidden'),true);
  assert.equal(modal.attrs['aria-hidden'],'true');
  openModal(modal);closeModal(modal);
  assert.equal(bodyClasses.contains('modal-open'),false);
});
