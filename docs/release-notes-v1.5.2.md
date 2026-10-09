# v1.5.2

Promotes the tested v1.5.2 Beta 2 changes to the public channel:

- Open Settings automatically when Wi-Fi or MQTT printer setup is incomplete.
  Configured printers and motion-only setups keep their normal Overview landing.
- Stop offering an older beta after it has been superseded by a public release.
  The beta card shows **No newer beta available** without an install button.
- Explicitly label existing Developer Site Update-screen requests and include the
  installed version. This is anonymous, self-reported context—not authenticated
  device identity, an install-success assertion, or a unique-device count.
- Preserve unchanged GitHub mirror URLs and browser privacy preferences. No extra
  telemetry request, heartbeat, device identifier, credential, local address, or
  printer detail is sent. Analytics collection failures cannot block downloads.

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

See `docs/release-qa-v1.5.2.md` for automated tests, actual ESP32 OTA acceptance,
analytics/database/dashboard proof, installer paths, mirror checks, and explicit
limits on fresh USB, physical hotspot, printer, and long-running soak coverage.
