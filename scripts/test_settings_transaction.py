#!/usr/bin/env python3
"""Exercise real settings/OTA handlers with host-side server, NVS, and PWM mocks.

No network or physical device is used. ArduinoJson parses the actual payloads;
only the surrounding ESP32 services are mocked. Requires a C++17 compiler and
the locally installed PlatformIO ArduinoJson dependency.
"""
import argparse
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--source", help="Alternate feature header; use '-' for source on stdin")
args = parser.parse_args()
source = sys.stdin.read() if args.source == "-" else (
    Path(args.source) if args.source else ROOT / "Bambu-Poop-Conveyor/v150_features.h"
).read_text()
functions = []
for signature in (
    "static unsigned long bounded(",
    "static void copyBounded(",
    "static void handleApiConfigPost() {",
    "static void handleFirmwareUploadV150() {",
    "static void handleFirmwareUploadCompleteV150() {",
    "static void serviceIncompleteFirmwareUpload() {",
):
    if signature == "static void serviceIncompleteFirmwareUpload() {" and signature not in source and args.source:
        # Older revisions have no cleanup service. Preserve that old behavior
        # when proving this fixture detects their rejected-save regression.
        functions.append("static void serviceIncompleteFirmwareUpload() {}")
        continue
    start = source.index(signature)
    end = source.index("\n}\n", start) + 3
    functions.append(source[start:end])

MOCKS = r'''
#include <algorithm>
#include <cstring>
#include <iostream>
#include <map>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>
#include <ArduinoJson.h>
using String = std::string;
char ssid[50], password[50], mqtt_server[40], mqtt_password[30];
char serial_number[35], printer_model[5], operationMode[10];
bool useMotionSensor = false, debug = false;
int gmtOffset_sec = -6, motorWaitTime = 5000, motorRunTime = 10000;
int delayAfterRun = 120000, dutyCycle = 225, motorDirection = 0;
constexpr int enable1Pin = 15;
bool restartScheduled = false, firmwareUploadStarted = false, firmwareUploadValid = false;
unsigned long restartAt = 0, now = 1000;
String firmwareUploadError;
int pwmWrites = 0, appliedDuty = -1, labelCalls = 0, logCalls = 0;
unsigned long millis() { return now; }
int constrain(int value, int minimum, int maximum) { return std::max(minimum, std::min(value, maximum)); }
size_t strlcpy(char* target, const char* value, size_t capacity) {
    const auto length = strlen(value);
    if (capacity) { const auto copied = std::min(length, capacity - 1); memcpy(target, value, copied); target[copied] = 0; }
    return length;
}
void ledcWrite(int, int value) { ++pwmWrites; appliedDuty = value; }
void rememberConfiguredPrinterName() { ++labelCalls; }
void addLogEntry(const String&) { ++logCalls; }
struct PreferencesMock {
    std::map<String, String> data;
    int begins = 0, writes = 0, ends = 0;
    void begin(const char* ns, bool readOnly) {
        if (String(ns) != "my-config" || readOnly) throw std::runtime_error("unexpected NVS namespace");
        ++begins;
    }
    void putString(const char* key, const char* value) { ++writes; data[key] = value; }
    void putInt(const char* key, int value) { ++writes; data[key] = std::to_string(value); }
    void putBool(const char* key, bool value) { ++writes; data[key] = value ? "true" : "false"; }
    void end() { ++ends; }
} preferences;
enum UploadState { UPLOAD_FILE_START, UPLOAD_FILE_WRITE, UPLOAD_FILE_END, UPLOAD_FILE_ABORTED };
struct HTTPUpload {
    UploadState status = UPLOAD_FILE_START;
    size_t totalSize = 0, currentSize = 0;
    unsigned char* buf = nullptr;
};
struct ServerMock {
    String body, response;
    int status = 0, argCalls = 0;
    bool requestActive = false;
    HTTPUpload currentUpload;
    String arg(const char*) { ++argCalls; return body; }
    HTTPUpload& upload() { return currentUpload; }
    bool hasActiveRequest() const { return requestActive; }
} server;
void sendJson(int status, JsonDocument& document) {
    server.status = status; server.response.clear(); serializeJson(document, server.response);
}
void sendError(int status, const String& message) {
    StaticJsonDocument<192> document; document["ok"] = false; document["error"] = message; sendJson(status, document);
}
constexpr size_t UPDATE_SIZE_UNKNOWN = 0xFFFFFFFF;
struct UpdateMock {
    int begins = 0, writes = 0, ends = 0, aborts = 0, errorChecks = 0;
    bool failed = false, finished = false;
    bool begin(size_t) { ++begins; return !failed; }
    size_t write(unsigned char*, size_t size) { ++writes; return failed ? 0 : size; }
    bool end(bool) { ++ends; finished = !failed; return finished; }
    void abort() { ++aborts; }
    bool hasError() { ++errorChecks; return failed; }
    const char* errorString() { return "TEST UPDATE ERROR"; }
} Update;
auto snapshot() {
    return std::make_tuple(
        String(ssid), String(password), String(mqtt_server), String(mqtt_password),
        String(serial_number), String(printer_model), String(operationMode),
        useMotionSensor, debug, gmtOffset_sec, motorWaitTime, motorRunTime, delayAfterRun,
        dutyCycle, motorDirection, restartScheduled, restartAt, firmwareUploadStarted,
        firmwareUploadValid, firmwareUploadError, pwmWrites, appliedDuty, labelCalls, logCalls,
        preferences.data, preferences.begins, preferences.writes, preferences.ends,
        Update.begins, Update.writes, Update.ends, Update.aborts, Update.errorChecks, Update.finished);
}
unsigned scenarios = 0;
void check(bool result, const char* reason) { if (!result) throw std::runtime_error(reason); }
void passed(const char* scenario) { ++scenarios; std::cout << "PASS " << scenario << '\n'; }
void reset() {
    strcpy(ssid, "TEST-WIFI"); strcpy(password, "TEST-SAVED-PASSWORD");
    strcpy(mqtt_server, "10.0.0.50"); strcpy(mqtt_password, "TEST-SAVED-CODE");
    strcpy(serial_number, "TEST-SERIAL"); strcpy(printer_model, "H2"); strcpy(operationMode, "mqtt");
    useMotionSensor = debug = restartScheduled = firmwareUploadStarted = firmwareUploadValid = false;
    gmtOffset_sec = -6; motorWaitTime = 5000; motorRunTime = 10000; delayAfterRun = 120000;
    dutyCycle = 225; motorDirection = 0; restartAt = 0; now = 1000;
    firmwareUploadError.clear(); pwmWrites = labelCalls = logCalls = 0; appliedDuty = -1;
    preferences = {}; preferences.data["unchanged-test-marker"] = "preserve";
    server = {}; Update = {};
}
String replacementPayload(const char* invalidField, const String& invalidValue) {
    DynamicJsonDocument document(2048);
    document["ssid"] = "NEW-SSID"; document["operationMode"] = "motion";
    document["printerIp"] = "10.0.0.51"; document["serialNumber"] = "NEW-SERIAL";
    document["printerModel"] = "P1"; document["wifiPassword"] = "NEW-PASSWORD";
    document["accessCode"] = "NEW-CODE"; document["debug"] = true; document["gmtOffset"] = 4;
    JsonObject motor = document.createNestedObject("motor");
    motor["waitMs"] = 2000; motor["runMs"] = 3000; motor["speed"] = 100;
    document[invalidField] = invalidValue;
    String body; serializeJson(document, body); return body;
}
'''

SCENARIOS = r'''
int main() {
    for (const auto& invalid : std::vector<std::pair<const char*, String>>{
        {"wifiPassword", String(50, 'W')}, {"accessCode", String(30, 'A')},
        {"ssid", String(50, 'S')}, {"printerIp", String(40, 'I')},
        {"serialNumber", String(35, 'N')}, {"printerModel", "MODEL"},
        {"operationMode", "unknown"},
        {"wifiPassword", u8"ééééééééééééééééééééééééé"},
    }) {
        reset(); const auto before = snapshot();
        server.body = replacementPayload(invalid.first, invalid.second);
        handleApiConfigPost();
        check(server.status == 422, "invalid field must be rejected");
        check(snapshot() == before, "rejected settings changed RAM/NVS/restart/PWM");
        passed("invalid lengths/mode leave all live and persisted settings unchanged");
    }
    reset(); const auto malformedBefore = snapshot(); server.body = "{broken";
    handleApiConfigPost();
    check(server.status == 400 && snapshot() == malformedBefore, "malformed JSON changed state");
    passed("malformed settings have no side effects");

    reset(); server.body = R"({"wifiPassword":"","accessCode":"","motor":{"speed":200}})";
    handleApiConfigPost();
    check(server.status == 200 && !strcmp(password, "TEST-SAVED-PASSWORD") &&
        !strcmp(mqtt_password, "TEST-SAVED-CODE"), "blank credentials must preserve saved values");
    check(!restartScheduled && dutyCycle == 200 && pwmWrites == 1 && appliedDuty == 200,
        "valid partial motor update must not schedule reboot");
    check(!strcmp(ssid, "TEST-WIFI") && !strcmp(mqtt_server, "10.0.0.50") &&
        preferences.data["password"] == password && preferences.data["mqtt_password"] == mqtt_password,
        "partial request lost existing connection fields");
    passed("older partial payload and blank credentials retain saved connection settings");

    reset(); server.body = R"({"ssid":"NEW-SSID"})"; handleApiConfigPost();
    check(server.status == 200 && !strcmp(ssid, "NEW-SSID") && restartScheduled && restartAt == 2800,
        "partial Wi-Fi save must preserve its existing reboot behavior");
    check(!strcmp(password, "TEST-SAVED-PASSWORD") && !strcmp(mqtt_password, "TEST-SAVED-CODE"),
        "omitted credentials must preserve saved values");
    passed("valid partial Wi-Fi save schedules the normal reboot and retains omitted fields");

    reset(); server.body = R"({"wifiPassword":"NEW-PASSWORD","accessCode":"NEW-CODE"})";
    handleApiConfigPost();
    check(server.status == 200 && !strcmp(password, "NEW-PASSWORD") && !strcmp(mqtt_password, "NEW-CODE") &&
        restartScheduled && restartAt == 2800, "explicit replacements must save and reboot");
    passed("nonblank credential replacements retain existing save semantics");

    reset(); server.body = R"({"operationMode":"motion","motor":{"speed":0,"direction":1}})";
    handleApiConfigPost();
    check(server.status == 200 && useMotionSensor && !strcmp(operationMode, "motion") &&
        dutyCycle == 0 && motorDirection == 1 && restartScheduled, "valid mode/motor update failed");
    passed("valid mode and motor settings retain existing accepted values");

    reset(); server.body = replacementPayload("wifiPassword", String(49, 'W'));
    handleApiConfigPost();
    check(server.status == 200 && strlen(password) == 49, "maximum-length saved password was rejected");
    passed("maximum supported credential length remains accepted");

    for (bool pendingRestart : {false, true}) {
        reset(); restartScheduled = pendingRestart; restartAt = pendingRestart ? 5432 : 0;
        firmwareUploadStarted = !pendingRestart; server.body = "{broken";
        const auto before = snapshot(); handleApiConfigPost();
        check(server.status == 409 && server.argCalls == 0 && snapshot() == before,
            "settings during update/restart must be rejected before parsing and mutation");
        passed("busy settings save returns conflict without parsing or changing anything");
    }

    reset(); server.body = R"({"ssid":"NEW-SSID"})"; handleApiConfigPost();
    const auto pendingSave = snapshot(); unsigned char bytes[] = {0xE9, 0x00, 0x00};
    server.currentUpload.buf = bytes; server.currentUpload.currentSize = sizeof(bytes);
    for (auto state : {UPLOAD_FILE_START, UPLOAD_FILE_WRITE, UPLOAD_FILE_END, UPLOAD_FILE_ABORTED}) {
        server.currentUpload.status = state; handleFirmwareUploadV150();
        check(snapshot() == pendingSave, "OTA touched state while settings restart was pending");
    }
    handleFirmwareUploadCompleteV150();
    check(server.status == 409 && snapshot() == pendingSave, "blocked OTA altered settings reboot deadline");
    passed("OTA is rejected through every upload phase while settings reboot remains intact");

    reset(); server.currentUpload.status = UPLOAD_FILE_START; handleFirmwareUploadV150();
    const auto activeUpload = snapshot(); server.body = R"({"motor":{"speed":10}})";
    handleApiConfigPost();
    check(server.status == 409 && server.argCalls == 0 && snapshot() == activeUpload,
        "active OTA did not block settings changes");
    server.currentUpload.status = UPLOAD_FILE_WRITE; server.currentUpload.buf = bytes;
    server.currentUpload.currentSize = sizeof(bytes); handleFirmwareUploadV150();
    server.currentUpload.status = UPLOAD_FILE_END; handleFirmwareUploadV150();
    handleFirmwareUploadCompleteV150();
    check(server.status == 200 && restartScheduled && restartAt == 3500 && Update.finished &&
        Update.begins == 1 && Update.writes == 1 && Update.ends == 1 && Update.aborts == 0,
        "normal firmware installation flow changed");
    passed("normal OTA still validates, finalizes, and schedules its original restart");
    const auto pendingOta = snapshot();
    for (auto state : {UPLOAD_FILE_START, UPLOAD_FILE_WRITE, UPLOAD_FILE_END, UPLOAD_FILE_ABORTED}) {
        server.currentUpload.status = state; handleFirmwareUploadV150();
        check(snapshot() == pendingOta, "second upload changed a successful pending firmware update");
    }
    handleFirmwareUploadCompleteV150();
    check(server.status == 409 && snapshot() == pendingOta,
        "second upload overwrote the successful update or restart deadline");
    passed("duplicate OTA cannot overwrite a successful update awaiting restart");

    reset(); server.currentUpload.status = UPLOAD_FILE_START; handleFirmwareUploadV150();
    server.currentUpload.status = UPLOAD_FILE_ABORTED; handleFirmwareUploadV150();
    check(!firmwareUploadStarted && !firmwareUploadValid && !restartScheduled && Update.aborts == 1,
        "disconnected upload left settings permanently locked");
    // The real WebServer skips request completion after a multipart parse abort.
    server.body = R"({"motor":{"speed":210}})"; handleApiConfigPost();
    check(server.status == 200 && dutyCycle == 210 && pwmWrites == 1,
        "settings save could not recover without an upload completion callback");
    handleFirmwareUploadCompleteV150();
    check(server.status == 500 && !firmwareUploadStarted && !restartScheduled,
        "cancelled upload completion incorrectly succeeded or scheduled a restart");
    passed("cancelled/disconnected OTA unlocks settings without relying on completion");

    reset(); server.currentUpload.status = UPLOAD_FILE_START; handleFirmwareUploadV150();
    server.requestActive = true;
    const auto parserActive = snapshot(); serviceIncompleteFirmwareUpload();
    check(snapshot() == parserActive, "cleanup interrupted a live request/parser");
    passed("incomplete-upload cleanup never interrupts an active HTTP request");
    server.requestActive = false; serviceIncompleteFirmwareUpload();
    check(!firmwareUploadStarted && !firmwareUploadValid && Update.aborts == 1 &&
        !restartScheduled && !firmwareUploadError.empty(), "parse failure left an upload lock");
    server.body = R"({"motor":{"speed":215}})"; handleApiConfigPost();
    check(server.status == 200 && dutyCycle == 215 && pwmWrites == 1,
        "settings remained locked after a closed malformed multipart request");
    passed("closed malformed multipart request releases the stale upload and Settings lock");

    reset(); server.currentUpload.status = UPLOAD_FILE_START; handleFirmwareUploadV150();
    server.currentUpload.status = UPLOAD_FILE_WRITE; server.currentUpload.buf = bytes;
    server.currentUpload.currentSize = sizeof(bytes); handleFirmwareUploadV150();
    server.currentUpload.status = UPLOAD_FILE_END; handleFirmwareUploadV150();
    serviceIncompleteFirmwareUpload(); // Parser failed after file END but before request completion.
    check(!firmwareUploadStarted && !firmwareUploadValid && !restartScheduled && Update.aborts == 1,
        "malformed trailing multipart fields retained the successful-upload lock");
    handleFirmwareUploadCompleteV150();
    check(server.status == 500 && !restartScheduled, "failed request cleanup later accepted a stale completion");
    passed("malformed multipart trailer cannot retain an upload lock or schedule restart");

    reset(); restartScheduled = true; restartAt = 5432; firmwareUploadStarted = true;
    firmwareUploadValid = true; Update.finished = true; server.requestActive = false;
    const auto successfulPending = snapshot(); serviceIncompleteFirmwareUpload();
    check(snapshot() == successfulPending, "cleanup changed a pending successful restart/update");
    passed("stale-request cleanup preserves any pending successful restart");

    reset(); server.currentUpload.status = UPLOAD_FILE_START; handleFirmwareUploadV150();
    bytes[0] = 0xFF; server.currentUpload.status = UPLOAD_FILE_WRITE;
    server.currentUpload.buf = bytes; server.currentUpload.currentSize = sizeof(bytes);
    handleFirmwareUploadV150(); server.currentUpload.status = UPLOAD_FILE_END; handleFirmwareUploadV150();
    handleFirmwareUploadCompleteV150();
    check(server.status == 500 && !restartScheduled && !firmwareUploadStarted &&
        Update.begins == 1 && Update.writes == 0 && Update.ends == 0 && Update.aborts == 1,
        "invalid firmware magic-byte handling changed");
    passed("invalid firmware keeps its original rejection and never schedules restart");
    std::cout << scenarios << " scenarios passed\n";
}
'''

with tempfile.TemporaryDirectory(prefix="conveyor-settings-transaction-") as directory:
    test_source = Path(directory) / "test.cpp"
    executable = Path(directory) / "test"
    test_source.write_text(MOCKS + "\n".join(functions) + SCENARIOS)
    subprocess.run([
        *shlex.split(os.environ.get("CXX", "c++")), "-std=c++17", "-Wall", "-Wextra", "-Werror",
        "-I", str(ROOT / ".pio/libdeps/esp32dev/ArduinoJson/src"),
        str(test_source), "-o", str(executable),
    ], check=True)
    subprocess.run([str(executable)], check=True, timeout=20)
