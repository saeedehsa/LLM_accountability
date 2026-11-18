/* ============================================================================
 * experiment.js  —  General-knowledge survey (jsPsych 8 + Proliferate)
 * ----------------------------------------------------------------------------
 * Flow:
 *   0. Consent page (EMPTY for now - Sikt-approved text goes in SAMTYKKE_HTML)
 *   1. Instructions page
 *   2. 47 knowledge pages (choice + "Hvorfor?" + confidence 0-100 %) in RANDOM
 *      ORDER, with Previous/Next navigation (steps 1-2 run as one jsPsych trial)
 *      - the order is unique per participant and is saved in the data
 *      - changing an answer resets that page's "Hvorfor?" text and slider;
 *        the first complete response is saved next to the final one
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

  /* Minimum length of the "Hvorfor?" answer, in characters. Spaces inside
   * the text count; spaces at the very start/end do not. */
  minExplanationChars: 30,
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
  message_progress_bar: "Fremdrift", // "Progress"
  auto_update_progress_bar: false, // set by settFremdrift(), since the questions are one trial
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

/* Consent page, shown before everything else. Left EMPTY on purpose: add the
 * Sikt-approved information letter and consent wording here once the study is
 * approved (in Norwegian), and change the button label if needed.            */
const SAMTYKKE_HTML = `
    <div class="tekst">
      <!-- RESEARCHER: Sikt-approved information and consent text goes here. -->
    </div>`;

const samtykke = {
  type: jsPsychHtmlButtonResponse,
  stimulus: SAMTYKKE_HTML,
  choices: ["Neste"], // "Next"
  data: { task: "consent" },
  on_start: () => settFremdrift(0),
};

/* Instructions page. Participant-facing text is Norwegian. */
const INFORMASJON_HTML = `
    <div class="tekst">
      <p>Takk for at du deltar i denne studien.</p>
      <p>Nedenfor skal du svare på noen spørsmål om allmennkunnskap. Noen er
         ganske enkle, andre er vanskelige. Tenk deg at en venn har stilt deg
         spørsmålet og skal bruke svaret ditt. Svar slik du naturlig ville gjort
         i en samtale: bruk dine egne ord, forklar hvorfor du svarer som du gjør,
         og få frem hvor mye vennen din kan stole på svaret. Gi ditt beste svar
         selv om du ikke er helt sikker.
         <strong>Svaret bør være kort, mellom to og seks setninger.</strong></p>
      <p>Ikke bruk søkemotorer, KI-verktøy eller andre eksterne kilder for å
         finne eller sjekke svar.</p>
      <p>Trykk <strong>Start</strong> for å begynne.</p>
    </div>`;

/* The instructions and all knowledge questions run as ONE jsPsych trial with
 * its own Previous/Next navigation, so participants can go back and change
 * earlier answers. Page 0 = instructions, page i (1..N) = SIDER[i - 1].
 * Each entry keeps the participant's current answers for that question, in
 * presentation order (random per participant, options shuffled once).       */
const SIDER = jsPsych.randomization.shuffle([...KNOWLEDGE_QUESTIONS]).map((item) => ({
  item: item,
  options: CONFIG.randomizeOptions
    ? jsPsych.randomization.shuffle([...item.options])
    : item.options,
  answer: null,
  explanation: "",
  confidence: 0,
  confidence_moved: false,
  time_ms: 0, // total time spent on this page, summed over visits
  visits: 0,
  paste_attempts: 0, // blocked paste/drop attempts in the "Hvorfor?" box
  n_leaves: 0, // times the participant left the page (other tab/window/app)
  n_tab_hidden: 0, // times the tab itself was hidden (tab switch, minimise)
  time_away_ms: 0, // total time away while on this page (included in time_ms)
  first: null, // first complete response {answer, explanation, confidence}, saved on the first Neste
  n_answer_switches: 0, // times the chosen answer was switched to a different option
  n_undo: 0, // times "Angre" was used to bring back the previous answer after a switch
}));

/* -1 = consent, 0 = instructions, 1..N = SIDER[i - 1],
 * null = after the knowledge pages (background questions). */
let aktivSide = -1;
let sideStart = 0;

/* ----------------------------------------------------------------------------
 * Tab-switch / focus tracking
 * ----------------------------------------------------------------------------
 * "Away" starts when the tab is hidden (tab switch, minimise) OR the window
 * loses focus (e.g. clicking into another app or window placed side by side),
 * and ends when the page is both visible and focused again. Counts and time
 * away are attributed to the page shown when the participant left. Every raw
 * event is also logged, with the page and time since the experiment started.
 * --------------------------------------------------------------------------*/
const FOKUS = {
  events: [], // raw log -> "<experiment>-focus_events.csv"
  away: false,
  awayStart: 0,
  awaySide: null, // page shown when the participant left
  // totals outside the knowledge pages (instructions, background questions)
  other: { n_leaves: 0, n_tab_hidden: 0, time_away_ms: 0 },
};

function sideEtikett(side) {
  if (side === -1) return "consent";
  if (side === 0) return "instructions";
  if (side > 0) return String(SIDER[side - 1].item.nr);
  return "background";
}

function fokusMal(side) {
  return side > 0 ? SIDER[side - 1] : FOKUS.other;
}

function loggFokus(e) {
  const t = performance.now();
  const type = e.type === "visibilitychange" ? (document.hidden ? "hidden" : "visible") : e.type;
  FOKUS.events.push({
    pid: PID,
    event: type,
    page: sideEtikett(aktivSide),
    t_ms: Math.round(t),
  });
  if (type === "hidden") fokusMal(aktivSide).n_tab_hidden += 1;

  const borte = document.hidden || !document.hasFocus();
  if (borte && !FOKUS.away) {
    FOKUS.away = true;
    FOKUS.awayStart = t;
    FOKUS.awaySide = aktivSide;
    fokusMal(aktivSide).n_leaves += 1;
  } else if (!borte && FOKUS.away) {
    avsluttBorte(t);
  }
}

function avsluttBorte(t) {
  if (!FOKUS.away) return;
  FOKUS.away = false;
  fokusMal(FOKUS.awaySide).time_away_ms += t - FOKUS.awayStart;
}

document.addEventListener("visibilitychange", loggFokus);
window.addEventListener("blur", loggFokus);
window.addEventListener("focus", loggFokus);

/* Warn before the page is left (browser back button, closing the tab,
 * reloading): leaving loses all answers. Removed just before submission, so
 * the redirect to Prolific is not blocked. */
function advarOmForlating(e) {
  e.preventDefault();
  e.returnValue = ""; // older browsers need this to show the warning
}
window.addEventListener("beforeunload", advarOmForlating);

/* Progress steps: 0 = consent, 1 = instructions, 2..N+1 = knowledge pages,
 * N+2 = background questions. */
function settFremdrift(steg) {
  if (CONFIG.showProgressBar && jsPsych.progressBar) {
    jsPsych.progressBar.progress = steg / (SIDER.length + 3);
  }
}

/* Shows page i, after adding the time spent on the page being left. */
function visSide(i) {
  if (aktivSide > 0) SIDER[aktivSide - 1].time_ms += performance.now() - sideStart;
  aktivSide = i;
  sideStart = performance.now();
  settFremdrift(i + 1);

  const rot = document.getElementById("sider");
  if (i === 0) {
    rot.innerHTML = `${INFORMASJON_HTML}
      <div class="navigasjon"><span></span><button type="button" class="jspsych-btn" id="neste">Start</button></div>`;
    document.getElementById("neste").addEventListener("click", () => visSide(1));
  } else {
    visSporsmal(rot, SIDER[i - 1], i);
  }
  window.scrollTo(0, 0);
}

/* True when the "Hvorfor?" text is long enough. */
function langNok(tekst) {
  return tekst.trim().length >= CONFIG.minExplanationChars;
}

/* Builds one knowledge page: multiple choice, then "why?" text, then
 * confidence slider (0-100, starts at 0). Parts are revealed in turn and
 * stay visible when the participant comes back to the page.               */
function visSporsmal(rot, s, i) {
  s.visits += 1;
  const optionsHtml = s.options
    .map(
      (o, k) =>
        `<label class="valg"><input type="radio" name="answer" value="${k}"${s.answer === o ? " checked" : ""}> ${o}</label>`
    )
    .join("");

  rot.innerHTML = `
    <fieldset class="sporsmal">
      <legend>${s.item.question}</legend>
      ${optionsHtml}
      <p id="svar-feil" class="feil" hidden>Velg ett svar før du går videre.</p>
      <p id="endret-info" class="info" hidden>Du har endret svaret ditt. Skriv på nytt hvorfor, og vurder hvor sikker du er.
        <button type="button" id="angre" class="lenke-knapp">Angre</button></p>
    </fieldset>
    <div id="hvorfor-del" class="hvorfor"${s.answer === null ? " hidden" : ""}>
      <label for="hvorfor" class="sikkerhet-tittel">Hvorfor?</label>
      <textarea id="hvorfor" rows="5" autocomplete="off"></textarea>
      <p id="lim-feil" class="feil" hidden>Det er ikke mulig å lime inn tekst her. Skriv svaret med dine egne ord.</p>
      <p id="hvorfor-feil" class="feil" hidden>Skriv minst ${CONFIG.minExplanationChars} tegn før du går videre.</p>
    </div>
    <div id="sikkerhet-del" class="sikkerhet"${!langNok(s.explanation) ? " hidden" : ""}>
      <p class="sikkerhet-tittel">${CONFIDENCE_SCALE.prompt}</p>
      <div class="skala-wrap">
        <input type="range" id="sikkerhet" min="${CONFIDENCE_SCALE.min}" max="${CONFIDENCE_SCALE.max}" step="1" value="${s.confidence}">
      </div>
      <div class="skala-ticks"><span>0 %</span><span>50 %</span><span>100 %</span></div>
      <p id="sikkerhet-feil" class="feil" hidden>Flytt skyveren for å svare.</p>
    </div>
    <div class="navigasjon">
      <button type="button" class="jspsych-btn" id="forrige">← Forrige</button>
      <button type="button" class="jspsych-btn" id="neste">${i === SIDER.length ? "Ferdig →" : "Neste →"}</button>
    </div>`;

  const hvorfor = document.getElementById("hvorfor");
  const skyver = document.getElementById("sikkerhet");
  hvorfor.value = s.explanation; // set as a property, so no HTML escaping needed

  /* The question and answer options can't be copied: no text selection (see
   * .sporsmal in style.css), and copy/cut, the right-click menu and dragging
   * text out are blocked as well. Attempts are not recorded. */
  const sporsmal = rot.querySelector(".sporsmal");
  ["copy", "cut", "contextmenu", "dragstart", "selectstart"].forEach((t) =>
    sporsmal.addEventListener(t, (e) => e.preventDefault())
  );

  /* Switching to a different answer clears the "Hvorfor?" text and resets the
   * slider, so the explanation and confidence always belong to the final
   * answer. (The first complete response is kept separately in s.first.)
   * The cleared state is kept in `angre`, so the "Angre" (undo) button can
   * bring back the previous answer, text and slider after an accidental click.
   * It stays available until the participant leaves the page. */
  let angre = null;
  rot.querySelectorAll("input[name=answer]").forEach((r) =>
    r.addEventListener("change", () => {
      const nytt = s.options[Number(r.value)];
      if (s.answer !== null && nytt !== s.answer) {
        s.n_answer_switches += 1;
        if (s.explanation !== "" || s.confidence_moved) {
          angre = {
            answer: s.answer,
            explanation: s.explanation,
            confidence: s.confidence,
            confidence_moved: s.confidence_moved,
          };
          s.explanation = "";
          s.confidence = 0;
          s.confidence_moved = false;
          hvorfor.value = "";
          skyver.value = 0;
          document.getElementById("sikkerhet-del").hidden = true;
          document.getElementById("hvorfor-feil").hidden = true;
          document.getElementById("sikkerhet-feil").hidden = true;
          document.getElementById("endret-info").hidden = false;
        }
      }
      s.answer = nytt;
      document.getElementById("svar-feil").hidden = true;
      document.getElementById("hvorfor-del").hidden = false;
    })
  );
  document.getElementById("angre").addEventListener("click", () => {
    if (!angre) return;
    Object.assign(s, angre);
    s.n_undo += 1;
    angre = null;
    rot.querySelectorAll("input[name=answer]").forEach((r) => {
      r.checked = s.options[Number(r.value)] === s.answer;
    });
    hvorfor.value = s.explanation;
    skyver.value = s.confidence;
    document.getElementById("sikkerhet-del").hidden = !langNok(s.explanation);
    ["endret-info", "hvorfor-feil", "sikkerhet-feil", "lim-feil"].forEach(
      (id) => (document.getElementById(id).hidden = true)
    );
  });
  /* No pasting or drag-and-drop into the "Hvorfor?" box (keyboard shortcut,
   * right-click menu, or dragging text in). Attempts are counted. */
  const blokkerLiming = (e) => {
    e.preventDefault();
    s.paste_attempts += 1;
    document.getElementById("lim-feil").hidden = false;
  };
  hvorfor.addEventListener("paste", blokkerLiming);
  hvorfor.addEventListener("drop", blokkerLiming);
  hvorfor.addEventListener("beforeinput", (e) => {
    if (["insertFromPaste", "insertFromPasteAsQuotation", "insertFromDrop"].includes(e.inputType)) {
      blokkerLiming(e);
    }
  });
  hvorfor.addEventListener("input", () => {
    s.explanation = hvorfor.value;
    document.getElementById("lim-feil").hidden = true;
    if (langNok(s.explanation)) {
      document.getElementById("hvorfor-feil").hidden = true;
      document.getElementById("sikkerhet-del").hidden = false;
    }
  });
  /* Marks the slider as touched (pointer, input, or arrow keys). The value itself is not shown. */
  const taster = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
  const flyttet = (e) => {
    if (e.type === "keydown" && !taster.includes(e.key)) return;
    s.confidence_moved = true;
    s.confidence = Number(skyver.value);
    document.getElementById("sikkerhet-feil").hidden = true;
  };
  ["pointerdown", "input", "keydown"].forEach((t) => skyver.addEventListener(t, flyttet));
  skyver.addEventListener("change", () => (s.confidence = Number(skyver.value)));

  document.getElementById("forrige").addEventListener("click", () => visSide(i - 1));
  document.getElementById("neste").addEventListener("click", () => {
    s.confidence = Number(skyver.value);
    if (s.answer === null) {
      document.getElementById("svar-feil").hidden = false;
    } else if (!langNok(s.explanation)) {
      document.getElementById("hvorfor-feil").hidden = false;
      hvorfor.focus();
    } else if (!s.confidence_moved) {
      document.getElementById("sikkerhet-feil").hidden = false;
    } else {
      if (s.first === null) {
        s.first = {
          answer: s.answer,
          explanation: s.explanation.trim(),
          confidence: s.confidence,
        };
      }
      gaaVidere();
    }
  });

  function gaaVidere() {
    if (i < SIDER.length) {
      visSide(i + 1);
    } else {
      s.time_ms += performance.now() - sideStart;
      aktivSide = null; // focus events from here on count as "background"
      jsPsych.finishTrial({ task: "knowledge_pages" });
    }
  }
}

const sider = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<div id="sider"></div>`,
  choices: [], // navigation buttons are drawn by visSide()
  on_load: () => visSide(0),
  data: { task: "knowledge_pages" },
};

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
  on_start: () => settFremdrift(SIDER.length + 2),
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
  return SIDER.map((s) => {
    const f = s.first || { answer: s.answer, explanation: s.explanation.trim(), confidence: s.confidence };
    return {
      pid: PID,
      nr: s.item.nr,
      question: s.item.question,
      chosen_answer: s.answer,
      chosen_option_index: originalIndex(s.item.nr, s.answer),
      correct_answer: s.item.correct,
      is_correct: s.answer === s.item.correct ? 1 : 0,
      explanation: s.explanation.trim(),
      confidence: s.confidence,
      confidence_moved: s.confidence_moved ? 1 : 0,
      rt_ms: Math.round(s.time_ms), // total time on the page, summed over visits
      n_visits: s.visits,
      paste_attempts: s.paste_attempts,
      n_leaves: s.n_leaves,
      n_tab_hidden: s.n_tab_hidden,
      time_away_ms: Math.round(s.time_away_ms),
      // first complete response (when Neste was first pressed on this page)
      first_answer: f.answer,
      first_is_correct: f.answer === s.item.correct ? 1 : 0,
      first_explanation: f.explanation,
      first_confidence: f.confidence,
      answer_changed: f.answer !== s.answer ? 1 : 0,
      explanation_changed: f.explanation !== s.explanation.trim() ? 1 : 0,
      confidence_changed: f.confidence !== s.confidence ? 1 : 0,
      n_answer_switches: s.n_answer_switches, // includes switches before the first Neste
      n_undo: s.n_undo, // switches taken back with "Angre"
    };
  });
}

/* OBJECT (flat) -> "<experiment>-participant.csv", one row per participant. */
function buildParticipantRow(knowledgeRows) {
  const order = knowledgeRows.map((k) => k.nr);
  const score = knowledgeRows.reduce((s, k) => s + k.is_correct, 0);
  const sum = (key) => knowledgeRows.reduce((s, k) => s + k[key], 0);
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
    paste_attempts_total: sum("paste_attempts"),
    n_answers_changed: sum("answer_changed"), // questions whose final answer differs from the first
    first_score: sum("first_is_correct"),
    n_undo_total: sum("n_undo"),
    // knowledge pages only
    n_leaves_questions: sum("n_leaves"),
    n_tab_hidden_questions: sum("n_tab_hidden"),
    time_away_ms_questions: sum("time_away_ms"),
    // instructions + background questions
    n_leaves_other: FOKUS.other.n_leaves,
    n_tab_hidden_other: FOKUS.other.n_tab_hidden,
    time_away_ms_other: Math.round(FOKUS.other.time_away_ms),
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
  window.removeEventListener("beforeunload", advarOmForlating); // let Proliferate redirect
  avsluttBorte(performance.now()); // close an away period still open at the end
  const knowledge = buildKnowledgeRows();
  const participant = buildParticipantRow(knowledge);
  const payload = {
    knowledge: knowledge, // LIST -> knowledge.csv (one row per question)
    participant: participant, // OBJECT -> participant.csv (one row per participant)
    focus_events: FOKUS.events, // LIST -> focus_events.csv (one row per event)
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
const timeline = [samtykke, sider, bakgrunn];
jsPsych.run(timeline);
