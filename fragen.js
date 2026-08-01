const questionPageEl = document.querySelector("#question-page");
const categoryButtonsEl = document.querySelector("#category-buttons");
const resultEl = document.querySelector(".question-result");
const categoryEl = document.querySelector("#question-category");
const questionEl = document.querySelector("#question-text");
const statusEl = document.querySelector("#question-status");
const drawAgainButton = document.querySelector("#draw-again");
const chooseCategoryButton = document.querySelector("#choose-category");
const copyLinkButton = document.querySelector("#copy-link");
const participantWaitingEl = document.querySelector("#participant-waiting");
const participantWaitingTextEl = document.querySelector("#participant-waiting-text");
const rotationInstructionEl = document.querySelector("#rotation-instruction");

const timerSetupEl = document.querySelector("#timer-setup");
const timerWaitingEl = document.querySelector("#timer-waiting");
const timerRunningEl = document.querySelector("#timer-running");
const timerDisplayEl = document.querySelector("#timer-display");
const timerProgressEl = document.querySelector("#timer-progress");
const timerTrackEl = document.querySelector(".timer-track");
const timerStopButton = document.querySelector("#timer-stop");
const timerChoiceButtons = [...document.querySelectorAll("[data-minutes]")];
const moderatorOnlyEls = [...document.querySelectorAll("[data-moderator-only]")];

const ROLE_STORAGE_KEY = "oops-speeddating-role";
const PARTICIPANT_VIEW = "participant";

let categories = [];
let currentCategory = null;
let currentQuestionIndex = -1;

let timerDurationMs = 0;
let timerEndMs = 0;
let timerIntervalId = null;

function readStoredRole() {
  try {
    return sessionStorage.getItem(ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeRole(role) {
  try {
    sessionStorage.setItem(ROLE_STORAGE_KEY, role);
  } catch {
    // Die Seite funktioniert auch ohne Session Storage.
  }
}

function resolveModeratorRole() {
  const view = new URLSearchParams(location.search).get("view");

  if (view === PARTICIPANT_VIEW) {
    storeRole(PARTICIPANT_VIEW);
    return false;
  }

  if (!location.hash) {
    storeRole("moderator");
    return true;
  }

  return readStoredRole() === "moderator";
}

const isModerator = resolveModeratorRole();
document.body.classList.toggle("moderator-view", isModerator);
document.body.classList.toggle("participant-view", !isModerator);

for (const element of moderatorOnlyEls) {
  element.hidden = !isModerator;
}

function parseQuestions(markdown) {
  const parsed = [];
  let current = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    const heading = line.match(/^##\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/i);
    const item = line.match(/^[-*]\s+(.+)$/);

    if (heading) {
      const title = heading[1].trim();
      const explicitSlug = heading[2];
      const slug = explicitSlug || slugify(title);
      current = { title, slug, questions: [] };
      parsed.push(current);
    } else if (item && current) {
      current.questions.push(item[1].trim());
    }
  }

  return parsed.filter(category => category.questions.length > 0);
}

function slugify(value) {
  return value
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomIndex(length, excludedIndex = -1) {
  if (length <= 1) return 0;

  let index;
  do {
    index = Math.floor(Math.random() * length);
  } while (index === excludedIndex);

  return index;
}

function renderCategories() {
  if (!categoryButtonsEl) return;

  categoryButtonsEl.replaceChildren();

  for (const category of categories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-choice";
    button.dataset.slug = category.slug;

    const title = document.createElement("span");
    title.textContent = category.title;

    const count = document.createElement("small");
    count.textContent = `${category.questions.length} Fragen`;

    button.append(title, count);
    button.addEventListener("click", () => showRandomQuestion(category));
    categoryButtonsEl.append(button);
  }
}

function showRandomQuestion(category) {
  if (!isModerator) return;

  const previousIndex = currentCategory?.slug === category.slug ? currentQuestionIndex : -1;
  const index = randomIndex(category.questions.length, previousIndex);
  stopTimer({ updateHash: false });
  showQuestion(category, index, true);
}

function showQuestion(category, index, updateHash) {
  if (!category || index < 0 || index >= category.questions.length) return false;

  currentCategory = category;
  currentQuestionIndex = index;

  categoryEl.textContent = category.title;
  questionEl.textContent = category.questions[index];
  participantWaitingEl.hidden = true;
  resultEl.hidden = false;
  questionPageEl.classList.add("question-shown");
  rotationInstructionEl.hidden = true;
  statusEl.textContent = "";

  if (updateHash) {
    writeHash();
  }

  document.title = `[OOPS] ${category.title} – Frage ${index + 1}`;
  return true;
}

function getQuestionHashBase() {
  if (!currentCategory || currentQuestionIndex < 0) return "";
  return `${currentCategory.slug}-${currentQuestionIndex + 1}`;
}

function writeHash() {
  const base = getQuestionHashBase();
  if (!base) return;

  const params = new URLSearchParams();
  if (timerEndMs > 0 && timerDurationMs > 0) {
    params.set("duration", String(Math.round(timerDurationMs / 60000)));
    params.set("end", String(timerEndMs));
  }

  const query = params.toString();
  history.replaceState(null, "", `#${base}${query ? `?${query}` : ""}`);
}

function parseHash() {
  const raw = decodeURIComponent(location.hash.slice(1)).trim();
  if (!raw) return false;

  const [questionPart, queryPart = ""] = raw.split("?");
  const match = questionPart.match(/^([a-z0-9-]+)-(\d+)$/i);
  if (!match) return false;

  const slug = match[1].toLowerCase();
  const questionNumber = Number.parseInt(match[2], 10);
  const category = categories.find(item => item.slug === slug);

  if (!category || !Number.isInteger(questionNumber)) return false;

  const shown = showQuestion(category, questionNumber - 1, false);
  if (!shown) return false;

  const params = new URLSearchParams(queryPart);
  const durationMinutes = Number.parseInt(params.get("duration"), 10);
  const endMs = Number.parseInt(params.get("end"), 10);

  if ([1, 2, 3, 5].includes(durationMinutes) && Number.isFinite(endMs) && endMs > 0) {
    resumeTimer(durationMinutes, endMs);
  } else {
    stopTimer({ updateHash: false });
  }

  return true;
}

function showParticipantWaiting(message) {
  clearTimerInterval();
  currentCategory = null;
  currentQuestionIndex = -1;
  questionPageEl.classList.remove("question-shown");
  resultEl.hidden = true;
  participantWaitingEl.hidden = false;
  participantWaitingTextEl.textContent = message;
  document.title = "[OOPS] Auf die nächste Frage warten";
}

function resetToCategories() {
  if (!isModerator) return;

  stopTimer({ updateHash: false });
  currentCategory = null;
  currentQuestionIndex = -1;
  questionPageEl.classList.remove("question-shown");
  resultEl.hidden = true;
  participantWaitingEl.hidden = true;
  statusEl.textContent = "";
  history.replaceState(null, "", location.pathname);
  document.title = "[OOPS] Speeddating-Frage";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTimer(minutes) {
  if (!isModerator) return;

  timerDurationMs = minutes * 60 * 1000;
  timerEndMs = Date.now() + timerDurationMs;
  activateTimerUi();
  writeHash();
  updateTimer();
  timerIntervalId = window.setInterval(updateTimer, 250);
  statusEl.textContent = "Der Teilnehmer-Link enthält jetzt Frage und gemeinsamen Endzeitpunkt.";
}

function resumeTimer(minutes, endMs) {
  clearTimerInterval();
  timerDurationMs = minutes * 60 * 1000;
  timerEndMs = endMs;
  activateTimerUi();
  updateTimer();

  if (Date.now() < timerEndMs) {
    timerIntervalId = window.setInterval(updateTimer, 250);
  }
}

function activateTimerUi() {
  timerSetupEl.hidden = true;
  timerWaitingEl.hidden = true;
  timerRunningEl.hidden = false;
  rotationInstructionEl.hidden = true;
  document.body.classList.remove("timer-finished");
}

function finishTimer() {
  clearTimerInterval();
  timerDisplayEl.textContent = "00:00";
  timerProgressEl.style.width = "0%";
  timerTrackEl.setAttribute("aria-valuenow", "0");
  document.body.classList.add("timer-finished");
  rotationInstructionEl.hidden = false;
  statusEl.textContent = isModerator
    ? "Die Gesprächszeit ist abgelaufen. Gruppe 2 wechselt jetzt einen Channel nach unten."
    : "Zeit! Wechselt jetzt wie angezeigt und wartet danach auf die nächste Frage.";
}

function updateTimer() {
  const remainingMs = Math.max(0, timerEndMs - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ratio = timerDurationMs > 0 ? Math.max(0, Math.min(1, remainingMs / timerDurationMs)) : 0;
  const percent = Math.round(ratio * 100);

  timerDisplayEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timerProgressEl.style.width = `${percent}%`;
  timerTrackEl.setAttribute("aria-valuenow", String(percent));

  if (remainingMs <= 0) {
    finishTimer();
  }
}

function stopTimer({ updateHash = true } = {}) {
  clearTimerInterval();
  timerDurationMs = 0;
  timerEndMs = 0;
  timerSetupEl.hidden = !isModerator;
  timerWaitingEl.hidden = isModerator;
  timerRunningEl.hidden = true;
  rotationInstructionEl.hidden = true;
  document.body.classList.remove("timer-finished");
  timerDisplayEl.textContent = "00:00";
  timerProgressEl.style.width = "100%";
  timerTrackEl.setAttribute("aria-valuenow", "100");
  statusEl.textContent = "";

  if (updateHash && currentCategory && isModerator) {
    writeHash();
  }
}

function clearTimerInterval() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function buildParticipantUrl() {
  writeHash();
  const url = new URL(location.href);
  url.searchParams.set("view", PARTICIPANT_VIEW);
  return url;
}

async function copyQuestionLink() {
  if (!isModerator || !currentCategory || currentQuestionIndex < 0) return;

  const url = buildParticipantUrl();

  try {
    await navigator.clipboard.writeText(url.toString());
    statusEl.textContent = timerEndMs > 0
      ? "Teilnehmer-Link mit Frage und laufendem Timer kopiert. Jetzt im Hauptchannel einfügen."
      : "Teilnehmer-Link zur Frage kopiert. Für einen gemeinsamen Countdown zuerst den Timer starten.";
  } catch {
    statusEl.textContent = `Teilnehmer-Link: ${url.toString()}`;
  }
}

async function loadQuestions() {
  try {
    const response = await fetch("fragen.md", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    categories = parseQuestions(await response.text());
    if (!categories.length) {
      throw new Error("Keine Fragen gefunden");
    }

    if (isModerator) {
      renderCategories();
    }

    if (location.hash) {
      if (!parseHash()) {
        if (isModerator) {
          statusEl.textContent = "Der verlinkte Frage-Code wurde nicht gefunden. Bitte wähle eine Kategorie.";
          history.replaceState(null, "", location.pathname);
        } else {
          showParticipantWaiting("Der Link ist ungültig oder unvollständig. Wartet auf einen neuen Link der Moderation.");
        }
      }
    } else if (!isModerator) {
      showParticipantWaiting("Die Moderation veröffentlicht den Link zur gemeinsamen Frage im Discord-Hauptchannel.");
    }
  } catch (error) {
    console.error(error);
    if (isModerator && categoryButtonsEl) {
      categoryButtonsEl.innerHTML =
        '<p class="status">Die Fragen konnten nicht geladen werden. Bitte prüfe fragen.md.</p>';
    } else {
      showParticipantWaiting("Die Fragen konnten gerade nicht geladen werden. Bitte informiert die Eventleitung.");
    }
  }
}

if (drawAgainButton) {
  drawAgainButton.addEventListener("click", () => {
    if (currentCategory) showRandomQuestion(currentCategory);
  });
}

if (chooseCategoryButton) {
  chooseCategoryButton.addEventListener("click", resetToCategories);
}

if (copyLinkButton) {
  copyLinkButton.addEventListener("click", copyQuestionLink);
}

if (timerStopButton) {
  timerStopButton.addEventListener("click", () => stopTimer());
}

for (const button of timerChoiceButtons) {
  button.addEventListener("click", () => {
    const minutes = Number.parseInt(button.dataset.minutes, 10);
    if ([1, 2, 3, 5].includes(minutes)) startTimer(minutes);
  });
}

window.addEventListener("hashchange", () => {
  if (!parseHash() && !isModerator) {
    showParticipantWaiting("Wartet auf den nächsten gültigen Fragen-Link der Moderation.");
  }
});
window.addEventListener("beforeunload", clearTimerInterval);

loadQuestions();
