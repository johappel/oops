const questionPageEl = document.querySelector("#question-page");
const categoryButtonsEl = document.querySelector("#category-buttons");
const resultEl = document.querySelector(".question-result");
const categoryEl = document.querySelector("#question-category");
const questionEl = document.querySelector("#question-text");
const statusEl = document.querySelector("#question-status");
const drawAgainButton = document.querySelector("#draw-again");
const chooseCategoryButton = document.querySelector("#choose-category");
const copyLinkButton = document.querySelector("#copy-link");

const timerSetupEl = document.querySelector("#timer-setup");
const timerRunningEl = document.querySelector("#timer-running");
const timerDisplayEl = document.querySelector("#timer-display");
const timerProgressEl = document.querySelector("#timer-progress");
const timerTrackEl = document.querySelector(".timer-track");
const timerStopButton = document.querySelector("#timer-stop");
const timerChoiceButtons = [...document.querySelectorAll("[data-minutes]")];

let categories = [];
let currentCategory = null;
let currentQuestionIndex = -1;

let timerDurationMs = 0;
let timerEndMs = 0;
let timerIntervalId = null;

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
  resultEl.hidden = false;
  questionPageEl.classList.add("question-shown");
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

  if ([2, 3, 5].includes(durationMinutes) && Number.isFinite(endMs) && endMs > 0) {
    resumeTimer(durationMinutes, endMs);
  } else {
    stopTimer({ updateHash: false });
  }

  return true;
}

function resetToCategories() {
  stopTimer({ updateHash: false });
  currentCategory = null;
  currentQuestionIndex = -1;
  questionPageEl.classList.remove("question-shown");
  resultEl.hidden = true;
  statusEl.textContent = "";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  document.title = "[OOPS] Speeddating-Frage";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTimer(minutes) {
  timerDurationMs = minutes * 60 * 1000;
  timerEndMs = Date.now() + timerDurationMs;
  activateTimerUi();
  writeHash();
  updateTimer();
  timerIntervalId = window.setInterval(updateTimer, 250);
  statusEl.textContent = "Der Link enthält jetzt den gemeinsamen Endzeitpunkt.";
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
  timerRunningEl.hidden = false;
  document.body.classList.remove("timer-finished");
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
    clearTimerInterval();
    timerDisplayEl.textContent = "00:00";
    timerProgressEl.style.width = "0%";
    timerTrackEl.setAttribute("aria-valuenow", "0");
    document.body.classList.add("timer-finished");
    statusEl.textContent = "Die Gesprächszeit ist abgelaufen.";
  }
}

function stopTimer({ updateHash = true } = {}) {
  clearTimerInterval();
  timerDurationMs = 0;
  timerEndMs = 0;
  timerSetupEl.hidden = false;
  timerRunningEl.hidden = true;
  document.body.classList.remove("timer-finished");
  timerDisplayEl.textContent = "00:00";
  timerProgressEl.style.width = "100%";
  timerTrackEl.setAttribute("aria-valuenow", "100");
  statusEl.textContent = "";

  if (updateHash && currentCategory) {
    writeHash();
  }
}

function clearTimerInterval() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

async function copyQuestionLink() {
  if (!currentCategory || currentQuestionIndex < 0) return;

  writeHash();
  const url = new URL(location.href);

  try {
    await navigator.clipboard.writeText(url.toString());
    statusEl.textContent = timerEndMs > 0
      ? "Der Link zur Frage und zum gemeinsamen Timer wurde kopiert."
      : "Der Link zu genau dieser Frage wurde kopiert.";
  } catch {
    statusEl.textContent = `Link: ${url.toString()}`;
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

    renderCategories();

    if (location.hash && !parseHash()) {
      statusEl.textContent = "Der verlinkte Frage-Code wurde nicht gefunden. Bitte wählt eine Kategorie.";
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  } catch (error) {
    console.error(error);
    categoryButtonsEl.innerHTML =
      '<p class="status">Die Fragen konnten nicht geladen werden. Bitte informiert die Eventleitung.</p>';
  }
}

drawAgainButton.addEventListener("click", () => {
  if (currentCategory) showRandomQuestion(currentCategory);
});

chooseCategoryButton.addEventListener("click", resetToCategories);
copyLinkButton.addEventListener("click", copyQuestionLink);
timerStopButton.addEventListener("click", () => stopTimer());

for (const button of timerChoiceButtons) {
  button.addEventListener("click", () => {
    const minutes = Number.parseInt(button.dataset.minutes, 10);
    if ([2, 3, 5].includes(minutes)) startTimer(minutes);
  });
}

window.addEventListener("hashchange", parseHash);
window.addEventListener("beforeunload", clearTimerInterval);

loadQuestions();
