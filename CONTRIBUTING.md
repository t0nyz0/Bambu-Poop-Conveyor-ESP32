# Contributing to Bambu Poop Conveyor

Thanks for helping improve the project. The firmware is a native PlatformIO project, so a clean checkout contains everything needed to download its framework, libraries, and ESP32 toolchain automatically.

## Before you begin

You will need:

- Git
- Python 3
- Either the PlatformIO extension for Visual Studio Code or [PlatformIO Core](https://docs.platformio.org/en/stable/core/installation/)
- A data-capable USB cable when uploading to physical hardware

Clone the repository and open its root directory—the directory containing `platformio.ini`.

## Build the firmware

From a PlatformIO terminal:

```console
pio run
```

PlatformIO downloads the pinned ESP32 platform and library dependencies on the first build. The OTA application image is written to:

```text
.pio/build/esp32dev/firmware.bin
```

The GitHub **Firmware Build** workflow runs the same compilation for every pull request and every change to the public branch.

## Upload to an ESP32

Connect the board over USB, then run:

```console
pio run --target upload
```

To view boot and diagnostic output at the configured 115200 baud rate:

```console
pio device monitor
```

Uploading firmware can restart the conveyor controller. Disconnect the motor or make the mechanism safe before developing against physical hardware.

## Work on the web interface

The editable interface is `web/index.html`. Preview it with mock device data:

```console
python scripts/mock_ui_server.py
```

Then open <http://127.0.0.1:8765>.

After editing the interface, regenerate the compressed header embedded in the firmware:

```console
python scripts/generate_ui.py
```

Commit both `web/index.html` and the resulting `Bambu-Poop-Conveyor/generated_ui.h`. Continuous integration fails when those files are out of sync.

## Hardware-sensitive changes

The motor and status-light sequence is intentionally conservative because timing and state transitions affect the physical build. Changes involving motor control, delays, PWM, GPIO assignments, MQTT trigger ordering, or LED behavior should include real-device testing and should preserve existing behavior unless the change is deliberate and documented.

Never commit Wi-Fi passwords, printer access codes, printer serial numbers, IP addresses, or other personal configuration.

## Before opening a pull request

- Run `python scripts/generate_ui.py` after web-interface changes.
- Run `pio run` and confirm the firmware builds successfully.
- Exercise affected controls with `scripts/mock_ui_server.py` when changing the interface.
- Describe any physical ESP32, printer, motor, sensor, or LED testing performed.
- Keep unrelated formatting or refactoring out of hardware-timing changes.

The workflow artifact is an application-only OTA image for testing. Public USB installers, merged recovery images, website manifests, and releases remain maintainer-controlled.
