# Building KabadiConnect: AI-Powered Fair-Price Scrap Pickup on AWS

*How we combined Amazon Bedrock multimodal vision, AWS Lambda and Amazon DynamoDB to help households sell scrap and help collectors plan worthwhile trips.*

> **Draft status.** Everything in `[TODO: ...]` brackets must be replaced with something we actually measured or heard, or deleted, before publishing. Do not publish invented numbers or quotes.

---

## 1. The problem

In Indian cities a large part of recycling is done by informal collectors (kabadiwalas) who buy paper, plastic and metal door to door. Two things go wrong on both sides:

1. **Households rarely know what their scrap is worth**, so they haggle blind, or just throw it out.
2. **Collectors cannot tell in advance whether a trip is worth it.** A stop with a few rupees of paper costs time and fuel.
3. **Hazardous e-waste** (batteries, CRT monitors) can enter informal scrap streams where handling is unsafe.

KabadiConnect lets a household photograph its scrap, get an AI price *range*, and be matched with nearby collectors who can accept the request and see their accepted stops in a sensible order.

---

## 2. What we learned from a real scrap dealer

`[TODO: visit a scrap dealer or collector near you. Write 3 to 5 sentences about what they told you: the rates they pay, what makes a trip not worth it, how they decide what to pick up. Use a direct quote only if they said it and agreed to be quoted. If we do not manage a visit, delete this section instead of paraphrasing assumptions as findings.]`

Design principles we chose (these are our decisions, not findings):
- **Never promise exact weight from a photo.** The AI returns a low-high range, the household can adjust it, and the collector enters the real weight on a scale at pickup. We record estimate vs actual.
- **Make small pickups visible as small.** Requests below a minimum value are flagged, and the household is told how many other open requests are within 1 km.

---

## 3. Architecture

```
[ Household / Collector web app (React PWA) ]
                 | HTTPS
        [ Amazon API Gateway (HTTP API) ]
   +-------------+------------+-------------+-----------+
   v             v            v             v           v
 Lambda:      Lambda:      Lambda:       Lambda:     Lambda:
 uploads      analyze      listings      collectors  pickups / impact
   |            |            |             |            |
   v            v            v             v            v
 Amazon S3   Amazon      DynamoDB      DynamoDB     DynamoDB
 (photos)    Bedrock     (listings)    (collectors) (pickups)
             (Converse)
```

### Why these services
1. **Amazon Bedrock (Converse API):** a multimodal model reads the photo and returns structured JSON (materials, weight ranges, photo quality, hazards). We validate the output against a fixed 17-material taxonomy and drop anything outside it.
2. **Amazon DynamoDB (on-demand):** accepting a request uses a conditional write (`status = OPEN`), so if two collectors tap Accept together exactly one wins and the other gets a clear "already accepted" response. Global secondary indexes serve the open-requests and per-collector queries.
3. **Amazon S3:** photos are uploaded straight from the phone with a presigned URL (JPEG only) and expire after 7 days.
4. **AWS Lambda + API Gateway + SAM:** the whole backend is serverless and deploys with `sam build && sam deploy`.

---

## 4. Making a vision model usable in the real world

- **Fixed taxonomy.** Models invent labels. We only accept the 17 materials in `config/taxonomy.json`.
- **Hazard handling.** If a battery or CRT monitor is detected, it is never matched to a regular collector. The app shows drop-off points instead. *Our current drop-off entries are placeholders and must be replaced with verified, authorised facilities before real use.*
- **Fallbacks everywhere.** If the vision call fails or is throttled, the app shows a manual material picker. If GPS fails, the user picks one of eight pre-set North-West Delhi areas. Accepted stops are shown in nearest-neighbour order with a Google Maps link per stop (we do not draw a map yet).
- **Bounded latency.** Bedrock calls have a timeout and a retry budget so a slow model returns the manual fallback instead of a gateway error.
- **Caching.** Results are cached by image hash so repeated demo photos are instant and cost nothing.

---

## 5. Evaluation

`[TODO: run eval/run_eval.py on our own scale-weighed photos (see eval/README.md) and paste the real output here: number of photos, material precision/recall, mean absolute % error of the weight midpoint, and how often the scale weight fell inside the predicted range. If we have fewer than about 20 photos, say so plainly.]`

What the system measures live: for every completed pickup it stores the estimate and the collector's actual weight, so the impact page reports the real estimation error from live pickups. Until a pickup is completed, it shows no accuracy figure.

**On impact numbers:** the public impact page includes a clearly labelled *demo baseline* so it is not empty on first load. Those baseline figures are illustrative, not results. CO2e values use illustrative factors in `config/emission_factors.json`. `[TODO: replace them with sourced life-cycle figures and cite the source here.]`

---

## 6. What fought back
`[TODO: fill in honestly, for example: Bedrock model access and inference-profile setup, presigned-URL CORS, DynamoDB rejecting Python floats (our image cache silently failed until we converted to Decimal), the Lambda package not including the seed folder.]`

---

## 7. What is next

- Real map and optimised routing with Amazon Location Service (today routing is a greedy nearest-neighbour estimate).
- WhatsApp or voice-note photo submission in Hindi.
- Verified e-waste drop-off partners.
- Real sign-in (the demo uses a role picker only).

*Built by Team Omnivision for Environmental Hacks 2026.*
