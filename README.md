# General-knowledge survey (jsPsych 8 + Proliferate)

An online experiment: **47 general-knowledge questions**, each with a
multiple-choice question (3 options) followed by a **confidence slider 0–100**,
shown in a **random order that is unique to each participant**, then 2
background questions. Data is submitted automatically, in the background, to
**Proliferate** (<https://proliferate.alps.science>), which also redirects
the participant back to **Prolific** on completion — no extra page, no click.

All participant-facing text is in Norwegian; all comments and documentation
are in English.

---

## Files

| File | What it is | Do you edit it? |
|---|---|---|
| `index.html` | the page participants open; loads jsPsych, the survey plugin, jQuery and Proliferate's library from CDNs | no |
| `questions.js` | the 47 questions (+ answer key), the 2 background questions, the 0–100 confidence scale | **yes – content** |
| `experiment.js` | the engine: builds the sequence, shuffles, collects data, submits to Proliferate | **only the `CONFIG` block at the top** |
| `style.css` | light styling of the info / end pages | rarely |
| `questions_key.csv` | question/option/answer lookup table for analysis | no (regenerate if you change questions) |
| `serve.ps1` | tiny local web server for testing on your own PC | no |
| `EXPAND_DATA.md` | how to turn the downloaded data into a normal table | read at analysis time |

`test.html` and `script.js` are empty leftovers from the start and can be deleted.

---

## How submission works

At the end of the experiment, `experiment.js` calls `proliferate.submit(...)`
with an object of three keys (see "What is stored" below for why they're
shaped this way). Proliferate's library:

1. posts the data to Proliferate's server in the background (no page
   navigation, no participant action),
2. shows a one-line status in the `<div id="thanks">` in `index.html`,
3. on success, **redirects the participant straight to the Prolific
   completion URL** — that URL is configured once in Proliferate's admin
   (step 2 below), not in the code.

If the submission fails (e.g. no internet), the participant instead sees a
"download a backup" button, and a copy of their data is also saved in the
browser's `localStorage` (`gk_survey_<pid>`) as a second safety net.

---

## Setup checklist

### 1. Publish the experiment on GitHub Pages

1. Create a free GitHub account if you don't have one, and a new **public**
   repository, e.g. `gk-survey`.
2. On the repo's main page, use **"Add file" → "Upload files"** and drag in
   `index.html`, `questions.js`, `experiment.js`, `style.css` (the `.md`
   files and `serve.ps1` can go in too; they're harmless). Commit.
3. **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / `(root)` → Save.**
4. After a minute your experiment is live at
   `https://<your-username>.github.io/gk-survey/`.

(No `git`/command-line steps needed — the GitHub website's drag-and-drop
upload is enough for a handful of static files.)

### 2. Create the Prolific study

1. On Prolific, create your study.
2. Fill in the title/description.
3. **Study Completion** → choose **"I'll redirect them using a URL"** → copy
   the completion URL it gives you (looks like
   `https://app.prolific.com/submissions/complete?cc=ABC123`). You'll paste
   this into Proliferate in the next step, **not** into the experiment code.
4. Leave the **Study Link** field for later (step 4) — don't publish yet.

### 3. Create the Proliferate experiment

1. Go to <https://proliferate.alps.science/admin/> and sign in (ask your PI /
   lab if you need an account created — Proliferate is run by Stanford's ALPS
   lab and is typically used under a lab's existing account).
2. **"Add experiment"**:
   - **Name:** anything, e.g. `Allmennkunnskap`
   - **Prolific completion URL:** paste the URL from step 2.3
   - **Notes:** optional
   - **Conditions** (one is enough — this study has no between-subject
     conditions): **Name** anything, **Experiment URL** = your GitHub Pages
     URL from step 1.4, **Participants** = `97` (or `0` to decide later).
3. **Create experiment.** You'll land on its detail page, which shows a
   **Sandbox URL** and a **Study URL**.

### 4. Test before going live

Open the **Sandbox URL** yourself (or use Prolific's **"Preview"** function)
and do a full run. Confirm:

- all 47 pages work and the order is randomized,
- at the end, the page briefly shows "Sender inn svarene dine …" and then
  you're redirected (in Sandbox mode this redirect may go to a test page —
  that's expected),
- the run shows up under the experiment's detail page in Proliferate's admin.

### 5. Go live

1. Copy the **Study URL** from Proliferate's experiment detail page.
2. Paste it into Prolific's **Study Link** field.
3. Select **"I'll use URL parameters"** underneath — this makes Prolific
   append `?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...` to the Study URL,
   which is how `experiment.js` identifies each participant.
4. Publish the study on Prolific with **97 places**.

### 6. Collect the data

Proliferate's admin page for the experiment has a **"Download data"** button
→ CSV. See `EXPAND_DATA.md` for turning that into a tidy table.

---

## Testing locally (before you touch GitHub/Proliferate/Prolific)

The files must be served over `http://` – opening `index.html` as a file
(`file://`) will not work. You also need an internet connection (jsPsych,
jQuery and Proliferate's library are all loaded from CDNs).

- **VS Code "Live Server" extension:** install it, right-click `index.html` →
  *Open with Live Server*, then add `?pid=test` to the address.
- **The included script:** in the VS Code terminal (PowerShell), from this
  folder:
  ```powershell
  .\serve.ps1
  ```
  then open <http://localhost:8000/?pid=test>. Press Ctrl+C to stop.

Note: a local run can exercise the whole experiment, but the final
`proliferate.submit()` call only succeeds once the experiment URL is
actually registered in Proliferate (steps 1–3 above) — until then, expect
the "Innsendingen feilet" (submission failed) fallback with the backup
download button, which is normal at this stage.

---

## What is stored per participant

Proliferate turns the submitted object into CSV files automatically — a
**list**-valued key becomes a CSV with one row per list element, an
**object**-valued key becomes a CSV with one row per participant (plus
auto-added `workerid` / `condition` / `error` columns on every file). So
`experiment.js` is deliberately shaped around that rule, with everything
kept flat (no nested objects/arrays) so the CSVs need no further unpacking:

```jsonc
{
  "knowledge": [   // LIST -> "<experiment>-knowledge.csv", one row per
                    // question per participant (47 rows/participant)
    { "pid": "…", "nr": 12, "question": "…", "chosen_answer": "…",
      "chosen_option_index": 1, "correct_answer": "…", "is_correct": 1,
      "confidence": 5, "rt_ms": 8234 },
    …
  ],
  "participant": {  // OBJECT -> "<experiment>-participant.csv", one row
                     // per participant
    "pid": "…", "prolific_pid": "…", "study_id": "…", "session_id": "…",
    "start_time": "…", "end_time": "…", "n_questions": 47, "score": 31,
    "presentation_order": "12,5,33,…",
    "morsmal_norsk": "Ja", "utdanning_norge": "Ja, begge deler"
  },
  "trials": [ /* raw jsPsych trial log - LIST -> "<experiment>-trials.csv",
                 kept as an unstructured backup, not meant for analysis */ ]
}
```

Download `<experiment>-knowledge.csv` from Proliferate's admin — it's
already a tidy one-row-per-answer table. `EXPAND_DATA.md` shows how to join
it with `questions_key.csv` to add back the full question/option text.

## Settings reference (`CONFIG` in `experiment.js`)

| Setting | Default | Meaning |
|---|---|---|
| `randomizeOptions` | `true` | shuffle the answer options within each question |
| `showProgressBar` | `true` | progress bar at the top |
| `offerBackupDownload` | `true` | offer a downloadable backup if submission fails |

To put the **background questions first** instead of last, move `bakgrunn`
ahead of `...knowledgeTrials` in the `timeline` line near the bottom of
`experiment.js`.

## Information / consent

The information page in `experiment.js` (`informasjon`) is a placeholder.
**Replace the text** with the information/consent wording from your Sikt /
REK approval before collecting real data.
