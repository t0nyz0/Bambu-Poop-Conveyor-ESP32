# v1.5.4 candidate QA

Tested October 9, 2026. This is an unpublished candidate; owner approval is required before publishing a tag, GitHub release, website update, or live feed change.

## Scope

- Bounded local printer discovery and first-time Settings search.
- Separate Network and Printer sections; Show/Hide for credentials entered in the form.
- Incomplete printer setup skips MQTT connection attempts so setup remains responsive.
- Existing configuration format, credentials, motor timing, triggers, configured MQTT operation, LEDs, provisioning, and previous-stable recovery remain unchanged.

## Automated validation

- ESP32 PlatformIO build passed. Application image: 1,192,992 bytes, below the 1,310,720-byte OTA partition limit. Static RAM: 59,620 bytes.
- Discovery parser/service: 57 checks passed, including malformed datagrams, source/subnet checks, duplicate handling, eight-result limit, per-loop packet limit, timeout/wraparound, and listener shutdown.
- UI and release/update regression tests: 38 passed, including selection without saving, unknown-model fallback, safe text rendering, first-time-only automatic search, preserved form values, separate cards, and Show/Hide without requests.
- Startup routing: 15 checks passed.
- MQTT/indicator/motor host simulation: 15 scenarios passed, including all 14 existing scenarios and incomplete setup skipping connection attempts.
- UI generation repeated successfully and `git diff --check` passed.
- Host C++ checks used the working Xcode macOS 26 SDK. The default Command Line Tools SDK failed to link; this was an environment issue, not a firmware test failure. Sanitizer execution is not claimed: the local sanitizer runtime stalled, and the added Linux CI sanitizer job cannot run until publication is authorized.

## Physical test ESP32

- OTA installation of the final candidate passed without erasing settings or disconnecting the computer from Wi-Fi.
- Reboot/version, saved configuration and trigger fingerprints, Wi-Fi connectivity, idle motor state, UI routes, status, and logs were verified.
- A real H2D on the same network was discovered. Selecting a result fills IP, serial, and model without saving settings or retrieving credentials.
- An initial candidate reproduced a setup-page timeout. The final build skips MQTT connection attempts while printer setup is incomplete. The final acceptance run passed 12 repeated health/status/discovery samples with no reboot, no settings change, and a maximum health response time of 301 ms.
- Repeated search-start requests did not extend the active search; the search stopped automatically after 20 seconds.
- Both Show/Hide controls were exercised in the device browser using unsaved dummy input, then cleared and returned to masked mode. Settings retains its plain headline; Network and Printer are separate cards.
- Desktop screenshot of the final device UI was saved locally. Earlier 390/1280-pixel overflow checks passed on the initial candidate. Repeating viewport overrides on the final UI was blocked by browser-control timeouts, so final mobile visual acceptance is still pending; the hidden-result and panel structure tests passed.

## Release artifacts

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| OTA application | 1,192,992 | `e0d18646beb7decfb033436775ad265ec9d7494b2f913f9e81827aaab8501395` |
| Merged USB image | 1,258,528 | `add9b367f88e826f1e2978820392dade5f4373d750bd4d03fa68e569b20a2f06` |

Canonical release files, installer copies, and local distribution copies match. The merged image contains the application at `0x10000`, byte-identical to the OTA image. The versioned USB manifest references the merged image at offset `0`, with ESP32 and Improv settings retained. The versioned descriptor references the OTA image and its correct checksum. Its GitHub tag URL is a future publication target, not an already-live mirror.

Existing public manifest/descriptor pointers remain v1.5.3. No published binaries, tags, rollback feeds, or website files were changed. The remote default branch remains the published v1.5.3 commit and has no v1.5.4 tag.

## Coverage limits and publication gate

- Physical discovery covered one H2D; other model mappings and multiple results were tested with host fixtures, not several physical printers.
- Fresh USB erase/installation, hotspot recovery, and a complete physical MQTT print/motor cycle were not repeated in this round. The test device remains unconfigured for printer authentication and idle. These are not implied by the OTA/discovery acceptance result.
- No overnight soak was performed.
- Owner must review the candidate and choose whether to publish. After approval, publish immutable files first, verify their actual GitHub/site bytes and CORS behavior, then promote public pointers and recheck `/flasher`, `/flasher/`, and legacy `install.html` paths. Do not overwrite earlier releases.
