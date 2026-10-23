const test=require('node:test');const assert=require('node:assert/strict');
process.env.OPENAI_API_KEY='';process.env.OPENROUTER_API_KEY='';process.env.ANTHROPIC_API_KEY='';
const svc=require('../server/services/wave50c');
test('tasks create/list/update + search/filter + export + sections',()=>{
 const a=svc.store.create('u1',{title:'Alpha task',progress:0,done:false});const b=svc.store.create('u1',{title:'Beta',status:'done'});
 assert.equal(svc.filterTasks(svc.store.list('u1'),{q:'alpha'}).length,1);
 assert.equal(svc.filterTasks(svc.store.list('u1'),{status:'done'}).length,1);
 assert.equal(svc.store.update('u1',a.id,{status:'doing'}).status,'doing');
 assert.ok(svc.toCSV(svc.store.list('u1')).includes('Alpha task'));assert.equal(JSON.parse(svc.toJSON(svc.store.list('u1'))).count,2);
 const s=svc.labelledSections(a);assert.equal(s.find(x=>x.label==='Done').value,false);assert.equal(s.find(x=>x.label==='Progress').value,0);
});
test('domain AI fallback is labelled aiGenerated:false',()=>{
 const rs=[svc.aiDeductionChecklist(svc.store.list('u1')),svc.aiDocCompleteness(svc.store.list('u1')),svc.aiEstimateSummary(svc.store.list('u1'))];
 rs.forEach(r=>{assert.equal(r.aiGenerated,false);assert.ok(r.label);});
});

test('tax guard present on every AI fallback',()=>{const svc2=require('../server/services/wave50c');[svc2.aiDeductionChecklist([]),svc2.aiDocCompleteness([]),svc2.aiEstimateSummary([])].forEach(r=>assert.match(r.guard,/Not tax advice/));});
