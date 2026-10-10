# v1.5.4 Beta 4

Printer search now recovers automatically when Settings is opened immediately after Wi-Fi setup, while the ESP32 is still starting or restarting. This beta includes the setup and reliability improvements from [Beta 3](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.5.4-beta.3).

- Automatic printer search waits for a live Wi-Fi connection instead of starting from saved network details alone.
- Temporary startup or restart errors retry automatically, with clear waiting messages. You no longer need to refresh the page to recover from this startup timing issue.
- A temporarily interrupted search resumes checking the current search; it does not repeatedly launch new scans.
- Typed setup details and previously found printers are preserved during retries. Search does not select a printer or save settings for you.
- Retries are bounded. Manual entry and the Find printer button remain available if startup or discovery cannot complete.

Use the **OTA application image** through the device's Update screen to preserve saved settings and triggers. The **merged USB image** is for fresh installation or recovery; it must not be uploaded through the device's Update screen.

Motor timing, printer-event handling, saved configuration formats, Wi-Fi provisioning, and the discovery service are unchanged from Beta 3. Stable v1.5.3 and previous-stable v1.5.1 remain unchanged.

## Beta status

Automated startup/retry regression checks, a simulated browser startup/reconnect flow, and the firmware build passed. This Beta 4 package has not yet been physically installed or overnight-tested; it remains an optional prerelease.
