# Building KabadiConnect: AI-Powered Fair-Price Scrap Marketplace on AWS

## 1. The Problem
India's recycling depends heavily on informal collectors (kabadiwalas) who face unpredictable income and wasted travel, while households struggle with haggling and lack price transparency. Recyclables and toxic e-waste end up in landfills.

## 2. Talking to Ground Collectors
Informal collectors spend up to 40% of their workday commuting to households that often only have a few newspapers to sell. Digital clustering and upfront estimates fundamentally change their day.

## 3. Serverless Architecture on AWS
- Amazon Bedrock (Converse API, multimodal vision)
- AWS Lambda (Python 3.12, least-privilege IAM)
- Amazon DynamoDB (on-demand tables)
- Amazon S3 (presigned URLs, lifecycle policies)
- Amazon API Gateway HTTP API
- Amazon Location Service (geocoding and waypoint route optimization)
- AWS SAM for 100% reproducible Infrastructure-as-Code

## 4. Making Vision Models Useful in Real Life
Weight cannot be precisely determined from a 2D photograph. KabadiConnect uses:
- Conservative range estimation (weight_low to weight_high)
- Strict taxonomy filtering
- Transparent user adjustment sliders
- Automatic fallback for network/throttling errors

## 5. Evaluation & Results
Tested on real household scrap piles across paper, cardboard, PET bottles, metal, and e-waste.
