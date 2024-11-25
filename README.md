# Bambu Poop Conveyor for ESP32 
:arrow_right:	:arrow_right:	:poop: :arrow_right: :arrow_right: :poop: :arrow_right: :arrow_right:

### For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor

## Overview 

The Bambu Conveyor is an application designed to manage the waste output of a [Bambu Labs X1 3D printer](https://bambulab.com/en/x1). It utilizes the MQTT protocol to monitor the printer's status and control a motor that moves waste material away from the printing area. 


## List of some supplies
- Breakout board for ESP32: https://amzn.to/4dyjsx0
- ESP32 board: https://amzn.to/4fBjh5L
- 12 Volt power supply: https://amzn.to/3AfIm6a
- Motor Controller: https://amzn.to/3yBPqcM
- 12V 10RPM Motor: https://amzn.to/3M24VOd
- Resistors (I use 1k Ohm): https://amzn.to/4cqCi8e
- Wires: https://amzn.to/46EAtn3
- LEDs sourced from this kit: https://amzn.to/4dH5Dw7
  

# Conveyor Makerworld files

- **Conveyor:** https://makerworld.com/en/models/148083#profileId-161573
- **The custom box I used:** https://makerworld.com/en/models/576315#profileId-496900
- **Conveyor Extension:** https://makerworld.com/en/models/249714#profileId-359905
- **Another Motor box housing:** (Alternative option without LEDS but better motor mount): https://makerworld.com/en/models/164413#profileId-180494



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
const int yellowLight = 18;
const int redLight = 4;

int motor1Pin1 = 23;
int motor1Pin2 = 21;
int enable1Pin = 15;

```

### Motor Control Timings

Configure the motor run time and wait time:

```cpp
int motorRunTime = 10000; // 10 seconds by default / I prefer 5000 as the poop doesnt come out fast enough for you to need anymore than that, but 10 seconds is just more exciting
int motorWaitTime = 5000; // The time to wait to run the motor. / We dont want the conveyor to run right when the status is detected, 5 seconds is just right in my case
int delayAfterRun = 120000; // Delay after motor run / We dont want it to run again anytime soon

```

### PWM Configuration

Set the PWM properties for motor control:

```cpp
const int freq = 5000;
const int pwmChannel = 0;
const int resolution = 8;
int dutyCycle = 220; // Motors power level (255 for full power) / I run just under that for no reason other than my own preference 

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


## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

For more detailed project information visit: https://t0nyz.com/projects/bambuconveyor
