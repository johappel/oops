const MAIN_CATEGORY_NAMES = new Set([
  "Versorgung und Logistik",
  "Eroberung",
  "Verteidigung",
  "Kampf",
  "Stören und Ablenken",
  "Erkundung und Beobachtung"
]);
const BONUS_CATEGORY = "Zusatzaufgaben";

const taskPageEl = document.querySelector("#task-page");
const categoryEl = document.querySelector("#category");
const mainTaskEl = document.querySelector("#main-task");
const bonusTaskEl = document.querySelector("#bonus-task");
const statusEl = document.querySelector("#task-status");
const drawButton = document.querySelector("#draw-task");
const drawAgainButton = document.querySelector("#draw-again");
const copyButton = document.querySelector("#copy-task");
const guidanceEl = document.querySelector(".mission-guidance");
const missionTimeEl = document.querySelector(".mission-time");

let taskData = { categories: [], bonus: [] };
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

  const categories = [...sections.entries()]
    .filter(([name, tasks]) => MAIN_CATEGORY_NAMES.has(name) && tasks.length)
    .map(([name, tasks]) => ({ name, tasks }));

  return { categories, bonus: sections.get(BONUS_CATEGORY) || [] };
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function drawMission() {
  if (!taskData.categories.length || !taskData.bonus.length) return;
  const category = randomItem(taskData.categories);
  currentMission = {
    category: category.name,
    main: randomItem(category.tasks),
    bonus: randomItem(taskData.bonus)
  };

  categoryEl.textContent = currentMission.category;
  mainTaskEl.textContent = currentMission.main;
  bonusTaskEl.textContent = currentMission.bonus;
  taskPageEl.classList.add("mission-drawn");
  guidanceEl.hidden = false;
  missionTimeEl.hidden = false;
  statusEl.textContent = "";
  drawButton.hidden = true;
  drawAgainButton.hidden = false;
  copyButton.hidden = false;
}

async function copyMission() {
  if (!currentMission) return;
  const text = `OOPS Einsatzgruppe\n\nHauptaufgabe (${currentMission.category}):\n${currentMission.main}\n\nZusatzaufgabe:\n${currentMission.bonus}`;
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
    if (!taskData.categories.length || !taskData.bonus.length) {
      throw new Error("Keine vollständigen Aufgabenlisten gefunden");
    }
    drawButton.disabled = false;
  } catch (error) {
    console.error(error);
    drawButton.disabled = true;
    statusEl.textContent = "Die Aufgaben konnten nicht geladen werden. Bitte informiert die Eventleitung.";
  }
}

drawButton.disabled = true;
drawButton.addEventListener("click", drawMission);
drawAgainButton.addEventListener("click", drawMission);
copyButton.addEventListener("click", copyMission);
loadTasks();
