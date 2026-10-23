# news_feed: pack check

Result: **PASS**

## Balance (tools/balance-levels.mjs)

| Level | New | Target | With | Without new | Run/min | Revenue/min |
|---|---|---|---|---|---|---|
| 1 | app | 100 | OK | – | 124 | 750 |
| 2 | db | 400 | OK | breaks ✓ | 230 | 720 |
| 3 | gateway | 550 | OK | breaks ✓ | 376 | 990 |
| 4 | lb | 1500 | OK | breaks ✓ | 1026 | 2700 |
| 5 | cache | 2000 | OK | breaks ✓ | 1223 | 3600 |
| 6 | queue | 2500 | OK | breaks ✓ | 1995 | 4500 |
| 7 | – | 3000 | OK | – | 2150 | 5400 |
| 8 | idgen | 3500 | OK | breaks ✓ | 2793 | 6300 |
| 9 | cdn | 5000 | OK | breaks ✓ | 2161 | 6000 |

## Play-test (tools/playtest-headless.mjs)

| Level | Name | Done | Minutes | Users | Coins start → end | Apps | Shards |
|---|---|---|---|---|---|---|---|
| 1 | Hello, Posts | ✓ | 4.8 | 126 | 500 → 4026 | 1 | 0 |
| 2 | The Feed Gets Slow | ✓ | 9.6 | 435 | 4026 → 9576 | 1 | 1 |
| 3 | Spam Accounts | ✓ | 2.8 | 685 | 9576 → 14791 | 1 | 1 |
| 4 | Everyone Scrolls | ✓ | 8.3 | 1909 | 14791 → 18854 | 3 | 1 |
| 5 | Precomputed Feeds | ✓ | 2.3 | 2068 | 18854 → 26610 | 4 | 1 |
| 6 | Background Fan-out | ✓ | 6.7 | 3063 | 26610 → 42869 | 5 | 1 |
| 7 | Celebrity Problem | ✓ | 11.2 | 3761 | 42869 → 88272 | 6 | 1 |
| 8 | Billions of Posts | ✓ | 2.2 | 4033 | 88272 → 111155 | 6 | 3 |
| 9 | Photos Worldwide | ✓ | 8.6 | 5753 | 111155 → 134856 | 6 | 3 |

## Errors

None.

## Warnings

None.
