# v1.5.4 Beta 3

Saving printer settings now gives clearer feedback during the device's brief restart and connection check. This beta includes the setup and reliability improvements from [Beta 2](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.5.4-beta.2).

- After an acknowledged save, the LAN access code is clearly marked as saved and masked while the device reconnects. It no longer briefly looks missing or invalid.
- Saving, restarting, and checking the connection have distinct messages. Printer connection success is shown only after a fresh MQTT connection check.
- Unconfirmed saves keep the entered code available for retry. A saved code and a successful printer connection remain separate outcomes.
- Wi-Fi saves and the main Save settings action also preserve accurate saved-credential feedback during reconnection.

Use the **OTA application image** through the device's Update screen to preserve saved settings and triggers. The **merged USB image** is for fresh installation or recovery; it must not be uploaded through the device's Update screen.

Motor timing, printer-event handling, saved configuration formats, Wi-Fi provisioning, and the discovery service are unchanged from Beta 2. Stable v1.5.3 and previous-stable v1.5.1 remain unchanged.

## Beta status

Automated save/reconnect regression checks, simulated browser-flow checks, and the firmware build passed. This Beta 3 package has not yet been physically installed or overnight-tested; it remains an optional prerelease.
