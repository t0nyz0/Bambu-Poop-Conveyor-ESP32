#pragma once
#include <WiFiUdp.h>
#include "printer_discovery_parser.h"

static WiFiUDP printerDiscoveryUdp[2];
static DiscoveredPrinter discoveredPrinters[8];
static size_t discoveredPrinterCount = 0;
static bool printerDiscoveryRunning = false;
static uint32_t printerDiscoveryStarted = 0;
static bool printerDiscoveryHasRun = false;
static const uint32_t PRINTER_DISCOVERY_MS = 20000;

static void stopPrinterDiscovery() {
    for (auto& udp : printerDiscoveryUdp) udp.stop();
    printerDiscoveryRunning = false;
}

static void servicePrinterDiscovery() {
    if (!printerDiscoveryRunning) return;
    if (isAPMode || WiFi.status() != WL_CONNECTED || restartScheduled || firmwareUploadStarted ||
        (uint32_t)(millis() - printerDiscoveryStarted) >= PRINTER_DISCOVERY_MS) {
        stopPrinterDiscovery(); return;
    }
    // At most one datagram per socket per loop: no waits, probes, or subnet sweeps.
    for (auto& udp : printerDiscoveryUdp) {
        int size = udp.parsePacket();
        if (size <= 0) continue;
        IPAddress sender = udp.remoteIP(), local = WiFi.localIP(), mask = WiFi.subnetMask();
        char packet[1025]; DiscoveredPrinter printer;
        int read = size <= 1024 ? udp.read((unsigned char*)packet, size) : 0;
        udp.clear();
        if (read != size || !parsePrinterAnnouncement(packet, read, printer)) continue;
        uint8_t address[4]; discoveryIPv4(printer.ip, address);
        bool validSource = true;
        for (int i = 0; i < 4; ++i)
            if (address[i] != sender[i] || (sender[i] & mask[i]) != (local[i] & mask[i])) validSource = false;
        if (!validSource || sender == local) continue;
        size_t index = 0;
        while (index < discoveredPrinterCount && strcmp(discoveredPrinters[index].serial, printer.serial)) ++index;
        if (index == discoveredPrinterCount) {
            if (discoveredPrinterCount == 8) continue;
            ++discoveredPrinterCount;
        }
        discoveredPrinters[index] = printer;
    }
}

static void handlePrinterDiscoveryGet() {
    servicePrinterDiscovery();
    rememberConfiguredPrinterName();
    DynamicJsonDocument doc(3072);
    doc["scanning"] = printerDiscoveryRunning;
    doc["remainingMs"] = printerDiscoveryRunning ? PRINTER_DISCOVERY_MS - (uint32_t)(millis() - printerDiscoveryStarted) : 0;
    JsonArray printers = doc.createNestedArray("printers");
    for (size_t i = 0; i < discoveredPrinterCount; ++i) {
        JsonObject p = printers.createNestedObject();
        p["ip"] = discoveredPrinters[i].ip; p["serial"] = discoveredPrinters[i].serial;
        p["name"] = discoveredPrinters[i].name; p["model"] = discoveredPrinters[i].model;
    }
    sendJson(200, doc);
}

static void handlePrinterDiscoveryPost() {
    if (server.arg("plain") != "{}") return sendError(400, "Send an empty JSON object to start discovery");
    if (isAPMode || WiFi.status() != WL_CONNECTED) return sendError(409, "Connect the conveyor to your Wi-Fi first");
    if (restartScheduled || firmwareUploadStarted) return sendError(409, "Wait for the firmware update or restart to finish");
    servicePrinterDiscovery();
    if (printerDiscoveryRunning) return handlePrinterDiscoveryGet();
    if (printerDiscoveryHasRun && (uint32_t)(millis() - printerDiscoveryStarted) < PRINTER_DISCOVERY_MS + 2000)
        return sendError(429, "Wait a moment before searching again");
    stopPrinterDiscovery();
    // Printers announce over both Bambu discovery ports. Listening also joins
    // the SSDP multicast group, while receiving ordinary broadcast announcements.
    IPAddress group(239, 255, 255, 250);
    if (!printerDiscoveryUdp[0].beginMulticast(group, 1990) ||
        !printerDiscoveryUdp[1].beginMulticast(group, 2021)) {
        stopPrinterDiscovery(); return sendError(503, "Could not start discovery; enter the printer details manually");
    }
    discoveredPrinterCount = 0;
    printerDiscoveryStarted = millis();
    printerDiscoveryHasRun = printerDiscoveryRunning = true;
    handlePrinterDiscoveryGet();
}
