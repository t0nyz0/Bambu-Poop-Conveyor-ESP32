# v1.5.0 release QA

Last run: 2026-08-25 against v1.5.0 Beta 17 and the final v1.5.0 release candidate on the local canary ESP32.

## v1.4.2 compatibility audit

| Area | Result | Evidence |
| --- | --- | --- |
| GPIO assignments | Pass | Motor pins 23/21/15, LEDs 19/18/4, and motion sensor 22 are unchanged. |
| Motor wait/run/cooldown state machine | Pass | The original transitions remain in `loop()`; only the selected rule timing is copied into active timing variables before a cycle begins. |
| Physical LED sequence | Pass | Waiting still flashes yellow every 500 ms, running still changes yellow to red, and motor stop still restores green. |
| Saved settings | Pass | The original `my-config` Preferences namespace and keys remain in use. |
| Trigger migration | Pass | Stage 14 remains enabled; stage 4 and substage 4 follow the saved v1.4.2 `onlyRunAtStart` value. Substage 4 retains its additional 75-second wait. |
| MQTT parsing | Pass | Existing `stg_cur` and `mc_print_sub_stage` parsing remains, with newer `_id`, `gcode_state`, and `print_type` fields added. |
| Legacy HTTP integrations | Pass | `/run` and `/status` responded on the canary; legacy UI paths route into the new control center. |
| Wi-Fi failure behavior | Intentional improvement | Instead of rebooting forever after failed station attempts, the ESP32 enters the existing setup access point. |

## Canary results

| Test | Result |
| --- | --- |
| PlatformIO release build | Pass — final OTA is 1,181,840 bytes, using 90.1% of the application partition; static RAM is 58,148 bytes. |
| OTA Beta 16 → Beta 17 | Pass — upload completed, the scheduled reboot completed, and a new boot ID plus the Beta 17 display version were verified. |
| Exact final v1.5.0 OTA | Pass — the final OTA returned an upload acknowledgement, rebooted with a new boot ID, reported `1.5.0` without a beta suffix, and preserved settings plus trigger rules. |
| Exact final manual cycle | Pass — Waiting began immediately with yellow flashing, Running began after the saved 5-second wait with red on, the motor stopped after the saved 2-second run, green returned during Cooldown, and the cooldown-only override restored Idle. |
| Wi-Fi and MQTT reconnect | Pass — Wi-Fi, MQTT, and live `RUNNING` printer state returned after reboot. |
| Manual motor cycle | Pass — the canary waited 5 seconds, ran for 2 seconds, and retained the established waiting/running/idle LED sequence. |
| Cooldown override | Pass — active cooldown cleared and motor returned to Idle without interrupting an active run. |
| Legacy manual route | Pass — `/run` entered Waiting with green off/yellow on; `/api/motor/stop` safely cancelled it before motor start. |
| API status/config/triggers/catalog/logs | Pass — HTTP 200, valid JSON, and no stored password or access-code values returned. |
| UI navigation | Pass — Overview, Triggers, Settings, Logs, and Update rendered with no browser warnings or errors. |
| Responsive layout | Pass — desktop and mobile previews have no horizontal overflow; trigger toggles remain inside their tracks. |
| Public/beta isolation | Pass — public OTA remains v1.4.2 while Beta 17 is published only under `/flasher-beta`. |
| Public installer redesign | Pass locally — the staged v1.5.0 page matches the device UI, retains the existing AdSense placement, distinguishes USB from OTA, documents the setup-hotspot fallback with the Wi-Fi screenshot, and has no mobile horizontal overflow. It has not been deployed. |

## Required public release artifacts

| File | Purpose | Required verification |
| --- | --- | --- |
| `Bambu-Poop-Conveyor-v1.5.0-merged.bin` | Complete USB/web-installer and recovery image. Contains the bootloader, partition table, boot application, and firmware application at their correct flash offsets. | Fresh-device installation through the HTTPS installer, followed by Wi-Fi onboarding and a successful boot. |
| `Bambu-Poop-Conveyor-v1.5.0-ota.bin` | Application-only image for the ESP32 Update tab and one-click network updates. | Upgrade an existing v1.4.2 device, reconnect, and verify the reported v1.5.0 version and preserved settings. |
| `SHA256SUMS.txt` | Integrity hashes for both firmware binaries. | Compare every hosted copy on t0nyz.com and GitHub with the locally generated hashes before promotion. |

The USB installer manifest must reference the merged image at offset `0x0`. The public and beta OTA manifests must reference only the OTA image. Both binaries and the checksum file must be attached to the GitHub release.

## Residual hardware validation

- Complete the requested soak period on Beta 17, including at least one real automatic stage-14 trigger.
- Run one fresh-board USB install through the HTTPS installer and verify Improv Wi-Fi onboarding returns the local device address.
- On a device with no usable saved Wi-Fi, verify the `BambuConveyor` setup hotspot accepts password `12345678`, redirects to the configuration UI at `192.168.4.1`, saves credentials, reboots, and reconnects in station mode.
- Exercise motion-sensor mode on hardware if it is considered a release-blocking platform.
- Retain the existing v1.4.2 website binaries and GitHub release after promotion so a known-good USB recovery image remains available if a field issue is discovered.
