# v1.5.4 Beta 1

Easier printer setup, clearer connection status, and improved device-page responsiveness.

## Setup improvements

- Find Bambu printers on the conveyor’s Wi-Fi network and fill their IP address, serial number, and model. Manual entry remains available; the printer’s LAN access code must still be entered.
- Separate Network and Printer sections show connection status and highlight missing settings.
- **Save Wi-Fi** updates network settings separately. **Save & check printer** saves printer details and checks the MQTT connection.
- Show/Hide buttons let you view saved Wi-Fi passwords and printer access codes. Use this local, unauthenticated interface only on a trusted network.
- Incomplete printer setup highlights Settings and shows guidance on Overview.

## Fixes and reliability

- Overview displays the configured printer’s discovered name.
- Loading and unavailable status are distinguished from a disconnected printer. Retained readings are marked **Last known** until refreshed.
- Connected printers have a steady green badge; background refresh no longer flashes the Refresh button.
- Each conveyor uses a separate MQTT client name to avoid shared-name connection conflicts.
- Empty browser connections release sooner when other device-page requests are waiting.
- Unsaved edits survive tab changes. Invalid settings are rejected before changing live values, conflicting saves/installations are blocked, and interrupted uploads release their lock.
- Repeated Logs requests are combined, and oversized firmware downloads are stopped early.

## Installation and compatibility

Use the **OTA application image** for an existing device to preserve saved settings and triggers. Use the **merged USB image** for fresh installation or recovery; never upload it through the device’s Update screen.

Motor timing, printer-event handling, existing storage formats, and Wi-Fi provisioning remain unchanged.

## Beta status

Automated checks and test-device OTA installation passed. Full print/motor-cycle, fresh USB installation, and overnight testing are not yet complete. This is an optional prerelease; the current stable release remains unchanged.
