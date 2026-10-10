#!/usr/bin/env python3
"""
Evaluation tool for the KabadiConnect vision pipeline.

Runs REAL photos through the deployed API (POST /uploads -> PUT -> POST /analyze)
and compares the result with labels the team measured by hand. It never invents
model output: with no photos it exits with an error and writes no report.

Usage:
    python eval/run_eval.py --api-url https://<id>.execute-api.<region>.amazonaws.com --split report

Inputs:
    eval/labels.csv   columns: image_name,material,actual_weight_kg,split,notes
                      (one row per material per photo; split is "tune" or "report")
    eval/photos/      the JPEG files named in labels.csv

Tune the prompt on the "tune" split, then report numbers from the "report" split only.
"""

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
EVAL_DIR = ROOT_DIR / "eval"
DOCS_DIR = ROOT_DIR / "docs"


# ─── Labels ──────────────────────────────────────────────────────────────────

def load_labels(csv_file: Path, split: str) -> Dict[str, Dict[str, float]]:
    """Returns {image_name: {material: total_actual_kg}} for the requested split."""
    truth: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    if not csv_file.exists():
        return {}
    with open(csv_file, mode="r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            image = (row.get("image_name") or "").strip()
            material = (row.get("material") or "").strip()
            if not image or not material:
                continue
            row_split = (row.get("split") or "report").strip() or "report"
            if split != "all" and row_split != split:
                continue
            truth[image][material] += float(row["actual_weight_kg"])
    return {k: dict(v) for k, v in truth.items()}


# ─── HTTP (stdlib only) ──────────────────────────────────────────────────────

def _request(url: str, method: str = "GET", body: Optional[bytes] = None,
             headers: Optional[Dict[str, str]] = None, timeout: int = 40) -> Dict[str, Any]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def analyze_photo(api_url: str, photo_path: Path) -> Dict[str, Any]:
    """Uploads one photo via a presigned URL and returns the /analyze JSON."""
    base = api_url.rstrip("/")
    up = _request(
        f"{base}/uploads", "POST",
        json.dumps({"contentType": "image/jpeg"}).encode(),
        {"Content-Type": "application/json"},
    )
    put_req = urllib.request.Request(
        up["uploadUrl"], data=photo_path.read_bytes(), method="PUT",
        headers={"Content-Type": "image/jpeg"},
    )
    with urllib.request.urlopen(put_req, timeout=60):
        pass
    return _request(
        f"{base}/analyze", "POST",
        json.dumps({"imageKey": up["imageKey"], "lang": "en"}).encode(),
        {"Content-Type": "application/json"},
    )


# ─── Metrics ─────────────────────────────────────────────────────────────────

def predicted_weights(analysis: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    """{material: {"low": kg, "high": kg}} summed over repeated materials."""
    out: Dict[str, Dict[str, float]] = {}
    for item in analysis.get("items", []):
        m = item.get("material")
        cur = out.setdefault(m, {"low": 0.0, "high": 0.0})
        cur["low"] += float(item.get("weight_kg_low", 0))
        cur["high"] += float(item.get("weight_kg_high", 0))
    return out


def compute_metrics(truth: Dict[str, Dict[str, float]],
                    predictions: Dict[str, Dict[str, Dict[str, float]]]) -> Dict[str, Any]:
    """
    truth:       {image: {material: actual_kg}}
    predictions: {image: {material: {"low": kg, "high": kg}}}   (only successfully analysed images)
    """
    stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    errors: List[float] = []
    in_range = 0
    weighed = 0

    for image, true_by_mat in truth.items():
        if image not in predictions:
            continue
        pred = predictions[image]
        for mat, kg in true_by_mat.items():
            if mat in pred:
                stats[mat]["tp"] += 1
                mid = (pred[mat]["low"] + pred[mat]["high"]) / 2.0
                if kg > 0:
                    errors.append(abs(mid - kg) / kg * 100.0)
                    weighed += 1
                    if pred[mat]["low"] <= kg <= pred[mat]["high"]:
                        in_range += 1
            else:
                stats[mat]["fn"] += 1
        for mat in pred:
            if mat not in true_by_mat:
                stats[mat]["fp"] += 1

    per_material = {}
    for mat, c in sorted(stats.items()):
        tp, fp, fn = c["tp"], c["fp"], c["fn"]
        per_material[mat] = {
            "precision_pct": round(tp / (tp + fp) * 100.0, 1) if (tp + fp) else None,
            "recall_pct": round(tp / (tp + fn) * 100.0, 1) if (tp + fn) else None,
            "support": tp + fn,
        }

    return {
        "per_material": per_material,
        "mape_pct": round(sum(errors) / len(errors), 1) if errors else None,
        "in_range_pct": round(in_range / weighed * 100.0, 1) if weighed else None,
        "weight_comparisons": weighed,
    }


def _fmt(v: Optional[float]) -> str:
    return "n/a" if v is None else f"{v}%"


def write_report(metrics: Dict[str, Any], split: str, n_ok: int, n_failed: int, n_missing: int):
    lines = [
        "# KabadiConnect vision evaluation",
        "",
        f"- Date: {date.today().isoformat()}",
        f"- Split: `{split}`",
        f"- Photos analysed: **{n_ok}** (failed or fell back to manual entry: {n_failed}, photo file missing: {n_missing})",
        f"- Weight comparisons: {metrics['weight_comparisons']}",
        f"- Mean absolute % error of the range midpoint vs scale weight: **{_fmt(metrics['mape_pct'])}**",
        f"- Scale weight inside the predicted range: **{_fmt(metrics['in_range_pct'])}**",
        "",
        "| Material | Precision | Recall | Photos with this material |",
        "| :--- | :--- | :--- | :--- |",
    ]
    for mat, m in metrics["per_material"].items():
        lines.append(f"| `{mat}` | {_fmt(m['precision_pct'])} | {_fmt(m['recall_pct'])} | {m['support']} |")
    lines += [
        "",
        "Method: team-captured photos, each material weighed by the team (see `eval/README.md`),",
        "sent through the deployed `/analyze` endpoint. Small samples: read these as indicative, not statistical.",
        "",
    ]
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCS_DIR / "eval-results.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Wrote {DOCS_DIR / 'eval-results.md'}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate the KabadiConnect vision pipeline on real photos")
    parser.add_argument("--split", choices=["tune", "report", "all"], default="report")
    parser.add_argument("--api-url", default=os.environ.get("KABADI_API_URL"),
                        help="Deployed API base URL (or set KABADI_API_URL)")
    parser.add_argument("--photos-dir", default=str(EVAL_DIR / "photos"))
    parser.add_argument("--labels", default=str(EVAL_DIR / "labels.csv"))
    parser.add_argument("--no-report", action="store_true", help="Print only; do not write docs/eval-results.md")
    args = parser.parse_args()

    if not args.api_url:
        print("Error: pass --api-url (or set KABADI_API_URL).", file=sys.stderr)
        return 2

    truth = load_labels(Path(args.labels), args.split)
    if not truth:
        print(f"Error: no labelled photos for split '{args.split}' in {args.labels}. "
              "Add rows (see eval/README.md). No report written.", file=sys.stderr)
        return 1

    photos_dir = Path(args.photos_dir)
    predictions: Dict[str, Dict[str, Dict[str, float]]] = {}
    failed, missing = [], []

    for image in sorted(truth):
        path = photos_dir / image
        if not path.exists():
            missing.append(image)
            print(f"  [missing] {image}")
            continue
        try:
            analysis = analyze_photo(args.api_url, path)
        except (urllib.error.URLError, OSError, KeyError, ValueError) as e:
            failed.append(image)
            print(f"  [error]   {image}: {e}")
            continue
        if analysis.get("fallback") or not analysis.get("photo_quality_ok", True):
            failed.append(image)
            print(f"  [skipped] {image}: fallback={analysis.get('fallback')}, "
                  f"quality_ok={analysis.get('photo_quality_ok')}")
            continue
        predictions[image] = predicted_weights(analysis)
        print(f"  [ok]      {image}: {sorted(predictions[image])}")

    if not predictions:
        print("Error: no photo could be analysed, so there is nothing to report. No report written.",
              file=sys.stderr)
        return 1

    metrics = compute_metrics(truth, predictions)
    print(f"\nPhotos analysed: {len(predictions)}  failed/skipped: {len(failed)}  missing: {len(missing)}")
    print(f"Mean absolute % error (range midpoint vs scale): {_fmt(metrics['mape_pct'])}")
    print(f"Scale weight inside predicted range:             {_fmt(metrics['in_range_pct'])}")
    for mat, m in metrics["per_material"].items():
        print(f" - {mat}: precision {_fmt(m['precision_pct'])}, recall {_fmt(m['recall_pct'])}, n={m['support']}")

    if not args.no_report:
        write_report(metrics, args.split, len(predictions), len(failed), len(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
