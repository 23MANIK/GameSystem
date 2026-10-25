# A2 · Data Structures for Big Data: Study Notes (Advanced Topic)

**Source:** https://www.hellointerview.com/learn/system-design/deep-dives/data-structures-for-big-data
*My own summary of the Hello Interview deep dive. Read the original for diagrams and full detail.*

## Why they matter
- The right probabilistic structure can **change the shape of the whole design**.
- **But using one where a hash table would do is a red flag.** Keep it simple.
- Learn caching, load balancing and partitioning before these.

## Bloom filter: "have I seen X?"
- **Answers:** "**definitely not** in the set" or "**probably** in the set". False positives, never false negatives.
- **Intuition:** villagers each stamp one sheet of paper.
  - If any groove of your stamp is missing, you definitely didn't attend.
  - If the sheet is completely inked, it tells you nothing (saturation).
- **How it works:**
  - A bit array of size m and k hash functions.
  - **Insert:** set the k bits. **Query:** if all k bits are set, "probably"; if any is 0, "definitely not".
  - The error rate depends on choosing m and k for the expected number of items.
- **Size reality check:** 1B elements at 1% false positives ≈ **1GB**, versus ~5GB for a hash table. About an 80% saving, not orders of magnitude.
- **No deletes** in the standard version.
- **Use when all three hold:** you're testing membership, memory is tight, and false positives are acceptable.
- **Examples:**
  - **A web crawler's "seen this URL?" check**, where skipping a few pages is fine.
  - **Skipping cache lookups on a guaranteed miss.** It goes stale because the cache uses TTLs but the filter can't delete, and other writers may have filled the cache in the meantime.

## Count-Min Sketch: "how many times have I seen X?" (an upper bound)
- **Intuition:** each villager drops a marble into their assigned holes; their count is the **minimum** across those holes.
  - One hole for everyone tells you nothing; one hole per person is just exact counting with no saving.
- **How it works:**
  - A 2-D array of counters: width w by depth d, one hash function per row.
  - Increment one counter per row; the estimate is the minimum of those counters.
  - **Width** reduces collisions; **depth** increases confidence. Error bounds are mathematically defined.
- **Use when:** you need counts, you **already know which items** to ask about (the sketch can't list them), memory is tight, and an upper-bound estimate is acceptable.
- **Examples:**
  - **Top K:** CMS + a heap or sorted list. Increment, estimate, then update the heap.
  - **LFU caches:** track popularity to choose what to evict.
- **Pitfall:** if other parts of the system depend on exact counts, precision wins. Redis's LFU actually uses a 16-bit counter per key that mixes recency and frequency, not a CMS.

## HyperLogLog: "how many distinct items?" (cardinality)
- **Intuition:** the longest run of tails before a head hints at how many flips there have been. Equivalently, the most leading zeros seen in a hash hints at how many distinct values there are.
- **How it works:**
  - The first b bits of the hash pick one of 2^b buckets.
  - Each bucket stores the maximum leading zeros (+1) seen.
  - The estimate is a **harmonic mean** of the buckets, with corrections at small and large ranges.
- **Remarkably efficient:** ~**1.5KB gives ~2% error over billions of items**. Error ∝ 1/√m.
- **Built into Redis and Postgres.**
- **Use for:** DAU/MAU, unique visitors per page, distinct search terms or IPs, cache working-set size.
- **Security example:** scrapers hit many *distinct* URLs per IP, so count distinct URLs per IP with HLL.
- **Pitfalls:** no exact counts; pointless overhead for small sets.

## Approximate quantiles: histograms and buckets
- "What is p95 latency?" Exact percentiles need every value stored and sorted, which isn't feasible at scale.
- **Bucket counters** (e.g. 0–10ms, 10–50ms, …).
  - To find a percentile, sum the buckets until you reach the target fraction.
  - Optionally store **cumulative** counts: more writes, simpler reads.
- **Bucket styles:**
  - **Fixed width:** for uniform, known ranges.
  - **Exponential** (1–2, 2–4, 4–8ms…): for latencies and power-law data.
  - **Dynamic:** adjusts boundaries automatically; usually not worth the complexity.
- **Error is bounded by the bucket width;** accuracy drops at the extremes.
- **Used by:** Prometheus histograms, APM tools, SLO checks (p99 < 100ms?), A/B analytics, autoscaling on percentiles.
- **Pitfall:** coarse buckets like [0–1s, 1–10s] lose all detail when most requests take under 100ms. Use log spacing.

## Cheat sheet
| Question | Structure | Error | Memory |
|---|---|---|---|
| Is X in the set? | Bloom filter | False positives only | ~1GB for 1B items at 1% |
| How many times X? | Count-Min Sketch | Overestimates | w × d counters |
| How many distinct? | HyperLogLog | ~1–2% | ~KBs |
| What is the p95? | Histogram buckets | ≤ bucket width | # of buckets |

## Related breakdowns
- Web Crawler (Bloom)
- Tinder (Bloom for already-swiped profiles)
- YouTube Top K (CMS)
- FB Post Search (CMS for bigram frequency)
- Metrics Monitoring (histograms, Bloom for cardinality)

## Game-design hooks
- **HLL:** unique players per level or day.
- **CMS:** the most-played levels in real time.
- **Bloom:** "has this player already claimed reward X?" as a cheap pre-check before the database.
- **Histograms:** level completion-time percentiles for difficulty tuning.
