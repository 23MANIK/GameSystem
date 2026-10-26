# ticketing: pack check

Result: **PASS**

## Balance (tools/balance-levels.mjs)

| Level | New | Target | With | Without new | Run/min | Revenue/min |
|---|---|---|---|---|---|---|
| 1 | app | 100 | OK | – | 154 | 750 |
| 2 | db | 400 | OK | breaks ✓ | 206 | 540 |
| 3 | – | 600 | OK | – | 440 | 1080 |
| 4 | gateway | 800 | OK | breaks ✓ | 507 | 1320 |
| 5 | lb | 1800 | OK | breaks ✓ | 1092 | 2700 |
| 6 | cache | 2500 | OK | breaks ✓ | 1635 | 4125 |
| 7 | – | 3000 | OK | – | 2143 | 5400 |
| 8 | queue | 3500 | OK | breaks ✓ | 2218 | 5775 |

## Play-test (tools/playtest-headless.mjs)

| Level | Name | Done | Minutes | Users | Coins start → end | Apps | Shards |
|---|---|---|---|---|---|---|---|
| 1 | First Show | ✓ | 5.2 | 125 | 500 → 4003 | 1 | 0 |
| 2 | Thousands of Seats | ✓ | 8 | 501 | 4003 → 7757 | 1 | 1 |
| 3 | Sold Twice | ✓ | 3.9 | 668 | 7757 → 11910 | 1 | 1 |
| 4 | Scalper Bots | ✓ | 2.3 | 828 | 11910 → 19633 | 1 | 1 |
| 5 | Big Night Out | ✓ | 2.7 | 1801 | 19633 → 16167 | 3 | 1 |
| 6 | Same Page, Every Fan | ✓ | 4.1 | 2663 | 16167 → 29125 | 4 | 1 |
| 7 | Find the Show | ✓ | 4.5 | 3809 | 29125 → 51485 | 6 | 1 |
| 8 | The Mega On-Sale | ✓ | 3.8 | 4409 | 51485 → 90964 | 6 | 1 |

## Errors

None.

## Warnings

None.
