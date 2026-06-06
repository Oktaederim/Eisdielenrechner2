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
const dataStatus = document.querySelector("#dataStatus");

let db;
let entries = [];
let draftPhotos = [];
let selectedEntryId = null;
let lastBackupName = localStorage.getItem("lastBackupName") || "";

const fields = [
  "entryId",
  "shopName",
  "location",
  "visitDate",
  "totalPrice",
  "scoopCount",
  "flavors",
  "grossWeight",
  "packagingWeight",
  "cupMaterial",
  "spoonMaterial",
  "notes",
];

const field = (id) => document.querySelector(`#${id}`);
const numberValue = (id) => {
  const element = field(id);
  if (!element) return 0;
  return Number(String(element.value).replace(",", ".")) || 0;
};
const money = (value) => `${formatNumber(value, 2)} EUR`;
const grams = (value) => `${formatNumber(value, 1)} g`;

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

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

function clearEntries() {
  return new Promise((resolve, reject) => {
    const request = storeTransaction("readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function packagingWeightOf(entry) {
  if (entry.packagingWeight !== undefined && entry.packagingWeight !== null && entry.packagingWeight !== "") {
    return Number(entry.packagingWeight) || 0;
  }
  return (Number(entry.cupWeight) || 0) + (Number(entry.spoonWeight) || 0);
}

function calculate(entry) {
  const grossWeight = Number(entry.grossWeight) || 0;
  const scoopCount = Number(entry.scoopCount) || 1;
  const totalPrice = Number(entry.totalPrice) || 0;
  const packagingWeight = packagingWeightOf(entry);
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
    packagingWeight: numberValue("packagingWeight"),
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

Es wurden ${entry.scoopCount} Kugeln Eis (${entry.flavors || "Sorten nicht angegeben"}) gekauft. Nach Abzug der Verpackung ergab sich ein Eisgewicht von ${grams(result.netWeight)}. Das entspricht durchschnittlich ${grams(result.avgScoopWeight)} pro Kugel. Bei einem Gesamtpreis von ${money(entry.totalPrice)} liegt der Preis bei ${money(result.pricePerScoop)} pro Kugel und ${money(result.pricePer100g)} je 100 g Eis.

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
    } else if (idName === "packagingWeight") {
      field(idName).value = packagingWeightOf(entry) || "";
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
    version: 2,
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
  const fileName = `eisdielen-sicherung-${dateStamp()}.json`;
  lastBackupName = fileName;
  localStorage.setItem("lastBackupName", lastBackupName);
  downloadFile(fileName, "application/json", JSON.stringify(exportPayload(), null, 2));
  updateDataStatus("Sicherungsdatei erstellt. Wenn gefragt wird, speichere sie in iCloud Drive oder in Dateien.");
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
    "Verpackung gesamt g",
    "Nettogewicht g",
    "Durchschnitt Kugel g",
    "Preis pro Kugel EUR",
    "Preis pro 100g EUR",
    "Bechermaterial",
    "Löffelmaterial",
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
      result.packagingWeight,
      result.netWeight,
      result.avgScoopWeight,
      result.pricePerScoop,
      result.pricePer100g,
      entry.cupMaterial,
      entry.spoonMaterial,
      result.packagingShare,
      entry.photos?.length || 0,
      entry.notes,
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
  downloadFile(`eisdielen-rechner-${dateStamp()}.csv`, "text/csv;charset=utf-8", csv);
  updateDataStatus("Tabelle exportiert. Die CSV-Datei enthält keine Fotos, aber alle Messwerte.");
}

function csvCell(value) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function shareJson() {
  const fileName = `eisdielen-sicherung-${dateStamp()}.json`;
  const file = new File([JSON.stringify(exportPayload(), null, 2)], fileName, { type: "application/json" });
  lastBackupName = fileName;
  localStorage.setItem("lastBackupName", lastBackupName);
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Eisdielen-Rechner", files: [file] });
      updateDataStatus("Sicherung erstellt. Wenn du iCloud Drive gewählt hast, liegt die Datei dort.");
    } else {
      exportJson();
    }
  } catch (error) {
    updateDataStatus("Teilen wurde abgebrochen oder nicht geöffnet. Nutze alternativ „Sicherungsdatei herunterladen“.");
  }
}

async function importJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const imported = Array.isArray(payload) ? payload : payload.entries;
  if (!Array.isArray(imported)) throw new Error("Keine passenden Einträge gefunden.");

  await clearEntries();
  const importedIds = new Set();
  for (const entry of imported) {
    const id = entry.id && !importedIds.has(entry.id) ? entry.id : crypto.randomUUID();
    importedIds.add(id);
    const normalized = {
      ...entry,
      id,
      packagingWeight: packagingWeightOf(entry),
      photos: Array.isArray(entry.photos) ? entry.photos : [],
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
    await saveEntry(normalized);
  }
  lastBackupName = file.name;
  localStorage.setItem("lastBackupName", lastBackupName);
  await reload();
  updateDataStatus(`Sicherung "${file.name}" geladen. Neue Änderungen werden wieder lokal gespeichert, bis du eine neue Sicherung erstellst.`);
}

async function reload() {
  entries = await getAllEntries();
  renderTable();
  updateDataStatus();
  if (selectedEntryId) selectReport(selectedEntryId);
}

function updateDataStatus(message) {
  if (!dataStatus) return;
  if (message) {
    dataStatus.textContent = message;
    return;
  }
  if (!entries.length) {
    dataStatus.textContent = "Keine lokalen Einträge. Du kannst neu erfassen oder eine iCloud-Sicherung laden.";
    return;
  }
  const backupText = lastBackupName ? ` Zuletzt verwendete Sicherung: ${lastBackupName}.` : "";
  dataStatus.textContent = `${entries.length} Einträge sind lokal auf diesem Gerät gespeichert.${backupText} Für iCloud bitte eine Sicherung erstellen.`;
}

on(form, "input", updatePreview);

on(form, "submit", async (event) => {
  event.preventDefault();
  const entry = formEntry();
  await saveEntry(entry);
  await reload();
  selectReport(entry.id);
  updateDataStatus("Eintrag lokal gespeichert. Für iCloud oder ein anderes Gerät bitte eine Sicherung teilen oder herunterladen.");
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

on(cameraInput, "change", () => addSelectedPhotos(cameraInput));
on(photoInput, "change", () => addSelectedPhotos(photoInput));

on(entriesBody, "click", async (event) => {
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

on(document.querySelector("#clearButton"), "click", resetForm);
on(document.querySelector("#newEntryButton"), "click", resetForm);
on(document.querySelector("#shareBackupButton"), "click", shareJson);
on(document.querySelector("#downloadBackupButton"), "click", exportJson);
on(document.querySelector("#exportCsvButton"), "click", exportCsv);

on(document.querySelector("#copyReportButton"), "click", async () => {
  await navigator.clipboard.writeText(reportBox.textContent);
});

on(document.querySelector("#copyReviewButton"), "click", async () => {
  const entry = entries.find((item) => item.id === selectedEntryId);
  if (entry) await navigator.clipboard.writeText(reviewText(entry));
});

on(importInput, "change", async () => {
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
