# KabadiConnect: 3-Minute Video Demo Script

**Theme**: AI-Powered Informal Recycling Marketplace  
**Target Video Duration**: 2 minutes 50 seconds  
**Characters / Devices**:
- Device 1: Household Seller (Pooja Verma, Rohini Sector 3)
- Device 2: Informal Scrap Collector (Ramesh Kumar / रॉकी स्क्रैप, DTU Hub)

---

## Detailed Timing & Screen Walkthrough

| Time | Scene / Screen | Audio / Narration | Visual Action |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:25** | **The Problem**<br/>Real scrap pile | *"Over 80% of urban India's recyclable waste is collected by informal kabadiwalas. Yet, households face unfair prices due to lack of market transparency, and collectors burn precious time and fuel on empty, unpredictable trips. Enter KabadiConnect."* | Show typical household scrap in corner; contrast with the digital app opening on mobile. |
| **0:25 – 1:15** | **Household Flow**<br/>Screen 1: `HouseholdSnap`<br/>Screen 2: `HouseholdReview`<br/>Screen 3: `PickupDetails` | *"A household takes a single photo of their scrap. Powered by Amazon Bedrock Multimodal Vision, KabadiConnect identifies materials—here, newspapers and cardboard boxes—and calculates an instant, fair market price range: ₹76 to ₹110. The user can fine-tune weights via sliders, enter their pickup address in Rohini Sector 3 with one-tap GPS, and request a collection slot."* | 1. Tap 'Take Photo / Upload'.<br/>2. Bedrock scans scrap in <2s.<br/>3. Shows materials with confidence badges.<br/>4. Move slider to 6.5 kg.<br/>5. Click 'Proceed to Pickup Details'.<br/>6. Tap 'Use My Location', select 'Morning'.<br/>7. Submit pickup. |
| **1:15 – 1:35** | **Matching & Safety**<br/>Screen 4: `MatchedView` | *"Instantly, KabadiConnect runs a multi-factor geo-scoring algorithm matching the top 3 nearest active collectors. Notice: hazardous items like CRT monitors or lead acid batteries are never matched to informal collectors—the app automatically redirects them to authorized government drop-off centers."* | Display MatchedView screen with top collectors ranked by score, distance, and ETA. Show batching tips. |
| **1:35 – 2:10** | **Collector Partner Flow**<br/>`CollectorView`<br/>- Requests<br/>- My Route<br/>- Complete & Scale Weighing | *"Now switching to the collector's phone. Ramesh Kumar sees Pooja's request flagged with a 'WORTH IT' badge based on trip value and capacity. He accepts the order. In the Route tab, greedy nearest-neighbour optimization bundles nearby pickups, saving over 8 km compared to separate round trips. At the doorstep, Ramesh weighs the scrap on his digital scale, enters the verified weights, and the app calculates the exact fair payout: ₹124."* | 1. Switch to Collector tab.<br/>2. Open 'Incoming Requests'.<br/>3. Tap 'Accept Pickup'.<br/>4. Show 'My Route' with numbered stops and Google Maps navigation deep link.<br/>5. Tap 'Complete & Payout'.<br/>6. Enter 6.8 kg & 3.2 kg.<br/>7. Payout confirmed with 3.8% vision estimation error. |
| **2:10 – 2:35** | **Public Impact Dashboard**<br/>`ImpactDashboard` | *"Every completed pickup feeds our live Impact Dashboard. Communities can track total kilograms diverted from landfills, direct income facilitated to informal workers, and lifecycle CO2e emissions avoided. Over 1,200 kg has been diverted with a mean AI weight estimation error of under 14%."* | Open Impact Dashboard.<br/>Show 4 headline KPI cards (Kg diverted, Income, CO2e, Km saved).<br/>Scroll through SVG material breakdown bar chart. |
| **2:35 – 2:50** | **Architecture & Tech Stack**<br/>Slide / Diagram | *"Built on 100% serverless AWS Infrastructure: Amazon Bedrock Converse API for vision AI, AWS Lambda with Python 3.12, DynamoDB on-demand tables with conditional writes for race-safe order locking, and private S3 buckets with 7-day lifecycle policies. Deployable in a single command with AWS SAM."* | Show Mermaid architecture diagram highlighting Bedrock, DynamoDB, and Lambda. |
| **2:50 – 3:00** | **Closing** | *"KabadiConnect: Dignity, fair prices, and clean cities powered by AWS."* | Show team name (Omnivision) and project link. |
