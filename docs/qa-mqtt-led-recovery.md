# MQTT LED recovery: local verification

Test period: 2026-09-02 through 2026-09-11. Scope: connection indicators,
user-authorized test-device OTA, and v1.5.1 release verification.

The published v1.5.0 README already describes green plus yellow as MQTT trouble.
This change deliberately makes green mean the printer connection is ready, rather
than leaving it on through a lost MQTT connection. It does not establish the exact
cause of the reported overnight incident; the user rebooted before logs were captured.

## Changes

- Turn green off in the MQTT-disconnected path.
- Reset the disconnect timer once the connection returns, so every new disconnect
  gets the existing five-second grace period before the connection warning flashes.
- Synchronize the yellow pin and software blink state on idle recovery, using a fresh
  timestamp after the synchronous reconnect call returns.
- Protect active motor LED states from both successful and failed reconnect attempts.
- Let the existing motor-wait blink control yellow during waiting; do not blink a
  connection warning over the red running indicator.

GPIO assignments, motor wait/run/cooldown transitions, trigger evaluation, PWM,
Wi-Fi onboarding, and the MQTT reconnect interval are unchanged.

## Repeatable local regression tests

```console
python3 scripts/test_mqtt_leds.py
```

Requires Python 3 and a C++17 compiler (`CXX` may select one). The script extracts and
compiles the actual `loop()` and `connectToMqtt()` function bodies against simulated
GPIO, clocks, and MQTT calls. It does not duplicate their logic or contact hardware.
Each scenario runs in a fresh process to reset firmware-local static variables.

All 14 scenarios pass with the change:

- Connected idle does not continuously rewrite LEDs.
- MQTT loss turns off green and starts the 500 ms yellow blink after five seconds.
- A delayed reconnect starts with green off, restores idle LEDs, and resets timing
  correctly for a second disconnect.
- Short disconnect/recovery also resets the next warning grace period.
- Failed idle reconnect keeps the existing red error indication and retry interval.
- Success and failure during motor waiting preserve its yellow blink phase.
- Success and failure during motor running preserve its red indicator.
- Normal MQTT and motion-mode motor cycles retain 5 s wait, 2 s run, 120 s cooldown,
  PWM, and direction in the fixture.
- A motor stopping while disconnected does not leave green on.
- Reconnecting during cooldown does not reset or clear cooldown.
- AP mode remains untouched.

Against pre-change revision `98693f6`, 9 scenarios fail as expected and 5 pass. This
confirms the tests detect the old connection-indicator behavior, while the normal
motor, motion-mode, cooldown, connected-idle, and AP-mode cases remain compatible.

## ESP32 compilation

PlatformIO compilation passed with the repository's pinned platform 55.03.37 and
Arduino-ESP32 3.3.7. The stable v1.5.1 build uses 1,182,100 / 1,310,720 bytes
(90.2%); static RAM use is 58,148 / 327,680 bytes (17.7%).

The first build attempt stopped before compilation because the shared PlatformIO
package directory contained Arduino-ESP32 2.0.17 instead of this project's 3.3.7.
Verification used a separate temporary `PLATFORMIO_PACKAGES_DIR` with the pinned
framework and existing compatible tool packages; `platformio.ini` was not changed.
The final release build uses the same pinned framework versions.

## Test-device OTA verification

The user authorized a network update for a soak test before public deployment.
Application-only v1.5.1 Beta 1 (1,182,416 bytes) was accepted by `/update` with
HTTP 200 and the scheduled-reboot acknowledgement. The device returned with a new
boot ID and the exact `1.5.1 Beta 1` display version. Settings and trigger API
responses match the pre-update snapshots exactly, including credential-set flags.

The printer was already unreachable before the update. With Wi-Fi connected,
MQTT disconnected, and the motor idle, repeated post-update status samples show
green off and yellow alternating on/off. Red remains on for the existing MQTT
failure indication. These are reported GPIO readings, not a visual inspection.
Later device checks observed MQTT reconnected with the motor idle and the expected
green-on, yellow-off, red-off state. The user completed extended canary testing and
approved promotion to the public release.

The test OTA is kept in ignored `dist/v1.5.1-beta.1/`, with SHA-256
`d00b3206344ced5160dc79695cd4976554b35e133e5342147fd72162139c4dc3`.
The beta artifact and its soak log remain ignored local records.

## Remaining hardware validation

The firmware still uses synchronous MQTT/TLS calls. Flashing and loop-driven motor
timers can pause while such a call blocks; this patch does not redesign networking.
Host-side tests are not a substitute for physical LED and motor verification.

The final v1.5.1 OTA and merged images were built from the promoted source. Their
checksums were verified, each segment in the merged image matches its source image,
all 14 regression scenarios pass, and direct `/logs` navigation was verified in a
browser preview. Physical behavior was covered by the user's extended canary test.
