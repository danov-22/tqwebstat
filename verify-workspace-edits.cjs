const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
function sheet(initial=[]) {
 const rows=initial.map(r=>r.slice());
 return {rows,getLastRow:()=>rows.length,appendRow:r=>rows.push(r.slice()),deleteRow:r=>rows.splice(r-1,1),getRange:(r,c,n=1,w=1)=>({getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>rows[r-1+i]?.[c-1+j]??'')),setValues:values=>values.forEach((v,i)=>v.forEach((x,j)=>{rows[r-1+i]??=[];rows[r-1+i][c-1+j]=x;})),setValue:v=>{rows[r-1]??=[];rows[r-1][c-1]=v;},setRichTextValue:v=>{rows[r-1]??=[];rows[r-1][c-1]=v;}})};
}
const stats=sheet([['headers'],['2026-11-01','alice',1,2,0,0,0,0,0,0,0,0,1,1]]),history=sheet([['headers'],['id','2026-11-01','alice'],['id2','2026-11-01','bob'],['id3','2026-11-02','alice']]);
const sheets=new Map();let version=0;
const context={console,Date,Number,JSON,SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet();sheets.set(n,s);return s;},getSpreadsheetTimeZone:()=> 'UTC'}),flush(){},newRichTextValue:()=>({setText:text=>({build:()=>text})})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Utilities:{getUuid:()=>String(++version)}};
vm.createContext(context);vm.runInContext(fs.readFileSync('code.gs','utf8'),context);
context.chatUser_=token=>{if(token!=='valid')throw Error('Unauthorized');return 'alice';};context.jsonResponse=x=>x;context.ensureSheets=()=>({statsSheet:stats,historySheet:history});context.findStatsRow=(_,date,user)=>stats.rows.findIndex((r,i)=>i>0&&r[0]===date&&r[1]===user)+1||-1;context.toDateStr=x=>x;context.clearStatsCache=()=>{};
const call=body=>context.workspaceEdit_({token:'valid',...body});
assert.equal(call({action:'getExtendedNotes'}).text,'');
const saved=call({action:'saveExtendedNotes',text:'=literal note',version:''});assert.ok(saved.success);
assert.equal(call({action:'getExtendedNotes'}).text,'=literal note');
assert.match(call({action:'saveExtendedNotes',text:'stale edit',version:''}).error,/changed/);
assert.equal(call({action:'saveExtendedNotes',text:'=literal note',version:''}).version,saved.version);
assert.throws(()=>context.workspaceEdit_({action:'getExtendedNotes',token:'bad'}),/Unauthorized/);
const keys=['ql','vm','snr','ni','hu','dnc','ooo','lb','fe','wn','fp','mp'];
const previous=Object.fromEntries(keys.map((k,i)=>[k,stats.rows[1][i+2]])),counts={...previous,vm:8,ni:3};
assert.ok(call({action:'setDailyCounts',date:'2026-11-01',previous,counts}).success);
assert.equal(stats.rows[1][3],8);assert.equal(stats.rows[1][5],3);assert.equal(history.rows.length,3);assert.equal(history.rows[1][2],'bob');
assert.ok(call({action:'setDailyCounts',date:'2026-11-01',previous,counts}).success);
assert.match(call({action:'setDailyCounts',date:'2026-11-01',previous,counts:{...counts,vm:9}}).error,/changed/);
assert.match(call({action:'setDailyCounts',date:'2026-11-01',previous:counts,counts:{...counts,vm:-1}}).error,/whole/);
assert.match(call({action:'setDailyCounts',date:'2026-02-30',previous,counts}).error,/valid date/);
console.log('Passed: server notes, literal text, authentication, concurrent-edit protection, retry safety, daily total mapping, validation, and selective Undo cleanup.');

// Exercise the dedicated browser RPC, independent of the HTTP action router.
context.jsonResponse=value=>({getContent:()=>JSON.stringify(value)});
assert.equal(context.serverExtendedNotes({action:'getExtendedNotes',token:'valid'}).text,'=literal note');
assert.match(context.serverExtendedNotes({action:'getExtendedNotes',token:'bad'}).error,/Unauthorized/);
assert.match(context.serverExtendedNotes({action:'setDailyCounts',token:'valid'}).error,/Invalid notes action/);
console.log('Passed: direct notes RPC loading, authentication failures, and action allowlist.');
