# v1.5.2 Beta 2 — reported Update-screen attribution

Local beta candidate. Public v1.5.1 and published Beta 1 remain unchanged.

The Update screen adds `analytics_source=conveyor_update` and the installed
`displayVersion` (for example `1.5.2 Beta 2`) to existing Developer Site
version checks and firmware-download requests. These are anonymous, reported
values, not verified device identity. No extra request, device identifier,
heartbeat, local address, Wi-Fi credential, or printer detail is sent.

Labels are restricted to HTTPS `t0nyz.com` release-descriptor and firmware-file
paths. GitHub mirrors and local APIs remain unchanged. No custom request headers
or additional CORS preflight are introduced. Browser Do Not Track or Global
Privacy Control suppresses the labels without blocking updates. Missing status
omits the installed version until status is available. Annotation failures use
the original URL. The server records analytics asynchronously; recording failures
cannot prevent the download.

Only request annotation, the beta display label, its generated UI header, and
regression-test coverage change. Startup setup routing from Beta 1 is retained;
motor timing, MQTT, indicators, upload validation, and reboot logic are unchanged.
USB manifests and release descriptors are not changed for this local candidate.

## Validation

```sh
node --test scripts/test_release_channels.mjs scripts/test_update_attribution.mjs
python3 scripts/test_startup_routing.py
python3 scripts/test_mqtt_leds.py
python3 scripts/generate_ui.py
python3 scripts/build_release.py --version 1.5.2 --artifact-version 1.5.2-beta.2
```

Before publication, test the candidate on the test ESP32 and verify that real
version-check requests reach the dashboard as **reported**, with the installed
Beta 2 version. Do not present browser checks as physical firmware-install tests.
When publishing Beta 2, update only the beta descriptor/USB manifest and add its
new binary paths to the website analytics allowlist. Keep stable and rollback
assets unchanged and recheck both installer slash variants and GitHub mirrors.

### Local validation completed — October 9, 2026

- 22 firmware UI/release-channel tests passed, including privacy preferences,
  attribution failure, untouched mirror URLs, and exact downloaded-image bytes.
- The firmware URL helper and current website classifier agreed for all three
  metadata channels and their actual OTA paths, with no referral headers.
- 15 startup-routing cases and 14 MQTT/indicator scenarios passed. The default
  macOS linker rejected its SDK; rerunning with the installed Xcode compiler,
  matching SDK, and linker passed without changing test or firmware logic.
- The website's 22 analytics tests passed; no website files were changed.
- OTA and full USB images built. The OTA image fits the existing partition
  (90.3% used), includes the exact generated UI and Beta 2 label, and is identical
  to the application image at `0x10000` in the merged binary. SHA-256 checks passed.
- No candidate was published or installed; physical end-to-end acceptance remains
  pending. No production manifests, descriptors, or binaries were modified.
