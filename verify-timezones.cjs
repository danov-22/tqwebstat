const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const js=fs.readFileSync('timezone.js','utf8'),css=fs.readFileSync('timezone.css','utf8');
const context={Intl,Date};vm.createContext(context);vm.runInContext(js,context);
const api=context.TQTimezones;
for(const name of ['Bulgaria','Croatia','Czechia (Czech Republic)','Latvia','Lithuania','Iceland','Austria','Malta'])assert.ok(api.countries.some(c=>c[0]===name));
assert.ok(api.countries.length>=80);
assert.equal(api.countries[0][0],'United Kingdom');assert.equal(api.countries[11][0],'South Africa');assert.equal(api.countries[16][1],'America/Sao_Paulo');
for(const country of api.countries){assert.equal(country[0].includes('?'),false);assert.match(country[2],/^[a-z]{2}$/);new Intl.DateTimeFormat('en',{timeZone:country[1]}).format();}
const ids=['United Kingdom','Iceland','Austria','Bulgaria','South Africa'].map(name=>api.countries.findIndex(c=>c[0]===name));
const winter=api.groups(ids,new Date('2026-01-15T12:00:00Z')),summer=api.groups(ids,new Date('2026-07-15T12:00:00Z'));
assert.deepEqual(Array.from(winter,g=>g.offset),[0,60,120]);assert.deepEqual(Array.from(summer,g=>g.offset),[0,60,120,180]);
assert.equal(api.utcMinutes('Asia/Kathmandu',new Date('2026-01-15')),345);assert.equal(api.offsetLabel(-210),'UTC-03:30');assert.equal(api.offsetLabel(345),'UTC+05:45');
assert.equal(api.groups([ids[0],ids[0]]).flatMap(g=>g.ids).length,1);
assert.equal(fs.readFileSync('timezone.html','utf8'),'<style>\n'+css+'\n</style>\n<script>\n'+js+'\n</script>\n');
const source=fs.readFileSync('script.html','utf8');
function extract(name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\n}',start)+2);}
const client={CATEGORIES:[{key:'vm'}],showChartState(){},renderLeadCalendar(){},document:{getElementById:()=>({textContent:''})}};vm.createContext(client);vm.runInContext(extract('validateRecovery')+'\n'+extract('renderChart')+'\n'+extract('renderDailyTrendChart'),client);
assert.doesNotThrow(()=>client.renderChart([{date:'2026-11-05',vm:1}]));assert.doesNotThrow(()=>client.renderDailyTrendChart());
const job={payload:{action:'stat',username:'Alice',date:'2026-11-05',category:'vm',delta:1,fp:false,mp:false,ql_note:'',requestId:'12345678-1234-1234-1234-123456789012'}};
const recovery={format:'tq-input-recovery-v1',username:'Alice',jobs:[job]};
assert.equal(client.validateRecovery(recovery,'alice')[0].payload.requestId,job.payload.requestId);
assert.throws(()=>client.validateRecovery(recovery,'Bob'),/username/);
assert.throws(()=>client.validateRecovery({...recovery,jobs:[{payload:{...job.payload,action:'deleteQL'}}]},'Alice'),/Invalid pending/);
console.log('Passed: expanded catalog, legacy clock IDs, valid zones, country codes, DST grouping, fractional offsets, generated asset parity, blocked chart CDN, recovery identity and request-ID preservation.');
