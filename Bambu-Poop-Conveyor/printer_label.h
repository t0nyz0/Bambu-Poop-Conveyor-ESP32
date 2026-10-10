#pragma once
#include <cstring>

// Optional display metadata only; never used for MQTT or printer selection.
struct PrinterLabel {
    char name[64] = {};
    char ip[40] = {};
    char serial[35] = {};
};
static PrinterLabel printerLabel;

static const char* printerLabelFor(const char* ip, const char* serial) {
    return printerLabel.name[0] && !strcmp(printerLabel.ip, ip) &&
        !strcmp(printerLabel.serial, serial) ? printerLabel.name : "";
}

static bool updatePrinterLabel(const char* name, const char* ip, const char* serial) {
    if (!name[0] || strlen(name) >= sizeof(printerLabel.name) ||
        strlen(ip) >= sizeof(printerLabel.ip) || strlen(serial) >= sizeof(printerLabel.serial)) return false;
    if (!strcmp(printerLabel.name, name) && !strcmp(printerLabel.ip, ip) &&
        !strcmp(printerLabel.serial, serial)) return false;
    strcpy(printerLabel.name, name);
    strcpy(printerLabel.ip, ip);
    strcpy(printerLabel.serial, serial);
    return true;
}
