# Bambu Poop Conveyor for ESP32 
:arrow_right:	:arrow_right:	:poop: :arrow_right: :arrow_right: :poop: :arrow_right: :arrow_right:

> [!TIP] 
> Be sure to check out the new web installer. https://t0nyz.com/flasher/index.html

### For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor

## Overview 

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
- Listens for printer status changes (Change Filament status and Clean nozzle status) and automatically activates the conveyor when needed.
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
- Click the **"Install"** button and follow the on-screen instructions.
---

### **Method 2: Manual Installation**

#### **1. Download and Install ESPTool**  
   - Install `esptool` using pip:  
     ```sh
     pip install esptool
     ```
   - Alternatively, download the precompiled ESPTool from the official Espressif GitHub.

#### **2. Download the Firmware File**  
   - Download the latest firmware from the **[GitHub Releases](https://github.com/t0nyz0/Bambu-Poop-Conveyor-ESP32/releases/latest)**.  

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
     esptool.py --chip esp32 --port /dev/tty.usbserial-1 --baud 460800 write_flash \
       0x0 Bambu-Poop-Conveyor.v1.3.3-final.bin
     ```  

#### **6. Verify Flashing and Restart**  
   - Once flashing completes, restart your ESP32 by unplugging/replugging it or pressing the **EN** or **RST** button.  

Your ESP32 should now be running the updated firmware.

## Configuring via Web Interface

Once flashed, the ESP32 starts in AP Mode:

1. Connect to the **"BambuConveyor"** WiFi network.
2. Open a browser and go to **[192.168.4.1/config](http://192.168.4.1/config)**.
3. Enter your WiFi and MQTT credentials.
4. Click **Save**. The ESP32 will reboot and connect to your WiFi.

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

The application hosts a web server to provide manual control and configuration. Access the following URLs for different functionalities:

- **Root URL:** Opens Configuration page (`/`)
- **Control URL:** Manual motor control page (`/control`)
- **Config URL:** Configuration page to update settings (`/config`) 
- **Logs URL:** Log history page (`/logs`)
- **Manual Run URL:** Opening this URL runs the motor manually (`/run`)

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

### Home Assistant Settings

- Action: Run motor manually
- Sensor: States if motor is running 

Example yaml
```
rest_command:
  bambu_run_motor:
    url: "http://11.0.1.54/run"
    method: POST

sensor:
  - platform: rest
    name: "Bambu Motor Status"
    resource: "http://11.0.1.54/status"
    value_template: "{{ value_json.motor_running }}"
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor
