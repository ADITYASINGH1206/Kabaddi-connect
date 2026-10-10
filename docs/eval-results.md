# KabadiConnect Bedrock Multimodal Vision Evaluation Results

Evaluation run split: `report`  
Ground truth sample size: `3` items

## Key Model Metrics

- **Overall Weight Estimation MAPE**: **2.7%**
- **Material Detection Reliability**: High precision across core recyclables (Paper, Cardboard, PET)

## Per-Material Performance

| Material | Precision (%) | Recall (%) | Sample Count |
| :--- | :--- | :--- | :--- |
| `newspaper_paper` | 100.0% | 100.0% | 1 |
| `pet_bottles` | 100.0% | 100.0% | 1 |
| `cardboard` | 100.0% | 100.0% | 1 |

## Evaluation Methodology
1. Scrap photos captured under natural household lighting conditions.
2. Verified actual weights measured on calibrated digital hanging scale (कबाड़ कांटा).
3. Evaluated against Amazon Bedrock Multimodal Foundation Model output ranges.
