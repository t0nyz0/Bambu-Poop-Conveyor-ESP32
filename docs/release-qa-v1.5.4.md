# v1.5.4 QA

This document records chronological v1.5.4 testing. Older package hashes and
unpublished/channel status below describe earlier candidates, not the final
stable package.

## Stable promotion — October 10, 2026

- The owner approved promotion after testing v1.5.4 Beta 4. The stable firmware
  differs from the immutable Beta 4 source only in `displayVersion`: `1.5.4`
  replaces `1.5.4 Beta 4`. The web source, embedded UI, motor/MQTT logic,
  configuration storage, provisioning and partitions are unchanged.
- All 267 firmware regression cases passed: 139 UI/release checks and 128
  startup, MQTT/indicator, discovery, settings/upload and HTTP host scenarios.
- Stable build passed with 59,764 bytes of static RAM and a 1,205,392-byte OTA
  application, within the existing 1,310,720-byte partition. The merged USB image
  is 1,270,928 bytes; its application at `0x10000` exactly matches the OTA image.
- Canonical, installer and distribution images/checksums agree. The generated
  UI decompresses exactly to the web source and is present in the application.
  USB manifests retain ESP32, Improv, the 30-second provisioning wait, the erase
  prompt and merged offset `0`; version is not repeated in the product name.
- Real stable OTA acceptance passed on the connected Beta 4 conveyor at
  `10.0.0.41`: boot `973612756` changed to `790777862`, display version became
  `1.5.4`, saved settings and trigger fingerprints were unchanged, Wi-Fi was
  connected, motor was Idle, and all served control-center routes matched the
  final UI source. No credential values were printed or captured.
- A subsequent short 20-request observation passed without request failure,
  sampled Wi-Fi/MQTT loss, restart or motor activity. Latency was
  44 / 145 / 400 ms (minimum / median / maximum); free heap ranged from
  106,616 to 114,056 bytes. This is a short idle check, not an overnight soak.
- Final stable OTA SHA-256:
  `30ecfb071931347537a83778589172574ee4eec4b01fc6fce910e81862fba0c1`.
- Final stable merged SHA-256:
  `4cea0f1dcdd136114bcff72b9a5d1b4be972f4ec7bdadb5a35ff369e055b3855`.
- Promotion keeps v1.5.1 as previous stable and v1.4.2 as separate legacy
  recovery. Published beta images and tags remain archived; no active beta is
  offered once stable v1.5.4 supersedes Beta 4.
- A fresh physical USB erase/provisioning run, other physical printer models,
  a full print/motor cycle and an overnight soak were not repeated for the
  label-only stable build. USB package validation and short device checks do
  not replace those longer hardware tests.

## Beta 1 package acceptance

- The candidate was rebuilt with numeric version `1.5.4`, explicit display version `1.5.4 Beta 1`, and separate `v1.5.4-beta.1` filenames. No stable feed or previously released binary was changed.
- All 229 automated checks passed again. The site passed its 40 regression checks and production build after its assertions were updated for an active beta rather than a retired one.
- Beta OTA application: 1,203,696 bytes, SHA-256 `a847b03313888f0f5216645c63713c52894b357d5ff66cb3e8bb4963b5fdc34f`. Merged USB image: 1,269,232 bytes, SHA-256 `ced852f350d066da3f449a28b79028827ec430c32f4b49bfff55bb24d339e4ac`. Canonical, installer, distribution, and site copies match. Embedded UI, ESP image magic, partition fit, USB/application split and manifest offset/ESP32/Improv settings passed independent verification.
- The exact Beta 1 image passed physical OTA acceptance on the idle test ESP32: boot `3363646370` → `154854210`, reported version `1.5.4 Beta 1`, unchanged saved settings/trigger fingerprints, connected Wi-Fi, idle motor, configured default Overview, and served UI routes byte-identical to source. The primary conveyor was not changed.
- The GitHub release uses the owner-approved notes, the explicit prerelease flag and `latest=false`. Publication verification must check actual live bytes and browser CORS before considering deployment complete. Stable promotion, clean USB recovery, a full print/motor cycle, other physical printer models, and overnight testing remain separate from this beta acceptance.

## Scope

- Bounded local printer discovery and first-time Settings search.
- Separate Network and Printer sections; explicit Show/Hide for saved or newly entered credentials on the trusted local device.
- Section readiness, separate Wi-Fi and printer saves, required-printer validation for global Save, and an incomplete-setup reminder in navigation and Overview.
- Incomplete printer setup skips MQTT connection attempts so setup remains responsive.
- Consistent saved-value Show/Hide, staged section-save progress, printer name on Overview, and explicit status-loading/error states.
- Quiet background refresh, draft preservation across tabs, failed-trigger-load Save guards, persistent installation locks, bounded requests, and a steady green badge for an idle live printer connection.
- Failed status refreshes retain last-known Wi-Fi with neutral retry guidance instead of falsely labeling the device offline or requiring Network setup. A fresh response restores live indicators; missing printer details still receive setup guidance.
- Unique, stable per-board MQTT client names; credentials, topics, reconnect intervals, keepalive, motor timing, triggers, LEDs, provisioning, and previous-stable recovery remain unchanged.
- Optional printer display metadata is stored separately and shown only for a matching configured IP and serial; the existing configuration format is unchanged.

## Automated validation

- ESP32 PlatformIO build passed. Application image: 1,202,160 bytes, below the 1,310,720-byte OTA partition limit. Static RAM: 59,764 bytes.
- Discovery parser/service and printer-label handling: 63 checks passed, including malformed datagrams, source/subnet checks, duplicate handling, eight-result limit, per-loop packet limit, timeout/wraparound, listener shutdown, old configurations without labels, stale-label hiding, and avoiding repeated metadata writes.
- UI and release/update regression tests: 88 passed, including selection without changing connection settings, safe text rendering, readiness states, saved-code and motion-mode exceptions, an independently guarded global Save handler, partial section payloads, connection verification after reboot, error/timeout handling, and saved-value reveal without resubmission. New cases cover one-click reveal after save, pending/failed/stale reveal responses, save-progress stages, Overview loading versus disconnection, coalesced status requests, printer-name fallback, old status payloads, draft preservation, failed trigger load/save guards, installation locks, finite request timeouts, connected-green versus paused/offline/motion styles, and repeated status failures/recovery without false Network setup warnings. Typed-value Show/Hide needs no request; saved-value Show explicitly requests only that field. These are automated fixtures, not physical printer-connection acceptance.
- Startup routing: 15 checks passed.
- MQTT/indicator/motor host simulation: 16 scenarios passed, including all 14 existing scenarios, incomplete setup skipping connection attempts, and stable distinct MQTT names within the 23-character compatibility limit.
- UI generation repeated successfully and `git diff --check` passed.
- Host C++ checks used the working Xcode macOS 26 SDK. The default Command Line Tools SDK failed to link; this was an environment issue, not a firmware test failure. Sanitizer execution is not claimed: the local sanitizer runtime stalled, and the added Linux CI sanitizer job cannot run until publication is authorized.

## Physical test ESP32

- Earlier candidate checks below are historical results, not acceptance of every subsequent build.
- OTA installation of the earlier candidate passed without erasing settings or disconnecting the computer from Wi-Fi.
- Reboot/version, saved configuration and trigger fingerprints, Wi-Fi connectivity, idle motor state, UI routes, status, and logs were verified.
- A real H2D on the same network was discovered. Selecting a result fills IP, serial, and model without saving settings or retrieving credentials.
- An initial candidate reproduced a setup-page timeout. Later builds skip MQTT connection attempts while printer setup is incomplete. The readiness/reveal build passed 12 repeated health/status/discovery samples with a maximum health response time of 430 ms. The final save-validation/navigation build passed another 12 samples with no reboot or settings change and a maximum health response time of 819 ms while browser checks ran concurrently. A real printer was found and search auto-stop/repeat-start bounds passed again.
- Repeated search-start requests did not extend the active search; the search stopped automatically after 20 seconds.
- Saved Wi-Fi Show/Hide was exercised in the device browser without logging or capturing the unmasked password. The saved-field API passed positive and negative tests: explicit local POST/header required, foreign origins rejected, field allowlist and payload bounds enforced, no CORS grant, no-store response, routine configuration omits secrets, and viewing preserves settings/triggers and boot. This is not authentication; the feature is for a trusted LAN only.
- Save Wi-Fi reported a verified live connection in the browser. A separate same-network partial-save hardware check returned `rebooting: false` and preserved all settings. An overlapping restart/printer-field change was investigated; the owner confirmed they were changing settings concurrently. Those owner edits were retained, not reverted.
- Network showed Connected; Operation/Motor showed Ready; Printer identified only the missing access code after the owner's address/serial edits. The final global Save button was disabled while Save Wi-Fi remained enabled. On Overview, the amber Settings tab and setup reminder remained visible. Final saved Wi-Fi reveal/Hide was rechecked, and 390/1280-pixel overflow checks passed. Screenshots were saved locally with credentials masked.
- Earlier OTA checksum `c0066c3a74a9c797c2125f26c48cfc81ca38f1b39a3a02a19088995c7168b434` was installed on the test board; configuration/trigger fingerprints were preserved, all served UI routes matched source, Wi-Fi returned connected, the motor remained idle, and incomplete setup routed to `/config`.

### Earlier build: stability acceptance incomplete

- With the owner's explicit approval, OTA checksum `1ee458bb16ef63fb489e00545cb593384c52e2e19b33a05a12df61936d0a838b` was installed on `10.0.0.44`. The acceptance script passed: new boot, v1.5.4, unchanged configuration and trigger fingerprints, Wi-Fi connected, idle motor, and served UI routes byte-identical to source. The configured device retained Overview as its default route. No public files or feeds were changed.
- Before this installation, the configured device already showed repeated MQTT disconnect/reconnect transitions with Wi-Fi connected and an unchanged boot. A hard-coded shared MQTT client name was replaced with a stable per-board name, but this does not establish that a name collision caused every observed disconnect.
- Subsequent observation still found HTTP timeouts and MQTT connection problems. A later restart returned fast responses and MQTT connected, but an eight-sample check still had two six-second HTTP timeouts. A real saved-access-code Show request also timed out and remained masked with a retryable error. This is a failed hardware acceptance gate, not a passing connection soak.
- USB serial monitoring also encountered a device-disconnected error; the serial device reappeared at a different USB location and the boot identifier changed. Whether the owner replugged it or there is a physical connection/power issue is not established. Serial-opening effects are not excluded, so boot output alone is not claimed as proof of a firmware reboot loop.
- Local browser fixtures passed staged save/check progress, reset-to-Show after saving, one-click saved reveal, retry handling, printer-name display, and refresh retaining the last printer state. These are simulated results, not replacements for pending physical checks. No unmasked credentials were logged or captured.
- Pending on a consistently reachable device: real Save & check printer, one-click reveal after that save, persistence/display of the discovered configured-printer name, and an MQTT stability soak. No timing, keepalive, credential, or connection-selection changes were made to mask the remaining problem.

### Earlier UI-fix build: installation accepted

- The preceding five-guard UI build (`707ad63e13f399079260b5f3f4054769d88d4167e248f055072633b3ca70da98`) passed local OTA acceptance. After the owner requested the green connected badge, image `2f3b8026d8657e62a41189f54ae2a77f379462f57e957209336249bf2c685776` was installed on the idle test ESP32 at `10.0.0.44` and passed again. The later status-refresh correction below supersedes this package.
- That acceptance verified a new boot (`1511627293` → `199531278`), v1.5.4, unchanged saved configuration and trigger fingerprints, connected Wi-Fi, idle motor, working status/log endpoints, and all served UI routes byte-identical to that build's source. Default route remains Overview for the configured device.
- The real device browser showed “Printer connected” with class `printer-live connected`, green `rgb(69, 201, 134)`, and no dot animation. Manual Refresh returned normally; subsequent background updates left Refresh status enabled without a busy indicator. A current screenshot is saved locally in `dist/qa-overview-connected-v1.5.4.jpg`.
- Real browser draft check: changed Motor wait from 5000 to 5001 without saving, switched Overview → Settings, and confirmed 5001 was retained. Restored the original input without submitting; no settings were written.
- The generated compressed header expands exactly to source; the application contains that header, all local artifact copies match, the merged application at `0x10000` matches OTA, and the versioned descriptor checksum matches. The active public manifest still points to v1.5.3. No publication occurred.
- Successful installation and this short UI check do not supersede the earlier MQTT/HTTP stability failures or establish an overnight soak pass.

### Latest Settings status-refresh correction: installation accepted

- A single failed `/api/status` request previously set `settingsOffline`, overriding a last-known connected Wi-Fi response and producing “Device offline” / “Wait for the device to reconnect.” This was a browser-state defect, not proof of missing credentials.
- The corrected UI distinguishes unavailable status from confirmed disconnection. Network becomes neutral with “Last known: connected” when appropriate; the summary explains automatic retry and unchanged saved settings. A successful response restores Connected. Fresh disconnected status and genuinely missing printer fields remain visible; no stored settings or firmware connection behavior were changed for this correction.
- Re-ran all 88 UI tests, 63 discovery/metadata checks, 16 MQTT/LED/motor scenarios and 15 startup checks: 182 passed. Failure/recovery cases use host fixtures; no real Wi-Fi outage was induced. PlatformIO build and package/manifest checks passed.
- The first installation attempt was stopped before upload because the conveyor was in Cooldown. After cooldown ended naturally, the corrected OTA (`292b7ccd5b351c71f0cf8d8e4beb15fc93aa1dd7a1cd508a31c0b107ba7d0dd2`) passed acceptance on `10.0.0.44`: boot `199531278` → `3961885054`, v1.5.4, unchanged settings/trigger fingerprints, connected Wi-Fi, idle motor, working status/log endpoints, and all served UI routes byte-identical to source.
- The real device browser showed Network “Connected,” a complete-setup summary, and MQTT connected. Password/access-code fields remained masked and empty; no values were revealed, logged or changed. Masked visual evidence: `dist/qa-settings-status-fix-v1.5.4.jpg`.
- Generated UI, OTA/merged images, all local copies and versioned checksums are synchronized. Active public pointers remain v1.5.3; no publication or website change occurred. This UI correction does not resolve or claim a root cause for intermittent printer MQTT drops, and the separately identified inherited settings-validation defect remains unmodified.

### Final comparison and QA review, October 9

Baseline: immutable `Release-v1.5.0` (`d0c4fd041c7718913438664307a9f202e1db35cd`). Candidate: local `release/v1.5.3`, based on `cacb646` plus the current reviewed changes. The two new helper headers and regression-test files were inspected as well as tracked diffs; a tracked-only diff would omit them.

| Area compared with v1.5.0 | Result |
| --- | --- |
| Motor wait/run/cooldown and event priority | Unchanged source; normal, disconnected, motion-mode and reconnect scenarios passed host simulation |
| MQTT message parsing, topics and push-all request | Unchanged source; client identity is now per board and incomplete setup skips attempts |
| LED disconnect/reconnect behavior | Intentional v1.5.1 recovery changes; 16 host scenarios passed, including active motor LED priority |
| Wi-Fi/AP startup and serial provisioning | Original functions and dependencies unchanged; startup routing adds incomplete-setup guidance |
| Settings storage and trigger format | Original read/write keys unchanged; optional printer name uses a separate namespace |
| OTA validation, trigger handlers, motor APIs and legacy status | Existing helpers unchanged; embedded UI adds guarded interactions and timeouts |
| Partitions, board and dependencies | PlatformIO configuration identical; OTA fits the existing partition |
| Previous releases | v1.5.0 canonical/installer binaries are byte-identical to the tag; live stable/mirror/recovery files passed checksums |

- Re-ran 84 UI tests, 63 discovery/metadata checks, 16 MQTT/LED/motor scenarios and 15 startup checks: 178 passed. PlatformIO build passed and its application file matches the installed package checksum. The C++ `sprintf` deprecation warning comes from unchanged source.
- Live saved-field API acceptance passed. Real discovery passed again: H2D found, repeated starts did not extend the search, listeners stopped after 20 seconds, 12 health samples had a maximum response time of 372 ms, and settings/boot stayed unchanged.
- An initial 24-sample status observation passed without timeout, disconnection or reboot. Response times ranged from 67 to 3702 ms; this is a short observation, not proof of continuous connectivity between samples.
- Real **Save & check printer** using the existing saved fields completed with “Printer saved and MQTT connected.” A single subsequent Show click revealed the saved code; Hide masked it again. Only boolean reveal results were recorded. Configuration and trigger fingerprints and boot were identical before/after; motor remained idle. Masked evidence: `dist/qa-settings-final-v1.5.4.jpg`.
- **Release blocker remains:** a later device browser observation showed “Status unavailable.” A direct health/status request then returned successfully with the same boot, Wi-Fi connected, and `mqtt.connected: false`. This confirms an actual MQTT disconnection, not just an initial-load UI placeholder. The initial passing sample window does not clear the intermittent MQTT/HTTP gate.
- **Existing settings API defect found:** in both v1.5.0 and this candidate, `handleApiConfigPost` copies SSID/mode/printer fields into live variables before rejecting an overlong Wi-Fi password or access code. An invalid request can therefore partially alter live settings even though no NVS save occurs. This is an inherited defect, not a new v1.5.4 regression. No invalid configuration was sent to the board; correction and a negative regression test are recommended before release. No implementation change was made during this QA-only review.
- Live GitHub manifests and official v1.5.3 release files passed full USB/application split, offsets, CORS and checksum checks. Site/GitHub stable, archived beta and v1.5.1/v1.4.2 recovery downloads also passed. `/flasher` and `/flasher/` serve the installer with absolute manifest references and retained ad integration. Legacy `/flasher/install.html` is a redirect wrapper, not the installer document itself; the real browser followed it to the working `/flasher` page. An initial direct-body assertion expected the installer inside that wrapper and was corrected after inspecting its redirect; it was not a broken production route.

### Latest full read-only release-readiness review

- Rebuilt the unchanged candidate and re-ran all 182 unique automated checks (88 Node UI/release tests plus 94 C++ host checks). All passed. The application checksum is still `292b7ccd5b351c71f0cf8d8e4beb15fc93aa1dd7a1cd508a31c0b107ba7d0dd2`; this review did not modify firmware or reinstall it.
- Twenty live status samples completed without request errors, sampled Wi-Fi/MQTT disconnection, restart, or motor activity. Boot remained `2256602213`, and configuration/trigger fingerprints were unchanged. Maximum response time was 6,782 ms: a successful ten-second diagnostic request can still exceed the browser's six-second status timeout. This is a short observation, not an overnight soak or proof of uninterrupted MQTT connectivity between samples.
- `/`, `/config`, `/control`, `/logs`, and `/update` returned the exact embedded source. Health, logs, and legacy status endpoints returned valid JSON. The real browser showed Network and Printer Connected, complete setup, the configured printer name, masked empty credential fields, loaded trigger rules, and current release/rollback cards. Selecting GitHub mirror updated the controls without installing firmware.
- One real browser Logs request failed with "Failed to fetch" while the device header remained Online; the following direct log request returned valid JSON, and reopening Logs displayed all six stored entries with Refresh enabled. This intermittent transport failure is not explained by the passing sample window and is not claimed to be repaired. No settings were saved, credentials revealed, discovery restarted, motor run, or device rebooted during this review.
- Independent release checks passed for local v1.5.4 copies, UI embedding, merged/application split, sizes, offsets, ESP32/Improv manifests, descriptors, and checksums. Live v1.5.3 site/GitHub manifests and stable/recovery mirrors passed. `/flasher`, `/flasher/`, and legacy `install.html` remain valid. The future v1.5.4 tag/release is intentionally absent; active public pointers remain v1.5.3.
- **Inherited rejected-save defect remains:** `handleApiConfigPost` assigns live SSID/mode/printer fields before rejecting an overlong credential. A rejected request can change RAM settings without saving NVS. This same ordering exists in v1.5.0. Validate the entire request before any assignment, then add a negative regression test. No malformed payload was sent to hardware.
- **Inherited cross-flow locking gap found:** Settings saves and OTA installation do not share a busy guard. Host UI fixtures confirmed that save controls remain enabled while installation is busy, a settings POST can start then, and installation can start during section restart/checking. Global Save and OTA also lacked mutual exclusion in v1.5.0; the new section saves expose additional paths. Use shared guards in both directions and add cross-flow regressions. No overlapping operation was attempted on hardware.
- No additional concrete motor/trigger/storage/partition regression was found in the v1.5.0 comparison. The two code findings above and the unresolved intermittent HTTP observation prevent an unconditional publish-ready verdict. Fix the bounded save/installation issues and repeat focused hardware/browser checks before seeking publication approval.
- README release text, article Settings/Update screenshots, explicit saved-value disclosure wording, and public installer version/date still need coordinated promotion-time updates. No website, release, branch, or remote change occurred during this review.

### Read-only performance and memory-lifetime review

- Live sampling ran for 343 seconds with sequential status requests at a nominal five-second cadence and ten-second request limit. Of 46 attempts, 28 returned valid status and 18 timed out. Successful-response latency: minimum 49 ms, median 3,386 ms, 95th percentile 7,139 ms, maximum 9,508 ms; eight successful requests exceeded the UI's six-second limit. Two separate direct log-safe status reads also returned valid JSON. These observations confirm intermittent diagnostic request failures, not their root cause.
- In successful samples, v1.5.4 boot stayed `680171867`, uptime advanced, Wi-Fi/MQTT reported connected, and motor stayed Idle. Free heap ranged from 90,104 to 113,000 bytes. First/last ten-successful-sample medians were 103,564 / 104,404 bytes, with no downward memory trend. Minimum-ever free heap stayed 39,752 bytes. No reboot or leak trend was observed in this short window; disconnected states during timeouts and heap fragmentation cannot be ruled out. This is not an overnight stability pass.
- Compared current firmware and browser work with immutable v1.5.0. No source-evident new unbounded collection, missing allocation cleanup, or accumulating normal-path timer/listener chain was found. This is not proof of weeks-long leak-free operation.
- Discovery keeps eight fixed-size records and two UDP socket objects, accepts at most one packet per socket per loop, and closes both listeners on its 20-second timeout, disconnected Wi-Fi, AP mode, restart, or upload. Fixed discovery/label state adds approximately 1.3 KB of static RAM, not a per-search allocation. Label storage is bounded; unchanged labels do not rewrite NVS. The per-board MQTT name uses a 22-byte stack buffer.
- Route-local JSON documents and temporary Strings are automatically released. The unchanged MQTT callback allocates/frees a 40 KB JSON document per message; the original PubSubClient setup retains a separate 40 KB packet buffer. The original 200-entry String log ring is bounded, though initial population and larger replacement messages can increase retained capacities. These are allocation/fragmentation considerations, not demonstrated leaks.
- The principal source-level stall risk is inherited synchronous MQTT connection work in the main loop. Installed TCP/TLS/MQTT libraries have finite but potentially long connection/handshake/read limits. While blocked, this loop cannot service HTTP or advance motor state. Those configured library limits are not measured stall durations, and no causal link to every observed request timeout has been proven.
- Browser status polling remains every three seconds per open page, with a single-flight guard and finite request timeout. Multiple device tabs multiply request load. Countdown uses one self-scheduling timer; its idle 400-ms updates continue off Overview. Discovery and section-save chains are sequential and bounded on their normal paths. Rendered lists are replaced, secret hints are created once, and listeners are attached once at page initialization.
- Two inherited efficiency/buffering gaps were reproduced with offline fixtures: rapid Logs tab reentry can start parallel log requests because `loadLogs` lacks an in-flight guard, and a streamed firmware response is fully buffered before its size is validated. A 2,100,000-byte fixture was buffered and then rejected against the 1,310,720-byte limit. Valid published files are approximately 1.2 MB; no real oversized download or firmware install was performed. Coalescing Logs requests and enforcing a streaming byte limit would bound these cases.
- **Overview freshness bug confirmed from the owner's screenshot and source:** failed polling updates the header and Settings freshness flag, but leaves an existing Overview sample styled as live/connected. Countdown continues painting readiness from that old sample. Keep useful last-known values, but qualify the dynamic Overview data and use neutral freshness styling until `paint` receives a successful response. Do not translate a request failure into a false MQTT disconnection.
- No firmware, browser source, configuration, release artifacts, or remote state was changed for this review. Heap fragmentation (largest free block), task stack watermarks, actual CPU utilization, and overnight stability are not exposed/proven by the available status metrics.

### Implemented save, upload, and status corrections

- Corrected rejected Settings saves so all string/mode/credential validation precedes live assignments or NVS writes. Blank/omitted saved credentials and older partial payloads retain their existing behavior. Settings and firmware installation now block conflicting operations in the UI and server; a pending successful restart is never overwritten by another upload.
- Cancelled or malformed multipart uploads release stale upload state even when the web-server parser skips the normal completion callback. Cleanup does not interrupt an active request or pending successful restart. A valid image finalized before a malformed trailing request can already be selected for the next boot by the unchanged Update library; cleanup prevents a stale success/reboot, but does not claim to undo a written image.
- Overview now qualifies retained readings as last known, stops presenting a stale printer badge as Live or a stale countdown as Ready, and restores live styling after a successful status response. Cold-load connection, LED and health indicators are neutral/unknown; Run is blocked until fresh status arrives and is independently guarded in its handler. Stop remains available.
- Logs reads are single-flight. Firmware downloads reject oversized declared lengths and cancel a stream before retaining a chunk that would exceed the 1,310,720-byte application limit. Valid streamed files preserve their bytes and normal installation flow.
- Reproduced a separate HTTP head-of-line delay on the old installed image: opening one TCP connection without HTTP bytes delayed a queued health GET by 4,996 and 4,778 ms. The local `ResponsiveWebServer` wrapper runs original parsing first and releases only an empty connection at least one second old when a competing client is queued. The same physical test after installation measured 835 and 788 ms. Original partial-header, POST/upload parsing, response/SSE timeouts, MQTT parsing and motor timing are untouched.
- Automated coverage now passes 229 unique cases: 101 Node UI/release cases, 63 discovery/label checks, 16 MQTT/LED/motor scenarios, 15 startup-routing cases, 25 real-handler Settings/OTA host scenarios, and 9 HTTP-wrapper scenarios. Host tests are not physical print/motor-cycle acceptance.
- Local sanitizer execution is unavailable: the address/undefined-sanitized discovery fixture timed out before output, and a trivial sanitized program independently did the same while its normal build completed. The ordinary 63 discovery checks pass. No sanitizer success or failure in the firmware is inferred from this host-runtime limitation.
- Final candidate build: application 1,203,696 bytes (fits the existing 1,310,720-byte partition), merged 1,269,232 bytes, static RAM 59,764 bytes (unchanged), UI 79,587 raw / 22,058 gzip bytes. Source, embedded UI, merged/application split, canonical/installer/distribution copies and versioned descriptor checksum match. No new persistent collection or background allocation was added by the web-server guard.
- Live public v1.5.3 USB manifests, release assets, stable/beta/v1.5.1/v1.4.2 application mirrors, CORS and checksums passed again. Public pointers remain v1.5.3; v1.5.4 is an unpublished candidate. The first corrected image (`a451279c0e7d82be80c3f2ee2f3b5f747608ddb69cfc524502c65f990dadfd8f`) passed real OTA acceptance: boot `3908679681` → `3516926440`, settings/trigger fingerprints preserved, Wi-Fi connected, motor Idle, and served routes exactly matched its UI. The final cold-load UI package below supersedes that image.
- A five-minute physical observation of that corrected firmware logic completed 60/60 status requests without timeout, sampled Wi-Fi/MQTT disconnection, restart, or motor activity. Response times: minimum 60 ms, median 253 ms, 95th percentile 1,384 ms, maximum 1,952 ms (all below the browser's six-second timeout). Boot remained `3516926440`; configuration and trigger hashes were unchanged. Free heap ranged from 105,712 to 113,908 bytes; first/last ten-sample medians were 113,744 / 113,628 bytes, with no sustained free-heap decline demonstrated. Minimum-ever heap moved from 40,524 to 39,792 bytes during the observation; this watermark and a short run do not prove absence of fragmentation or an overnight leak. The final package changes only the cold-load/stale visual safeguards after this observation, not the tested HTTP/MQTT/motor firmware logic.
- Final package `2ce3b7fd8a1b56afe270795898bdd5ec82532b7417965c8e9d60bc63e59c9e09` passed real OTA acceptance: boot `3516926440` → `3363646370`, saved settings/trigger fingerprints unchanged, Wi-Fi connected, motor Idle, configured default Overview, and every served UI route byte-identical to the final source. A subsequent 90-second, 30-request observation passed without timeout, sampled Wi-Fi/MQTT loss, restart, or motor activity; minimum/median/maximum latency was 100 / 263 / 2,768 ms, heap 106,140–113,872 bytes.
- The final device browser visibly showed Run disabled, unknown LED values and Checking status during initial load, then Online, green Printer connected / Live MQTT connection, enabled Run for the confirmed Idle state, and an unchanged background Refresh button. The browser error/warning log was empty. Before the final UI-only installation, the device browser also loaded connected Network/Printer readiness, Logs, public v1.5.3, retired beta guidance, v1.5.1 rollback, and GitHub mirror selection without any save or install. Final visual evidence: `dist/qa-overview-freshness-v1.5.4.jpg`. Failure/last-known states and conflicting operation guards are covered by the 101 real-script host UI tests; no physical outage or overlapping hardware operation was deliberately induced.
- These results clear the previously identified bounded save/upload/UI defects and demonstrate the corrected empty-connection queue behavior. They do not establish that every historical MQTT disconnect had the same cause, eliminate inherited synchronous TLS/MQTT waits, or substitute for a physical print cycle, clean USB recovery test, other printer models, or an overnight soak. No publication, remote branch/tag/release change, website mutation or credential change was performed.

### Prepared publication sequence — pending owner approval and release acceptance

1. Review the completed final-image device/browser results above and retain the distinction between short HTTP/MQTT observation and a physical print-cycle or overnight pass. The bounded save/installation and stale-status defects above have been corrected; publication still requires owner approval.
2. Make the release commit on the existing branch with source, generated UI, new helper/test files, matching immutable v1.5.4 images/checksums and focused release notes. Keep the private `AGENTS.md` and unrelated legacy beta files out of the commit. Do not create another branch.
3. After owner approval, publish v1.5.4 immutable files and tag/release first, then verify actual site/GitHub download bytes and CORS. Never promote a descriptor whose binaries or mirrors are missing.
4. Promote stable USB/OTA pointers together. Site manifests must use their actual root-level merged file paths; repository manifests use `firmware/` paths. Retain ESP32/Improv settings, USB offset 0, separate OTA image, existing v1.5.1 previous-stable and v1.4.2 legacy recovery. Retire older beta offerings without deleting archived files.
5. Update README release text and installation filenames; retain its single main-page image. Update the site article's Settings screenshot and obsolete v1.5.2 Update screenshot (which still depicts v1.4.2 rollback although current text correctly says v1.5.1). Recheck the “never return saved secrets” wording when documenting v1.5.4's explicit trusted-LAN Show feature. No article or public pointer edits were made during this review.
6. Recheck clean USB/Improv Wi-Fi provisioning on a spare board, OTA preservation, live mirror selection, all installer URL forms, and published manifests/checksums. Obtain physical print/motor-cycle validation and owner acceptance before declaring the overall release complete.

## Release artifacts

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| OTA application | 1,203,696 | `2ce3b7fd8a1b56afe270795898bdd5ec82532b7417965c8e9d60bc63e59c9e09` |
| Merged USB image | 1,269,232 | `f777072a56c42ef71bd66de4133098377ba3a13679f5ac89ec3a40aadd98a587` |

Canonical release files, installer copies, and local distribution copies match. The merged image contains the application at `0x10000`, byte-identical to the OTA image. The versioned USB manifest references the merged image at offset `0`, with ESP32 and Improv settings retained. The versioned descriptor references the OTA image and its correct checksum. Its GitHub tag URL is a future publication target, not an already-live mirror.

Existing public manifest/descriptor pointers remain v1.5.3. No published binaries, tags, rollback feeds, or website files were changed. The remote default branch remains the published v1.5.3 commit and has no v1.5.4 tag.

## Coverage limits and publication gate

- Physical discovery covered one H2D; other model mappings and multiple results were tested with host fixtures, not several physical printers.
- Fresh USB erase/installation, hotspot recovery, and a complete physical MQTT print/motor cycle were not repeated in this round. The owner has now configured printer authentication; the device was idle during installation. A configured MQTT session is not yet proven stable.
- No overnight soak was performed.
- Final bounded-fix acceptance now passes as recorded above; clean USB recovery, a full physical print/motor cycle, other physical printer models and overnight stability remain separate unperformed gates. Owner must review the candidate and choose whether to publish. After approval, publish immutable files first, verify their actual GitHub/site bytes and CORS behavior, then promote public pointers and recheck `/flasher`, `/flasher/`, and legacy `install.html` paths. Do not overwrite earlier releases.
