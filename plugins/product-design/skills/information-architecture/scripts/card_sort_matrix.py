#!/usr/bin/env python3
"""Analyse open or closed card-sort results.

Input: a CSV with one row per card placement:
  participant   participant id
  card          card label
  group         the group name that participant put the card in

Output:
  - the card pairs most often grouped together (% of participants who sorted
    both cards and put them in the same group)
  - clusters formed by average-linkage agglomeration on that similarity,
    cut at --threshold (default 0.5)
  - for each cluster, the group names participants used most (label candidates)

Usage:
  python3 card_sort_matrix.py results.csv
  python3 card_sort_matrix.py results.csv --threshold 0.6 --top 20
  python3 card_sort_matrix.py --sample
"""

import argparse
import csv
import io
from collections import Counter, defaultdict
from itertools import combinations

SAMPLE = """participant,card,group
p1,Start a challenge,Challenges
p1,Browse challenges,Challenges
p1,Today's tasks,Today
p1,Mark day done,Today
p1,Reminder time,Settings
p1,Export data,Settings
p2,Start a challenge,New
p2,Browse challenges,Explore
p2,Today's tasks,Daily
p2,Mark day done,Daily
p2,Reminder time,Notifications
p2,Export data,Account
p3,Start a challenge,Challenges
p3,Browse challenges,Challenges
p3,Today's tasks,Today
p3,Mark day done,Today
p3,Reminder time,Settings
p3,Export data,Settings
p4,Start a challenge,Challenges
p4,Browse challenges,Challenges
p4,Today's tasks,My day
p4,Mark day done,My day
p4,Reminder time,Settings
p4,Export data,Account
"""


def load(handle):
    reader = csv.DictReader(handle)
    missing = {"participant", "card", "group"} - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"missing columns: {', '.join(sorted(missing))}")
    placements = defaultdict(dict)  # participant -> card -> group
    for row in reader:
        placements[row["participant"].strip()][row["card"].strip()] = row["group"].strip()
    return placements


def similarity(placements):
    cards = sorted({c for p in placements.values() for c in p})
    together = Counter()
    both = Counter()
    for sorts in placements.values():
        for a, b in combinations(sorted(sorts), 2):
            both[(a, b)] += 1
            if sorts[a].lower() == sorts[b].lower():
                together[(a, b)] += 1
    sim = {pair: together[pair] / both[pair] for pair in both}
    return cards, sim


def pair_sim(sim, a, b):
    key = (a, b) if a < b else (b, a)
    return sim.get(key, 0.0)


def cluster(cards, sim, threshold):
    clusters = [[c] for c in cards]
    while len(clusters) > 1:
        best, best_score = None, -1.0
        for i, j in combinations(range(len(clusters)), 2):
            scores = [pair_sim(sim, a, b) for a in clusters[i] for b in clusters[j]]
            score = sum(scores) / len(scores)
            if score > best_score:
                best, best_score = (i, j), score
        if best_score < threshold:
            break
        i, j = best
        clusters[i] = clusters[i] + clusters[j]
        del clusters[j]
    return clusters


def label_candidates(placements, members):
    names = Counter()
    for sorts in placements.values():
        for card in members:
            if card in sorts:
                names[sorts[card].lower()] += 1
    return names.most_common(3)


def main():
    ap = argparse.ArgumentParser(description="Analyse card-sort results.")
    ap.add_argument("input", nargs="?", help="CSV with participant,card,group")
    ap.add_argument("--threshold", type=float, default=0.5, help="cluster cut-off similarity (0-1)")
    ap.add_argument("--top", type=int, default=15, help="number of top pairs to show")
    ap.add_argument("--sample", action="store_true", help="run on built-in sample data")
    args = ap.parse_args()
    if args.sample:
        placements = load(io.StringIO(SAMPLE))
    elif args.input:
        with open(args.input, newline="", encoding="utf-8") as f:
            placements = load(f)
    else:
        ap.error("provide a CSV file or --sample")

    cards, sim = similarity(placements)
    print(f"Card sort: {len(placements)} participants, {len(cards)} cards\n")
    print("Most often grouped together")
    ranked = [kv for kv in sorted(sim.items(), key=lambda kv: kv[1], reverse=True) if kv[1] > 0]
    for (a, b), s in ranked[: args.top]:
        print(f"  {s:5.0%}  {a}  +  {b}")

    print(f"\nClusters (average linkage, cut at {args.threshold:.0%})")
    for n, members in enumerate(cluster(cards, sim, args.threshold), 1):
        labels = ", ".join(f"'{name}' x{count}" for name, count in label_candidates(placements, members))
        print(f"  {n}. {' | '.join(members)}")
        print(f"     labels used: {labels}")
    print("\nCards that sit alone or in weak clusters are the ones to test in a tree test.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
