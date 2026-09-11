#!/usr/bin/env python3
"""Build reproducible OTA and merged web-installer firmware artifacts."""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".pio" / "build" / "esp32dev"
INSTALLER_FW = ROOT / "installer" / "firmware"
SOURCE = ROOT / "Bambu-Poop-Conveyor" / "Bambu-Poop-Conveyor.ino"
PIO_HOME = Path(os.environ.get("PLATFORMIO_CORE_DIR", Path.home() / ".platformio"))
PACKAGES = Path(os.environ.get("PLATFORMIO_PACKAGES_DIR", PIO_HOME / "packages"))
PIO_PYTHON = PIO_HOME / "penv" / "bin" / "python"
ESPTOOL = PACKAGES / "tool-esptoolpy" / "esptool.py"
BOOT_APP = PACKAGES / "framework-arduinoespressif32" / "tools" / "partitions" / "boot_app0.bin"

parser = argparse.ArgumentParser()
parser.add_argument("--version", help="Expected firmware version (defaults to the source value)")
args = parser.parse_args()
match = re.search(r'char version\[\d+\]\s*=\s*"([^"]+)"', SOURCE.read_text())
if not match:
    raise SystemExit("Could not read the firmware version from the source")
version = match.group(1)
if args.version and args.version != version:
    raise SystemExit(f"Source version is {version}, not {args.version}")
DIST = ROOT / "dist" / f"v{version}"

subprocess.run(["pio", "run"], cwd=ROOT, check=True)
INSTALLER_FW.mkdir(parents=True, exist_ok=True)
DIST.mkdir(parents=True, exist_ok=True)
ota = DIST / f"Bambu-Poop-Conveyor-v{version}-ota.bin"
merged = DIST / f"Bambu-Poop-Conveyor-v{version}-merged.bin"
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
