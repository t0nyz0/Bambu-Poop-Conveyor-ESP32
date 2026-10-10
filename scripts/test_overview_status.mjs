import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const inline=name=>html.split('\n').find(l=>l.startsWith('function '+name+'(')||l.startsWith('async function '+name+'('));
function harness(){
  const elements=new Map(),requests=[],messages=[];
  const $=key=>{if(!elements.has(key)){const classes=new Set();elements.set(key,{disabled:false,textContent:'',classList:{add(...names){names.forEach(n=>classes.add(n))},remove(...names){names.forEach(n=>classes.delete(n))},toggle(n,on){on?classes.add(n):classes.delete(n)},contains:n=>classes.has(n)},setAttribute(k,v){this[k]=v}})}return elements.get(key)};
  const state={status:null,countdownPhase:'Idle',countdownEndAt:0};
  const ctx=vm.createContext({$,state,AbortSignal,performance:{now:()=>0},api:async(...a)=>{requests.push(a);return ctx.response(...a)},toast:m=>messages.push(m),updateSettingsStatus(){},paint(s){state.status=s;state.statusUnavailable=false;$('#connection').textContent='Online';ctx.paintOverviewFreshness()}});
  vm.runInContext(['status','printerIdentityText','paintPrinter','paintOverviewFreshness','paintCountdown','countdownRemaining','countdown'].map(inline).join('\n'),ctx);
  return {ctx,state,$,requests,messages};
}
test('initial load shows checking rather than a disconnected printer, then restores refresh controls',async()=>{
  const h=harness();let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);const pending=h.ctx.status(true);
  assert.equal(h.$('#printerLive').className,'printer-live loading');assert.equal(h.$('#printer').textContent,'Checking…');assert.equal(h.$('#connection').textContent,'Refreshing status…');
  assert.equal(h.$('#onlineDot').classList.contains('loading'),true);
  assert.equal(h.$('#refresh')['aria-busy'],'true');assert.equal(h.$('#refresh').disabled,true);
  resolve({mqtt:{connected:true}});await pending;assert.equal(h.$('#refresh').disabled,false);assert.equal(h.$('#refresh').textContent,'Refresh status');
});
test('manual refresh keeps the last printer state instead of flashing disconnected, and coalesces requests',async()=>{
  const h=harness();h.state.status={mqtt:{connected:true}};h.$('#printerLive').className='printer-live active';h.$('#printerLiveTitle').textContent='Print in progress';
  let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);const pending=h.ctx.status();await h.ctx.status();
  assert.equal(h.requests.length,1);assert.equal(h.$('#printerLiveTitle').textContent,'Print in progress');assert.equal(h.$('#printerLive').className,'printer-live active');
  resolve({mqtt:{connected:true}});await pending;
});
test('status fetch failure does not falsely claim MQTT disconnected and leaves retry available',async()=>{
  for(const previous of [null,{mqtt:{connected:true}}]){const h=harness();h.state.status=previous;h.ctx.response=()=>{throw Error('timeout')};await h.ctx.status(true);
    assert.equal(h.$('#connection').textContent,'Status unavailable · retrying');assert.equal(h.state.status,previous);assert.equal(h.$('#refresh').disabled,false);
    assert.equal(h.state.statusUnavailable,true);assert.equal(h.$('#onlineDot').classList.contains('stale'),true);assert.equal(h.$('#onlineDot').classList.contains('off'),false);
    if(!previous)assert.equal(h.$('#printer').textContent,'Unknown');
  }
});
test('status failures and recovery reach Settings correctly without hiding a confirmed disconnection',async()=>{
  const h=harness(),sample={mode:'mqtt',hostname:'conveyor',version:'1.5.4',wifi:{connected:true,ssid:'Workshop'},mqtt:{connected:true},motor:{state:'Idle'},leds:{green:true,yellow:false,red:false},printer:{gcodeState:'IDLE'}};
  const saved={operationMode:'mqtt',ssid:'Workshop',printerIp:'10.0.0.50',serialNumber:'TEST-ONLY',printerModel:'P1',accessCodeSet:true};
  const form={mode:'mqtt',ssid:'Workshop',printerIp:saved.printerIp,serial:saved.serialNumber,model:'P1',pass:'',access:''};
  Object.assign(h.ctx,{syncCountdown(){},lamp(){},paintPerformance(){},paintCountdown(){},paintSetupNotice(){},fmt:()=>'',updateSettingsStatus(){h.ctx.ready=h.ctx.settingsReadiness(saved,h.state.status,form,h.state.statusUnavailable)}});
  const readiness=html.slice(html.indexOf('function settingsReadiness('),html.indexOf('function updateSettingsStatus('));
  vm.runInContext(readiness+'\n'+inline('paint'),h.ctx);h.ctx.paint(sample);
  for(let attempt=0;attempt<3;attempt++){
    h.ctx.response=()=>{throw Error('timeout')};await h.ctx.status(true);
    assert.equal(h.state.status,sample);assert.equal(h.ctx.ready.network.badge,'Last known: connected');assert.equal(h.ctx.ready.attention,false);
  }
  h.ctx.response=()=>sample;await h.ctx.status(true);
  assert.equal(h.state.statusUnavailable,false);assert.equal(h.$('#onlineDot').classList.contains('stale'),false);assert.equal(h.$('#connection').textContent,'Online');
  assert.equal(h.ctx.ready.network.badge,'✓ Connected');assert.equal(h.ctx.ready.printer.badge,'✓ Connected');
  h.ctx.response=()=>({...sample,wifi:{connected:false},mqtt:{connected:false}});await h.ctx.status(true);
  assert.equal(h.ctx.ready.network.badge,'! Not connected');assert.equal(h.ctx.ready.attention,true);
  assert.equal(h.$('#printerLive').className,'printer-live offline');
});
test('background polling does not flash refreshing on every update',async()=>{
  const h=harness();h.state.status={mqtt:{connected:true}};h.$('#connection').textContent='Online';let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);
  const pending=h.ctx.status(true);assert.equal(h.$('#connection').textContent,'Online');resolve({mqtt:{connected:true}});await pending;
});
test('Overview prefers discovered names, falls back for older firmware, and omits printer in motion mode',()=>{
  const h=harness();assert.equal(h.ctx.printerIdentityText({mode:'mqtt',printer:{name:'Workshop H2D',model:'H2',ip:'10.0.0.50'}}),'Workshop H2D');
  assert.equal(h.ctx.printerIdentityText({mode:'mqtt',printer:{model:'H2',ip:'10.0.0.50'}}),'H2 · 10.0.0.50');
  assert.equal(h.ctx.printerIdentityText({mode:'mqtt',printer:{}}),'');assert.equal(h.ctx.printerIdentityText({mode:'motion',printer:{name:'Workshop'}}),'');
  assert.match(inline('paintPrinter'),/printerIdentity'\)\.textContent/);assert.doesNotMatch(inline('paintPrinter'),/innerHTML/);
});
test('section saves suppress background polling without altering MQTT firmware state',()=>{
  assert.match(html,/setInterval\(\(\)=>\{if\(!state.sectionSave&&!state.fullSettingsSave\)status\(true\)\},3000\)/);
  assert.match(readFileSync(new URL('../Bambu-Poop-Conveyor/v150_features.h',import.meta.url),'utf8'),/mqtt\["connected"\] = client.connected\(\)/);
});
test('idle, finished and older connected status payloads use a steady green connection badge',()=>{
  for(const gcodeState of ['IDLE','FINISH','UNKNOWN',undefined]){
    const h=harness();h.ctx.paintPrinter({mode:'mqtt',mqtt:{connected:true},printer:{gcodeState}});
    assert.equal(h.$('#printerLive').className,'printer-live connected');
    assert.match(h.$('#stageText').textContent,/live/i);
  }
  assert.match(html,/\.printer-live\.connected>i\{background:var\(--green\);[^}]*\}/);
  assert.doesNotMatch(html.match(/\.printer-live\.connected>i\{[^}]*\}/)[0],/animation/);
});
test('green idle badge does not override printing, pause, failure, offline or motion states',()=>{
  for(const [mode,connected,gcodeState,expected] of [
    ['mqtt',true,'RUNNING','active'],['mqtt',true,'PREPARE','active'],
    ['mqtt',true,'PAUSE','paused'],['mqtt',true,'FAILED','offline'],
    ['mqtt',false,'IDLE','offline'],['motion',true,'IDLE',''],
  ]){
    const h=harness();h.ctx.paintPrinter({mode,mqtt:{connected},printer:{gcodeState,stageDescription:'Idle'}});
    assert.equal(h.$('#printerLive').className,'printer-live'+(expected?' '+expected:''));
  }
});

test('failed refresh qualifies every dynamic Overview value and countdown cannot restore a false Ready state',async()=>{
  const h=harness(),sample={mode:'mqtt',hostname:'conveyor',version:'1.5.4',wifi:{connected:true,ssid:'Workshop',rssi:-52},mqtt:{connected:true},motor:{state:'Idle'},leds:{green:true,yellow:false,red:false},printer:{gcodeState:'IDLE'},system:{freeHeap:150000,heapSize:300000,cpuMHz:240},uptimeMs:60000};
  Object.assign(h.ctx,{paintSetupNotice(){}});vm.runInContext(['paint','paintPerformance','syncCountdown','lamp','fmt'].map(inline).join('\n'),h.ctx);h.ctx.paint(sample);
  const ids=['wifi','mqtt','uptime','health','heap','signal','greenTxt','yellowTxt','redTxt'],before=Object.fromEntries(ids.map(id=>[id,h.$('#'+id).textContent]));
  h.ctx.response=()=>{throw Error('timeout')};
  for(let attempt=0;attempt<3;attempt++){
    await h.ctx.status(true);h.ctx.paintCountdown();
    assert.equal(h.state.status,sample);assert.equal(h.$('#overviewFreshness').hidden,false);assert.equal(h.$('#overview').classList.contains('status-stale'),true);
    assert.equal(h.$('#printerLive').className,'printer-live stale');assert.equal(h.$('#printerLiveTitle').textContent,'Last known: printer connected');
    assert.doesNotMatch(h.$('#stageText').textContent,/\blive\b/i);assert.match(h.$('#printer').textContent,/^Last known:/);
    assert.match(h.$('#motor').textContent,/^Last known: Idle/);assert.equal(h.$('#heroState').textContent,'Status unavailable · retrying');
    assert.equal(h.$('#run').disabled,true);assert.equal(h.$('#stop').disabled,false);
    assert.equal(h.$('#health').className,'health-pill neutral');
    for(const id of ids)assert.equal(h.$('#'+id).textContent,'Last known: '+before[id],id);
  }
  h.ctx.response=()=>sample;await h.ctx.status(true);
  assert.equal(h.$('#overviewFreshness').hidden,true);assert.equal(h.$('#overview').classList.contains('status-stale'),false);
  assert.equal(h.$('#printerLive').className,'printer-live connected');assert.equal(h.$('#stageText').textContent,'Live MQTT connection');
  assert.equal(h.$('#heroState').textContent,'Ready for the next purge.');assert.equal(h.$('#run').disabled,false);
  assert.equal(h.$('#health').className,'health-pill');
  for(const id of ids)assert.equal(h.$('#'+id).textContent,before[id],id);
});

test('cold-load markup uses unknown indicators and a disabled Run without disabling Stop',()=>{
  assert.match(html,/<button[^>]*id="run"[^>]*\bdisabled(?:\s|>)/);
  assert.doesNotMatch(html.match(/<button[^>]*id="stop"[^>]*>/)[0],/\bdisabled\b/);
  assert.match(html,/<i class="dot loading" id="onlineDot"/);
  assert.match(html,/\.dot\.loading\{background:var\(--muted\);box-shadow:none\}/);
  for(const id of ['greenTxt','yellowTxt','redTxt'])assert.match(html,new RegExp('id="'+id+'">—'));
  assert.match(html,/<span class="health-pill neutral" id="health">Checking…/);
  assert.match(html,/\.health-pill\.neutral\{background:#ffffff08;color:var\(--muted\)\}/);
});

test('unknown and initially failed status block direct Run; fresh status restores Run but stale status blocks it again',async()=>{
  const h=harness(),sample={mode:'mqtt',hostname:'conveyor',version:'1.5.4',wifi:{connected:true,ssid:'Workshop'},mqtt:{connected:true},motor:{state:'Idle'},leds:{green:true,yellow:false,red:false},printer:{gcodeState:'IDLE'}};
  Object.assign(h.ctx,{paintSetupNotice(){},setTimeout(){}});
  const handlers=html.split('\n').find(l=>l.startsWith("$('#refresh').onclick="));
  vm.runInContext(['paint','paintPerformance','syncCountdown','lamp','fmt'].map(inline).join('\n')+'\n'+handlers,h.ctx);
  h.ctx.paintCountdown();assert.equal(h.$('#run').disabled,true);assert.equal(h.$('#stop').disabled,false);
  await h.$('#run').onclick();assert.equal(h.requests.length,0);
  h.ctx.response=()=>{throw Error('timeout')};await h.ctx.status(true);h.ctx.paintCountdown();
  assert.equal(h.$('#run').disabled,true);assert.equal(h.$('#stop').disabled,false);await h.$('#run').onclick();
  assert.equal(h.requests.filter(([path])=>path==='/api/motor/run').length,0);
  h.ctx.response=()=>sample;await h.ctx.status(true);assert.equal(h.$('#run').disabled,false);
  assert.equal(h.$('#onlineDot').classList.contains('loading'),false);assert.equal(h.$('#onlineDot').classList.contains('stale'),false);
  await h.$('#run').onclick();assert.equal(h.requests.filter(([path])=>path==='/api/motor/run').length,1);
  h.ctx.response=()=>{throw Error('timeout')};await h.ctx.status(true);await h.$('#run').onclick();
  assert.equal(h.$('#run').disabled,true);assert.equal(h.requests.filter(([path])=>path==='/api/motor/run').length,1);
});

test('stale printing and motion states remain last known instead of live, pulsing or freshly active',()=>{
  for(const [mode,gcodeState,phase] of [['mqtt','RUNNING','Running'],['motion','IDLE','Idle']]){
    const h=harness();h.state.status={mode,mqtt:{connected:true},printer:{gcodeState,stageDescription:'Printing'},motor:{state:phase,remainingMs:5000}};h.state.countdownPhase=phase;h.state.statusUnavailable=true;
    h.ctx.paintOverviewFreshness();for(let tick=0;tick<5;tick++)h.ctx.paintCountdown();
    assert.equal(h.$('#printerLive').className,'printer-live stale');assert.match(h.$('#printerLiveTitle').textContent,/^Last known:/);
    assert.doesNotMatch(h.$('#stageText').textContent,/\blive\b/i);assert.equal(h.$('#motor').textContent,'Last known: '+phase);
    assert.equal(h.$('#heroState').textContent,'Status unavailable · retrying');
  }
});
