// Exercise the firmware UI's real functions. No device is fetched or flashed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const names=['updateRequestUrl','fetchRelease','installRelease','validateFirmware'];
const functions=names.map(name=>{
  const line=html.split('\n').find(l=>l.startsWith(`function ${name}(`)||l.startsWith(`async function ${name}(`));
  assert.ok(line,`Missing production function: ${name}`);return line;
}).join('\n');
const urls=['https://t0nyz.com/flasher/latest.json','https://t0nyz.com/flasher-beta/latest.json','https://t0nyz.com/flasher/rollback.json'];
const installed='1.5.2 Beta 2';
const image=new Uint8Array(65536);image[0]=0xE9;

function harness({status={version:'1.5.2',displayVersion:installed},privacy={},accept=true}={}) {
  const requests=[],uploads=[],messages=[],elements=new Map();
  const state={status,releases:{}};
  const $=key=>{if(!elements.has(key))elements.set(key,{value:'site',textContent:''});return elements.get(key)};
  const ctx=vm.createContext({state,$,URL,File,Uint8Array,navigator:privacy,
    confirm:()=>accept,toast:(...a)=>messages.push(a),betaUnavailableReason:()=>'',
    resetUpdate:()=>{},setUpdateBusy:()=>{},step:()=>{},failUpdate:m=>messages.push(m),
    uploadFirmware:(file,rollback)=>uploads.push({file,rollback}),
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({version:'1.5.1',bin:'https://t0nyz.com/flasher/firmware/test.bin'}),headers:{get:()=>null},arrayBuffer:async()=>image.buffer}}
  });
  vm.runInContext(functions,ctx);return {ctx,state,$,requests,uploads,messages};
}

test('all three channel checks report the Update screen and installed beta, without extra CORS headers',async()=>{
  const h=harness();
  for(const url of urls) {
    await h.ctx.fetchRelease(url);
    const r=h.requests.at(-1),parsed=new URL(r.url);
    assert.equal(parsed.origin+parsed.pathname,url);
    assert.equal(parsed.searchParams.get('analytics_source'),'conveyor_update');
    assert.equal(parsed.searchParams.get('installed_version'),installed);
    assert.ok(parsed.searchParams.has('ts'));
    assert.deepEqual({...r.options},{mode:'cors',cache:'no-store'});
    assert.deepEqual([...parsed.searchParams.keys()].sort(),['analytics_source','installed_version','ts']);
  }
});

test('a stable installed version is reported, not the selected release version',()=>{
  const h=harness({status:{version:'1.5.1'}});
  assert.equal(new URL(h.ctx.updateRequestUrl(urls[1])).searchParams.get('installed_version'),'1.5.1');
});

test('published stable and rollback root binaries and nested beta binaries are all labeled',()=>{
  const h=harness();
  for(const path of ['/flasher/Bambu-Poop-Conveyor-v1.5.1-ota.bin','/flasher/Bambu-Poop-Conveyor.v1.4.2-update.ino.bin','/flasher-beta/firmware/Bambu-Poop-Conveyor-v1.5.2-beta.1-ota.bin']){
    const u=new URL(h.ctx.updateRequestUrl('https://t0nyz.com'+path));
    assert.equal(u.pathname,path);assert.equal(u.searchParams.get('installed_version'),installed);
  }
});

test('missing or invalid status omits the version instead of inventing one or leaking secrets',()=>{
  for(const status of [null,{displayVersion:'password=secret'},{displayVersion:'v1.5.2'},{displayVersion:'1.5.2 Beta 999999',serial:'PRIVATE',ip:'10.0.0.44'}]) {
    const h=harness({status}),u=new URL(h.ctx.updateRequestUrl(urls[0]));
    assert.equal(u.searchParams.get('analytics_source'),'conveyor_update');
    assert.equal(u.searchParams.has('installed_version'),false);
    assert.deepEqual([...u.searchParams.keys()],['analytics_source']);
  }
});

test('GitHub mirrors, unrelated endpoints, lookalike hosts and local APIs remain byte-for-byte unchanged',()=>{
  const h=harness();
  for(const url of ['https://raw.githubusercontent.com/t0nyz0/project/main/ota.bin?signature=abc','https://github.com/t0nyz0/project/releases/download/v1/ota.bin','https://t0nyz.com.evil.example/flasher/latest.json','http://t0nyz.com/flasher/latest.json','https://t0nyz.com/flasher/manifest.json','https://t0nyz.com/api/admin/analytics','/api/status','not a URL'])assert.equal(h.ctx.updateRequestUrl(url),url);
});

test('existing query fields survive and stale reported values are replaced',()=>{
  const u=new URL(harness().ctx.updateRequestUrl(urls[0]+'?ts=123&analytics_source=old&installed_version=old'));
  assert.equal(u.searchParams.get('ts'),'123');assert.equal(u.searchParams.get('installed_version'),installed);
  assert.equal(u.searchParams.getAll('analytics_source').length,1);
});

test('browser privacy preferences suppress reported labels, not update requests',async()=>{
  for(const privacy of [{doNotTrack:'1'},{globalPrivacyControl:true}]){
    const h=harness({privacy});await h.ctx.fetchRelease(urls[0]);
    const u=new URL(h.requests[0].url);assert.equal(u.searchParams.has('analytics_source'),false);assert.ok(u.searchParams.has('ts'));
  }
});

test('annotation failure is fail-open; firmware fetch and errors retain their normal behavior',async()=>{
  const h=harness();h.ctx.URL=class{constructor(){throw Error('No URL parser')}};
  await h.ctx.fetchRelease(urls[0]);assert.match(h.requests[0].url,/\?ts=\d+$/);
  h.ctx.fetch=async()=>({ok:false,status:503});
  await assert.rejects(h.ctx.fetchRelease(urls[0]),/HTTP 503/);
});

test('site downloads keep the exact image, filename and rollback handoff; mirror URLs stay untouched',async()=>{
  for(const kind of ['stable','beta','rollback'])for(const source of ['site','github']){
    const h=harness(),url='https://t0nyz.com/flasher/firmware/selected-ota.bin',mirror='https://raw.githubusercontent.com/t0nyz0/project/main/selected-ota.bin';
    h.state.releases[kind]={version:'1.4.2',label:'v1.4.2',bin:url,githubBin:mirror};h.$('#downloadSource').value=source;
    await h.ctx.installRelease(kind);
    assert.equal(h.uploads.length,1);assert.equal(h.uploads[0].file.name,'selected-ota.bin');
    assert.equal(h.uploads[0].rollback,kind==='rollback');
    assert.deepEqual(new Uint8Array(await h.uploads[0].file.arrayBuffer()),image);
    if(source==='github')assert.equal(h.requests[0].url,mirror);
    else assert.equal(new URL(h.requests[0].url).searchParams.get('installed_version'),installed);
  }
});

test('canceling an install sends no file request and causes no upload',async()=>{
  const h=harness({accept:false});h.state.releases.stable={version:'1.5.1',bin:'https://t0nyz.com/flasher/firmware/test.bin'};
  await h.ctx.installRelease('stable');assert.equal(h.requests.length,0);assert.equal(h.uploads.length,0);
});
