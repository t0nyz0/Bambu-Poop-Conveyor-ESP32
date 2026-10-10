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
test('network setup distinguishes missing Wi-Fi name, disconnection, loading, and stale offline status',()=>{
  const disconnected={wifi:{connected:false}};
  assert.equal(ready({}, {ssid:''}, disconnected).network.badge,'! Setup needed');
  assert.equal(ready({}, {}, disconnected).network.badge,'! Not connected');
  assert.equal(ready({}, {}, null).network.kind,'neutral');
  const r=ready({}, {}, live,true);assert.equal(r.network.badge,'! Device offline');assert.notEqual(r.printer.badge,'✓ Connected');
});
test('unknown or missing printer model is highlighted without guessing',()=>{
  assert.deepEqual(Array.from(ready({}, {model:''}).printerMissing),['model']);
  assert.deepEqual(Array.from(ready({}, {model:'future'}).printerMissing),['model']);
});
test('form rendering marks fields, never modifies their values, and uses text instead of markup',()=>{
  const fields=new Map();const $=id=>{if(!fields.has(id))fields.set(id,{value:'',dataset:{},textContent:'',className:'',attributes:{},needs:false,closest(){return {classList:{toggle:(_,v)=>this.needs=v}}},setAttribute(k,v){this.attributes[k]=v},addEventListener(){}});return fields.get(id)};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:'Workshop',pass:'',printerIp:'',serial:'',access:'',model:'X1'}))$('#'+id).value=value;
  const state={config:{},savedConfig:{...saved,accessCodeSet:false},status:live};
  const ctx=vm.createContext({$,state,secretInputValue:id=>$('#'+id).value,updateSecretHints:()=>{}});vm.runInContext(logic,ctx);ctx.updateSettingsStatus();
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
function saveHarness(){
  const elements=new Map(),requests=[],timers=[];
  const $=key=>{if(!elements.has(key))elements.set(key,{value:'',dataset:{},className:'',textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v}});return elements.get(key)};
  for(const [id,value] of Object.entries({ssid:'Workshop',pass:'TEST-ONLY',printerIp:'10.0.0.50',serial:'01PTEST',access:'TEST-ONLY',model:'P1'}))$('#'+id).value=value;
  const state={bootId:100,config:{...saved},savedConfig:{...saved}};
  const ctx=vm.createContext({$,state,AbortSignal,secretInputValue:id=>$('#'+id).value,performance:{now:()=>ctx.now},now:0,updateSettingsStatus:()=>{},updateSecretHints:()=>{},paint:()=>{},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},api:async(path,options)=>{requests.push({path,options});return ctx.response(path,options)}});
  vm.runInContext(['sectionSettingsPayload','sectionConnectionVerified','finishSectionSave','checkSectionSave','saveSettingsSection'].map(inline).join('\n'),ctx);
  return {ctx,$,state,requests,timers};
}
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
  const elements=new Map();const $=key=>{if(!elements.has(key))elements.set(key,{value:'',dataset:{},textContent:'',closest(){return {appendChild:node=>elements.set('#'+node.id,node)}}});return elements.get(key)};
  const ctx=vm.createContext({$,state:{savedConfig:{wifiPasswordSet:true,accessCodeSet:true}},document:{createElement:()=>({})}});vm.runInContext([inline('secretInputValue'),inline('updateSecretHints')].join('\n'),ctx);ctx.updateSecretHints();
  for(const id of ['pass','access']){assert.equal($('.secret-toggle[data-secret="'+id+'"]').disabled,false);assert.match($('#'+id+'SavedHint').textContent,/saved on device/);assert.equal($('#'+id).value,'')}
  $('#pass').value='TEST-ONLY';ctx.updateSecretHints();assert.equal($('.secret-toggle[data-secret="pass"]').disabled,false);assert.match($('#passSavedHint').textContent,/Replacement entered/);
});
