# v1.5.4

Makes first-time printer setup easier with local Bambu printer discovery.

- Settings can find Bambu printers on the conveyor's Wi-Fi network and fill the selected printer's IP address, serial number, and model.
- A first-time, unconfigured MQTT setup starts a short search automatically. Configured devices search only when you click **Find printer**.
- Choose the correct printer, enter its LAN access code, and click **Save settings**. Searching or selecting a printer never saves configuration or retrieves passwords.
- Manual entry remains available when a printer is off, on another network, or its announcements are blocked.
- Network and Printer settings have separate sections with readiness indicators and guidance for missing details. Operation and Motor defaults are marked ready.
- Save settings stays unavailable until required printer details are complete in MQTT mode; an existing saved access code counts. Motion mode does not require printer credentials, and Save Wi-Fi remains separate. Incomplete saved setup highlights the Settings tab and shows a reminder on Overview.
- Save Wi-Fi updates only network settings. Save & check printer updates printer details and verifies the saved MQTT connection; either action may restart the device.
- Show/Hide buttons can reveal saved Wi-Fi passwords and printer access codes explicitly on the local device. Viewing a saved value does not replace or re-save it. Routine settings responses still omit credentials; use this unauthenticated local interface only on a trusted network.
- Incomplete printer setup no longer starts MQTT connection attempts that can interrupt the Settings page or discovery search.
- Motor timing, triggers, configured MQTT operation, indicators, Wi-Fi provisioning, and previous-stable recovery are unchanged.

## Installing

For an existing device, use the OTA application image to retain stored settings. For fresh USB installation or recovery, use the merged image at offset `0x0`. The merged image includes bootloader and partitions and must not be uploaded to the device's Update screen. A clean USB installation can erase saved settings.

This is an unpublished release candidate until its owner approves publication.
