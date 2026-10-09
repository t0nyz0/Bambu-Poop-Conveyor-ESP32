// Explicitly authorized test-device OTA acceptance. Preserves settings; never erases flash.
// Usage: node scripts/ota_acceptance.mjs <OTA file> <display version> <published mirror URL>
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const [file,label,mirror]=process.argv.slice(2);
assert.ok(file && label && mirror,'Specify OTA image, expected display version, and HTTPS mirror');
const base='http://10.0.0.44'; // Only the user-authorized test ESP32.
const digest=value=>createHash('sha256').update(value).digest('hex');
const stableJSON=value=>JSON.stringify(value,(_,v)=>v && !Array.isArray(v) && typeof v==='object'
  ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(10000),cache:'no-store'});assert.equal(r.status,200,path);return r.json()};
const health=await get('/api/health'),status=await get('/api/status');
assert.equal(status.motor.state,'Idle','Do not update while the conveyor is moving/waiting');
assert.equal(status.motor.running,false);
const configHash=digest(stableJSON(await get('/api/config')));
const triggersHash=digest(stableJSON(await get('/api/triggers')));
const bytes=await readFile(file);
assert.equal(bytes[0],0xe9);assert.ok(bytes.length>=65536 && bytes.length<=1310720);
const url=new URL(mirror);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'raw.githubusercontent.com');
const response=await fetch(url,{headers:{Origin:base},signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'*');
assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes,'Published mirror must match the tested artifact');
console.log('Published OTA mirror verified; conveyor is idle. Configuration and trigger fingerprints captured without exposing values.');
const data=new FormData();data.append('firmware',new File([bytes],file.split('/').pop(),{type:'application/octet-stream'}));
const upload=await fetch(base+'/update',{method:'POST',body:data,signal:AbortSignal.timeout(60000)});
assert.equal(upload.status,200);assert.equal((await upload.json()).ok,true);
console.log('ESP32 accepted OTA. Waiting for a new boot and expected firmware.');
let returned;
for(let attempt=0;attempt<60;attempt++){
  await delay(1000);
  try{const h=await get('/api/health');if(h.bootId!==health.bootId && h.displayVersion===label){returned=h;break}}catch{}
}
assert.ok(returned,'Expected firmware did not return within the acceptance window');
assert.equal(digest(stableJSON(await get('/api/config'))),configHash,'Saved settings changed');
assert.equal(digest(stableJSON(await get('/api/triggers'))),triggersHash,'Trigger rules changed');
const after=await get('/api/status');assert.equal(after.wifi.connected,true);assert.equal(after.motor.state,'Idle');
const root=await fetch(base+'/',{redirect:'manual',signal:AbortSignal.timeout(10000)});
const isPreviousStable=label==='1.5.1';
assert.equal(root.status,isPreviousStable?200:302);
if(!isPreviousStable)assert.equal(root.headers.get('location'),'/config','This printer-unconfigured test board should open Settings');
let expectedUI=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
if(isPreviousStable){const r=await fetch('https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/Release-v1.5.1/web/index.html');assert.equal(r.status,200);expectedUI=await r.text()}
for(const route of ['/config','/control','/logs','/update']){
  const r=await fetch(base+route,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,200,route);
  assert.equal(await r.text(),expectedUI,route+': served UI differs from source');
}
await get('/api/logs');await get('/status');
console.log(JSON.stringify({result:'PASS',displayVersion:returned.displayVersion,oldBoot:health.bootId,newBoot:returned.bootId,
  configurationPreserved:true,triggersPreserved:true,wifiConnected:true,motor:'Idle',defaultRoute:isPreviousStable?'/':'/config',otaSha256:digest(bytes)}));
