# v1.5.4 candidate QA

Tested October 9, 2026. This is an unpublished candidate; owner approval is required before publishing a tag, GitHub release, website update, or live feed change.

## Scope

- Bounded local printer discovery and first-time Settings search.
- Separate Network and Printer sections; explicit Show/Hide for saved or newly entered credentials on the trusted local device.
- Section readiness, separate Wi-Fi and printer saves, required-printer validation for global Save, and an incomplete-setup reminder in navigation and Overview.
- Incomplete printer setup skips MQTT connection attempts so setup remains responsive.
- Existing configuration format, credentials, motor timing, triggers, configured MQTT operation, LEDs, provisioning, and previous-stable recovery remain unchanged.

## Automated validation

- ESP32 PlatformIO build passed. Application image: 1,199,552 bytes, below the 1,310,720-byte OTA partition limit. Static RAM: 59,620 bytes.
- Discovery parser/service: 57 checks passed, including malformed datagrams, source/subnet checks, duplicate handling, eight-result limit, per-loop packet limit, timeout/wraparound, and listener shutdown.
- UI and release/update regression tests: 59 passed, including selection without saving, safe text rendering, readiness states, saved-code and motion-mode exceptions, an independently guarded global Save handler, partial section payloads, real-connection verification after reboot, error/timeout handling, and saved-value reveal without resubmission. Typed-value Show/Hide needs no request; saved-value Show explicitly requests only that field.
- Startup routing: 15 checks passed.
- MQTT/indicator/motor host simulation: 15 scenarios passed, including all 14 existing scenarios and incomplete setup skipping connection attempts.
- UI generation repeated successfully and `git diff --check` passed.
- Host C++ checks used the working Xcode macOS 26 SDK. The default Command Line Tools SDK failed to link; this was an environment issue, not a firmware test failure. Sanitizer execution is not claimed: the local sanitizer runtime stalled, and the added Linux CI sanitizer job cannot run until publication is authorized.

## Physical test ESP32

- OTA installation of the final candidate passed without erasing settings or disconnecting the computer from Wi-Fi.
- Reboot/version, saved configuration and trigger fingerprints, Wi-Fi connectivity, idle motor state, UI routes, status, and logs were verified.
- A real H2D on the same network was discovered. Selecting a result fills IP, serial, and model without saving settings or retrieving credentials.
- An initial candidate reproduced a setup-page timeout. Later builds skip MQTT connection attempts while printer setup is incomplete. The readiness/reveal build passed 12 repeated health/status/discovery samples with a maximum health response time of 430 ms. The final save-validation/navigation build passed another 12 samples with no reboot or settings change and a maximum health response time of 819 ms while browser checks ran concurrently. A real printer was found and search auto-stop/repeat-start bounds passed again.
- Repeated search-start requests did not extend the active search; the search stopped automatically after 20 seconds.
- Saved Wi-Fi Show/Hide was exercised in the device browser without logging or capturing the unmasked password. The saved-field API passed positive and negative tests: explicit local POST/header required, foreign origins rejected, field allowlist and payload bounds enforced, no CORS grant, no-store response, routine configuration omits secrets, and viewing preserves settings/triggers and boot. This is not authentication; the feature is for a trusted LAN only.
- Save Wi-Fi reported a verified live connection in the browser. A separate same-network partial-save hardware check returned `rebooting: false` and preserved all settings. An overlapping restart/printer-field change was investigated; the owner confirmed they were changing settings concurrently. Those owner edits were retained, not reverted.
- Network showed Connected; Operation/Motor showed Ready; Printer identified only the missing access code after the owner's address/serial edits. The final global Save button was disabled while Save Wi-Fi remained enabled. On Overview, the amber Settings tab and setup reminder remained visible. Final saved Wi-Fi reveal/Hide was rechecked, and 390/1280-pixel overflow checks passed. Screenshots were saved locally with credentials masked.
- Final OTA checksum `c0066c3a74a9c797c2125f26c48cfc81ca38f1b39a3a02a19088995c7168b434` was installed on the test board; configuration/trigger fingerprints were preserved, all served UI routes matched source, Wi-Fi returned connected, the motor remained idle, and incomplete setup routed to `/config`.

## Release artifacts

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| OTA application | 1,199,552 | `c0066c3a74a9c797c2125f26c48cfc81ca38f1b39a3a02a19088995c7168b434` |
| Merged USB image | 1,265,088 | `441d21233d57c9d6f6a70b79b0d95f290092a7d5565240cf89e68772b35e8300` |

Canonical release files, installer copies, and local distribution copies match. The merged image contains the application at `0x10000`, byte-identical to the OTA image. The versioned USB manifest references the merged image at offset `0`, with ESP32 and Improv settings retained. The versioned descriptor references the OTA image and its correct checksum. Its GitHub tag URL is a future publication target, not an already-live mirror.

Existing public manifest/descriptor pointers remain v1.5.3. No published binaries, tags, rollback feeds, or website files were changed. The remote default branch remains the published v1.5.3 commit and has no v1.5.4 tag.

## Coverage limits and publication gate

- Physical discovery covered one H2D; other model mappings and multiple results were tested with host fixtures, not several physical printers.
- Fresh USB erase/installation, hotspot recovery, and a complete physical MQTT print/motor cycle were not repeated in this round. The test device remains unconfigured for printer authentication and idle. These are not implied by the OTA/discovery acceptance result.
- No overnight soak was performed.
- Owner must review the candidate and choose whether to publish. After approval, publish immutable files first, verify their actual GitHub/site bytes and CORS behavior, then promote public pointers and recheck `/flasher`, `/flasher/`, and legacy `install.html` paths. Do not overwrite earlier releases.
