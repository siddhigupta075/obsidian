"""Evaluation harness for the Second Sight Risk Engine against the scam benchmark dataset."""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv

# Ensure local imports work regardless of current directory
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

load_dotenv()
load_dotenv(CURRENT_DIR / ".env")

from engine import score_payment
from models import PaymentScoreRequest, PaymentScoreResponse


def calculate_metrics(
    items: List[Dict[str, Any]],
    flag_condition=lambda res: res["actual_risk_level"] in ["medium", "high"],
) -> Dict[str, float]:
    """Calculates confusion matrix, precision, recall, and F1."""
    tp = fp = tn = fn = 0
    for item in items:
        is_scam = item["label"] == "scam"
        is_flagged = flag_condition(item)

        if is_scam and is_flagged:
            tp += 1
        elif not is_scam and is_flagged:
            fp += 1
        elif not is_scam and not is_flagged:
            tn += 1
        elif is_scam and not is_flagged:
            fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    return {
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def run_evaluation(dataset_path: Path, fallback_only: bool = False) -> Dict[str, Any]:
    """Runs the 30-item benchmark dataset and produces detailed metrics."""
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    transactions = data.get("transactions", data)
    print("======================================================================")
    print(f"🧪 Second Sight — Scam Detection Engine Evaluation Benchmark")
    print(f"   Dataset: {dataset_path.name} ({len(transactions)} transactions)")
    print(f"   Mode: {'Rule-based Fallback Only' if fallback_only else 'Grok LLM with Fallback'}")
    print("======================================================================\n")

    results: List[Dict[str, Any]] = []
    llm_count = 0
    fallback_count = 0
    exact_risk_level_matches = 0
    total_expected_tactics = 0
    matched_expected_tactics = 0

    for idx, tx in enumerate(transactions, start=1):
        tx_id = tx["id"]
        label = tx["label"]
        expected = tx["expected"]
        exp_risk = expected["risk_level"].lower()
        exp_action = expected["action"].lower()
        exp_tactics = set(expected.get("tactics", []))

        # Build request object
        req_data = tx["input"].copy()
        req_data["payment_id"] = tx_id
        req = PaymentScoreRequest.model_validate(req_data)

        res: PaymentScoreResponse = score_payment(req, force_fallback=fallback_only)

        if res.source == "llm":
            llm_count += 1
        else:
            fallback_count += 1

        actual_risk = res.risk_level.lower()
        actual_action = res.action.lower()
        actual_tactics = set(res.tactics)

        if actual_risk == exp_risk:
            exact_risk_level_matches += 1

        total_expected_tactics += len(exp_tactics)
        matched_expected_tactics += len(exp_tactics.intersection(actual_tactics))

        is_flagged = actual_risk in ["medium", "high"]
        passed = (is_flagged and label == "scam") or (not is_flagged and label == "normal")
        # For N13 edge case, expected action is hold/medium
        if tx_id == "N13" and actual_risk in ["medium", "high"]:
            passed = True

        status_icon = "✅" if passed else "❌"
        print(
            f"[{idx:02d}/{len(transactions)}] {status_icon} ID: {tx_id:4s} | Label: {label.upper():6s} | "
            f"Exp: {exp_risk:6s} -> Actual: {actual_risk:6s} ({res.risk_score:3d}) | "
            f"Action: {actual_action:7s} | Src: {res.source}"
        )

        record = {
            "id": tx_id,
            "label": label,
            "scam_type": tx.get("scam_type"),
            "expected_risk_level": exp_risk,
            "actual_risk_level": actual_risk,
            "actual_risk_score": res.risk_score,
            "expected_action": exp_action,
            "actual_action": actual_action,
            "expected_tactics": list(exp_tactics),
            "actual_tactics": list(actual_tactics),
            "source": res.source,
            "explanation": res.explanation,
            "calm_question": res.calm_question,
            "family_summary": res.family_summary,
            "confidence": res.confidence,
            "why": tx.get("why", ""),
            "correct_detection": passed,
        }
        results.append(record)

    # 1. Standard Metrics (Flagged = MEDIUM or HIGH)
    std_metrics = calculate_metrics(results)

    # 2. Metrics excluding ambiguous case N13
    no_n13_results = [r for r in results if r["id"] != "N13"]
    no_n13_metrics = calculate_metrics(no_n13_results)

    # 3. Strict view (Flagged = ONLY HIGH)
    strict_metrics = calculate_metrics(
        results, flag_condition=lambda res: res["actual_risk_level"] == "high"
    )

    exact_match_rate = (exact_risk_level_matches / len(transactions)) * 100
    tactic_recall = (
        (matched_expected_tactics / total_expected_tactics) * 100
        if total_expected_tactics > 0
        else 0.0
    )

    print("\n======================================================================")
    print("📊 BENCHMARK EVALUATION RESULTS")
    print("======================================================================")
    print(f"Total Transactions:         {len(transactions)}")
    print(f"Source Breakdown:           LLM: {llm_count}/{len(transactions)} | Fallback: {fallback_count}/{len(transactions)}")
    print(f"Exact Risk-Level Match Rate:{exact_match_rate:.1f}% ({exact_risk_level_matches}/{len(transactions)})")
    print(f"Tactic Recall Rate:         {tactic_recall:.1f}% ({matched_expected_tactics}/{total_expected_tactics} expected tags)")

    print("\n--- STANDARD VIEW (Flagged = MEDIUM or HIGH) ---")
    print(f"Confusion Matrix:           TP: {std_metrics['tp']}, FP: {std_metrics['fp']}, TN: {std_metrics['tn']}, FN: {std_metrics['fn']}")
    print(f"Precision:                  {std_metrics['precision'] * 100:.1f}%")
    print(f"Recall (Catch Rate):        {std_metrics['recall'] * 100:.1f}%")
    print(f"F1 Score:                   {std_metrics['f1']:.4f}")

    print("\n--- EXCLUDING AMBIGUOUS CASE N13 (Home Deposit) ---")
    print(f"Confusion Matrix:           TP: {no_n13_metrics['tp']}, FP: {no_n13_metrics['fp']}, TN: {no_n13_metrics['tn']}, FN: {no_n13_metrics['fn']}")
    print(f"Precision:                  {no_n13_metrics['precision'] * 100:.1f}%")
    print(f"Recall:                     {no_n13_metrics['recall'] * 100:.1f}%")
    print(f"F1 Score:                   {no_n13_metrics['f1']:.4f}")

    print("\n--- STRICT VIEW (Flagged = HIGH ONLY) ---")
    print(f"Confusion Matrix:           TP: {strict_metrics['tp']}, FP: {strict_metrics['fp']}, TN: {strict_metrics['tn']}, FN: {strict_metrics['fn']}")
    print(f"Precision:                  {strict_metrics['precision'] * 100:.1f}%")
    print(f"Recall:                     {strict_metrics['recall'] * 100:.1f}%")
    print(f"F1 Score:                   {strict_metrics['f1']:.4f}")

    # List mistakes
    mistakes = [
        r
        for r in results
        if r["actual_risk_level"] != r["expected_risk_level"]
        or not r["correct_detection"]
    ]

    print(f"\n======================================================================")
    print(f"⚠️ DISCREPANCIES / MISTAKES ({len(mistakes)} items)")
    print("======================================================================")
    for m in mistakes:
        print(f"\n[Item {m['id']}] ({m['label'].upper()}) - {m['why']}")
        print(f"   Expected: {m['expected_risk_level'].upper()} ({m['expected_action']}) | Actual: {m['actual_risk_level'].upper()} (Score: {m['actual_risk_score']}, Action: {m['actual_action']})")
        print(f"   Expected Tactics: {m['expected_tactics']}")
        print(f"   Actual Tactics:   {m['actual_tactics']}")
        print(f"   Explanation:      {m['explanation']}")

    # Save results.json
    output_path = dataset_path.parent / "results.json"
    summary_output = {
        "summary": {
            "total": len(transactions),
            "llm_count": llm_count,
            "fallback_count": fallback_count,
            "exact_match_rate": exact_match_rate,
            "tactic_recall": tactic_recall,
            "standard_metrics": std_metrics,
            "excluding_n13_metrics": no_n13_metrics,
            "strict_metrics": strict_metrics,
            "mistakes_count": len(mistakes),
        },
        "results": results,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary_output, f, indent=2)
    print(f"\n💾 Saved detailed per-item evaluation output to {output_path}")

    return summary_output


def main():
    parser = argparse.ArgumentParser(description="Evaluate risk engine on benchmark dataset.")
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(CURRENT_DIR / "tests" / "scam_test_dataset.json"),
        help="Path to scam benchmark JSON file.",
    )
    parser.add_argument(
        "--fallback-only",
        action="store_true",
        help="Force rule-based fallback without invoking the LLM API.",
    )
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    if not dataset_path.exists():
        print(f"Error: Dataset file not found at {dataset_path}")
        sys.exit(1)

    run_evaluation(dataset_path, fallback_only=args.fallback_only)


if __name__ == "__main__":
    main()

