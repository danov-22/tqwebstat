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
