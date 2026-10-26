# ai_agent: pack check

Result: **PASS**

## Balance (tools/balance-levels.mjs)

| Level | New | Target | With | Without new | Run/min | Revenue/min |
|---|---|---|---|---|---|---|
| 1 | app | 100 | OK | – | 109 | 750 |
| 2 | llm | 300 | OK | breaks ✓ | 338.1 | 810 |
| 3 | db | 600 | OK | breaks ✓ | 566.5 | 1440 |
| 4 | kb | 900 | OK | breaks ✓ | 1172.3 | 2970 |
| 5 | tools | 1200 | OK | breaks ✓ | 2548.7 | 4320 |
| 6 | queue | 1800 | OK | breaks ✓ | 3891.7 | 6480 |
| 7 | cache | 2800 | OK | breaks ✓ | 2076.7 | 10080 |
| 8 | guard | 3000 | OK | breaks ✓ | 2403.3 | 10800 |
| 9 | orch | 3500 | OK | breaks ✓ | 4999.1 | 14700 |

## Play-test (tools/playtest-headless.mjs)

| Level | Name | Done | Minutes | Users | Coins start → end | Apps | Shards |
|---|---|---|---|---|---|---|---|
| 1 | Hello, Agent | ✓ | 9.8 | 125 | 500 → 4365 | 1 | 0 |
| 2 | Rent a Big Brain | ✓ | 8.3 | 383 | 4365 → 7682 | 1 | 0 |
| 3 | It Forgot Me | ✓ | 6.9 | 755 | 7682 → 12303 | 1 | 1 |
| 4 | Making Things Up | ✓ | 2.8 | 1030 | 12303 → 21625 | 1 | 1 |
| 5 | Where Is My Order? | ✓ | 3.9 | 1507 | 21625 → 33944 | 1 | 1 |
| 6 | Rate Limited | ✓ | 3.6 | 2263 | 33944 → 48812 | 1 | 1 |
| 7 | The Bill Is Huge | ✓ | 2.1 | 3223 | 48812 → 71939 | 1 | 1 |
| 8 | Jailbreak! | ✓ | 4.2 | 3817 | 71939 → 136167 | 1 | 1 |
| 9 | Deep Research | ✓ | 3.8 | 3858 | 136167 → 186078 | 1 | 1 |

## Errors

None.

## Warnings

None.

