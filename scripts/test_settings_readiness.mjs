import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const logic=html.slice(html.indexOf('function settingsReadiness('),html.indexOf('function renderPrinterDiscovery('));
const pure=logic.slice(0,logic.indexOf('function updateSettingsStatus('));
const context=vm.createContext({});vm.runInContext(pure,context);
const saved={operationMode:'mqtt',ssid:'Workshop',printerIp:'10.0.0.50',serialNumber:'01PTEST',printerModel:'P1',accessCodeSet:true};
const form={mode:'mqtt',ssid:'Workshop',pass:'',printerIp:'10.0.0.50',serial:'01PTEST',model:'P1',access:''};
const live={wifi:{connected:true},mqtt:{connected:true}};
const ready=(c={},f={},s=live,offline=false)=>context.settingsReadiness({...saved,...c},s,{...form,...f},offline);

test('connected Wi-Fi and saved credentials are green without reentering passwords',()=>{
  const r=ready();assert.equal(r.network.kind,'good');assert.equal(r.printer.badge,'✓ Connected');assert.equal(r.attention,false);assert.equal(r.printerMissing.length,0);
  assert.equal(ready({wifiPasswordSet:false}).network.kind,'good','An open network is still connected');
});
test('unconfigured printer highlights exactly the missing fields with plain-language guidance',()=>{
  const r=ready({accessCodeSet:false},{printerIp:'',serial:'',access:''});
  assert.deepEqual(Array.from(r.printerMissing),['printerIp','serial','access']);assert.equal(r.network.kind,'good');assert.equal(r.printer.kind,'needs');
  for(const label of ['IP address','serial number','access code'])assert.ok(r.printer.help.includes(label));assert.match(r.summary,/Complete Printer setup/);
});
test('whitespace and sample placeholders do not count as completed setup',()=>{
  const r=ready({accessCodeSet:false},{printerIp:' your-bambu-printer-ip ',serial:'  ',access:'your-bambu-printer-accesscode'});
  assert.equal(r.printerMissing.length,3);
});
test('discovered and typed details are ready to save, not falsely connected',()=>{
  const r=ready({printerIp:'',serialNumber:'',accessCodeSet:false},{access:'TEST-ONLY'});
  assert.equal(r.printerMissing.length,0);assert.equal(r.printer.badge,'Ready to save');assert.equal(r.attention,true);assert.match(r.summary,/Save settings/);
});
test('a saved access code can stay blank but an invalid typed replacement is highlighted',()=>{
  assert.equal(ready().printerMissing.length,0);assert.deepEqual(Array.from(ready({}, {access:'   '}).printerMissing),['access']);
});
test('configured is distinct from live MQTT connectivity and remains ready when printer is off',()=>{
  const r=ready({}, {}, {wifi:{connected:true},mqtt:{connected:false}});
  assert.equal(r.printer.badge,'✓ Configured');assert.equal(r.printer.kind,'good');assert.match(r.printer.help,/live printer connection is separate/);assert.equal(r.attention,false);
});
test('motion mode does not require a printer; mode changes still need saving',()=>{
  const r=ready({operationMode:'motion',accessCodeSet:false,printerIp:'',serialNumber:''},{mode:'motion',printerIp:'',serial:''});
  assert.equal(r.printer.badge,'Not needed');assert.equal(r.printerMissing.length,0);assert.equal(r.attention,false);
  assert.match(ready({}, {mode:'motion'}).summary,/Save settings/);
});
test('network setup distinguishes missing Wi-Fi name, confirmed disconnection, and loading',()=>{
  const disconnected={wifi:{connected:false}};
  assert.equal(ready({}, {ssid:''}, disconnected).network.badge,'! Setup needed');
  assert.equal(ready({}, {}, disconnected).network.badge,'! Not connected');
  assert.equal(ready({}, {}, null).network.kind,'neutral');
});
test('failed status refresh preserves last known Wi-Fi without inventing missing setup',()=>{
  const r=ready({}, {}, live,true);
  assert.equal(r.network.kind,'neutral');assert.equal(r.network.badge,'Last known: connected');
  assert.match(r.network.help,/last successful check/);assert.match(r.network.help,/retrying automatically/);
  assert.equal(r.networkMissing.length,0);assert.equal(r.attention,false);assert.equal(r.summaryKind,'neutral');
  assert.match(r.summary,/temporarily unavailable/);assert.doesNotMatch(r.summary,/reconnect|setup needed/i);
  assert.equal(r.printer.badge,'✓ Configured','Stale MQTT is not presented as a fresh live connection');
});
test('initial or repeated status failures stay unknown rather than asserting offline or disconnected',()=>{
  for(const previous of [null,live,{wifi:{connected:false},mqtt:{connected:false}}]){
    for(let attempt=0;attempt<3;attempt++){
      const r=ready({}, {}, previous,true);
      assert.equal(r.network.kind,'neutral');assert.equal(r.attention,false);
      assert.doesNotMatch(r.network.badge,/offline|not connected|setup needed/i);
      assert.match(r.summary,/retrying/);
    }
  }
});
test('unavailable status still highlights genuinely missing printer details and unsaved drafts',()=>{
  const r=ready({accessCodeSet:false},{access:''},live,true);
  assert.deepEqual(Array.from(r.printerMissing),['access']);assert.equal(r.printer.kind,'needs');
  assert.equal(r.network.kind,'neutral');assert.equal(r.attention,true);assert.equal(r.summaryKind,'needs');
  assert.equal(r.summary,'Complete Printer setup');
  const draft=ready({}, {ssid:'New network'},live,true);
  assert.equal(draft.attention,true);assert.match(draft.summary,/Save settings to apply your changes/);
});
test('unknown or missing printer model is highlighted without guessing',()=>{
  assert.deepEqual(Array.from(ready({}, {model:''}).printerMissing),['model']);
  assert.deepEqual(Array.from(ready({}, {model:'future'}).printerMissing),['model']);
});
test('form rendering marks fields, never modifies their values, and uses text instead of markup',()=>{
  const fields=new Map();const $=id=>{if(!fields.has(id))fields.set(id,{value:'',dataset:{},textContent:'',className:'',attributes:{},needs:false,closest(){return {classList:{toggle:(_,v)=>this.needs=v}}},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}});return fields.get(id)};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:'Workshop',pass:'',printerIp:'',serial:'',access:'',model:'X1'}))$('#'+id).value=value;
  const state={config:{},savedConfig:{...saved,accessCodeSet:false},status:live};
  const ctx=vm.createContext({$,state,secretInputValue:id=>$('#'+id).value,updateSecretHints:()=>{},syncDownloadSource:()=>{}});vm.runInContext(logic,ctx);ctx.updateSettingsStatus();
  assert.equal($('#printerIp').needs,true);assert.equal($('#access').needs,true);assert.equal($('#ssid').needs,false);assert.equal($('#access').value,'');
  assert.equal($('#printerBadge').textContent,'! Setup needed');assert.equal($('#printerIp').attributes['aria-describedby'],'printerHelp');assert.equal($('#printerHelp').innerHTML,undefined);
});
test('Operation and Motor stay ready and the summary is accessible without relying only on color',()=>{
  for(const id of ['operationSettings','motorSettings'])assert.match(html,new RegExp('id="'+id+'">[\\s\\S]*?<span class="setup-badge">✓ Ready</span>'));
  assert.match(html,/id="setupSummary" role="status" aria-live="polite"/);new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});

const inline=name=>html.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('));
test('global Save requires printer details but accepts an existing saved code and motion mode',()=>{
  const ctx=vm.createContext({});vm.runInContext(pure+'\n'+inline('settingsSaveAllowed'),ctx);
  assert.equal(ctx.settingsSaveAllowed(null,form),false);
  assert.equal(ctx.settingsSaveAllowed({...saved,accessCodeSet:false},form),false);
  assert.equal(ctx.settingsSaveAllowed(saved,form),true);
  assert.equal(ctx.settingsSaveAllowed({...saved,accessCodeSet:false},{...form,access:'TEST-ONLY'}),true);
  assert.equal(ctx.settingsSaveAllowed({...saved,accessCodeSet:false},{...form,mode:'motion',printerIp:'',serial:''}),true);
  assert.match(html,/id="saveSettings" disabled/);
});
test('incomplete global Save is independently guarded before any POST or busy state',async()=>{
  const elements=new Map(),requests=[],messages=[],$=key=>{if(!elements.has(key))elements.set(key,{value:''});return elements.get(key)};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:'Workshop',pass:'',printerIp:'10.0.0.50',serial:'01PTEST',access:'',model:'P1'}))$('#'+id).value=value;
  const state={savedConfig:{...saved,accessCodeSet:false}};
  const ctx=vm.createContext({$,state,secretInputValue:id=>$('#'+id).value,toast:m=>messages.push(m),api:(...a)=>requests.push(a)});
  vm.runInContext(pure+'\n'+inline('settingsSaveAllowed')+'\n'+html.split('\n').find(line=>line.startsWith("$('#saveSettings').onclick=")),ctx);
  await $('#saveSettings').onclick();assert.equal(requests.length,0);assert.equal(state.fullSettingsSave,undefined);assert.match(messages[0],/access code/);
});
test('Settings tab and Overview notice reflect saved setup, not a typed draft or printer being offline',()=>{
  const elements=new Map(),$=key=>{if(!elements.has(key))elements.set(key,{classList:{toggle(k,v){this[k]=v}},setAttribute(k,v){this[k]=v}});return elements.get(key)};
  const ctx=vm.createContext({$});vm.runInContext(inline('paintSetupNotice'),ctx);ctx.paintSetupNotice({setupRequired:true});
  const button=$('.nav button[data-view="settings"]');assert.equal(button.classList['needs-setup'],true);assert.match(button['aria-label'],/setup needed/);assert.equal($('#overviewSetup').hidden,false);
  ctx.paintSetupNotice({setupRequired:false,mqtt:{connected:false}});assert.equal(button.classList['needs-setup'],false);assert.equal(button.textContent,'Settings');assert.equal($('#overviewSetup').hidden,true);
});
function saveHarness(integrated=false){
  const elements=new Map(),requests=[],timers=[];
  const $=key=>{if(!elements.has(key))elements.set(key,{value:'',type:'password',dataset:{},className:'',textContent:'',attributes:{},needs:false,setAttribute(k,v){this.attributes[k]=v},addEventListener(){},closest(){return {classList:{toggle:(_,v)=>this.needs=v},appendChild:node=>elements.set('#'+node.id,node)}}});return elements.get(key)};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:'Workshop',pass:'TEST-ONLY',printerIp:'10.0.0.50',serial:'01PTEST',access:'TEST-ONLY',model:'P1'}))$('#'+id).value=value;
  const state={bootId:100,config:{...saved},savedConfig:{...saved},status:live};
  const ctx=vm.createContext({$,state,AbortSignal,secretInputValue:id=>$('#'+id).value,performance:{now:()=>ctx.now},now:0,document:{createElement:()=>({})},syncDownloadSource:()=>{},updateSettingsStatus:()=>{},updateSecretHints:()=>{},paint:s=>{state.status=s;state.statusUnavailable=false;ctx.updateSettingsStatus()},toast:()=>{},waitForReturn:boot=>{ctx.waitBoot=boot},loadConfig:()=>{ctx.configReloads=(ctx.configReloads||0)+1},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout(){},api:async(path,options)=>{requests.push({path,options});return ctx.response(path,options)}});
  if(integrated)vm.runInContext(logic+'\n'+inline('updateSecretHints'),ctx);
  vm.runInContext(['setSecretVisibility','resetSavedSecret','acknowledgedSettingsConfig','settingsSaveAllowed','sectionSettingsPayload','sectionConnectionVerified','finishSectionSave','checkSectionSave','saveSettingsSection'].map(inline).filter(Boolean).join('\n'),ctx);
  return {ctx,$,state,requests,timers};
}
function newPrinterSaveHarness(){
  const h=saveHarness(true),before={...saved,printerIp:'',serialNumber:'',accessCodeSet:false};
  h.state.config={...before};h.state.savedConfig={...before};h.state.status={bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}};
  h.$('#pass').value='';h.ctx.updateSettingsStatus();return h;
}
function assertPendingPrinter(h,phase){
  assert.equal(h.state.sectionSave.phase,phase);
  assert.equal(h.$('#printerSettings').className,'panel setup-card neutral');
  assert.equal(h.$('#printerBadge').className,'setup-badge neutral');
  assert.equal(h.$('#setupSummary').className,'setup-summary neutral');
  assert.doesNotMatch(h.$('#printerHelp').textContent,/Still needed|access code/i);
  assert.doesNotMatch(h.$('#setupSummary').textContent,/Complete Printer setup|Setup needed/i);
  assert.match(h.$('#printerBadge').textContent,phase==='saving'?/Saving/:phase==='restart'?/Restarting/:/Checking/);
  assert.match(h.$('#setupSummary').textContent,phase==='saving'?/Saving printer settings/:phase==='restart'?/Waiting.*restart/:/Connecting to printer/);
  assert.equal(h.$('#savePrinter').disabled,true);assert.equal(h.$('#saveSettings').disabled,true);
  assert.equal(h.$('#access').needs,false);
  assert.match(h.$('#accessSavedHint').textContent,phase==='saving'?/Saving access code/:/Access code saved on device.*Masked while/);
}
test('first printer save stays neutral through acknowledgement, restart and MQTT checking, and marks the accepted code saved before clearing it',async()=>{
  const h=newPrinterSaveHarness();let acknowledge;
  h.ctx.response=()=>new Promise(resolve=>acknowledge=resolve);
  const reset=h.ctx.resetSavedSecret,resetSnapshots=[];
  h.ctx.resetSavedSecret=id=>{if(id==='access')resetSnapshots.push({saved:{...h.state.savedConfig},config:{...h.state.config}});return reset(id)};
  const pending=h.ctx.saveSettingsSection('printer');assertPendingPrinter(h,'saving');
  assert.equal(h.state.savedConfig.accessCodeSet,false,'A pending request is not acknowledgement');assert.equal(h.$('#access').value,'TEST-ONLY');
  acknowledge({ok:true,rebooting:true});await pending;
  assert.equal(resetSnapshots.length,1);
  for(const accepted of Object.values(resetSnapshots[0])){
    assert.equal(accepted.accessCodeSet,true,'Acknowledged code must be marked saved before clearing the input');
    assert.equal(accepted.printerIp,h.$('#printerIp').value);assert.equal(accepted.serialNumber,h.$('#serial').value);
    assert.equal(accepted.accessCode,undefined,'Accepted metadata must not retain the code text');
  }
  assertPendingPrinter(h,'restart');assert.equal(h.$('#access').value,'');
  assert.equal(h.state.statusUnavailable,true,'Pre-save connection data must not verify a new save');
  assert.match(h.$('#accessSavedHint').textContent,/Access code saved on device/);
  h.ctx.response=()=>({bootId:100});await h.ctx.checkSectionSave();assertPendingPrinter(h,'restart');
  h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{bootId:101,mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}}:{...saved};
  await h.ctx.checkSectionSave();assertPendingPrinter(h,'checking');assert.equal(h.state.savedConfig.accessCodeSet,true);
  h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{bootId:101,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);assert.equal(h.$('#printerBadge').textContent,'✓ Connected');
  assert.equal(h.$('#printerSaveStatus').className,'good');assert.match(h.$('#printerSaveStatus').textContent,/MQTT connected/);
});
test('a rejected first printer save retains the entered code and does not invent accepted credential metadata',async()=>{
  const h=newPrinterSaveHarness(),before={...h.state.savedConfig};h.ctx.response=()=>{throw Error('Rejected')};
  await h.ctx.saveSettingsSection('printer');
  assert.equal(h.state.sectionSave,null);assert.equal(h.$('#access').value,'TEST-ONLY');assert.deepEqual(h.state.savedConfig,before);
  assert.equal(h.state.savedConfig.accessCodeSet,false);assert.equal(h.$('#printerSaveStatus').className,'needs');
  assert.match(h.$('#printerSaveStatus').textContent,/Could not confirm the save/);assert.match(h.$('#accessSavedHint').textContent,/Replacement entered—not saved/);
  assert.equal(h.$('#printerBadge').textContent,'Ready to save');assert.equal(h.$('#access').needs,false);assert.equal(h.$('#savePrinter').disabled,false);
});
test('an acknowledged first printer save with failed MQTT remains an actual connection failure, not a missing access code',async()=>{
  const h=newPrinterSaveHarness();h.ctx.response=()=>({ok:true,rebooting:false});await h.ctx.saveSettingsSection('printer');
  assertPendingPrinter(h,'checking');assert.equal(h.state.savedConfig.accessCodeSet,true);
  h.ctx.response=path=>path==='/api/health'?{bootId:100}:path==='/api/status'?{bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}}:{...saved};
  h.ctx.now=61000;await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);
  assert.equal(h.$('#printerSaveStatus').className,'needs');assert.match(h.$('#printerSaveStatus').textContent,/saved, but MQTT did not connect/);
  assert.doesNotMatch(h.$('#printerSaveStatus').textContent,/✓|MQTT connected/);assert.equal(h.$('#printerBadge').textContent,'✓ Configured');
  assert.equal(h.$('#access').needs,false);assert.equal(h.state.savedConfig.accessCodeSet,true);assert.equal(h.$('#access').value,'');
});
test('a printer section save with a blank existing code retains saved credentials throughout verification',async()=>{
  const h=saveHarness(true);h.$('#access').value='';h.$('#pass').value='';h.ctx.response=()=>({ok:true,rebooting:false});
  await h.ctx.saveSettingsSection('printer');assertPendingPrinter(h,'checking');
  assert.equal(JSON.parse(h.requests[0].options.body).accessCode,'');assert.equal(h.state.savedConfig.accessCodeSet,true);
  h.ctx.response=path=>path==='/api/health'?{bootId:100}:path==='/api/status'?{bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);assert.equal(h.$('#printerBadge').textContent,'✓ Connected');
  assert.equal(h.$('#access').value,'');assert.equal(h.$('#access').needs,false);assert.equal(h.state.savedConfig.accessCodeSet,true);
});
test('HTTP success without an explicit accepted save does not clear credentials or mark them saved',async()=>{
  for(const acknowledgement of [{},{ok:false,rebooting:true}]){
    const h=newPrinterSaveHarness(),before={...h.state.savedConfig};h.ctx.response=()=>acknowledgement;
    await h.ctx.saveSettingsSection('printer');assert.equal(h.state.sectionSave,null);
    assert.deepEqual(h.state.savedConfig,before);assert.equal(h.$('#access').value,'TEST-ONLY');assert.equal(h.state.savedConfig.accessCodeSet,false);
    assert.equal(h.$('#printerSaveStatus').className,'needs');assert.match(h.$('#printerSaveStatus').textContent,/Could not confirm/);
    assert.equal(h.timers.length,0);
  }
});
test('acknowledged metadata contains only allowed settings and credential presence, preserving omitted or blank stored codes',()=>{
  const h=saveHarness(),c={...saved,wifiPasswordSet:true,marker:'prior metadata'};
  const preserved=h.ctx.acknowledgedSettingsConfig(c,{accessCode:'',wifiPassword:'',accessCodeSet:false,wifiPasswordSet:false,unknown:'not config'});
  assert.equal(preserved.accessCodeSet,true);assert.equal(preserved.wifiPasswordSet,true);assert.equal(preserved.unknown,undefined);
  assert.equal(preserved.marker,'prior metadata');assert.deepEqual(c,{...saved,wifiPasswordSet:true,marker:'prior metadata'});
  const next=h.ctx.acknowledgedSettingsConfig({...saved,accessCodeSet:false,wifiPasswordSet:false},{printerIp:'10.0.0.60',serialNumber:'NEW-PRINTER',printerModel:'H2',accessCode:'TEST-ONLY',wifiPassword:'TEST-ONLY',unknown:'not config'});
  assert.equal(next.printerIp,'10.0.0.60');assert.equal(next.serialNumber,'NEW-PRINTER');assert.equal(next.printerModel,'H2');
  assert.equal(next.accessCodeSet,true);assert.equal(next.wifiPasswordSet,true);
  assert.equal(next.accessCode,undefined);assert.equal(next.wifiPassword,undefined);assert.equal(next.unknown,undefined);
});
test('acknowledging a printer save invalidates a previously connected MQTT sample until a fresh connection check succeeds',async()=>{
  const h=newPrinterSaveHarness();h.state.status={bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}};
  h.ctx.response=()=>({ok:true,rebooting:false});await h.ctx.saveSettingsSection('printer');
  assertPendingPrinter(h,'checking');assert.equal(h.state.statusUnavailable,true);
  assert.notEqual(h.$('#printerBadge').textContent,'✓ Connected');assert.notEqual(h.$('#printerSaveStatus').className,'good');
  h.ctx.response=path=>path==='/api/health'?{bootId:100}:path==='/api/status'?{bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.statusUnavailable,false);assert.equal(h.state.sectionSave,null);
  assert.equal(h.$('#printerBadge').textContent,'✓ Connected');assert.equal(h.$('#printerSaveStatus').className,'good');
});
test('full Save marks accepted credentials before reset, invalidates old status, and forces an authoritative configuration reload',async()=>{
  const h=newPrinterSaveHarness();h.state.status={bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}};
  vm.runInContext(html.split('\n').find(line=>line.startsWith("$('#saveSettings').onclick=")),h.ctx);
  const reset=h.ctx.resetSavedSecret,snapshots=[];
  h.ctx.resetSavedSecret=id=>{snapshots.push({id,saved:{...h.state.savedConfig},config:h.state.config,unavailable:h.state.statusUnavailable});return reset(id)};
  h.ctx.response=()=>({ok:true,rebooting:true});await h.$('#saveSettings').onclick();
  assert.equal(snapshots.length,2);
  for(const snapshot of snapshots){assert.equal(snapshot.saved.accessCodeSet,true);assert.equal(snapshot.saved.accessCode,undefined);assert.equal(snapshot.saved.wifiPassword,undefined);assert.equal(snapshot.config,null);assert.equal(snapshot.unavailable,true)}
  assert.equal(h.$('#access').value,'');assert.equal(h.state.savedConfig.accessCodeSet,true);assert.equal(h.state.config,null);
  assert.equal(h.state.fullSettingsSave,true);assert.equal(h.ctx.waitBoot,100);
});
for(const outcome of ['success','error'])test('a delayed pre-save status '+outcome+' cannot overwrite freshness after accepted section or full Save',async()=>{
  for(const scope of ['printer','full']){
    const h=newPrinterSaveHarness(),previous=h.state.status,oldConnected={bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}};
    let resolveOld,rejectOld,paintCalls=0,freshnessCalls=0,readinessCalls=0;
    const paint=h.ctx.paint,update=h.ctx.updateSettingsStatus;
    h.ctx.paint=s=>{paintCalls++;return paint(s)};
    h.ctx.paintOverviewFreshness=()=>freshnessCalls++;
    h.ctx.updateSettingsStatus=()=>{readinessCalls++;return update()};
    vm.runInContext(inline('status'),h.ctx);
    if(scope==='full')vm.runInContext(html.split('\n').find(line=>line.startsWith("$('#saveSettings').onclick=")),h.ctx);
    h.ctx.response=(path,options)=>path==='/api/status'?new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject}):options?.method==='POST'?{ok:true,rebooting:true}:undefined;
    const oldRequest=h.ctx.status();assert.equal(h.state.statusLoading,true);
    if(scope==='printer')await h.ctx.saveSettingsSection('printer');else await h.$('#saveSettings').onclick();
    assert.equal(h.state.statusGeneration,1);assert.equal(h.state.statusUnavailable,true);assert.equal(h.state.savedConfig.accessCodeSet,true);
    const savedAfterAck={...h.state.savedConfig};readinessCalls=0;
    if(outcome==='success')resolveOld(oldConnected);else rejectOld(Error('Late pre-save timeout'));
    await oldRequest;
    assert.equal(paintCalls,0,'Pre-save status must not paint after acknowledgement');
    assert.equal(freshnessCalls,0,'Pre-save errors must not repaint the pending save');
    assert.equal(readinessCalls,0);assert.equal(h.state.statusUnavailable,true);assert.equal(h.state.status,previous);
    assert.deepEqual({...h.state.savedConfig},savedAfterAck);assert.equal(h.state.statusLoading,false);
    assert.equal(h.$('#refresh').disabled,false);assert.equal(h.$('#refresh').attributes['aria-busy'],'false');
    assert.notEqual(h.$('#printerBadge').textContent,'✓ Connected');assert.equal(h.$('#savePrinter').disabled,true);
    if(scope==='printer'){
      assertPendingPrinter(h,'restart');
      h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{...oldConnected,bootId:101}:{...saved};
      await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);assert.equal(h.state.statusUnavailable,false);
      assert.equal(h.$('#printerBadge').textContent,'✓ Connected');
    }else{assert.equal(h.state.config,null);assert.equal(h.state.fullSettingsSave,true)}
  }
});
test('section saves send only that section, never unrelated draft Motor/Operation/Network values',()=>{
  const h=saveHarness(),f={...form,access:'TEST-ONLY',pass:'TEST-ONLY'};
  assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.sectionSettingsPayload('network',f))),{ssid:'Workshop',wifiPassword:'TEST-ONLY'});
  assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.sectionSettingsPayload('printer',f))),{operationMode:'mqtt',printerIp:'10.0.0.50',accessCode:'TEST-ONLY',serialNumber:'01PTEST',printerModel:'P1'});
  assert.throws(()=>h.ctx.sectionSettingsPayload('motor',f),/Unknown/);
});
test('post-save verification requires the new boot and an actual authenticated MQTT connection',()=>{
  const h=saveHarness(),pending={oldBoot:100,rebooting:true},s={bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}};
  assert.equal(h.ctx.sectionConnectionVerified('printer',s,{bootId:100},pending),false,'Old connection cannot pass a rebooting save');
  s.bootId=101;assert.equal(h.ctx.sectionConnectionVerified('printer',s,{bootId:101},pending),true);
  s.mqtt.connected=false;assert.equal(h.ctx.sectionConnectionVerified('printer',s,{bootId:101},pending),false);assert.equal(h.ctx.sectionConnectionVerified('network',s,{bootId:101},pending),true);
  assert.equal(h.ctx.sectionConnectionVerified('network',s,{bootId:102},pending),false,'Mismatched status snapshot is not accepted');
});
test('Save Wi-Fi submits once, preserves unrelated inputs, and waits for restart before marking success',async()=>{
  const h=saveHarness();h.ctx.response=()=>({ok:true,rebooting:true});await h.ctx.saveSettingsSection('network');await h.ctx.saveSettingsSection('network');
  assert.equal(h.requests.length,1);assert.equal(h.$('#pass').value,'');assert.equal(h.$('#access').value,'TEST-ONLY');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{ssid:'Workshop',wifiPassword:'TEST-ONLY'});
  h.ctx.response=()=>({bootId:100});await h.ctx.checkSectionSave();assert.ok(h.state.sectionSave);assert.ok(h.requests.every(r=>r.path!=='/api/status'));
  h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{bootId:101,wifi:{connected:true}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);assert.equal(h.$('#networkSaveStatus').className,'good');assert.match(h.$('#networkSaveStatus').textContent,/connected/);assert.equal(h.$('#access').value,'TEST-ONLY');
});
test('failed save is not reported as success and retains typed replacement credentials',async()=>{
  const h=saveHarness();h.ctx.response=()=>{throw Error('Offline')};await h.ctx.saveSettingsSection('printer');assert.equal(h.state.sectionSave,null);assert.equal(h.$('#access').value,'TEST-ONLY');assert.equal(h.$('#printerSaveStatus').className,'needs');assert.match(h.$('#printerSaveStatus').textContent,/Could not confirm/);
});
test('printer connection timeout reports saved-but-not-connected and releases controls',async()=>{
  const h=saveHarness();h.ctx.response=()=>({ok:true,rebooting:false});await h.ctx.saveSettingsSection('printer');
  h.ctx.response=path=>path==='/api/health'?{bootId:100}:path==='/api/status'?{bootId:100,mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}}:{...saved};
  h.ctx.now=61000;await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);assert.equal(h.$('#printerSaveStatus').className,'needs');assert.match(h.$('#printerSaveStatus').textContent,/saved, but MQTT did not connect/);
});
test('blank saved secrets keep Show available and give an explicit saved hint',()=>{
  const elements=new Map();const $=key=>{if(!elements.has(key))elements.set(key,{value:'',type:'password',dataset:{},textContent:'',setAttribute(k,v){this[k]=v},closest(){return {appendChild:node=>elements.set('#'+node.id,node)}}});return elements.get(key)};
  const ctx=vm.createContext({$,state:{savedConfig:{wifiPasswordSet:true,accessCodeSet:true}},document:{createElement:()=>({})}});vm.runInContext([inline('secretInputValue'),inline('setSecretVisibility'),inline('updateSecretHints')].join('\n'),ctx);ctx.updateSecretHints();
  for(const id of ['pass','access']){assert.equal($('.secret-toggle[data-secret="'+id+'"]').disabled,false);assert.match($('#'+id+'SavedHint').textContent,/saved on device/);assert.equal($('#'+id).value,'')}
  $('#pass').value='TEST-ONLY';ctx.updateSecretHints();assert.equal($('.secret-toggle[data-secret="pass"]').disabled,false);assert.match($('#passSavedHint').textContent,/Replacement entered/);
});

function secretHarness(){
  const elements=new Map(),requests=[],messages=[];
  const $=key=>{if(!elements.has(key))elements.set(key,{value:'',type:'password',dataset:{},textContent:'Show',attributes:{},setAttribute(k,v){this.attributes[k]=v},closest(){return {appendChild:node=>elements.set('#'+node.id,node)}}});return elements.get(key)};
  for(const id of ['pass','access'])$('.secret-toggle[data-secret="'+id+'"]').dataset.secret=id;
  const state={savedConfig:{wifiPasswordSet:true,accessCodeSet:true}};
  const ctx=vm.createContext({$,state,AbortSignal,document:{createElement:()=>({})},toast:m=>messages.push(m),api:async(...args)=>{requests.push(args);return ctx.response(...args)}});
  vm.runInContext(['secretInputValue','setSecretVisibility','resetSavedSecret','toggleSecret','updateSecretHints'].map(inline).filter(Boolean).join('\n'),ctx);
  return {ctx,$,state,requests,messages};
}
test('saving a visible code resets both the field and its Show button, then one click reveals it',async()=>{
  const h=saveHarness();h.$('#access').type='text';h.$('.secret-toggle[data-secret="access"]').textContent='Hide';
  h.ctx.response=()=>({ok:true,rebooting:true});await h.ctx.saveSettingsSection('printer');
  assert.equal(h.$('#access').value,'');assert.equal(h.$('#access').type,'password');assert.equal(h.$('.secret-toggle[data-secret="access"]').textContent,'Show');
  const s=secretHarness();s.ctx.response=()=>({value:'TEST-ONLY'});await s.ctx.toggleSecret(s.$('.secret-toggle[data-secret="access"]'));
  assert.equal(s.$('#access').value,'TEST-ONLY');assert.equal(s.$('#access').type,'text');assert.equal(s.requests.length,1);assert.equal(s.ctx.secretInputValue('access'),'');
});
test('pending reveal stays disabled across status refreshes and ignores duplicate clicks',async()=>{
  const h=secretHarness();let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const b=h.$('.secret-toggle[data-secret="access"]'),pending=h.ctx.toggleSecret(b);h.ctx.updateSecretHints();
  assert.equal(b.disabled,true);assert.equal(b.textContent,'Loading…');await h.ctx.toggleSecret(b);assert.equal(h.requests.length,1);
  resolve({value:'TEST-ONLY'});await pending;assert.equal(b.disabled,false);assert.equal(b.textContent,'Hide');
});
test('a delayed reveal never overwrites text the user has entered',async()=>{
  const h=secretHarness();let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const pending=h.ctx.toggleSecret(h.$('.secret-toggle[data-secret="access"]'));h.$('#access').value='NEW-TEST-ONLY';
  resolve({value:'OLD-TEST-ONLY'});await pending;assert.equal(h.$('#access').value,'NEW-TEST-ONLY');assert.equal(h.$('#access').dataset.savedSecret,undefined);
});
test('failed and empty reveals remain masked with Show available for a retry',async()=>{
  for(const response of [()=>{throw Error('offline')},()=>({value:''})]){
    const h=secretHarness();h.ctx.response=response;const b=h.$('.secret-toggle[data-secret="access"]');await h.ctx.toggleSecret(b);
    assert.equal(h.$('#access').type,'password');assert.equal(b.textContent,'Show');assert.equal(b.disabled,false);assert.equal(h.$('#access').dataset.savedSecret,undefined);
  }
});
test('save/check has stable stages, resets its button, and never enables reveal during restart',async()=>{
  const h=saveHarness();let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const pending=h.ctx.saveSettingsSection('printer');assert.equal(h.state.sectionSave.phase,'saving');
  resolve({ok:true,rebooting:true});await pending;assert.equal(h.state.sectionSave.phase,'restart');
  h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{bootId:101,mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave.phase,'checking');assert.match(h.$('#printerSaveStatus').textContent,/Connecting to printer/);
  h.ctx.response=path=>path==='/api/health'?{bootId:101}:path==='/api/status'?{bootId:101,mode:'mqtt',wifi:{connected:true},mqtt:{connected:true}}:{...saved};
  await h.ctx.checkSectionSave();assert.equal(h.state.sectionSave,null);
  const s=secretHarness();s.state.sectionSave={scope:'printer',phase:'restart'};s.ctx.updateSecretHints();assert.equal(s.$('.secret-toggle[data-secret="access"]').disabled,true);
});
