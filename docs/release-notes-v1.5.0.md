# Bambu Poop Conveyor v1.5.0

## Highlights

- Rebuilt the ESP32 web interface as a responsive control center.
- Added an expandable rule editor covering all known printer stages, print lifecycle states, and optional numeric substages.
- Preserved the existing nozzle-cleaning, filament-change, and substage-4 rules and timings during migration.
- Added once-per-event and once-per-print protection to prevent repeat runs from a status that remains active.
- Reworked OTA updates to acknowledge a completed upload before rebooting, retain the browser page, and verify the device after it returns.
- Restored remote release checks and split them into independent public and beta channels hosted on t0nyz.com.
- Added Improv Serial onboarding for a continuous ESP Web Tools install and Wi-Fi setup flow.
- Added the `BambuConveyor-ESP32` DHCP hostname and `bambuconveyor-esp32.local` mDNS address.
- Added structured health, status, settings, trigger, logs, run, and emergency-stop APIs.
- Added live wait/run/cooldown countdowns and a cooldown-only override that cannot interrupt an active motor.
- Expanded Home Assistant REST examples.
- Changed failed station connections to fall back to the setup access point instead of entering a reboot loop.

## Compatibility and migration

- Existing Preferences are retained during OTA updates.
- The v1.4.2 “Only run at start of print” setting is migrated into the new trigger rules on first boot.
- Existing `/run` and `/status` Home Assistant endpoints remain available.
- The established GPIO assignments and motor/LED state-machine sequence are preserved.

## Firmware files

- `Bambu-Poop-Conveyor-v1.5.0-ota.bin` is for the Update tab on an existing device.
- `Bambu-Poop-Conveyor-v1.5.0-merged.bin` is the complete image for USB installation and recovery.
- Verify downloads with `SHA256SUMS.txt` from the release artifacts.

## Installer behavior

The public installer is an HTTPS page because Web Serial requires a secure browser context. It remains loaded while the ESP32 flashes and restarts. After flashing, Improv Serial collects Wi-Fi credentials and returns the local device URL. The device UI itself remains local HTTP.

## Upgrade guidance

- Existing devices should install the OTA image from the control center's **Update** tab so saved configuration is retained.
- New devices and recovery installations should use the merged image through the HTTPS web installer.
- The previous v1.4.2 firmware and the Beta 17 channel remain available as rollback options during post-release verification.
