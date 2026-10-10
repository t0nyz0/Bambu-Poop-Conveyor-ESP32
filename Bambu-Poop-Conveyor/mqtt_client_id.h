#pragma once
#include <cstdint>
#include <cstdio>

// Stable, unique, alphanumeric and within MQTT 3.1.1's 23-character minimum.
// This identifier is used only on the local printer connection.
inline void buildMqttClientId(char (&out)[22], uint64_t hardwareId) {
    snprintf(out, sizeof(out), "BambuConv%012llX",
        static_cast<unsigned long long>(hardwareId & 0xFFFFFFFFFFFFULL));
}
