# v1.5.2 release QA — October 9, 2026

## Scope and release sequence

Test Beta 2 independently, then promote the same application/UI changes with the
stable display label. Preserve all previous firmware files, rollback v1.4.2,
Wi-Fi provisioning flags, USB offsets, `/flasher` slash variants, and legacy
`/flasher/install.html`. No device identity or background heartbeat is introduced.

## Beta 2 verified

- GitHub prerelease `v1.5.2-beta.2` contains distinct OTA and merged USB images
  and checksums. GitHub Actions run `37998364940` passed the build, generated-UI
  check, 22 updater/attribution tests, 15 startup cases, and 14 MQTT/LED cases.
- Website commit `70eab84` reached production READY. Stable/rollback files,
  installer settings, routes, authentication, and public manifests were unchanged
  in this beta deployment. Website analytics tests passed (22 cases).
- Live stable, beta, and rollback OTA downloads from both sources matched their
  checksums and bytes and allowed local-browser CORS. USB manifests referenced
  the right full images; slash variants and legacy installer passed.
- The test ESP32 at `10.0.0.44` accepted the checksum-verified GitHub Beta 2 OTA
  through `/update`. Boot ID changed from `2163317787` to `1910643462`, and the
  returned health endpoint reported **1.5.2 Beta 2**. Saved configuration and
  trigger fingerprints were unchanged; Wi-Fi reconnected and the motor stayed
  idle. The unconfigured-printer root redirects to Settings.
- The device served the exact committed UI on `/config`, `/control`, `/logs`,
  and `/update`. Logs, Overview, Triggers, Settings, and Update loaded in the
  actual browser with no console errors. MQTT was intentionally unconfigured.
- Opening its real Update screen created website database observations with
  `source=device_webui`, `attribution=reported`, and
  `installed_version=1.5.2 Beta 2`. The authenticated dashboard displayed the
  explicit reported-source evidence and installed-version category.
- The automation backend stalled at the native one-click confirmation before
  uploading. It exposed no accessible dialog; the agent-owned stalled tab was
  closed. This was not counted as a successful automated one-click install.

## Stable acceptance

- Final stable candidate CI run `37999001573` passed. The web UI/application
  changes are identical to Beta 2; only the firmware display label changed.
- The test ESP32 accepted the checksum-verified final OTA and rebooted from
  boot ID `1910643462` to `3807444624`, reporting **1.5.2**. Saved configuration
  and trigger fingerprints remained unchanged, Wi-Fi reconnected, the motor
  stayed idle, and missing printer details still routed the root to Settings.
- OTA SHA-256: `cffe6cbd907d1a866cbc143e05737cf47c01b6d0fbfed35a006a6196ae2edf28`.
  Merged USB SHA-256: `6331208d893e32e42f2dda9da0299f125290e00ba91a1b46dee01d805d02573b`.
  The merged image contains the exact OTA at offset `0x10000`; its bootloader
  and partition prefix are byte-identical to the official v1.5.1 image.
- Default-branch CI run `37999522637` passed at commit `dd7b050`.
  Official GitHub release `Release-v1.5.2` is public, non-prerelease, and latest,
  with separate merged/OTA assets and matching SHA-256 digests.
- Website commit `6844ecc` deployed to production READY on Vercel
  (`dpl_6MFEwGMQn2M97vPGPXyH1EJ3w6Xu`, Next.js, 88.7-second build).
  Production HTTP tests passed `/flasher`, `/flasher/`, `/flasher/index.html`,
  `/flasher/install.html`, all active/rollback/archived-beta manifests and their
  full USB parts, checksums, CORS, and unauthenticated admin rejection.
- Live stable, archived Beta 2, and v1.4.2 OTA downloads were byte-identical
  between Developer Site and GitHub, with correct checksums and browser CORS.
  Historical files, rollback metadata, offsets and provisioning flags stayed
  unchanged; the active USB manifest alone moved to the approved v1.5.2 image.
- The real test-device Update screen shows public v1.5.2 installed,
  **No newer beta available** with no beta install button, and available v1.4.2
  rollback. GitHub selection leaves public and rollback buttons enabled.
  Triggers and logs loaded; no browser console errors were observed.
- Actual Update-screen requests for installed **1.5.2** reached the production
  database as `device_webui` / `reported`, and the authenticated dashboard showed
  that stable installed-version category. Production article version/file links
  and GitHub's latest-release endpoint matched v1.5.2.
- Production error-level logs contained only the existing PostgreSQL SSL-mode
  deprecation warning emitted on stderr; no application exception was observed
  in the checked release window. Database/auth configuration was not changed.

## Coverage limits

Real settings-preserving OTA, live Update-screen reporting, and release-file
checks are hardware/production evidence. Host tests exercise setup routing,
motion-mode branches, MQTT recovery, and motor state transitions without physical
actuation. This release does not claim a new erased-device USB install, physical
hotspot provisioning test, real-printer trigger test, successful automated native
confirmation, or prolonged hardware soak. The Wi-Fi provisioning/bootloader,
motor, and MQTT paths are unchanged; no production printer was disrupted.
