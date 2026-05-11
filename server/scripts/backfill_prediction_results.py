#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select, update

SERVER_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SERVER_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

from server.app import SessionLocal  # noqa: E402
from server.models import Match, Prediction  # noqa: E402

PRED_POINTS = 50


def backfill(from_match_id: int) -> tuple[int, int, int]:
    updated = 0
    skipped = 0
    nr_reset = 0

    with SessionLocal() as db:
        matches = db.scalars(
            select(Match).where(Match.id >= from_match_id).order_by(Match.id)
        ).all()

        winners = {}
        for m in matches:
            winner = (m.winner or "").strip().upper()
            if not winner:
                continue
            winners[int(m.id)] = winner

        if not winners:
            return 0, 0, 0

        preds = db.scalars(
            select(Prediction).where(Prediction.match_id.in_(list(winners.keys())))
        ).all()

        now = datetime.utcnow()
        for p in preds:
            winner = winners.get(int(p.match_id))
            if not winner:
                skipped += 1
                continue
            if winner == "NR":
                p.is_correct = None
                p.points_awarded = 0
                p.updated_at = now
                nr_reset += 1
                continue
            pick = (p.pick or "").strip().upper()
            is_correct = 1 if pick == winner else 0
            points = PRED_POINTS if is_correct == 1 else 0
            p.is_correct = is_correct
            p.points_awarded = points
            p.updated_at = now
            updated += 1

        db.commit()

    return updated, skipped, nr_reset


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill prediction correctness and points.")
    parser.add_argument("--from-match-id", type=int, default=1, help="First match id to include.")
    args = parser.parse_args()

    updated, skipped, nr_reset = backfill(args.from_match_id)
    print(f"Updated predictions: {updated}")
    print(f"NR resets: {nr_reset}")
    print(f"Skipped (no winner): {skipped}")


if __name__ == "__main__":
    main()
