# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- A dedicated v1.4.2 rollback channel on the Update screen, with the same Developer Site/GitHub source selector used by public and beta releases.
- A checksum-verified v1.4.2 USB recovery option and OTA rollback download on the public installer.

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

**File Name Format:** `Bambu-Poop-Conveyor.vX.X.X-update.ino.bin`

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

**File Name Format:** `Bambu-Poop-Conveyor.vX.X.X-final.bin`

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
- `esptool.py` writes the entire flash memory from scratch
- Replaces bootloader, partition table, and application
- All previous data is erased (though settings in NVS/Preferences partition may persist)

---

### Quick Reference Table

| Scenario | Use This File | Method |
|:---------|:--------------|:-------|
| First time setup | `-final.bin` | `esptool.py` via USB |
| Routine update | `-update.ino.bin` | Web interface `/update` page |
| Device is working, just updating | `-update.ino.bin` | Web interface `/update` page |
| Device is bricked/unresponsive | `-final.bin` | `esptool.py` via USB |
| Factory reset needed | `-final.bin` | `esptool.py` via USB |

---

### For Your Website

Your `latest.json` file at `t0nyz.com/flasher/latest.json` should point to the **upgrade file**:

```json
{
  "version": "1.4.2",
  "bin": "https://t0nyz.com/flasher/Bambu-Poop-Conveyor.v1.4.2-update.ino.bin"
}
```

> **Note:** The device will download this file when users check for updates through the web interface.

---

[1.4.2]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.2
[1.4.1]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.1
[1.4.0]: https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.4.0
