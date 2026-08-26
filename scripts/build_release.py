#!/usr/bin/env python3
"""Build reproducible OTA and merged web-installer firmware artifacts."""
import hashlib
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".pio" / "build" / "esp32dev"
INSTALLER_FW = ROOT / "installer" / "firmware"
DIST = ROOT / "dist" / "v1.5.0"
PIO_HOME = Path.home() / ".platformio"
PIO_PYTHON = PIO_HOME / "penv" / "bin" / "python"
ESPTOOL = PIO_HOME / "packages" / "tool-esptoolpy" / "esptool.py"
BOOT_APP = PIO_HOME / "packages" / "framework-arduinoespressif32" / "tools" / "partitions" / "boot_app0.bin"

subprocess.run(["pio", "run"], cwd=ROOT, check=True)
INSTALLER_FW.mkdir(parents=True, exist_ok=True)
DIST.mkdir(parents=True, exist_ok=True)
ota = DIST / "Bambu-Poop-Conveyor-v1.5.0-ota.bin"
merged = DIST / "Bambu-Poop-Conveyor-v1.5.0-merged.bin"
shutil.copy2(BUILD / "firmware.bin", ota)
subprocess.run([
    str(PIO_PYTHON), str(ESPTOOL), "--chip", "esp32", "merge_bin", "-o", str(merged),
    "--flash_mode", "dio", "--flash_freq", "40m", "--flash_size", "4MB",
    "0x1000", str(BUILD / "bootloader.bin"), "0x8000", str(BUILD / "partitions.bin"),
    "0xe000", str(BOOT_APP), "0x10000", str(BUILD / "firmware.bin")
], check=True)
for artifact in (ota, merged):
    shutil.copy2(artifact, INSTALLER_FW / artifact.name)
checksums = []
for artifact in sorted(DIST.glob("*.bin")):
    checksums.append(f"{hashlib.sha256(artifact.read_bytes()).hexdigest()}  {artifact.name}")
(DIST / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n")
print("\n".join(checksums))
