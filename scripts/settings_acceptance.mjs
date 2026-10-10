// Read-only acceptance on the owner-authorized test ESP32. Never logs credentials.
// Usage: node scripts/settings_acceptance.mjs
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base='http://10.0.0.44';
const call=(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(10000),cache:'no-store'});
const json=async path=>{const r=await call(path);assert.equal(r.status,200);return r.json()};
const fingerprint=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const config=await json('/api/config'),triggers=await json('/api/triggers'),health=await json('/api/health');
assert.equal(health.displayVersion,'1.5.4');
assert.ok(!Object.hasOwn(config,'wifiPassword')&&!Object.hasOwn(config,'accessCode'));
const reveal=(field,headers={})=>call('/api/config/reveal',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({field})});
assert.notEqual((await call('/api/config/reveal')).status,200,'GET must not disclose credentials');
assert.equal((await reveal('wifiPassword')).status,403,'Explicit Show header is required');
assert.equal((await reveal('wifiPassword',{'X-Conveyor-Settings':'reveal',Origin:'https://example.invalid'})).status,403,'Foreign origin must be rejected');
assert.equal((await reveal('unknown',{'X-Conveyor-Settings':'reveal',Origin:base})).status,400);
assert.equal((await call('/api/config/reveal',{method:'POST',headers:{'Content-Type':'application/json','X-Conveyor-Settings':'reveal',Origin:base},body:'x'.repeat(65)})).status,400);
for(const [field,flag] of [['wifiPassword','wifiPasswordSet'],['accessCode','accessCodeSet']]){
  const r=await reveal(field,{'X-Conveyor-Settings':'reveal',Origin:base});
  assert.equal(r.status,200);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal(r.headers.get('access-control-allow-origin'),null);
  const result=await r.json();
  assert.equal(result.ok,true);assert.equal(typeof result.value,'string');
  // Compare only booleans: never include stored values in assertion errors.
  const configured=field==='accessCode'?result.value.trim().length>0&&result.value.trim()!=='your-bambu-printer-accesscode':result.value.length>0;
  assert.equal(configured,config[flag]);
}
assert.equal(fingerprint(await json('/api/config')),fingerprint(config),'Viewing changed configuration');
assert.equal(fingerprint(await json('/api/triggers')),fingerprint(triggers),'Viewing changed triggers');
assert.equal((await json('/api/health')).bootId,health.bootId,'Viewing caused a restart');
console.log('PASS: saved-field reveal, explicit local action, cross-origin rejection, no-store, no routine disclosure, no restart, settings/triggers unchanged. No credentials logged.');
