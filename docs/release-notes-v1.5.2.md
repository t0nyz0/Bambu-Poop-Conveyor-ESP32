# v1.5.2

Promotes the tested v1.5.2 Beta 2 changes to the public channel:

- Open Settings automatically when Wi-Fi or MQTT printer setup is incomplete.
  Configured printers and motion-only setups keep their normal Overview landing.
- Stop offering an older beta after it has been superseded by a public release.
  The beta card shows **No newer beta available** without an install button.
- Keep Developer Site and GitHub mirror downloads compatible with the existing
  settings-preserving update workflow.

Motor timing, MQTT behavior, indicators, saved settings, serial Wi-Fi provisioning,
and upload/reboot behavior are unchanged from the established v1.5.1 behavior.

## Installing

- Working device: use its **Update** screen and install public v1.5.2 to retain
  settings, or upload `Bambu-Poop-Conveyor-v1.5.2-ota.bin` there manually.
- New/recovery device: use [the public installer](https://t0nyz.com/flasher) or
  flash `Bambu-Poop-Conveyor-v1.5.2-merged.bin` at offset `0x0` over USB.
  A clean USB install may erase saved configuration.
- Check `SHA256SUMS.txt` when downloading files manually. The OTA and full USB
  images are different files and are not interchangeable.
- Original v1.4.2 recovery files remain available. Older stable and beta artifacts
  remain archived, unchanged.

## Verification

See the [release QA record](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/blob/Bambu-Conveyor-ESP32/docs/release-qa-v1.5.2.md)
for automated tests, actual ESP32 OTA acceptance, installer paths, mirror checks,
and explicit limits on fresh USB, physical hotspot, printer, and soak coverage.

<details>
<summary>Update-request privacy</summary>

Existing Developer Site Update-screen requests include their source and installed
version for aggregate usage statistics. These are self-reported values, not
authenticated identity, installation success, or unique-device counts. No extra
request, heartbeat, device identifier, credentials, local address, or printer
details are added. Browser privacy preferences are respected; GitHub URLs are
unchanged, and reporting failures cannot block downloads.

</details>
