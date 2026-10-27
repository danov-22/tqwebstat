const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync('code.gs', 'utf8');
let deleted = [], released = 0;
let data = [['id','2026-10-24','a','vm',false,false,''],['id','2026-10-26','a','ni',true,true,''],['id','2026-10-25','b','vm',false,false,''],['id','bad date','b','vm',false,false,'']];
const sheet = {getLastRow:()=>data.length+1, getMaxRows:()=>40260,
 getRange:()=>({getValues:()=>data.map(r=>r.slice())}),
 deleteRows:(start,n)=>{deleted.push([start,n]); if(start<=data.length+1)data.splice(start-2,n);}};
const context = {console, Number, Date, SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>sheet,getSpreadsheetTimeZone:()=> 'UTC'})},
 Utilities:{formatDate:()=> '2026-10-26'}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){released++;}})}};
vm.createContext(context); vm.runInContext(source,context);
assert.equal(context.cleanupStatHistory().removed,2);
assert.equal(data.length,2); assert.equal(data[0][1],'2026-10-26'); assert.equal(data[1][1],'bad date');
assert.deepEqual(deleted,[[4,1],[2,1],[4,40257]]); assert.equal(released,1);
let saved;
context.ensureSheets=()=>({notesSheet:{getLastRow:()=>2,getRange:(row,col)=>col===4?{setRichTextValue:v=>saved=v}:{getValues:()=>[['2026-10-26','Alice',1,'old']]}}});
context.SpreadsheetApp.getActive=()=>({getSpreadsheetTimeZone:()=> 'UTC'});
context.SpreadsheetApp.newRichTextValue=()=>({setText(t){return {build:()=>t};}});
context.SpreadsheetApp.flush=()=>{};
context.clearStatsCache=()=>{};
context.jsonResponse=x=>x;
assert.equal(context.editQLNote_({date:'2026-10-26',username:'alice',leadNumber:1,note:'=literal',previousNote:'old'}).success,true);
assert.equal(saved,'=literal');
assert.match(context.editQLNote_({date:'2026-10-26',username:'alice',leadNumber:1,note:'new',previousNote:'stale'}).error,/changed/);
assert.match(context.editQLNote_({date:'2026-10-26',username:'bob',leadNumber:1,note:'new'}).error,/no longer/);
console.log('Passed: history retention, blank-row trimming, literal lead edits, conflict detection, user isolation.');
const html = fs.readFileSync('script.html','utf8');
const extract = name => html.slice(html.indexOf('function '+name+'('), html.indexOf('\n}',html.indexOf('function '+name+'('))+2);
const ui = {Date,Number,Array,String,normalizeMonthlyData: rows=>rows.slice().sort((a,b)=>a.date.localeCompare(b.date)),escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')};
vm.createContext(ui);
vm.runInContext(extract('calendarDays')+'\n'+extract('monthlyReportHTML'),ui);
assert.equal(ui.calendarDays('2024-02',[]).length,29);
assert.equal(ui.calendarDays('2026-02',[]).length,28);
assert.equal(ui.calendarDays('2026-10',[{date:'2026-10-03',ql:4},{date:'2026-09-03',ql:8}])[2].count,4);
const report = ui.monthlyReportHTML('2026-10','Alice',{days:[{date:'2026-10-03',ql:4,fp:2},{date:'2026-09-03',ql:99}],ql_notes:[{date:'2026-10-03',leadNumber:1,note:'<script>bad</script>\n日本語'},{date:'2026-09-03',leadNumber:1,note:'excluded note'}]});
assert.ok(report.includes('Monthly total')); assert.ok(report.includes('日本語')); assert.ok(report.includes('&lt;script&gt;')); assert.ok(!report.includes('<script>bad')); assert.ok(!report.includes('excluded note')); assert.ok(!report.includes('2026-09-03'));
assert.ok(ui.monthlyReportHTML('2026-10','Alice',{}).includes('No lead notes recorded'));
console.log('Passed: leap-year calendars, monthly lead counts, PDF report month filtering, escaped notes, international text, empty reports.');

const renamedReport = ui.monthlyReportHTML('2026-09','trevor lee',{});
assert.ok(renamedReport.includes('<title>Monthly Report, September</title>'));
assert.ok(renamedReport.includes('<h1>TQ Web Stat - Monthly report</h1>'));
assert.ok(renamedReport.includes('<p>Trevor Lee</p>'));
assert.ok(renamedReport.includes('<h2>Qualified Lead Notes</h2>'));
assert.ok(renamedReport.includes('Qualified leads -- VM:'));
assert.ok(renamedReport.includes('@page{size:A4 landscape;margin:0}'));
console.log('Passed: PDF title, user capitalization, report headings, ASCII separators, and print margins.');

const blankNoteReport = ui.monthlyReportHTML('2026-09', 'sample user', {
  ql_notes: [{date:'2026-09-02', leadNumber:1, note:''}]
});
assert.ok(blankNoteReport.includes('<td class="note">No note added</td>'));
assert.ok(!blankNoteReport.includes('<td class="note">?</td>'));
console.log('Passed: empty lead notes export as readable text instead of a question mark.');
// Chat authorization and lifecycle checks run against isolated sheet/cache mocks.
const chatData = [], cache = new Map();
let uuidCounter = 0;
const chatSheet = {
 getLastRow:()=>chatData.length+1, getMaxRows:()=>10000,
 getRange:(r,c,n,w)=>({
   getValues:()=>chatData.slice(r-2,r-2+n).map(row=>row.slice(c-1,c-1+w)),
   setValues:values=>values.forEach((row,i)=>chatData[r-2+i]=row.slice()),
   setRichTextValue:value=>chatData[r-2][c-1]=value
 }), deleteRow:r=>chatData.splice(r-2,1), deleteRows:(r,n)=>chatData.splice(r-2,n)
};
const chatContext = {console,Date,Number,JSON,String,CacheService:{getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},
 Utilities:{getUuid:()=>('00000000-0000-4000-8000-'+String(++uuidCounter).padStart(12,'0'))},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=> name==='Users'?{getLastRow:()=>4,getRange:()=>({getValues:()=>[['alice'],['bob'],['eve']]})}:chatSheet}),
 newRichTextValue:()=>({setText:value=>({build:()=>value})}),flush(){}}};
vm.createContext(chatContext); vm.runInContext(source,chatContext); chatContext.jsonResponse=x=>x;
const aliceToken=chatContext.createChatSession_('Alice'), bobToken=chatContext.createChatSession_('Bob'), eveToken=chatContext.createChatSession_('Eve');
const request = (token, action, fields={})=>chatContext.chatRequest_({token,action,...fields});
request(aliceToken,'chatSend',{requestId:'public-message-0001',text:'Hello everyone',username:'eve'});
request(aliceToken,'chatSend',{requestId:'private-message-001',peer:'bob',text:'=literal private text'});
assert.equal(chatData[0][1],'alice'); // A spoofed username has no effect.
assert.equal(chatData[1][3],'=literal private text');
assert.equal(request(eveToken,'chatList').messages.length,1);
assert.equal(request(bobToken,'chatList',{peer:'alice'}).messages[0].text,'=literal private text');
assert.equal(request(eveToken,'chatList',{peer:'alice'}).messages.length,0);
assert.equal(request(eveToken,'chatList',{peer:'bob'}).messages.length,0);
assert.match(request(bobToken,'chatRecall',{id:'public-message-0001'}).error,/own messages/);
request(aliceToken,'chatSend',{requestId:'private-message-001',peer:'bob',text:'retry'});
assert.equal(chatData.length,2); // Retry does not duplicate.
assert.match(request(aliceToken,'chatSend',{requestId:'invalid-target-0001',peer:'unknown',text:'hello'}).error,/registered/);
assert.match(request(aliceToken,'chatSend',{requestId:'too-long-message-01',text:'x'.repeat(4001)}).error,/4,000/);
assert.throws(()=>request('forged','chatList'),/CHAT_AUTH/);
assert.equal(request(bobToken,'chatUnread').messages.length,2);
assert.equal(request(aliceToken,'chatUnread').messages.length,0);
assert.equal(request(eveToken,'chatUnread').messages.length,1);
assert.throws(()=>request('forged','chatUnread'),/CHAT_AUTH/);
chatData[1][5]=Date.now()-1;
assert.equal(request(bobToken,'chatList',{peer:'alice'}).messages.length,0);
chatContext.cleanupExpiredChat(); assert.equal(chatData.length,1);
request(aliceToken,'chatRecall',{id:'public-message-0001'}); assert.equal(chatData.length,0);
for(let i=0;i<205;i++)chatData.push(['page-'+i,'alice','','Message '+i,Date.now(),Date.now()+604800000]);
const latest = request(bobToken,'chatList'); assert.equal(latest.messages.length,100);assert.equal(latest.hasMore,true);
const earlier = request(bobToken,'chatList',{before:latest.messages[0].id}); assert.equal(earlier.messages.length,100);
assert.equal(request(bobToken,'chatList',{start:earlier.messages[0].id}).messages.length,200);
request(aliceToken,'chatLogout'); assert.throws(()=>request(aliceToken,'chatList'),/CHAT_AUTH/);
cache.set('chat-session:'+eveToken,JSON.stringify({user:'eve',expires:Date.now()-1}));
assert.throws(()=>request(eveToken,'chatList'),/CHAT_AUTH/);
console.log('Passed: verified chat identity, private isolation, author-only recall, idempotent sends, validation, seven-day expiry, cleanup, pagination, session expiry and logout.');

const chartReport = ui.monthlyReportHTML('2026-10','Alice',{days:[{date:'2026-10-01',ql:3,vm:4,fp:10,mp:10}]});
assert.ok(chartReport.includes('<svg'));
assert.ok(chartReport.includes('Daily calls, day 1: 7'));
assert.ok(!chartReport.includes('NaN'));
assert.ok(chartReport.includes('Monthly overview'));
assert.ok(chartReport.includes('<strong>7</strong>Total calls'));
assert.ok(chartReport.includes('<strong>3</strong>Qualified leads'));
assert.ok(chartReport.includes('Daily leads (QL), day 1: 3'));
assert.equal((chartReport.match(/<polyline /g) || []).length,14);
assert.ok(chartReport.includes('stroke-dasharray="5 4" opacity="0.65"'));
assert.ok(chartReport.includes('<h2>Daily leads</h2>'));
assert.ok(ui.monthlyReportHTML('2026-02','Alice',{}).includes('Daily calls, day 28: 0'));
const clientSource = html.replace(/^<script>/,'').replace(/<\/script>\s*$/,'');
new vm.Script(clientSource);
console.log('Passed: unread sender exclusion, private isolation, invalid sessions, printable call chart, empty month chart, client syntax.');
