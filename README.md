# KabadiConnect (कबाड़ी कनेक्ट)

> **"Uber-style pickup for the informal recycling economy, with an AI that tells you what your scrap is worth."**
> Hackathon: Environmental Hacks, Track 3 (Waste and Energy) | Team: Omnivision

KabadiConnect bridges Indian households with local informal scrap collectors (kabadiwalas) through multimodal AI on **Amazon Bedrock**. Households photograph their recyclables to receive an instant, transparent price range and schedule doorstep collection, while collectors receive pre-qualified, geo-clustered pickup requests with optimized routes.

---

## Architecture

```
 Household PWA (React)          Collector PWA (React)
        |                              |
        +--------------+---------------+
                       |  HTTPS
              Amplify Hosting (static)
                       |
            Amazon API Gateway (HTTP API)
                       |
        +--------------+--------------------------+
        |              |               |          |
   Lambda:        Lambda:         Lambda:     Lambda:
   uploads        analyze         listings/   impact
   (presign)      (vision)        matching    (aggregates)
        |              |               |          |
       S3         Amazon Bedrock   DynamoDB    DynamoDB
   (photos)      (Converse API,    (Listings,  (read-only
                  multimodal)      Collectors, aggregates)
                                   Rates,
                                   Pickups)
```

- **Amazon Bedrock (Converse API)**: Multimodal scrap classification and weight band estimation with strict taxonomy enforcement.
- **AWS Lambda (Python 3.12)**: Serverless compute with least-privilege IAM roles.
- **Amazon DynamoDB (On-Demand)**: Pay-per-request storage for Rates, Listings, Collectors, and Pickups. Includes hash-based analysis caching.
- **Amazon S3**: Private photo storage with 7-day lifecycle expiration and presigned upload URLs (JPEG only, 5 MB limit).
- **Amazon API Gateway HTTP API**: Sub-30s latency endpoints with CORS enabled.
- **CloudWatch**: Error monitoring alarm on Lambda failures.
- **AWS SAM (Serverless Application Model)**: Open-source Infrastructure-as-Code for 100% reproducible deployments.

---

## Repository Structure

```
kabadiconnect/
├── README.md                  # Setup & architecture guide
├── template.yaml              # AWS SAM template (Python 3.12, S3, DynamoDB, Lambdas, Alarm)
├── samconfig.toml             # SAM deployment defaults
├── backend/
│   ├── common/                # Shared utilities: db.py, s3.py, geo.py, errors.py, schema.py
│   ├── functions/
│   │   ├── health/            # GET /health
│   │   ├── uploads/           # POST /uploads (presigned PUT)
│   │   ├── analyze/           # POST /analyze (Bedrock Converse multimodal)
│   │   ├── listings/          # GET /rates & listings stubs
│   │   ├── impact/            # GET /impact aggregates stub
│   │   ├── collectors/        # Collectors route stub
│   │   └── pickups/           # Pickups route stub
│   ├── requirements.txt       # Python dependencies
│   └── tests/                 # Pytest test suite
├── frontend/                  # Vite + React + TypeScript + Tailwind PWA
│   ├── src/
│   │   ├── api/               # API client reading VITE_API_URL
│   │   ├── components/        # Snap, Review, Role selector, Navbar
│   │   ├── i18n/              # Hindi / English dictionary
│   │   └── utils/             # Client-side 1280px image resizing
├── config/
│   ├── taxonomy.json          # 17-item strict material taxonomy
│   ├── rates.seed.json        # Indicative scrap market rates (₹/kg)
│   └── emission_factors.json  # CO2e avoidance factors
├── seed/
│   ├── collectors.json        # Synthetic collector seed profiles
│   ├── listings.json          # Sample scrap listings
│   ├── ewaste_points.json     # Authorised e-waste collection points
│   └── seed.py                # DynamoDB Rates table loader
├── eval/
│   ├── labels.csv             # Ground truth test dataset
│   └── run_eval.py            # Precision/recall & MAPE report script
└── docs/
    ├── blog.md                # AWS Builder Center article draft
    └── demo-script.md         # 3-minute video demo script
```

---

## Getting Started

### Prerequisites
1. [AWS CLI](https://aws.amazon.com/cli/) configured with valid credentials (`aws configure`)
2. [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (`sam --version`)
3. [Python 3.12](https://www.python.org/)
4. [Node.js](https://nodejs.org/) (v18+ or v20+)

---

### Step 1: Deploy Backend with AWS SAM

```bash
# Build the Lambda functions and packaging
sam build

# Deploy to your AWS account (first time interactive)
sam deploy --guided
```

When prompted:
- **Stack Name**: `kabadiconnect`
- **AWS Region**: `ap-south-1` (Mumbai) or your chosen region
- **Parameter BedrockModelId**: `apac.amazon.nova-lite-v1:0` (or `anthropic.claude-3-haiku-20240307-v1:0`)
- **Parameter BedrockRegion**: `ap-south-1`
- Confirm creation of IAM roles and API Gateway authorization

Note down the **`HttpApiUrl`** output from SAM deploy.

---

### Step 2: Seed the Rates Table

Populate the DynamoDB `Rates` table with indicative market rates:

```bash
python3 seed/seed.py --rates-table <RatesTableNameFromSamOutput> --region ap-south-1
```

> **Notice**: Seeded rates are indicative based on local averages. Rates are verified by informal collectors at the time of doorstep pickup.

---

### Step 3: Run the Frontend Locally

```bash
cd frontend

# Install dependencies
npm install

# Run Vite dev server connected to your deployed API
VITE_API_URL="https://<your-api-id>.execute-api.ap-south-1.amazonaws.com" npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Step 4: Run Unit Tests

Execute backend unit tests covering schema validation, malformed Bedrock output recovery, taxonomy filtering, and price calculations:

```bash
python3 -m pytest backend/tests/ -v
```

---

## Known Limitations & Honest Disclosures
- **Weight Accuracy**: Weights estimated from single 2D photos are approximate ranges, not precise values. The UI provides interactive sliders for household adjustment, and final payout is determined by actual weighing at collection.
- **Indicative Rates**: Seeded rates reflect general Delhi-NCR market averages and should be confirmed against local scrap dealers.
- **PII Privacy**: Minimal PII collected for demo purposes (synthetic names and phone numbers only).
- **Authentication**: Full OTP/Cognito auth is deferred to post-MVP; the prototype uses a role selector.
