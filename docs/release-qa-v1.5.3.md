# v1.5.3 release QA — October 9, 2026

## Physical acceptance passed

The authorized test ESP32 completed the actual OTA round trip from v1.5.3 Beta 1
to immutable v1.5.1, then to the corrected final v1.5.3 application. Both transitions
passed new-boot/version checks, saved configuration and trigger fingerprints,
Wi-Fi reconnection, idle motor state, all control-center routes, and log/status APIs.
v1.5.1 opens Overview; the printer-unconfigured v1.5.3 board redirects to `/config`.
The final device-served UI matches the corrected source byte-for-byte, including
the plain `Settings` headline. Published Beta 1 and historical releases are unchanged.

The device web server took time to return after reboot; the acceptance checks
waited for a successful new boot rather than treating upload acceptance as success.
No motor actuation or production-printer interruption was performed.

## Final package

- Local tests: 26 updater/UI checks, 15 startup-routing cases, and 14 MQTT/LED cases passed (55 total).
- GitHub Actions `38010421065` passed those checks, embedded-UI consistency, compilation, and artifact upload at `7448a52`.
- Corrected OTA: 1,183,904 bytes, within the 1,310,720-byte application slot.
- Corrected merged USB image: 1,249,440 bytes; its application at `0x10000` is exactly the offered OTA.
- OTA SHA-256: `6b472c6b6d33804b7861e926af56d3641dd6a7ff216df484a1118e2180fcd935`.
- Merged SHA-256: `edf1cab24936ee7144c266491c04a7a6664488e238e1ae1f2b54e745ae37f8ca`.
- Immutable v1.5.1 OTA SHA-256: `4ab6495db6c3dc43fc0859330d9bfebdffa3494a09097c6c692c3373eccc4fe0`.
- The obsolete, unpromoted candidate checksums are not used by the final manifests or packages.
- Website candidate: 40 checks and the Next.js production build passed. Existing homepage work is preserved.

## Recovery compatibility

New firmware uses `previous-stable.json` for original v1.5.1 recovery and describes
the selected version accurately. Legacy `rollback.json` remains v1.4.2 for older
firmware's original warning text. Historical USB/OTA files and provisioning paths
remain unchanged. No active beta is offered after stable promotion.

## Publication verification

Publication and live post-deployment checks are the remaining release steps:
official GitHub full/OTA/checksum assets, default-branch and tag manifests,
installer slash variants and legacy `install.html`, descriptor versions,
resolved binaries, sizes, checksums, browser CORS, and both download sources.
The article's Update screenshot must show the final published channel state.

## Coverage limits

This release has real settings-preserving OTA and rollback acceptance, not a new
erased-device USB flash, physical hotspot-client setup, printer-trigger actuation,
or extended soak. Motor, MQTT, and provisioning logic are unchanged by v1.5.3;
host tests are separate from physical evidence. The production conveyor is not a
test target.
