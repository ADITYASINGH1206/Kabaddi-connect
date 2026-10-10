# KabadiConnect: 3-Minute Demo Video Script

**Target length:** 2:50. Record on real phones. There is no live demo, so rehearse twice with a timer.

**Before recording:** run `python scripts/reset_demo.py --region <region>` for a clean state, do one full dry run, and write down the *actual* numbers shown on screen. Read numbers off the screen while recording; do not narrate figures you have not seen.

**Devices:** Phone 1 = household seller (seeded demo user, e.g. "Pooja Verma", Rohini). Phone 2 = collector (seeded demo collector, e.g. "Ramesh Kumar", DTU area). These people are fictional demo data.

| Time | Scene | Narration (adjust to what is really on screen) | Action |
| :--- | :--- | :--- | :--- |
| 0:00 - 0:25 | **The problem** | "Informal collectors, the kabadiwalas, pick up a lot of India's recyclable scrap. But households don't know what scrap is worth, and collectors can't tell whether a trip is worth making." `[Add one real fact from our dealer visit if we have one; do not add statistics we have not sourced.]` | Show a real pile of scrap, then the app opening. |
| 0:25 - 1:15 | **Household** | "The household photographs the scrap. Amazon Bedrock identifies the materials and gives a weight *range* and a price range. The household can adjust the weights, choose a pickup area, and request a pickup." | Snap a real photo, show detected materials and the price range `[read the real range]`, move a slider, choose area, submit. |
| 1:15 - 1:35 | **Matching & safety** | "The app matches the closest suitable collectors. Hazardous items like batteries or CRT monitors are never sent to a regular collector; the app points to drop-off locations instead." | Show the matched list. Show the hazard case with a battery photo `[note: drop-off entries are placeholders until verified, so keep this on screen briefly or use verified ones]`. |
| 1:35 - 2:10 | **Collector** | "On the collector's phone the request appears with a worth-it tag. He accepts, sees his accepted stops in nearest-neighbour order with navigation links, and at the door enters the real weight from his scale. The app shows the payout and how far the estimate was off." | Accept, open route, complete pickup with real weights `[read payout and error from screen]`. |
| 2:10 - 2:35 | **Impact page** | "The impact page totals what has been diverted. It includes a labelled demo baseline plus live pickups, and shows estimation accuracy only from real completed pickups." | Show dashboard; point at the 'demo baseline' label. Say live numbers only for what is live. |
| 2:35 - 2:50 | **AWS** | "It's serverless on AWS: Amazon Bedrock for vision, Lambda and API Gateway, DynamoDB with conditional writes so only one collector can accept a request, S3 for photos, all deployed with AWS SAM." | Show the architecture diagram from the README. |
| 2:50 - 3:00 | **Close** | "KabadiConnect: fair prices for households, worthwhile trips for collectors." | Team name and project link. |

**Do not say** anything about Amazon Location Service, optimised maps, accuracy percentages or kilograms diverted unless they are visible on screen or measured (see `docs/eval-results.md`).
