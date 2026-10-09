// Read-only release audit. Downloads do count as requests in site analytics.
// Run: node scripts/verify_release_mirrors.mjs [https://t0nyz.com]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = process.argv[2] || 'https://t0nyz.com';
for (const path of ['/flasher/latest.json', '/flasher-beta/latest.json', '/flasher/previous-stable.json', '/flasher/rollback.json']) {
  const descriptor = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
  assert.equal(descriptor.status, 200, `${path}: descriptor must be reachable`);
  const release = await descriptor.json();
  assert.match(release.sha256, /^[a-f0-9]{64}$/i, `${path}: missing checksum`);
  let primary;
  for (const source of ['bin', 'githubBin']) {
    assert.ok(release[source], `${path}: missing ${source}`);
    const url = new URL(release[source]);
    assert.equal(url.protocol, 'https:');
    const response = await fetch(url, { headers: { Origin: 'http://10.0.0.44' }, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `${source}: download failed`);
    assert.equal(response.headers.get('access-control-allow-origin'), '*', `${source}: local browser download must be allowed`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes[0], 0xe9, `${source}: not an ESP32 application image`);
    assert.ok(bytes.length >= 65536 && bytes.length <= 1310720, `${source}: invalid OTA size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), release.sha256, `${source}: checksum mismatch`);
    if (source === 'bin') primary = bytes;
    else assert.deepEqual(bytes, primary, `${path}: mirror must be byte-identical`);
    console.log(`PASS ${release.label || release.version} ${source}: HTTP 200, browser CORS, ${bytes.length} bytes, SHA-256 matches`);
  }
}
