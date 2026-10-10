// Read-only settings acceptance plus a bounded local discovery search on the
// explicitly authorized test ESP32. Never saves configuration or runs a motor.
// Usage: node scripts/discovery_acceptance.mjs <expected printer IPv4>
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const base='http://10.0.0.44',expected=process.argv[2];
assert.ok(expected,'Specify the expected local printer IP');
const req=async(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(10000)});
const json=async path=>{const r=await req(path);assert.equal(r.status,200,path);return r.json()};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const before=hash(await json('/api/config')),boot=await json('/api/health');
assert.equal(boot.displayVersion,'1.5.4');
assert.equal((await req('/api/printer-discovery',{method:'POST',body:'invalid'})).status,400);
const start=await req('/api/printer-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(start.status,200);
const first=await start.json();assert.equal(first.scanning,true);
const repeated=await (await req('/api/printer-discovery',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
assert.ok(repeated.remainingMs<=first.remainingMs,'Repeated start must not extend the scan');
let seen=false,maxMs=0;
for(let i=0;i<12;i++){
  const t=performance.now(),health=await json('/api/health');maxMs=Math.max(maxMs,performance.now()-t);
  assert.equal(health.bootId,boot.bootId);assert.equal(health.displayVersion,'1.5.4');
  const status=await json('/api/status');assert.equal(status.motor.state,'Idle');assert.equal(status.wifi.connected,true);
  const d=await json('/api/printer-discovery');seen ||=d.printers.some(p=>p.ip===expected&&p.serial&&p.model);
  await delay(1800);
}
assert.equal((await json('/api/printer-discovery')).scanning,false);assert.ok(seen,'Real printer was not found');
assert.equal(hash(await json('/api/config')),before,'Searching changed stored settings');
console.log(JSON.stringify({result:'PASS',realPrinterFound:true,repeatStartDoesNotExtendScan:true,searchAutoStops:true,
  configurationUnchanged:true,sameBoot:true,samples:12,maxHealthResponseMs:Math.round(maxMs),motor:'Idle'}));
