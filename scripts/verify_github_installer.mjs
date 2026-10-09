// Read-only audit: manifests resolve relative to their own URL, not an HTML base.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const repo='https://raw.githubusercontent.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function get(url){
  const r=await fetch(url,{headers:{Origin:'http://10.0.0.44'},signal:AbortSignal.timeout(30000)});
  assert.equal(r.status,200,url);assert.equal(r.headers.get('access-control-allow-origin'),'*',url);
  return r;
}
for(const ref of ['Bambu-Conveyor-ESP32','Release-v1.5.2']){
  for(const file of ['manifest.json','manifest-v1.4.2.json']){
    const url=new URL(`${ref}/installer/${file}`,repo),m=await(await get(url)).json();
    const local=JSON.parse(await readFile(new URL('../installer/'+file,import.meta.url),'utf8'));
    // Old immutable tags may retain an old display name; all install fields must match.
    assert.deepEqual({...m,name:local.name},local);
    if(ref==='Bambu-Conveyor-ESP32')assert.ok(!m.name.includes(m.version),'Version is repeated in the display name');
    assert.equal(m.builds.length,1);assert.equal(m.builds[0].chipFamily,'ESP32');
    for(const part of m.builds[0].parts){
      assert.equal(part.offset,0,'USB merged image must begin at flash offset zero');
      const bytes=Buffer.from(await(await get(new URL(part.path,url))).arrayBuffer());
      assert.deepEqual(bytes,await readFile(new URL('../installer/'+part.path,import.meta.url)));
      assert.equal(bytes[0x1000],0xe9,'Merged image must include the ESP32 bootloader');
    }
    console.log(`PASS GitHub ${ref} ${file}: resolved full USB image, offset, CORS, bytes`);
  }
  const url=new URL(`${ref}/installer/latest.json`,repo),d=await(await get(url)).json();
  assert.equal(d.version,'1.5.2');assert.equal(d.channel,'stable');
  const ota=Buffer.from(await(await get(new URL(d.bin,url))).arrayBuffer());
  assert.equal(ota[0],0xe9);assert.ok(ota.length<=1310720);assert.equal(hash(ota),d.sha256);
  const merged=await readFile(new URL('../installer/firmware/Bambu-Poop-Conveyor-v1.5.2-merged.bin',import.meta.url));
  assert.deepEqual(merged.subarray(0x10000),ota,'Full USB image must contain exactly the offered OTA');
  console.log(`PASS GitHub ${ref} latest.json: correct OTA, checksum, USB/application split`);
}
for(const suffix of ['merged.bin','ota.bin','SHA256SUMS.txt']){
  const name=suffix==='SHA256SUMS.txt'?suffix:'Bambu-Poop-Conveyor-v1.5.2-'+suffix;
  const url='https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/download/Release-v1.5.2/'+name;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,url);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../firmware/releases/v1.5.2/'+name,import.meta.url)));
  console.log('PASS official GitHub release asset: '+name);
}
