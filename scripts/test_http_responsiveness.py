#!/usr/bin/env python3
"""Test the local server's empty-connection guard with a host WebServer fixture.

The actual ResponsiveWebServer header is compiled; the pinned library's public
and protected interface is mocked. This does not replace physical HTTP testing.
"""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
MOCK = r'''
#pragma once
#include <cstdint>
#include <functional>
#include <memory>
extern uint32_t now;
inline uint32_t millis() { return now; }
enum HTTPClientStatus { HC_NONE, HC_WAIT_READ, HC_WAIT_CLOSE };
struct Socket {
    bool connected = true;
    int bytes = 0, stops = 0, requests = 0;
};
class NetworkClient {
public:
    std::shared_ptr<Socket> socket;
    NetworkClient() = default;
    explicit NetworkClient(std::shared_ptr<Socket> value) : socket(value) {}
    bool connected() { return socket && socket->connected; }
    int available() { return socket ? socket->bytes : 0; }
    void stop() { if (socket) { socket->connected = false; ++socket->stops; } }
};
struct NetworkServer {
    NetworkClient queued, cached;
    int checks = 0;
    std::function<void()> onCheck;
    bool hasClient() {
        ++checks;
        if (onCheck) onCheck();
        if (!cached.socket) { cached = queued; queued = NetworkClient(); }
        return bool(cached.socket);
    }
    NetworkClient accept() {
        auto result = cached.socket ? cached : queued;
        cached = queued = NetworkClient();
        return result;
    }
};
class WebServer {
public:
    explicit WebServer(int) {}
    virtual ~WebServer() = default;
    virtual void handleClient() {
        if (_currentStatus == HC_NONE) {
            _currentClient = _server.accept();
            if (!_currentClient.socket) return;
            _currentStatus = HC_WAIT_READ;
            _statusChange = now;
        }
        if (!_currentClient.connected()) { clear(); return; }
        if (_currentStatus == HC_WAIT_READ) {
            if (_currentClient.available()) {
                ++_currentClient.socket->requests;
                clear();
            } else if (uint32_t(now - _statusChange) > 5000) clear();
        }
    }
protected:
    NetworkServer _server;
    NetworkClient _currentClient;
    HTTPClientStatus _currentStatus = HC_NONE;
    unsigned long _statusChange = 0;
    std::unique_ptr<int> _currentUpload, _currentRaw;
    void clear() {
        _currentClient = NetworkClient(); _currentStatus = HC_NONE;
        _currentUpload.reset(); _currentRaw.reset();
    }
};
'''
SCENARIOS = r'''
#include <iostream>
#include <stdexcept>
#include "responsive_web_server.h"
uint32_t now = 0;
class Fixture : public ResponsiveWebServer {
public:
    Fixture() : ResponsiveWebServer(80) {}
    using WebServer::_server;
    using WebServer::_currentClient;
    using WebServer::_currentStatus;
    using WebServer::_statusChange;
    using WebServer::_currentUpload;
    using WebServer::_currentRaw;
    std::shared_ptr<Socket> idle(uint32_t started = 0) {
        auto socket = std::make_shared<Socket>();
        _currentClient = NetworkClient(socket);
        _currentStatus = HC_WAIT_READ; _statusChange = started;
        return socket;
    }
    std::shared_ptr<Socket> queue() {
        auto socket = std::make_shared<Socket>(); socket->bytes = 1;
        _server.queued = NetworkClient(socket); return socket;
    }
};
void check(bool result, const char* message) {
    if (!result) throw std::runtime_error(message);
}
int main() {
    int count = 0;
    auto pass = [&](const char* label) { ++count; std::cout << "PASS " << label << '\n'; };
    {
        Fixture server; auto idle = server.idle(); server.queue(); now = 999;
        server.handleClient(); check(idle->stops == 0 && server._server.checks == 0, "closed before grace");
        pass("empty accepted connection keeps its first-second grace");
    }
    {
        Fixture server; auto idle = server.idle(); auto queued = server.queue(); now = 1000;
        server._currentUpload.reset(new int(1)); server._currentRaw.reset(new int(2));
        server.handleClient();
        check(idle->stops == 1 && !server.hasActiveRequest() && server._currentStatus == HC_NONE &&
              !server._currentUpload && !server._currentRaw && server._server.cached.socket == queued,
              "empty slot was not released cleanly or queued request was lost");
        server.handleClient(); check(queued->requests == 1 && queued->stops == 0, "queued GET not processed");
        pass("queued request survives guard and is processed on the next iteration");
    }
    {
        Fixture server; auto idle = server.idle(); now = 1000; server.handleClient();
        check(idle->stops == 0 && server.hasActiveRequest() && server._currentStatus == HC_WAIT_READ, "closed unopposed client");
        pass("unopposed idle client retains the original timeout");
    }
    {
        Fixture server; auto active = server.idle(); active->bytes = 1; server.queue(); now = 1000;
        server.handleClient(); check(active->requests == 1 && active->stops == 0 &&
            server._server.checks == 0, "guard interrupted available request data");
        pass("available request is handled by the original parser first");
    }
    {
        Fixture server; auto idle = server.idle(); server.queue(); now = 1000;
        server._server.onCheck = [idle]() { idle->bytes = 1; };
        server.handleClient(); check(idle->stops == 0 && server._currentStatus == HC_WAIT_READ,
            "guard closed a socket receiving its first byte");
        server.handleClient(); check(idle->requests == 1, "first-byte race lost request");
        pass("first-byte arrival during queue check is not discarded");
    }
    {
        Fixture server; auto idle = server.idle(); idle->connected = false; server.queue(); now = 1000;
        server.handleClient(); check(idle->stops == 0 && server._currentStatus == HC_NONE,
            "disconnected client did not use base cleanup");
        pass("already disconnected socket uses original cleanup");
    }
    {
        Fixture server; auto stream = server.idle(); server._currentStatus = HC_WAIT_CLOSE;
        server.queue(); now = 1000; server._currentUpload.reset(new int(1));
        server.handleClient(); check(stream->stops == 0 && server._currentUpload &&
            server._server.checks == 0, "guard changed response/SSE state");
        pass("response and SSE close-wait states remain untouched");
    }
    {
        Fixture server; auto idle = server.idle(UINT32_MAX - 499); server.queue(); now = 500;
        server.handleClient(); check(idle->stops == 1, "millis rollover broke idle age");
        pass("idle-age calculation remains correct across millis rollover");
    }
    {
        Fixture server; auto idle = server.idle(); now = 5001; server.handleClient();
        check(idle->stops == 0 && server._currentStatus == HC_NONE && server._server.checks == 0,
            "base timeout was replaced");
        pass("original five-second timeout remains for unopposed empty sockets");
    }
    std::cout << count << " scenarios passed\n";
}
'''

with tempfile.TemporaryDirectory(prefix="conveyor-http-responsiveness-") as directory:
    base = Path(directory)
    (base / "WebServer.h").write_text(MOCK)
    (base / "test.cpp").write_text(SCENARIOS)
    subprocess.run([
        *shlex.split(os.environ.get("CXX", "c++")), "-std=c++17", "-Wall", "-Wextra", "-Werror",
        "-I", str(base), "-I", str(ROOT / "Bambu-Poop-Conveyor"),
        str(base / "test.cpp"), "-o", str(base / "test"),
    ], check=True)
    subprocess.run([str(base / "test")], check=True, timeout=20)
