# Bambu Poop Conveyor for ESP32 
:arrow_right:	:arrow_right:	:poop: :arrow_right: :arrow_right: :poop: :arrow_right: :arrow_right:

### For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor

## Overview 

The Bambu Poop Conveyor is an application designed to manage the waste output of a Bambu X1 3D printer. It utilizes WiFi and MQTT protocols to monitor the printer's status and control a motor that moves waste material away from the printing area. 

https://github.com/user-attachments/assets/e5a849d5-8708-4fe7-8b11-288ce03bfcbe


## List of some supplies
- Breakout board for ESP32: https://amzn.to/4dyjsx0
- ESP32 board: https://amzn.to/4fBjh5L
- 12 Volt power supply: https://amzn.to/3AfIm6a
- Motor Controller: https://amzn.to/3yBPqcM
- 12V 10RPM Motor: https://amzn.to/3M24VOd

Not listed
- Wires
- LEDs (Standard dev kit leds)

# Conveyor Makerworld files

- **Conveyor:** https://makerworld.com/en/models/148083#profileId-161573
- **Motor box:** (I made my own but this one works): https://makerworld.com/en/models/164413#profileId-180494
- **Conveyor Extension:** https://makerworld.com/en/models/249714#profileId-359905

- **The custom box I used:** https://makerworld.com/en/models/576315#profileId-496900

## Features

- **WiFi and MQTT Connectivity:** Connects to a local WiFi network and communicates with the printer via MQTT
- **Motor Control:** Activates a motor to manage the printer's waste output based on the printer's status
- **Web Server:** Hosts a web server to provide manual control and configuration of the system
- **Stage Monitoring:** Monitors various stages of the printer to determine when to activate the motor

## Setup

### WiFi and MQTT Configuration

Enter your WiFi and MQTT credentials in the following variables:

```cpp
// WiFi credentials
char ssid[40] = "your-ssid";
char password[40] = "your-password";

// MQTT credentials
char mqtt_server[40] = "your-bambu-printer-ip";
char mqtt_password[30] = "your-bambu-printer-accesscode";
char serial_number[20] = "your-bambu-printer-serial-number";

```
### Note:
- **ssid** is your WIFI name
- **password** is the WIFI password
- **mqtt_server** is your Bambu Printers IP address
- **mqtt_password** is your Bambu printer access code as found on your printer
- **serial_number** is your Bambu printer serial number as found on your printer

## GPIO Pins

The application uses the following GPIO pins for motor and LED control:

```cpp
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
int motorRunTime = 10000; // 10 seconds by default // Honestly I prefer 5000 as the poop doesnt come out fast enough for you to need anymore than that, but 10 seconds is just more exciting
int motorWaitTime = 5000; // The time to wait to run the motor.
int delayAfterRun = 120000; // Delay after motor run

```

### PWM Configuration

Set the PWM properties for motor control:

```cpp
const int freq = 5000;
const int pwmChannel = 0;
const int resolution = 8;
int dutyCycle = 220;

```


## Installation

1. Connect the ESP32 to your computer.
2. Open the code in the Arduino IDE.
3. Enter your WiFi and MQTT credentials in the respective variables.
4. Upload the code to the ESP32.
5. Access the web server via the IP address assigned to the ESP32 to configure and control the application.


## Usage

### Web Server

The application hosts a web server to provide manual control and configuration. Access the following URLs for different functionalities:

- **Root URL:** Activates the motor (`/`)
- **Control URL:** Manual motor control page (`/control`)
- **Config URL:** Configuration page to update settings (`/config`)
- **Logs URL:** Log history page (`/logs`)




## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor
