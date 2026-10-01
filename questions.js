/* ============================================================================
 * questions.js  —  Content for the general-knowledge survey
 * ----------------------------------------------------------------------------
 * This is the file you edit to change wording, add/remove questions, or fix
 * an answer key. Everything else (experiment.js) is the engine.
 *
 * Source: general_knowledge_survey_questions.xlsx
 *   - sheet "Spørsmål"          -> KNOWLEDGE_QUESTIONS (47 items)
 *   - sheet "Bakgrunnsspørsmål" -> BACKGROUND_QUESTIONS (2 items)
 *   - sheet "Informasjon"       -> confidence scale 1 = "not sure at all" ...
 *                                  7 = "completely sure"
 *
 * NOTE: the question/option/scale TEXT is in Norwegian on purpose - that is
 * what participants read. Only the comments and field names are in English.
 *
 * Every knowledge item has a `correct` field (the answer key). It is used
 * ONLY to compute a right/wrong flag in the data - it is never shown to the
 * participant. Double-check it against a reliable source before you collect
 * data.
 * ==========================================================================*/

/* The 1-7 confidence rating shown under every knowledge question.
 * (Norwegian, participant-facing.) */
const CONFIDENCE_SCALE = {
  min: 1,
  max: 7,
  minLabel: "Ikke sikker i det hele tatt", // "Not sure at all"
  maxLabel: "Helt sikker", // "Completely sure"
  prompt: "Hvor sikker er du på svaret ditt?", // "How sure are you of your answer?"
};

/* The 47 general-knowledge questions.
 * The order here is just the source order; the experiment reshuffles it
 * independently for every participant. */
const KNOWLEDGE_QUESTIONS = [
  { nr: 1,  question: "Hvilket grunnstoff har atomnummer 74?", options: ["Wolfram", "Osmium", "Rhenium"], correct: "Wolfram" },
  { nr: 2,  question: "Hvilket land var tidligere kjent som Abyssinia?", options: ["Eritrea", "Etiopia", "Somalia"], correct: "Etiopia" },
  { nr: 3,  question: "Hva er hovedstaden i Mongolia?", options: ["Dushanbe", "Bishkek", "Ulaanbaatar"], correct: "Ulaanbaatar" },
  { nr: 4,  question: "Hvilket organ i menneskekroppen produserer insulin?", options: ["Lever", "Bukspyttkjertel", "Milt"], correct: "Bukspyttkjertel" },
  { nr: 5,  question: "Hvilken romersk keiser bygde en massiv mur tvers over Nord-England?", options: ["Antoninus Pius", "Hadrian", "Trajan"], correct: "Hadrian" },
  { nr: 6,  question: "Hva heter den lengste elven i Asia?", options: ["Yangtze-elven", "Huang He (Guleelven)", "Mekong-elven"], correct: "Yangtze-elven" },
  { nr: 7,  question: "Hvilket land vant det første FIFA-verdensmesterskapet i 1930?", options: ["Brasil", "Tyskland", "Uruguay"], correct: "Uruguay" },
  { nr: 8,  question: "Hvem oppdaget sirkulasjonen av blodet i menneskekroppen?", options: ["Andreas Vesalius", "William Harvey", "Robert Hooke"], correct: "William Harvey" },
  { nr: 9,  question: "Hva var navnet på den første menneskeskapte satellitten som gikk i bane rundt Jorden?", options: ["Explorer 1", "Sputnik 1", "Vostok 1"], correct: "Sputnik 1" },
  { nr: 10, question: "Hvem var den første kvinnelige statsministeren i Storbritannia?", options: ["Theresa May", "Margaret Thatcher", "Indira Gandhi"], correct: "Margaret Thatcher" },
  { nr: 11, question: "Hva heter hovedgassen som befinner seg i jordens atmosfære?", options: ["Oksygen", "Karbondioksid", "Nitrogen"], correct: "Nitrogen" },
  { nr: 12, question: "Hvilken delstat ble først innlemmet i USA etter de tretten opprinnelige koloniene?", options: ["Vermont", "Kentucky", "Tennessee"], correct: "Vermont" },
  { nr: 13, question: "Hvilket år ble den første iPhone lansert?", options: ["2005", "2007", "2009"], correct: "2007" },
  { nr: 14, question: "Hva var det opprinnelige navnet på New York City?", options: ["New Amsterdam", "New Rotterdam", "New Holland"], correct: "New Amsterdam" },
  { nr: 15, question: "Hvilket år ble FN (Forente Nasjoner) grunnlagt?", options: ["1944", "1945", "1948"], correct: "1945" },
  { nr: 16, question: "Hvilket hav er det dypeste?", options: ["Atlanterhavet", "Indiahavet", "Stillehavet"], correct: "Stillehavet" },
  { nr: 17, question: "Hvilken krig introduserte bruk av stridsvogner for første gang?", options: ["Krimkrigen", "Første verdenskrig", "Andre verdenskrig"], correct: "Første verdenskrig" },
  { nr: 18, question: "Hvilket land var det første til å innføre nasjonal stemmerett for kvinner?", options: ["USA", "New Zealand", "Finland"], correct: "New Zealand" },
  { nr: 19, question: "Hva er betegnelsen på frykten for tallet 13?", options: ["Agorafobi", "Triskaidekafobi", "Akrofobi"], correct: "Triskaidekafobi" },
  { nr: 20, question: "Hvilket land har flest naturlige innsjøer?", options: ["Russland", "Canada", "USA"], correct: "Canada" },
  { nr: 21, question: "Hvilken filosof var lærer for Alexander den Store?", options: ["Sokrates", "Platon", "Aristoteles"], correct: "Aristoteles" },
  { nr: 22, question: "Hvilken planet i solsystemet har det korteste året?", options: ["Merkur", "Venus", "Mars"], correct: "Merkur" },
  { nr: 23, question: "Hvilket land oppfant papir?", options: ["Egypt", "Hellas", "Kina"], correct: "Kina" },
  { nr: 24, question: "Hvilket land var først til å bruke krutt i skytevåpen under krig?", options: ["Kina", "Tyrkia (Det osmanske riket)", "Italia"], correct: "Kina" },
  { nr: 25, question: "Hvilket år falt Berlinmuren?", options: ["1987", "1989", "1991"], correct: "1989" },
  { nr: 26, question: "Hvilket grunnstoff har det kjemiske symbolet \"Au\"?", options: ["Sølv", "Aluminium", "Gull"], correct: "Gull" },
  { nr: 27, question: "Hvilken oppdagelsesreisende ledet den første ekspedisjonen som seilte jorden rundt?", options: ["Christopher Columbus", "Ferdinand Magellan", "James Cook"], correct: "Ferdinand Magellan" },
  { nr: 28, question: "Hvilken by var hovedstad i Det bysantinske riket?", options: ["Antiokia", "Nikomedia", "Konstantinopel"], correct: "Konstantinopel" },
  { nr: 29, question: "Hvilket land har flest tidssoner?", options: ["USA", "Russland", "Frankrike"], correct: "Frankrike" },
  { nr: 30, question: "Hva kalles studiet av jordskjelv?", options: ["Geologi", "Seismologi", "Meteorologi"], correct: "Seismologi" },
  { nr: 31, question: "Hvilket land i Latin-Amerika hadde den første kvinnelige presidenten?", options: ["Argentina", "Bolivia", "Chile"], correct: "Argentina" },
  { nr: 32, question: "Hvilket hav er det minste?", options: ["Polhavet", "Atlanterhavet", "Indiahavet"], correct: "Polhavet" },
  { nr: 33, question: "Hvilket oldtidsrike hadde Persepolis som hovedstad?", options: ["Perserriket", "Selevkideriket", "Mederriket"], correct: "Perserriket" },
  { nr: 34, question: "Hva het det første dyret som gikk i bane rundt jorden?", options: ["Laika", "Ham", "Ted"], correct: "Laika" },
  { nr: 35, question: "Hvilket land oppfant fyrverkeri?", options: ["Kina", "Japan", "India"], correct: "Kina" },
  { nr: 36, question: "Hva het den første kvinnen i verdensrommet?", options: ["Sally Ride", "Mae Jemison", "Valentina Teresjkova"], correct: "Valentina Teresjkova" },
  { nr: 37, question: "Hvem malte taket i Det Sixtinske Kapell?", options: ["Leonardo da Vinci", "Michelangelo", "Raphael"], correct: "Michelangelo" },
  { nr: 38, question: "Hvor mange bein pleier et insekt å ha?", options: ["4", "6", "8"], correct: "6" },
  { nr: 39, question: "Hva kalles den økonomiske krisen som startet i USA i 1929?", options: ["Den store resesjonen", "Finanskrisen", "Den store depresjonen"], correct: "Den store depresjonen" },
  { nr: 40, question: "Hvem utviklet World Wide Web (WWW)?", options: ["Bill Gates", "Tim Berners-Lee", "Steve Jobs"], correct: "Tim Berners-Lee" },
  { nr: 41, question: "Hvor mange strenger har en standard akustisk gitar?", options: ["7", "6", "5"], correct: "6" },
  { nr: 42, question: "Hva er hovedstaden i Sverige?", options: ["Gøteborg", "Malmö", "Stockholm"], correct: "Stockholm" },
  { nr: 43, question: "Hvilket språk snakker de fleste i Frankrike?", options: ["Italiensk", "Fransk", "Spansk"], correct: "Fransk" },
  { nr: 44, question: "Hva heter valutaen som brukes i USA?", options: ["Euro", "Dollar", "Pund"], correct: "Dollar" },
  { nr: 45, question: "Hvilket av disse er en frukt?", options: ["Epler", "Gulrot", "Potet"], correct: "Epler" },
  { nr: 46, question: "Hva heter det største landet i verden målt i areal?", options: ["Pakistan", "Russland", "India"], correct: "Russland" },
  { nr: 47, question: "Hvilken by er kjent for gondoler og kanaler i Italia?", options: ["Firenze", "Napoli", "Venezia"], correct: "Venezia" },
];

/* Background questions - shown in a fixed order (never shuffled).
 * `name` becomes the key under which the answer is stored in the data. */
const BACKGROUND_QUESTIONS = [
  {
    name: "morsmal_norsk",
    question: "Er norsk ditt morsmål?", // "Is Norwegian your native language?"
    options: ["Ja", "Nei"],
  },
  {
    name: "utdanning_norge",
    // "Have you completed primary and secondary education in Norway?"
    question: "Har du fullført grunnskole og videregående opplæring i Norge?",
    options: [
      "Ja, begge deler",
      "Bare grunnskole i Norge",
      "Bare videregående opplæring i Norge",
      "Nei",
    ],
  },
];
