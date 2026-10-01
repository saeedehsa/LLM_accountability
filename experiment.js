/* ============================================================================
 * experiment.js  —  General-knowledge survey (jsPsych 8 + Proliferate)
 * ----------------------------------------------------------------------------
 * Flow:
 *   1. Information / consent page
 *   2. 47 knowledge pages (multiple choice + confidence 1-7) in RANDOM ORDER
 *      - the order is unique per participant and is saved in the data
 *   3. 2 background questions (fixed order)
 *   4. Data is submitted to Proliferate in the background (no participant
 *      action, no extra page) -> Proliferate redirects to Prolific
 *
 * Requires: questions.js, then jQuery + proliferate.js, then this file
 * (see index.html).
 *
 * Participant-facing text (page HTML, question titles, button labels) is in
 * Norwegian on purpose. Comments are in English.
 * ==========================================================================*/

/* ----------------------------------------------------------------------------
 * 1. CONFIGURATION  – normally the only lines you need to change
 * --------------------------------------------------------------------------*/
const CONFIG = {
  /* true  = shuffle the answer options within each question (recommended,
   *          counters position bias; scoring is by text so this is safe).
   * false = show options in the questions.js order.                          */
  randomizeOptions: true,

  /* Show a progress bar at the top. */
  showProgressBar: true,

  /* Offer the participant a downloadable backup (JSON) if the submission to
   * Proliferate fails. */
  offerBackupDownload: true,
};

/* ----------------------------------------------------------------------------
 * 2. Setup
 * --------------------------------------------------------------------------*/

/* Read a query-string parameter from the page URL, e.g. ?PROLIFIC_PID=abc */
function urlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* Participant ID.
 * Priority: Prolific's PROLIFIC_PID, then a manual ?pid= / ?deltaker= / ?id=,
 * otherwise a random fallback so a run never stalls for lack of an ID.      */
function getParticipantId() {
  const fromUrl =
    urlParam("PROLIFIC_PID") ||
    urlParam("pid") ||
    urlParam("deltaker") ||
    urlParam("id");
  if (fromUrl) return fromUrl.trim().slice(0, 64);
  return (
    "auto-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

const PID = getParticipantId();
const PROLIFIC = {
  pid: urlParam("PROLIFIC_PID") || "",
  study_id: urlParam("STUDY_ID") || "",
  session_id: urlParam("SESSION_ID") || "",
};
const START_ISO = new Date().toISOString();

const jsPsych = initJsPsych({
  show_progress_bar: CONFIG.showProgressBar,
  auto_update_progress_bar: true,
  on_finish: submitData,
});

/* Reproducible shuffle: the same PID always yields the same question order.
 * (The order is stored explicitly in the data regardless.)                  */
try {
  if (
    jsPsych.randomization &&
    typeof jsPsych.randomization.setSeed === "function"
  ) {
    jsPsych.randomization.setSeed(PID);
  }
} catch (e) {
  /* setSeed not available in this version -> order is simply random */
}

jsPsych.data.addProperties({
  pid: PID,
  prolific_pid: PROLIFIC.pid,
  study_id: PROLIFIC.study_id,
  session_id: PROLIFIC.session_id,
  start_time: START_ISO,
  user_agent: navigator.userAgent,
  jspsych_version:
    typeof jsPsych.version === "function"
      ? jsPsych.version()
      : jsPsych.version || "8",
});

/* ----------------------------------------------------------------------------
 * 3. Pages
 * --------------------------------------------------------------------------*/

/* Information / consent page. Participant-facing text is Norwegian.
 * REPLACE the body text with the wording from your Sikt/REK approval.        */
const informasjon = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div class="tekst">
      <h2>Velkommen</h2>
      <p>Takk for at du deltar i denne undersøkelsen om allmennkunnskap.</p>
      <p>Du vil få <strong>47 spørsmål</strong>. For hvert spørsmål skal du:</p>
      <ol>
        <li>velge det svaret du tror er riktig, og</li>
        <li>angi hvor sikker du er på svaret på en skala fra
            1 (<em>ikke sikker i det hele tatt</em>) til 7 (<em>helt sikker</em>).</li>
      </ol>
      <p>Spørsmålene kommer i tilfeldig rekkefølge. Det tar omtrent 10&ndash;15 minutter.
         Svarene dine behandles konfidensielt.</p>
      <!-- RESEARCHER: replace the whole <div class="tekst"> above with the
           information/consent wording from your Sikt/REK approval before you
           collect data. Keep it in Norwegian. -->
      <p>Trykk <strong>Start</strong> for å begynne.</p>
    </div>`,
  choices: ["Start"],
  data: { task: "instructions" },
};

/* Build one knowledge page (multiple choice + confidence rating). */
function buildKnowledgeTrial(item) {
  return {
    type: jsPsychSurvey,
    survey_json: {
      showQuestionNumbers: "off",
      completeText: "Neste →", // "Next"
      elements: [
        {
          type: "radiogroup",
          name: "answer",
          title: item.question,
          choices: item.options,
          choicesOrder: CONFIG.randomizeOptions ? "random" : "none",
          isRequired: true,
        },
        {
          type: "rating",
          name: "confidence",
          title: CONFIDENCE_SCALE.prompt,
          rateValues: [1, 2, 3, 4, 5, 6, 7],
          minRateDescription: CONFIDENCE_SCALE.minLabel,
          maxRateDescription: CONFIDENCE_SCALE.maxLabel,
          displayMode: "buttons",
          isRequired: true,
        },
      ],
    },
    data: {
      task: "knowledge",
      item_nr: item.nr,
      question: item.question,
      correct_answer: item.correct,
    },
    on_finish: (d) => {
      const r = d.response || {};
      d.chosen_answer = r.answer;
      d.confidence = r.confidence;
      d.is_correct = r.answer === d.correct_answer;
    },
  };
}

let knowledgeTrials = KNOWLEDGE_QUESTIONS.map(buildKnowledgeTrial);
knowledgeTrials = jsPsych.randomization.shuffle(knowledgeTrials);

/* Background questions (fixed order, one page). */
const bakgrunn = {
  type: jsPsychSurvey,
  survey_json: {
    showQuestionNumbers: "off",
    completeText: "Fullfør", // "Finish"
    elements: BACKGROUND_QUESTIONS.map((q) => ({
      type: "radiogroup",
      name: q.name,
      title: q.question,
      choices: q.options,
      isRequired: true,
    })),
  },
  data: { task: "background" },
  on_finish: (d) => {
    d.background = d.response;
  },
};

/* ----------------------------------------------------------------------------
 * 4. Build a clean summary alongside the raw jsPsych trial data
 * ----------------------------------------------------------------------------
 * Proliferate stores whatever object you pass to proliferate.submit(). We
 * send the raw per-trial jsPsych data (one row per page, incl. every
 * SurveyJS response) PLUS this compact summary for convenience. Row format
 * in `summary.r`:
 *   [ question.nr, chosen_option_index, correct(0/1), confidence, rt_ms ]
 * `chosen_option_index` points into the `options` list in questions.js
 * (-1 = not answered). See EXPAND_DATA.md.
 * --------------------------------------------------------------------------*/
function originalIndex(nr, answerText) {
  const item = KNOWLEDGE_QUESTIONS.find((q) => q.nr === nr);
  if (!item) return -1;
  return item.options.indexOf(answerText);
}

function buildSummary() {
  const trials = jsPsych.data.get().filter({ task: "knowledge" }).values();

  const rows = trials.map((t) => ({
    nr: t.item_nr,
    q: t.question,
    svar: t.chosen_answer,
    svar_indeks: originalIndex(t.item_nr, t.chosen_answer),
    fasit: t.correct_answer,
    riktig: t.is_correct ? 1 : 0,
    sikkerhet: t.confidence,
    rt_ms: Math.round(t.rt),
  }));

  const r = rows.map((k) => [
    k.nr,
    k.svar_indeks,
    k.riktig,
    k.sikkerhet,
    k.rt_ms,
  ]);

  const order = rows.map((k) => k.nr);
  const score = rows.reduce((s, k) => s + k.riktig, 0);
  const bg =
    (jsPsych.data.get().filter({ task: "background" }).values()[0] || {})
      .background || {};

  return {
    pid: PID,
    prolific: PROLIFIC,
    start_time: START_ISO,
    end_time: new Date().toISOString(),
    user_agent: navigator.userAgent,
    n_questions: rows.length,
    score: score,
    presentation_order: order,
    background: bg,
    knowledge: rows,
    r: r,
  };
}

/* ----------------------------------------------------------------------------
 * 5. Submit to Proliferate (background, no participant action)
 * ----------------------------------------------------------------------------
 * proliferate.submit() posts the data to Proliferate's server and, on
 * success, shows status in #thanks and redirects to Prolific's completion
 * URL automatically (configured once in Proliferate's admin, not here).
 * See README.md for the Proliferate/Prolific setup steps.
 * --------------------------------------------------------------------------*/
function submitData() {
  const summary = buildSummary();
  const payload = {
    trials: jsPsych.data.get().values(),
    summary: summary,
  };

  /* Local backup - helps if the submission to Proliferate fails. */
  try {
    localStorage.setItem("gk_survey_" + PID, JSON.stringify(payload));
  } catch (e) {}

  const thanks = document.getElementById("thanks");
  if (thanks) thanks.textContent = "Sender inn svarene dine …";

  if (typeof proliferate === "undefined" || !proliferate.submit) {
    /* proliferate.js didn't load (e.g. local test without internet, or the
     * script tag is missing from index.html). Fail safe to the backup. */
    showSubmitFailure(payload, "Fant ikke Proliferate-biblioteket.");
    return;
  }

  proliferate.submit(payload, undefined, (err) => {
    showSubmitFailure(payload, err);
  });
}

function showSubmitFailure(payload, err) {
  const thanks = document.getElementById("thanks");
  if (!thanks) return;
  thanks.innerHTML = `
    <div class="tekst" style="text-align:center">
      <h2>Innsendingen feilet</h2>
      <p>Svarene dine kunne ikke sendes automatisk. Last ned en sikkerhetskopi
         og kontakt forskeren.</p>
      ${
        CONFIG.offerBackupDownload
          ? `<p><button id="last-ned" class="knapp">Last ned svarene (JSON)</button></p>`
          : ""
      }
      <p style="font-size:.85em;color:#666">Deltaker-ID: ${PID}</p>
    </div>`;
  const b = document.getElementById("last-ned");
  if (b) b.addEventListener("click", () => downloadBackup(payload));
  if (err) console.error("Proliferate submit failed:", err);
}

function downloadBackup(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gk_survey_" + PID + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ----------------------------------------------------------------------------
 * 6. Run
 * --------------------------------------------------------------------------*/
const timeline = [informasjon, ...knowledgeTrials, bakgrunn];
jsPsych.run(timeline);
