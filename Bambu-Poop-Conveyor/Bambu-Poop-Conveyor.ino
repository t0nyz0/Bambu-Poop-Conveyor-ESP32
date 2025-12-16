#include <Arduino.h>
// Bambu Poop Conveyor
// 8/6/24 - TZ
// Last updated: 12/13/25
char version[10] = "1.3.9";

#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <Update.h>
#include <DNSServer.h>
#include <time.h> 

//---- SETTINGS YOU SHOULD ENTER --------------------------------------------------------------------------------------------------------------------------

// WiFi credentials
char ssid[50] = "";
char password[50] = "";

// MQTT credentials
char mqtt_server[40] = "your-bambu-printer-ip";
char mqtt_password[30] = "your-bambu-printer-accesscode";
char serial_number[35] = "your-bambu-printer-serial-number";
// Printer model selection (X1, P1, A1, H2, P2)
char printer_model[5] = "X1";  // Default to X1


// --------------------------------------------------------------------------------------------------------------------------------------------------------

// OPTIONAL: IF YOU WANT ACCURATE LOG TIMES UPDATE YOUR TIMEZONE HERE

//const long gmtOffset_sec = -5 * 3600; // Adjust for your timezone (EST)
int gmtOffset_sec = -6; // Default to CST (GMT-6 hours)

// Daylight savings
const int daylightOffset_sec = 3600; // Adjust for daylight saving time if applicable

// GPIO Pins
const int greenLight = 19;
const int yellowLight = 18;
const int redLight = 4;

const int motionSensorPin = 22;  // Adjust the pin as needed
bool useMotionSensor = false;
bool onlyRunAtStart = false;
char operationMode[10] = "mqtt";

char mqtt_port[6] = "8883";
char mqtt_user[30] = "bblp";
char mqtt_topic[200];

// Poop Motor
int motor1Pin1 = 23;
int motorDirection = 0; // Default to 0 (Forward)
int motor1Pin2 = 21;
int enable1Pin = 15;

int motorRunTime = 4000; // 5 seconds by default
int motorWaitTime = 5000; // The time to wait to run the motor.
int delayAfterRun = 120000; // Delay after motor run
int additionalWaitTime = 0; // Variable to store additional wait time for specific stages

// Setting PWM properties
const int freq = 5000;
const int pwmChannel = 0;
const int pwmTimer = 0; 
const int resolution = 8;
int dutyCycle = 225;

// Debug flag
bool debug = true;
bool autoPushAllEnabled = true;
bool pushAllCommandSent = false;
bool wifiConnected = false;
bool mqttConnected = false;
bool isAPMode = false;


unsigned long lastAttemptTime = 0;
const unsigned long RECONNECT_INTERVAL = 15000;  // 15 seconds

unsigned int sequence_id = 20000;
unsigned long previousMillis = 0;
unsigned long redLightToggleTime = 0;
unsigned long greenLightToggleTime = 0;
unsigned long motorRunStartTime = 0;
unsigned long motorWaitStartTime = 0;
unsigned long delayAfterRunStartTime = 0;
unsigned long yellowLightStartTime = 0;
unsigned int yellowLightState = 0;
bool motorRunning = false;
bool motorWaiting = false;
bool delayAfterRunning = false;


DNSServer dnsServer;

#define MAX_LOG_ENTRIES 200

struct LogEntry {
    time_t timestamp;
    String action;
};

LogEntry logs[MAX_LOG_ENTRIES];
int logIndex = 0;

// Sync time so we have proper logging
const char* ntpServer = "pool.ntp.org";

// MQTT state variables
int printer_stage = -100;
int printer_sub_stage = -100;
String printer_real_stage = "";
String gcodeState = "";

// Create instances
WiFiClientSecure espClient;
PubSubClient client(espClient);
Preferences preferences;
WebServer server(80);

// Function to get the printer stage description
const char* getStageInfo(int stage) {
    switch (stage) {
        case -100: return "Connection Issue";
        case -1: return "Idle";
        case 0:  return "Printing";
        case 1:  return "Auto bed leveling";
        case 2:  return "Heatbed preheating";
        case 3:  return "Vibration compensation";
        case 4:  return "Changing filament";
        case 5:  return "M400 pause";
        case 6:  return "Paused (filament ran out)";
        case 7:  return "Heating nozzle";
        case 8:  return "Calibrating dynamic flow";
        case 9:  return "Scanning bed surface";
        case 10: return "Inspecting first layer";
        case 11: return "Identifying build plate type";
        case 12: return "Calibrating Micro Lidar";
        case 13: return "Homing toolhead";
        case 14: return "Cleaning nozzle tip";
        case 15: return "Checking extruder temperature";
        case 16: return "Paused by the user";
        case 17: return "Pause (front cover fall off)";
        case 18: return "Calibrating the micro lidar";
        case 19: return "Calibrating flow ratio";
        case 20: return "Pause (nozzle temperature malfunction)";
        case 21: return "Pause (heatbed temperature malfunction)";
        case 22: return "Filament unloading";
        case 23: return "Pause (step loss)";
        case 24: return "Filament loading";
        case 25: return "Motor noise cancellation";
        case 26: return "Pause (AMS offline)";
        case 27: return "Pause (low speed of the heatbreak fan)";
        case 28: return "Pause (chamber temperature control problem)";
        case 29: return "Cooling chamber";
        case 30: return "Pause (Gcode inserted by user)";
        case 31: return "Motor noise showoff";
        case 32: return "Pause (nozzle clumping)";
        case 33: return "Pause (cutter error)";
        case 34: return "Pause (first layer error)";
        case 35: return "Pause (nozzle clog)";
        case 36: return "Measuring motion precision";
        case 37: return "Enhancing motion precision";
        case 38: return "Measure motion accuracy";
        case 39: return "Nozzle offset calibration";
        case 40: return "High temperature auto bed leveling";
        case 41: return "Auto Check: Quick Release Lever";
        case 42: return "Auto Check: Door and Upper Cover";
        case 43: return "Laser Calibration";
        case 44: return "Auto Check: Platform";
        case 45: return "Confirming BirdsEye Camera location";
        case 46: return "Calibrating BirdsEye Camera";
        case 47: return "Auto bed leveling - phase 1";
        case 48: return "Auto bed leveling - phase 2";
        case 49: return "Heating chamber";
        case 50: return "Cooling heatbed";
        case 51: return "Printing calibration lines";
        case 52: return "Auto Check: Material";
        case 53: return "Live View Camera Calibration";
        case 54: return "Waiting for heatbed to reach target temperature";
        case 55: return "Auto Check: Material Position";
        case 56: return "Cutting Module Offset Calibration";
        case 57: return "Measuring Surface";
        case 58: return "Thermal preconditioning for first layer optimization";
        case 59: return "Homing Blade Holder";
        case 60: return "Calibrating Camera Offset";
        case 61: return "Calibrating Blade Holder Position";
        case 62: return "Hotend Pick and Place Test";
        case 63: return "Waiting for chamber temperature to equalize";
        case 64: return "Preparing Hotend";
        case 65: return "Calibrating nozzle clumping detection position";
        case 66: return "Purifying the chamber air";
        default: return "Unknown stage";
    }
}

// Function to add log entries
void addLogEntry(String action) {
    time_t now = time(nullptr);

    logs[logIndex].timestamp = now; // Store raw timestamp (UTC)
    logs[logIndex].action = action;
    logIndex = (logIndex + 1) % MAX_LOG_ENTRIES;
}

void syncTime() {
    addLogEntry("Syncing time...");
    configTime(gmtOffset_sec * 3600, daylightOffset_sec, ntpServer);

    struct tm timeinfo;
    int retries = 0;
    while (!getLocalTime(&timeinfo) && retries < 10) {  
        addLogEntry("Failed to obtain time, retrying...");
        delay(1000);
        retries++;
    }

    if (retries < 10) {
        char timeString[50];
        strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
        addLogEntry("Time synchronized! ESP32 thinks current time is: " + String(timeString));
    } else {
        addLogEntry("Failed to synchronize time after multiple attempts.");
    }
}

void handleFirmwareUpload() {
    HTTPUpload& upload = server.upload();
    
    if (upload.status == UPLOAD_FILE_START) {
        Serial.printf("Firmware update initiated: %s\n", upload.filename.c_str());
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { // Start OTA update
            Update.printError(Serial);
            return;
        }
    } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
            Update.printError(Serial);
        }
    } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) { // Finish OTA update
            Serial.println("Firmware update successful!");
            server.sendHeader("Connection", "close");
            server.send(200, "text/html; charset=UTF-8", "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>Update Successful</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:50px;background:#f4f4f4;}h1{color:#198754;font-size:2em;margin-bottom:20px;}p{color:#666;font-size:1.1em;margin:10px 0;}.container{max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}</style></head><body><div class=\"container\"><h1>✓ Update Successful!</h1><p>The device is now rebooting with the new firmware.</p><p><strong>Please wait 45 seconds...</strong></p><p style=\"color:#999;font-size:0.9em;\">This page will automatically refresh when the device is ready.</p></div><script>setTimeout(function(){window.location.href='/config';},45000);</script></body></html>");
            server.client().stop();
            delay(5000);  // Give browser time to fully receive the response
            ESP.restart();
        } else {
            Update.printError(Serial);
            server.sendHeader("Connection", "close");
            server.send(500, "text/html; charset=UTF-8", "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"></head><body><h1>Update Failed!</h1></body></html>");
        }
    } else if (upload.status == UPLOAD_FILE_ABORTED) {
        Update.abort();
        Serial.println("Update was aborted");
    }
}

// Function to handle the control page
void handleControl() {
    if (server.method() == HTTP_GET) {
        String html = "<html><head>";
        html += "<style>";
        html += "body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; text-align: center; }";
        html += ".container { max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border-radius: 8px; }";
        html += "h1 { color: #333; }";
        html += "form { margin: 20px 0; }";
        html += "input[type='submit'] { background-color: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }";
        html += "input[type='submit']:hover { background-color: #45a049; }";
        html += "</style>";
        html += "</head><body>";
        html += "<div class='container'>";
        html += "<h1>Manual Motor Control</h1>";
        html += "<form action=\"/control\" method=\"POST\">";
        html += "<input type=\"submit\" value=\"Activate Motor\">";
        html += "</form>";
        html += "</div>";
        html += "</body></html>";
        server.send(200, "text/html", html);
    } else if (server.method() == HTTP_POST) {
        server.send(200, "text/plain", "Motor activated manually");
        motorWaiting = true;
        motorWaitStartTime = millis();
        addLogEntry("Motor activated manually");
    }
}


// Function to handle the root URL
void handleManualRun() {
    server.send(200, "text/plain", "Motor activated");
    motorWaiting = true;
    motorWaitStartTime = millis();
    additionalWaitTime = 0;  // Reset additional wait time for manual trigger
    digitalWrite(greenLight, LOW);
    digitalWrite(yellowLight, HIGH);
    addLogEntry("Motor activated from RUN url");
}

void handleConfig() {
    if (server.method() == HTTP_GET) {
                String html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Bambu Poop Conveyor</title>";
        html += "<style>";
        html += "body{font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif;background-color:#f8f9fa;color:#212529;margin:0;padding:0;}";
        html += ".container{max-width:600px;margin:0 auto;padding:1rem;}";
        html += ".text-center{text-align:center;}";
        html += ".mb-4{margin-bottom:1.5rem;}";
        html += ".mb-3{margin-bottom:1rem;}";
        html += ".mb-2{margin-bottom:0.5rem;}";
        html += ".mt-4{margin-top:1.5rem;}";
        html += ".me-2{margin-right:0.5rem;}";
        html += ".card{background-color:#fff;border:1px solid rgba(0,0,0,.125);border-radius:0.375rem;margin-bottom:1rem;}";
        html += ".card-header{background-color:rgba(0,0,0,.03);border-bottom:1px solid rgba(0,0,0,.125);padding:0.75rem 1.25rem;border-top-left-radius:0.375rem;border-top-right-radius:0.375rem;}";
        html += ".card-body{padding:1.25rem;}";
        html += ".card-header h5{margin:0;font-size:1.25rem;font-weight:500;}";
        html += ".form-label{display:block;margin-bottom:0.5rem;font-weight:500;}";
        html += ".form-control{display:block;width:100%;padding:0.375rem 0.75rem;font-size:1rem;font-weight:400;line-height:1.5;color:#212529;background-color:#fff;background-clip:padding-box;border:1px solid #ced4da;border-radius:0.375rem;box-sizing:border-box;}";
        html += ".form-control:focus{border-color:#86b7fe;outline:0;box-shadow:0 0 0 0.25rem rgba(13,110,253,.25);}";
        html += ".form-select{display:block;width:100%;padding:0.375rem 2.25rem 0.375rem 0.75rem;font-size:1rem;font-weight:400;line-height:1.5;color:#212529;background-color:#fff;border:1px solid #ced4da;border-radius:0.375rem;box-sizing:border-box;}";
        html += ".form-select:focus{border-color:#86b7fe;outline:0;box-shadow:0 0 0 0.25rem rgba(13,110,253,.25);}";
        html += ".form-check{display:block;min-height:1.5rem;padding-left:1.5em;margin-bottom:0.125rem;}";
        html += ".form-check-input{width:1em;height:1em;margin-top:0.25em;margin-left:-1.5em;vertical-align:top;cursor:pointer;}";
        html += ".form-check-label{cursor:pointer;}";
        html += ".btn{display:inline-block;font-weight:400;line-height:1.5;color:#212529;text-align:center;text-decoration:none;vertical-align:middle;cursor:pointer;user-select:none;background-color:transparent;border:1px solid transparent;padding:0.375rem 0.75rem;font-size:1rem;border-radius:0.375rem;}";
        html += ".btn-primary{color:#fff;background-color:#0d6efd;border-color:#0d6efd;}";
        html += ".btn-primary:hover{color:#fff;background-color:#0b5ed7;border-color:#0a58ca;}";
        html += ".btn-success{color:#fff;background-color:#198754;border-color:#198754;}";
        html += ".btn-success:hover{color:#fff;background-color:#157347;border-color:#146c43;}";
        html += ".btn-lg{padding:0.5rem 1rem;font-size:1.25rem;border-radius:0.5rem;}";
        html += ".d-grid{display:grid;}";
        html += ".img-fluid{max-width:100%;height:auto;}";
        html += "@media(max-width:576px){.container{padding:0.5rem;}.btn{display:block;width:100%;margin-bottom:0.5rem;}}";
        html += "</style>";
        html += "</head><body>";
        html += "<div class=\"container my-4\">";
        html += "<h2 class=\"text-center mb-4\">Bambu Poop Conveyor v" + String(version) + "</h2>";
        html += "<form action=\"/config\" method=\"POST\">";
        
        // Operation Mode Card - FIRST
        html += "<div class=\"card mb-3\">";
        html += "<div class=\"card-header\"><h5 class=\"mb-0\">Operation Mode</h5></div>";
        html += "<div class=\"card-body\">";
        html += "<div class=\"form-check mb-2\">";
        html += "<input class=\"form-check-input\" type=\"radio\" name=\"operationMode\" id=\"modeMqtt\" value=\"mqtt\"" + String((String(operationMode) == "mqtt") ? " checked" : "") + ">";
        html += "<label class=\"form-check-label\" for=\"modeMqtt\">MQTT (Printer Integration)</label>";
        html += "</div>";
        html += "<div class=\"form-check\">";
        html += "<input class=\"form-check-input\" type=\"radio\" name=\"operationMode\" id=\"modeMotion\" value=\"motion\"" + String((String(operationMode) == "motion") ? " checked" : "") + ">";
        html += "<label class=\"form-check-label\" for=\"modeMotion\">Motion Sensor</label>";
        html += "</div>";
        html += "</div></div>";
        
        // WiFi Settings Card
        html += "<div class=\"card mb-3\">";
        html += "<div class=\"card-header\"><h5 class=\"mb-0\">WiFi Settings</h5></div>";
        html += "<div class=\"card-body\">";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"ssid\" class=\"form-label\">WiFi SSID:</label>";
        html += "<input type=\"text\" class=\"form-control\" id=\"ssid\" name=\"ssid\" value=\"" + String(ssid) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"password\" class=\"form-label\">WiFi Password:</label>";
        html += "<input type=\"password\" class=\"form-control\" id=\"password\" name=\"password\" value=\"" + String(password) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"gmtOffset_sec\" class=\"form-label\">Time Zone Offset (hours from GMT, e.g. -8 PST, -7 MST, -6 CST, -5 EST):</label>";
        html += "<input type=\"number\" class=\"form-control\" id=\"gmtOffset_sec\" name=\"gmtOffset_sec\" step=\"1\" min=\"-12\" max=\"14\" value=\"" + String(gmtOffset_sec) + "\">";
        html += "</div>";
        html += "</div></div>";
        
        // Printer Settings Card - Hidden when motion mode selected
        html += "<div class=\"card mb-3\" id=\"printerSettings\">";
        html += "<div class=\"card-header\"><h5 class=\"mb-0\">Printer Settings</h5></div>";
        html += "<div class=\"card-body\">";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"mqtt_server\" class=\"form-label\">Bambu Printer IP Address:</label>";
        html += "<input type=\"text\" class=\"form-control\" id=\"mqtt_server\" name=\"mqtt_server\" value=\"" + String(mqtt_server) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"mqtt_password\" class=\"form-label\">Bambu Printer Access Code:</label>";
        html += "<input type=\"text\" class=\"form-control\" id=\"mqtt_password\" name=\"mqtt_password\" value=\"" + String(mqtt_password) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"serial_number\" class=\"form-label\">Bambu Printer Serial Number:</label>";
        html += "<input type=\"text\" class=\"form-control\" id=\"serial_number\" name=\"serial_number\" value=\"" + String(serial_number) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"printer_model\" class=\"form-label\">Printer Model:</label>";
        html += "<select class=\"form-select\" id=\"printer_model\" name=\"printer_model\">";
        html += "<option value=\"X1\"" + String((String(printer_model) == "X1") ? " selected" : "") + ">X1</option>";
        html += "<option value=\"P1\"" + String((String(printer_model) == "P1") ? " selected" : "") + ">P1</option>";
        html += "<option value=\"A1\"" + String((String(printer_model) == "A1") ? " selected" : "") + ">A1</option>";
        html += "<option value=\"H2\"" + String((String(printer_model) == "H2") ? " selected" : "") + ">H2</option>";
        html += "</select>";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<div class=\"form-check\">";
        html += "<input class=\"form-check-input\" type=\"checkbox\" id=\"onlyRunAtStart\" name=\"onlyRunAtStart\"" + String(onlyRunAtStart ? " checked" : "") + ">";
        html += "<label class=\"form-check-label\" for=\"onlyRunAtStart\">Only run conveyor at start of print (skip filament changes)</label>";
        html += "</div>";
        html += "</div>";
        html += "</div></div>";
        
        // Motor Settings Card - Always visible
        html += "<div class=\"card mb-3\">";
        html += "<div class=\"card-header\"><h5 class=\"mb-0\">Motor Settings</h5></div>";
        html += "<div class=\"card-body\">";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"motorRunTime\" class=\"form-label\">Motor Run Time (ms):</label>";
        html += "<input type=\"number\" class=\"form-control\" id=\"motorRunTime\" name=\"motorRunTime\" value=\"" + String(motorRunTime) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"motorWaitTime\" class=\"form-label\">Motor Wait Time (ms):</label>";
        html += "<input type=\"number\" class=\"form-control\" id=\"motorWaitTime\" name=\"motorWaitTime\" value=\"" + String(motorWaitTime) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"delayAfterRun\" class=\"form-label\">Delay After Run (ms):</label>";
        html += "<input type=\"number\" class=\"form-control\" id=\"delayAfterRun\" name=\"delayAfterRun\" value=\"" + String(delayAfterRun) + "\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"dutyCycle\" class=\"form-label\">Motor Speed (0-255):</label>";
        html += "<input type=\"number\" class=\"form-control\" id=\"dutyCycle\" name=\"dutyCycle\" value=\"" + String(dutyCycle) + "\" min=\"0\" max=\"255\">";
        html += "</div>";
        html += "<div class=\"mb-3\">";
        html += "<label for=\"motorDirection\" class=\"form-label\">Motor Direction:</label>";
        html += "<select class=\"form-select\" id=\"motorDirection\" name=\"motorDirection\">";
        html += "<option value=\"0\"" + String((motorDirection == 0) ? " selected" : "") + ">Forward</option>";
        html += "<option value=\"1\"" + String((motorDirection == 1) ? " selected" : "") + ">Reverse</option>";
        html += "</select>";
        html += "</div>";
        html += "</div></div>";
        
        // Debug Settings Card
        html += "<div class=\"card mb-3\">";
        html += "<div class=\"card-header\"><h5 class=\"mb-0\">Debug Settings</h5></div>";
        html += "<div class=\"card-body\">";
        html += "<div class=\"form-check\">";
        html += "<input class=\"form-check-input\" type=\"checkbox\" id=\"debug\" name=\"debug\"" + String(debug ? " checked" : "") + ">";
        html += "<label class=\"form-check-label\" for=\"debug\">Debug Mode (Reduced performance)</label>";
        html += "</div>";
        html += "</div></div>";
        
        // Submit button
        html += "<div class=\"d-grid\">";
        html += "<button type=\"submit\" class=\"btn btn-success btn-lg\">Save Settings and Reboot</button>";
        html += "</div>";
        html += "</form>";
        
        // Links
        html += "<div class=\"text-center mt-4\">";
        html += "<a href=\"/control\" class=\"btn btn-primary me-2\">Motor Manual Control Page</a>";
        html += "<a href=\"/update\" class=\"btn btn-primary me-2\">Firmware Update</a>";
        html += "<a href=\"/logs\" class=\"btn btn-primary\">Logs Page</a>";
        html += "</div>";
        
        html += "</div>";
        
        html += "<script>";
        html += "function togglePrinterSettings() {";
        html += "  document.getElementById('printerSettings').style.display = document.getElementById('modeMqtt').checked ? 'block' : 'none';";
        html += "}";
        html += "document.getElementById('modeMqtt').addEventListener('change', togglePrinterSettings);";
        html += "document.getElementById('modeMotion').addEventListener('change', togglePrinterSettings);";
        html += "togglePrinterSettings();";
        html += "</script>";
        html += "</body></html>";

        server.send(200, "text/html", html);
    } 
    else if (server.method() == HTTP_POST) {
        preferences.begin("my-config", false);

        // Retrieve and store the entered values
        strcpy(ssid, server.arg("ssid").c_str());
        strcpy(password, server.arg("password").c_str());
        strcpy(mqtt_server, server.arg("mqtt_server").c_str());
        strcpy(mqtt_password, server.arg("mqtt_password").c_str());
        strcpy(serial_number, server.arg("serial_number").c_str());
        strcpy(printer_model, server.arg("printer_model").c_str());
        
        dutyCycle = server.arg("dutyCycle").toInt();
        motorRunTime = server.arg("motorRunTime").toInt();
        motorWaitTime = server.arg("motorWaitTime").toInt();
        delayAfterRun = server.arg("delayAfterRun").toInt();
        strcpy(operationMode, server.arg("operationMode").c_str());
        useMotionSensor = (String(operationMode) == "motion");
        onlyRunAtStart = server.hasArg("onlyRunAtStart");
        debug = server.hasArg("debug");
        motorDirection = server.arg("motorDirection").toInt();
        gmtOffset_sec = server.arg("gmtOffset_sec").toInt();
 
        // Store in Preferences for persistence
        preferences.putString("ssid", ssid);
        preferences.putString("password", password);
        preferences.putString("mqtt_server", mqtt_server);
        preferences.putString("mqtt_password", mqtt_password);
        preferences.putString("serial_number", serial_number);
        preferences.putInt("motorRunTime", motorRunTime);
        preferences.putInt("motorWaitTime", motorWaitTime);
        preferences.putInt("delayAfterRun", delayAfterRun);
        preferences.putString("operationMode", operationMode);
        preferences.putBool("onlyRunAtStart", onlyRunAtStart);
        preferences.putString("printer_model", printer_model);
        preferences.putInt("motorDirection", motorDirection);
        preferences.putInt("dutyCycle", dutyCycle);
        preferences.putBool("debug", debug);
        preferences.putInt("gmtOffset_sec", gmtOffset_sec);

        preferences.end();  

        server.send(200, "text/html", "<h1>Settings saved! This page will automatically refresh in 15 seconds...</h1><script>setTimeout(() => { window.location.href = '/config'; }, 15000);</script><br><br><a href=\"/config\">Refresh now</a>");

        delay(1000);
        ESP.restart();
    }
}

// Function to handle the root URL

String formatDateTime(time_t timestamp) {
    struct tm timeinfo;
    time_t adjustedTime = timestamp; // Apply timezone
    localtime_r(&adjustedTime, &timeinfo);  

    char buffer[25];
    strftime(buffer, sizeof(buffer), "%Y-%m-%d %I:%M:%S %p", &timeinfo); // 12-hour format with AM/PM

    return String(buffer);
}

// Handle Home Assistant status check
void handleMotorStatus() {
    String jsonResponse = "{ \"motor_running\": " + String(motorRunning ? "true" : "false") + " }";
    server.send(200, "application/json", jsonResponse);
}

// Function for web page flash


void handleUpdatePage() {
    String html = "";
    html += "<!DOCTYPE html><html><head><meta charset='UTF-8'>";
    html += "<title>Firmware Update</title>";
    html += "<style>";
    html += "body{font-family:Arial;background:#f4f4f4;text-align:center;}";
    html += ".container{max-width:520px;margin:40px auto;background:#fff;padding:20px;border-radius:6px;}";
    html += ".button{display:none;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px;}";
    html += "</style></head><body>";

    html += "<div class='container'>";
    html += "<h2>Bambu Poop Conveyor Firmware</h2>";
    html += "<p><b>Current Version:</b> ";
    html += version;
    html += "</p>";
    html += "<p><b>Latest Version:</b> <span id='latestVersion'>Checking...</span></p>";
    html += "<a id='downloadBtn' class='button'>Download Latest Firmware</a>";
    html += "<hr>";
    html += "<form method='POST' action='/update' enctype='multipart/form-data'>";
    html += "<input type='file' name='firmware' accept='.bin'><br><br>";
    html += "<input type='submit' value='Upload & Update'>";
    html += "</form>";
    html += "<br><a href='/config'>Back to Config</a>";
    html += "</div>";

    html += "<script>";
    html += "fetch('https://t0nyz.com/flasher/latest.json')";
    html += ".then(r=>r.json())";
    html += ".then(d=>{";
    html += "document.getElementById('latestVersion').innerText=d.version;";
    html += "const b=document.getElementById('downloadBtn');";
    html += "b.href=d.bin;b.style.display='inline-block';";
    html += "})";
    html += ".catch(()=>{document.getElementById('latestVersion').innerText='Unavailable';});";
    html += "</script>";

    html += "</body></html>";

    server.send(200, "text/html", html);
}

void handleLogs() {
    String html = "<html><head><title>Debug Logs</title>";
    html += "<style>";
    html += "body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; text-align: center; }";
    html += ".container { max-width: 1000px; margin: 30px auto; padding: 20px; background-color: #fff; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border-radius: 8px; }";
    html += "h1 { color: #333; }";
    html += "table { width: 100%; border-collapse: collapse; margin-top: 20px; }";
    html += "th, td { padding: 5px; border: 1px solid #ddd; text-align: left; }";
    html += "th { background-color: #f2f2f2; }";
    html += "</style>";
    html += "</head><body>";
    html += "<div class='container'>";
    html += "<h1>Logs</h1>";
    html += "<table><tr><th>Timestamp</th><th>Action</th></tr>";

    for (int i = 0; i < MAX_LOG_ENTRIES; i++) {
        int index = (logIndex + i) % MAX_LOG_ENTRIES;
        if (logs[index].timestamp > 0) {
            html += "<tr><td>" + formatDateTime(logs[index].timestamp) + "</td><td>" + logs[index].action + "</td></tr>";
        }
    }

    html += "</table></div></body></html>";
    server.send(200, "text/html", html);
}

// MQTT callback function
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    DynamicJsonDocument doc(40000);
    DeserializationError error = deserializeJson(doc, payload, length);

    if (error) {
        if (debug) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.c_str());
            addLogEntry("deserializeJson() failed: ");
            addLogEntry(error.c_str());
        }
        return;
    }

    if (doc.containsKey("print") && doc["print"].containsKey("stg_cur")) {
        printer_stage = doc["print"]["stg_cur"].as<int>();
    }

    if (doc.containsKey("print") && doc["print"].containsKey("mc_print_sub_stage")) {
        printer_sub_stage = doc["print"]["mc_print_sub_stage"].as<int>();
    }


    if (!useMotionSensor && !motorWaiting && !motorRunning && !delayAfterRunning && 
        (printer_stage == 14 || (!onlyRunAtStart && printer_stage == 4) || (!onlyRunAtStart && printer_sub_stage == 4 && printer_stage != -1))) {
        motorWaiting = true;
        motorWaitStartTime = millis();
        addLogEntry("Status 4 or 14 detected! Running conveyor!!!");

        if (debug) {
            Serial.println("Status 4 or 14 detected! Running conveyor!!!");
        }

        if (printer_sub_stage == 4 && printer_stage != -1) {
            additionalWaitTime = 75000;
        } else {
            additionalWaitTime = 0;
        }

        yellowLightStartTime = millis();
        yellowLightState = HIGH;
        digitalWrite(yellowLight, yellowLightState);
    }

    if (debug && !useMotionSensor) {
        Serial.println("Bambu Poop Conveyor v" + String(version) + 
               " | Wifi: " + WiFi.localIP().toString() + 
               " | Current Print Stage: " + String(getStageInfo(printer_stage)) + 
               " | Sub stage: " + String(getStageInfo(printer_sub_stage)));
        addLogEntry("MQTT Callback - Getting data from printer. Data: Current print stage: " + String(getStageInfo(printer_stage)) + " | Current sub print stage: " + String(getStageInfo(printer_sub_stage)));
    }
}

void publishPushAllMessage() {
    if (client.connected()) {
        char publish_topic[128];
        sprintf(publish_topic, "device/%s/request", serial_number);

        DynamicJsonDocument doc(1024);
        doc["pushing"]["sequence_id"] = sequence_id;
        doc["pushing"]["command"] = "pushall";
        doc["user_id"] = "2222222";

        String jsonMessage;
        serializeJson(doc, jsonMessage);

        bool success = client.publish(publish_topic, jsonMessage.c_str());

        if (success) {
            if (debug) {
                Serial.print("Message successfully sent to: ");
                Serial.println(publish_topic);
                addLogEntry("MQTT message sent from publishPushAllMessage");
            }
        } else {
            if (debug) Serial.println("Failed to send message.");
            addLogEntry("Failed to send MQTT push all - publishPushAllMessage");
        }

        sequence_id++;
    } else {
        if (debug) { 
            Serial.println("Not connected to MQTT broker!");
            addLogEntry("Not connected to MQTT broker! - publishPushAllMessage");
        }
    }
}


// Function to connect to MQTT
void connectToMqtt() {
    if (!client.connected()) {
        if (debug) {
            Serial.print("Connecting to MQTT...");
            addLogEntry("Connecting to MQTT...");
        }
        if (client.connect("BambuConveyor", mqtt_user, mqtt_password)) {
            Serial.println("Connected to Bambu printer");
            addLogEntry("Connected to Bambu printer");
            sprintf(mqtt_topic, "device/%s/report", serial_number);
            client.subscribe(mqtt_topic);
            publishPushAllMessage();
            digitalWrite(redLight, LOW);
            digitalWrite(yellowLight, LOW);  
            if (debug) {
                Serial.print("Red light off");
                addLogEntry("Red light off");
                Serial.print("Yellow light off");
                addLogEntry("Yellow light off");
            }
        } else {  
            if (debug) {
                Serial.print("Failed: ");
                Serial.print(client.state());
                Serial.println(" try again in 5 seconds");
                addLogEntry("Failed to connect to MQTT (Bambu Printer), trying again in 5 seconds");
            }
            lastAttemptTime = millis();
            digitalWrite(redLight, HIGH);
            addLogEntry("RED light turned on");
        }
    }
}

// Function to send a push all command
void sendPushAllCommand() {
    if (client.connected() && !pushAllCommandSent) {
        String mqtt_topic_request = "device/";
        mqtt_topic_request += serial_number;
        mqtt_topic_request += "/request";

        StaticJsonDocument<128> doc;
        doc["pushing"]["sequence_id"] = String(sequence_id++);
        doc["pushing"]["command"] = "pushall";
        doc["user_id"] = "2222222";

        String payload;
        serializeJson(doc, payload);
        if (debug) {
                Serial.println("MQTT Callback sent - Sendpushallcommand");
                addLogEntry("MQTT Callback sent - Sendpushallcommand");
        }
        client.publish(mqtt_topic_request.c_str(), payload.c_str());
        pushAllCommandSent = true;
    }
}

void setup() {
    // Initialize logs
    for (int i = 0; i < MAX_LOG_ENTRIES; i++) {
        logs[i].timestamp = 0;
    }
    // Initialize GPIO pins
    pinMode(motor1Pin1, OUTPUT);
    pinMode(motor1Pin2, OUTPUT);
    pinMode(enable1Pin, OUTPUT);
    pinMode(yellowLight, OUTPUT);
    pinMode(redLight, OUTPUT);
    pinMode(greenLight, OUTPUT);
    pinMode(motionSensorPin, INPUT);

    // Start Serial communication
    Serial.begin(115200);
    client.setBufferSize(40000);

    // Configure LED PWM functionalities
    ledcAttachChannel(enable1Pin, freq, resolution, pwmChannel);
    ledcWrite(enable1Pin, dutyCycle);

    // Start Preferences storage
    preferences.begin("my-config", false);

    // Load all stored values from Preferences
    String storedSSID = preferences.getString("ssid", "");
    String storedPassword = preferences.getString("password", "");
    String storedMqttServer = preferences.getString("mqtt_server", "");
    String storedMqttPassword = preferences.getString("mqtt_password", "");
    String storedSerialNumber = preferences.getString("serial_number", "");
    String storedMode = preferences.getString("operationMode", "mqtt");
    storedMode.toCharArray(operationMode, sizeof(operationMode));
    useMotionSensor = (String(operationMode) == "motion");
    onlyRunAtStart = preferences.getBool("onlyRunAtStart", false);
    String storedPrinterModel = preferences.getString("printer_model", "X1");  // Default "X1" if missing
    debug = preferences.getBool("debug", false); 

    storedSSID.toCharArray(ssid, sizeof(ssid));
    storedPassword.toCharArray(password, sizeof(password));
    storedMqttServer.toCharArray(mqtt_server, sizeof(mqtt_server));
    storedMqttPassword.toCharArray(mqtt_password, sizeof(mqtt_password));
    storedSerialNumber.toCharArray(serial_number, sizeof(serial_number));
    storedPrinterModel.toCharArray(printer_model, sizeof(printer_model));
    motorRunTime = preferences.getInt("motorRunTime", 10000);
    motorWaitTime = preferences.getInt("motorWaitTime", 5000);
    delayAfterRun = preferences.getInt("delayAfterRun", 120000);
    motorDirection = preferences.getInt("motorDirection", 0);
    gmtOffset_sec = preferences.getInt("gmtOffset_sec", -6);
    dutyCycle = preferences.getInt("dutyCycle", 225);

    // Close Preferences after reading all values
    preferences.end();

    // Decide if we should connect to WiFi or enter AP mode
    if (strlen(ssid) > 0 && strlen(password) > 0) {
        connectToWiFi();
    } else {
        startWiFiAPMode();
    }
    
    delay(2000);

    // Set up MQTT if WiFi is connected
    if (WiFi.status() == WL_CONNECTED) {
        client.setServer(mqtt_server, 8883); // Default MQTT port
        espClient.setInsecure();
        client.setCallback(mqttCallback);
        sprintf(mqtt_topic, "device/%s/report", serial_number);
        connectToMqtt(); 
    }

    // Set up Web Server routes
    server.on("/", handleConfig);
    server.on("/control", handleControl);
    server.on("/config", handleConfig);
    server.on("/logs", handleLogs);
    // Register Home Assistant API endpoints
    server.on("/run", handleManualRun);
    server.on("/status", handleMotorStatus);
    server.on("/update", HTTP_GET, handleUpdatePage);
    server.on("/update", HTTP_POST, []() {
        // Response will be sent by handleFirmwareUpload after upload completes
    }, handleFirmwareUpload);



    // Start Web Server
    server.begin();
    Serial.println("Web server started.");
    addLogEntry("Web server started.");

    if (!client.connected()) {
        sendPushAllCommand();
    }
}

void handleRoot() {
    server.sendHeader("Location", "/config", true);
    server.send(302, "text/plain", "Redirecting...");
}

void startWiFiAPMode() {
    Serial.println("Starting WiFi AP Mode...");
    addLogEntry("Starting WiFi AP Mode...");

    isAPMode = true;  

    WiFi.mode(WIFI_AP);
    WiFi.softAP("BambuConveyor", "12345678");  // Open WiFi AP with password

    dnsServer.start(53, "*", WiFi.softAPIP()); // Captive portal redirection
    server.onNotFound(handleRoot);  // Redirect users to /config

    Serial.print("Access Point IP: ");
    Serial.println(WiFi.softAPIP());

    // Flash yellow light to indicate setup mode
    digitalWrite(yellowLight, HIGH);
}


void connectToWiFi() {
    const int maxRetries = 20;  // Set a limit for retries
    int retryCount = 0;
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);

    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 25000) {  // Try for 15 sec

        if (debug) { 
            Serial.print('.');
            addLogEntry("Connecting to WiFi... Attempt " + String(retryCount + 1));
        }

        digitalWrite(yellowLight, HIGH);
        delay(500);
        digitalWrite(yellowLight, LOW);
        delay(500);

        retryCount++;
        if (retryCount >= maxRetries) {
            Serial.println("\nExceeded max WiFi connection attempts, rebooting ESP32...");
            addLogEntry("Exceeded max WiFi connection attempts, rebooting ESP32...");
            delay(2000); // Small delay before reboot
            ESP.restart();
        }
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(greenLight, HIGH);
        syncTime();
        isAPMode = false;  // Ensure AP mode is OFF when connected
        Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
        addLogEntry("Connected to WiFi: " + WiFi.localIP().toString());
    } else {
        Serial.println("\nWiFi failed to connect. Switching to AP mode.");
        startWiFiAPMode();  // Start AP mode if WiFi fails
        addLogEntry("WiFi failed to connect. Switching to AP mode.");
    }
}


// Loop function
// Add this variable to track if MQTT is in reconnecting state
unsigned long lastMQTTDisconnectTime = 0;
bool mqttReconnecting = false;
void loop() {
    server.handleClient();
    dnsServer.processNextRequest();  // Handle captive portal redirects

    if (isAPMode) return;  // Skip all WiFi/MQTT logic if in AP mode

    unsigned long currentMillis = millis();
    static unsigned long disconnectedTime = 0; 

    // Determine push interval based on printer model
    unsigned long pushInterval = (strcmp(printer_model, "X1") == 0 || strcmp(printer_model, "H2") == 0) ? 30000 : 300000; // 5 min for others

    if (useMotionSensor && digitalRead(motionSensorPin) == HIGH && !motorWaiting && !motorRunning && !delayAfterRunning) {
        motorWaitStartTime = millis();
        yellowLightStartTime = millis();
        yellowLightState = HIGH;
        digitalWrite(yellowLight, yellowLightState);
        addLogEntry("Motion detected, starting conveyor");
        motorWaiting = true;
    }

    // Auto PushAll based on printer model interval
    if (!useMotionSensor && autoPushAllEnabled && client.connected() && (currentMillis - previousMillis >= pushInterval)) {  
        previousMillis = currentMillis;
        if (debug) { 
            Serial.println("Requesting pushAll...");
            addLogEntry("Requesting pushAll... Push interval: " + String(pushInterval) + " Push interval: " + String(currentMillis - previousMillis));
        }
        publishPushAllMessage();
    }

    // Motor waiting logic
    if (motorWaiting && millis() - motorWaitStartTime >= (motorWaitTime + additionalWaitTime)) {
        motorWaiting = false;
        motorRunning = true;
        motorRunStartTime = millis();
        digitalWrite(yellowLight, LOW);  
        digitalWrite(redLight, HIGH);    
        if (debug) Serial.println(String("Moving ") + (motorDirection == 0 ? "Forward" : "Reverse"));
        // Apply duty cycle before enabling motor
        ledcWrite(enable1Pin, dutyCycle);

        if (motorDirection == 0) {
            digitalWrite(motor1Pin1, LOW);
            digitalWrite(motor1Pin2, HIGH);
        } else {
            digitalWrite(motor1Pin1, HIGH);
            digitalWrite(motor1Pin2, LOW);
        }
        addLogEntry("Conveyor Running | MOTOR STARTED | Duty Cycle: " + String(dutyCycle) + " | Direction: " + (motorDirection == 0 ? "Forward" : "Reverse"));
    }

    // Motor running logic
    if (motorRunning && millis() - motorRunStartTime >= motorRunTime) {
        motorRunning = false;
        delayAfterRunning = true;
        delayAfterRunStartTime = millis();
        if (debug) Serial.println("Motor stopped");
        digitalWrite(motor1Pin1, LOW);
        digitalWrite(motor1Pin2, LOW);
        digitalWrite(redLight, LOW);
        digitalWrite(yellowLight, LOW);
        digitalWrite(greenLight, HIGH);
        addLogEntry("Motor stopped");
    }

    // Delay after run logic
    if (delayAfterRunning && millis() - delayAfterRunStartTime >= delayAfterRun) {
        delayAfterRunning = false;
        if (debug) Serial.println("Delay after run complete");
        addLogEntry("Delay after run complete");
    }

    // Handle yellow light flashing based on MQTT/WiFi status
    if (motorWaiting) {
        digitalWrite(greenLight, LOW);
        if (currentMillis - yellowLightStartTime >= 500) {
            yellowLightStartTime = currentMillis;
            yellowLightState = !yellowLightState;
            digitalWrite(yellowLight, yellowLightState);
        }
    } 
    
   if (!useMotionSensor && !client.connected()) {
    
        if (disconnectedTime == 0) {
            disconnectedTime = millis();  // Mark the time of disconnection
        }

        if (millis() - disconnectedTime >= 5000) {  // Flash only if disconnected for 5+ seconds
            if (currentMillis - yellowLightStartTime >= 500) {
                yellowLightStartTime = currentMillis;
                yellowLightState = !yellowLightState;
                digitalWrite(yellowLight, yellowLightState);
                if (debug){
                    addLogEntry("MQTT disconnect detected, yellow light flashing due to 5s disconnection.");
                }
            }
        }

        if (millis() - lastAttemptTime >= RECONNECT_INTERVAL) {
            connectToMqtt();
            lastAttemptTime = millis(); 
        }
    } 

    client.loop();
}