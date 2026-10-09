# v1.5.3

Improves the previous-stable recovery flow while retaining v1.5.2's guided setup and responsive control center.

- The Update screen offers **v1.5.1 as previous stable** and describes the selected version accurately.
- Previous-stable recovery uses a separate feed, so existing devices keep their original v1.4.2 recovery option. The original v1.4.2 files remain available as legacy recovery on the installer.
- Saved settings, trigger rules, motor timing, Wi-Fi provisioning, and USB flash offsets are unchanged.
- No active beta remains after promotion to the public channel.

## Installing

Use a working device's **Update** screen or upload `Bambu-Poop-Conveyor-v1.5.3-ota.bin` to retain stored settings. For a fresh device or USB recovery, use [the web installer](https://t0nyz.com/flasher) or flash `Bambu-Poop-Conveyor-v1.5.3-merged.bin` at offset `0x0`. A clean USB installation can erase saved configuration.

The merged image includes the bootloader and partitions; the OTA file contains only the application. Do not upload the merged image to the device's Update screen.

See the [release QA record](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/blob/Bambu-Conveyor-ESP32/docs/release-qa-v1.5.3.md) for test evidence and coverage limits.

<details>
<summary>Update-request privacy</summary>

The Update screen retains the existing optional source/installed-version reporting introduced in v1.5.2. These are reported values, not authenticated device identity or fleet counts. No heartbeat or device identifier is added. Browser privacy signals are respected; see the README's Update-request privacy section for details.

</details>
