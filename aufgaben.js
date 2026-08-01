const MAIN_CATEGORY_NAMES = new Set([
  "Versorgung und Logistik",
  "Eroberung",
  "Verteidigung",
  "Kampf",
  "Stören und Ablenken",
  "Erkundung und Beobachtung"
]);
const BONUS_CATEGORY = "Zusatzaufgaben";
const DIFFICULTY_ORDER = ["L", "M", "S"];
const DIFFICULTIES = {
  L: { label: "Leicht", symbol: "●", className: "easy" },
  M: { label: "Mittel", symbol: "●●", className: "medium" },
  S: { label: "Schwer", symbol: "●●●", className: "hard" }
};

const taskPageEl = document.querySelector("#task-page");
const categoryEl = document.querySelector("#category");
const mainTaskEl = document.querySelector("#main-task");
const bonusCardEl = document.querySelector("#bonus-card");
const bonusTaskEl = document.querySelector("#bonus-task");
const difficultyBadgeEl = document.querySelector("#difficulty-badge");
const statusEl = document.querySelector("#task-status");
const drawButton = document.querySelector("#draw-task");
const drawAgainButton = document.querySelector("#draw-again");
const drawEasierButton = document.querySelector("#draw-easier");
const drawHarderButton = document.querySelector("#draw-harder");
const copyButton = document.querySelector("#copy-task");
const changeSelectionButton = document.querySelector("#change-selection");
const includeBonusEl = document.querySelector("#include-bonus");
const guidanceEl = document.querySelector(".mission-guidance");
const missionTimeEl = document.querySelector(".mission-time");
const afterDrawEl = document.querySelector(".after-draw");

let taskData = { categories: [], tasks: [], bonus: [], errors: [] };
let currentMission = null;

function parseTasks(markdown) {
  const sections = new Map();
  let currentSection = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = line.match(/^##\s+(.+)$/);
    const item = line.match(/^[-*]\s+(.+)$/);

    if (heading) {
      currentSection = heading[1].trim();
      sections.set(currentSection, []);
    } else if (item && currentSection) {
      sections.get(currentSection).push(item[1].trim());
    }
  }

  const errors = [];
  const categories = [...sections.entries()]
    .filter(([name]) => MAIN_CATEGORY_NAMES.has(name))
    .map(([name, rawTasks]) => {
      const tasks = rawTasks.flatMap((rawTask, index) => {
        const difficultyMatch = rawTask.match(/\s*\(([LMS])\)\s*$/i);
        if (!difficultyMatch) {
          errors.push(`Keine Schwierigkeit in „${name}“: ${rawTask}`);
          return [];
        }

        const difficulty = difficultyMatch[1].toUpperCase();
        const text = rawTask.slice(0, difficultyMatch.index).trim();
        return [{
          id: `${name}-${index}`,
          category: name,
          text,
          difficulty
        }];
      });

      return { name, tasks };
    })
    .filter((category) => category.tasks.length);

  const tasks = categories.flatMap((category) => category.tasks);
  const bonus = sections.get(BONUS_CATEGORY) || [];

  return { categories, tasks, bonus, errors };
}

function randomItem(items, excludedId = null) {
  const alternatives = excludedId && items.length > 1
    ? items.filter((item) => item.id !== excludedId)
    : items;
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

function selectedDifficulty() {
  return document.querySelector('input[name="difficulty"]:checked')?.value || "M";
}

function tasksForDifficulty(difficulty) {
  if (difficulty === "random") return taskData.tasks;
  return taskData.tasks.filter((task) => task.difficulty === difficulty);
}

function updateDifficultyControls(difficulty) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  drawEasierButton.disabled = index <= 0;
  drawHarderButton.disabled = index === -1 || index >= DIFFICULTY_ORDER.length - 1;
}

function showMission(task, bonus) {
  const difficulty = DIFFICULTIES[task.difficulty];
  currentMission = { ...task, bonus };

  categoryEl.textContent = task.category;
  mainTaskEl.textContent = task.text;
  difficultyBadgeEl.textContent = `${difficulty.symbol} ${difficulty.label}`;
  difficultyBadgeEl.className = `difficulty-badge ${difficulty.className}`;
  difficultyBadgeEl.hidden = false;

  bonusCardEl.hidden = !bonus;
  bonusTaskEl.textContent = bonus || "";

  taskPageEl.classList.add("mission-drawn");
  guidanceEl.hidden = false;
  missionTimeEl.hidden = false;
  afterDrawEl.hidden = false;
  statusEl.textContent = "";
  updateDifficultyControls(task.difficulty);
}

function drawMission(difficulty = selectedDifficulty()) {
  const candidates = tasksForDifficulty(difficulty);
  if (!candidates.length) {
    statusEl.textContent = "Für diesen Schwierigkeitsgrad wurde keine Aufgabe gefunden.";
    return;
  }

  const excludedId = difficulty === currentMission?.difficulty ? currentMission.id : null;
  const task = randomItem(candidates, excludedId);
  const bonus = includeBonusEl.checked && taskData.bonus.length
    ? randomItem(taskData.bonus)
    : null;

  showMission(task, bonus);
}

function drawAdjacent(direction) {
  if (!currentMission) return;
  const currentIndex = DIFFICULTY_ORDER.indexOf(currentMission.difficulty);
  const targetDifficulty = DIFFICULTY_ORDER[currentIndex + direction];
  if (!targetDifficulty) return;
  drawMission(targetDifficulty);
}

function resetSelection() {
  if (currentMission) {
    const currentDifficultyOption = document.querySelector(`input[name="difficulty"][value="${currentMission.difficulty}"]`);
    if (currentDifficultyOption) currentDifficultyOption.checked = true;
  }

  taskPageEl.classList.remove("mission-drawn");
  currentMission = null;
  categoryEl.textContent = "Noch nicht gezogen";
  mainTaskEl.textContent = "Wählt einen Schwierigkeitsgrad und zieht eure Aufgabe.";
  bonusCardEl.hidden = !includeBonusEl.checked;
  bonusTaskEl.textContent = "Sie wird gemeinsam mit der Hauptaufgabe gezogen.";
  difficultyBadgeEl.hidden = true;
  guidanceEl.hidden = true;
  missionTimeEl.hidden = true;
  afterDrawEl.hidden = true;
  statusEl.textContent = "";
}

async function copyMission() {
  if (!currentMission) return;
  const difficulty = DIFFICULTIES[currentMission.difficulty].label;
  const bonusText = currentMission.bonus
    ? `\n\nZusatzaufgabe:\n${currentMission.bonus}`
    : "";
  const text = `OOPS Einsatzgruppe\n\n${difficulty} · ${currentMission.category}\n${currentMission.text}${bonusText}`;

  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = "Aufgabe wurde in die Zwischenablage kopiert.";
  } catch {
    statusEl.textContent = "Kopieren war nicht möglich. Ihr könnt die Aufgabe direkt vom Bildschirm übernehmen.";
  }
}

async function loadTasks() {
  try {
    const response = await fetch("aufgaben.md", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    taskData = parseTasks(await response.text());
    window.OOPS_TASKS = taskData;

    if (!taskData.tasks.length || !taskData.bonus.length) {
      throw new Error("Keine vollständigen Aufgabenlisten gefunden");
    }
    if (taskData.errors.length) {
      console.warn("Nicht eingestufte Aufgaben wurden übersprungen:", taskData.errors);
    }

    drawButton.disabled = false;
  } catch (error) {
    console.error(error);
    drawButton.disabled = true;
    statusEl.textContent = "Die Aufgaben konnten nicht geladen werden. Bitte informiert die Eventleitung.";
  }
}

drawButton.disabled = true;
drawButton.addEventListener("click", () => drawMission());
drawAgainButton.addEventListener("click", () => drawMission(currentMission?.difficulty || selectedDifficulty()));
drawEasierButton.addEventListener("click", () => drawAdjacent(-1));
drawHarderButton.addEventListener("click", () => drawAdjacent(1));
copyButton.addEventListener("click", copyMission);
changeSelectionButton.addEventListener("click", resetSelection);
includeBonusEl.addEventListener("change", () => {
  if (!currentMission) bonusCardEl.hidden = !includeBonusEl.checked;
});
loadTasks();
