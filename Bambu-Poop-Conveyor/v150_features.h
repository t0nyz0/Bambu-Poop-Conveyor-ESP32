#pragma once

// v1.5 features live beside the original motor/LED state machine. Keeping this
// layer separate makes it much harder for UI work to change proven hardware timing.

enum TriggerSource : uint8_t { TRIGGER_STAGE = 0, TRIGGER_SUBSTAGE = 1, TRIGGER_GCODE_STATE = 2 };

struct TriggerRule {
    TriggerSource source;
    int16_t value;
    char state[12];
    bool enabled;
    bool oncePerPrint;
    unsigned long waitMs;
    unsigned long runMs;
    unsigned long cooldownMs;
    bool eventActive;
    bool firedThisPrint;
    bool pending;
};

const size_t MAX_TRIGGER_RULES = 16;
TriggerRule triggerRules[MAX_TRIGGER_RULES];
size_t triggerRuleCount = 0;

const char* const GCODE_STATES[] = {"FAILED", "FINISH", "IDLE", "INIT", "OFFLINE", "PAUSE", "PREPARE", "RUNNING", "SLICING", "UNKNOWN"};
const size_t GCODE_STATE_COUNT = sizeof(GCODE_STATES) / sizeof(GCODE_STATES[0]);

unsigned long activeMotorRunTime = 0;
unsigned long activeMotorWaitTime = 0;
unsigned long activeDelayAfterRun = 0;
bool restartScheduled = false;
unsigned long restartAt = 0;
bool firmwareUploadStarted = false;
bool firmwareUploadValid = false;
String firmwareUploadError;
uint32_t bootId = 0;
bool printWasActive = false;

static unsigned long bounded(JsonVariantConst value, unsigned long fallback, unsigned long minimum, unsigned long maximum) {
    if (value.isNull()) return fallback;
    long long parsed = value.as<long long>();
    if (parsed < (long long)minimum) return minimum;
    if (parsed > (long long)maximum) return maximum;
    return (unsigned long)parsed;
}

static void copyBounded(char* destination, size_t capacity, const String& source) {
    if (!capacity) return;
    strlcpy(destination, source.c_str(), capacity);
}

static void sendJson(int status, JsonDocument& doc) {
    String body;
    serializeJson(doc, body);
    server.sendHeader("Cache-Control", "no-store");
    server.send(status, "application/json", body);
}

static void sendError(int status, const String& message) {
    StaticJsonDocument<192> doc;
    doc["ok"] = false;
    doc["error"] = message;
    sendJson(status, doc);
}

static String motorStateName() {
    if (motorRunning) return "Running";
    if (motorWaiting) return "Waiting";
    if (delayAfterRunning) return "Cooldown";
    return "Idle";
}

static unsigned long motorRemainingMs() {
    unsigned long elapsed = 0;
    unsigned long duration = 0;
    if (motorWaiting) { elapsed = millis() - motorWaitStartTime; duration = activeMotorWaitTime + additionalWaitTime; }
    else if (motorRunning) { elapsed = millis() - motorRunStartTime; duration = activeMotorRunTime; }
    else if (delayAfterRunning) { elapsed = millis() - delayAfterRunStartTime; duration = activeDelayAfterRun; }
    return elapsed >= duration ? 0 : duration - elapsed;
}

static bool isPrintActive(const String& state) {
    return state.equalsIgnoreCase("RUNNING") || state.equalsIgnoreCase("PREPARE") ||
           state.equalsIgnoreCase("PAUSE") || state.equalsIgnoreCase("SLICING");
}

static void resetPrintRuleLatchesIfNeeded() {
    bool active = isPrintActive(gcodeState);
    if (active && !printWasActive) {
        for (size_t i = 0; i < triggerRuleCount; i++) triggerRules[i].firedThisPrint = false;
    }
    printWasActive = active;
}

static int effectivePrinterStage() {
    // Bambu printers can briefly report stage 0 while print_type says idle.
    if (printer_stage == 0 && printerPrintType.equalsIgnoreCase("idle")) return 255;
    return printer_stage;
}

static const char* triggerSourceName(TriggerSource source) {
    if (source == TRIGGER_STAGE) return "stage";
    if (source == TRIGGER_SUBSTAGE) return "substage";
    return "gcode_state";
}

static String triggerRuleLabel(const TriggerRule& rule) {
    if (rule.source == TRIGGER_STAGE) return "Stage " + String(rule.value) + " · " + String(getStageInfo(rule.value));
    if (rule.source == TRIGGER_SUBSTAGE) return "Substage " + String(rule.value);
    return "Print state · " + String(rule.state);
}

static bool validGcodeState(const String& state) {
    for (size_t i = 0; i < GCODE_STATE_COUNT; i++) if (state.equalsIgnoreCase(GCODE_STATES[i])) return true;
    return false;
}

static bool triggerCondition(const TriggerRule& rule) {
    if (rule.source == TRIGGER_STAGE) return effectivePrinterStage() == rule.value;
    if (rule.source == TRIGGER_SUBSTAGE) {
        int stage = effectivePrinterStage();
        return printer_sub_stage == rule.value && stage != -1 && stage != 255;
    }
    return gcodeState.equalsIgnoreCase(rule.state);
}

static void scheduleMotorRun(unsigned long waitMs, unsigned long runMs, unsigned long cooldownMs, const String& source) {
    activeMotorWaitTime = waitMs;
    activeMotorRunTime = runMs;
    activeDelayAfterRun = cooldownMs;
    additionalWaitTime = 0;
    motorWaiting = true;
    motorWaitStartTime = millis();
    yellowLightStartTime = millis();
    yellowLightState = HIGH;
    digitalWrite(yellowLight, yellowLightState);
    addLogEntry(source);
}

// Substage rules retain priority when events overlap, matching v1.4 behavior.
static void evaluateTriggerRules() {
    resetPrintRuleLatchesIfNeeded();
    bool conveyorBusy = motorWaiting || motorRunning || delayAfterRunning;
    for (size_t i = 0; i < triggerRuleCount; i++) {
        TriggerRule& rule = triggerRules[i];
        bool active = triggerCondition(rule);
        bool risingEdge = active && !rule.eventActive;
        rule.eventActive = active;
        if (!rule.enabled) { rule.pending = false; continue; }
        // v1.4 ignored new printer events while waiting, running, or cooling down.
        // Preserve that behavior so a status cannot cause a surprise delayed run.
        if (risingEdge && !conveyorBusy && !(rule.oncePerPrint && rule.firedThisPrint)) rule.pending = true;
    }
    if (conveyorBusy) return;
    const TriggerSource priority[] = {TRIGGER_SUBSTAGE, TRIGGER_STAGE, TRIGGER_GCODE_STATE};
    for (TriggerSource source : priority) {
        for (size_t i = 0; i < triggerRuleCount; i++) {
            TriggerRule& rule = triggerRules[i];
            if (!rule.pending || rule.source != source) continue;
            // Multiple statuses may arrive in one MQTT message. Run only the
            // highest-priority match, as the original combined condition did.
            for (size_t clear = 0; clear < triggerRuleCount; clear++) triggerRules[clear].pending = false;
            rule.firedThisPrint = true;
            String label = triggerRuleLabel(rule);
            scheduleMotorRun(rule.waitMs, rule.runMs, rule.cooldownMs, "Trigger: " + label);
            if (debug) Serial.println("Trigger detected: " + label);
            return;
        }
    }
}

static void stopMotorNow(const String& source) {
    motorWaiting = false;
    motorRunning = false;
    delayAfterRunning = false;
    additionalWaitTime = 0;
    digitalWrite(motor1Pin1, LOW);
    digitalWrite(motor1Pin2, LOW);
    digitalWrite(redLight, LOW);
    digitalWrite(yellowLight, LOW);
    digitalWrite(greenLight, HIGH);
    addLogEntry(source);
}

static void initializeRule(TriggerRule& rule, TriggerSource source, int value, const char* state,
                           bool enabled, unsigned long waitMs, unsigned long runMs, unsigned long cooldownMs) {
    memset(&rule, 0, sizeof(rule));
    rule.source = source;
    rule.value = value;
    copyBounded(rule.state, sizeof(rule.state), String(state ? state : ""));
    rule.enabled = enabled;
    rule.waitMs = waitMs;
    rule.runMs = runMs;
    rule.cooldownMs = cooldownMs;
}

static void saveTriggerRules() {
    preferences.begin("trigger-v2", false);
    preferences.putUChar("schema", 2);
    preferences.putUChar("count", triggerRuleCount);
    for (size_t i = 0; i < triggerRuleCount; i++) {
        String prefix = "r" + String(i);
        preferences.putUChar((prefix + "src").c_str(), triggerRules[i].source);
        preferences.putShort((prefix + "val").c_str(), triggerRules[i].value);
        preferences.putString((prefix + "state").c_str(), triggerRules[i].state);
        preferences.putBool((prefix + "en").c_str(), triggerRules[i].enabled);
        preferences.putBool((prefix + "pp").c_str(), triggerRules[i].oncePerPrint);
        preferences.putULong((prefix + "wait").c_str(), triggerRules[i].waitMs);
        preferences.putULong((prefix + "run").c_str(), triggerRules[i].runMs);
        preferences.putULong((prefix + "cool").c_str(), triggerRules[i].cooldownMs);
    }
    preferences.end();
}

static void loadTriggerRules() {
    preferences.begin("trigger-v2", true);
    bool hasDynamicRules = preferences.getUChar("schema", 0) == 2;
    if (hasDynamicRules) {
        triggerRuleCount = min((size_t)preferences.getUChar("count", 0), MAX_TRIGGER_RULES);
        for (size_t i = 0; i < triggerRuleCount; i++) {
            String prefix = "r" + String(i);
            TriggerSource source = (TriggerSource)preferences.getUChar((prefix + "src").c_str(), TRIGGER_STAGE);
            int value = preferences.getShort((prefix + "val").c_str(), 0);
            String state = preferences.getString((prefix + "state").c_str(), "");
            initializeRule(triggerRules[i], source, value, state.c_str(), preferences.getBool((prefix + "en").c_str(), true),
                           preferences.getULong((prefix + "wait").c_str(), motorWaitTime),
                           preferences.getULong((prefix + "run").c_str(), motorRunTime),
                           preferences.getULong((prefix + "cool").c_str(), delayAfterRun));
            triggerRules[i].oncePerPrint = preferences.getBool((prefix + "pp").c_str(), false);
        }
    }
    preferences.end();

    if (hasDynamicRules) return;

    // First dynamic-rule boot: preserve all three v1.5/v1.4 migrated rules exactly.
    triggerRuleCount = 3;
    initializeRule(triggerRules[0], TRIGGER_STAGE, 14, "", true, motorWaitTime, motorRunTime, delayAfterRun);
    initializeRule(triggerRules[1], TRIGGER_STAGE, 4, "", !onlyRunAtStart, motorWaitTime, motorRunTime, delayAfterRun);
    initializeRule(triggerRules[2], TRIGGER_SUBSTAGE, 4, "", !onlyRunAtStart, motorWaitTime + 75000UL, motorRunTime, delayAfterRun);
    preferences.begin("trigger-rules", true);
    if (preferences.getBool("migrated", false)) {
        for (size_t i = 0; i < 3; i++) {
            String prefix = "r" + String(i);
            triggerRules[i].enabled = preferences.getBool((prefix + "en").c_str(), triggerRules[i].enabled);
            triggerRules[i].oncePerPrint = preferences.getBool((prefix + "pp").c_str(), false);
            triggerRules[i].waitMs = preferences.getULong((prefix + "wait").c_str(), triggerRules[i].waitMs);
            triggerRules[i].runMs = preferences.getULong((prefix + "run").c_str(), triggerRules[i].runMs);
            triggerRules[i].cooldownMs = preferences.getULong((prefix + "cool").c_str(), triggerRules[i].cooldownMs);
        }
    }
    preferences.end();
    saveTriggerRules();
}

static void serveWebUi() {
    server.sendHeader("Content-Encoding", "gzip");
    server.sendHeader("Cache-Control", "no-cache");
    server.send_P(200, "text/html; charset=utf-8", (PGM_P)WEB_UI_GZIP, WEB_UI_GZIP_LEN);
}

static void handleApiHealth() {
    StaticJsonDocument<256> doc;
    doc["ok"] = true;
    doc["version"] = version;
    doc["displayVersion"] = displayVersion;
    doc["bootId"] = bootId;
    doc["hostname"] = DEVICE_HOSTNAME;
    doc["ip"] = isAPMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
    doc["uptimeMs"] = millis();
    sendJson(200, doc);
}

static void handleApiStatus() {
    DynamicJsonDocument doc(1536);
    doc["ok"] = true;
    doc["version"] = version;
    doc["displayVersion"] = displayVersion;
    doc["bootId"] = bootId;
    doc["hostname"] = DEVICE_HOSTNAME;
    doc["mdns"] = String(DEVICE_MDNS) + ".local";
    doc["ip"] = isAPMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
    doc["uptimeMs"] = millis();
    doc["mode"] = operationMode;
    JsonObject wifi = doc.createNestedObject("wifi");
    wifi["connected"] = WiFi.status() == WL_CONNECTED;
    wifi["ssid"] = isAPMode ? "BambuConveyor" : String(ssid);
    wifi["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
    JsonObject system = doc.createNestedObject("system");
    system["freeHeap"] = ESP.getFreeHeap();
    system["minFreeHeap"] = ESP.getMinFreeHeap();
    system["heapSize"] = ESP.getHeapSize();
    system["cpuMHz"] = ESP.getCpuFreqMHz();
    system["cpuCores"] = ESP.getChipCores();
    JsonObject mqtt = doc.createNestedObject("mqtt");
    mqtt["connected"] = client.connected();
    JsonObject printer = doc.createNestedObject("printer");
    printer["stage"] = effectivePrinterStage();
    printer["rawStage"] = printer_stage;
    printer["subStage"] = printer_sub_stage;
    printer["stageDescription"] = getStageInfo(effectivePrinterStage());
    printer["subStageDescription"] = getStageInfo(printer_sub_stage);
    printer["gcodeState"] = gcodeState;
    printer["printType"] = printerPrintType;
    JsonObject motor = doc.createNestedObject("motor");
    motor["state"] = motorStateName();
    motor["running"] = motorRunning;
    motor["waiting"] = motorWaiting;
    motor["cooldown"] = delayAfterRunning;
    motor["remainingMs"] = motorRemainingMs();
    JsonObject leds = doc.createNestedObject("leds");
    leds["green"] = digitalRead(greenLight) == HIGH;
    leds["yellow"] = digitalRead(yellowLight) == HIGH;
    leds["red"] = digitalRead(redLight) == HIGH;
    sendJson(200, doc);
}

static void handleApiConfigGet() {
    DynamicJsonDocument doc(1024);
    doc["ok"] = true;
    doc["operationMode"] = operationMode;
    doc["gmtOffset"] = gmtOffset_sec;
    doc["ssid"] = ssid;
    doc["wifiPasswordSet"] = strlen(password) > 0;
    doc["printerIp"] = mqtt_server;
    doc["accessCodeSet"] = strlen(mqtt_password) > 0;
    doc["serialNumber"] = serial_number;
    doc["printerModel"] = printer_model;
    doc["debug"] = debug;
    JsonObject motor = doc.createNestedObject("motor");
    motor["runMs"] = motorRunTime;
    motor["waitMs"] = motorWaitTime;
    motor["cooldownMs"] = delayAfterRun;
    motor["speed"] = dutyCycle;
    motor["direction"] = motorDirection;
    sendJson(200, doc);
}

static void handleApiConfigPost() {
    DynamicJsonDocument request(1536);
    DeserializationError error = deserializeJson(request, server.arg("plain"));
    if (error) return sendError(400, "Invalid settings data");
    String newSsid = request["ssid"] | String(ssid);
    String newMode = request["operationMode"] | String(operationMode);
    String newPrinterIp = request["printerIp"] | String(mqtt_server);
    String newSerial = request["serialNumber"] | String(serial_number);
    String newModel = request["printerModel"] | String(printer_model);
    if (newSsid.length() > 49 || newPrinterIp.length() > 39 || newSerial.length() > 34 || newModel.length() > 4)
        return sendError(422, "One or more settings are too long");
    if (newMode != "mqtt" && newMode != "motion") return sendError(422, "Unknown operation mode");

    bool rebootNeeded = newSsid != ssid || newMode != operationMode || newPrinterIp != mqtt_server || newSerial != serial_number;
    copyBounded(ssid, sizeof(ssid), newSsid);
    copyBounded(operationMode, sizeof(operationMode), newMode);
    copyBounded(mqtt_server, sizeof(mqtt_server), newPrinterIp);
    copyBounded(serial_number, sizeof(serial_number), newSerial);
    copyBounded(printer_model, sizeof(printer_model), newModel);
    String newPassword = request["wifiPassword"] | "";
    String newAccessCode = request["accessCode"] | "";
    if (newPassword.length() > 49 || newAccessCode.length() > 29) return sendError(422, "A password is too long");
    if (newPassword.length()) { copyBounded(password, sizeof(password), newPassword); rebootNeeded = true; }
    if (newAccessCode.length()) { copyBounded(mqtt_password, sizeof(mqtt_password), newAccessCode); rebootNeeded = true; }
    useMotionSensor = newMode == "motion";
    gmtOffset_sec = constrain((int)(request["gmtOffset"] | gmtOffset_sec), -12, 14);
    debug = request["debug"] | debug;
    JsonObjectConst motor = request["motor"];
    motorWaitTime = bounded(motor["waitMs"], motorWaitTime, 0, 600000);
    motorRunTime = bounded(motor["runMs"], motorRunTime, 100, 120000);
    delayAfterRun = bounded(motor["cooldownMs"], delayAfterRun, 0, 3600000);
    dutyCycle = bounded(motor["speed"], dutyCycle, 0, 255);
    motorDirection = bounded(motor["direction"], motorDirection, 0, 1);

    preferences.begin("my-config", false);
    preferences.putString("ssid", ssid); preferences.putString("password", password);
    preferences.putString("mqtt_server", mqtt_server); preferences.putString("mqtt_password", mqtt_password);
    preferences.putString("serial_number", serial_number); preferences.putString("operationMode", operationMode);
    preferences.putString("printer_model", printer_model); preferences.putInt("gmtOffset_sec", gmtOffset_sec);
    preferences.putInt("motorRunTime", motorRunTime); preferences.putInt("motorWaitTime", motorWaitTime);
    preferences.putInt("delayAfterRun", delayAfterRun); preferences.putInt("motorDirection", motorDirection);
    preferences.putInt("dutyCycle", dutyCycle); preferences.putBool("debug", debug);
    preferences.end();
    ledcWrite(enable1Pin, dutyCycle);
    StaticJsonDocument<160> response;
    response["ok"] = true; response["rebooting"] = rebootNeeded; response["rebootInMs"] = rebootNeeded ? 1800 : 0;
    sendJson(200, response);
    if (rebootNeeded) { restartScheduled = true; restartAt = millis() + 1800; }
}

static void addRuleJson(JsonArray target, const TriggerRule& rule) {
    JsonObject object = target.createNestedObject();
    object["source"] = triggerSourceName(rule.source); object["value"] = rule.value; object["state"] = rule.state;
    object["label"] = triggerRuleLabel(rule); object["enabled"] = rule.enabled;
    object["oncePerPrint"] = rule.oncePerPrint; object["waitMs"] = rule.waitMs;
    object["runMs"] = rule.runMs; object["cooldownMs"] = rule.cooldownMs;
}

static void handleApiTriggersGet() {
    DynamicJsonDocument doc(4096);
    doc["ok"] = true;
    doc["maxRules"] = MAX_TRIGGER_RULES;
    JsonObject defaults = doc.createNestedObject("defaults");
    defaults["waitMs"] = motorWaitTime; defaults["runMs"] = motorRunTime; defaults["cooldownMs"] = delayAfterRun;
    JsonArray rules = doc.createNestedArray("rules");
    for (size_t i = 0; i < triggerRuleCount; i++) addRuleJson(rules, triggerRules[i]);
    sendJson(200, doc);
}

static bool parseTriggerSource(const String& source, TriggerSource& parsed) {
    if (source == "stage") { parsed = TRIGGER_STAGE; return true; }
    if (source == "substage") { parsed = TRIGGER_SUBSTAGE; return true; }
    if (source == "gcode_state") { parsed = TRIGGER_GCODE_STATE; return true; }
    return false;
}

static bool sameTriggerCondition(const TriggerRule& left, const TriggerRule& right) {
    if (left.source != right.source) return false;
    if (left.source == TRIGGER_GCODE_STATE) return strcasecmp(left.state, right.state) == 0;
    return left.value == right.value;
}

static void handleApiTriggersPost() {
    DynamicJsonDocument request(8192);
    if (deserializeJson(request, server.arg("plain"))) return sendError(400, "Invalid trigger data");
    JsonArrayConst rules = request["rules"];
    if (rules.isNull()) return sendError(422, "Missing trigger rules");
    if (rules.size() > MAX_TRIGGER_RULES) return sendError(422, "Too many trigger rules");
    TriggerRule incomingRules[MAX_TRIGGER_RULES];
    size_t incomingCount = 0;
    for (JsonObjectConst incoming : rules) {
        TriggerSource source;
        if (!parseTriggerSource(incoming["source"] | "", source)) return sendError(422, "Unknown trigger source");
        int value = incoming["value"] | 0;
        String state = incoming["state"] | "";
        if (source == TRIGGER_STAGE && !((value >= 0 && value <= 77) || value == -1 || value == 255))
            return sendError(422, "Unknown printer stage");
        if (source == TRIGGER_SUBSTAGE && (value < 0 || value > 255)) return sendError(422, "Substage must be between 0 and 255");
        if (source == TRIGGER_GCODE_STATE && !validGcodeState(state)) return sendError(422, "Unknown print state");
        initializeRule(incomingRules[incomingCount], source, value, state.c_str(), incoming["enabled"] | true,
                       bounded(incoming["waitMs"], motorWaitTime, 0, 600000),
                       bounded(incoming["runMs"], motorRunTime, 100, 120000),
                       bounded(incoming["cooldownMs"], delayAfterRun, 0, 3600000));
        incomingRules[incomingCount].oncePerPrint = incoming["oncePerPrint"] | false;
        for (size_t existing = 0; existing < triggerRuleCount; existing++) {
            if (sameTriggerCondition(triggerRules[existing], incomingRules[incomingCount])) {
                incomingRules[incomingCount].firedThisPrint = triggerRules[existing].firedThisPrint;
                break;
            }
        }
        for (size_t prior = 0; prior < incomingCount; prior++) {
            if (sameTriggerCondition(incomingRules[prior], incomingRules[incomingCount])) return sendError(422, "Duplicate trigger condition");
        }
        // Saving rules must not interpret the currently active printer status as a new edge.
        incomingRules[incomingCount].eventActive = triggerCondition(incomingRules[incomingCount]);
        incomingCount++;
    }
    triggerRuleCount = incomingCount;
    memcpy(triggerRules, incomingRules, sizeof(TriggerRule) * triggerRuleCount);
    saveTriggerRules();
    handleApiTriggersGet();
}

static void handleApiTriggerCatalog() {
    DynamicJsonDocument doc(8192);
    doc["ok"] = true;
    JsonArray stages = doc.createNestedArray("stages");
    for (int stage = 0; stage <= 77; stage++) {
        JsonObject item = stages.createNestedObject(); item["value"] = stage; item["label"] = getStageInfo(stage);
    }
    for (int stage : {-1, 255}) {
        JsonObject item = stages.createNestedObject(); item["value"] = stage; item["label"] = getStageInfo(stage);
    }
    JsonArray states = doc.createNestedArray("gcodeStates");
    for (size_t i = 0; i < GCODE_STATE_COUNT; i++) states.add(GCODE_STATES[i]);
    sendJson(200, doc);
}

static void handleApiMotorRun() {
    if (motorWaiting || motorRunning || delayAfterRunning) return sendError(409, "The conveyor is already active or cooling down");
    scheduleMotorRun(motorWaitTime, motorRunTime, delayAfterRun, "Motor activated from web interface");
    StaticJsonDocument<96> doc; doc["ok"] = true; doc["state"] = "Waiting"; sendJson(200, doc);
}

static void handleApiMotorStop() {
    stopMotorNow("Motor stopped from web interface");
    StaticJsonDocument<96> doc; doc["ok"] = true; doc["state"] = "Idle"; sendJson(200, doc);
}

static void handleApiClearCooldown() {
    if (motorWaiting || motorRunning) return sendError(409, "The conveyor is currently active; use Stop now if needed");
    if (!delayAfterRunning) return sendError(409, "There is no active cooldown");
    delayAfterRunning = false;
    addLogEntry("Cooldown cleared from web interface");
    StaticJsonDocument<96> doc; doc["ok"] = true; doc["state"] = "Idle"; sendJson(200, doc);
}

static void handleApiLogs() {
    DynamicJsonDocument doc(8192);
    doc["ok"] = true;
    doc["debug"] = debug;
    doc["capacity"] = MAX_LOG_ENTRIES;
    int stored = 0;
    for (int i = 0; i < MAX_LOG_ENTRIES; i++) {
        if (logs[i].timestamp) stored++;
    }
    const int maxReturned = 60;
    const int skip = stored > maxReturned ? stored - maxReturned : 0;
    int seen = 0;
    int returned = 0;
    JsonArray entries = doc.createNestedArray("entries");
    for (int i = 0; i < MAX_LOG_ENTRIES; i++) {
        int index = (logIndex + i) % MAX_LOG_ENTRIES;
        if (!logs[index].timestamp) continue;
        if (seen++ < skip) continue;
        JsonObject entry = entries.createNestedObject();
        entry["timestamp"] = (long long)logs[index].timestamp;
        entry["message"] = logs[index].action;
        returned++;
    }
    doc["count"] = stored;
    doc["returned"] = returned;
    sendJson(200, doc);
}

static void handleFirmwareUploadV150() {
    HTTPUpload& upload = server.upload();
    if (upload.status == UPLOAD_FILE_START) {
        firmwareUploadStarted = true; firmwareUploadValid = true; firmwareUploadError = "";
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) { firmwareUploadValid = false; firmwareUploadError = Update.errorString(); }
    } else if (upload.status == UPLOAD_FILE_WRITE && firmwareUploadValid) {
        if (upload.totalSize == 0 && (upload.currentSize == 0 || upload.buf[0] != 0xE9)) {
            firmwareUploadValid = false; firmwareUploadError = "The selected file is not an ESP32 application firmware"; Update.abort(); return;
        }
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
            firmwareUploadValid = false; firmwareUploadError = Update.errorString(); Update.abort();
        }
    } else if (upload.status == UPLOAD_FILE_END && firmwareUploadValid) {
        if (!Update.end(true)) { firmwareUploadValid = false; firmwareUploadError = Update.errorString(); }
    } else if (upload.status == UPLOAD_FILE_ABORTED) {
        Update.abort(); firmwareUploadValid = false; firmwareUploadError = "Upload was cancelled";
    }
}

static void handleFirmwareUploadCompleteV150() {
    if (!firmwareUploadStarted || !firmwareUploadValid || Update.hasError()) {
        String message = firmwareUploadError.length() ? firmwareUploadError : "Firmware update failed";
        firmwareUploadStarted = false;
        return sendError(500, message);
    }
    StaticJsonDocument<128> doc;
    doc["ok"] = true; doc["rebootInMs"] = 2500;
    sendJson(200, doc);
    addLogEntry("Firmware uploaded successfully; restart scheduled");
    firmwareUploadStarted = false;
    restartScheduled = true;
    restartAt = millis() + 2500;
}

static void registerV150Routes() {
    server.on("/", HTTP_GET, serveWebUi);
    server.on("/config", HTTP_GET, serveWebUi);
    server.on("/control", HTTP_GET, serveWebUi);
    server.on("/logs", HTTP_GET, serveWebUi);
    server.on("/update", HTTP_GET, serveWebUi);
    server.on("/api/health", HTTP_GET, handleApiHealth);
    server.on("/api/status", HTTP_GET, handleApiStatus);
    server.on("/api/config", HTTP_GET, handleApiConfigGet);
    server.on("/api/config", HTTP_POST, handleApiConfigPost);
    server.on("/api/triggers", HTTP_GET, handleApiTriggersGet);
    server.on("/api/triggers", HTTP_POST, handleApiTriggersPost);
    server.on("/api/trigger-catalog", HTTP_GET, handleApiTriggerCatalog);
    server.on("/api/motor/run", HTTP_POST, handleApiMotorRun);
    server.on("/api/motor/stop", HTTP_POST, handleApiMotorStop);
    server.on("/api/motor/clear-cooldown", HTTP_POST, handleApiClearCooldown);
    server.on("/api/logs", HTTP_GET, handleApiLogs);
    server.on("/update", HTTP_POST, handleFirmwareUploadCompleteV150, handleFirmwareUploadV150);
}

static void serviceScheduledRestart() {
    if (restartScheduled && (long)(millis() - restartAt) >= 0) {
        delay(25);
        ESP.restart();
    }
}

static void handleImprovConnected(const char* newSsid, const char* newPassword) {
    copyBounded(ssid, sizeof(ssid), String(newSsid));
    copyBounded(password, sizeof(password), String(newPassword));
    preferences.begin("my-config", false);
    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    preferences.end();
    addLogEntry("WiFi configured through the web installer");
    restartScheduled = true;
    restartAt = millis() + 3500;
}
