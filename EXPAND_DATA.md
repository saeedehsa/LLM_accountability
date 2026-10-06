# Using the Proliferate data export

Unlike the old Nettskjema plan, you do **not** need to parse any JSON by
hand. Proliferate automatically splits the object `experiment.js` submits
into separate, already-tidy CSV files. From the experiment's detail page in
Proliferate's admin, **"Download data"** gives you (at least) these files:

| File | One row per | Columns |
|---|---|---|
| `<experiment>-knowledge.csv` | **question answered** (47 × number of participants) | `pid`, `nr`, `question`, `chosen_answer`, `chosen_option_index`, `correct_answer`, `is_correct`, `confidence` (0–100), `confidence_moved` (1 if the slider was moved, 0 if it stayed at the 50 start), `rt_ms`, plus Proliferate's own `workerid`, `condition`, `error` |
| `<experiment>-participant.csv` | **participant** | `pid`, `prolific_pid`, `study_id`, `session_id`, `start_time`, `end_time`, `n_questions`, `score`, `presentation_order` (comma-separated question numbers), `morsmal_norsk`, `utdanning_norge`, plus `workerid`/`condition`/`error` |
| `<experiment>-trials.csv` | raw jsPsych trial record | whatever columns the different page types happen to have — this is an unstructured backup, not meant for analysis |

For almost all analysis you want **`<experiment>-knowledge.csv`** — it's
already one row per answer, with everything you need (question number,
what they answered, whether it was correct, confidence, response time).

## Joining in the full question text

`<experiment>-knowledge.csv` already has `question` and `correct_answer` as
text, so you often don't need anything else. If you also want the exact
wording of the two *incorrect* options (e.g. to check what `chosen_answer`
was relative to all three choices), join on `nr` against `questions_key.csv`
(included in this project):

### R

```r
library(dplyr)

knowledge <- read.csv("experiment-knowledge.csv", fileEncoding = "UTF-8")
key       <- read.csv("questions_key.csv", fileEncoding = "UTF-8")

long <- knowledge |> left_join(key, by = "nr")
head(long)
```

### Python (pandas)

```python
import pandas as pd

knowledge = pd.read_csv("experiment-knowledge.csv", encoding="utf-8")
key       = pd.read_csv("questions_key.csv", encoding="utf-8")

long = knowledge.merge(key, on="nr", how="left")
print(long.head())
```

## Option-choice distribution per question

A table with one row per **question × option**, showing how many (and what
percent of) participants picked each option, with the correct option marked.
This has to be computed after data collection — no single participant's
submission has visibility into what everyone else chose, so it's only
possible once you have everyone's rows together in `knowledge.csv`. Both
scripts below need that file plus `questions_key.csv` (so options nobody
picked still show up, with a count of 0).

### R

```r
library(dplyr); library(tidyr)

knowledge <- read.csv("experiment-knowledge.csv", fileEncoding = "UTF-8")
key       <- read.csv("questions_key.csv", fileEncoding = "UTF-8")

chosen_counts <- knowledge |> count(nr, chosen_answer, name = "n_chosen")

option_distribution <- key |>
  select(nr, question, opt1, opt2, opt3, correct) |>
  pivot_longer(c(opt1, opt2, opt3), names_to = "slot", values_to = "option") |>
  select(-slot) |>
  left_join(chosen_counts, by = c("nr", "option" = "chosen_answer")) |>
  mutate(
    n_chosen = replace_na(n_chosen, 0),
    is_correct_option = as.integer(option == correct)
  ) |>
  group_by(nr) |>
  mutate(pct_chosen = round(100 * n_chosen / sum(n_chosen), 1)) |>
  ungroup() |>
  select(nr, question, option, is_correct_option, n_chosen, pct_chosen) |>
  arrange(nr, desc(is_correct_option))

write.csv(option_distribution, "option_distribution.csv", row.names = FALSE)
```

### Python (pandas)

```python
import pandas as pd

knowledge = pd.read_csv("experiment-knowledge.csv", encoding="utf-8")
key       = pd.read_csv("questions_key.csv", encoding="utf-8")

long_options = key.melt(
    id_vars=["nr", "question", "correct"],
    value_vars=["opt1", "opt2", "opt3"],
    value_name="option",
).drop(columns="variable")

counts = (
    knowledge.groupby(["nr", "chosen_answer"])
    .size()
    .reset_index(name="n_chosen")
    .rename(columns={"chosen_answer": "option"})
)

out = long_options.merge(counts, on=["nr", "option"], how="left")
out["n_chosen"] = out["n_chosen"].fillna(0).astype(int)
out["is_correct_option"] = (out["option"] == out["correct"]).astype(int)
out["pct_chosen"] = out.groupby("nr")["n_chosen"].transform(
    lambda s: (100 * s / s.sum()).round(1)
)
out = out[["nr", "question", "option", "is_correct_option", "n_chosen", "pct_chosen"]]
out = out.sort_values(["nr", "is_correct_option"], ascending=[True, False])
out.to_csv("option_distribution.csv", index=False)
```

Example output (first question):

| nr | question | option | is_correct_option | n_chosen | pct_chosen |
|---|---|---|---|---|---|
| 1 | Hvilket grunnstoff har atomnummer 74? | Wolfram | 1 | 61 | 62.9 |
| 1 | Hvilket grunnstoff har atomnummer 74? | Rhenium | 0 | 22 | 22.7 |
| 1 | Hvilket grunnstoff har atomnummer 74? | Osmium | 0 | 14 | 14.4 |

## Regenerating `questions_key.csv`

Only needed if you change the questions in `questions.js`. Run this in the
browser console on the experiment page:

```js
copy(
  "nr,question,opt1,opt2,opt3,correct\n" +
  KNOWLEDGE_QUESTIONS.map(q =>
    [q.nr, q.question, q.options[0], q.options[1], q.options[2], q.correct]
      .map(x => `"${String(x).replace(/"/g,'""')}"`).join(",")
  ).join("\n")
);
// copy(...) puts the CSV on the clipboard - paste it into questions_key.csv
```
