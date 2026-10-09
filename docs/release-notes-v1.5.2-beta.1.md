# v1.5.2 Beta 1

Beta test release; public stable v1.5.1 remains unchanged.

- Open Settings automatically at the device root URL when MQTT printer IP,
  access code, or serial number is missing (including old placeholder values).
  A complete configuration still opens Overview, even when its printer is offline.
- Hotspot mode opens Settings. Motion-sensor mode does not require printer details.
  Explicit `/config`, `/update`, `/logs`, and `/control` links remain available.
- Offer a beta only when it is newer than the public release and is not an older
  version line than the installed firmware. A superseded beta displays
  “No newer beta available” without an install button.
- If the public feed cannot be verified, do not offer an unverified beta.
  Stable reinstall and explicit v1.4.2 rollback remain separate choices.
- Hide stale install targets while refreshing release information.

Motor, trigger, MQTT reconnect, LED, Wi-Fi provisioning, and stored-setting
behavior are unchanged. Only the initial root-page route changes during setup.

## Verification

```console
node --test scripts/test_release_channels.mjs
python3 scripts/test_startup_routing.py
python3 scripts/test_mqtt_leds.py
python3 scripts/generate_ui.py
python3 scripts/build_release.py --version 1.5.2 --artifact-version 1.5.2-beta.1
node scripts/verify_release_mirrors.mjs
```

The build produces distinct `v1.5.2-beta.1` merged USB and OTA images with
checksums. Do not replace stable v1.5.1 or rollback v1.4.2 files/metadata.
Publish GitHub mirror assets before switching the beta descriptor, then check
both sources and the USB manifest's referenced merged image.

Hardware acceptance remains required: fresh Wi-Fi provisioning → Settings,
complete printer setup → Overview, configured-device OTA retains settings,
and motion-sensor startup remains on Overview. Host/browser tests alone do not
prove USB flashing, hotspot behavior, or motor operation on physical hardware.

### Local results, 2026-10-09

- 12 updater tests, 15 startup-routing scenarios, and 14 existing MQTT/LED
  scenarios passed. The local macOS host compiler required the installed 26.5 SDK.
- ESP32 build passed: OTA image 1,183,552 bytes, below the 1,310,720-byte partition.
- Generated compressed UI exactly matches its HTML source and is present in the
  OTA image. The merged image contains that same OTA application at `0x10000`.
- Browser preview confirms the superseded-beta button is visually hidden and
  GitHub selection leaves stable/rollback actions enabled, with no console errors.
- All three currently published GitHub OTA mirrors returned HTTP 200, allowed
  local-browser downloads via CORS, and matched their website files byte for byte
  and by published SHA-256. This verifies existing mirrors, not a published Beta 1.
- During local preparation, no website files, manifests, stable/rollback binaries,
  or devices were changed. Publication and hardware results follow below.

### Beta publication and device acceptance, 2026-10-09

- GitHub prerelease `v1.5.2-beta.1` published with full USB image, OTA image,
  and checksums. The latest stable GitHub release remains `Release-v1.5.1`.
- GitHub Actions run `37993353874` passed the firmware build, embedded-UI
  generation check, and all 41 automated updater/startup/LED scenarios.
- Website commit `c498bf2` deployed READY to t0nyz.com. Only the beta installer,
  descriptor, manifest, checksum list, new beta binaries, and release tests changed.
  Public v1.5.1 and v1.4.2 rollback assets/routes remain byte-identical.
- All live slash variants, legacy `install.html`, manifest references, firmware
  downloads/checksums, and unauthorized admin responses passed. All stable, beta,
  and rollback OTA mirrors passed HTTP, CORS, checksum, and byte-equality checks.
- The in-app browser stalled at the one-click JavaScript confirmation before
  any upload. The hardware test instead downloaded the GitHub OTA, verified its
  checksum, and uploaded it through the device's existing `/update` API.
- The test ESP32 accepted the upload (`HTTP 200`, `ok: true`), rebooted with a new
  boot ID, reported `1.5.2 Beta 1`, and reconnected to Wi-Fi. All saved configuration
  fields matched their pre-install fingerprint; no credential values were recorded.
- On that printer-unconfigured device, `/` returned `302 Location: /config`.
  The actual browser opened Settings and showed Beta 1. Served HTML matched the
  committed source exactly. Overview, Triggers, Logs, and Update loaded, including
  legacy `/status`. GitHub selection enabled the three available release actions.
- No browser console errors/warnings were observed in the new device QA tab.

This verifies a real settings-preserving OTA installation and the missing-printer
redirect. It does **not** establish a successful automated browser-confirmation
flow, a fresh erased-device USB install, physical hotspot provisioning, real-printer
MQTT triggering, or a prolonged hardware soak. These remain separate acceptance
checks before stable promotion. No printer credentials or operation-mode changes
were made merely to simulate a configured printer.
