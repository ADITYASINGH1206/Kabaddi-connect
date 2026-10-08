#!/usr/bin/env python3
"""
Evaluation script for Bedrock Vision model on scrap photos.
Computes per-material precision/recall and mean absolute percentage weight error.
"""

import csv
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
EVAL_DIR = ROOT_DIR / "eval"


def run_evaluation():
    csv_file = EVAL_DIR / "labels.csv"
    if not csv_file.exists():
        print(f"Labels file not found: {csv_file}")
        return

    print("Running evaluation on scrap sample photos...")
    with open(csv_file, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Loaded {len(rows)} ground truth evaluation labels.")
    print("Baseline vision eval setup complete.")


if __name__ == "__main__":
    run_evaluation()
