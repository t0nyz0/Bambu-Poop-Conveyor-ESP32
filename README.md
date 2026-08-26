# Bambu Poop Conveyor for ESP32

<p align="center">
  <img src="assets/bambu-conveyor-logo.svg" width="112" alt="Bambu Poop Conveyor logo">
</p>

:arrow_right: :arrow_right: :poop: :arrow_right: :arrow_right: :poop: :arrow_right: :arrow_right:

> [!TIP] 
> The public installer is at https://t0nyz.com/flasher. Pre-release builds, when available, remain isolated at https://t0nyz.com/flasher-beta.

## What's new in v1.5.0

Version 1.5.0 introduces a complete, responsive control center while deliberately preserving the proven motor and LED sequence from v1.4.2.

- Live Wi-Fi, printer, MQTT, conveyor, and physical LED status
- Manual run and emergency stop controls
- Live wait/run/cooldown countdowns with a dedicated, safe cooldown override
- Add/remove rules from the full known printer-stage catalog, print lifecycle states, or advanced numeric substages
- Independent wait, run, cooldown, and once-per-event/once-per-print behavior for every rule
- Safer in-device firmware updates with real upload progress, delayed reboot, reconnect, and version verification
- Side-by-side public and beta update discovery, with t0nyz.com as the default download source and an optional GitHub mirror when available
- A continuous USB web-installer flow: flash, configure Wi-Fi, then open the ESP32 without losing the installer page
- Safer settings APIs that never send stored Wi-Fi passwords or printer access codes back to the browser
- Friendly network identity: `BambuConveyor-ESP32` and `bambuconveyor-esp32.local`
- Expanded first-party Home Assistant REST controls

### Web control center

![Bambu Poop Conveyor v1.5.0 control center](docs/images/webui-desktop.png)

### For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor

## Overview 
> [!NOTE]
> 5/9/2025 - Fixed major bug with Bambus latest firmware updates. Also, now works with H2D!

The Bambu Conveyor is an application designed to manage the waste output of a [Bambu Labs printer](https://bambulab.com/en/x1). It utilizes the MQTT protocol (or Motion Detection) to monitor the printer's status and control a motor that moves waste material away from the printing area. 

## Required parts used for this build:

- Breakout board for ESP32: https://amzn.to/4dyjsx0
- ESP32 board: https://amzn.to/4fBjh5L
- 12 Volt power supply: https://amzn.to/3AfIm6a
- Motor Controller: https://amzn.to/3yBPqcM
- 12V 10RPM Motor: https://amzn.to/3M24VOd
- Resistors (I use 470Ω - you need 3 from this kit): https://amzn.to/4cqCi8e
- Wires: https://amzn.to/46EAtn3 
- LED's sourced from this kit: https://amzn.to/4dH5Dw7

## Optional parts:
- Power connector: https://amzn.to/3T4xRsS
- I use these bearings on my conveyor for smoother action: https://amzn.to/4hjW0WD
- Motion sensor (For Motion Sensor mode): https://amzn.to/4gtN4gd
  

# Conveyor Makerworld files

- **Conveyor:** https://makerworld.com/en/models/148083#profileId-161573
- **ESP32 Housing:** https://makerworld.com/en/models/1071359#profileId-1061316
- **Conveyor Extension:** https://makerworld.com/en/models/249714#profileId-359905


### Two Modes of Operation: MQTT or Motion Detection

The **Bambu Poop Conveyor** supports two methods for triggering the conveyor, depending on your printer model and preference.

#### 1. MQTT Mode (Recommended for X1C) (Default setting)
- Best suited for **X1C printers** due to their more powerful CPU, which handles MQTT updates more efficiently.
- Listens for printer status changes and automatically activates the conveyor using your saved event rules. The defaults retain nozzle cleaning and filament-change behavior, and v1.5.0 can add any known printer stage or print lifecycle state.
- Requires a stable network connection and correct MQTT setup.

#### 2. IR Motion Detection Mode (Better for P1 & A1 Series)
- Ideal for **P1 and A1 series printers**, where MQTT performance can be inconsistent due to CPU constraints.
- Uses the **HiLetgo AM312 PIR sensor** to detect movement and trigger the conveyor.
- Works independently of network conditions, making it a more reliable option for some setups.


# Bambu Poop Conveyor - Setup & Installation Guide  

## Setup  

## Flashing the ESP32

To install the firmware, use one of the following methods:

### **Method 1: Web Installer (Easiest Method)**
- Open **Google Chrome** or **Microsoft Edge**.
- Go to **[Bambu ESP32 Installer](https://t0nyz.com/flasher)**.
- Click **Connect ESP32 & install** and follow the on-screen instructions.
- Keep the installer tab open. It remains loaded while the ESP32 flashes, restarts, joins Wi-Fi, and reports its control-center address.

> [!NOTE]
> The public installer must use HTTPS because browsers require a secure page for USB/Web Serial access. The ESP32 control center itself uses local HTTP; the two pages have different jobs.
---

### **Method 2: Manual Installation**

#### **1. Download and Install ESPTool**  
   - Install `esptool` using pip:  
     ```sh
     pip install esptool
     ```
   - Alternatively, download the precompiled ESPTool from the official Espressif GitHub.

#### **2. Download the Firmware File**  
   - Download `Bambu-Poop-Conveyor-v1.5.0-merged.bin` from the **[GitHub Releases](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/latest)** page.

#### **3. Connect Your ESP32**  
   - Plug your ESP32 into your computer using a USB cable.  
   - Ensure drivers for the USB-to-serial adapter are installed (CH340, CP210x, etc.).  

#### **4. Find the Serial Port**  
   - On **macOS/Linux**, run:  
     ```sh
     ls /dev/tty.*
     ```  
     Look for something like `/dev/tty.usbserial-1`.  
   - On **Windows**, open **Device Manager** and check under **Ports (COM & LPT)**.  

#### **5. Flash the Firmware**  
   - Replace `<PORT>` with your ESP32’s serial port (e.g., `/dev/tty.usbserial-1`):  
     ```sh
     esptool --chip esp32 --port /dev/tty.usbserial-1 --baud 460800 write-flash \
       0x0 Bambu-Poop-Conveyor-v1.5.0-merged.bin
     ```  

#### **6. Verify Flashing and Restart**  
   - Once flashing completes, restart your ESP32 by unplugging/replugging it or pressing the **EN** or **RST** button.  

Your ESP32 should now be running the updated firmware.

## Configuring via Web Interface

With the USB web installer, Wi-Fi can be configured in the same installation dialog. The installer then provides a link to the new device.

If serial Wi-Fi setup is skipped, the ESP32 starts in AP Mode:

1. Connect to the **"BambuConveyor"** WiFi network using password **`12345678`**.
2. Open a browser and go to **[192.168.4.1](http://192.168.4.1)**.
3. Enter your WiFi and MQTT credentials.
4. Click **Save**. The ESP32 will reboot and connect to your WiFi.

On most networks it can then be reached at **[http://bambuconveyor-esp32.local](http://bambuconveyor-esp32.local)**. Routers that honor DHCP hostnames should list it as **BambuConveyor-ESP32** instead of a generic `esp32-xxxxxx` name. A router may retain its old cached label until the lease or device entry refreshes.

For troubleshooting, open an issue on GitHub or check the discussions tab.

## GPIO Pins

The application uses the following GPIO pins for motor and LED control:

```js copy
const int greenLight = 19;
const int yellowLight = 18;
const int redLight = 4;

int motor1Pin1 = 23;
int motor1Pin2 = 21;
int enable1Pin = 15;

const int motionSensorPin = 22; 
```

## Usage

### Web Server

The application hosts a responsive control center for status, manual control, settings, event rules, and firmware updates:

- **Control center:** `/`
- **Health check:** `/api/health`
- **Detailed status:** `/api/status`
- **Manual run:** `POST /api/motor/run` (legacy `/run` remains supported)
- **Emergency stop:** `POST /api/motor/stop`
- **Clear cooldown:** `POST /api/motor/clear-cooldown`
- **Settings:** `GET` or `POST /api/config`
- **Trigger rules:** `GET` or `POST /api/triggers`
- **Trigger catalog:** `GET /api/trigger-catalog`
- **Logs:** `/api/logs`

The **Update** tab checks two independent website channels:

- Public: `https://t0nyz.com/flasher/latest.json`
- Beta: `https://t0nyz.com/flasher-beta/latest.json`

Each channel manifest can provide both a primary `bin` URL and an optional `githubBin` mirror. A single global **Firmware source** selector defaults to **Developer Site (t0nyz.com)** and can switch all published downloads to GitHub; a channel's install button is disabled if its mirror is not available yet. Versioned mirror binaries are stored under `firmware/releases/` so the raw GitHub URL supports browser-based one-click installation; GitHub Release assets remain available for ordinary manual downloads.

The public v1.5.0 USB installer is available at `https://t0nyz.com/flasher`. Pre-release builds remain isolated at `https://t0nyz.com/flasher-beta`, and the previous v1.4.2 files remain available as known-good recovery artifacts.

### FAQ / Troubleshooting

*What do the flashing lights mean when its first turned on?*
- Flashing yellow only = Connecting to WiFi
- Solid Green = We are connected to Wifi and MQTT printer
- Red Light on bootup = No Wifi / No MQTT (Solid red also when conveyor is running)
- Green light / Yellow flashing = Wifi connected / Attempting to connect to printer
- Green light / Yellow solid = Wifi conncted / Issue connecting to printer via MQTT / Will reattempt connection after 5 seconds

*The ESP32 doesnt connect to the printer*
- Double check that your printer is setup with Access Code and LAN only mode is **OFF** [See Bambu Wiki](https://wiki.bambulab.com/en/knowledge-sharing/enable-lan-mode)
- Double check your SN matches the settings you put in
- Make sure your printer has good Wifi signal
- Make sure the ESP32 has good Wifi signal
- Reach out to me if you still have issues

### Home Assistant

v1.5.0 keeps Home Assistant support in this firmware—no alternate firmware is required. Replace `192.168.1.116` below with the ESP32's reserved IP address.

```yaml
rest_command:
  bambu_run_motor:
    url: "http://192.168.1.116/api/motor/run"
    method: POST
  bambu_stop_motor:
    url: "http://192.168.1.116/api/motor/stop"
    method: POST

sensor:
  - platform: rest
    name: "Bambu Conveyor State"
    resource: "http://192.168.1.116/api/status"
    value_template: "{{ value_json.motor.state }}"
    scan_interval: 5
    json_attributes_path: "$.printer"
    json_attributes:
      - stage
      - stageDescription
      - gcodeState

binary_sensor:
  - platform: rest
    name: "Bambu Conveyor Running"
    resource: "http://192.168.1.116/api/status"
    value_template: "{{ value_json.motor.running }}"
    device_class: running
    scan_interval: 5
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor
