# KabadiConnect: 3-Minute Video Demo Script & Production Guide

Target Duration: **2:50 – 3:00**  
Devices: **1 Smartphone (Household)** + **1 Laptop (Collector)**  
Live Deployed URL: **[https://d3c9etytddb9yx.cloudfront.net](https://d3c9etytddb9yx.cloudfront.net)**

---

## 1. Pre-Recording Setup (2 Minutes)

1. **Reset Database State**:
   Run this command in the terminal to reset listings and ensure clean baseline metrics:
   ```bash
   python3 scripts/reset_demo.py --region ap-southeast-2 --stack-name kabadiconnect
   ```

2. **Open the App on Both Devices**:
   - **Phone**: Open `https://d3c9etytddb9yx.cloudfront.net` &rarr; Select **Household** role.
   - **Laptop**: Open `https://d3c9etytddb9yx.cloudfront.net` &rarr; Select **Collector** role &rarr; Choose **Imran Ali (col-002)** &rarr; Open **Requests** tab.

3. **Physical Item Ready**: Have a real scrap item (cardboard box, newspapers, or plastic bottles) on your desk ready to photograph.

4. **Recording Tools (Free & No Watermarks)**:
   - **Phone**: Native iOS Screen Recording (Control Centre) or native Android Screen Recorder.
   - **Laptop**: QuickTime Player (Mac) or OBS Studio / Xbox Game Bar (Windows).
   - **Video Editor**: CapCut Desktop, Clipchamp (Windows 11 / Web), or DaVinci Resolve.

---

## 2. Second-by-Second Video Screenplay & Narration Script

| Time | Visual / Screen Layout | Action on Screen | Word-for-Word Voiceover Script |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:25** | **Laptop Fullscreen** | Show scrap pile on desk, then show the KabadiConnect homepage with live rates. | *"Over 90% of India's dry recyclables are collected by 4 to 5 million informal waste collectors—the kabadiwalas. But households face pricing opacity and hoard or dump scrap, while collectors waste hours on unpredictable neighborhood routes. This is KabadiConnect: a hyper-local scrap collection marketplace powered by multimodal AI on Amazon Bedrock."* |
| **0:25 - 1:10** | **Phone Fullscreen** | 1. Tap **Household**.<br/>2. Photograph scrap on desk.<br/>3. Show Bedrock itemization.<br/>4. Move RangeRuler slider.<br/>5. Select **DTU** area chip.<br/>6. Tap **Confirm & Find Collectors**. | *"Here on the household phone, the seller photographs their recyclables. The image is uploaded directly to Amazon S3 via a presigned URL, and Amazon Bedrock Nova Lite identifies the materials against our 17-category taxonomy. Notice how it detects cardboard and newspaper, checks photo quality, and calculates a fair rupee range from live rates. Using our RangeRuler slider, the seller easily adjusts estimated kilograms. We select the DTU pickup area and submit."* |
| **1:10 - 1:30** | **Split Screen** (Phone left, Laptop right) | Phone shows top 3 matched collectors.<br/>Show hazard notice banner. | *"The backend runs our multi-criteria matching algorithm, scoring nearby active collectors by proximity, trip value, and vehicle capacity. Notice our safety guardrail: hazardous items like lithium batteries or CRT screens bypass regular collectors completely and route households to authorized e-waste drop-off centers."* |
| **1:30 - 2:05** | **Split Screen Focus on Laptop** | 1. The listing lands in Imran Ali's feed.<br/>2. Point out **"Worth the trip"** badge.<br/>3. Click **Accept Pickup**.<br/>4. **Phone flips to confirmed in < 5s!** | *"Now on the collector's screen on the right, Imran Ali immediately sees the pre-qualified listing with a 'Worth the Trip' badge. He taps Accept. Under the hood, DynamoDB conditional writes guarantee strict linearizability—if another collector taps Accept at the same second, exactly one wins. Within seconds, the household's phone automatically updates to show Imran is on his way with his contact details."* |
| **2:05 - 2:30** | **Laptop Fullscreen** | 1. Switch to **Route** tab.<br/>2. Click **Complete Pickup**.<br/>3. Enter weighed kg (`6.5 kg` paper, `3.2 kg` cardboard).<br/>4. Confirm payout. | *"On the Route tab, our nearest-neighbor sequence gives the collector an optimized stop list with Google Maps navigation. At the doorstep, the collector weighs the scrap on his digital scale and enters the verified weights. The app settles the instant digital payout of ₹127 and transparently reports the estimation error relative to the AI midpoint."* |
| **2:30 - 2:50** | **Laptop Fullscreen** | 1. Open **Impact** tab.<br/>2. Show live +1 increment.<br/>3. Switch to README architecture diagram. | *"On the public Impact Dashboard, our verified live ledger immediately reflects the new kilograms diverted and income facilitated, keeping live measurements distinct from baseline demo figures. The entire system is 100% serverless on AWS: Amazon Bedrock Nova Lite, Lambda Python 3.12, DynamoDB, S3, API Gateway, and CloudFront."* |
| **2:50 - 3:00** | **Laptop Screen** | Show GitHub repo & CloudFront live link. | *"KabadiConnect: fair prices for households, worthwhile trips for collectors. Built by Team Omnivision. Thank you!"* |

---

## 3. Editing Guidelines (CapCut Desktop / Clipchamp)

1. **Timeline Synchronization**:
   - Align the Phone clip and Laptop clip at the moment you click **Accept Pickup** on the laptop.
   - The phone screen should automatically flip to "Collector Confirmed" ~2-3 seconds after the click.

2. **Layout Changes**:
   - **0:00 – 1:10**: Laptop fullscreen &rarr; Switch to Phone fullscreen (mobile aspect ratio centered on dark backdrop).
   - **1:10 – 2:05**: **Side-by-Side (Split Screen)**: Phone on the left (40% width), Laptop on the right (60% width). This visually demonstrates real-time cross-device sync.
   - **2:05 – 3:00**: Laptop fullscreen showing the Route, Scale Settlement, and Impact Dashboard.

3. **Pacing**:
   - Trim any idle waiting while Bedrock analyzes the photo (~2s) so the flow stays dynamic and under 3 minutes.
   - Add subtle zoom-ins on the **"Worth the trip"** badge and the **RangeRuler slider**.

4. **Export Settings**:
   - Resolution: **1080p (1920x1080)**
   - Framerate: **30 fps or 60 fps**
   - Format: **MP4 (H.264)**
