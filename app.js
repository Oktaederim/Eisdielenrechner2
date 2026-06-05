const DB_NAME = "eisdielen-rechner";
const STORE_NAME = "entries";
const DB_VERSION = 1;

const form = document.querySelector("#entryForm");
const entriesBody = document.querySelector("#entriesBody");
const cameraInput = document.querySelector("#cameraInput");
const photoInput = document.querySelector("#photoInput");
const photoPreview = document.querySelector("#photoPreview");
const photoTemplate = document.querySelector("#photoTemplate");
const importInput = document.querySelector("#importInput");
const reportBox = document.querySelector("#reportBox");

let db;
let entries = [];
let draftPhotos = [];
let selectedEntryId = null;

const fields = [
  "entryId",
  "shopName",
  "location",
  "visitDate",
  "totalPrice",
  "scoopCount",
  "flavors",
  "grossWeight",
  "cupWeight",
  "spoonWeight",
  "cupMaterial",
  "spoonMaterial",
  "notes",
];

const field = (id) => document.querySelector(`#${id}`);
const numberValue = (id) => Number(String(field(id).value).replace(",", ".")) || 0;
const money = (value) => `${formatNumber(value, 2)} EUR`;
const grams = (value) => `${formatNumber(value, 1)} g`;

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: value % 1 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeTransaction(mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function getAllEntries() {
  return new Promise((resolve, reject) => {
    const request = storeTransaction().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function saveEntry(entry) {
  return new Promise((resolve, reject) => {
    const request = storeTransaction("readwrite").put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    const request = storeTransaction("readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function calculate(entry) {
  const grossWeight = Number(entry.grossWeight) || 0;
  const cupWeight = Number(entry.cupWeight) || 0;
  const spoonWeight = Number(entry.spoonWeight) || 0;
  const scoopCount = Number(entry.scoopCount) || 1;
  const totalPrice = Number(entry.totalPrice) || 0;
  const packagingWeight = cupWeight + spoonWeight;
  const netWeight = Math.max(0, grossWeight - packagingWeight);
  const avgScoopWeight = netWeight / scoopCount;
  const pricePerScoop = totalPrice / scoopCount;
  const pricePer100g = netWeight > 0 ? (totalPrice / netWeight) * 100 : 0;
  const packagingShare = grossWeight > 0 ? (packagingWeight / grossWeight) * 100 : 0;

  return {
    packagingWeight,
    netWeight,
    avgScoopWeight,
    pricePerScoop,
    pricePer100g,
    packagingShare,
  };
}

function assessPackaging(entry) {
  const materialText = `${entry.cupMaterial} ${entry.spoonMaterial}`.toLowerCase();
  const { packagingWeight } = calculate(entry);

  if (materialText.includes("mehrweg") || materialText.includes("waffel") || materialText.includes("kein löffel")) {
    return "umweltfreundlichere Verpackungslösung";
  }
  if (materialText.includes("kunststoff") || packagingWeight >= 14) {
    return "eher kritischere Verpackungsbilanz";
  }
  if (materialText.includes("beschichtet") || materialText.includes("pla")) {
    return "mittlere Verpackungsbilanz";
  }
  return "unauffällige Verpackungsbilanz";
}

function formEntry() {
  const id = field("entryId").value || crypto.randomUUID();
  return {
    id,
    shopName: field("shopName").value.trim(),
    location: field("location").value.trim(),
    visitDate: field("visitDate").value,
    totalPrice: numberValue("totalPrice"),
    scoopCount: numberValue("scoopCount") || 3,
    flavors: field("flavors").value.trim(),
    grossWeight: numberValue("grossWeight"),
    cupWeight: numberValue("cupWeight"),
    spoonWeight: numberValue("spoonWeight"),
    cupMaterial: field("cupMaterial").value,
    spoonMaterial: field("spoonMaterial").value,
    notes: field("notes").value.trim(),
    photos: draftPhotos,
    updatedAt: new Date().toISOString(),
  };
}

function updatePreview() {
  const current = formEntry();
  const result = calculate(current);
  field("netWeightPreview").textContent = grams(result.netWeight);
  field("avgScoopPreview").textContent = grams(result.avgScoopWeight);
  field("price100Preview").textContent = money(result.pricePer100g);
  field("packagingPreview").textContent = grams(result.packagingWeight);
}

function renderPhotos() {
  photoPreview.innerHTML = "";
  draftPhotos.forEach((photo, index) => {
    const item = photoTemplate.content.cloneNode(true);
    const image = item.querySelector("img");
    const button = item.querySelector("button");
    image.src = photo.dataUrl;
    image.alt = photo.name || "Foto";
    button.addEventListener("click", () => {
      draftPhotos.splice(index, 1);
      renderPhotos();
    });
    photoPreview.appendChild(item);
  });
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          type: "image/jpeg",
          dataUrl: canvas.toDataURL("image/jpeg", 0.78),
          createdAt: new Date().toISOString(),
        });
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderTable() {
  const sorted = [...entries].sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
  entriesBody.innerHTML = "";

  if (!sorted.length) {
    document.querySelector("#summaryLine").textContent = "Noch keine Einträge.";
    return;
  }

  const cheapest = sorted.reduce((best, entry) =>
    calculate(entry).pricePer100g < calculate(best).pricePer100g ? entry : best
  );
  document.querySelector("#summaryLine").textContent =
    `${sorted.length} Einträge. Günstigster Preis je 100 g: ${cheapest.shopName} mit ${money(calculate(cheapest).pricePer100g)}.`;

  sorted.forEach((entry) => {
    const result = calculate(entry);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(entry.shopName)}</td>
      <td>${escapeHtml(entry.location)}</td>
      <td>${escapeHtml(entry.visitDate || "")}</td>
      <td>${grams(result.avgScoopWeight)}</td>
      <td>${money(result.pricePer100g)}</td>
      <td>${grams(result.packagingWeight)}</td>
      <td>${entry.photos?.length || 0}</td>
      <td class="actions">
        <button type="button" data-action="report" data-id="${entry.id}">Bericht</button>
        <button type="button" data-action="edit" data-id="${entry.id}">Ändern</button>
        <button type="button" data-action="delete" data-id="${entry.id}">Löschen</button>
      </td>
    `;
    entriesBody.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fullReport(entry) {
  const result = calculate(entry);
  return `Eisdiele: ${entry.shopName}, ${entry.location}
Datum: ${entry.visitDate || "nicht angegeben"}

Es wurden ${entry.scoopCount} Kugeln Eis (${entry.flavors || "Sorten nicht angegeben"}) gekauft. Nach Abzug von Becher und Löffel ergab sich ein Eisgewicht von ${grams(result.netWeight)}. Das entspricht durchschnittlich ${grams(result.avgScoopWeight)} pro Kugel. Bei einem Gesamtpreis von ${money(entry.totalPrice)} liegt der Preis bei ${money(result.pricePerScoop)} pro Kugel und ${money(result.pricePer100g)} je 100 g Eis.

Die Verpackung bestand aus ${entry.cupMaterial} und ${entry.spoonMaterial}. Das Verpackungsgewicht lag bei ${grams(result.packagingWeight)} und damit bei etwa ${formatNumber(result.packagingShare, 1)} Prozent des Gesamtgewichts. Die umweltbezogene Einordnung ist sachlich betrachtet: ${assessPackaging(entry)}.

${entry.notes ? `Notiz: ${entry.notes}` : "Keine zusätzliche Notiz."}`;
}

function reviewText(entry) {
  const result = calculate(entry);
  return `Sachlicher Vergleich: Bei ${entry.shopName} in ${entry.location} ergaben ${entry.scoopCount} Kugeln nach Abzug der Verpackung ${grams(result.netWeight)} Eis, also etwa ${grams(result.avgScoopWeight)} pro Kugel. Der Preis entspricht ${money(result.pricePer100g)} je 100 g. Verpackung: ${entry.cupMaterial} und ${entry.spoonMaterial}, zusammen ${grams(result.packagingWeight)}.`;
}

function selectReport(id) {
  selectedEntryId = id;
  const entry = entries.find((item) => item.id === id);
  reportBox.textContent = entry ? fullReport(entry) : "Noch kein Bericht ausgewählt.";
}

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  fields.forEach((idName) => {
    if (idName === "entryId") {
      field(idName).value = entry.id;
    } else if (field(idName)) {
      field(idName).value = entry[idName] ?? "";
    }
  });
  draftPhotos = [...(entry.photos || [])];
  renderPhotos();
  updatePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  field("entryId").value = "";
  field("visitDate").valueAsDate = new Date();
  field("scoopCount").value = 3;
  field("flavors").value = "Vanille, Schokolade, Erdbeere";
  draftPhotos = [];
  renderPhotos();
  updatePreview();
}

function exportPayload() {
  return {
    app: "Eisdielen-Rechner",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

function downloadFile(name, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadFile(`eisdielen-rechner-${dateStamp()}.json`, "application/json", JSON.stringify(exportPayload(), null, 2));
}

function exportCsv() {
  const headers = [
    "Eisdiele",
    "Ort",
    "Datum",
    "Sorten",
    "Gesamtpreis EUR",
    "Kugeln",
    "Bruttogewicht g",
    "Becher g",
    "Löffel g",
    "Nettogewicht g",
    "Durchschnitt Kugel g",
    "Preis pro Kugel EUR",
    "Preis pro 100g EUR",
    "Bechermaterial",
    "Löffelmaterial",
    "Verpackung g",
    "Verpackungsanteil %",
    "Fotos",
    "Notiz",
  ];
  const rows = entries.map((entry) => {
    const result = calculate(entry);
    return [
      entry.shopName,
      entry.location,
      entry.visitDate,
      entry.flavors,
      entry.totalPrice,
      entry.scoopCount,
      entry.grossWeight,
      entry.cupWeight,
      entry.spoonWeight,
      result.netWeight,
      result.avgScoopWeight,
      result.pricePerScoop,
      result.pricePer100g,
      entry.cupMaterial,
      entry.spoonMaterial,
      result.packagingWeight,
      result.packagingShare,
      entry.photos?.length || 0,
      entry.notes,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
  downloadFile(`eisdielen-rechner-${dateStamp()}.csv`, "text/csv;charset=utf-8", csv);
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function shareJson() {
  const fileName = `eisdielen-rechner-${dateStamp()}.json`;
  const file = new File([JSON.stringify(exportPayload(), null, 2)], fileName, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Eisdielen-Rechner", files: [file] });
  } else {
    exportJson();
  }
}

async function importJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const imported = Array.isArray(payload) ? payload : payload.entries;
  if (!Array.isArray(imported)) throw new Error("Keine passenden Einträge gefunden.");

  const existingIds = new Set(entries.map((entry) => entry.id));
  for (const entry of imported) {
    const normalized = {
      ...entry,
      id: entry.id || crypto.randomUUID(),
      photos: Array.isArray(entry.photos) ? entry.photos : [],
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
    if (existingIds.has(normalized.id)) {
      normalized.id = crypto.randomUUID();
    }
    await saveEntry(normalized);
  }
  await reload();
}

async function reload() {
  entries = await getAllEntries();
  renderTable();
  if (selectedEntryId) selectReport(selectedEntryId);
}

form.addEventListener("input", updatePreview);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const entry = formEntry();
  await saveEntry(entry);
  await reload();
  selectReport(entry.id);
  resetForm();
});

async function addSelectedPhotos(input) {
  const files = [...input.files];
  if (!files.length) return;
  const photos = await Promise.all(files.map(resizeImage));
  draftPhotos.push(...photos);
  input.value = "";
  renderPhotos();
}

cameraInput.addEventListener("change", () => addSelectedPhotos(cameraInput));
photoInput.addEventListener("change", () => addSelectedPhotos(photoInput));

entriesBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "report") selectReport(id);
  if (button.dataset.action === "edit") editEntry(id);
  if (button.dataset.action === "delete") {
    await deleteEntry(id);
    await reload();
    if (selectedEntryId === id) {
      selectedEntryId = null;
      reportBox.textContent = "Noch kein Bericht ausgewählt.";
    }
  }
});

document.querySelector("#clearButton").addEventListener("click", resetForm);
document.querySelector("#newEntryButton").addEventListener("click", resetForm);
document.querySelector("#exportJsonButton").addEventListener("click", exportJson);
document.querySelector("#exportCsvButton").addEventListener("click", exportCsv);
document.querySelector("#shareButton").addEventListener("click", shareJson);

document.querySelector("#copyReportButton").addEventListener("click", async () => {
  await navigator.clipboard.writeText(reportBox.textContent);
});

document.querySelector("#copyReviewButton").addEventListener("click", async () => {
  const entry = entries.find((item) => item.id === selectedEntryId);
  if (entry) await navigator.clipboard.writeText(reviewText(entry));
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;
  await importJson(file);
  importInput.value = "";
});

window.addEventListener("error", (event) => {
  console.error(event.error || event.message);
});

(async function init() {
  db = await openDatabase();
  field("visitDate").valueAsDate = new Date();
  resetForm();
  await reload();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  }
})();
