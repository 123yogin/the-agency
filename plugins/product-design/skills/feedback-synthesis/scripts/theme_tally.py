#!/usr/bin/env python3
"""Tally coded feedback into a theme x frequency x severity table.

Input: a CSV with one row per feedback item and these columns:
  id        unique item id
  user      who said it (used to count distinct people, not mentions)
  source    ticket / review / nps / interview / sales-call / ...
  segment   optional; any grouping you want broken out
  codes     one or more theme codes, separated by ";"
  severity  1-4 (1 cosmetic, 2 minor, 3 major, 4 blocks the job)

Output: themes ranked by distinct users x mean severity, with per-source and
per-segment counts so a theme carried by one loud channel is visible.

Usage:
  python3 theme_tally.py coded.csv
  python3 theme_tally.py coded.csv --format json
  python3 theme_tally.py --sample
"""

import argparse
import csv
import io
import json
import sys
from collections import defaultdict

SAMPLE = """id,user,source,segment,codes,severity
1,u1,review,free,sync-lost-data;onboarding-confusing,4
2,u2,ticket,paid,sync-lost-data,4
3,u3,nps,paid,wants-dark-mode,1
4,u1,ticket,free,sync-lost-data,4
5,u4,interview,paid,onboarding-confusing,3
6,u5,review,free,onboarding-confusing,2
7,u6,sales-call,paid,missing-export,3
8,u7,nps,free,wants-dark-mode,1
"""


def load(handle):
    reader = csv.DictReader(handle)
    required = {"id", "user", "source", "codes", "severity"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"missing columns: {', '.join(sorted(missing))}")
    rows = []
    for row in reader:
        sev = int(row["severity"])
        if not 1 <= sev <= 4:
            raise ValueError(f"severity must be 1-4 (row id {row['id']})")
        codes = [c.strip() for c in row["codes"].split(";") if c.strip()]
        rows.append({**row, "severity": sev, "codes": codes, "segment": row.get("segment") or "-"})
    return rows


def tally(rows):
    themes = defaultdict(lambda: {"mentions": 0, "users": set(), "sev": [], "sources": defaultdict(set), "segments": defaultdict(set)})
    all_users = {r["user"] for r in rows}
    for r in rows:
        for code in r["codes"]:
            t = themes[code]
            t["mentions"] += 1
            t["users"].add(r["user"])
            t["sev"].append(r["severity"])
            t["sources"][r["source"]].add(r["user"])
            t["segments"][r["segment"]].add(r["user"])
    out = []
    for code, t in themes.items():
        users = len(t["users"])
        mean_sev = sum(t["sev"]) / len(t["sev"])
        top_source_share = max(len(u) for u in t["sources"].values()) / users
        out.append({
            "theme": code,
            "distinct_users": users,
            "share_of_users": round(users / len(all_users), 3),
            "mentions": t["mentions"],
            "mean_severity": round(mean_sev, 2),
            "max_severity": max(t["sev"]),
            "priority": round(users * mean_sev, 2),
            "by_source": {k: len(v) for k, v in sorted(t["sources"].items())},
            "by_segment": {k: len(v) for k, v in sorted(t["segments"].items())},
            "single_channel": len(t["sources"]) == 1 and users > 1,
            "top_source_share": round(top_source_share, 2),
        })
    out.sort(key=lambda x: (x["priority"], x["max_severity"]), reverse=True)
    return {"items": len(rows), "distinct_users": len(all_users), "themes": out}


def print_human(result):
    print(f"Feedback tally: {result['items']} items from {result['distinct_users']} distinct users\n")
    print(f"{'theme':28} {'users':>5} {'share':>6} {'ment.':>5} {'sev':>4} {'max':>3} {'prio':>6}  sources")
    for t in result["themes"]:
        src = ", ".join(f"{k}:{v}" for k, v in t["by_source"].items())
        flag = "  [one channel]" if t["single_channel"] else ""
        print(f"{t['theme'][:28]:28} {t['distinct_users']:>5} {t['share_of_users']:>6.0%} {t['mentions']:>5} "
              f"{t['mean_severity']:>4} {t['max_severity']:>3} {t['priority']:>6}  {src}{flag}")
    print("\npriority = distinct users x mean severity. Counts are people, not mentions.")
    print("Feedback over-represents vocal and engaged users; churned and silent users are missing.")


def main():
    p = argparse.ArgumentParser(description="Tally coded feedback into themes.")
    p.add_argument("input", nargs="?", help="coded CSV file")
    p.add_argument("--format", choices=["human", "json"], default="human")
    p.add_argument("--sample", action="store_true", help="run on built-in sample data")
    args = p.parse_args()
    if args.sample:
        rows = load(io.StringIO(SAMPLE))
    elif args.input:
        with open(args.input, newline="", encoding="utf-8") as f:
            rows = load(f)
    else:
        p.error("provide a CSV file or --sample")
    result = tally(rows)
    if args.format == "json":
        json.dump(result, sys.stdout, indent=2)
        print()
    else:
        print_human(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
