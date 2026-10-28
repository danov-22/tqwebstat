const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const client = fs.readFileSync('script.html','utf8');
const queue = client.slice(client.indexOf('const saveQueue = []'),client.indexOf('\n/*',client.indexOf('const saveQueue = []')));
const storage = new Map();
let requests = [], fail = true, failStorage = false;
function browser(user = 'Alice') {
  const context = {currentUser:user, todayCounts:{vm:1}, monthlyData:[], qlNotesByDate:{},
    todayISO:()=> '2026-10-28', emptyCounts:()=>({}), crypto:require('crypto'),
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failStorage)throw Error('quota');storage.set(key,value);}},
    showToast(){}, console, document:{addEventListener(){},getElementById:()=>({addEventListener(){},textContent:''}),querySelector:()=>null},
    navigator:{onLine:false},window:{addEventListener(){}},setTimeout:()=>1,clearTimeout(){},
    fetchMonthlyData(){}, postToScript:async payload=>{requests.push(payload);if(fail)throw Error('network');return {success:true};}
  };
  vm.createContext(context);vm.runInContext(queue,context);return context;
}
async function run() {
  let c = browser();
  vm.runInContext("queueSave({action:'stat',username:currentUser,date:todayISO(),category:'vm',delta:1});",c);
  assert.equal(requests.length,0);
  const saved = JSON.parse(storage.get('tq_outbox_v1:alice'));
  assert.equal(saved.jobs.length,1);assert.equal(saved.jobs[0].payload.date,'2026-10-28');
  c = browser();vm.runInContext('restoreOutbox()',c);
  assert.equal(vm.runInContext('saveQueue.length',c),1);
  c.navigator.onLine=true;
  await vm.runInContext('processSaveQueue()',c);
  assert.equal(vm.runInContext('saveQueue.length',c),1);
  assert.equal(JSON.parse(storage.get('tq_outbox_v1:alice')).jobs.length,1);
  fail=false;await vm.runInContext('processSaveQueue()',c);
  assert.equal(vm.runInContext('saveQueue.length',c),0);
  assert.equal(requests[0].requestId,requests[1].requestId);
  assert.equal(JSON.parse(storage.get('tq_outbox_v1:alice')).jobs.length,0);
  const bob=browser('Bob');vm.runInContext('restoreOutbox()',bob);
  assert.equal(vm.runInContext('saveQueue.length',bob),0);
  failStorage=true;c.navigator.onLine=false;c.rolledBack=false;
  vm.runInContext("queueSave({action:'stat',username:currentUser},null,()=>{rolledBack=true})",c);
  assert.equal(c.rolledBack,true);assert.equal(vm.runInContext('saveQueue.length',c),0);
  failStorage=false;
  c=browser();c.postToScript=async()=>{const err=Error('invalid');err.application=true;throw err;};
  vm.runInContext("queueSave({action:'stat',username:currentUser});",c);
  c.navigator.onLine=true;await vm.runInContext('processSaveQueue()',c);
  assert.equal(vm.runInContext('saveQueue.length',c),1);
  assert.match(vm.runInContext('syncProblem',c),/needs attention/);

  storage.clear();
  c=browser(); c.navigator.onLine=true; c.postToScript=async()=>({success:true});
  vm.runInContext("queueSave({action:'stat',username:currentUser},()=>{throw Error('UI failure')});",c);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext('saveQueue.length',c),0);
  assert.equal(JSON.parse(storage.get('tq_outbox_v1:alice')).jobs.length,0);
  c=browser(); c.navigator.onLine=true;
  c.postToScript=async()=>{const err=Error('Service timed out');err.application=true;throw err;};
  vm.runInContext("queueSave({action:'stat',username:currentUser});",c);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext('saveQueue.length',c),1);
  assert.equal(vm.runInContext('syncProblem',c),'');
  const source=fs.readFileSync('code.gs','utf8');
  const wrapper=source.slice(source.indexOf('function serverRequest('),source.indexOf('\nfunction serverMonthlyData'));
  const rows=[];let mutations=0;
  const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),getRange:(r,col,n,w)=>({
    getValues:()=>rows.slice(r-1,r-1+n).map(row=>row.slice(col-1,col-1+w)),
    setValues:values=>{for(let i=0;i<values.length;i++)rows[r-1+i]=values[i].slice();},
    setValue:value=>{rows[r-1][col-1]=value;}
  })};
  const backend={LockService:{getUserLock:()=>({waitLock(){},releaseLock(){}})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>rows.length?sheet:null,insertSheet:()=>sheet}),flush(){}},
    doPost:()=>{mutations++;return {getContent:()=>JSON.stringify({success:true,fp:true})};}
  };
  vm.createContext(backend);vm.runInContext(wrapper,backend);
  const payload={action:'stat',username:'Alice',requestId:'12345678-1234-1234-1234-123456789012'};
  assert.equal(backend.serverRequest(payload).success,true);
  assert.equal(backend.serverRequest(payload).fp,true);assert.equal(mutations,1);
  assert.match(backend.serverRequest({...payload,username:'Bob'}).error,/conflict/);
  rows[1][3]='';assert.match(backend.serverRequest(payload).error,/interrupted/);assert.equal(mutations,1);
  console.log('Passed: durable offline queue, reload recovery, stable retry IDs, account isolation, storage failure, validation pause, duplicate prevention, interrupted-write protection.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
