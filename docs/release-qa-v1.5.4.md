# v1.5.4 release QA — October 10, 2026

## Released package

The owner approved stable promotion after testing v1.5.4 Beta 4. Stable source
differs from that immutable beta only in the display label: `1.5.4` replaces
`1.5.4 Beta 4`. The web source, generated UI, motor/MQTT logic, configuration
storage, provisioning, and partitions are unchanged by promotion.

At publication, the official `Release-v1.5.4` tag and default branch matched
release commit `e41b0a7ce54f1fb04d8c8e56b2e65160f6429d56`. The GitHub release is public,
non-prerelease, and latest; its title and body exactly match the approved stable
release notes. The rendered README identifies stable v1.5.4 and its correct files.

| Image | Bytes | SHA-256 |
| --- | ---: | --- |
| OTA application | 1,205,392 | `30ecfb071931347537a83778589172574ee4eec4b01fc6fce910e81862fba0c1` |
| Merged USB image | 1,270,928 | `4cea0f1dcdd136114bcff72b9a5d1b4be972f4ec7bdadb5a35ff369e055b3855` |

- The application fits the existing 1,310,720-byte OTA partition. Static RAM
  use is 59,764 bytes.
- Canonical, installer, and distribution copies/checksums agree. The merged
  application's bytes at `0x10000` exactly match the OTA image.
- The generated UI decompresses exactly to the web source and is present in
  the application.
- USB manifests retain ESP32, Improv, the 30-second provisioning wait, the erase
  prompt, and merged offset `0`. Product names do not repeat the version.
- v1.5.1 remains previous stable; v1.4.2 remains separate legacy recovery.
  Published beta images and tags stay archived, with no active beta offered
  after stable v1.5.4 supersedes Beta 4.

## Automated coverage

All 267 firmware regression cases passed: 139 UI/release checks and 128
startup, MQTT/indicator, discovery, settings/upload, and HTTP host scenarios.
The stable PlatformIO build and embedded-UI consistency checks also passed.

Coverage includes:

- Bounded discovery, safe result rendering, immediate found-printer feedback,
  multiple-result fixtures, retry limits, startup recovery, and preserving
  entered details. Selecting a result fills details without saving them.
- Separate section readiness and saves; required access-code validation in
  MQTT mode; motion-mode exceptions; saved-value Show/Hide; and clear
  acknowledgement, restart, and fresh connection-check states.
- Draft preservation, status single-flight and stale-response rejection,
  neutral last-known readings, quiet background refresh, and combined Logs reads.
- Atomic rejection of invalid settings, backward-compatible partial payloads,
  retained blank credentials, conflicting save/upload guards, interrupted-upload
  cleanup, and firmware-download size bounds.
- Original motor/trigger behavior, connection-indicator recovery, distinct
  per-board MQTT names, existing storage keys, legacy routes, and partition limits.
- The HTTP wrapper releases only an empty connection at least one second old
  when another client is queued; active parsing and uploads remain unchanged.

Host/browser fixtures do not demonstrate physical motor operation or uninterrupted
printer connectivity. Local sanitizer execution was unavailable because the
host runtime stalled; that was not counted as a firmware sanitizer result.

## Physical acceptance

- The final stable OTA was installed on the connected Beta 4 conveyor. A new
  boot and `1.5.4` display version were verified. Saved configuration and
  trigger fingerprints remained unchanged, Wi-Fi was connected, the motor was
  Idle, and every served control-center route matched the final UI source.
- A subsequent 20-request idle observation completed without request failure,
  sampled Wi-Fi/MQTT loss, restart, or motor activity. Minimum / median / maximum
  latency was 44 / 145 / 400 ms; free heap ranged from 106,616 to 114,056 bytes.
  These are short observations, not an overnight soak or proof of connectivity
  between samples.
- Earlier physical candidate testing discovered one H2D, verified the bounded
  search stop and repeat-start behavior, checked section readiness and saves,
  and exercised saved-value Show/Hide without logging unmasked credentials.
  Multiple printers and other model mappings were tested with fixtures.
- Earlier corrected firmware completed a five-minute, 60-request observation
  without timeout, sampled connection loss, restart, or motor activity. This
  supports the tested responsiveness fix, not a claim that every historical
  MQTT disconnect had the same cause.

## Security and compatibility limits

Routine settings responses omit credentials. Show/Hide requests a saved value
only after an explicit local action, with field/payload bounds, foreign-origin
rejection, and a no-store response. This is not authentication: use the device
interface only on a trusted LAN.

Motor timing, trigger format, MQTT credentials/topics, GPIO assignments, and
Wi-Fi provisioning remain compatible with the established firmware. Optional
printer display metadata is stored separately and ignored by older firmware.
Synchronous MQTT/TLS connection work remains inherited behavior and can still
pause main-loop work; the HTTP fix does not redesign networking.

A fresh physical USB erase/provisioning run, hotspot recovery, other physical
printer models, a full print/motor cycle, and an overnight soak were not repeated
for the label-only stable build. Package validation and the short device checks
above do not replace those longer hardware tests. No claim of weeks-long
leak-free operation or measured heap fragmentation is made.
