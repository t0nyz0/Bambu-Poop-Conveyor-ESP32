# v1.5.4 Beta 2

Printer discovery is now easier to notice and act on. This beta includes the setup and reliability improvements from [Beta 1](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/v1.5.4-beta.1).

- A prominent green **Printer found on your network** panel shows the discovered printer's name immediately, even while the search continues.
- Multiple discovered printers are clearly counted, and **Use selected printer** is highlighted.
- Finding a printer remains separate from connecting to it: missing LAN access codes stay highlighted, and saving remains blocked until required details are provided.
- A failed repeat search preserves previous results and entered settings. Manual entry remains available.
- The discovery panel adapts to narrow screens and announces results accessibly.

Use the **OTA application image** through the device's Update screen to preserve saved settings and triggers. The **merged USB image** is for fresh installation or recovery; it must not be uploaded through the device's Update screen.

Motor timing, printer-event handling, saved configuration formats, Wi-Fi provisioning, and the discovery service are unchanged from Beta 1. Stable v1.5.3 and previous-stable v1.5.1 remain unchanged.

## Beta status

Automated regression checks, desktop/mobile UI checks, and the firmware build passed. This Beta 2 package has not yet been physically installed or overnight-tested; it remains an optional prerelease.
