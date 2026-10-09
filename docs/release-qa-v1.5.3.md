# v1.5.3 release QA — October 9, 2026

## Release gate: physical acceptance pending

v1.5.3 is prepared on the release branch, not yet promoted to the default branch or official stable release. v1.5.2 remains public. The temporary v1.5.3 Beta 1 prerelease is acceptance-only.

- Beta build and GitHub Actions `38001022018` passed: 25 updater checks, 15 startup-routing cases, 14 MQTT/LED cases, generated-UI consistency, and ESP32 compilation.
- Final stable build passed locally. Its UI is identical to Beta 1; only the firmware display label changes. OTA is 1,183,920 bytes, within the 1,310,720-byte application slot.
- Final stable candidate GitHub Actions `38001440133` also passed all 54 firmware cases, embedded-UI consistency, compilation and artifact upload at `4ac082f`. This is build/host evidence, not physical acceptance.
- Website candidate branch `release/v1.5.3`, commit `65a004a`, passed 23 website/release guards, the full Next.js build, and local HTTP manifest/file/admin-access checks. Its public-channel changes are not merged to production until the device round trip passes. The article's actual Update screenshot remains pending replacement after hardware acceptance.
- Both beta and stable merged images contain the exact OTA at `0x10000`. Both bootloader/partition prefixes match immutable v1.5.1.
- Original v1.5.1 OTA SHA-256: `4ab6495db6c3dc43fc0859330d9bfebdffa3494a09097c6c692c3373eccc4fe0`.
- Stable candidate OTA SHA-256: `8342c8387b469c76f872346ace7d5d1a948b80e8f96f0398598defd6a38da852`.
- Stable candidate merged SHA-256: `cc68cc7baf2a559c3fe0e77074fb09a68b585a1aa6cb54177f99b922d1cb1b84`.
- Additive website recovery commit `12027ce` reached production READY (`dpl_Gfy3Bj2myCjNcJLjquZ3YA2EBuP3`, Next.js, 51.0-second build). Live HTTP checks passed installer slash variants, legacy install.html, manifests, USB/OTA checksums, and unauthorized admin rejection. Stable v1.5.2 and historical files remain unchanged in that deployment.
- Live v1.5.1 previous-stable and v1.4.2 legacy OTA downloads match their immutable GitHub mirrors, sizes, and checksums; local-browser CORS is allowed. Existing rollback.json remains v1.4.2 for older firmware's hard-coded recovery warnings. New firmware uses previous-stable.json.
- Current public v1.5.2 GitHub main/tag installer manifests, resolved USB images, OTA feed, CORS, checksums, and official release assets all passed the read-only audit. Its duplicate-version display-name fix is verified on the default branch.

## Required before official promotion

1. Restore Wi-Fi access to the authorized test ESP32, previously at `10.0.0.44`. On retry, Chrome released USB; the board answered Improv with state 2 (not Wi-Fi-connected). One normal USB restart, with no erase or settings write, started its setup hotspot and web server instead of joining the home network. User-assisted Wi-Fi setup is required before OTA acceptance.
2. Install published Beta 1 OTA, verify new boot, all routes, Wi-Fi, idle motor, configuration and trigger fingerprints, and accurate v1.5.1 rollback messages.
3. Roll back to immutable v1.5.1 and return to Beta 1; verify fingerprints and Wi-Fi after both transitions.
4. Install final stable candidate, rerun acceptance and stable CI, then publish the immutable official release and promote both repositories.
5. Capture the actual v1.5.3 Update screen, update the article, and verify live stable/beta/previous-stable/legacy metadata and both download sources after production is READY.

## Coverage limits

No v1.5.3 physical test, new erased-device USB flash, physical hotspot setup, native browser confirmation, printer-trigger actuation, or extended soak is claimed yet. Motor and MQTT behavior are unchanged and host-tested. The production printer/conveyor is not a test target. Public promotion is gated on physical acceptance, not merely a successful build or push.
