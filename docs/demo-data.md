# KabadiConnect: Demo Data & 3-Minute Video Guide

This document specifies the complete mock data set and step-by-step click path for recording the 3-minute hackathon demonstration video.

---

## 1. Ground Rules & Honesty Notice

- **All mock data records are tagged with `"seeded": true`.**
- **All names are fictional.**
- **All phone numbers are explicitly fake:** format `+910000000NNN` (e.g. `+910000000101`, `+910000000201`), avoiding any resemblance to real phone numbers.
- **Mock data is never blended into live measured accuracy.** The weight estimation accuracy (MAPE) figure in `/impact` is strictly computed from **live completed pickups only** (`seeded != true`), and remains `—` (null) until a user completes a real pickup.
- **All rates and taxonomy codes** come from `config/rates.seed.json` and `config/taxonomy.json`.
- **All coordinates** are valid North-West Delhi coordinates (Rohini, DTU/Shahbad Daulatpur, Bawana, Shalimar Bagh, Model Town, Pitampura, Narela) between 28.65°N–28.90°N and 77.00°E–77.25°E.

---

## 2. Hero Seller (Live Demo Input)

> **Important:** This record is **NOT** pre-seeded into DynamoDB. It is entered live during the video demonstration to prove real-time vision analysis, price estimation, and collector matching.

| Field | Value |
|---|---|
| **Seller Name** | Pooja Verma |
| **Seller Phone** | `+910000000200` |
| **Area Address** | Sector 3, Rohini, New Delhi |
| **Coordinates** | Latitude: `28.7155`, Longitude: `77.1219` |
| **Materials** | Newspaper & Paper (5–8 kg) + Cardboard (3–5 kg) |
| **Rates** | Newspaper: ₹12–₹16/kg, Cardboard: ₹8–₹12/kg |
| **Expected Price Range** | **₹84 – ₹188** (Midpoint: **₹136**) |
| **Matched Hero Collector** | **Ramesh Kumar (`col-001`)** (~3.85 km away, radius 6 km) |

---

## 3. Demo Scenarios & Data Matrix

### A. Collectors (`seed/collectors.json` - 10 total, 9 active + 1 inactive)

| ID | Name | Area | Radius | Capacity | Accepts | Notes |
|---|---|---|---|---|---|---|
| `col-001` | Ramesh Kumar (रमेश कबाड़ी) | DTU, Shahbad Daulatpur (`28.7501, 77.1177`) | 6.0 km | 250 kg | Paper, Cardboard, Books, PET, HDPE, Iron, Aluminium | **Hero Collector** matching Pooja Verma |
| `col-002` | Imran Ali (इमरान रीसायकल) | Sector 3, Rohini (`28.7155, 77.1219`) | 5.0 km | 350 kg | Paper, Plastics, Metals, E-Waste (phones, laptops, appliances) | E-Waste specialist + All-rounder |
| `col-003` | Sunil Sharma (सुनील रद्दी भंडार) | Sector 7, Rohini (`28.7186, 77.1058`) | 4.0 km | 200 kg | Paper, Plastics | General paper & plastic collector |
| `col-004` | Deepak Jha (दीपक मेटल वर्क्स) | Bawana Industrial Area (`28.7935, 77.0513`) | 8.0 km | 400 kg | Iron, Aluminium, Copper, Brass, Paper, Cardboard | Metal-focused specialist |
| `col-005` | Mohammad Farooq (फारूक स्क्रैप) | Pitampura (`28.6990, 77.1384`) | 5.0 km | 180 kg | Paper, Plastics | General paper & plastic collector |
| `col-006` | Rajesh Metal Traders | Shalimar Bagh (`28.7160, 77.1580`) | 6.0 km | 300 kg | Iron, Aluminium, Copper, Brass, Paper, Cardboard | Metal-focused dealer |
| `col-007` | Suresh Glass & Plastics | Model Town (`28.7030, 77.1930`) | 5.5 km | 150 kg | Glass bottles, PET, HDPE, Mixed plastic | Glass + plastic specialist |
| `col-008` | Vikas E-Waste Recyclers | Sector 16, Rohini (`28.7380, 77.1250`) | 7.0 km | 220 kg | E-Waste, Iron, Copper, Aluminium | E-Waste specialist #2 |
| `col-009` | Anita Devi (अनीता देवी) | Sector 15, Rohini (`28.7320, 77.1340`) | 4.5 km | 120 kg | Paper, Plastics | General neighborhood collector |
| `col-010` | Balwant Singh (निष्क्रिय) | Narela (`28.8520, 77.0930`) | 5.0 km | 100 kg | Metals, Paper | **Inactive (`active: false`)** to demonstrate active filter |

---

### B. Mock Listings (`seed/listings.json` - 14 listings)

| ID | Scenario | Seller & Area | Materials & Weights | Estimate (INR) | Status | Key Demonstration Purpose |
|---|---|---|---|---|---|---|
| `list-001` | `CLUSTER_1_PAPER` | Aakash Gupta, Sector 3 Rohini | Newspaper 15–20 kg, Cardboard 10–15 kg | ₹260 – ₹500 | OPEN | Cluster stop #1 in Rohini |
| `list-002` | `CLUSTER_2_PLASTIC` | Meena Sharma, Sector 3 Rohini | PET bottles 6–10 kg, HDPE 5–8 kg | ₹180 – ₹428 | OPEN | Cluster stop #2 in Rohini |
| `list-003` | `CLUSTER_3_METAL` | Suresh Patel, Sector 7 Rohini | Iron & Steel 12–18 kg | ₹288 – ₹576 | OPEN | Cluster stop #3 in Rohini |
| `list-004` | `CLUSTER_4_CARDBOARD_BOOKS` | Priyanka Roy, Sector 7 Rohini | Cardboard 8–12 kg, Books 10–15 kg | ₹164 – ₹354 | OPEN | Cluster stop #4 in Rohini |
| `list-005` | `LOW_VALUE_CLUSTERED` | Kavita Rao, Sector 3 Rohini | PET bottles 2–3 kg | ₹30 – ₹66 | OPEN | Under min-worthwhile threshold; displays **batch hint** because it has 2+ open neighbors within 1 km |
| `list-006` | `LOW_VALUE_ISOLATED` | Mohit Khanna, Shalimar Bagh | Plastic bags 3–5 kg | ₹15 – ₹35 | OPEN | Under min threshold, isolated from others |
| `list-007` | `HIGH_VALUE_METAL` | Anil Singhal, Sector 16 Rohini | Copper 4–6 kg, Brass 3–5 kg, Aluminium 5–7 kg | ₹3,055 – ₹5,930 | OPEN | High value metal; displays **Worth It** tag, ranks #1 on metal collectors' list |
| `list-008` | `EWASTE_COMPLIANT` | Rohit Verma, Sector 15 Rohini | E-waste phone 1–2 kg, Laptop 2–4 kg | ₹200 – ₹920 | OPEN | Matches only authorized e-waste collectors (`col-002`, `col-008`) |
| `list-009` | `HAZARD_BATTERY_CRT` | Sunita Joshi, Pitampura | Battery / CRT 3–5 kg | ₹45 – ₹200 | OPEN | **Zero matches** (`matchedCollectorIds: []`); triggers hazardous drop-off guidance |
| `list-010` | `OUT_OF_RANGE` | Harish Chand, Narela Mandi | Newspaper 10–15 kg | ₹120 – ₹240 | OPEN | Far from active collectors; tests graceful limited matching |
| `list-011` | `PRE_ACCEPTED_1` | Vandana Sethi, Sector 3 Rohini | Newspaper 12–16 kg, Cardboard 5–8 kg | ₹184 – ₹352 | ACCEPTED | Pre-accepted stop #1 for Ramesh Kumar |
| `list-012` | `PRE_ACCEPTED_2` | Gaurav Malhotra, Sector 3 Rohini | PET bottles 8–12 kg, HDPE 4–6 kg | ₹192 – ₹420 | ACCEPTED | Pre-accepted stop #2 for Ramesh Kumar |
| `list-013` | `PRE_ACCEPTED_3` | Karan Chawla, Sector 7 Rohini | Iron & Steel 15–20 kg | ₹360 – ₹640 | ACCEPTED | Pre-accepted stop #3 for Ramesh Kumar |
| `list-014` | `VISION_FALLBACK_MANUAL` | Rekha Aggarwal, Pitampura | Books & Notebooks 20–25 kg | ₹200 – ₹350 | OPEN | Demonstrates manual material entry flow (`visionUsed: false`) |

---

### C. Pickups History (`seed/pickups_history.json` - 13 records)

- **10 Completed Pickups (`status: "COMPLETED"`):** Spread over the last 7 days across 5 collectors (`col-001`, `col-002`, `col-003`, `col-004`, `col-005`), covering 10 distinct recyclable materials and e-waste.
- **3 Pre-Accepted Pickups (`status: "ACCEPTED"`):** Assigned to Ramesh Kumar (`col-001`), populating his active route.

---

## 4. Route Optimization Demonstration for Ramesh Kumar

### State 1: Before Live Accept (3 Pre-Accepted Stops)
- **Start:** DTU / Shahbad Daulatpur (`28.7501, 77.1177`)
- **Stops:**
  1. Vandana Sethi, Sector 3 Rohini (`28.7130, 77.1220`)
  2. Gaurav Malhotra, Sector 3 Rohini (`28.7180, 77.1240`)
  3. Karan Chawla, Sector 7 Rohini (`28.7160, 77.1090`)
- **Metrics:**
  - Optimized Route: **5.52 km**
  - Naive Separate Round Trips: **23.32 km**
  - **Distance Saved: 17.80 km (76% reduction)**

### State 2: After Live Accept of Hero Seller Pooja Verma (4 Stops)
- **Start:** DTU / Shahbad Daulatpur (`28.7501, 77.1177`)
- **Stops:**
  1. Vandana Sethi, Sector 3 Rohini
  2. **Pooja Verma, Sector 3 Rohini (Newly accepted stop inserted seamlessly into the cluster!)**
  3. Gaurav Malhotra, Sector 3 Rohini
  4. Karan Chawla, Sector 7 Rohini
- **Metrics:**
  - Optimized Route: **5.56 km**
  - Naive Separate Round Trips: **31.06 km**
  - **Distance Saved: 25.50 km (82% reduction)**

---

## 5. Exact 3-Minute Video Click Path

### [0:00 - 0:45] Household Flow: Snap & Instant Fair Pricing
1. Open web app at `http://localhost:5173/`.
2. Select **"Household / Seller"** mode (toggle English / हिन्दी to show bilingual support).
3. Tap **"Upload Scrap Photo"** and select a photo of newspaper and cardboard boxes.
4. Watch Amazon Nova Lite vision analyze the photo in ~1.5s:
   - Detects `Newspaper & Paper` (5–8 kg) and `Cardboard` (3–5 kg).
   - Displays fair market estimate: **₹84 – ₹188**.
5. Tap **"Confirm & Request Pickup"**, enter:
   - Name: `Pooja Verma`
   - Phone: `+910000000200`
   - Address: `Sector 3, Rohini`
6. System immediately matches top eligible nearby collectors, with **Ramesh Kumar (DTU, 3.8 km away)** at the top!
7. Tap **"Submit Pickup Request"**.

### [0:45 - 1:45] Collector Flow: Request Clustering & Demo Badges
1. Switch to **"Collector (Kabadiwala)"** mode and select **"Ramesh Kumar (रॉकी स्क्रैप)"**.
2. View the **Open Requests** tab:
   - Notice the **"Demo / डेमो"** chip on seeded listings.
   - Point out the **"Worth It"** tag on high-value requests and the **Batch Hint** on nearby small requests.
   - See Pooja Verma's incoming request right at the top.
3. Tap **"Accept Request"** on Pooja Verma's order.

### [1:45 - 2:20] Route Optimization: Instant Km Savings
1. Switch to Ramesh's **"My Route"** tab.
2. Show the visual map route and stop list:
   - Point out the 4 ordered stops (Vandana → Pooja → Gaurav → Karan).
   - Point out the real-time route optimization: **5.56 km total vs 31.06 km naive trips** = **25.5 km saved!**
   - Click "Navigate" on Pooja's stop to show the Google Maps turn-by-turn integration.

### [2:20 - 2:45] Pickup Completion & Transparent Payout
1. Tap **"Complete Pickup"** on Pooja's order.
2. Enter actual weighed weights:
   - Newspaper: `6.5 kg`
   - Cardboard: `4.0 kg`
3. Tap **"Calculate & Complete Payout"**:
   - System calculates exact payout: **₹131.00** using official Delhi benchmark rates.
   - Displays actual vs estimate accuracy (error < 5%).

### [2:45 - 3:00] Real-Time Impact Dashboard
1. Switch to the **"Impact Dashboard"**.
2. Highlight:
   - Total waste diverted: **>300 kg** across paper, plastics, metals, and e-waste.
   - Carbon emissions avoided: **>400 kg CO₂e**.
   - Transparent honesty note: **"Includes demo data (10 demo + 1 live)"**.
   - Show that **Weight Estimation Accuracy** now displays the measured live figure from Pooja's pickup!

---

## 6. How to Reset the Demo

To restore the demo data at any time in under 5 seconds:

```bash
# Reset local or deployed demo stack:
python3 scripts/reset_demo.py --region ap-southeast-2 --stack-name kabadiconnect
```
