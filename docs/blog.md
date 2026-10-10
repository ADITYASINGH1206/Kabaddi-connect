# Building KabadiConnect: AI-Powered Fair-Price Scrap Marketplace on AWS

*How we combined Amazon Bedrock Multimodal Vision, AWS Lambda, and Amazon DynamoDB to digitize informal recycling and protect landfill boundaries.*

---

## 1. The Informal Recycling Paradox

In urban India, the informal recycling economy is powered by over 1.5 million door-to-door scrap collectors known as *kabadiwalas*. These frontline workers divert millions of tons of paper, plastics, and metals away from overflowing landfills every single year.

Yet, the system suffers from deep inefficiencies on both sides:
1. **Households lack market transparency**: Sellers rarely know what their scrap is worth, leading to frustration, haggling, or recyclables simply being discarded into municipal wet waste.
2. **Collectors burn time and fuel on empty trips**: Informal collectors travel 12–18 kilometers daily on foot or pedal carts without knowing whether a household has 20 kilograms of high-value copper or half a kilogram of cardboard.
3. **Hazardous e-waste leaks into landfills**: Broken CRT monitors and corroded lead batteries frequently enter informal scrap streams where unscientific handling causes toxic lead and mercury contamination.

**KabadiConnect** turns this paradigm on its head: an Uber-style marketplace where a household takes a single photo of their scrap pile, receives an instant AI price range powered by **Amazon Bedrock**, and connects with the best nearby collector through cluster-optimized routing.

---

## 2. Realities from Ground Visits

When visiting informal scrap dealers in North West Delhi (Rohini and Shahbad Daulatpur), one dealer noted:

> *"The hardest part is not the physical work—it is the uncertainty. If I travel two kilometers into a colony and find only ₹20 worth of paper, I have lost money on that trip. If I knew upfront that three houses on the same street had scrap ready, my daily earnings would double."*

This insight shaped our two core engineering principles:
- **Never promise exact scale precision from a photo**: Photos give volume estimates, not legal metrology. We estimate *credible ranges* (`weight_kg_low` to `weight_kg_high`) and give the household intuitive adjustment sliders.
- **Cluster orders aggressively**: Single pickups are rarely worth the trip. Our matching engine prioritizes geographic clustering, calculating route savings against separate round trips.

---

## 3. Serverless Architecture on AWS

We architected KabadiConnect as a 100% serverless, event-driven system managed via **AWS SAM**:

```
[ Household / Collector PWA ]
             │ (HTTPS)
   [ Amazon API Gateway (HTTP API) ]
   ┌─────────┼──────────┬──────────┬──────────┐
   ▼         ▼          ▼          ▼          ▼
 Lambda:   Lambda:    Lambda:    Lambda:    Lambda:
 uploads   analyze    listings   collectors pickups
   │         │          │          │          │
   ▼         ▼          ▼          ▼          ▼
Amazon S3  Amazon    DynamoDB   DynamoDB   DynamoDB
(Photos)   Bedrock   (Listings) (Collectors)(Pickups)
           Converse
```

### Why These AWS Services?
1. **Amazon Bedrock (Converse API)**: Multimodal models (Amazon Nova Lite / Claude Haiku) process scrap photos in under 2 seconds, extracting material classifications, weight bounds, and safety flags in a single structured JSON inference call.
2. **Amazon DynamoDB (On-Demand)**:
   - Conditional writes (`ConditionExpression: attribute_not_exists(acceptedCollectorId)`) prevent race conditions when multiple collectors view the same open request simultaneously.
   - Global Secondary Indexes (`status-createdAt-index` and `collectorId-date-index`) provide sub-10ms queries for live request feeds.
3. **Amazon S3**:
   - Presigned upload URLs restrict uploads to `image/jpeg` under 5 MB.
   - S3 Lifecycle rules automatically expire scrap photos after 7 days, maintaining zero long-term storage bloat and minimizing storage costs.
4. **AWS SAM**: One-command reproducible infrastructure (`sam build && sam deploy`) ensures our entire infrastructure can be instantiated in any AWS region in under 5 minutes.

---

## 4. Engineering for Real-World Computer Vision Challenges

Computer vision on scrap piles is notoriously tricky: crumpled cartons, mixed plastic bags, and dim staircase lighting. Here is how we tackled these edge cases:

### A. Strict Taxonomy Enforcement
LLMs can hallucinate speculative materials. We enforce an authoritative 17-material taxonomy (`config/taxonomy.json`). Anything outside this list is automatically filtered out before the frontend receives the response.

### B. Hazardous Material Quarantine
If Bedrock detects lead-acid batteries, broken CFL lamps, or CRT monitors, the system **quarantines** the item from informal collector matching. Instead, the API returns certified municipal drop-off centers with a verification caution.

### C. Graceful Fallbacks Everywhere
- If photo analysis fails or encounters rate limits: The UI immediately presents a manual material selector with default local averages.
- If GPS fails: 8 pre-seeded North West Delhi neighborhood chips allow instant one-tap location selection.
- If map tiles fail: Greedy Haversine route sequencing provides an ordered stop list and direct Google Maps deep links.

---

## 5. Evaluation & Impact Results

We evaluated Bedrock's scrap estimation pipeline against physical ground truth samples weighed on calibrated digital scales (details in `docs/eval-results.md`):

- **Material Detection Precision**: 100% on core recyclables (Newspapers, Cardboard, PET).
- **Weight Range MAPE**: Mean Absolute Percentage Error of ~14.8% on raw Bedrock estimates, dropping to < 4% once households fine-tune via sliders.
- **Route Optimization**: Nearest-neighbour waypoint sequencing saves an average of **28% total travel distance** compared to naive separate round trips.
- **Environmental CO2e Avoidance**: Based on lifecycle emission factors (`config/emission_factors.json`), every 100 kg of sorted scrap diverted prevents approximately 175 kg of CO2e emissions.

---

## 6. Conclusion & Next Steps

KabadiConnect demonstrates that cutting-edge Generative AI on AWS is not just for enterprise back-offices—it can bring price transparency, dignity of labor, and environmental efficiency to the informal workers keeping our cities clean.

Next on our roadmap:
- WhatsApp Business API integration for conversational voice-note photo submissions in Hindi.
- Integration with Amazon Location Service live geofencing for real-time collector proximity alerts.

*Built with ❤️ by Team Omnivision for Environmental Hacks 2026.*
