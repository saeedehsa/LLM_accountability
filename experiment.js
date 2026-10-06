/* ============================================================================
 * experiment.js  —  General-knowledge survey (jsPsych 8 + Proliferate)
 * ----------------------------------------------------------------------------
 * Flow:
 *   1. Information / consent page
 *   2. 47 knowledge pages (multiple choice + confidence 0-100) in RANDOM ORDER
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
      <p>Takk for at du deltar i denne studien.</p>
      <p>Du skal svare på <strong>47 spørsmål</strong> om allmennkunnskap.
         Etter hvert spørsmål blir du bedt om å oppgi hvor sikker du er på at
         svaret ditt er riktig.</p>
      <p>Følg disse instruksjonene gjennom hele studien:</p>
      <ul>
        <li>Svar på hvert spørsmål ut fra din egen kunnskap.</li>
        <li>Ikke bruk søkemotorer, KI-verktøy eller andre eksterne kilder for
            å finne eller sjekke svar.</li>
        <li>Hvis du ikke vet svaret, gjett så godt du kan i stedet for å slå
            opp svaret.</li>
        <li>Vurder hvert spørsmål for seg, uavhengig av de andre
            spørsmålene.</li>
      </ul>
      <p>Lykke til!</p>
      <!-- RESEARCHER: if your Sikt/REK approval requires specific
           information/consent wording, add or adjust the text above before
           you collect data. Keep it in Norwegian. -->
      <p>Trykk <strong>Start</strong> for å begynne.</p>
    </div>`,
  choices: ["Start"],
  data: { task: "instructions" },
};

/* Build one knowledge page: multiple choice + confidence slider (0-100, starts at 50). */
function buildKnowledgeTrial(item) {
  const options = CONFIG.randomizeOptions
    ? jsPsych.randomization.shuffle([...item.options])
    : item.options;
  const optionsHtml = options
    .map(
      (o) =>
        `<label class="valg"><input type="radio" name="answer" value="${o}" required> ${o}</label>`
    )
    .join("");

  const html = `
    <fieldset class="sporsmal">
      <legend>${item.question}</legend>
      ${optionsHtml}
    </fieldset>
    <div class="sikkerhet">
      <p class="sikkerhet-tittel">${CONFIDENCE_SCALE.prompt}</p>
      <input type="range" name="confidence" min="${CONFIDENCE_SCALE.min}" max="${CONFIDENCE_SCALE.max}" step="1" value="50"
        oninput="document.getElementById('sikkerhet-flyttet').value = '1';">
      <div class="skala-ticks"><span>0</span><span>50</span><span>100</span></div>
      <input type="hidden" name="confidence_moved" id="sikkerhet-flyttet" value="0">
      <p id="sikkerhet-feil" class="feil" hidden>Flytt skyveren for å svare.</p>
    </div>`;

  return {
    type: jsPsychSurveyHtmlForm,
    html: html,
    button_label: "Neste →",
    on_load: () => {
      const form = document.querySelector("form");
      form.addEventListener(
        "submit",
        (e) => {
          if (document.getElementById("sikkerhet-flyttet").value === "1") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          document.getElementById("sikkerhet-feil").hidden = false;
        },
        true
      );
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
      d.confidence = Number(r.confidence);
      d.confidence_moved = r.confidence_moved === "1";
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
    elements: [
      {
        type: "html",
        // "Thank you for your time. Please answer the questions below about yourself."
        html: "<p>Takk for at du tar deg tid. Vennligst svar på spørsmålene nedenfor om deg selv.</p>",
      },
      ...BACKGROUND_QUESTIONS.map((q) => ({
        type: "radiogroup",
        name: q.name,
        title: q.question,
        choices: q.options,
        isRequired: true,
      })),
    ],
  },
  data: { task: "background" },
  on_finish: (d) => {
    d.background = d.response;
  },
};

/* ----------------------------------------------------------------------------
 * 4. Shape the data for Proliferate's automatic CSV export
 * ----------------------------------------------------------------------------
 * Proliferate turns each TOP-LEVEL key of the object passed to
 * proliferate.submit() into its own CSV file:
 *   - a key whose value is a LIST   -> one CSV, one row PER LIST ELEMENT
 *   - a key whose value is an OBJECT -> one CSV, one row PER PARTICIPANT
 * It also adds workerid / condition / error columns to every file.
 * Nested objects/arrays INSIDE a list element are not a documented case, so
 * every object below is kept flat (no nested objects/arrays) to get clean,
 * ready-to-use columns straight out of the Proliferate "Download data" CSVs
 * -> "<experiment>-knowledge.csv" and "<experiment>-participant.csv".
 * See EXPAND_DATA.md.
 * --------------------------------------------------------------------------*/
function originalIndex(nr, answerText) {
  const item = KNOWLEDGE_QUESTIONS.find((q) => q.nr === nr);
  if (!item) return -1;
  return item.options.indexOf(answerText);
}

/* LIST -> "<experiment>-knowledge.csv", one row per question per participant. */
function buildKnowledgeRows() {
  const trials = jsPsych.data.get().filter({ task: "knowledge" }).values();
  return trials.map((t) => ({
    pid: PID,
    nr: t.item_nr,
    question: t.question,
    chosen_answer: t.chosen_answer,
    chosen_option_index: originalIndex(t.item_nr, t.chosen_answer),
    correct_answer: t.correct_answer,
    is_correct: t.is_correct ? 1 : 0,
    confidence: t.confidence,
    confidence_moved: t.confidence_moved ? 1 : 0,
    rt_ms: Math.round(t.rt),
  }));
}

/* OBJECT (flat) -> "<experiment>-participant.csv", one row per participant. */
function buildParticipantRow(knowledgeRows) {
  const order = knowledgeRows.map((k) => k.nr);
  const score = knowledgeRows.reduce((s, k) => s + k.is_correct, 0);
  const bg =
    (jsPsych.data.get().filter({ task: "background" }).values()[0] || {})
      .background || {};

  return {
    pid: PID,
    prolific_pid: PROLIFIC.pid,
    study_id: PROLIFIC.study_id,
    session_id: PROLIFIC.session_id,
    start_time: START_ISO,
    end_time: new Date().toISOString(),
    user_agent: navigator.userAgent,
    n_questions: knowledgeRows.length,
    score: score,
    presentation_order: order.join(","), // kept as a string, not an array
    morsmal_norsk: bg.morsmal_norsk || "",
    utdanning_norge: bg.utdanning_norge || "",
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
  const knowledge = buildKnowledgeRows();
  const participant = buildParticipantRow(knowledge);
  const payload = {
    knowledge: knowledge, // LIST -> knowledge.csv (one row per question)
    participant: participant, // OBJECT -> participant.csv (one row per participant)
    trials: jsPsych.data.get().values(), // LIST -> trials.csv, raw jsPsych backup
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
