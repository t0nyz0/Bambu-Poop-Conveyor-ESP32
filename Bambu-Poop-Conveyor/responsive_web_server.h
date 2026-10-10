#pragma once

#include <WebServer.h>
#include <stdint.h>

// A browser may open a TCP connection before sending an HTTP request. The
// single-client server normally lets that empty connection occupy its slot for
// five seconds. Only shorten this wait when another client is already queued;
// request parsing, POST bodies, uploads, and response timeouts stay unchanged.
class ResponsiveWebServer : public WebServer {
public:
    using WebServer::WebServer;

    bool hasActiveRequest() const { return _currentStatus != HC_NONE; }

    void handleClient() override {
        WebServer::handleClient();
        if (_currentStatus != HC_WAIT_READ || !_currentClient.connected() ||
            _currentClient.available() != 0 ||
            static_cast<uint32_t>(millis() - _statusChange) < 1000U) {
            return;
        }
        // hasClient is nonblocking and preserves the accepted queued socket for
        // the next base-server iteration. Recheck bytes after accepting it.
        if (!_server.hasClient() || _currentClient.available() != 0) return;
        _currentClient.stop();
        _currentClient = NetworkClient();
        _currentStatus = HC_NONE;
        _currentUpload.reset();
        _currentRaw.reset();
    }
};
