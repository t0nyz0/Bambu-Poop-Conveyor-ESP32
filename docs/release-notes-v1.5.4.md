# v1.5.4

Easier printer setup and clearer connection feedback, including the startup and save/reconnect fixes tested in v1.5.4 Beta 4.

## Setup improvements

- Settings discovers Bambu printers on the same Wi-Fi network. A prominent **Printer found on your network** panel shows names immediately, counts multiple results, and highlights **Use selected printer**.
- First-time search waits for live Wi-Fi and recovers automatically from temporary startup/restart errors. Interrupted searches resume checking the current scan; retries preserve typed details and found printers and stop after bounded attempts. Already-configured devices do not start an initial automatic search; **Find printer** remains available.
- Choose a printer to fill its IP address, serial number, and model, then enter its LAN access code and choose **Save & check printer**. Finding or selecting a printer does not save its connection settings or retrieve credentials. Manual entry is always available.
- Separate Network and Printer sections highlight missing details. MQTT-mode Save requires complete printer settings, including an entered or saved access code; motion mode does not require printer credentials. Operation and Motor defaults remain ready, and incomplete setup highlights Settings in the navigation.
- Save Wi-Fi updates only network settings. Save & check printer shows distinct saving, restarting, and connection-check stages. An acknowledged access-code save stays visibly saved and masked during reconnect; unconfirmed saves keep entered values available for retry, and connection success requires a fresh check.
- Local Show/Hide controls can explicitly reveal saved Wi-Fi passwords and printer access codes without replacing or re-saving them. Routine settings responses still omit credentials. The device interface is unauthenticated: use it only on a trusted network.

## Reliability improvements

- Overview shows the configured printer's discovered name, a steady green connected badge, and clear loading states. Quiet background refresh no longer makes the Refresh status button flash busy.
- Missed status refreshes show last-known values and neutral retry guidance, not false Wi-Fi setup warnings or an old connection labeled as live. Fresh responses restore current indicators automatically.
- Unsaved Settings and trigger edits survive tab changes. Failed trigger loads keep Save unavailable; settings saves and firmware installation cannot overlap. Invalid settings are rejected before changing live values, and interrupted uploads release their lock.
- Incomplete printer setup skips MQTT connection attempts that could hold up Settings or discovery. Empty browser connections no longer delay queued page requests for the full five-second wait; active requests and uploads keep their existing handling.
- Repeated Logs requests are combined, stalled requests time out with retry guidance, and oversized firmware downloads are cancelled before upload.
- Each conveyor uses a distinct, stable MQTT client name so controllers connected to the same printer do not replace each other's connection.

## Installing

For an existing device, use `Bambu-Poop-Conveyor-v1.5.4-ota.bin` through its Update screen to retain stored settings and triggers. For fresh USB installation or recovery, use `Bambu-Poop-Conveyor-v1.5.4-merged.bin` at offset `0x0`, or the public web installer. The merged image includes bootloader and partitions and must not be uploaded to the device's Update screen. A clean USB installation can erase saved settings. `SHA256SUMS.txt` accompanies the release files.

Motor timing, triggers, MQTT credentials and topics, indicators, and Wi-Fi provisioning are unchanged. Existing saved configurations remain compatible; the optional printer display name is stored separately and ignored by older firmware. Previous-stable v1.5.1 and separate v1.4.2 legacy recovery remain available at their original paths.
