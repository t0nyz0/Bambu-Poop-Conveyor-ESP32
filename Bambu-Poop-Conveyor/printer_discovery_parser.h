#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <strings.h>
#include <ctype.h>

// Fixed-size, local discovery records. Announcements are not authenticated;
// selecting a result only fills the form, never saves settings or credentials.
struct DiscoveredPrinter {
    char ip[16];
    char serial[35];
    char name[64];
    char model[4];
};

static bool discoveryIPv4(const char* text, uint8_t out[4]) {
    for (int i = 0; i < 4; ++i) {
        unsigned value = 0, digits = 0;
        while (*text >= '0' && *text <= '9') {
            value = value * 10 + (*text++ - '0');
            if (++digits > 3 || value > 255) return false;
        }
        if (!digits || (i < 3 ? *text++ != '.' : *text != '\0')) return false;
        out[i] = (uint8_t)value;
    }
    return out[0] != 0 && out[0] != 127 && out[0] < 224;
}

static const char* discoveryModel(const char* raw, const char* serial) {
    if (!strcmp(raw, "BL-P001") || !strcmp(raw, "BL-P002") ||
        !strcmp(raw, "3DPrinter-X1-Carbon") || !strcmp(raw, "3DPrinter-X1") || !strcmp(raw, "C13")) return "X1";
    if (!strcmp(raw, "C11") || !strcmp(raw, "C12")) return "P1";
    if (!strcmp(raw, "N1") || !strcmp(raw, "N2S")) return "A1";
    if (!strcmp(raw, "O1D") || !strcmp(raw, "O1S")) return "H2";
    // Serial-prefix fallback covers revisions with missing/changed model headers.
    if (!strncmp(serial, "00M", 3) || !strncmp(serial, "00W", 3) || !strncmp(serial, "03W", 3)) return "X1";
    if (!strncmp(serial, "01P", 3) || !strncmp(serial, "01S", 3)) return "P1";
    if (!strncmp(serial, "030", 3) || !strncmp(serial, "039", 3)) return "A1";
    if (!strncmp(serial, "093", 3) || !strncmp(serial, "094", 3)) return "H2";
    if (!strncmp(serial, "22E", 3)) return "P2";
    return ""; // Unknown model must be chosen manually, not guessed.
}

static bool parsePrinterAnnouncement(char* packet, size_t length, DiscoveredPrinter& result) {
    result = {};
    if (!length || length > 1024 || memchr(packet, '\0', length)) return false;
    packet[length] = '\0'; // Caller supplies length + 1 bytes.
    if (strncmp(packet, "NOTIFY * HTTP/1.1\r\n", 19) &&
        strncmp(packet, "NOTIFY * HTTP/1.1\n", 18) &&
        strncmp(packet, "HTTP/1.1 200 OK\r\n", 17) &&
        strncmp(packet, "HTTP/1.1 200 OK\n", 16)) return false;
    char rawModel[40] = {}, service[80] = {}, subtype[24] = {};
    unsigned seen = 0;
    char* cursor = strchr(packet, '\n');
    while (cursor && *++cursor) {
        char* end = strchr(cursor, '\n');
        if (end) *end = '\0';
        char* colon = strchr(cursor, ':');
        if (colon) {
            *colon++ = '\0';
            char* keyEnd = cursor + strlen(cursor);
            while (keyEnd > cursor && isspace((unsigned char)keyEnd[-1])) *--keyEnd = '\0';
            while (isspace((unsigned char)*colon)) ++colon;
            char* valueEnd = colon + strlen(colon);
            while (valueEnd > colon && isspace((unsigned char)valueEnd[-1])) *--valueEnd = '\0';
            char* target = nullptr; size_t capacity = 0; unsigned flag = 0;
            if (!strcasecmp(cursor, "Location")) { target = result.ip; capacity = sizeof(result.ip); flag = 1; }
            else if (!strcasecmp(cursor, "USN")) { target = result.serial; capacity = sizeof(result.serial); flag = 2; }
            else if (!strcasecmp(cursor, "NT") || !strcasecmp(cursor, "ST")) { target = service; capacity = sizeof(service); flag = 4; }
            else if (!strcasecmp(cursor, "DevModel.bambu.com")) { target = rawModel; capacity = sizeof(rawModel); flag = 8; }
            else if (!strcasecmp(cursor, "DevName.bambu.com")) { target = result.name; capacity = sizeof(result.name); flag = 16; }
            else if (!strcasecmp(cursor, "NTS")) { target = subtype; capacity = sizeof(subtype); flag = 32; }
            if (target) {
                if ((seen & flag) || strlen(colon) >= capacity) return false;
                for (const char* p = colon; *p; ++p) if ((unsigned char)*p < 32 || (unsigned char)*p == 127) return false;
                strcpy(target, colon); seen |= flag;
            }
        }
        cursor = end;
    }
    uint8_t ip[4];
    if ((seen & 7) != 7 || strncmp(service, "urn:bambulab-com:device:", 23) ||
        strlen(service) <= 23 || !discoveryIPv4(result.ip, ip) || strlen(result.serial) < 3 ||
        (subtype[0] && strcmp(subtype, "ssdp:alive"))) return false;
    for (const char* p = result.serial; *p; ++p) if (!isalnum((unsigned char)*p) && *p != '-') return false;
    strcpy(result.model, discoveryModel(rawModel, result.serial));
    if (!result.name[0]) strcpy(result.name, "Bambu printer");
    return true;
}
