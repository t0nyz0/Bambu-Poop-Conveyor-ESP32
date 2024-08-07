# Bambu Poop Conveyor for ESP32 


## Overview

The Bambu Poop Conveyor is an application designed to manage the waste output of a Bambu X1 3D printer. It utilizes WiFi and MQTT protocols to monitor the printer's status and control a motor that moves waste material away from the printing area. 

https://github.com/user-attachments/assets/96f4e218-ed00-4c0a-9d67-1392f0b862df

https://github.com/user-attachments/assets/e5a849d5-8708-4fe7-8b11-288ce03bfcbe



# Conveyor Makerworld files

- Conveyor: https://makerworld.com/en/models/148083#profileId-161573
- Motor box (I made my own but this one works): https://makerworld.com/en/models/164413#profileId-180494
- Conveyor Extension: https://makerworld.com/en/models/249714#profileId-359905

- The custom box I used: https://makerworld.com/en/models/576315#profileId-496900

## Features

- **WiFi and MQTT Connectivity:** Connects to a local WiFi network and communicates with the printer via MQTT.
- **Motor Control:** Activates a motor to manage the printer's waste output based on the printer's status.
- **Web Server:** Hosts a web server to provide manual control and configuration of the system.
- **Stage Monitoring:** Monitors various stages of the printer to determine when to activate the motor.

## Setup

### WiFi and MQTT Configuration

Enter your WiFi and MQTT credentials in the following variables:

```cpp
// WiFi credentials
char ssid[40] = "your-ssid";
char password[40] = "your-password";

// MQTT credentials
char mqtt_server[40] = "your-mqtt-server-ip";
char mqtt_password[30] = "your-mqtt-password";
char serial_number[20] = "your-printer-serial-number";

```

### GPIO Pins

The application uses the following GPIO pins for motor and LED control:

```cpp
#define BLED 2
const int greenLight = 19;
const int redLight = 4;
const int yellowLight = 18;

int motor1Pin1 = 23;
int motor1Pin2 = 21;
int enable1Pin = 15;

```

### Motor Control Timings

Configure the motor run time and wait time:

```cpp
int motorRunTime = 15000; // Motor runs for 15 seconds by default
int motorWaitTime = 25000; // Wait 25 seconds before running the motor
int delayAfterRun = 50000; // Delay after running the motor to avoid duplicate detection

```

### PWM Configuration

Set the PWM properties for motor control:

```cpp
const int freq = 5000;
const int pwmChannel = 0;
const int resolution = 8;
int dutyCycle = 220;

```

## Usage

### Web Server

The application hosts a web server to provide manual control and configuration. Access the following URLs for different functionalities:

- **Root URL:** Activates the motor (`/`)
- **Control URL:** Manual motor control page (`/control`)
- **Config URL:** Configuration page to update settings (`/config`)

Configuration Screen
<img width="539" alt="Configuration Screen" src="https://github.com/user-attachments/assets/ec8cb253-7ef5-4910-a4c9-90fdf3cb58db">

### Printer Stage Monitoring

The application monitors the printer's stages and activates the motor when necessary. The stages are identified using MQTT messages from the printer.



## Installation

1. Connect the ESP32 to your computer.
2. Open the code in the Arduino IDE.
3. Enter your WiFi and MQTT credentials in the respective variables.
4. Upload the code to the ESP32.
5. Access the web server via the IP address assigned to the ESP32 to configure and control the application.


## List of some supplies
- Breakout board for ESP32: https://amzn.to/4dcUunc
- ESP32 board: https://amzn.to/4fBjh5L
- 12 Volt power supply: https://amzn.to/3AfIm6a
- Motor Controller: https://amzn.to/3yBPqcM
- 12V 10RPM Motor: https://amzn.to/3M24VOd

Not listed
- Wires
- LEDs (Standard dev kit leds)

## Known Issues
- You cannot access the config page immediately after the motor has run. This is due to the application being in a "delay" state for the amount of time the delayAfterRun value is set. In example, if you have delayAfterRun set to 30000 the /config page will be inaccessible for 30 seconds after the motor has run. I'm working on a fix.
- The motor might not run exactly after the poop is ejected, I'm still working on adjusting timing. However it should run once after the filament calibration stage at the start of the print and once when it notices a "change filament" status. 


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
