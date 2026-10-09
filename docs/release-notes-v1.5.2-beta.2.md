# v1.5.2 Beta 2

Archived test build for the v1.5.2 setup and firmware-update flows. This prerelease has been superseded by the official v1.5.2 release; use the public release for normal installations.

- Missing Wi-Fi or MQTT printer details open Settings automatically. Configured devices and motion-only setups retain their Overview landing page.
- Public, beta, and recovery files remain separate, with Developer Site and GitHub download options.
- Motor timing, MQTT behavior, status lights, saved settings, USB provisioning, and upload/reboot behavior are unchanged.

## Files and verification

Use the application-only OTA image for updates from a working device. The merged USB image is for fresh installation or recovery and can erase saved configuration. Check the supplied SHA256SUMS.txt before installing a manually downloaded file.

The published build passed automated checks and physical test-device acceptance. Detailed test evidence and coverage limits are recorded in [the v1.5.2 QA record](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/blob/Bambu-Conveyor-ESP32/docs/release-qa-v1.5.2.md).
