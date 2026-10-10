# Firmware mirrors

This directory contains versioned copies of published ESP32 firmware so the in-device updater can use `raw.githubusercontent.com` as an optional browser-compatible mirror.

Current stable: **[v1.5.4](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/tag/Release-v1.5.4)**. Its [versioned package](releases/v1.5.4/) contains `Bambu-Poop-Conveyor-v1.5.4-ota.bin`, `Bambu-Poop-Conveyor-v1.5.4-merged.bin`, and `SHA256SUMS.txt`.

- `*-ota.bin` is for updates from the ESP32 web interface.
- `*-merged.bin` is the complete image for a new USB installation.
- t0nyz.com remains the default update source.
- The global firmware-source selector can switch to GitHub; any channel without a working `githubBin` URL is disabled while that source is selected.

Previous-stable [v1.5.1](releases/v1.5.1/) remains the rollback target. Older stable and beta packages stay archived at their original paths.

Do not replace an existing release file. Add a new versioned directory and publish its checksum instead.
