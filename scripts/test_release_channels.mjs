// Exercise the updater's actual functions without fetching or flashing hardware.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const names = ['versionParts', 'compareVersions', 'betaUnavailableReason', 'paintRelease', 'syncDownloadSource', 'checkUpdates', 'installRelease'];
const functions = names.map(name => {
  const line = html.split('\n').find(line => line.startsWith(`function ${name}(`) || line.startsWith(`async function ${name}(`));
  assert.ok(line, `Missing production function: ${name}`);
  return line;
}).join('\n');
const release = (version, label = `v${version}`, mirror = true) => ({ version, label, bin: 'https://example.invalid/ota.bin', ...(mirror ? { githubBin: 'https://example.invalid/mirror.bin' } : {}) });
const fulfilled = value => ({ status: 'fulfilled', value });
const rejected = { status: 'rejected', reason: new Error('Offline') };

test('release button styles respect the hidden attribute', () => {
  assert.match(html, /\.release-install\[hidden\]\s*\{\s*display\s*:\s*none\s*\}/);
});

function harness(current = '1.5.1') {
  const elements = new Map();
  const state = { releases: {}, status: current ? { version: current, displayVersion: current } : null };
  const messages = [], confirmations = [];
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, { hidden: true, disabled: false, value: 'site', textContent: '', title: '' });
    return elements.get(selector);
  };
  const ctx = vm.createContext({ state, $, RELEASE_URLS: { stable: 'stable', beta: 'beta', rollback: 'rollback' },
    toast: (...args) => messages.push(args), confirm: text => { confirmations.push(text); return false; },
    fetchRelease: async () => { throw new Error('No requests expected'); } });
  vm.runInContext(functions, ctx);
  return { ctx, state, $, messages, confirmations };
}

function paint(h, stable = release('1.5.1'), beta = release('1.5.0', 'v1.5.0 Beta 17')) {
  h.ctx.paintRelease('stable', stable ? fulfilled(stable) : rejected);
  h.ctx.paintRelease('beta', beta ? fulfilled(beta) : rejected);
  h.ctx.paintRelease('rollback', fulfilled(release('1.4.2')));
  h.ctx.syncDownloadSource();
}

test('retired Beta 17 is not offered beside public 1.5.1; stable and rollback remain installable', async () => {
  const h = harness();
  paint(h);
  assert.equal(h.$('#betaVersion').textContent, 'No newer beta available');
  assert.match(h.$('#betaStatus').textContent, /Beta 17 was superseded by public v1\.5\.1/);
  assert.equal(h.$('#betaInstall').hidden, true);
  assert.equal(h.state.releases.beta, undefined);
  for (const kind of ['stable', 'rollback']) {
    assert.equal(h.$(`#${kind}Install`).hidden, false);
    assert.equal(h.$(`#${kind}Install`).disabled, false);
    await h.ctx.installRelease(kind);
  }
  assert.match(h.confirmations[0], /Install v1\.5\.1/);
  assert.match(h.confirmations[1], /Roll back to v1\.4\.2/);
});

test('a stable release supersedes beta builds of the same version line too', () => {
  const h = harness();
  paint(h, release('1.5.1'), release('1.5.1-beta.2', 'v1.5.1 Beta 2'));
  assert.equal(h.$('#betaInstall').hidden, true);
});

test('beta is retired for older and unconfigured devices, not just newer installed firmware', () => {
  for (const current of ['1.4.2', null]) {
    const h = harness(current);
    paint(h);
    assert.equal(h.$('#betaInstall').hidden, true);
    assert.equal(h.$('#stableInstall').hidden, false);
  }
});

test('a genuinely newer beta is offered from both supported download sources', async () => {
  const h = harness();
  paint(h, release('1.5.1'), release('1.5.2', 'v1.5.2 Beta 1'));
  for (const source of ['site', 'github']) {
    h.$('#downloadSource').value = source;
    h.ctx.syncDownloadSource();
    assert.equal(h.$('#betaVersion').textContent, 'v1.5.2 Beta 1');
    assert.equal(h.$('#betaInstall').hidden, false);
    assert.equal(h.$('#betaInstall').disabled, false);
    await h.ctx.installRelease('beta');
  }
  assert.match(h.confirmations[0], /Developer Site/);
  assert.match(h.confirmations[1], /GitHub mirror/);
});

test('a missing beta mirror disables only the GitHub beta option', () => {
  const h = harness();
  paint(h, release('1.5.1'), release('1.5.2', 'v1.5.2 Beta 1', false));
  h.$('#downloadSource').value = 'github';
  h.ctx.syncDownloadSource();
  assert.equal(h.$('#betaInstall').disabled, true);
  assert.equal(h.$('#stableInstall').disabled, false);
  assert.equal(h.$('#rollbackInstall').disabled, false);
  h.$('#downloadSource').value = 'site';
  h.ctx.syncDownloadSource();
  assert.equal(h.$('#betaInstall').disabled, false);
});

test('an unavailable public feed does not mislabel beta as retired or allow an unverified beta', () => {
  const h = harness();
  paint(h, null, release('1.5.2'));
  assert.equal(h.$('#betaVersion').textContent, 'Beta availability unverified');
  assert.match(h.$('#betaStatus').textContent, /Check again/);
  assert.equal(h.$('#betaInstall').hidden, true);
  assert.equal(h.$('#rollbackInstall').hidden, false);
});

test('a failed beta request remains distinct from a superseded beta', () => {
  const h = harness();
  paint(h, release('1.5.1'), null);
  assert.equal(h.$('#betaVersion').textContent, 'Unavailable');
  assert.match(h.$('#betaStatus').textContent, /Could not reach/);
});

test('beta does not silently become a downgrade path for a newer installed device', () => {
  const h = harness('1.6.0');
  paint(h, release('1.5.1'), release('1.5.2'));
  assert.equal(h.$('#betaInstall').hidden, true);
  assert.match(h.$('#betaStatus').textContent, /installed firmware is newer/);
});

test('the install handler independently rejects a stale beta entry before confirmation or download', async () => {
  const h = harness();
  h.state.releases = { stable: release('1.5.1'), beta: release('1.5.0') };
  await h.ctx.installRelease('beta');
  assert.equal(h.confirmations.length, 0);
  assert.match(h.messages[0][0], /superseded/);
});

test('refresh immediately removes stale install targets, then repaints the newest results', async () => {
  const h = harness();
  paint(h, release('1.5.1'), release('1.5.2'));
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  h.ctx.fetchRelease = async kind => {
    await pending;
    return kind === 'stable' ? release('1.5.2') : kind === 'beta' ? release('1.5.2', 'v1.5.2 Beta 1') : release('1.4.2');
  };
  const refresh = h.ctx.checkUpdates(true);
  assert.equal(Object.keys(h.state.releases).length, 0);
  for (const kind of ['stable', 'beta', 'rollback']) assert.equal(h.$(`#${kind}Install`).hidden, true);
  await h.ctx.installRelease('beta');
  assert.equal(h.confirmations.length, 0);
  resolve();
  await refresh;
  assert.equal(h.$('#betaInstall').hidden, true);
  assert.equal(h.$('#stableInstall').hidden, false);
  assert.equal(h.$('#checkUpdates').disabled, false);
});

test('a subsequent newer beta reappears after the old beta is superseded', () => {
  const h = harness();
  paint(h);
  paint(h, release('1.5.1'), release('1.5.2', 'v1.5.2 Beta 1'));
  assert.equal(h.$('#betaInstall').hidden, false);
  assert.equal(h.state.releases.beta.version, '1.5.2');
});
