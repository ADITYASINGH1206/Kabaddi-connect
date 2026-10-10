# KabadiConnect: Full Build After M1 (single file for the coding agent)

Read `CLAUDE.md` (the original spec) first. This file replaces the milestone prompts from here on. It is ordered, time-boxed, and has a verification gate after every phase.

**Time context.** Today is Saturday 10 Oct. Submissions open Sunday 8:00 AM IST. Assume feature freeze Saturday ~21:00 and use Saturday night and Sunday morning for deploy, README, video, blog and submission. The Rules tab has the real deadline; do not assume extra time.

**Prime directive.** One working end-to-end flow beats five partial ones. If a task is slipping, take its fallback (marked FALLBACK) and move on. Never leave `main` broken.

---

## 0. Standing rules (apply to every phase)

1. Work only on the phase I name. Do not start the next one.
2. After each numbered task, tell me the exact command or click-path to verify it. Stop and wait if a verification fails.
3. No secrets in the frontend, in git, or in logs. `.env` files are never committed.
4. Keep the manual fallbacks alive: vision fails → manual material picker; route API fails → Haversine ordering; geocode fails → device location. The demo must never dead-end.
5. Every user-visible string goes through the i18n dictionary (en + hi) from the moment it is written. Do not leave Hindi for the end.
6. Least-privilege IAM, no wildcard resources unless unavoidable; list any that remain.
7. If a service name, API shape, or model ID in the spec is wrong or has changed, say so; do not guess.
8. Small commits. Reference the issue number if one exists. Do not force-push.
9. Seeded data is synthetic. Rates and emission factors are indicative placeholders until replaced; label them as such in the UI and README.

---

## 1. Phase 0: Gate before anything new (15 min, I do this, not you)

Do not proceed until I confirm:

- [ ] `/health` and `/rates` work on the deployed API.
- [ ] `POST /analyze` with a real scrap photo returns `fallback:false` and sensible materials.
- [ ] A dark/blurry photo gives the retake message; a no-scrap photo does not invent materials.
- [ ] Budget alarm exists; S3 bucket is private with a 7-day lifecycle.
- [ ] Everything is committed and tagged `m1-verified`.

If `/analyze` returns `fallback:true`, stop and help me debug from the Lambda logs before any new work.

---

## 2. Phase 1: Listings and matching (target: done by ~14:00)

### 2.1 Seed data
- `seed/collectors.json`: 10 synthetic collectors around north-west Delhi (DTU, Rohini, Bawana, Shalimar Bagh, Model Town). Obviously fake names and phone numbers. Vary `accepts[]`, `max_radius_km` (3 to 8), `daily_capacity_kg`. Exactly 2 with `accepts_ewaste=true`.
- `seed/listings.json`: 8 OPEN sample listings; at least 4 within ~1 km of each other so the route has real clustering; at least 1 with `ewaste_phone`; at least 1 below the minimum-worthwhile value.
- `seed/ewaste_points.json`: 3 placeholder entries, each with `"verified": false` and `"note": "VERIFY BEFORE DEMO"`. Do not invent street addresses as fact.
- `seed/seed.py`: idempotent; supports `--reset` which clears Listings and Pickups then reloads everything.

### 2.2 `POST /listings`
- Validate input; reject unknown materials; clamp weights to sane bounds.
- Estimate per spec 4.3 from the Rates table.
- Match per spec 4.4: eligibility (active, within radius, accepts the listing's materials, e-waste rules), score `0.5*proximity + 0.3*tripValue + 0.2*capacity`, return top 3 with `distanceKm` and `etaMin` (configurable speed, default 20 km/h).
- `ewaste_battery_or_crt` is never matched to a collector; return `dropOff` with the points from `ewaste_points.json` (flag unverified ones in the response so the UI can show a "check before visiting" note).
- `batchHint` when below the minimum value: count of other OPEN listings within 1 km.
- Persist with `status: OPEN`, `matchedCollectorIds`.

### 2.3 `GET /listings/{id}`
Status, estimate, matches, accepted collector (name, phone, ETA) when present. 404 with `{error, code}` for unknown IDs.

### 2.4 Geocoding
Typed address → lat/lng using Amazon Location Service. Verify the current API name first and tell me which one you used. Browser geolocation is the primary path; typed address is secondary. FALLBACK: if geocoding fails or is slow to set up, ship geolocation + a "pick a nearby area" dropdown of 8 NW Delhi neighbourhoods with hard-coded coordinates, and keep Location Service for routing.

### 2.5 Household screens 3 and 4
- **Pickup details:** address field, "use my location" button, time-window chips, name, phone, submit.
- **Matched:** top collectors (name, distance, ETA), `batchHint` and `dropOff` messages, polls `GET /listings/{id}` every 5 s, switches to "Collector on the way" when `ACCEPTED`, stops polling on `COMPLETED` or unmount.
- All strings in en + hi.

### 2.6 Tests
Scoring (proximity, capacity, ties), e-waste exclusion, battery/CRT never matched, batchHint count, min-value threshold, input validation.

### Gate 1 (I verify)
- Create a listing from the phone UI; it returns 3 matches with sensible distances.
- An e-waste listing only shows e-waste collectors; a battery listing shows drop-off, not a collector.
- `git tag m2-verified`.

---

## 3. Phase 2: Collector flow (target: done by ~18:00; this is the riskiest phase)

Build in this order so a failure in a later task never blocks an earlier one.

### 3.1 `GET /collectors`
Active collectors (id, name, areaName, lat, lng) for the demo picker.

### 3.2 `GET /collectors/{id}/requests`
OPEN listings this collector is eligible for, ranked by score. Each item: materials, kg range, estimated value, distanceKm, `worthIt` flag (threshold from config).

### 3.3 `POST /listings/{id}/accept`
Body `{collectorId}`. DynamoDB conditional write: only `OPEN` → `ACCEPTED`. Second attempt returns 409 `ALREADY_ACCEPTED`. Creates the Pickup record. Test the race (two concurrent accepts, exactly one wins).

### 3.4 Collector UI part 1 (do this before routing)
- Demo collector picker (localStorage, no auth).
- Requests screen: ranked cards, material icons, kg range, value, distance, "worth it" tag, Accept button with graceful 409 handling and a refresh.

### 3.5 `POST /pickups/{id}/complete`
Body `{actualItems:[{material, actual_kg}]}`. `payout = Σ actual_kg × midpoint(rate_low, rate_high)`. `estimateErrorPct = |actual_total − estimated_mid_total| / actual_total × 100`. Rejects non-`ACCEPTED` pickups. Sets pickup and listing to `COMPLETED`.

### 3.6 Collector UI part 2: Complete Pickup screen
Per-material actual kg inputs prefilled from the estimate; shows payout and estimate error after submit; validates empty/negative.

At this point the whole loop works without any map. **Run Gate 2a before continuing.**

### Gate 2a (I verify, two phones)
Household submits → collector sees it → accepts → completes with actual weights → payout and error show; household phone flips to "on the way". `git tag m3a-verified`.

### 3.7 `POST /collectors/{id}/route`
Body `{start:{lat,lng}}`. Takes this collector's `ACCEPTED` pickups (max 10).
- **Step 1, always:** implement the greedy nearest-neighbour ordering with Haversine, returning the full response shape: `stops[]` (ordered, with `etaMin`), `totalKm`, `totalMin`, `polyline` (GeoJSON LineString), `naiveKm` (sum of separate round trips from start to each stop), `usedFallback`.
- **Step 2:** replace the internals with Amazon Location Service route calculation + waypoint optimization (verify current API names/limits and tell me which). On any error, fall back to step 1 with the identical response shape.
- Tests: fallback shape equals the normal shape; `naiveKm ≥ totalKm` for a clustered set; max-10 enforced.

### 3.8 My Route screen
- MapLibre GL map, numbered markers, route polyline, total km/min, ordered stop list, per-stop "Navigate" deep link (Google Maps URL with lat/lng).
- Tiles from Amazon Location Service with a **domain-restricted API key**, key in `VITE_LOCATION_API_KEY`. FALLBACK if tile setup takes more than 30 minutes: use a simple MapLibre style with free demo tiles for the map background only, keep Location Service for geocoding and routing, and tell me so I can mention it honestly in the README.
- Works when `usedFallback` is true; the UI must not care which path was used.

### Gate 2b (I verify)
- With 4 clustered accepted pickups, the route screen shows an ordered path and sensible km saved vs naive.
- Kill the Location Service permission temporarily (or force an error): the route still renders via fallback.
- `git tag m3-verified`.

**Time check at ~18:00:** if 3.7 or 3.8 are not working, ship the fallback ordering with a plain ordered list plus per-stop Navigate links, and move on. A working list beats a broken map.

---

## 4. Phase 3: Impact, accuracy and polish (target: done by ~21:00, then FREEZE)

### 4.1 `GET /impact`
Total kg diverted (actual weights) by material, collector income facilitated, pickups completed, routes, km saved (`naiveKm − routed km` summed), e-waste items redirected, mean estimate error %, CO2e avoided from `config/emission_factors.json`. Include `emissionSource` text in the response; the UI shows it as an "illustrative estimate". Seed 6 to 8 realistic COMPLETED pickups (flagged `seeded:true`) so the dashboard is not empty on first load; the UI must show seeded vs live counts separately or label the totals "includes demo data".

### 4.2 Impact dashboard (public, mobile-first)
Headline numbers, a bar chart by material (plain SVG or a tiny chart lib; no heavy dependencies), the accuracy figure, and a visible note that CO2e is an estimate.

### 4.3 Resilience and usability pass
- Loading, empty and error states on every screen, each with a plain-language recovery action.
- Vision failure → manual material picker (verify by forcing `fallback:true`).
- Network failure on any call → retry button, never a blank screen.
- 44 px tap targets, contrast check, labelled inputs.
- PWA manifest + icons so it can be added to the home screen.
- Hindi toggle persisted; Devanagari font loads; no untranslated strings (grep for hard-coded English in JSX).
- Client-side image resize to 1280 px JPEG ~0.8 before upload; guard against huge originals.

### 4.4 Guardrails
API Gateway throttling and a request-size limit; the image-hash cache for `/analyze`; confirm the S3 lifecycle and budget alarm exist in IaC or list what to add by hand; IAM review with a list of any remaining wildcards.

### 4.5 Eval and reset tooling
- `eval/run_eval.py --split tune|report`: reads `eval/labels.csv`, calls `/analyze`, prints per-material precision/recall and mean weight error; saves the report split to `docs/eval-results.md`. If the labelled photos are not ready, the script must still run on a small sample and say so.
- `scripts/reset_demo.py`: reseeds collectors, rates, sample listings and demo pickups; clears live pickups. Runnable in under 10 seconds.

### Gate 3 (I verify) then FREEZE
- Full flow on two phones on mobile data, in Hindi and English.
- Dashboard loads with sensible numbers; airplane-mode test shows recovery actions.
- `git tag m4-freeze`. After this tag, bug fixes only.

---

## 5. Phase 4: Ship (Saturday night to Sunday morning)

1. **README.md:** what it does, who it is for, architecture diagram (Mermaid, plus PNG if quick), AWS services used and why, one-command deploy (`sam build && sam deploy --guided`), env vars, seed and reset, tests and eval, and a **Known limitations** section: demo-only auth, indicative rates, weights are ranges, synthetic seed data, e-waste points unverified unless I mark them verified.
2. **`scripts/smoke_test.py`:** full flow against the deployed API (upload sample image → analyze → create listing → accept → route → complete → impact); exits non-zero on any failure. Run it against production and fix what it finds.
3. **Cleanup:** remove debug logs and unused dependencies; confirm no secrets or `.env` in the repo or its history; list remaining IAM wildcards.
4. **`docs/demo-script.md`:** from spec section 12, filled in with the real screen names and seeded names, with timings.
5. **`docs/blog.md`:** draft following spec section 13, with placeholders only where real numbers are missing (eval results, a quote from the kabadiwala visit). Do not invent numbers or quotes.
6. Report a short list of anything still risky for the demo.

### Gate 4 (I verify)
- Smoke test passes against production.
- Live URL works from a fresh browser and a phone.
- Demo reset then one rehearsal run takes under 3 minutes.

---

## 6. Cut list (if time slips, drop in this order)

1. CO2e figure (keep kg and income).
2. Impact charts (keep the numbers).
3. Hindi on secondary strings (keep the main flow in Hindi).
4. Location Service route optimization (keep Haversine ordering).
5. Location Service map tiles (keep geocoding/routing on AWS, plain map background).
6. Geocoding by typed address (keep geolocation + area dropdown).

**Never cut:** photo → AI estimate → listing → accept → complete → payout, the manual fallback for vision, and the deployed public URL.

---

## 7. Things the agent must not do

- Do not add payments, real auth, chat, ratings, native apps, or custom model training.
- Do not widen the API contract without telling me; if you change a request or response shape, update `CLAUDE.md` section 6 in the same commit.
- Do not present seeded data as real usage, or placeholder rates and emission factors as sourced figures.
- Do not invent e-waste drop-off addresses, quotes, or eval numbers.
- Do not deploy or change AWS resources unless the task says so; tell me the command and I will run the deploy.

---

## 8. Final submission checklist (humans)

- [ ] Re-read the Rules tab: deadline, required fields, repo visibility.
- [ ] Every member is student-verified on AWS Builder Center.
- [ ] Live URL tested on a fresh browser and a phone.
- [ ] Repo has README and no secrets; made public if required.
- [ ] Demo video: under 3 minutes, shows problem, user, working flow, where AWS fits; link works logged out.
- [ ] Blog published on AWS Builder Center and linked.
- [ ] Submit with buffer time. The team cannot change after submission.
