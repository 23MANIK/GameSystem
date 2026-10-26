# ad_clicks: pack check

Result: **PASS**

## Balance (tools/balance-levels.mjs)

| Level | New | Target | With | Without new | Run/min | Revenue/min |
|---|---|---|---|---|---|---|
| 1 | app | 100 | OK | – | 180 | 750 |
| 2 | db | 400 | OK | breaks ✓ | 233 | 576 |
| 3 | queue | 900 | OK | breaks ✓ | 525 | 1323 |
| 4 | – | 1100 | OK | – | 597 | 1485 |
| 5 | cache | 1200 | OK | breaks ✓ | 622 | 1548 |
| 6 | lb | 2400 | OK | breaks ✓ | 1187 | 2952 |
| 7 | – | 2800 | OK | – | 1325 | 3276 |
| 8 | blob | 3200 | OK | breaks ✓ | 1636.6 | 4128 |
| 9 | – | 4000 | OK | – | 2750.6 | 6840 |

## Play-test (tools/playtest-headless.mjs)

| Level | Name | Done | Minutes | Users | Coins start → end | Apps | Shards |
|---|---|---|---|---|---|---|---|
| 1 | First Click | ✓ | 4.1 | 126 | 500 → 2667 | 1 | 0 |
| 2 | Ads Everywhere | ✓ | 9.6 | 484 | 2667 → 6164 | 1 | 1 |
| 3 | Click Storm | ✓ | 12.4 | 927 | 6164 → 17611 | 1 | 1 |
| 4 | Slow Dashboards | ✓ | 5.2 | 1098 | 17611 → 24977 | 1 | 1 |
| 5 | Counted Twice | ✓ | 4.9 | 878 | 24977 → 31817 | 1 | 1 |
| 6 | Prime Time | ✓ | 4.5 | 2408 | 31817 → 27649 | 3 | 1 |
| 7 | The Viral Ad | ✓ | 4.2 | 3156 | 27649 → 43069 | 4 | 1 |
| 8 | Never Lose a Click | ✓ | 4.7 | 4003 | 43069 → 72579 | 5 | 1 |
| 9 | Every Advertiser | ✓ | 4.5 | 4255 | 72579 → 108435 | 5 | 3 |

## Errors

None.

## Warnings

None.
