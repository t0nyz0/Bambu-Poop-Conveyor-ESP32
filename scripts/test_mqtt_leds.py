#!/usr/bin/env python3
"""Exercise the actual firmware loop/reconnect functions with host-side GPIO/MQTT mocks.

Run: python3 scripts/test_mqtt_leds.py
Requires a C++17 compiler. No network, device, or firmware artifacts are modified.
Use --source - to test source supplied on stdin (for example, a previous git revision).
"""

import argparse
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile


MOCKS = r'''
#include <cstdio>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <string>

constexpr int LOW = 0, HIGH = 1;
constexpr int greenLight = 1, yellowLight = 2, redLight = 3;
constexpr int motor1Pin1 = 4, motor1Pin2 = 5, motionSensorPin = 6, enable1Pin = 7;
constexpr unsigned long RECONNECT_INTERVAL = 15000;
unsigned long now = 1000, lastAttemptTime = 0, yellowLightStartTime = 1000;
unsigned long motorWaitStartTime = 1000, motorRunStartTime = 1000;
unsigned long delayAfterRunStartTime = 0, previousMillis = 0;
unsigned long activeMotorWaitTime = 5000, activeMotorRunTime = 2000;
unsigned long activeDelayAfterRun = 120000, additionalWaitTime = 0;
unsigned long motorWaitTime = 5000, motorRunTime = 2000, delayAfterRun = 120000;
unsigned int yellowLightState = LOW;
bool useMotionSensor = false, isAPMode = false, debug = false;
bool motorWaiting = false, motorRunning = false, delayAfterRunning = false;
bool autoPushAllEnabled = false;
int dutyCycle = 240, motorDirection = 1, appliedDuty = 0;
int pins[8] = {0, HIGH, LOW, LOW, LOW, LOW, LOW, LOW};
int pinWrites = 0;
char printer_model[] = "H2", mqtt_topic[128] = {}, serial_number[] = "test-printer";
const char *mqtt_user = "test", *mqtt_password = "test";

unsigned long millis() { return now; }
void digitalWrite(int pin, int value) { pins[pin] = value; ++pinWrites; }
int digitalRead(int pin) { return pins[pin]; }
void ledcWrite(int, int value) { appliedDuty = value; }
template <typename T> std::string String(T value) { return std::to_string(value); }
std::string String(const char* value) { return value; }
void addLogEntry(const std::string&) {}
void publishPushAllMessage() {}
void evaluateTriggerRules() {}
void serviceScheduledRestart() {}
struct SerialMock {
    template <typename T> void print(const T&) {}
    template <typename T> void println(const T&) {}
} Serial;
struct ServiceMock {
    void handleSerial() {}
    void handleClient() {}
    void processNextRequest() {}
} improvSerial, server, dnsServer;
struct ClientMock {
    bool online = true, connectSucceeds = false;
    unsigned long connectDelay = 0;
    int attempts = 0, greenAtAttempt = -1, yellowAtAttempt = -1;
    bool connected() { return online; }
    bool connect(const char*, const char*, const char*) {
        ++attempts;
        greenAtAttempt = pins[greenLight];
        yellowAtAttempt = pins[yellowLight];
        now += connectDelay; // Model the existing synchronous network stall.
        online = connectSucceeds;
        return online;
    }
    void subscribe(const char*) {}
    int state() { return -1; }
    void loop() {}
} client;
'''

SCENARIOS = r'''
void check(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}
void lights(int green, int yellow, int red) {
    check(pins[greenLight] == green, "unexpected green output");
    check(pins[yellowLight] == yellow, "unexpected yellow output");
    check(pins[redLight] == red, "unexpected red output");
}
void tick(unsigned long time) { now = time; loop(); }
void waiting() {
    motorWaiting = true;
    activeMotorWaitTime = 60000;
    pins[greenLight] = LOW;
}
void running() {
    motorRunning = true;
    activeMotorRunTime = 60000;
    pins[greenLight] = LOW;
    pins[redLight] = HIGH;
}
int main(int argc, char** argv) {
    if (argc != 2) return 2;
    const std::string test = argv[1];
    try {
        if (test == "connected_idle") {
            tick(1000);
            tick(16000);
            lights(HIGH, LOW, LOW);
            check(pinWrites == 0, "normal connected loop must not rewrite LEDs");
        } else if (test == "disconnect_blink") {
            client.online = false;
            tick(1000); lights(LOW, LOW, LOW);
            tick(5999); lights(LOW, LOW, LOW);
            tick(6000); lights(LOW, HIGH, LOW);
            tick(6500); lights(LOW, LOW, LOW);
            tick(7000); lights(LOW, HIGH, LOW);
        } else if (test == "slow_reconnect_and_second_disconnect") {
            client.online = false;
            tick(1000);
            client.connectSucceeds = true;
            client.connectDelay = 3000;
            tick(16000);
            check(client.greenAtAttempt == LOW, "green must be off throughout reconnect");
            check(client.yellowAtAttempt == HIGH, "exercise reconnect during yellow-on phase");
            lights(HIGH, LOW, LOW);
            check(yellowLightState == LOW, "yellow software state must match pin");
            check(yellowLightStartTime == now, "recovery must use fresh post-connect time");
            const int writesAfterRecovery = pinWrites;
            tick(19500);
            check(pinWrites == writesAfterRecovery, "recovery cleanup must run only once");
            client.online = false;
            tick(20000); lights(LOW, LOW, LOW);
            tick(24999); lights(LOW, LOW, LOW);
            tick(25000); lights(LOW, HIGH, LOW);
        } else if (test == "short_disconnect_recovery") {
            client.online = false;
            tick(1000);
            client.online = true;
            tick(1200); lights(HIGH, LOW, LOW);
            client.online = false;
            tick(2000);
            tick(6999); lights(LOW, LOW, LOW);
            tick(7000); lights(LOW, HIGH, LOW);
        } else if (test == "failed_reconnect") {
            client.online = false;
            tick(1000);
            client.connectDelay = 2000;
            tick(16000); lights(LOW, HIGH, HIGH);
            check(client.greenAtAttempt == LOW, "green must be off during failed attempt");
            check(lastAttemptTime == 18000, "retry interval must start after attempt");
            tick(18500); lights(LOW, LOW, HIGH);
        } else if (test == "waiting_reconnect" || test == "waiting_failed_reconnect") {
            waiting();
            client.online = false;
            client.connectSucceeds = test == "waiting_reconnect";
            tick(1000);
            tick(16000); lights(LOW, HIGH, LOW);
            check(yellowLightState == HIGH, "reconnect must preserve motor blink phase");
            check(yellowLightStartTime == 16000, "reconnect must preserve blink timestamp");
            check(motorWaitStartTime == 1000 && motorWaiting, "motor wait must be unchanged");
            tick(16499); lights(LOW, HIGH, LOW);
            tick(16500); lights(LOW, LOW, LOW);
        } else if (test == "running_reconnect" || test == "running_failed_reconnect") {
            running();
            client.online = false;
            client.connectSucceeds = test == "running_reconnect";
            tick(1000); lights(LOW, LOW, HIGH);
            tick(16000); lights(LOW, LOW, HIGH);
            check(motorRunStartTime == 1000 && motorRunning, "motor run must be unchanged");
        } else if (test == "normal_motor_cycle" || test == "motion_motor_cycle") {
            useMotionSensor = test == "motion_motor_cycle";
            client.online = !useMotionSensor;
            motorWaiting = true;
            yellowLightState = pins[yellowLight] = HIGH;
            tick(1000); lights(LOW, HIGH, LOW);
            tick(1499); lights(LOW, HIGH, LOW);
            tick(1500); lights(LOW, LOW, LOW);
            tick(2000); lights(LOW, HIGH, LOW);
            tick(5999);
            check(motorWaiting && !motorRunning, "wait must last full 5 seconds");
            tick(6000); lights(LOW, LOW, HIGH);
            check(motorRunning && appliedDuty == 240, "motor must start with saved PWM");
            check(pins[motor1Pin1] == HIGH && pins[motor1Pin2] == LOW, "direction changed");
            tick(7999);
            check(motorRunning, "run must last full 2 seconds");
            tick(8000); lights(HIGH, LOW, LOW);
            check(!motorRunning && delayAfterRunning, "motor must enter cooldown");
            check(pins[motor1Pin1] == LOW && pins[motor1Pin2] == LOW, "motor must stop");
            tick(127999);
            check(delayAfterRunning, "cooldown must last full 120 seconds");
            tick(128000);
            check(!delayAfterRunning, "cooldown must end on time");
            check(client.attempts == 0, "unexpected MQTT reconnect");
        } else if (test == "motor_stops_while_disconnected") {
            running();
            activeMotorRunTime = 2000;
            client.online = false;
            tick(1000);
            tick(3000); lights(LOW, LOW, LOW);
            check(!motorRunning && delayAfterRunning, "motor stop timing changed");
        } else if (test == "cooldown_reconnect") {
            delayAfterRunning = true;
            delayAfterRunStartTime = 5000;
            client.online = false;
            tick(6000);
            client.connectSucceeds = true;
            tick(21000); lights(HIGH, LOW, LOW);
            check(delayAfterRunning && delayAfterRunStartTime == 5000, "cooldown changed");
        } else if (test == "ap_mode_untouched") {
            isAPMode = true;
            client.online = false;
            pins[greenLight] = LOW;
            pins[yellowLight] = HIGH;
            tick(1000);
            tick(16000); lights(LOW, HIGH, LOW);
            check(pinWrites == 0 && client.attempts == 0, "AP mode must be untouched");
        } else {
            throw std::runtime_error("unknown scenario");
        }
        std::cout << "PASS " << test << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "FAIL " << test << ": " << error.what() << '\n';
        return 1;
    }
}
'''

TESTS = (
    "connected_idle", "disconnect_blink", "slow_reconnect_and_second_disconnect",
    "short_disconnect_recovery", "failed_reconnect", "waiting_reconnect",
    "waiting_failed_reconnect", "running_reconnect", "running_failed_reconnect",
    "normal_motor_cycle", "motion_motor_cycle", "motor_stops_while_disconnected",
    "cooldown_reconnect", "ap_mode_untouched",
)


def firmware_function(source: str, name: str) -> str:
    """Keep production code intact; top-level closing braces are unindented."""
    start = source.index(f"void {name}() {{")
    end = source.index("\n}\n", start) + 3
    return source[start:end]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=str(
        Path(__file__).resolve().parents[1] / "Bambu-Poop-Conveyor/Bambu-Poop-Conveyor.ino"
    ))
    args = parser.parse_args()
    source = sys.stdin.read() if args.source == "-" else Path(args.source).read_text()
    functions = "\n".join(firmware_function(source, name) for name in ("connectToMqtt", "loop"))
    with tempfile.TemporaryDirectory(prefix="conveyor-mqtt-led-tests-") as directory:
        test_source = Path(directory) / "test.cpp"
        executable = Path(directory) / "test"
        test_source.write_text(MOCKS + functions + SCENARIOS)
        subprocess.run([
            *shlex.split(os.environ.get("CXX", "c++")), "-std=c++17", "-Wall", "-Wextra",
            str(test_source), "-o", str(executable),
        ], check=True)
        # A fresh process per scenario resets function-local static firmware state.
        failed = sum(subprocess.run([str(executable), test]).returncode != 0 for test in TESTS)
    print(f"{len(TESTS) - failed}/{len(TESTS)} scenarios passed", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
