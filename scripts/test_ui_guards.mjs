import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const inline=name=>html.split('\n').find(l=>l.startsWith('function '+name+'(')||l.startsWith('async function '+name+'('));
const handler=id=>html.split('\n').find(l=>l.startsWith("$('#"+id+"').onclick="));
function harness(names=[],handlers=[]){
  const elements=new Map(),requests=[],messages=[],timers=[];
  const $=s=>{if(!elements.has(s))elements.set(s,{value:'',disabled:false,hidden:false,textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){}},closest(){return {classList:{toggle(){}}}},setAttribute(k,v){this[k]=v},appendChild(){}});return elements.get(s)};
  const state={releases:{},status:{mqtt:{connected:true}}};
  const ctx=vm.createContext({$,state,AbortSignal,URL,File,Uint8Array,performance:{now:()=>0},document:{createElement:()=>({append(){}})},toast:m=>messages.push(m),api:async(...a)=>{requests.push(a);return ctx.response(...a)},fetch:async(...a)=>{requests.push(a);return ctx.fetchResponse(...a)},updateSettingsStatus(){},updateSecretHints(){},secretInputValue:id=>$('#'+id).value,paintOverviewFreshness(){},paint(s){state.status=s},status(){},loadConfig(){},fillConfig(){ctx.fills++},fills:0,discovery:{attempted:true},recoverPrinterDiscovery(){},discoveryTransient:error=>!error.status||error.status===409||error.status===429||error.status>=500,scheduleDiscoveryRecovery(){},renderRules(){},renderRuleChoices(){},collectRules:()=>[],setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},RELEASE_URLS:{stable:'s',beta:'b',rollback:'r'},fetchRelease:async()=>({version:'1.5.3',bin:'https://example.invalid/test.bin'}),paintRelease(kind,r){state.releases[kind]=r.value;$('#'+kind+'Install').hidden=false},confirm:()=>true,resetUpdate(){},step(){},syncDownloadSource(){},updateRequestUrl:u=>u});
  vm.runInContext([...names.map(inline),...handlers.map(handler)].join('\n'),ctx);
  return {ctx,$,state,requests,messages,timers};
}
test('silent polling leaves all Refresh button presentation unchanged',async()=>{
  const h=harness(['status']);const b=h.$('#refresh');b.textContent='Refresh status';b['aria-busy']='false';let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const pending=h.ctx.status(true);assert.equal(b.disabled,false);assert.equal(b.textContent,'Refresh status');assert.equal(b['aria-busy'],'false');resolve({mqtt:{connected:true}});await pending;assert.equal(b.disabled,false);
});
test('returning to Settings never refills or discards an initialized draft',async()=>{
  const h=harness(['loadConfig']);h.state.config={operationMode:'mqtt'};h.$('#printerIp').value='DRAFT';await h.ctx.loadConfig();assert.equal(h.ctx.fills,0);assert.equal(h.requests.length,0);assert.equal(h.$('#printerIp').value,'DRAFT');
});
test('overlapping initial Settings loads are coalesced and request bounded',async()=>{
  const h=harness(['loadConfig']);const resolvers=[];h.ctx.response=()=>new Promise(r=>resolvers.push(r));const pending=h.ctx.loadConfig(),second=h.ctx.loadConfig(),count=h.requests.length;for(const resolve of resolvers)resolve({operationMode:'motion'});await Promise.all([pending,second]);assert.equal(count,1);assert.ok(h.requests[0][1]?.signal);assert.equal(h.ctx.fills,1);
});
test('failed trigger loading keeps Save and Add disabled and blocks direct Save',async()=>{
  const h=harness(['loadTriggers'],['saveTriggers']);h.ctx.response=()=>{throw Error('offline')};await h.ctx.loadTriggers();assert.equal(h.$('#saveTriggers').disabled,true);assert.equal(h.$('#showAddRule').disabled,true);const before=h.requests.length;await h.$('#saveTriggers').onclick();assert.equal(h.requests.length,before);
});
test('loaded trigger drafts survive tab reentry; deliberately empty rules remain saveable',async()=>{
  const h=harness(['loadTriggers'],['saveTriggers']);h.ctx.response=path=>path==='/api/triggers'?{rules:[]}:{stages:[],gcodeStates:[]};await h.ctx.loadTriggers();assert.equal(h.state.triggersReady,true);const before=h.requests.length;await h.ctx.loadTriggers();assert.equal(h.requests.length,before);await h.$('#saveTriggers').onclick();assert.deepEqual(JSON.parse(h.requests.at(-1)[1].body),{rules:[]});assert.equal(h.$('#saveTriggers').disabled,false);
});
test('trigger Save is single-flight and restores controls after failure',async()=>{
  const h=harness([],['saveTriggers']);h.state.triggersReady=true;const rejects=[];h.ctx.response=()=>new Promise((r,j)=>rejects.push(j));const p=h.$('#saveTriggers').onclick(),second=h.$('#saveTriggers').onclick(),count=h.requests.length,busy=h.$('#saveTriggers').disabled;for(const reject of rejects)reject(Error('timeout'));await Promise.all([p,second]);assert.equal(count,1);assert.equal(busy,true);assert.equal(h.state.triggerSaving,false);assert.equal(h.$('#saveTriggers').disabled,false);
});
test('Update tab reentry and source changes cannot unlock an active installation',async()=>{
  const h=harness(['syncDownloadSource','setUpdateBusy','checkUpdates']);h.ctx.setUpdateBusy(true);await h.ctx.checkUpdates(true);h.ctx.syncDownloadSource();for(const id of ['install','checkUpdates','stableInstall','betaInstall','rollbackInstall','downloadSource'])assert.equal(h.$('#'+id).disabled,true,id);assert.equal(h.requests.length,0);
});
test('channel check completing after installation begins cannot unlock it',async()=>{
  const h=harness(['syncDownloadSource','setUpdateBusy','checkUpdates']);const resolvers=[];h.ctx.fetchRelease=()=>new Promise(r=>resolvers.push(r));const p=h.ctx.checkUpdates(true);h.ctx.setUpdateBusy(true);for(const resolve of resolvers)resolve({version:'1.5.3',bin:'https://example.invalid/test.bin'});await p;
  assert.equal(h.$('#stableInstall').disabled,true);assert.equal(h.$('#checkUpdates').disabled,true);
});
test('install handlers independently reject a second install before confirmation or requests',async()=>{
  const h=harness(['installRelease'],['install']);h.state.updateBusy=true;h.state.releases.stable={version:'1.5.3',bin:'https://example.invalid/test.bin'};h.ctx.confirm=()=>{throw Error('Must not confirm')};await h.ctx.installRelease('stable');await h.$('#install').onclick();assert.equal(h.requests.length,0);
});
test('release checks, downloads, upload and reboot requests have finite time bounds',async()=>{
  const h=harness(['fetchRelease']);h.ctx.fetchResponse=()=>({ok:true,json:async()=>({version:'1.5.3',bin:'x'})});await h.ctx.fetchRelease('https://example.invalid/latest.json');assert.ok(h.requests[0][1].signal);
  assert.match(inline('installRelease'),/signal:AbortSignal\.timeout\(/);assert.match(inline('uploadFirmware'),/x\.timeout=/);assert.match(inline('uploadFirmware'),/x\.ontimeout=/);
  assert.match(inline('waitForReturn'),/api\('\/api\/health\?ts='\+Date\.now\(\),\{signal:AbortSignal\.timeout\(/);assert.match(inline('waitForReturn'),/signal:AbortSignal\.timeout\(/);
});
test('failed initial Settings request clears its lock and allows retry',async()=>{
  const h=harness(['loadConfig']);h.ctx.response=()=>{throw Error('timeout')};await h.ctx.loadConfig();assert.equal(h.state.configLoading,false);h.ctx.response=()=>({operationMode:'motion'});await h.ctx.loadConfig();assert.equal(h.ctx.fills,1);assert.equal(h.state.configLoading,false);
});
test('unavailable channels release the Checking lock without enabling an installation',async()=>{
  const h=harness(['syncDownloadSource','checkUpdates']);h.ctx.fetchRelease=async()=>{throw Error('timeout')};h.ctx.paintRelease=(kind,r)=>{assert.equal(r.status,'rejected');h.$('#'+kind+'Install').hidden=true};await h.ctx.checkUpdates();assert.equal(h.state.updateChecking,false);assert.equal(h.$('#checkUpdates').disabled,false);for(const kind of ['stable','beta','rollback'])assert.equal(h.$('#'+kind+'Install').hidden,true);
});

function prepareSettings(h){
  const saved={operationMode:'mqtt',ssid:'Workshop',printerIp:'10.0.0.50',serialNumber:'TEST-ONLY',printerModel:'P1',accessCodeSet:true};
  h.state.config={...saved};h.state.savedConfig={...saved};h.state.status={wifi:{connected:true},mqtt:{connected:true}};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:'Workshop',pass:'',printerIp:saved.printerIp,serial:saved.serialNumber,access:'',model:'P1'}))h.$('#'+id).value=value;
  vm.runInContext(html.slice(html.indexOf('function settingsReadiness('),html.indexOf('function settingsSaveAllowed(')),h.ctx);
}

test('active installation blocks all Settings saves in controls and direct handlers even after tab reentry',async()=>{
  const h=harness(['syncDownloadSource','setUpdateBusy','saveSettingsSection','loadConfig'],['saveSettings']);prepareSettings(h);
  h.ctx.setUpdateBusy(true);await h.ctx.loadConfig();h.ctx.syncDownloadSource();
  for(const id of ['saveNetwork','savePrinter','saveSettings'])assert.equal(h.$('#'+id).disabled,true,id);
  for(const scope of ['network','printer'])await h.ctx.saveSettingsSection(scope);await h.$('#saveSettings').onclick();
  assert.equal(h.requests.length,0);assert.equal(h.state.sectionSave,undefined);assert.equal(h.state.fullSettingsSave,undefined);
  h.ctx.setUpdateBusy(false);for(const id of ['saveNetwork','savePrinter','saveSettings'])assert.equal(h.$('#'+id).disabled,false,id);
});

test('both Settings save flows block install controls, source changes and direct install/check handlers',async()=>{
  for(const pending of ['section','full']){
    const h=harness(['syncDownloadSource','checkUpdates','installRelease'],['install']);prepareSettings(h);
    h.state.releases.stable={version:'1.5.3',bin:'https://example.invalid/test.bin'};
    if(pending==='section')h.state.sectionSave={scope:'printer',phase:'checking'};else h.state.fullSettingsSave=true;
    h.ctx.confirm=()=>{throw Error('Must not confirm during a Settings save')};h.ctx.updateSettingsStatus();h.$('#downloadSource').value='github';h.ctx.syncDownloadSource();
    for(const id of ['install','checkUpdates','stableInstall','betaInstall','rollbackInstall','downloadSource'])assert.equal(h.$('#'+id).disabled,true,id);
    await h.ctx.installRelease('stable');await h.$('#install').onclick();await h.ctx.checkUpdates();assert.equal(h.requests.length,0);
    h.state.sectionSave=null;h.state.fullSettingsSave=false;h.$('#downloadSource').value='site';h.ctx.updateSettingsStatus();
    assert.equal(h.$('#stableInstall').disabled,false);assert.equal(h.$('#install').disabled,false);assert.equal(h.$('#checkUpdates').disabled,false);
  }
});

test('a pending release lookup cannot repaint or unlock controls after a Settings save begins',async()=>{
  const h=harness(['syncDownloadSource','checkUpdates']);const resolvers=[];h.ctx.fetchRelease=()=>new Promise(r=>resolvers.push(r));
  const p=h.ctx.checkUpdates();h.state.fullSettingsSave=true;for(const resolve of resolvers)resolve({version:'1.5.3',bin:'https://example.invalid/test.bin'});await p;
  assert.equal(h.state.fullSettingsSave,true);assert.equal(h.$('#install').disabled,true);assert.equal(h.$('#checkUpdates').disabled,true);assert.equal(h.$('#stableInstall').disabled,true);
  assert.deepEqual(Object.keys(h.state.releases),[]);
});

test('operation failures and completion release only their own busy flags',async()=>{
  const h=harness(['syncDownloadSource','setUpdateBusy','failUpdate','waitForReturn','finishSectionSave']);
  h.state.updateBusy=true;h.state.fullSettingsSave=true;h.ctx.failUpdate('Download failed');
  assert.equal(h.state.updateBusy,false);assert.equal(h.state.fullSettingsSave,true);assert.equal(h.$('#install').disabled,true);
  h.state.updateBusy=true;h.state.sectionSave={scope:'printer',timer:1};h.ctx.finishSectionSave('Done',true);assert.equal(h.state.updateBusy,true);
  for(const update of [false,true]){
    h.state.updateBusy=true;h.state.fullSettingsSave=true;h.ctx.response=()=>({bootId:2,version:'1.5.4'});
    await h.ctx.waitForReturn(1,update);await h.timers.at(-1).fn();
    assert.equal(h.state.updateBusy,!update);assert.equal(h.state.fullSettingsSave,update);
  }
});

test('rapid Logs tab reentry coalesces reads and restores retry after success or failure',async()=>{
  const h=harness(['loadLogs']);let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const first=h.ctx.loadLogs();for(let visit=0;visit<5;visit++)await h.ctx.loadLogs();assert.equal(h.requests.length,1);assert.equal(h.$('#refreshLogs').disabled,true);
  resolve({entries:[],debug:false});await first;assert.equal(h.state.logsLoading,false);assert.equal(h.$('#refreshLogs').disabled,false);
  h.ctx.response=()=>{throw Error('timeout')};await h.ctx.loadLogs();assert.equal(h.state.logsLoading,false);assert.equal(h.$('#refreshLogs').disabled,false);
  h.ctx.response=()=>({entries:[],debug:false});await h.ctx.loadLogs();assert.equal(h.requests.length,3);assert.equal(h.$('#logMeta').textContent,'0 recent · 0 stored');
});

function downloadHarness(){
  const h=harness(['syncDownloadSource','setUpdateBusy','failUpdate','validateFirmware','installRelease']);
  h.state.releases.stable={version:'1.5.4',bin:'https://example.invalid/test.bin'};h.$('#downloadSource').value='site';
  h.uploads=[];h.ctx.uploadFirmware=file=>h.uploads.push(file);h.filesBuilt=0;h.ctx.File=class extends File{constructor(...args){super(...args);h.filesBuilt++}};
  return h;
}

test('oversized streamed firmware is cancelled before the oversized chunk enters a File or upload',async()=>{
  const h=downloadHarness(),chunk=new Uint8Array(700000);chunk[0]=0xE9;let reads=0,cancelled=0,released=0;
  h.ctx.fetchResponse=()=>({ok:true,headers:{get:()=>null},body:{getReader:()=>({read:async()=>{reads++;return {done:false,value:chunk}},cancel:async()=>{cancelled++},releaseLock(){released++}})}});
  await h.ctx.installRelease('stable');
  assert.equal(reads,2);assert.equal(cancelled,1);assert.equal(released,1);assert.equal(h.filesBuilt,0);assert.equal(h.uploads.length,0);
  assert.match(h.messages.at(-1),/larger than the ESP32 update partition/);assert.equal(h.state.updateBusy,false);
});

test('oversized Content-Length rejects and cancels the response before any stream read',async()=>{
  const h=downloadHarness();let cancelled=0,readers=0;
  h.ctx.fetchResponse=()=>({ok:true,headers:{get:()=>String(1310721)},body:{cancel:async()=>{cancelled++},getReader(){readers++;throw Error('Must not read oversized response')}}});
  await h.ctx.installRelease('stable');assert.equal(cancelled,1);assert.equal(readers,0);assert.equal(h.filesBuilt,0);assert.equal(h.uploads.length,0);
});

test('a firmware stream exactly at the partition limit retains its bytes and releases its reader',async()=>{
  const h=downloadHarness(),image=new Uint8Array(1310720);image[0]=0xE9;image[1310719]=37;const chunks=[image.subarray(0,1048576),image.subarray(1048576)];let released=0;
  h.ctx.fetchResponse=()=>({ok:true,headers:{get:()=>String(image.length)},body:{getReader:()=>({read:async()=>chunks.length?{done:false,value:chunks.shift()}:{done:true},cancel:async()=>{throw Error('Valid stream must not cancel')},releaseLock(){released++}})}});
  await h.ctx.installRelease('stable');assert.equal(h.uploads.length,1);assert.equal(h.filesBuilt,1);assert.equal(released,1);
  assert.deepEqual(new Uint8Array(await h.uploads[0].arrayBuffer()),image);
});

test('non-streaming response fails safely without reading an unbounded arrayBuffer',async()=>{
  const h=downloadHarness();h.ctx.fetchResponse=()=>({ok:true,headers:{get:()=>null},arrayBuffer:async()=>{throw Error('Must not buffer an unbounded response')}});
  await h.ctx.installRelease('stable');assert.equal(h.filesBuilt,0);assert.equal(h.uploads.length,0);assert.match(h.messages.at(-1),/Upload the OTA/);
});
