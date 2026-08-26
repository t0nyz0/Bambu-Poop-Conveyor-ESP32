# Firmware mirrors

This directory contains versioned copies of published ESP32 firmware so the in-device updater can use `raw.githubusercontent.com` as an optional browser-compatible mirror.

- `*-ota.bin` is for updates from the ESP32 web interface.
- `*-merged.bin` is the complete image for a new USB installation.
- t0nyz.com remains the default update source.
- The global firmware-source selector can switch to GitHub; any channel without a working `githubBin` URL is disabled while that source is selected.

Do not replace an existing release file. Add a new versioned directory and publish its checksum instead.
