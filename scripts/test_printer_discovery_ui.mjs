import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const names=['loadConfig','setSecretVisibility','toggleSecret','secretInputValue'];
const functions=names.map(name=>html.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('))).join('\n');
const settingsLogic=html.slice(html.indexOf('function settingsReadiness('),html.indexOf('function renderPrinterDiscovery('));
const discoveryLogic=html.slice(html.indexOf('function renderPrinterDiscovery('),html.indexOf("$('#findPrinter').onclick="));
function harness({realConfig=false}={}){
  const elements=new Map(),requests=[],timers=[],prompts=[],messages=[];
  const $=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',dataset:{},textContent:'',className:'',hidden:true,disabled:false,needs:false,attributes:{},listeners:{},classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attributes[k]=v},addEventListener(event,fn){(this.listeners[event]??=[]).push(fn)},dispatch(event){for(const fn of this.listeners[event]||[])fn({type:event,target:this})},closest(){return {classList:{toggle:(_,v)=>this.needs=v}}},children:[],options:[],replaceChildren(){this.children=[];this.value=''},appendChild(o){this.children.push(o);if(!this.value)this.value=o.value}});return elements.get(selector)};
  $('#model').options=['X1','P1','A1','H2','P2'].map(value=>({value}));$('#model').value='X1';$('#settings').hidden=false;
  const discovery={attempted:false,busy:false,printers:[],timer:null,startupAt:null,recoveryTimer:null,configFailures:0,startFailures:0,pollFailures:0,autoStopped:false,waitForStatus:false};
  const state={config:null};
  const ctx=vm.createContext({$,discovery,state,document:{createElement:()=>({})},performance:{now:()=>ctx.now},now:0,setTimeout:(fn,ms)=>{timers.push({fn,ms,active:true});return timers.length},clearTimeout:id=>{if(timers[id-1])timers[id-1].active=false},AbortSignal,
    toast:(...x)=>messages.push(x),confirm:text=>{prompts.push(text);return ctx.approve},approve:true,
    fillConfig:()=>{ctx.fills++},fills:0,syncDownloadSource:()=>{},updateSecretHints:()=>{},api:async(path,options)=>{requests.push({path,options});if(ctx.fail)throw Error(ctx.failMessage||'Offline');return typeof ctx.response==='function'?ctx.response(path,options):ctx.response}});
  vm.runInContext(settingsLogic+'\n'+discoveryLogic+'\n'+functions,ctx);
  if(realConfig){vm.runInContext(html.split('\n').find(line=>line.startsWith('function fillConfig(')),ctx);const fill=ctx.fillConfig;ctx.fillConfig=c=>{ctx.fills++;return fill(c)}}
  return {ctx,$,discovery,state,requests,timers,prompts,messages};
}
const printer={ip:'10.0.0.50',serial:'01PTEST123',model:'P1',name:'Workshop'};
const setupConfig={operationMode:'mqtt',ssid:'Workshop Wi-Fi',printerIp:'',serialNumber:'',printerModel:'P1',accessCodeSet:false,gmtOffset:-6,debug:false,motor:{waitMs:5000,runMs:10000,cooldownMs:120000,speed:225,direction:'Forward'}};
const freshWifi={mode:'mqtt',wifi:{connected:true},mqtt:{connected:false}};
const httpError=status=>Object.assign(Error('Request failed ('+status+')'),{status});
const discoveryPosts=h=>h.requests.filter(request=>request.path==='/api/printer-discovery'&&request.options?.method==='POST');
const discoveryGets=h=>h.requests.filter(request=>request.path==='/api/printer-discovery'&&!request.options?.method);
const configGets=h=>h.requests.filter(request=>request.path==='/api/config'&&!request.options?.method);
async function settle(){for(let i=0;i<8;i++)await Promise.resolve()}
async function runTimer(h,predicate=()=>true){const timer=h.timers.find(timer=>timer.active&&predicate(timer));assert.ok(timer,'Expected a pending recovery/poll timer');timer.active=false;h.ctx.now+=timer.ms||0;await timer.fn();await settle();return timer}
function installStatusFlow(h){
  Object.assign(h.ctx,{syncCountdown(){},paintPrinter(){},lamp(){},paintPerformance(){},paintCountdown(){},paintOverviewFreshness(){},paintSetupNotice(){},fmt:()=>''});
  vm.runInContext(['status','paint'].map(name=>html.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('))).join('\n'),h.ctx);
}
const freshSample={...freshWifi,bootId:1,hostname:'conveyor',version:'1.5.4',mdns:'conveyor.local',ip:'10.0.0.44',uptimeMs:1000,motor:{state:'Idle'},leds:{green:true,yellow:false,red:false},printer:{}};
function paintFresh(h){installStatusFlow(h);h.ctx.paint(freshSample)}
function unconfiguredSettings(h){
  const saved={operationMode:'mqtt',ssid:'Workshop Wi-Fi',printerIp:'',serialNumber:'',printerModel:'X1',accessCodeSet:false};
  h.state.config={...saved};h.state.savedConfig={...saved};h.state.status={wifi:{connected:true},mqtt:{connected:false}};
  for(const [id,value] of Object.entries({mode:'mqtt',ssid:saved.ssid,pass:'',printerIp:'',serial:'',access:'',model:'X1'}))h.$('#'+id).value=value;
  h.ctx.updateSettingsStatus();return saved;
}
test('a printer found during the active scan immediately gets a green success panel and its own ongoing-search status',async()=>{
  const h=harness(),saved=unconfiguredSettings(h);
  h.ctx.response={scanning:true,remainingMs:18000,printers:[printer]};
  await h.ctx.startPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);
  assert.equal(h.$('#printerDiscovery').className,'note printer-discovery has-results');
  assert.equal(h.$('#discoveryFoundTitle').textContent,'Printer found on your network');
  assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  assert.match(h.$('#discoveryStatus').textContent,/Still looking for other printers.*18s remaining/);
  assert.equal(h.$('#findPrinter').disabled,true);assert.equal(h.discovery.busy,true);
  assert.equal(h.$('#printerIp').value,'');assert.equal(h.$('#serial').value,'');assert.equal(h.$('#access').value,'');
  assert.deepEqual(h.state.savedConfig,saved);
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/api/printer-discovery');
});
test('discovery success shows the current count, all found names and fallback labels without waiting for scan completion',()=>{
  const h=harness(),second={...printer,ip:'10.0.0.51',serial:'00MTEST456',name:''};
  assert.equal(h.ctx.renderPrinterDiscovery({scanning:true,remainingMs:9000,printers:[printer,second]}),true);
  assert.equal(h.$('#discoveryFoundTitle').textContent,'2 printers found on your network');
  assert.equal(h.$('#discoveryFoundName').textContent,'Workshop · Bambu printer');
  assert.equal(h.ctx.renderPrinterDiscovery({scanning:false,printers:[printer,second]}),false);
  h.ctx.finishPrinterDiscovery();
  assert.equal(h.$('#findPrinter').textContent,'Search again');assert.equal(h.$('#findPrinter').disabled,false);
  assert.equal(h.$('#discoveryFound').hidden,false);assert.match(h.$('#discoveryStatus').textContent,/Choose yours/);
  const many=Array.from({length:12},(_,i)=>({...printer,serial:'TEST'+i,name:'Printer '+i}));
  h.ctx.renderPrinterDiscovery({scanning:true,printers:many});
  assert.equal(h.$('#discoveryFoundTitle').textContent,'8 printers found on your network');
  assert.equal(h.$('#discoveryFoundName').textContent.split(' · ').length,8);
  assert.equal(h.$('#discoveredPrinter').children.length,8);
});
test('found is not connected: a missing access code keeps Printer amber and Save blocked even after selecting a result',()=>{
  const h=harness(),saved=unconfiguredSettings(h);
  h.ctx.renderPrinterDiscovery({scanning:true,printers:[printer]});
  assert.match(h.$('#printerSettings').className,/needs/);assert.equal(h.$('#printerBadge').textContent,'! Setup needed');
  h.ctx.useDiscoveredPrinter();
  assert.equal(h.$('#printerIp').value,printer.ip);assert.equal(h.$('#serial').value,printer.serial);
  assert.equal(h.$('#access').value,'');assert.equal(h.$('#access').needs,true);
  assert.match(h.$('#printerHelp').textContent,/access code/);assert.match(h.$('#printerSettings').className,/needs/);
  assert.equal(h.$('#printerBadge').textContent,'! Setup needed');assert.equal(h.$('#saveSettings').disabled,true);
  assert.equal(h.$('#savePrinter').disabled,true);assert.equal(h.$('#discoveryFound').hidden,false);
  assert.doesNotMatch(h.$('#discoveryFoundTitle').textContent,/connected/i);
  assert.deepEqual(h.state.savedConfig,saved);assert.equal(h.requests.length,0);
});
test('an empty ongoing or completed search never paints a discovery success panel',()=>{
  const h=harness();
  h.ctx.renderPrinterDiscovery({scanning:true,remainingMs:20000,printers:[]});
  assert.equal(h.$('#discoveryFound').hidden,true);assert.equal(h.$('#discoveryResults').hidden,true);
  assert.doesNotMatch(h.$('#printerDiscovery').className,/has-results/);
  assert.match(h.$('#discoveryStatus').textContent,/Searching this Wi-Fi network.*20s remaining/);
  h.ctx.renderPrinterDiscovery({scanning:false,printers:[]});h.ctx.finishPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,true);assert.match(h.$('#discoveryStatus').textContent,/No printer announcements/);
  assert.equal(h.$('#findPrinter').textContent,'Find printer');assert.equal(h.$('#findPrinter').disabled,false);
});
test('a rejected retry preserves usable previous results, explicitly labels them, and leaves entered settings unchanged',async()=>{
  const h=harness();h.ctx.response={scanning:false,printers:[printer]};await h.ctx.startPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);
  const fields={printerIp:'10.0.0.70',serial:'MANUAL',access:'TEST-ONLY',pass:'TEST-ONLY'};
  for(const [id,value] of Object.entries(fields))h.$('#'+id).value=value;
  h.ctx.fail=true;h.ctx.failMessage='429: Please wait before searching again';const failed=h.ctx.startPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#discoveryResults').hidden,false);
  assert.match(h.$('#printerDiscovery').className,/has-results/);
  assert.equal(h.$('#discoveredPrinter').children.length,1);assert.equal(h.discovery.printers.length,1);
  await failed;
  assert.equal(h.$('#findPrinter').disabled,false);assert.equal(h.discovery.busy,false);
  assert.equal(h.$('#discoveryFoundName').textContent,printer.name);assert.equal(h.$('#findPrinter').textContent,'Search again');
  assert.match(h.$('#discoveryStatus').textContent,/Search unavailable.*429.*Previous results are still shown.*manually/);
  for(const [id,value] of Object.entries(fields))assert.equal(h.$('#'+id).value,value);
  h.ctx.fail=false;h.ctx.response={scanning:false,printers:[printer]};await h.ctx.startPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#findPrinter').textContent,'Search again');
  assert.ok(h.requests.every(request=>request.path==='/api/printer-discovery'));
});
test('an accepted new scan clears previous discovery results without clearing entered configuration',async()=>{
  const h=harness();h.ctx.response={scanning:false,printers:[printer]};await h.ctx.startPrinterDiscovery();
  const fields={printerIp:'10.0.0.70',serial:'MANUAL',access:'TEST-ONLY',pass:'TEST-ONLY'};
  for(const [id,value] of Object.entries(fields))h.$('#'+id).value=value;
  h.ctx.response={scanning:true,remainingMs:20000,printers:[]};const restarting=h.ctx.startPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  await restarting;
  assert.equal(h.$('#discoveryFound').hidden,true);assert.equal(h.$('#discoveryResults').hidden,true);
  assert.doesNotMatch(h.$('#printerDiscovery').className,/has-results/);
  assert.equal(h.$('#discoveredPrinter').children.length,0);assert.equal(h.discovery.printers.length,0);
  assert.equal(h.$('#discoveryFoundName').textContent,'');assert.equal(h.discovery.busy,true);
  assert.match(h.$('#discoveryStatus').textContent,/Searching this Wi-Fi network.*20s remaining/);
  assert.doesNotMatch(h.$('#discoveryStatus').textContent,/Previous results/);
  for(const [id,value] of Object.entries(fields))assert.equal(h.$('#'+id).value,value);
  h.ctx.response={scanning:false,printers:[]};await h.ctx.pollPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,true);assert.equal(h.$('#findPrinter').disabled,false);
  assert.equal(h.$('#findPrinter').textContent,'Find printer');
  assert.ok(h.requests.every(request=>request.path==='/api/printer-discovery'));
});
test('bounded polling retries keep genuinely found results distinct from the error and never claim connection success',async()=>{
  const h=harness();unconfiguredSettings(h);h.ctx.response={scanning:true,remainingMs:5000,printers:[printer]};
  await h.ctx.startPrinterDiscovery();h.ctx.fail=true;await runTimer(h);
  assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  assert.equal(h.discovery.busy,true);assert.equal(h.$('#findPrinter').disabled,true);assert.match(h.$('#discoveryStatus').textContent,/retry/i);
  await runTimer(h);await runTimer(h);
  assert.equal(h.discovery.busy,false);assert.equal(h.$('#findPrinter').disabled,false);assert.match(h.$('#discoveryStatus').textContent,/Search unavailable/);
  assert.equal(discoveryPosts(h).length,1);assert.equal(discoveryGets(h).length,3);assert.equal(h.$('#discoveryFound').hidden,false);
  assert.equal(h.$('#printerBadge').textContent,'! Setup needed');assert.equal(h.$('#saveSettings').disabled,true);
  assert.equal(h.$('#printerIp').value,'');assert.equal(h.$('#serial').value,'');
});
test('success names use safe text and unchanged results do not repeatedly announce the same success text',()=>{
  const h=harness(),writes={title:0,name:0};
  for(const [id,key] of [['discoveryFoundTitle','title'],['discoveryFoundName','name']]){
    let value=h.$('#'+id).textContent;
    Object.defineProperty(h.$('#'+id),'textContent',{get:()=>value,set:next=>{value=next;writes[key]++},configurable:true});
  }
  const unsafe={...printer,name:'<img onerror=alert(1)> & Workshop'};
  for(let i=0;i<4;i++)h.ctx.renderPrinterDiscovery({scanning:i<3,remainingMs:1000*(4-i),printers:[unsafe]});
  assert.equal(h.$('#discoveryFoundName').textContent,unsafe.name);assert.equal(h.$('#discoveryFoundName').innerHTML,undefined);
  assert.deepEqual(writes,{title:1,name:1});
});
test('discovery success is accessible, visibly green and hidden correctly at narrow widths, with a primary manual-selection action',()=>{
  assert.match(html,/<div class="discovery-found" id="discoveryFound" role="status" aria-live="polite" aria-atomic="true" hidden>/);
  assert.match(html,/\.discovery-found\[hidden\]\{display:none\}/);
  assert.match(html,/\.printer-discovery\.has-results\{/);
  assert.match(html,/\.discovery-found-title\{color:var\(--green\)/);
  assert.match(html,/<button class="btn primary" id="usePrinter">Use selected printer<\/button>/);
  assert.match(html,/id="discoveryStatus" role="status" aria-live="polite"/);
});
test('search is local, bounded and never posts configuration',async()=>{const h=harness();h.ctx.response={scanning:true,remainingMs:20000,printers:[]};await h.ctx.startPrinterDiscovery();await h.ctx.startPrinterDiscovery();assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/api/printer-discovery');assert.equal(h.requests[0].options.body,'{}');assert.equal(h.$('#findPrinter').disabled,true);assert.equal(h.discovery.attempted,true);assert.equal(h.timers.length,1);h.ctx.response={scanning:false,printers:[]};await h.ctx.pollPrinterDiscovery();assert.equal(h.$('#findPrinter').disabled,false);assert.match(h.$('#discoveryStatus').textContent,/No printer announcements/);assert.ok(h.requests.every(r=>r.path==='/api/printer-discovery'))});
test('finding printers alone never fills or saves any fields',()=>{const h=harness();h.ctx.renderPrinterDiscovery({scanning:false,printers:[printer,{...printer,serial:'00MTEST456',ip:'10.0.0.51',model:'X1'}]});assert.equal(h.$('#printerIp').value,'');assert.equal(h.$('#serial').value,'');assert.equal(h.requests.length,0);assert.equal(h.$('#discoveredPrinter').children.length,2);assert.equal(h.$('#discoveryResults').hidden,false)});
test('selection fills IP/serial/model but not passwords and never saves',()=>{const h=harness();h.$('#access').value='existing-input';h.$('#pass').value='existing-input';h.state.config={};h.ctx.renderPrinterDiscovery({printers:[printer]});h.ctx.useDiscoveredPrinter();assert.equal(h.$('#printerIp').value,printer.ip);assert.equal(h.$('#serial').value,printer.serial);assert.equal(h.$('#model').value,'P1');assert.equal(h.$('#access').value,'existing-input');assert.equal(h.$('#pass').value,'existing-input');assert.equal(h.requests.length,0);assert.match(h.messages[0][0],/not saved/)});
test('replacing an entered or configured printer requires confirmation; cancel preserves it',()=>{const h=harness();h.$('#printerIp').value='10.0.0.70';h.$('#serial').value='EXISTING';h.ctx.approve=false;h.ctx.renderPrinterDiscovery({printers:[printer]});h.ctx.useDiscoveredPrinter();assert.equal(h.prompts.length,1);assert.equal(h.$('#printerIp').value,'10.0.0.70');assert.equal(h.$('#serial').value,'EXISTING')});
test('unknown model keeps the current choice and asks for manual confirmation',()=>{const h=harness();h.ctx.renderPrinterDiscovery({printers:[{...printer,model:''}]});h.ctx.useDiscoveredPrinter();assert.equal(h.$('#model').value,'X1');assert.match(h.$('#discoveryStatus').textContent,/Choose the printer model/)});
test('printer names are inserted as text, not executable markup',()=>{const h=harness();h.ctx.renderPrinterDiscovery({printers:[{...printer,name:'<img onerror=alert(1)>'}]});const option=h.$('#discoveredPrinter').children[0];assert.match(option.textContent,/<img onerror/);assert.equal(option.innerHTML,undefined)});
test('refresh preserves the selected printer, including multiple results',()=>{const h=harness(),second={...printer,serial:'00MTEST456',ip:'10.0.0.51'};h.ctx.renderPrinterDiscovery({printers:[printer,second]});h.$('#discoveredPrinter').value=second.serial;h.ctx.renderPrinterDiscovery({printers:[printer,second]});assert.equal(h.$('#discoveredPrinter').value,second.serial)});
test('API failure leaves manual entry and retry available',async()=>{const h=harness();h.ctx.fail=true;await h.ctx.startPrinterDiscovery();assert.equal(h.$('#findPrinter').disabled,false);assert.equal(h.discovery.busy,false);assert.match(h.$('#discoveryStatus').textContent,/manually/);assert.equal(h.requests.length,1)});
test('first unconfigured MQTT setup searches once after fresh Wi-Fi readiness; configured/motion devices do not auto-search',async()=>{for(const [config,expected] of [[{operationMode:'mqtt',ssid:'test',printerIp:'',serialNumber:''},true],[{operationMode:'mqtt',ssid:'test',printerIp:'10.0.0.50',serialNumber:'01PTEST'},false],[{operationMode:'motion',ssid:'test',printerIp:'',serialNumber:''},false],[{operationMode:'mqtt',ssid:'',printerIp:'',serialNumber:''},false]]){const h=harness({realConfig:true});h.state.status=freshWifi;h.ctx.response={...setupConfig,...config};let starts=0;h.ctx.startPrinterDiscovery=()=>{starts++;h.discovery.attempted=true};await h.ctx.loadConfig();await settle();await h.ctx.loadConfig();await settle();assert.equal(starts,expected?1:0)}});
test('an initial Settings load failure recovers automatically after Wi-Fi becomes fresh and never refills later drafts',async()=>{
  const h=harness({realConfig:true});let failed=true;
  h.ctx.response=path=>{if(path==='/api/config'){if(failed)throw Error('Booting');return {...setupConfig,motor:{...setupConfig.motor}}}return {scanning:false,printers:[printer]}};
  await h.ctx.loadConfig();assert.equal(h.state.config,null);assert.equal(h.state.configLoading,false);assert.equal(h.ctx.fills,0);
  assert.equal(configGets(h).length,1);assert.equal(discoveryPosts(h).length,0);
  failed=false;h.state.status=freshWifi;h.state.statusUnavailable=false;await runTimer(h);
  assert.equal(configGets(h).length,2);assert.equal(h.ctx.fills,1);assert.equal(discoveryPosts(h).length,1);
  assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  const draft={ssid:'Edited Wi-Fi',printerIp:'10.0.0.70',serial:'MANUAL',access:'TEST-ONLY',pass:'TEST-ONLY'};
  for(const [id,value] of Object.entries(draft))h.$('#'+id).value=value;
  for(let visit=0;visit<3;visit++){await h.ctx.loadConfig();await h.ctx.recoverPrinterDiscovery();await settle()}
  assert.equal(configGets(h).length,2);assert.equal(h.ctx.fills,1);assert.equal(discoveryPosts(h).length,1);
  for(const [id,value] of Object.entries(draft))assert.equal(h.$('#'+id).value,value);
});
test('automatic discovery waits for a fresh connected Wi-Fi sample instead of consuming its attempt while the board is starting',async()=>{
  for(const [sample,unavailable] of [[null,false],[{wifi:{connected:false}},false],[freshWifi,true]]){
    const h=harness({realConfig:true});h.state.status=sample;h.state.statusUnavailable=unavailable;
    h.ctx.response=path=>path==='/api/config'?{...setupConfig,motor:{...setupConfig.motor}}:{scanning:false,printers:[]};
    await h.ctx.loadConfig();await settle();assert.equal(configGets(h).length,1);assert.equal(discoveryPosts(h).length,0);
    assert.equal(h.discovery.attempted,false);assert.equal(h.discovery.busy,false);
    h.state.status=freshWifi;h.state.statusUnavailable=false;await h.ctx.recoverPrinterDiscovery();await settle();
    assert.equal(discoveryPosts(h).length,1);assert.equal(h.discovery.attempted,true);
    for(let refresh=0;refresh<4;refresh++){await h.ctx.recoverPrinterDiscovery();await settle()}
    assert.equal(discoveryPosts(h).length,1,'Completed empty scan is not repeatedly restarted');
  }
});
test('initial config recovery stops after four failures and after the startup window, leaving manual retry available',async()=>{
  const h=harness({realConfig:true});h.state.status=freshWifi;h.ctx.response=()=>{throw Error('Starting')};
  await h.ctx.loadConfig();for(let retry=0;retry<3;retry++)await runTimer(h);
  assert.equal(configGets(h).length,4);assert.equal(h.discovery.configFailures,4);assert.equal(h.discovery.autoStopped,false);
  const before=h.requests.length;for(let refresh=0;refresh<3;refresh++)await h.ctx.recoverPrinterDiscovery();assert.equal(h.requests.length,before);
  h.ctx.response={scanning:false,printers:[printer]};await h.ctx.startPrinterDiscovery();assert.equal(discoveryPosts(h).length,1);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  const expired=harness();unconfiguredSettings(expired);expired.discovery.startupAt=0;expired.ctx.now=60001;
  await expired.ctx.recoverPrinterDiscovery();await settle();assert.equal(discoveryPosts(expired).length,0);assert.equal(expired.discovery.autoStopped,true);
});
test('automatic start retries transient failures with bounded POST attempts, preserving loaded drafts and found results',async()=>{
  for(const status of [undefined,409,429,503]){
    const h=harness();unconfiguredSettings(h);const draft={printerIp:'10.0.0.70',serial:'',access:'TEST-ONLY'};
    for(const [id,value] of Object.entries(draft))h.$('#'+id).value=value;
    h.ctx.renderPrinterDiscovery({scanning:false,printers:[printer]});let fail=true;
    h.ctx.response=()=>{if(fail)throw status===undefined?Error('Booting'):httpError(status);return {scanning:false,printers:[printer]}};
    await h.ctx.startPrinterDiscovery(true);assert.equal(h.discovery.attempted,false);assert.equal(h.$('#discoveryFound').hidden,false);
    const retry=h.timers.find(timer=>timer.active);assert.ok(retry);assert.equal(retry.ms,status===429?22000:2000);
    fail=false;paintFresh(h);await runTimer(h);assert.equal(discoveryPosts(h).length,2);assert.equal(h.discovery.attempted,true);
    assert.equal(h.$('#discoveryFoundName').textContent,printer.name);for(const [id,value] of Object.entries(draft))assert.equal(h.$('#'+id).value,value);
    assert.equal(configGets(h).length,0);
  }
});
test('automatic start errors stop after three attempts, while terminal and manual failures are not silently retried',async()=>{
  const h=harness();unconfiguredSettings(h);h.ctx.response=()=>{throw httpError(503)};
  await h.ctx.startPrinterDiscovery(true);paintFresh(h);await runTimer(h);paintFresh(h);await runTimer(h);
  assert.equal(discoveryPosts(h).length,3);assert.equal(h.discovery.startFailures,3);assert.equal(h.discovery.autoStopped,true);
  await h.ctx.recoverPrinterDiscovery();assert.equal(discoveryPosts(h).length,3);assert.equal(h.$('#findPrinter').disabled,false);
  for(const automatic of [false,true]){
    const terminal=harness();unconfiguredSettings(terminal);terminal.ctx.response=()=>{throw httpError(400)};
    await terminal.ctx.startPrinterDiscovery(automatic);assert.equal(discoveryPosts(terminal).length,1);assert.equal(terminal.discovery.busy,false);
    assert.equal(terminal.timers.filter(timer=>timer.active).length,0);
  }
  const manual=harness();unconfiguredSettings(manual);manual.ctx.response=()=>{throw httpError(503)};
  await manual.ctx.startPrinterDiscovery();assert.equal(discoveryPosts(manual).length,1);assert.equal(manual.timers.filter(timer=>timer.active).length,0);
});
test('an interrupted accepted search resumes GET polling without another POST and retains discovered names and manual fields',async()=>{
  const h=harness();unconfiguredSettings(h);h.ctx.response={scanning:true,remainingMs:10000,printers:[printer]};
  await h.ctx.startPrinterDiscovery(true);h.$('#printerIp').value='10.0.0.70';h.$('#access').value='TEST-ONLY';
  let failed=true;h.ctx.response=()=>{if(failed)throw httpError(503);return {scanning:false,printers:[printer]}};
  await runTimer(h);assert.equal(h.discovery.busy,true);assert.equal(h.discovery.pollFailures,1);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  failed=false;const retry=await runTimer(h);assert.equal(retry.ms,2000);assert.equal(discoveryPosts(h).length,1);assert.equal(discoveryGets(h).length,2);
  assert.equal(h.discovery.busy,false);assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#printerIp').value,'10.0.0.70');assert.equal(h.$('#access').value,'TEST-ONLY');
});
test('automatic recovery and queued retries respect save, update, motion and navigation guards without changing settings',async()=>{
  for(const blocked of ['sectionSave','fullSettingsSave','updateBusy','updateChecking','hidden','motion']){
    const h=harness();unconfiguredSettings(h);h.$('#access').value='TEST-ONLY';
    if(blocked==='hidden')h.$('#settings').hidden=true;else if(blocked==='motion'){h.state.savedConfig.operationMode='motion';h.state.config.operationMode='motion';h.$('#mode').value='motion'}else h.state[blocked]=blocked==='sectionSave'?{scope:'printer'}:true;
    h.ctx.response={scanning:false,printers:[]};await h.ctx.recoverPrinterDiscovery();await settle();
    assert.equal(discoveryPosts(h).length,0,blocked);assert.equal(h.$('#access').value,'TEST-ONLY');
  }
  const pending=harness();unconfiguredSettings(pending);pending.ctx.response=()=>{throw httpError(503)};await pending.ctx.startPrinterDiscovery(true);
  pending.state.updateBusy=true;await runTimer(pending);assert.equal(discoveryPosts(pending).length,1);
  pending.state.updateBusy=false;pending.$('#settings').hidden=true;await pending.ctx.recoverPrinterDiscovery();assert.equal(discoveryPosts(pending).length,1);
  pending.$('#settings').hidden=false;pending.ctx.response={scanning:false,printers:[]};paintFresh(pending);await settle();assert.equal(discoveryPosts(pending).length,2);
});
test('overlapping automatic recovery and Settings loads remain single-flight and do not consume duplicate scan attempts',async()=>{
  const h=harness({realConfig:true});h.state.status=freshWifi;let resolveConfig,resolveScan;
  h.ctx.response=(path,options)=>path==='/api/config'?new Promise(resolve=>resolveConfig=resolve):options?.method==='POST'?new Promise(resolve=>resolveScan=resolve):undefined;
  const first=h.ctx.loadConfig();await h.ctx.loadConfig();await h.ctx.recoverPrinterDiscovery();assert.equal(configGets(h).length,1);
  resolveConfig({...setupConfig,motor:{...setupConfig.motor}});await first;await settle();
  assert.equal(discoveryPosts(h).length,1);for(let attempt=0;attempt<4;attempt++){await h.ctx.recoverPrinterDiscovery();await h.ctx.startPrinterDiscovery(true)}
  assert.equal(discoveryPosts(h).length,1);resolveScan({scanning:false,printers:[]});await settle();assert.equal(h.ctx.fills,1);
});
test('typed startup drafts survive the first recovered config fill, including cleared values and unchecked controls',async()=>{
  const h=harness({realConfig:true});let failed=true;
  h.ctx.response=path=>{if(path==='/api/config'){if(failed)throw Error('Starting');return {...setupConfig,debug:true}}return {scanning:false,printers:[printer]}};
  await h.ctx.loadConfig();assert.equal(h.state.config,null);
  const draft={mode:'mqtt',tz:'3',ssid:'My draft Wi-Fi',pass:'TEST-ONLY',printerIp:'10.0.0.70',serial:'',access:'TEST-ONLY',model:'H2',wait:'7000',duration:'9000',cooldown:'180000',speed:'200',direction:'Reverse'};
  for(const [id,value] of Object.entries(draft)){h.$('#'+id).value=value;h.$('#'+id).dispatch(id==='model'?'change':'input');assert.equal(h.$('#'+id).dataset.startupEdited,'true')}
  h.$('#debug').checked=false;h.$('#debug').dispatch('change');assert.equal(h.$('#debug').dataset.startupEdited,'true');
  failed=false;h.state.status=freshWifi;await runTimer(h);
  assert.equal(h.ctx.fills,1);assert.equal(configGets(h).length,2);assert.equal(discoveryPosts(h).length,1);
  for(const [id,value] of Object.entries(draft)){assert.equal(h.$('#'+id).value,value,id);if(!['pass','access'].includes(id))assert.equal(h.$('#'+id).dataset.startupEdited,undefined,id)}
  assert.equal(h.$('#debug').checked,false);assert.equal(h.$('#debug').dataset.startupEdited,undefined);
  assert.equal(h.state.savedConfig.ssid,setupConfig.ssid,'Persisted baseline must not become the unsaved draft');
  h.$('#ssid').value='Later draft';h.$('#ssid').dispatch('input');assert.equal(h.$('#ssid').dataset.startupEdited,undefined);
  await h.ctx.loadConfig();assert.equal(h.ctx.fills,1);assert.equal(h.$('#ssid').value,'Later draft');
});
test('Use selected printer during an unresolved initial config read survives that late response without saving',async()=>{
  const h=harness({realConfig:true});let resolveConfig;
  h.ctx.response=path=>path==='/api/config'?new Promise(resolve=>resolveConfig=resolve):{scanning:false,printers:[printer]};
  const loading=h.ctx.loadConfig();assert.equal(h.state.configLoading,true);assert.equal(h.state.config,null);
  h.$('#access').value='TEST-ONLY';h.$('#access').dispatch('input');h.$('#pass').value='TEST-ONLY';h.$('#pass').dispatch('input');
  await h.ctx.startPrinterDiscovery();h.ctx.useDiscoveredPrinter();assert.equal(h.$('#printerIp').value,printer.ip);assert.equal(h.$('#serial').value,printer.serial);assert.equal(h.$('#model').value,printer.model);
  resolveConfig(setupConfig);await loading;await settle();
  assert.equal(h.$('#printerIp').value,printer.ip);assert.equal(h.$('#serial').value,printer.serial);assert.equal(h.$('#model').value,printer.model);
  assert.equal(h.$('#access').value,'TEST-ONLY');assert.equal(h.$('#pass').value,'TEST-ONLY');assert.equal(h.ctx.fills,1);
  assert.equal(h.state.savedConfig.printerIp,'');assert.equal(h.state.savedConfig.serialNumber,'');
  assert.equal(configGets(h).length,1);assert.equal(discoveryPosts(h).length,1);assert.equal(h.requests.filter(request=>request.path==='/api/config'&&request.options?.method==='POST').length,0);
});
test('configuration retries recover before Wi-Fi is fresh, but never start a scan until its connection is confirmed',async()=>{
  const h=harness({realConfig:true});let failed=true;h.state.status={wifi:{connected:false}};h.state.statusUnavailable=true;
  h.ctx.response=path=>{if(path==='/api/config'){if(failed)throw httpError(503);return setupConfig}return {scanning:false,printers:[]}};
  await h.ctx.loadConfig();failed=false;await runTimer(h);
  assert.equal(configGets(h).length,2);assert.equal(h.ctx.fills,1);assert.equal(discoveryPosts(h).length,0);assert.equal(h.discovery.attempted,false);
  h.state.status=freshWifi;h.state.statusUnavailable=false;await h.ctx.recoverPrinterDiscovery();await settle();assert.equal(discoveryPosts(h).length,1);
});
test('a delayed automatic retry stops at the startup deadline without blocking a later manual search',async()=>{
  const h=harness();unconfiguredSettings(h);h.discovery.startupAt=0;h.ctx.now=57000;h.ctx.response=()=>{throw httpError(429)};
  await h.ctx.startPrinterDiscovery(true);assert.equal(discoveryPosts(h).length,1);assert.equal(h.discovery.autoStopped,false);
  h.ctx.response={scanning:false,printers:[printer]};await runTimer(h);assert.equal(discoveryPosts(h).length,1);assert.equal(h.discovery.autoStopped,true);
  await h.ctx.startPrinterDiscovery();assert.equal(discoveryPosts(h).length,2);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
});
test('automatic startup failures wait for genuinely newer status and do not burn through retry attempts during a reboot',async()=>{
  const h=harness();unconfiguredSettings(h);installStatusFlow(h);let scans=0,resolveOld;
  h.ctx.response=path=>path==='/api/status'?new Promise(resolve=>resolveOld=resolve):(++scans<3?Promise.reject(httpError(409)):{scanning:false,printers:[printer]});
  const oldStatus=h.ctx.status(true);await h.ctx.startPrinterDiscovery(true);
  assert.equal(h.discovery.waitForStatus,true);assert.equal(h.state.statusGeneration,1);assert.equal(h.discovery.startFailures,1);
  resolveOld(freshSample);await oldStatus;assert.equal(h.discovery.waitForStatus,true,'A pre-failure status must not authorize another attempt');
  await runTimer(h);assert.equal(discoveryPosts(h).length,1);assert.equal(h.discovery.startFailures,1);
  h.ctx.now=3000;h.ctx.response=path=>path==='/api/status'?freshSample:(++scans<3?Promise.reject(httpError(409)):{scanning:false,printers:[printer]});
  await h.ctx.status(true);await settle();assert.equal(discoveryPosts(h).length,2);assert.equal(h.discovery.waitForStatus,true);assert.equal(h.discovery.startFailures,2);
  h.ctx.response=path=>{if(path==='/api/status')throw Error('Restarting');return {scanning:false,printers:[printer]}};
  await runTimer(h);for(const now of [6000,9000,12000,18000]){h.ctx.now=now;await h.ctx.status(true);await h.ctx.recoverPrinterDiscovery();await settle()}
  assert.equal(discoveryPosts(h).length,2);assert.equal(h.discovery.startFailures,2);assert.equal(h.discovery.autoStopped,false);
  h.ctx.now=20000;h.ctx.response=path=>path==='/api/status'?{...freshSample,bootId:2}:{scanning:false,printers:[printer]};
  await h.ctx.status(true);await settle();assert.equal(discoveryPosts(h).length,3);assert.equal(h.discovery.attempted,true);assert.equal(h.discovery.autoStopped,false);
  assert.equal(h.$('#discoveryFoundName').textContent,printer.name);assert.equal(configGets(h).length,0);
});
test('both stale status success and error are discarded after an automatic startup failure',async()=>{
  for(const failed of [false,true]){
    const h=harness();unconfiguredSettings(h);installStatusFlow(h);let resolve,reject;
    h.ctx.response=path=>path==='/api/status'?new Promise((r,j)=>{resolve=r;reject=j}):Promise.reject(httpError(503));
    const oldStatus=h.ctx.status(true);await h.ctx.startPrinterDiscovery(true);
    if(failed)reject(Error('Old timeout'));else resolve(freshSample);await oldStatus;await settle();
    assert.equal(h.discovery.waitForStatus,true);assert.equal(h.state.statusUnavailable,undefined);assert.equal(h.state.statusLoading,false);assert.equal(discoveryPosts(h).length,1);
    await runTimer(h);assert.equal(discoveryPosts(h).length,1);
  }
});
test('completed manual printer details or motion-mode startup edits suppress automatic discovery after recovery',async()=>{
  for(const kind of ['complete','motion']){
    const h=harness({realConfig:true});let failed=true;
    h.ctx.response=path=>{if(path==='/api/config'){if(failed)throw Error('Starting');return setupConfig}return {scanning:false,printers:[]}};
    await h.ctx.loadConfig();const draft=kind==='complete'?{printerIp:'10.0.0.70',serial:'MANUAL'}:{mode:'motion'};
    for(const [id,value] of Object.entries(draft)){h.$('#'+id).value=value;h.$('#'+id).dispatch('input')}
    failed=false;h.state.status=freshWifi;await runTimer(h);
    assert.equal(h.ctx.fills,1);assert.equal(discoveryPosts(h).length,0);for(const [id,value] of Object.entries(draft))assert.equal(h.$('#'+id).value,value);
  }
});
test('pre-save config responses and errors from an old generation cannot refill drafts or schedule a stale retry',async()=>{
  for(const failed of [false,true]){
    const h=harness({realConfig:true});let resolve,reject;
    h.ctx.response=()=>new Promise((r,j)=>{resolve=r;reject=j});const loading=h.ctx.loadConfig();
    h.$('#ssid').value='Unsaved draft';h.$('#ssid').dispatch('input');h.state.statusGeneration=1;h.state.fullSettingsSave=true;
    if(failed)reject(httpError(503));else resolve({...setupConfig,ssid:'Obsolete config'});
    await loading;await settle();assert.equal(h.state.config,null);assert.equal(h.state.savedConfig,undefined);assert.equal(h.state.configLoading,false);
    assert.equal(h.ctx.fills,0);assert.equal(h.discovery.configFailures,0);assert.equal(h.timers.filter(timer=>timer.active).length,0);
    assert.equal(h.messages.length,0);assert.equal(h.$('#ssid').value,'Unsaved draft');assert.equal(configGets(h).length,1);assert.equal(discoveryPosts(h).length,0);
    h.state.fullSettingsSave=false;h.state.status=freshWifi;h.ctx.response=path=>path==='/api/config'?setupConfig:{scanning:false,printers:[]};
    await h.ctx.loadConfig();await settle();assert.equal(configGets(h).length,2);assert.equal(h.ctx.fills,1);assert.equal(h.$('#ssid').value,'Unsaved draft');
    assert.equal(discoveryPosts(h).length,1);
  }
});
test('the Find printer click wrapper treats a browser event as manual and does not silently retry its failure',async()=>{
  const h=harness();unconfiguredSettings(h);h.ctx.response=()=>{throw httpError(503)};
  vm.runInContext(html.split('\n').find(line=>line.startsWith("$('#findPrinter').onclick=")),h.ctx);
  await h.$('#findPrinter').onclick({type:'click'});assert.equal(discoveryPosts(h).length,1);assert.equal(h.discovery.autoStopped,true);
  assert.equal(h.timers.filter(timer=>timer.active).length,0);assert.equal(h.$('#findPrinter').disabled,false);
});
test('HTTP API errors retain response status so transient discovery failures are distinguished from terminal errors',async()=>{
  const h=harness();vm.runInContext(html.split('\n').find(line=>line.startsWith('async function api(')),h.ctx);
  for(const status of [400,401,403,409,429,503]){
    h.ctx.fetch=async()=>({ok:false,status,json:async()=>({error:'Temporary test error'})});
    await assert.rejects(h.ctx.api('/api/printer-discovery'),error=>{assert.equal(error.status,status);assert.equal(error.message,'Temporary test error');assert.equal(h.ctx.discoveryTransient(error),[409,429,503].includes(status));return true});
  }
});
test('an in-flight discovery poll cannot replace found choices after navigation, a save or an update begins',async()=>{
  for(const blocked of ['hidden','sectionSave','fullSettingsSave','updateBusy','updateChecking','motion']){
    const h=harness();unconfiguredSettings(h);h.ctx.response={scanning:true,printers:[printer]};await h.ctx.startPrinterDiscovery(true);
    let resolve;h.ctx.response=()=>new Promise(r=>resolve=r);const pending=h.ctx.pollPrinterDiscovery();
    if(blocked==='hidden')h.$('#settings').hidden=true;else if(blocked==='motion')h.$('#mode').value='motion';else h.state[blocked]=blocked==='sectionSave'?{scope:'printer'}:true;
    resolve({scanning:false,printers:[]});await pending;assert.equal(h.discovery.busy,false);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
    assert.equal(h.discovery.printers.length,1);assert.equal(h.timers.filter(timer=>timer.active).length,0);assert.equal(discoveryPosts(h).length,1);
  }
});
test('complete inline script parses and discovery results respect hidden on all breakpoints',()=>{new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);assert.match(html,/#discoveryResults\[hidden\]\{display:none\}/);assert.match(html,/@media\(max-width:520px\)/)});
test('Show/Hide preserves entered text without requesting a stored value',async()=>{for(const id of ['pass','access']){const h=harness(),input=h.$('#'+id),button=h.$('.secret-toggle[data-secret="'+id+'"]');button.dataset.secret=id;input.type='password';input.value='TEST-ONLY';await h.ctx.toggleSecret(button);assert.equal(input.type,'text');assert.equal(input.value,'TEST-ONLY');assert.equal(button.textContent,'Hide');assert.equal(button.attributes['aria-pressed'],'true');await h.ctx.toggleSecret(button);assert.equal(input.type,'password');assert.equal(input.value,'TEST-ONLY');assert.equal(button.textContent,'Show');assert.equal(button.attributes['aria-pressed'],'false');assert.equal(h.requests.length,0)}});
test('Show explicitly retrieves only the requested saved field, and viewing it is not a replacement',async()=>{for(const id of ['pass','access']){const h=harness(),input=h.$('#'+id),button=h.$('.secret-toggle[data-secret="'+id+'"]');button.dataset.secret=id;input.type='password';h.ctx.response={value:'TEST-ONLY'};await h.ctx.toggleSecret(button);assert.equal(input.type,'text');assert.equal(input.value,'TEST-ONLY');assert.equal(input.dataset.savedSecret,'true');assert.equal(h.ctx.secretInputValue(id),'');assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/api/config/reveal');assert.equal(h.requests[0].options.method,'POST');assert.deepEqual(JSON.parse(h.requests[0].options.body),{field:id==='pass'?'wifiPassword':'accessCode'});await h.ctx.toggleSecret(button);assert.equal(input.type,'password');assert.equal(h.requests.length,1);delete input.dataset.savedSecret;input.value='REPLACEMENT';assert.equal(h.ctx.secretInputValue(id),'REPLACEMENT')}});
test('Network and Printer use separate cards without losing field IDs or labels',()=>{const network=html.match(/id="networkSettings">([\s\S]*?)<div class="panel setup-card" id="printerSettings">/)[1],printer=html.match(/id="printerSettings">([\s\S]*?)<div class="panel setup-card good" id="motorSettings">/)[1];assert.match(network,/<h2>Network<\/h2>/);assert.match(network,/id="ssid"/);assert.match(network,/id="pass"/);assert.doesNotMatch(network,/id="printerIp"|id="findPrinter"/);assert.match(printer,/<h2>Printer<\/h2>/);for(const id of ['printerIp','access','serial','model','findPrinter'])assert.ok(printer.includes('id="'+id+'"'));assert.doesNotMatch(printer,/id="ssid"|id="pass"/)});
