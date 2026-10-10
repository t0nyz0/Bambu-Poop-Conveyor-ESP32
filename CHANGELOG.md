# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

No unreleased changes are recorded.

## [1.5.4] - 2026-10-10

### Added

- Bounded local printer discovery with prominent found-printer feedback and manual selection before saving.
- Separate Network and Printer readiness sections, Save Wi-Fi, and Save & check printer.
- Explicit local Show/Hide for saved credentials; routine settings responses still omit them. Use the unauthenticated device interface only on a trusted network.
- Configured printer names on Overview and distinct, stable MQTT client names per conveyor.

### Fixed

- First-time search waits for live Wi-Fi and recovers from temporary startup errors without overwriting entered details.
- Acknowledged saves retain saved/masked credential feedback while reconnecting; connection success requires a fresh check.
- Failed status refreshes retain neutral last-known readings instead of false setup warnings or stale live indicators.
- Draft loss across tab changes, overlapping settings/update operations, partially applied invalid settings, and stale interrupted-upload locks.
- Empty browser connections delaying queued requests, duplicate Logs reads, and oversized firmware downloads.

### Compatibility

- Motor timing, triggers, GPIO assignments, MQTT credentials/topics, and Wi-Fi provisioning remain unchanged.
- Existing saved configurations remain compatible; optional printer display metadata uses separate storage.
- Original v1.5.1 previous-stable and v1.4.2 legacy recovery files remain available; older beta artifacts stay archived.

## [1.5.3] - 2026-10-09

### Changed

- Previous-stable recovery now offers original v1.5.1 with accurate selected-version messages.
- A separate previous-stable feed preserves the original v1.4.2 recovery feed for older firmware.

### Compatibility

- Retains v1.5.2 setup routing and beta retirement behavior.
- Saved settings, triggers, motor timing, Wi-Fi provisioning, and USB offsets remain unchanged.

## [1.5.2] - 2026-10-09

### Fixed

- Incomplete Wi-Fi or MQTT printer setup opens Settings automatically; configured and motion-only devices keep Overview.
- Superseded beta releases show No newer beta available without an install button.

### Compatibility

- Developer Site and GitHub mirror downloads retain the settings-preserving update workflow.
- Motor timing, MQTT behavior, indicators, provisioning, and upload/reboot behavior remain unchanged from v1.5.1.

## [1.5.1] - 2026-09-11

### Fixed

- Green now reflects both Wi-Fi and printer MQTT readiness; recovery clears stale yellow/red states.
- Reconnects preserve active motor indicators and reset the disconnect warning grace period.
- Legacy `/logs`, `/config`, and `/update` URLs open their intended control-center tabs.
- Release packaging reads and validates the firmware version instead of hard-coding filenames.

### Compatibility

- Existing settings and trigger rules survive OTA updates.
- Motor timing, GPIO assignments, trigger evaluation, PWM, Wi-Fi onboarding, and the MQTT reconnect interval remain unchanged.
- Checksum-verified v1.4.2 OTA rollback and USB recovery remain available.

## [1.5.0] - 2026-08-25

### Added
- Responsive Overview, Triggers, Settings, Logs, and Update screens.
- Configurable printer-stage, substage, and print-state trigger rules.
- Live printer, MQTT, motor, physical LED, memory, Wi-Fi, and CPU status.
- Wait/run/cooldown countdowns, emergency stop, and cooldown override.
- One-click OTA downloads with separate public and beta channels.
- Improv Serial Wi-Fi onboarding, DHCP hostname, and mDNS discovery.
- First-party Home Assistant REST controls and status examples.

### Changed
- Firmware uploads acknowledge completion before the ESP32 schedules its reboot.
- Failed Wi-Fi station connections fall back to setup mode instead of rebooting forever.
- Stored passwords and printer access codes are no longer returned to the browser.
- The proven v1.4.2 motor and LED transition sequence remains in the original loop.

### Compatibility
- Existing v1.4.2 preferences migrate in place during OTA.
- Legacy `/run`, `/status`, `/config`, `/control`, `/logs`, and `/update` URLs remain available.
- The v1.4.2 `onlyRunAtStart` choice becomes the initial set of trigger-rule toggles.

## [1.4.2] - 2025-01-XX

### Fixed
- **Firmware Update Page**: Fixed JavaScript syntax errors that prevented the "Latest Version" check from working on the firmware update page
- **Version Checking**: Improved reliability of the automatic version check when accessing the `/update` page
- **JavaScript Compatibility**: Simplified and fixed JavaScript code for better browser compatibility

### Technical Changes
- Refactored JavaScript in `handleUpdatePage()` to use more compatible function syntax
- Removed problematic console logging that could cause execution failures
- Added proper error handling for version fetch requests

---

## [1.4.1] - 2025-01-XX

### Fixed
- Initial attempt to fix firmware version checking JavaScript

---

## [1.4.0] - 2025-01-XX

### Features
- Stable release

---

## Understanding Firmware Files

### Upgrade File (for OTA Updates)

**Current File Name Format:** `Bambu-Poop-Conveyor-vX.X.X-ota.bin`

Older releases used `Bambu-Poop-Conveyor.vX.X.X-update.ino.bin`; those published files retain their original names.

#### What it is:
- Contains **only the application code** (your `.ino` sketch compiled to binary)
- Used for **Over-The-Air (OTA) updates** via the web interface
- Smaller file size (~1.1 MB)
- Updates only the application partition, leaving bootloader and partition table intact

#### When to use:
- When updating an already-flashed ESP32 through the web interface (`/update` page)
- When your device checks `t0nyz.com` for the latest version
- For routine firmware updates on devices already in use

#### How it works:
- The ESP32's `Update` library writes this file to the application partition only
- The device reboots and runs the new application code
- All your settings (WiFi, MQTT credentials, etc.) are preserved

---

### Full/Final File (for Initial Flashing)

**Current File Name Format:** `Bambu-Poop-Conveyor-vX.X.X-merged.bin`

Older releases used `Bambu-Poop-Conveyor.vX.X.X-final.bin`; those published files retain their original names.

#### What it is:
- **Complete firmware image** containing:
  - Bootloader (starts at `0x1000`)
  - Partition table (starts at `0x8000`)
  - Application code (starts at `0x10000`)
- Larger file size (~1.2 MB)
- Used for **initial flashing** or **complete factory reset**

#### When to use:
- First time flashing a new ESP32
- When you need to completely reset the device
- When using `esptool.py` to flash via USB/serial connection
- If the device is completely bricked and needs a full reflash

#### How it works:
- Flash the merged image at offset `0x0`; it contains the bootloader, partition table, and application at their required offsets.
- Never upload the merged image to the device's Update screen.
- A clean USB installation with an erase step removes saved settings. Writing an image without erasing can retain NVS/Preferences data; do not assume it performs a factory reset.

---

### Quick Reference Table

| Scenario | Use This File | Method |
|:---------|:--------------|:-------|
| First time setup | `-merged.bin` | USB installer or `esptool` at offset `0x0` |
| Routine update | `-ota.bin` | Web interface `/update` page |
| Device is working, just updating | `-ota.bin` | Web interface `/update` page |
| Device is bricked/unresponsive | `-merged.bin` | USB installer or `esptool` at offset `0x0` |
| Factory reset needed | `-merged.bin` | Clean USB installation with an explicit erase step |

---

### For Your Website

The OTA release descriptor at `t0nyz.com/flasher/latest.json` points to the **application-only OTA file**. It is separate from the USB `manifest.json`, which references the merged image at offset `0`.

The Update screen's version check requests this descriptor; a firmware download begins only when the user chooses to install. See the published descriptor for the current version, URLs, and checksum rather than copying an outdated example.

---

[1.5.4]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.4
[1.5.3]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.3
[1.5.2]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.2
[1.5.1]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.1
[1.5.0]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.0
[1.4.2]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.2
[1.4.1]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.1
[1.4.0]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.0
