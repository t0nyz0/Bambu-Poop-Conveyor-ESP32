#!/usr/bin/env python3
"""Test the actual startup routing functions with local configuration/server mocks."""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / "Bambu-Poop-Conveyor/v150_features.h").read_text()
functions = []
for signature in ("static bool printerSetupRequired() {", "static void serveDefaultWebUi() {"):
    start = source.index(signature)
    end = source.index("\n}\n", start) + 3
    functions.append(source[start:end])
assert 'server.on("/", HTTP_GET, serveDefaultWebUi);' in source
for path in ("/config", "/control", "/logs", "/update"):
    assert f'server.on("{path}", HTTP_GET, serveWebUi);' in source

MOCKS = r'''
#include <cstring>
#include <iostream>
#include <map>
#include <stdexcept>
#include <string>
struct String : std::string {
    explicit String(const char* text) : std::string(text) {}
    void trim() {
        const auto first = find_first_not_of(" \t\r\n"), last = find_last_not_of(" \t\r\n");
        assign(first == npos ? "" : substr(first, last-first+1));
    }
};
bool useMotionSensor = false, isAPMode = false;
char mqtt_server[40] = "192.168.1.50", mqtt_password[30] = "test-code";
char serial_number[35] = "TEST-SERIAL";
bool served = false;
void serveWebUi() { served = true; }
struct Server {
    int code = 0;
    std::map<std::string,std::string> headers;
    void sendHeader(const char* key, const char* value, bool = false) { headers[key] = value; }
    void send(int status, const char*, const char*) { code = status; }
} server;
static void serveDefaultWebUi();
void check(bool expectedSetup, const char* scenario) {
    served = false; server = {};
    serveDefaultWebUi();
    if (expectedSetup ? (served || server.code != 302 || server.headers["Location"] != "/config" || server.headers["Cache-Control"] != "no-store") : (!served || server.code != 0))
        throw std::runtime_error(scenario);
    std::cout << "PASS " << scenario << '\n';
}
'''
SCENARIOS = r'''
int main() {
    check(false, "configured MQTT device stays on Overview even without a live printer");
    for (auto field : {mqtt_server, mqtt_password, serial_number}) {
        const std::string original(field);
        for (auto missing : {"", " \t\r\n"}) {
            std::strcpy(field, missing);
            check(true, "missing/whitespace printer field opens Settings");
        }
        std::strcpy(field, original.c_str());
    }
    std::strcpy(mqtt_server, "your-bambu-printer-ip");
    check(true, "placeholder IP opens Settings");
    std::strcpy(mqtt_server, "192.168.1.50");
    std::strcpy(mqtt_password, "your-bambu-printer-accesscode");
    check(true, "placeholder access code opens Settings");
    std::strcpy(mqtt_password, "test-code");
    std::strcpy(serial_number, "your-bambu-printer-serial-number");
    check(true, "placeholder serial opens Settings");
    std::strcpy(serial_number, "TEST-SERIAL");
    isAPMode = true;
    check(true, "hotspot opens Settings even when printer fields exist");
    useMotionSensor = true;
    check(true, "hotspot motion mode still opens Wi-Fi Settings");
    isAPMode = false;
    mqtt_server[0] = mqtt_password[0] = serial_number[0] = '\0';
    check(false, "motion-only device does not require a printer");
    useMotionSensor = false;
    check(true, "Wi-Fi provisioned but printer unconfigured opens Settings");
    std::strcpy(mqtt_server, "192.168.1.50");
    std::strcpy(mqtt_password, "test-code");
    std::strcpy(serial_number, "TEST-SERIAL");
    check(false, "completed setup restores Overview without persistent redirect flag");
}
'''
with tempfile.TemporaryDirectory(prefix="conveyor-startup-tests-") as directory:
    test_source = Path(directory) / "test.cpp"
    executable = Path(directory) / "test"
    test_source.write_text(MOCKS + "\n".join(functions) + SCENARIOS)
    subprocess.run([*shlex.split(os.environ.get("CXX", "c++")), "-std=c++17", "-Wall", "-Wextra", str(test_source), "-o", str(executable)], check=True)
    subprocess.run([str(executable)], check=True)
