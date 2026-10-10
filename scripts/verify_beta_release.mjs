// Read-only beta publication audit; never installs firmware or changes a device.
// Run: node scripts/verify_beta_release.mjs [1.5.4-beta.1] [https://t0nyz.com]
// Before publication: node scripts/verify_beta_release.mjs --local-only
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const args=process.argv.slice(2),localOnly=args.includes('--local-only');
assert.ok(args.every(x=>!x.startsWith('--')||x==='--local-only'),'Unknown audit option');
const positional=args.filter(x=>!x.startsWith('--'));
assert.ok(positional.length<=2,'Expected at most an artifact version and site URL');
const artifact=positional[0]||'1.5.4-beta.1',match=/^(\d+\.\d+\.\d+)-beta\.([1-9]\d*)$/.exec(artifact);
assert.ok(match,'Use an explicit beta artifact version');
const version=match[1],display=version+' Beta '+match[2],label='v'+display;
const site=new URL(positional[1]||'https://t0nyz.com');
const repo='https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/';
const root=new URL('../',import.meta.url),prefix='Bambu-Poop-Conveyor-v'+artifact;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=path=>readFile(new URL(path,root));
const json=async path=>JSON.parse(await local(path));
const descriptor=await json('installer/latest-v'+artifact+'.json');
const manifest=await json('installer/manifest-v'+artifact+'.json');
const ota=await local('firmware/releases/v'+artifact+'/'+prefix+'-ota.bin');
const merged=await local('firmware/releases/v'+artifact+'/'+prefix+'-merged.bin');
const checksumBytes=await local('firmware/releases/v'+artifact+'/SHA256SUMS.txt');
const checksums=new Map(checksumBytes.toString().trim().split(/\r?\n/).map(line=>{
  const entry=/^([a-f0-9]{64})\s{2}([^/\\]+)$/.exec(line);
  assert.ok(entry,'Malformed checksum entry');return [entry[2],entry[1]];
}));
assert.equal(checksums.size,2,'Expected only the two beta images in checksums');

function checkDescriptor(d){
  assert.equal(d.version,version);assert.equal(d.channel,'beta');assert.equal(d.label,label);
  assert.equal(d.available,true,'Beta must be explicitly available');
  assert.equal(d.supersededBy,undefined,'An available beta must not be marked superseded');
  assert.equal(d.sha256,sha(ota),'Descriptor must identify the exact approved OTA');
  assert.equal(d.githubBin,new URL('v'+artifact+'/firmware/releases/v'+artifact+'/'+prefix+'-ota.bin',repo).href);
}
function checkManifest(m){
  assert.equal(m.name,'Bambu Poop Conveyor','Do not repeat the version in the name');
  assert.equal(m.version,display);assert.equal(m.new_install_prompt_erase,true);
  assert.equal(m.new_install_improv_wait_time,30);assert.equal(m.builds.length,1);
  const b=m.builds[0];assert.equal(b.chipFamily,'ESP32');assert.equal(b.improv,true);
  assert.equal(b.parts.length,1);assert.equal(b.parts[0].offset,0,'Merged USB image starts at zero');
  assert.equal(b.parts[0].path,'firmware/'+prefix+'-merged.bin');
}
function checkImagePair(application,usb){
  assert.equal(application[0],0xe9,'OTA must be an ESP32 application');
  assert.ok(application.length>=65536&&application.length<=1310720,'OTA must fit the existing partition');
  assert.equal(usb[0x1000],0xe9,'USB image must include the bootloader');
  assert.deepEqual(usb.subarray(0x10000),application,'USB/application split must be exact');
}
checkDescriptor(descriptor);checkManifest(manifest);checkImagePair(ota,merged);
for(const [suffix,bytes] of [['ota.bin',ota],['merged.bin',merged]]){
  const name=prefix+'-'+suffix;assert.equal(checksums.get(name),sha(bytes),name+' checksum mismatch');
  for(const path of ['installer/firmware/'+name,'dist/v'+artifact+'/'+name])
    assert.deepEqual(await local(path),bytes,path+' copy mismatch');
}
const source=await local('web/index.html'),header=(await local('Bambu-Poop-Conveyor/generated_ui.h')).toString();
const array=/WEB_UI_GZIP\[\]\s+PROGMEM\s*=\s*\{([\s\S]*?)\};/.exec(header);
assert.ok(array,'Embedded UI array is missing');
const compressed=Buffer.from([...array[1].matchAll(/0x([a-f0-9]{2})/gi)].map(x=>parseInt(x[1],16)));
assert.deepEqual(gunzipSync(compressed),source,'Generated UI must expand exactly to source');
assert.ok(ota.includes(compressed),'Approved OTA must contain the generated UI');
const sketch=(await local('Bambu-Poop-Conveyor/Bambu-Poop-Conveyor.ino')).toString();
assert.match(sketch,new RegExp('char version\\[\\d+\\]\\s*=\\s*"'+version.replaceAll('.','\\.')+'"'));
assert.ok(sketch.includes('const char displayVersion[] = "'+display+'";'),'Firmware must have the beta display label');
assert.ok(ota.includes(Buffer.from(display+'\0')),'OTA must contain the beta display label');
const stableDescriptor=await json('installer/latest.json'),stableManifest=await json('installer/manifest.json');
assert.equal(stableDescriptor.version,'1.5.3');assert.equal(stableDescriptor.channel,'stable');
assert.equal(stableManifest.version,'1.5.3','Stable USB pointer must remain unchanged');
const stableOta=await local('installer/'+stableDescriptor.bin);
const stableMerged=await local('installer/'+stableManifest.builds[0].parts[0].path);
assert.equal(sha(stableOta),stableDescriptor.sha256);checkImagePair(stableOta,stableMerged);
console.log('PASS local '+label+': labels, manifests, image copies/checksums, embedded UI, USB split; stable remains v1.5.3');

if(!localOnly){
  assert.equal(site.protocol,'https:','Live publication must use HTTPS');
  const cache=new Map();
  async function get(url){
    const key=new URL(url).href;
    if(!cache.has(key))cache.set(key,(async()=>{
      const fresh=new URL(key);fresh.searchParams.set('qa',Date.now());
      const response=await fetch(fresh,{cache:'no-store',headers:{Origin:'http://bambuconveyor-esp32.local'},signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,200,key);assert.equal(response.headers.get('access-control-allow-origin'),'*',key+' browser CORS');
      return Buffer.from(await response.arrayBuffer());
    })());
    return cache.get(key);
  }
  const remoteJson=async url=>JSON.parse((await get(url)).toString());
  const siteLatest=new URL('/flasher-beta/latest.json',site),live=await remoteJson(siteLatest);
  checkDescriptor(live);
  const siteOta=new URL(live.bin,siteLatest),siteManifest=new URL(live.manifest,siteLatest);
  assert.equal(siteOta.href,new URL('/flasher-beta/firmware/'+prefix+'-ota.bin',site).href);
  assert.equal(siteManifest.href,new URL('/flasher-beta/manifest.json',site).href);
  assert.deepEqual(await get(siteOta),ota);assert.deepEqual(await get(live.githubBin),ota);
  const liveManifest=await remoteJson(siteManifest);checkManifest(liveManifest);
  assert.deepEqual(liveManifest,manifest);
  const liveMerged=await get(new URL(liveManifest.builds[0].parts[0].path,siteManifest));
  assert.deepEqual(liveMerged,merged);checkImagePair(ota,liveMerged);
  console.log('PASS site beta: available label, manifest, OTA/merged bytes, mirror, CORS, USB split');

  const tagBase=new URL('v'+artifact+'/',repo);
  const taggedDescriptor=await remoteJson(new URL('installer/latest-v'+artifact+'.json',tagBase));
  checkDescriptor(taggedDescriptor);assert.deepEqual(taggedDescriptor,descriptor);
  const taggedManifestUrl=new URL('installer/manifest-v'+artifact+'.json',tagBase);
  const taggedManifest=await remoteJson(taggedManifestUrl);checkManifest(taggedManifest);
  assert.deepEqual(taggedManifest,manifest);
  assert.deepEqual(await get(new URL(taggedManifest.builds[0].parts[0].path,taggedManifestUrl)),merged);
  assert.deepEqual(await get(new URL('firmware/releases/v'+artifact+'/'+prefix+'-merged.bin',tagBase)),merged);
  assert.deepEqual(await get(new URL('firmware/releases/v'+artifact+'/SHA256SUMS.txt',tagBase)),checksumBytes);
  console.log('PASS immutable GitHub beta tag: descriptors, USB manifest/offsets, OTA/merged bytes and checksums');

  for(const base of [site,new URL('Bambu-Conveyor-ESP32/installer/',repo)]){
    const isSite=base===site;
    const latestUrl=isSite?new URL('/flasher/latest.json',base):new URL('latest.json',base);
    const d=await remoteJson(latestUrl);assert.equal(d.version,'1.5.3');assert.equal(d.channel,'stable');
    assert.equal(d.sha256,stableDescriptor.sha256);assert.equal(d.label,stableDescriptor.label);
    assert.deepEqual(await get(new URL(d.bin,latestUrl)),stableOta);
    assert.deepEqual(await get(d.githubBin),stableOta);
    const manifestUrl=isSite?new URL('/flasher/manifest.json',base):new URL('manifest.json',base);
    const m=await remoteJson(manifestUrl);assert.equal(m.version,'1.5.3');
    assert.equal(m.builds.length,1);assert.equal(m.builds[0].chipFamily,'ESP32');assert.equal(m.builds[0].improv,true);
    assert.equal(m.new_install_prompt_erase,true);assert.equal(m.new_install_improv_wait_time,30);
    assert.equal(m.builds[0].parts.length,1);assert.equal(m.builds[0].parts[0].offset,0);
    assert.deepEqual(await get(new URL(m.builds[0].parts[0].path,manifestUrl)),stableMerged);
    console.log('PASS '+(isSite?'site':'GitHub default branch')+' stable remains v1.5.3: metadata, OTA/mirror/USB bytes and CORS');
  }
}
