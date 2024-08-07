#include <Arduino.h>
// Bambu Poop Conveyor
// 8/6/24 - TZ
char version[10] = "1.2.2";

#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

//---- SETTINGS YOU SHOULD ENTER --------------------------------------------------------------------------------------------------------------------------

// WiFi credentials // ENTER YOUR INFO HERE
char ssid[40] = "Enter your WIFI ID";
char password[40] = "Enter your WIFI Password";

// MQTT credentials
char mqtt_server[40] = "Enter Bambu Printer IP";         // YOUR BAMBU X1 IP ADDRESS

char mqtt_password[30] = "Enter Bambu Access Code";        // YOUR BAMBU ACCESS CODE (On your X1 Printer goto "Settings > General > Access code")
char serial_number[20] = "Enter Bambu SN"; // YOUR BAMBU SERIAL NUMBER (Can be found on the same scrreen as access code, its the "Device info" number)


// --------------------------------------------------------------------------------------------------------------------------------------------------------

// GPIO Pins
#define BLED 2 // 
const int greenLight = 19;
const int redLight = 4;
const int yellowLight = 18;

char mqtt_port[6] = "8883";
char mqtt_user[30] = "bblp";
char mqtt_topic[200];

// Poop Motor
int motor1Pin1 = 23;
int motor1Pin2 = 21;
int enable1Pin = 15;

int motorRunTime = 15000; // 15 seconds by default
int motorWaitTime = 25000; // The time to wait to run the motor. Once we see the printer is in a state that requires poop conveying, lets wait x amount of time to allow it to finish.
int delayAfterRun = 50000;


// Setting PWM properties
const int freq = 5000;
const int pwmChannel = 0;
const int resolution = 8;
int dutyCycle = 220;

const char* base64Image = "data:image/webp;base64,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"; // Use the actual Base64 string here


// Debug flag
bool debug = true;
bool autoPushAllEnabled = true;
bool pushAllCommandSent = false;
bool wifiConnected = false;
bool mqttConnected = false;

unsigned long lastAttemptTime = 0;
const unsigned long RECONNECT_INTERVAL = 15000;  // 5 seconds

unsigned int sequence_id = 20000;
unsigned long previousMillis = 0;

int printer_stage = -1;
int printer_sub_stage = -1;
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
    case -1: return "Idle";
    case 0: return "Printing";
    case 1: return "Auto Bed Leveling";
    case 2: return "Heatbed Preheating";
    case 3: return "Sweeping XY Mech Mode";
    case 4: return "Changing Filament";
    case 5: return "M400 Pause";
    case 6: return "Paused due to filament runout";
    case 7: return "Heating Hotend";
    case 8: return "Calibrating Extrusion";
    case 9: return "Scanning Bed Surface";
    case 10: return "Inspecting First Layer";
    case 11: return "Identifying Build Plate Type";
    case 12: return "Calibrating Micro Lidar";
    case 13: return "Homing Toolhead";
    case 14: return "Cleaning Nozzle Tip";
    case 15: return "Checking Extruder Temperature";
    case 16: return "Printing was paused by the user";
    case 17: return "Pause of front cover falling";
    case 18: return "Calibrating Micro Lidar";
    case 19: return "Calibrating Extrusion Flow";
    case 20: return "Paused due to nozzle temperature malfunction";
    case 21: return "Paused due to heat bed temperature malfunction";
    case 22: return "Filament unloading";
    case 23: return "Skip step pause";
    case 24: return "Filament loading";
    case 25: return "Motor noise calibration";
    case 26: return "Paused due to AMS lost";
    case 27: return "Paused due to low speed of the heat break fan";
    case 28: return "Paused due to chamber temperature control error";
    case 29: return "Cooling chamber";
    case 30: return "Paused by the Gcode inserted by user";
    case 31: return "Motor noise showoff";
    case 32: return "Nozzle filament covered detected pause";
    case 33: return "Cutter error pause";
    case 34: return "First layer error pause";
    case 35: return "Nozzle clog pause";
    default: return "Unknown stage";
  }
}

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
        digitalWrite(redLight, HIGH);
        delay(500);
        digitalWrite(redLight, LOW);
        delay(500);
        digitalWrite(redLight, HIGH);
        digitalWrite(greenLight, LOW);

        // Move the DC motor forward at maximum speed
        if (debug) Serial.println("Moving Forward");
        digitalWrite(motor1Pin1, LOW);
        digitalWrite(motor1Pin2, HIGH);
        delay(motorRunTime);

        // Stop the DC motor
        if (debug) Serial.println("Motor stopped");
        digitalWrite(motor1Pin1, LOW);
        digitalWrite(motor1Pin2, LOW);
        delay(1000);
        digitalWrite(redLight, LOW);
        delay(500);
        digitalWrite(greenLight, HIGH);
    }
}


// Function to handle the root URL
void handleRoot() {
  server.send(200, "text/plain", "Motor activated");
  digitalWrite(redLight, HIGH);
  delay(500);
  digitalWrite(redLight, LOW);
  delay(500);
  digitalWrite(redLight, HIGH);
  digitalWrite(greenLight, LOW);

  // Move the DC motor forward at maximum speed
  if (debug) Serial.println("Moving Forward");
  digitalWrite(motor1Pin1, LOW);
  digitalWrite(motor1Pin2, HIGH);
  delay(10000);

  // Stop the DC motor
  if (debug) Serial.println("Motor stopped");
  digitalWrite(motor1Pin1, LOW);
  digitalWrite(motor1Pin2, LOW);
  delay(1000);
  digitalWrite(redLight, LOW);
  delay(500);
  digitalWrite(greenLight, HIGH);
}




// Function to handle the config URL
void handleConfig() {
  if (server.method() == HTTP_GET) {
  String html = "<!DOCTYPE html><html><head><title>Bambu Poop Conveyor</title>";
  html += "<style>";
  html += "body { font-family: Arial, sans-serif; background-color: #d1cdba; color: #333; text-align: center; margin: 0; padding: 0; }";
  html += ".container { max-width: 600px; margin: 5px auto; background: #fff; padding: 20px; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }";
  html += ".logo img { width: 100px; height: auto; margin-bottom: 0px; }";
  html += "h2 { font-size: 24px; margin-bottom: 20px; }";
  html += ".info { text-align: left; }";
  html += ".info label { display: block; margin: 10px 0 5px; font-weight: bold; }";
  html += ".info input { width: calc(100% - 20px); padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; }";
  html += "form { margin-top: 20px; }";
  html += "input[type=submit] { padding: 10px 20px; border: none; border-radius: 5px; background-color: #28a745; color: white; cursor: pointer; }";
  html += "input[type=submit]:hover { background-color: #218838; }";
  html += "</style>";
  html += "</head><body>";
  html += "<div class=\"logo\"><img src=\"" + String(base64Image) + "\" alt=\"Bambu Conveyor Logo\"></div>";
  html += "<div class=\"container\">";
  html += "<h2>Bambu Poop Conveyor v" + String(version) + "</h2>";
  html += "<form action=\"/config\" method=\"POST\" class=\"info\">";
  html += "<label for=\"ssid\">SSID:</label><input type=\"text\" id=\"ssid\" name=\"ssid\" value=\"" + String(ssid) + "\"><br>";
  html += "<label for=\"password\">Password:</label><input type=\"text\" id=\"password\" name=\"password\" value=\"" + String(password) + "\"><br>";
  html += "<label for=\"mqtt_server\">MQTT Server:</label><input type=\"text\" id=\"mqtt_server\" name=\"mqtt_server\" value=\"" + String(mqtt_server) + "\"><br>";
  html += "<label for=\"mqtt_password\">MQTT Password:</label><input type=\"text\" id=\"mqtt_password\" name=\"mqtt_password\" value=\"" + String(mqtt_password) + "\"><br>";
  html += "<label for=\"serial_number\">Serial Number:</label><input type=\"text\" id=\"serial_number\" name=\"serial_number\" value=\"" + String(serial_number) + "\"><br>";
  html += "<label for=\"motorRunTime\">Motor Run Time (ms) <p><sub>How long the motor runs:</sub></p></label><input type=\"number\" id=\"motorRunTime\" name=\"motorRunTime\" value=\"" + String(motorRunTime) + "\"><br>";
  html += "<label for=\"motorWaitTime\">Motor Wait Time (ms) <p><sub>How long does the motor wait to run after detected poop state, set lower to run sooner, set higher if running before it poops:</sub></p></label><input type=\"number\" id=\"motorWaitTime\" name=\"motorWaitTime\" value=\"" + String(motorWaitTime) + "\"><br>";
  html += "<label for=\"delayAfterRun\">Delay After Run (ms) <p><sub>How long to wait after a run, set higher to avoid duplicate detection:</sub></p></label><input type=\"number\" id=\"delayAfterRun\" name=\"delayAfterRun\" value=\"" + String(delayAfterRun) + "\"><br>";
  html += "<label for=\"debug\">Serial Monitor Debug:</label><input type=\"checkbox\" id=\"debug\" name=\"debug\" " + String(debug ? "checked" : "") + "><br>";
  html += "<input type=\"submit\" value=\"Save\">";
  html += "</form></div></body></html>";

    server.send(200, "text/html", html);
  } else if (server.method() == HTTP_POST) {
    strcpy(ssid, server.arg("ssid").c_str());
    strcpy(password, server.arg("password").c_str());
    strcpy(mqtt_server, server.arg("mqtt_server").c_str());
    strcpy(mqtt_password, server.arg("mqtt_password").c_str());
    strcpy(serial_number, server.arg("serial_number").c_str());
    motorRunTime = server.arg("motorRunTime").toInt();
    motorWaitTime = server.arg("motorWaitTime").toInt();
    delayAfterRun = server.arg("delayAfterRun").toInt();
    debug = server.hasArg("debug");

    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    preferences.putString("mqtt_server", mqtt_server);
    preferences.putString("mqtt_password", mqtt_password);
    preferences.putString("serial_number", serial_number);
    preferences.putInt("motorRunTime", motorRunTime);
    preferences.putInt("motorWaitTime", motorWaitTime);
    preferences.putInt("delayAfterRun", delayAfterRun);
    preferences.putBool("debug", debug);

    server.send(200, "text/html", "<h1>Settings saved. Device rebooting.</h1><br><a href=\"/config\">Click here to return to config page</a>");

    // Restart ESP to apply new settings
    delay(1000);
    ESP.restart();
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (length == 2 && payload[0] == '{' && payload[1] == '}') {
    if (debug) {
      Serial.println("Empty message received.");
    }
    return;
  }

  DynamicJsonDocument doc(20000);
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    if (debug) {
      Serial.print(F("deserializeJson() failed: "));
      Serial.println(error.c_str());
    }
    return;
  }

  if (doc.containsKey("print") && doc["print"].containsKey("stg_cur")) {
    printer_stage = doc["print"]["stg_cur"].as<int>();
  }

  if (doc.containsKey("print") && doc["print"].containsKey("mc_print_sub_stage")) {
    printer_sub_stage = doc["print"]["mc_print_sub_stage"].as<int>();
  }

  unsigned int received_sequence_id = doc["print"]["sequence_id"].as<unsigned int>();

  if (doc.containsKey("print") && doc["print"].containsKey("stg_cur")) {
    printer_stage = doc["print"]["stg_cur"].as<int>();
    printer_sub_stage = doc["print"]["mc_print_sub_stage"].as<int>();
    const char* stage_description = getStageInfo(printer_stage);
    if (doc.containsKey("print") && doc["print"].containsKey("print_real_action")) {
      printer_real_stage = doc["print"]["print_real_action"].as<String>();
    }
    if (debug) {
      Serial.println("--------------------------------------------------------");
      Serial.print("Bambu Poop Conveyor v");
      Serial.print(version);
      Serial.print(" | Wifi: ");
      Serial.println(WiFi.localIP());
      Serial.print("Current Print Stage: ");
      Serial.print(stage_description);
      Serial.print(" | Sub stage: ");
      Serial.println(getStageInfo(printer_sub_stage));
      
    }
    // Run on 4 (Change filament) or 8 (calibrating) - 8 is used because its the last step of start process, should of pooped by now
    if (printer_stage == 4 || printer_stage == 8 || printer_sub_stage == 4 && printer_stage != -1) {
      // About to poop
      if (debug) Serial.println("About to poop; Pausing 30 seconds..");
      digitalWrite(yellowLight, HIGH);
      delay(motorWaitTime);
      
      // Yellow light flashing
      digitalWrite(yellowLight, LOW);
      delay(500);
      digitalWrite(yellowLight, HIGH);
      delay(500);
      digitalWrite(yellowLight, LOW);
      delay(500);
      digitalWrite(yellowLight, HIGH);
      delay(500);
      digitalWrite(yellowLight, LOW);
      delay(500);

      digitalWrite(redLight, HIGH);
      delay(500);
      digitalWrite(redLight, LOW);
      delay(500);
      digitalWrite(redLight, HIGH);
      digitalWrite(greenLight, LOW);

      // Move the DC motor forward at maximum speed
      if (debug) Serial.println("Moving Forward");
      
      digitalWrite(motor1Pin1, LOW);
      digitalWrite(motor1Pin2, HIGH);
      delay(motorRunTime);

      // Stop the DC motor
      if (debug) Serial.println("Motor stopped");
      digitalWrite(motor1Pin1, LOW);
      digitalWrite(motor1Pin2, LOW);
      delay(1000);
      digitalWrite(redLight, LOW);
      delay(500);
      digitalWrite(greenLight, HIGH);

      delay(delayAfterRun);
    }
  }

  if (doc.containsKey("print")) {
    JsonObject printObject = doc["print"];
  }
}

void connectToMqtt() {
  while (!client.connected()) {
    if (debug) Serial.print("Connecting to MQTT...");
    if (client.connect("ESP32Client", mqtt_user, mqtt_password)) {
      if (debug) Serial.println("Connected to Bambu X1");
      sprintf(mqtt_topic, "device/%s/report", serial_number);

      client.subscribe(mqtt_topic);
      publishPushAllMessage();
    } else {
      if (debug) {
        Serial.print("Failed: ");
        Serial.print(client.state());
        Serial.println(" try again in 5 seconds");
      }
      delay(5000);
    }
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

    if (debug) {
      Serial.println("JSON message to send: " + jsonMessage);
    }

    bool success = client.publish(publish_topic, jsonMessage.c_str());

    if (success) {
      if (debug) {
        Serial.print("Message successfully sent to: ");
        Serial.println(publish_topic);
      }
    } else {
      if (debug) Serial.println("Failed to send message.");
    }

    if (debug) {
      Serial.println("client.publish() returned: " + String(success));
    }

    sequence_id++;
  } else {
    if (debug) Serial.println("Not connected to MQTT broker!");
  }
}

void publishJsonMessage(const char* jsonString) {
  if (client.connected()) {
    char publish_topic[128];
    sprintf(publish_topic, "device/%s/request", serial_number);

    if (client.publish(publish_topic, jsonString)) {
      if (debug) {
        Serial.print("Message successfully sent to: ");
        Serial.println(publish_topic);
      }

    } else {
      if (debug) Serial.println("Error sending the message.");
    }

    sequence_id++;
  } else {
    if (debug) Serial.println("Not connected to MQTT broker!");
  }
}

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
    if (debug) Serial.println("MQTT Callback sent - Sendpushallcommand");
    client.publish(mqtt_topic_request.c_str(), payload.c_str());
    pushAllCommandSent = true;
  }
}

void setup() {
  // Initialize GPIO pins
  pinMode(motor1Pin1, OUTPUT);
  pinMode(motor1Pin2, OUTPUT);
  pinMode(enable1Pin, OUTPUT);
  pinMode(BLED, OUTPUT);
  pinMode(yellowLight, OUTPUT);
  pinMode(redLight, OUTPUT);
  pinMode(greenLight, OUTPUT);
  
  // Start the Serial communication
  Serial.begin(115200);
  client.setBufferSize(20000);

  // Configure LED PWM functionalities
  ledcSetup(pwmChannel, freq, resolution);
  ledcAttachPin(enable1Pin, pwmChannel);
  ledcWrite(pwmChannel, dutyCycle);

  // Start Preferences
  preferences.begin("my-config", false);

  // Load stored preferences, use default values if not set
  preferences.getString("ssid", ssid, sizeof(ssid));
  preferences.getString("password", password, sizeof(password));
  preferences.getString("mqtt_server", mqtt_server, sizeof(mqtt_server));
  preferences.getString("mqtt_password", mqtt_password, sizeof(mqtt_password));
  preferences.getString("serial_number", serial_number, sizeof(serial_number));
  delayAfterRun = preferences.getInt("delayAfterRun", delayAfterRun);
  motorRunTime = preferences.getInt("motorRunTime", motorRunTime);
  motorWaitTime = preferences.getInt("motorWaitTime", motorWaitTime);
  debug = preferences.getBool("debug", debug);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  if (debug) Serial.print("Connecting to WiFi ..");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(greenLight, LOW);
    digitalWrite(yellowLight, HIGH);
    delay(1000);
    digitalWrite(yellowLight, LOW);
    if (debug) Serial.print('.');
  }

  digitalWrite(greenLight, HIGH);
  
  if (debug) {
    Serial.println();
    Serial.print("Connected to WiFi. IP address: ");
    Serial.println(WiFi.localIP());
  }

  // Configure MQTT
  client.setServer(mqtt_server, 8883); // Assuming default MQTT port 8883
  espClient.setInsecure();
  client.setCallback(mqttCallback);
  sprintf(mqtt_topic, "device/%s/report", serial_number);

  // Define the root URL
  server.on("/", handleRoot);

  // Define control page
  server.on("/control", handleControl);

  // Define the config URL
  server.on("/config", handleConfig);

  // Start the server
  server.begin();
  if (debug) Serial.println("Web server started.");

  // Send push all command at startup
  sendPushAllCommand();
}

void loop() {
  server.handleClient();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnected) {
      wifiConnected = true;
      pushAllCommandSent = false;
    }
  } else {
    wifiConnected = false;
  }

  if (client.connected()) {
    if (!mqttConnected) {
      mqttConnected = true;
      sendPushAllCommand();
      pushAllCommandSent = true;
    }
  } else {
    mqttConnected = false;
  }

  if (!client.connected() && (millis() - lastAttemptTime) > RECONNECT_INTERVAL) {
    if (client.connect("BambuPoopConveyor", mqtt_user, mqtt_password)) {
      

      client.subscribe(mqtt_topic);
    } else {
      if (debug) {
        Serial.print("Error connecting to MQTT: ");
        Serial.println(client.state());
      }
      lastAttemptTime = millis();
    }
  }

  if (autoPushAllEnabled) {
    unsigned long currentMillis = millis();
    if (currentMillis - previousMillis >= 30000) {  
      previousMillis = currentMillis;

      if (client.connected()) {
        if (debug) Serial.println("Requesting pushAll...");
        publishPushAllMessage();
      }
    }
  }

  client.loop();
}
