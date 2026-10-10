# Vision evaluation

This folder is empty on purpose: **no accuracy figure exists until the team adds real photos.**
`run_eval.py` sends real photos through the deployed API and compares the result with weights you measured.

## Capture (about 30 photos is plenty)
1. Photograph piles of scrap (paper, cardboard, PET bottles, metal, a couple of old chargers/phones). Mix good light, dim light, and cluttered scenes.
2. Weigh each material separately on a scale. Write the weight down in kg.
3. Save the JPEGs in `eval/photos/` (not committed if they show people or documents; `eval/photos/private/` is git-ignored).
4. Add one row per material per photo to `labels.csv`:

```
image_name,material,actual_weight_kg,split,notes
pile01.jpg,newspaper_paper,6.5,tune,bundled
pile01.jpg,cardboard,2.0,tune,
pile02.jpg,pet_bottles,1.2,report,
```

`material` must be a code from `config/taxonomy.json`. Put about half the photos in `tune` (use these to adjust the prompt) and half in `report` (quote only these).

## Run
```bash
python eval/run_eval.py --api-url https://<id>.execute-api.<region>.amazonaws.com --split tune
python eval/run_eval.py --api-url https://<id>.execute-api.<region>.amazonaws.com --split report
```
The report split writes `docs/eval-results.md`. The script exits with an error and writes nothing if no photo could be analysed.
