'use strict';

const LABEL="Offline deterministic summary (not AI-generated)";
function esc(v){const s=String(v??"");return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function labelledSections(r){return [["Title",r.title??""],["Status",r.status??""],["Priority",r.priority??""],["Done",r.done??false],["Progress",r.progress??0],["Notes",r.notes??""]].map(([label,value])=>({label,value}));}
function renderSections(r){return labelledSections(r).map(s=>`${s.label}: ${s.value===""?"(empty)":String(s.value)}`).join("\n");}
function filterTasks(tasks,{q="",status="",priority=""}={}){const n=String(q).toLowerCase();return tasks.filter(t=>(!n||`${t.title} ${t.notes||""}`.toLowerCase().includes(n))&&(!status||t.status===status)&&(!priority||t.priority===priority));}
function toCSV(tasks){const cols=["id","title","status","priority","done","progress","notes","createdAt","updatedAt"];return [cols.join(","),...tasks.map(t=>cols.map(c=>esc(t[c])).join(","))].join("\n");}
function toJSON(tasks){return JSON.stringify({tasks,count:tasks.length},null,2);}
function createStore(){const byOwner=new Map();let n=0;
 const list=(owner)=>[...(byOwner.get(owner)||[])];
 const create=(owner,input={})=>{const title=String(input.title||"").trim();if(!title)throw new Error("title required");const t={id:`task-${++n}`,owner,title,status:input.status||"todo",priority:input.priority||"normal",done:Boolean(input.done),progress:Number(input.progress||0),notes:String(input.notes||""),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};if(!byOwner.has(owner))byOwner.set(owner,[]);byOwner.get(owner).push(t);return t;};
 const update=(owner,id,patch={})=>{const t=list(owner).find(x=>x.id===id);if(!t)return null;for(const k of["title","status","priority","notes"])if(patch[k]!==undefined)t[k]=String(patch[k]);if(patch.done!==undefined)t.done=Boolean(patch.done);if(patch.progress!==undefined)t.progress=Number(patch.progress);t.updatedAt=new Date().toISOString();return t;};
 return{list,create,update};}
const store=createStore();
const NOT_TAX_ADVICE="Not tax advice — general information only. Consult a qualified tax professional for advice about your situation.";
function aiDeductionChecklist(records){return{aiGenerated:false,label:LABEL,guard:NOT_TAX_ADVICE,feature:"deduction-checklist",items:["Income documents","Deduction receipts","Credit records"],basedOn:records.length};}
function aiDocCompleteness(records){const withNotes=records.filter(r=>String(r.notes||"").trim());return{aiGenerated:false,label:LABEL,guard:NOT_TAX_ADVICE,feature:"document-completeness",total:records.length,withNotes:withNotes.length,complete:records.length>0&&withNotes.length===records.length};}
function aiEstimateSummary(records){const total=records.reduce((a,r)=>a+Number(r.progress||0),0);return{aiGenerated:false,label:LABEL,guard:NOT_TAX_ADVICE,feature:"estimate-summary",taskCount:records.length,progressTotal:total};}

module.exports={store,filterTasks,toCSV,toJSON,labelledSections,renderSections,aiDeductionChecklist,aiDocCompleteness,aiEstimateSummary, NOT_TAX_ADVICE};
