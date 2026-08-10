import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { listen } from "@tauri-apps/api/event";

// URL base del registry-api. Configurable vía variable de entorno de build
// (VITE_API_BASE_URL) sin tocar código; default apunta al backend local.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const appWindow = getCurrentWindow();

const searchInput = document.getElementById("search-input");
const refreshBtn = document.getElementById("refresh-btn");
const listSkills = document.getElementById("list-skills");
const listPrompts = document.getElementById("list-prompts");
const toast = document.getElementById("toast");
const tabSkills = document.getElementById("tab-skills");
const tabPrompts = document.getElementById("tab-prompts");
const countSkills = document.getElementById("count-skills");
const countPrompts = document.getElementById("count-prompts");
const versionLabel = document.getElementById("version-label");

let skills = [];
let prompts = [];
let toastTimer = null;
let activeTab = "skill";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 1400);
}

function buildInstallCommand(name) {
  return `npx skills add adminoryslabs/Skills --skill ${name}`;
}

async function fetchItems(type) {
  const res = await fetch(`${API_BASE_URL}/items?type=${type}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function fetchItemDetail(name) {
  const res = await fetch(`${API_BASE_URL}/items/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function renderList(container, items, { type, emptyMessage }) {
  container.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.tabIndex = 0;
    row.dataset.name = item.name;
    row.dataset.type = type;

    const top = document.createElement("div");
    top.className = "item-row-top";

    const name = document.createElement("span");
    name.className = "item-name";
    name.textContent = item.name;

    const badge = document.createElement("span");
    badge.className = "item-type-badge";
    badge.textContent = type;

    top.appendChild(name);
    top.appendChild(badge);

    const desc = document.createElement("div");
    desc.className = "item-desc";
    desc.textContent = item.description || "";

    row.appendChild(top);
    row.appendChild(desc);

    row.addEventListener("click", () => handleItemAction(item, type));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleItemAction(item, type);
    });

    container.appendChild(row);
  }
}

async function handleItemAction(item, type) {
  try {
    if (type === "skill") {
      await writeText(buildInstallCommand(item.name));
      showToast("Copiado");
      return;
    }

    // Prompt: hay que pedir el detalle para conseguir el body completo.
    showToast("Copiando...");
    const detail = await fetchItemDetail(item.name);
    await writeText(detail.body || "");
    showToast("Copiado");
  } catch (err) {
    console.error("No se pudo copiar el item", err);
    showToast("Error al copiar");
  }
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();

  const filteredSkills = query
    ? skills.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description || "").toLowerCase().includes(query)
      )
    : skills;

  const filteredPrompts = query
    ? prompts.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description || "").toLowerCase().includes(query)
      )
    : prompts;

  renderList(listSkills, filteredSkills, {
    type: "skill",
    emptyMessage: query ? "Sin resultados para tu búsqueda." : "No hay skills disponibles.",
  });

  renderList(listPrompts, filteredPrompts, {
    type: "prompt",
    emptyMessage: query
      ? "Sin resultados para tu búsqueda."
      : "Todavía no hay prompts publicados.",
  });

  countSkills.textContent = `(${filteredSkills.length})`;
  countPrompts.textContent = `(${filteredPrompts.length})`;
}

function setActiveTab(type) {
  activeTab = type;
  tabSkills.classList.toggle("active", type === "skill");
  tabPrompts.classList.toggle("active", type === "prompt");
  tabSkills.setAttribute("aria-selected", String(type === "skill"));
  tabPrompts.setAttribute("aria-selected", String(type === "prompt"));
  listSkills.classList.toggle("hidden", type !== "skill");
  listPrompts.classList.toggle("hidden", type !== "prompt");
}

tabSkills.addEventListener("click", () => setActiveTab("skill"));
tabPrompts.addEventListener("click", () => setActiveTab("prompt"));

async function loadCatalog() {
  refreshBtn.classList.add("spinning");
  try {
    const [skillItems, promptItems] = await Promise.all([
      fetchItems("skill"),
      fetchItems("prompt"),
    ]);
    skills = skillItems;
    prompts = promptItems;
    applyFilter();
  } catch (err) {
    console.error("No se pudo cargar el catálogo", err);
    listSkills.innerHTML = "";
    const error = document.createElement("div");
    error.className = "error-state";
    error.textContent = `No se pudo conectar con ${API_BASE_URL}. ¿Está corriendo registry-api?`;
    listSkills.appendChild(error);
    listPrompts.innerHTML = "";
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

searchInput.addEventListener("input", applyFilter);
refreshBtn.addEventListener("click", loadCatalog);

// Esc esconde la ventana en vez de cerrarla (sigue viva en la bandeja).
window.addEventListener("keydown", async (event) => {
  if (event.key === "Escape") {
    await appWindow.hide();
  }
});

// Perder foco también esconde la ventana (comportamiento tipo Raycast/Alfred).
appWindow.onFocusChanged(async ({ payload: focused }) => {
  if (!focused) {
    await appWindow.hide();
  }
});

// El backend Rust emite "launcher-shown" cada vez que el hotkey global
// trae la ventana al frente. Reseteamos búsqueda y foco en cada aparición.
listen("launcher-shown", () => {
  searchInput.value = "";
  setActiveTab("skill");
  applyFilter();
  searchInput.focus();
});

setActiveTab("skill");
searchInput.focus();
loadCatalog();

getVersion().then((version) => {
  versionLabel.textContent = `v${version}`;
});
