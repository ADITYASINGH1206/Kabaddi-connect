# KabadiConnect (कबाड़ी कनेक्ट)

> **"Uber-style doorstep scrap pickup for India's informal recycling economy, powered by multimodal AI on Amazon Bedrock."**  
> *Track: Environmental Hacks — Track 3 (Waste & Energy) | Built on AWS Serverless*

[![Live Frontend](https://img.shields.io/badge/Live%20Frontend-AWS%20CloudFront%20CDN-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=FF9900)](https://d3c9etytddb9yx.cloudfront.net)
[![Live API Gateway](https://img.shields.io/badge/Live%20API-AWS%20API%20Gateway-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://xzsflevsg9.execute-api.ap-southeast-2.amazonaws.com/health)
[![Amazon Bedrock](https://img.shields.io/badge/AI%20Vision-Amazon%20Nova%20Lite-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock/)
[![AWS SAM](https://img.shields.io/badge/IaC-AWS%20SAM-E7157B?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/serverless/sam/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Bilingual](https://img.shields.io/badge/Languages-English%20%7C%20%E0%A4%B9%E0%A4%BF%E0%A4%A8%E0%A5%8D%E0%A4%A6%E0%A5%80-4CAF50?style=for-the-badge)](https://d3c9etytddb9yx.cloudfront.net)

---

## Live Production Deployments

- **Public Frontend (CloudFront Global CDN)**:  
  [https://d3c9etytddb9yx.cloudfront.net](https://d3c9etytddb9yx.cloudfront.net)  
  *(Optimized PWA for mobile browsers and desktop, served with HTTPS and SPA routing)*

- **Public Serverless API (API Gateway HTTP API v2)**:  
  [https://xzsflevsg9.execute-api.ap-southeast-2.amazonaws.com](https://xzsflevsg9.execute-api.ap-southeast-2.amazonaws.com/health)  
  *(Backed by AWS Lambda Python 3.12, DynamoDB on-demand, and Amazon Bedrock)*

---

## The Problem and Context

In India, **over 90% of post-consumer dry waste is collected and sorted by 4–5 million informal waste collectors (*kabadiwalas*)**, who divert tens of thousands of tonnes of recyclables from municipal landfills every single day. Despite being the backbone of urban circularity, the sector faces structural inefficiencies:

1. **Information Asymmetry & Pricing Opacity**: Households do not know the fair market value of scrap (cardboard, metals, PET bottles, paper) and either hoard waste until it spoils or dump it in mixed municipal bins.
2. **Unpredictable Collection Routes**: Informal collectors wander residential neighborhoods shouting for scrap, resulting in low trip values, high fuel/pedal fatigue, and unpredictable daily earnings.
3. **Hazardous E-Waste Risks**: Dangerous items like lithium batteries and lead-laden CRT screens frequently enter informal dismantlers' hands without protective gear or proper extraction infrastructure.

---

## The Solution: KabadiConnect

**KabadiConnect** is a hyper-local, two-sided mobile platform that formalizes scrap exchange while protecting informal worker livelihoods:

- **Multimodal Vision on Amazon Bedrock**: Households snap a photo of their scrap pile. Amazon Nova Lite identifies items against a 17-material taxonomy, flags blur or bad lighting, detects hazardous materials, and calculates a fair, transparent INR price range.
- **Interactive RangeRuler**: Users easily adjust estimated weight ranges without tedious manual text input.
- **Automated Multi-Criteria Matching**: Ranks active nearby collectors within a 5 km radius based on proximity (50%), trip value (30%), and vehicle payload capacity (20%).
- **One-Tap Collector Acceptance**: Pushes pre-qualified leads with "Worth the Trip" indicators to the matched collector's mobile queue.
- **Race-Safe Concurrency**: DynamoDB conditional writes ensure that if two collectors tap "Accept" on the same request, exactly one wins and the other receives an instant notification.
- **Optimized Pickup Routing**: Heuristic route sequencing generates turn-by-turn stops with Google Maps links.
- **Hazardous Waste Separation**: Batteries and CRT monitors bypass collectors completely and direct households to certified e-waste drop-off centers.
- **Honest Impact Accounting**: A live sustainability ledger tracking landfill diversion (kg), informal worker payouts (INR), and avoided lifecycle greenhouse gas emissions (kg CO2e).

---

## System Architecture

![KabadiConnect AWS Cloud Architecture](docs/architecture.svg)

<details>
<summary>Click to view Mermaid Architecture Flowchart</summary>

```mermaid

graph TD
    subgraph Clients["Clients (Mobile & Desktop PWA)"]
        H["Household: Photo, RangeRuler & Booking"]
        C["Collector: Feed, 1-Tap Accept, Route & Payout"]
        I["Public Impact Ledger"]
    end

    subgraph Edge["AWS Global Edge Infrastructure"]
        CF["Amazon CloudFront CDN<br/>(HTTPS, Gzip/Brotli, SPA Fallback)"]
        S3_FE[("Frontend S3 Bucket<br/>(Private, OAC Protected)")]
        APIGW["Amazon API Gateway HTTP API v2<br/>(Rate Limits: 20 burst / 10 rps)"]
    end

    CF --> S3_FE
    H --> CF
    C --> CF
    I --> CF
    H --> APIGW
    C --> APIGW
    I --> APIGW

    subgraph Compute["AWS Lambda (Python 3.12 ARM64 Graviton)"]
        L_UP["POST /uploads<br/>(Presigned S3 PUT URL)"]
        L_AN["POST /analyze<br/>(Bedrock Converse + Cache)"]
        L_LI["POST /listings, GET /rates<br/>(Multi-Criteria Matcher)"]
        L_CO["GET /collectors, /requests<br/>(Collector Feed & Queues)"]
        L_PI["POST /listings/{id}/accept<br/>POST /pickups/{id}/complete"]
        L_IM["GET /impact<br/>(Dual-Track Verified Metrics)"]
    end

    APIGW --> L_UP
    APIGW --> L_AN
    APIGW --> L_LI
    APIGW --> L_CO
    APIGW --> L_PI
    APIGW --> L_IM

    subgraph Storage_and_AI["Amazon Web Services Cloud Core"]
        S3_PH[("Amazon S3 Photos<br/>(7-Day Lifecycle Expiration)")]
        BEDROCK["Amazon Bedrock<br/>(Model: amazon.nova-lite-v1:0)"]
        DDB_C[("DynamoDB Collectors<br/>(Geohash & Radii)")]
        DDB_L[("DynamoDB Listings<br/>(Open Requests)")]
        DDB_P[("DynamoDB Pickups<br/>(Atomic State Machine)")]
        DDB_R[("DynamoDB Rates<br/>(17 Indicative Materials)")]
        DDB_CACHE[("DynamoDB Cache<br/>(SHA-256 Image Deduplication)")]
        CW["Amazon CloudWatch<br/>(Error Metric Alarms)"]
    end

    L_UP -.->|Presign| S3_PH
    L_AN -->|Read Photo| S3_PH
    L_AN -->|Multimodal Vision| BEDROCK
    L_AN <-->|Cache Hit / Write| DDB_CACHE
    L_LI -->|Lookup Rates| DDB_R
    L_LI -->|Filter & Score| DDB_C
    L_LI -->|Persist| DDB_L
    L_CO -->|Fetch Radius| DDB_C
    L_CO -->|Query Area| DDB_L
    L_PI -->|Conditional Write| DDB_P
    L_PI -->|Update Status| DDB_L
    L_IM -->|Aggregate Verified| DDB_P
    Compute -.->|Metrics| CW
```
</details>

---


## User Journeys and Sequence Flows

### 1. Household Scrap Photo to Matched Collector
```mermaid
sequenceDiagram
    autonumber
    actor H as Household (Pooja Verma)
    participant S3 as Amazon S3
    participant API as API Gateway / Lambda
    participant AI as Amazon Bedrock (Nova Lite)
    participant DDB as Amazon DynamoDB

    H->>API: 1. Request presigned upload URL (POST /uploads)
    API-->>H: Returns S3 Presigned URL & S3 imageKey
    H->>S3: 2. Direct PUT scrap image (JPEG, max 5MB)
    H->>API: 3. Trigger analysis (POST /analyze)
    API->>DDB: Check SHA-256 image hash cache
    alt Cache Miss
        API->>AI: Invoke Bedrock Converse API with prompt & JPEG bytes
        AI-->>API: Itemized scrap, estimated weights, quality check, hazards
        API->>DDB: Save result to cache (7-day TTL)
    else Cache Hit
        DDB-->>API: Instant cached result (zero extra Bedrock tokens)
    end
    API-->>H: Returns items + weight ranges + INR price low/high
    H->>API: 4. Confirm pickup & location chip (POST /listings)
    API->>DDB: Multi-criteria filter & score active collectors
    API-->>H: Returns top 3 matched collectors with distance & ETA
```

### 2. Collector Acceptance, Route Optimization & Scale Settlement
```mermaid
sequenceDiagram
    autonumber
    actor C as Collector (Imran Ali)
    participant API as API Gateway / Lambda
    participant DDB as Amazon DynamoDB
    actor H as Household (Pooja Verma)

    C->>API: 1. View incoming requests (GET /collectors/col-002/requests)
    API-->>C: Returns qualified listings with "Worth the trip" badge
    C->>API: 2. Tap "Accept Pickup" (POST /listings/{id}/accept)
    API->>DDB: Conditional write: attribute_not_exists(collectorId)
    alt First Collector to Accept
        DDB-->>API: 200 OK — State transitioned to ACCEPTED
        API-->>C: Pickup confirmed with seller contact
    else Race condition: Already Claimed
        DDB-->>API: 409 Conflict — Transaction cancelled
        API-->>C: "Already accepted by another collector" notice
    end
    Note over H: Household screen auto-polls every 5s
    API-->>H: Screen flips to "Collector Confirmed & On The Way"
    C->>API: 3. Request route (POST /collectors/col-002/route)
    API-->>C: Returns ordered stop list & Google Maps intent link
    C->>API: 4. Weigh on digital hanging scale & settle (POST /pickups/{id}/complete)
    API->>DDB: Record actual weights, compute payout & estimation error %
    API-->>C: Digital receipt with payout confirmation
```

---

## Core Engineering Innovations

### 1. Amazon Bedrock Multimodal Vision & Image Hash Caching
- Utilizes `amazon.nova-lite-v1:0` via the Bedrock Converse API.
- Implements a strict JSON schema system prompt matching our verified 17-scrap-category taxonomy (`config/taxonomy.json`).
- Photo quality validator flags blurry, underexposed, or irrelevant photos with actionable retake guidance (`photo_quality_ok: false`).
- **Cost & Rate Guard**: Computes SHA-256 hash of image bytes. Identical uploads return in `< 20ms` from DynamoDB (`cached: true`), preventing redundant Bedrock token consumption.

### 2. Multi-Criteria Collector Matching Algorithm
Collectors are filtered by service radius (<= 5 km), accepted material categories, e-waste authorization, and available vehicle payload capacity. Qualified collectors are scored using a weighted multi-criteria function:
$$\text{Score} = 0.5 \times \text{Proximity} + 0.3 \times \min\left(1.0, \frac{\text{Trip Value}}{₹500}\right) + 0.2 \times \text{Available Capacity}$$

### 3. Concurrency Safety with DynamoDB Conditional Writes
In real-world gig economies, multiple collectors may view the same open request. KabadiConnect uses DynamoDB atomic conditional expressions:
```python
ConditionExpression="attribute_not_exists(collectorId) OR #status = :open"
```
This guarantees **strict linearizability**: exactly one collector wins the pickup, completely eliminating double-dispatch bugs without distributed locks.

### 4. Nearest-Neighbor Route Optimization
The collector route engine groups accepted doorstep pickups, runs a greedy nearest-neighbor TSP heuristic over Haversine distances, and generates turn-by-turn Google Maps deep links for seamless mobile navigation.

### 5. Honest Impact Ledger
Unlike greenwashed impact claims, the `/impact` engine maintains a strict separation:
- **`seeded_kg_diverted`**: Labeled baseline demo data.
- **`live_kg_diverted`**: Verifiable scale-weighed kilograms recorded from completed live pickups.
- **`weight_estimation_mape_pct`**: Real-world Mean Absolute Percentage Error (MAPE) calculated *exclusively* from actual scale measurements vs. AI midpoint estimates.

---

## Comprehensive API Reference

All endpoints are hosted on the public API Gateway: `https://xzsflevsg9.execute-api.ap-southeast-2.amazonaws.com`

| Method | Endpoint | Description | Key Request / Response Fields |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Liveness & readiness probe | Returns `{ status: "healthy", version: "1.0.0", env: "production" }` |
| `GET` | `/rates` | Real-time indicative scrap price board | Returns array of 17 materials with rates (INR/kg), Hindi/English labels, and CO2e factors |
| `POST` | `/uploads` | Generates presigned S3 PUT URL | Input: `{ contentType: "image/jpeg" }` &rarr; Returns: `{ uploadUrl, imageKey, maxSizeBytes: 5242880 }` |
| `POST` | `/analyze` | Amazon Bedrock vision analysis | Input: `{ imageKey }` &rarr; Returns itemized scrap, weights, quality check, hazards, and cache status |
| `POST` | `/listings` | Submits scrap pickup & triggers matching | Input: `{ sellerName, sellerPhone, address, lat, lng, items, pickupWindow }` &rarr; Returns `{ listingId, matches }` |
| `GET` | `/listings/{id}` | Polls listing status & assigned collector | Returns listing status (`OPEN`, `ACCEPTED`, `COMPLETED`) and collector details |
| `GET` | `/collectors` | Directory of active scrap collectors | Returns active collectors with locations, vehicle capacities, and accepted scrap categories |
| `GET` | `/collectors/{id}/requests` | Collector's incoming request queue | Returns eligible open listings in collector's radius with "Worth the trip" flags |
| `POST` | `/listings/{id}/accept` | Atomic one-tap collector acceptance | Input: `{ collectorId }` &rarr; Transitions listing to `ACCEPTED` and initializes pickup |
| `POST` | `/collectors/{id}/route` | Generates optimized pickup sequence | Input: `{ collectorId, currentLat, currentLng }` &rarr; Returns ordered stops, km, and Google Maps URL |
| `POST` | `/pickups/{id}/complete` | Doorstep scale weighing & settlement | Input: `{ weighedItems: [{ material, weight_kg }] }` &rarr; Computes payout (INR) and estimation error % |
| `GET` | `/impact` | Public sustainability and income metrics | Returns total kg diverted, collector income (INR), CO2e avoided, and live MAPE accuracy |

---

## Repository Structure

```
Kabaddi-connect/
├── README.md                  # Comprehensive architectural guide & documentation
├── template.yaml              # AWS SAM CloudFormation template (Lambdas, DynamoDB, S3, CloudFront)
├── samconfig.toml             # AWS SAM deployment configuration
├── backend/
│   ├── common/                # Shared utilities: db.py, matching.py, geo.py, schema.py, errors.py
│   ├── functions/
│   │   ├── health/            # GET /health
│   │   ├── uploads/           # POST /uploads (presigned S3 PUT)
│   │   ├── analyze/           # POST /analyze (Amazon Bedrock Converse API + cache)
│   │   ├── listings/          # GET /rates, POST /listings, POST /listings/{id}/accept
│   │   ├── collectors/        # GET /collectors, /requests, POST /route
│   │   ├── pickups/           # POST /pickups/{id}/complete, GET /pickups
│   │   └── impact/            # GET /impact (dual-track verified metrics)
│   ├── requirements.txt       # Python dependencies (boto3, botocore, etc.)
│   └── tests/                 # Unit test suite (31 tests covering matching, schemas, error recovery)
├── frontend/                  # Modern PWA: Vite + React 19 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── api/               # Typed client calling the live AWS API Gateway
│   │   ├── components/        # HouseholdSnap, RangeRuler, Review, MatchedView, CollectorView, ImpactDashboard
│   │   ├── i18n/              # Complete bilingual English & Hindi dictionary
│   │   └── types/             # Strict TypeScript models
│   ├── index.html             # HTML entry point with Yatra One & Mukta typography
│   └── vite.config.ts         # Vite build configuration
├── config/
│   ├── taxonomy.json          # 17-item standardized scrap taxonomy
│   ├── rates.seed.json        # Indicative Delhi-NCR baseline scrap rates (INR/kg)
│   └── emission_factors.json  # Lifecycle CO2e avoided factors per kg recycled
├── seed/
│   ├── collectors.json        # 10 realistic synthetic collectors in North West Delhi
│   ├── listings.json          # Sample listings covering high-value, mixed, and e-waste items
│   ├── ewaste_points.json     # Authorized e-waste drop-off facilities
│   └── seed.py                # Idempotent DynamoDB seeder with stack output discovery
├── scripts/
│   ├── reset_demo.py          # Fast demo environment reset (< 10 seconds)
│   └── smoke_test.py          # Complete 10-step end-to-end API smoke test
├── eval/
│   ├── labels.csv             # Measured ground-truth weights and photo metadata
│   └── run_eval.py            # Computer vision evaluation tool (Precision, Recall, MAPE)
└── docs/
    ├── blog.md                # AWS Builder Center publication draft
    ├── demo-script.md         # 3-minute video presentation script
    └── eval-results.md        # Computer vision benchmark results
```

---

## Local Development and Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python 3.12](https://www.python.org/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with active credentials
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

### 1. Run the Frontend Locally
```bash
cd frontend

# Install dependencies
npm install

# Start development server with LAN broadcast for mobile testing
npm run dev -- --host
```
- Open `http://localhost:5173/` on your computer.
- Open `http://<your-local-ip>:5173/` on your smartphone (connected to the same Wi-Fi).

### 2. Run Backend Unit Tests
```bash
# Run complete test suite (31 tests)
pytest backend/tests
```

### 3. Run End-to-End Cloud Smoke Test
Test the full pipeline against the deployed AWS cloud backend:
```bash
python3 scripts/smoke_test.py --api-url https://xzsflevsg9.execute-api.ap-southeast-2.amazonaws.com
```

---

## Deployment Instructions (AWS SAM)

To deploy your own instance of the complete stack to AWS:

```bash
# 1. Build the serverless application
sam build

# 2. Deploy to AWS
sam deploy --guided
```

When prompted:
- **Stack Name**: `kabadiconnect`
- **AWS Region**: `ap-southeast-2` (or your preferred region with Bedrock Nova Lite)
- **BedrockModelId**: `amazon.nova-lite-v1:0`
- Confirm IAM role creation

### Seed DynamoDB Tables
```bash
python3 seed/seed.py --region ap-southeast-2 --stack-name kabadiconnect
```

### Deploy the Frontend to S3 + CloudFront
```bash
# 1. Build frontend production bundle
cd frontend && npm run build && cd ..

# 2. Sync to the CloudFormation-created S3 bucket
aws s3 sync frontend/dist s3://<FrontendBucketName> --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

---

## Honest Disclosures and Known Limitations

- **Vision Weight Estimation**: Weights estimated from single 2D photos are approximate volumetric approximations. The user is provided an interactive RangeRuler slider to adjust them, and final legal settlement always occurs on certified digital scales at the doorstep.
- **Synthetic Seed Data**: Collector profiles and initial demo listings are synthetic fixtures centered in North West Delhi (Rohini, DTU, Pitampura, Shalimar Bagh) to allow judges to test realistic geographic clustering.
- **E-Waste Drop-Off Points**: Drop-off centers are marked with an *"Unverified"* badge in the UI until physically audited by certified recyclers.
- **Authentication**: Uses client-side role switching for zero-friction hackathon judging; production rollout would implement AWS Cognito with SMS OTP for informal collectors.

---

## Hackathon Team and Track

- **Hackathon**: Environmental Hacks 2026
- **Track**: Track 3 — Waste and Energy
- **Team**: Omnivision
- **License**: MIT
