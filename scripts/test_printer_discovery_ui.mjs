import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const names=['loadConfig','setSecretVisibility','toggleSecret','secretInputValue'];
const functions=names.map(name=>html.split('\n').find(line=>line.startsWith('function '+name+'(')||line.startsWith('async function '+name+'('))).join('\n');
const settingsLogic=html.slice(html.indexOf('function settingsReadiness('),html.indexOf('function renderPrinterDiscovery('));
const discoveryLogic=html.slice(html.indexOf('function renderPrinterDiscovery('),html.indexOf("$('#findPrinter').onclick="));
function harness(){
  const elements=new Map(),requests=[],timers=[],prompts=[],messages=[];
  const $=selector=>{if(!elements.has(selector))elements.set(selector,{value:'',dataset:{},textContent:'',className:'',hidden:true,disabled:false,needs:false,attributes:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(){},closest(){return {classList:{toggle:(_,v)=>this.needs=v}}},children:[],options:[],replaceChildren(){this.children=[];this.value=''},appendChild(o){this.children.push(o);if(!this.value)this.value=o.value}});return elements.get(selector)};
  $('#model').options=['X1','P1','A1','H2','P2'].map(value=>({value}));$('#model').value='X1';
  const discovery={attempted:false,busy:false,printers:[],timer:null};
  const state={config:null};
  const ctx=vm.createContext({$,discovery,state,document:{createElement:()=>({})},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},AbortSignal,
    toast:(...x)=>messages.push(x),confirm:text=>{prompts.push(text);return ctx.approve},approve:true,
    fillConfig:()=>{},syncDownloadSource:()=>{},updateSecretHints:()=>{},api:async(path,options)=>{requests.push({path,options});if(ctx.fail)throw Error(ctx.failMessage||'Offline');return ctx.response}});
  vm.runInContext(settingsLogic+'\n'+discoveryLogic+'\n'+functions,ctx);
  return {ctx,$,discovery,state,requests,timers,prompts,messages};
}
const printer={ip:'10.0.0.50',serial:'01PTEST123',model:'P1',name:'Workshop'};
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
test('a polling error keeps genuinely found results distinct from the error and never claims connection success',async()=>{
  const h=harness();unconfiguredSettings(h);h.ctx.response={scanning:true,remainingMs:5000,printers:[printer]};
  await h.ctx.startPrinterDiscovery();h.ctx.fail=true;await h.ctx.pollPrinterDiscovery();
  assert.equal(h.$('#discoveryFound').hidden,false);assert.equal(h.$('#discoveryFoundName').textContent,printer.name);
  assert.match(h.$('#discoveryStatus').textContent,/Search unavailable/);assert.equal(h.$('#findPrinter').disabled,false);
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
test('first unconfigured MQTT setup searches once; configured/motion devices do not auto-search',async()=>{for(const [config,expected] of [[{operationMode:'mqtt',ssid:'test',printerIp:'',serialNumber:''},true],[{operationMode:'mqtt',ssid:'test',printerIp:'10.0.0.50',serialNumber:'01PTEST'},false],[{operationMode:'motion',ssid:'test',printerIp:'',serialNumber:''},false],[{operationMode:'mqtt',ssid:'',printerIp:'',serialNumber:''},false]]){const h=harness();h.ctx.response=config;let starts=0;h.ctx.startPrinterDiscovery=()=>{starts++;h.discovery.attempted=true};await h.ctx.loadConfig();await h.ctx.loadConfig();assert.equal(starts,expected?1:0)}});
test('complete inline script parses and discovery results respect hidden on all breakpoints',()=>{new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);assert.match(html,/#discoveryResults\[hidden\]\{display:none\}/);assert.match(html,/@media\(max-width:520px\)/)});
test('Show/Hide preserves entered text without requesting a stored value',async()=>{for(const id of ['pass','access']){const h=harness(),input=h.$('#'+id),button=h.$('.secret-toggle[data-secret="'+id+'"]');button.dataset.secret=id;input.type='password';input.value='TEST-ONLY';await h.ctx.toggleSecret(button);assert.equal(input.type,'text');assert.equal(input.value,'TEST-ONLY');assert.equal(button.textContent,'Hide');assert.equal(button.attributes['aria-pressed'],'true');await h.ctx.toggleSecret(button);assert.equal(input.type,'password');assert.equal(input.value,'TEST-ONLY');assert.equal(button.textContent,'Show');assert.equal(button.attributes['aria-pressed'],'false');assert.equal(h.requests.length,0)}});
test('Show explicitly retrieves only the requested saved field, and viewing it is not a replacement',async()=>{for(const id of ['pass','access']){const h=harness(),input=h.$('#'+id),button=h.$('.secret-toggle[data-secret="'+id+'"]');button.dataset.secret=id;input.type='password';h.ctx.response={value:'TEST-ONLY'};await h.ctx.toggleSecret(button);assert.equal(input.type,'text');assert.equal(input.value,'TEST-ONLY');assert.equal(input.dataset.savedSecret,'true');assert.equal(h.ctx.secretInputValue(id),'');assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/api/config/reveal');assert.equal(h.requests[0].options.method,'POST');assert.deepEqual(JSON.parse(h.requests[0].options.body),{field:id==='pass'?'wifiPassword':'accessCode'});await h.ctx.toggleSecret(button);assert.equal(input.type,'password');assert.equal(h.requests.length,1);delete input.dataset.savedSecret;input.value='REPLACEMENT';assert.equal(h.ctx.secretInputValue(id),'REPLACEMENT')}});
test('Network and Printer use separate cards without losing field IDs or labels',()=>{const network=html.match(/id="networkSettings">([\s\S]*?)<div class="panel setup-card" id="printerSettings">/)[1],printer=html.match(/id="printerSettings">([\s\S]*?)<div class="panel setup-card good" id="motorSettings">/)[1];assert.match(network,/<h2>Network<\/h2>/);assert.match(network,/id="ssid"/);assert.match(network,/id="pass"/);assert.doesNotMatch(network,/id="printerIp"|id="findPrinter"/);assert.match(printer,/<h2>Printer<\/h2>/);for(const id of ['printerIp','access','serial','model','findPrinter'])assert.ok(printer.includes('id="'+id+'"'));assert.doesNotMatch(printer,/id="ssid"|id="pass"/)});
