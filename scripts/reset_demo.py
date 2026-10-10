#!/usr/bin/env python3
"""
scripts/reset_demo.py
Reseeds Collectors, Rates, sample Listings and E-waste points;
clears live pickups and resets demo state in under 10 seconds.
Per spec §4.5.
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SEED_SCRIPT = ROOT_DIR / "seed" / "seed.py"


def main():
    print("=== KabadiConnect Demo Reset Tool ===")
    if not SEED_SCRIPT.exists():
        print(f"[!] Error: Seed script not found at {SEED_SCRIPT}")
        sys.exit(1)

    cmd = [sys.executable, str(SEED_SCRIPT), "--reset"]
    print(f"Running: {' '.join(cmd)}")

    try:
        res = subprocess.run(cmd, check=True)
        print("[OK] Demo environment successfully reset and reseeded.")
        sys.exit(res.returncode)
    except subprocess.CalledProcessError as e:
        print(f"[!] Demo reset failed with exit code {e.returncode}")
        sys.exit(e.returncode)


if __name__ == "__main__":
    main()
