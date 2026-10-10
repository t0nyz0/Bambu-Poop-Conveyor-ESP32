#!/usr/bin/env python3
"""Compile the real parser and discovery service with deterministic UDP mocks."""
import os
from pathlib import Path
import shlex
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / 'Bambu-Poop-Conveyor/printer_discovery.h').read_text()
service = service[service.index('static WiFiUDP'):service.index('static void handlePrinterDiscoveryGet()')]
MOCKS = r'''
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>
#include "printer_discovery_parser.h"
#include "printer_label.h"
struct IPAddress {
    uint8_t bytes[4];
    IPAddress(uint8_t a=0,uint8_t b=0,uint8_t c=0,uint8_t d=0): bytes{a,b,c,d} {}
    uint8_t operator[](int i) const { return bytes[i]; }
    bool operator==(const IPAddress& p) const { return !memcmp(bytes,p.bytes,4); }
};
struct Datagram { std::string data; IPAddress sender; };
struct WiFiUDP {
    std::vector<Datagram> queue;
    unsigned reads=0, stops=0;
    void stop() { ++stops; queue.clear(); }
    int parsePacket() { return queue.empty()?0:queue.front().data.size(); }
    IPAddress remoteIP() { return queue.front().sender; }
    int read(unsigned char* out,int n) { ++reads; memcpy(out,queue.front().data.data(),n); return n; }
    void clear() { queue.erase(queue.begin()); }
};
const int WL_CONNECTED=3;
struct WiFiMock {
    int connection=WL_CONNECTED;
    int status() {return connection;}
    IPAddress localIP() {return {10,0,0,44};}
    IPAddress subnetMask() {return {255,255,255,0};}
} WiFi;
bool isAPMode=false,restartScheduled=false,firmwareUploadStarted=false;
uint32_t now=0;
uint32_t millis() {return now;}
unsigned checks=0;
void check(bool result,const char* label) {if(!result)throw std::runtime_error(label);++checks;std::cout<<"PASS "<<label<<'\n';}
std::string message(const std::string& serial="01PTEST123",const std::string& ip="10.0.0.50",const std::string& model="C12") {
    return "NOTIFY * HTTP/1.1\r\nHOST: 239.255.255.250:1990\r\nLocation: "+ip+"\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: "+serial+"\r\nNTS: ssdp:alive\r\nDevModel.bambu.com: "+model+"\r\nDevName.bambu.com: Workshop printer\r\n\r\n";
}
bool parse(std::string text,DiscoveredPrinter& p) { std::vector<char> bytes(text.begin(),text.end());bytes.push_back(0);return parsePrinterAnnouncement(bytes.data(),text.size(),p); }
'''
TESTS = r'''
int main() {
    std::cout << std::unitbuf;
    DiscoveredPrinter p;
    check(!printerLabelFor("10.0.0.50", "01PTEST")[0],"older configuration with no name is supported");
    check(updatePrinterLabel("Workshop H2D", "10.0.0.50", "01PTEST"),"discovered label stored separately from connection settings");
    check(!strcmp(printerLabelFor("10.0.0.50", "01PTEST"), "Workshop H2D"),"label shown only for matching IP and serial");
    check(!printerLabelFor("10.0.0.51", "01PTEST")[0] && !printerLabelFor("10.0.0.50", "OTHER")[0],"old name hidden after target changes including older firmware saves");
    check(!updatePrinterLabel("Workshop H2D", "10.0.0.50", "01PTEST"),"identical announcements never cause repeated flash writes");
    check(!updatePrinterLabel(std::string(64,'X').c_str(), "10.0.0.50", "01PTEST"),"oversized labels rejected without overwriting the existing name");
    check(!printerDiscoveryHasRun&&!printerDiscoveryRunning,"discovery does not run in background at startup");
    check(parse(message(),p)&&!strcmp(p.model,"P1")&&!strcmp(p.ip,"10.0.0.50"),"real NOTIFY shape and P1S mapping");
    auto response=message();response.replace(0,17,"HTTP/1.1 200 OK");response.replace(response.find("NT:"),3,"ST:");
    check(parse(response,p),"SSDP response ST accepted");
    auto lowercase=message();lowercase.replace(lowercase.find("Location"),8,"location");
    check(parse(lowercase,p),"case-insensitive header keys");
    for(auto model:{"C11","C12","N1","N2S","BL-P001","BL-P002","C13","O1D","3DPrinter-X1-Carbon"})
        check(parse(message("ZZZTEST", "10.0.0.50", model),p)&&p.model[0],"known raw model mapped");
    for(auto prefix:{"00M","00W","03W","01P","01S","030","039","093","094","22E"})
        check(parse(message(std::string(prefix)+"TEST","10.0.0.50","unknown"),p)&&p.model[0],"known serial fallback mapped");
    check(parse(message("ZZZTEST","10.0.0.50","future"),p)&&!p.model[0],"unknown model stays unguessed");
    check(!parse(message("","10.0.0.50"),p),"empty serial rejected");
    check(!parse(message(std::string(35,'A')),p),"oversized serial rejected");
    check(!parse(message("01P<bad>"),p),"invalid serial rejected");
    for(auto ip:{"10.0.0.999","10.0.0","10.0.0.50:80","http://10.0.0.50","0.1.2.3","127.0.0.1","239.1.2.3","10.0.0.1.evil"})
        check(!parse(message("01PTEST",ip),p),"invalid/non-unicast location rejected");
    auto duplicate=message()+"Location: 10.0.0.51\r\n";
    check(!parse(duplicate,p),"ambiguous duplicate header rejected");
    auto unrelated=message();unrelated.replace(unrelated.find("urn:bambulab-com"),15,"urn:otherdevice");
    check(!parse(unrelated,p),"non-Bambu service rejected");
    auto dead=message();dead.replace(dead.find("ssdp:alive"),10,"ssdp:byebye");
    check(!parse(dead,p),"departure announcement rejected");
    check(!parse(std::string(1025,'X'),p),"oversized packet rejected");
    auto nul=message();nul[25]=0;check(!parse(nul,p),"embedded NUL rejected");
    check(!parse("",p),"empty packet rejected");
    check(!parse("GET / HTTP/1.1\r\n"+message(),p),"non-SSDP message rejected");
    auto control=message();control.insert(control.find("Workshop"),1,'\1');check(!parse(control,p),"control character rejected");

    printerDiscoveryRunning=true;printerDiscoveryStarted=0;
    printerDiscoveryUdp[0].queue={{message(),{10,0,0,50}},{message(),{10,0,0,50}}};
    printerDiscoveryUdp[1].queue={{message("00MTEST","10.0.0.51","BL-P001"),{10,0,0,51}}};
    servicePrinterDiscovery();
    check(discoveredPrinterCount==2&&printerDiscoveryUdp[0].queue.size()==1,"at most one packet per socket per loop");
    servicePrinterDiscovery();check(discoveredPrinterCount==2,"repeat advertisements deduplicated");
    printerDiscoveryUdp[0].queue={{message("BADTEST"),{10,0,0,51}}};servicePrinterDiscovery();
    check(discoveredPrinterCount==2,"forged location differing from sender rejected");
    printerDiscoveryUdp[0].queue={{message("BADTEST","10.0.1.50"),{10,0,1,50}}};servicePrinterDiscovery();
    check(discoveredPrinterCount==2,"off-subnet sender rejected");
    printerDiscoveryUdp[0].queue={{message("SELF","10.0.0.44"),{10,0,0,44}}};servicePrinterDiscovery();
    check(discoveredPrinterCount==2,"self advertisement rejected");
    for(int i=0;i<10;++i){printerDiscoveryUdp[0].queue={{message("01PTEST"+std::to_string(i)),{10,0,0,50}}};servicePrinterDiscovery();}
    check(discoveredPrinterCount==8,"result storage capped at eight");
    now=20000;servicePrinterDiscovery();check(!printerDiscoveryRunning,"search stops at twenty seconds");
    now=5;printerDiscoveryStarted=UINT32_MAX-10000;printerDiscoveryRunning=true;servicePrinterDiscovery();
    check(printerDiscoveryRunning,"millis wrap does not terminate early");
    now=10000;servicePrinterDiscovery();check(!printerDiscoveryRunning,"millis wrap still expires correctly");
    for(bool* flag:{&isAPMode,&restartScheduled,&firmwareUploadStarted}){printerDiscoveryRunning=true;printerDiscoveryStarted=now;*flag=true;servicePrinterDiscovery();check(!printerDiscoveryRunning,"AP/restart/upload closes listeners");*flag=false;}
    printerDiscoveryRunning=true;WiFi.connection=0;servicePrinterDiscovery();check(!printerDiscoveryRunning,"Wi-Fi loss closes listeners");
    check(printerDiscoveryUdp[0].stops>0&&printerDiscoveryUdp[1].stops>0,"both sockets closed on stop");
    std::cout<<checks<<" checks passed\n";
}
'''
with tempfile.TemporaryDirectory(prefix='conveyor-discovery-') as directory:
    source = Path(directory) / 'test.cpp'
    binary = Path(directory) / 'test'
    source.write_text(MOCKS + service + TESTS)
    sanitizers = ['-fsanitize=address,undefined'] if os.environ.get('DISCOVERY_SANITIZE') == '1' else []
    command = shlex.split(os.environ.get('CXX','c++')) + ['-std=c++11','-Wall','-Wextra','-Werror'] + sanitizers + ['-I',str(ROOT/'Bambu-Poop-Conveyor'),str(source),'-o',str(binary)]
    subprocess.run(command, check=True)
    subprocess.run([str(binary)], check=True, timeout=20)
