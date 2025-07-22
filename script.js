let data = [];
let filtered = [];
let selectedTags = [];
let selectedDomains = [];
let selectedItems = new Set();
let selectionMode = false;

// --- NUOVE VARIABILI PER LA PAGINAZIONE ---
let displayedCount = 50;
const loadIncrement = 50;


window.addEventListener("load", () => {
  // Unisco qui le funzioni che devono essere eseguite al caricamento della pagina
  document.getElementById("tagFilterMenu").classList.add("hidden");
  document.getElementById("domainFilterMenu").classList.add("hidden");
  
  const btn = document.getElementById('toggleSelectButton');
  btn.classList.remove('selected-button');
  selectionMode = false;
  document.body.classList.remove('selecting');

  const saved = localStorage.getItem("savedCSV");
  if (saved) {
    data = JSON.parse(saved).map((item) => {
      if (!item.tags || item.tags.trim() === "") {
        item.tags = "uncategorized";
      }
      return item;
    });
    filtered = [...data];
    onDataLoaded();
    showNotification("Data loaded from browser.");
  }
  
  updateCacheButtonState();
  
  document.getElementById("searchInput").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      applyFilters();
    }
  });

  // --- NUOVO EVENT LISTENER PER IL BOTTONE "CARICA ALTRI" ---
  // Assicurati di avere un bottone con id="loadMoreButton" nel tuo HTML
  const loadMoreButton = document.getElementById("loadMoreButton");
  if (loadMoreButton) {
      loadMoreButton.addEventListener("click", () => {
          displayedCount += loadIncrement;
          updateVisibleCards();
      });
  }
});


function updateExportCount() {
  const exportCountEl = document.getElementById("exportCount");
  if (selectionMode) {
    exportCountEl.textContent = selectedItems.size;
  } else {
    exportCountEl.textContent = filtered.length;
  }
}

function toggleSelectionMode() {
  const btn = document.getElementById('toggleSelectButton');
  btn.classList.toggle('selected-button');
  selectionMode = !selectionMode;
  document.body.classList.toggle("selecting", selectionMode);
  if (!selectionMode) {
    selectedItems.clear();
    document.querySelectorAll(".card.selected").forEach((card) => {
      card.classList.remove("selected");
    });
  }
  updateExportCount();
  showNotification(
    selectionMode ? "Selection mode ON" : "Selection mode OFF"
  );
}

function showNotification(message) {
  const note = document.getElementById("notification");
  note.innerHTML = message;
  note.style.display = "block";
  setTimeout(() => {
    note.style.display = "none";
  }, 3000);
}


function updateCacheButtonState() {
  const button = document.getElementById("clearCacheButton");
  const hasCache = localStorage.getItem("savedCSV") !== null;
  button.classList.remove("saved", "empty");
  if (hasCache) {
    button.classList.add("saved");
  } else {
    button.classList.add("empty");
  }
}

function clearCache() {
  localStorage.removeItem("savedCSV");
  selectedItems.clear();
  selectedTags = [];
  filtered = [...data];
  onDataLoaded();
  showNotification("Cache cancellata.");
  updateCacheButtonState();
}

document.getElementById("csvFile").addEventListener("change", function(e) {
  const file = e.target.files[0];
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      data = results.data
      .filter((row) => row.title && row.url)
      .map((row) => {
        row.tags = row.tags && row.tags.trim() !== "" ? row.tags : "Uncategorized";
        row.tagsArray = row.tags.split(",").map(t => t.trim());
        row.domain = getDomain(row.url);
        row.createdDate = new Date(row.created);
        return row;
      });

      localStorage.setItem("savedCSV", JSON.stringify(data));
      filtered = [...data];
      onDataLoaded();
      showNotification("CSV loaded and saved in browser.");
      updateCacheButtonState();
    },
  });
});

// --- NUOVA FUNZIONE PER GESTIRE LA VISUALIZZAZIONE DELLE CARD ---
function updateVisibleCards() {
    const loadMoreButton = document.getElementById("loadMoreButton");
    const searchInput = document.getElementById("searchInput").value;
    const isSearching = searchInput.trim().length > 0;

    let itemsToRender;

    if (isSearching) {
        // Se l'utente sta cercando, mostra tutti i risultati filtrati e nascondi il bottone
        itemsToRender = filtered;
        if (loadMoreButton) loadMoreButton.classList.add("hidden");
    } else {
        // Altrimenti, mostra solo il numero di articoli previsto da `displayedCount`
        itemsToRender = filtered.slice(0, displayedCount);
        
        // Mostra o nascondi il bottone "Carica Altri"
        if (loadMoreButton) {
            if (displayedCount < filtered.length) {
                loadMoreButton.classList.remove("hidden");
            } else {
                loadMoreButton.classList.add("hidden");
            }
        }
    }
    
    renderCards(itemsToRender);
}


function buildTagFilterMenu(tagCounts) {
  const container = document.getElementById("tagFilterMenu");
  container.innerHTML = "";
  
  const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  container.classList.toggle("hidden", sortedTags.length === 0);
  
  sortedTags.forEach((tag) => {
    const label = document.createElement("label");
    label.style.marginRight = "0px";
    label.style.cursor = "pointer";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = tag;
    checkbox.checked = selectedTags.includes(tag);
    checkbox.addEventListener("change", (e) => {
      const t = e.target.value;
      if (e.target.checked) {
        selectedTags.push(t);
      } else {
        selectedTags = selectedTags.filter((x) => x !== t);
      }
      applyFilters();
    });
    
    label.appendChild(checkbox);
    label.append(` ${tag} (${tagCounts[tag]})`);
    container.appendChild(label);
  });
}

function applyFilters() {
  const start = new Date(document.getElementById("startDate").value);
  const end = new Date(document.getElementById("endDate").value);
  const q = document.getElementById("searchInput").value.toLowerCase();
  const selD = selectedDomains;
  
  filtered = data.filter((item) => {
    const txtMatch = !q || (item.title && item.title.toLowerCase().includes(q)) || (item.excerpt && item.excerpt.toLowerCase().includes(q));
    const dt = new Date(item.created);
    const dateMatch = (isNaN(start) || dt >= start) && (isNaN(end) || dt <= end);
    
    let tagMatch = true;
    if (selectedTags.length) {
      if (!item.tags) return false;
      const its = item.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      tagMatch = selectedTags.every((t) => its.includes(t));
    }
    
    let domMatch = true;
    if (selD.length) {
      const dom = getDomain(item.url);
      domMatch = selD.includes(dom);
    }
    
    return txtMatch && dateMatch && tagMatch && domMatch;
  });
  
  // --- MODIFICA ---
  // Reimposta la paginazione ogni volta che si applica un filtro
  displayedCount = loadIncrement;

  const newTagCounts = getTagCounts(filtered);
  buildTagFilterMenu(newTagCounts);
  
  const allD = getUniqueDomains(filtered);
  const domCounts = getDomainCounts(filtered);
  renderDomainFilter(allD, domCounts);
  
  // --- MODIFICA ---
  // Chiama la nuova funzione per aggiornare la vista
  updateVisibleCards();
  
  let parts = [];
  const iconStyle = "style='font-size:16px; vertical-align:bottom; margin-right:4px;'";
  
  if (selectedTags.length) {
    parts.push(`<span class="material-symbols-outlined" ${iconStyle}>label</span>${selectedTags.join(", ")}`);
  }
  if (selectedDomains.length) {
    parts.push(`<span class="material-symbols-outlined" ${iconStyle}>language</span>${selectedDomains.join(", ")}`);
  }
  showNotification(parts.length ? parts.join(" ") : "Nessun filtro attivo");
  
  updateExportCount();
}


function renderCards(dataset) {
  const container = document.getElementById("cardsContainer");
  // La funzione ora renderizza solo il dataset che riceve, pulendo prima il contenitore.
  // La logica di quali card mostrare è in updateVisibleCards().
  container.innerHTML = "";
  
  const fragment = document.createDocumentFragment();
  
  dataset.sort((a, b) => new Date(b.created) - new Date(a.created));
  
  for (const item of dataset) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = item.url;
    card.target = "_blank";
    
    if (selectedItems.has(item.url)) {
      card.classList.add("selected");
    }
    
    card.addEventListener("click", (e) => {
      if (!selectionMode) return;
      e.preventDefault();
      e.stopPropagation();
      if (selectedItems.has(item.url)) {
        selectedItems.delete(item.url);
        card.classList.remove("selected");
      } else {
        selectedItems.add(item.url);
        card.classList.add("selected");
      }
      updateExportCount();
    });
    
    const dateObj = item.created ? new Date(item.created) : null;
    const formattedDate = dateObj
    ? `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`
    : "n.d.";
    
    const domain = getDomain(item.url);
    
    const imageContainer = document.createElement("div");
    imageContainer.className = "image-container";
    const img = document.createElement("img");
    img.src = item.cover || "https://via.placeholder.com/250x140";
    img.alt = item.title;
    img.loading = "lazy";
    imageContainer.appendChild(img);
    
    const cardContent = document.createElement("div");
    cardContent.className = "card-content";
    
    const badgesRow = document.createElement("div");
    badgesRow.className = "badges-row";
    
    const dateBadge = document.createElement("span");
    dateBadge.className = "badge date-badge";
    dateBadge.textContent = formattedDate;
    badgesRow.appendChild(dateBadge);
    
    const domainSpan = document.createElement("span");
    domainSpan.className = "badge clickable source";
    domainSpan.textContent = domain;
    domainSpan.title = "Clicca per filtrare per dominio";
    domainSpan.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const domainClicked = domainSpan.textContent.trim();
      if (selectedDomains.includes(domainClicked)) {
        selectedDomains = selectedDomains.filter((d) => d !== domainClicked);
      } else {
        selectedDomains.push(domainClicked);
      }
      document.querySelectorAll("#domainFilterMenu input[type=checkbox]").forEach((cb) => {
        if (cb.value === domainClicked) {
          cb.checked = selectedDomains.includes(domainClicked);
        }
      });
      applyFilters();
    });
    badgesRow.appendChild(domainSpan);
    
    const tagsRow = document.createElement("div");
    tagsRow.className = "tags-row";
    
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "tags-container";
    
    const tagsArray =
    typeof item.tags === "string"
    ? item.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0)
    : [];
    
    for (const tag of tagsArray) {
      const tagSpan = document.createElement("span");
      tagSpan.className = `badge clickable ${selectedTags.includes(tag) ? "selected-tag" : ""}`;
      tagSpan.textContent = tag;
      tagSpan.style.backgroundColor = generateTagColor(tag);
      tagSpan.style.color = "#000";
      tagSpan.style.marginRight = "4px";
      tagSpan.style.marginBottom = "4px";
      tagSpan.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idx = selectedTags.indexOf(tag);
        if (idx === -1) {
          selectedTags.push(tag);
        } else {
          selectedTags.splice(idx, 1);
        }
        document
        .querySelectorAll("#tagFilterMenu input[type=checkbox]")
        .forEach((cb) => {
          if (cb.value === tag) {
            cb.checked = selectedTags.includes(tag);
          }
        });
        applyFilters();
      });
      tagsContainer.appendChild(tagSpan);
    }
    
    tagsRow.appendChild(tagsContainer);
    
    const title = document.createElement("h3");
    title.textContent = item.title;
    
    const excerpt = document.createElement("p");
    excerpt.textContent = item.excerpt || "";
    
    cardContent.appendChild(badgesRow);
    cardContent.appendChild(tagsRow);
    cardContent.appendChild(title);
    cardContent.appendChild(excerpt);
    
    card.appendChild(imageContainer);
    card.appendChild(cardContent);
    
    fragment.appendChild(card);
  }
  
  container.appendChild(fragment);
  updateExportCount();
}


function onDataLoaded() {
  const initialTagCounts = getTagCounts(data);
  buildTagFilterMenu(initialTagCounts);
  const domains = getUniqueDomains(data);
  const domainCounts = getDomainCounts(data);
  renderDomainFilter(domains, domainCounts);

  // --- MODIFICA ---
  // Al primo caricamento, reimposta il contatore e aggiorna la vista
  displayedCount = loadIncrement;
  updateVisibleCards();
  
  updateExportCount();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  
  selectedTags = [];
  selectedDomains = [];
  document.querySelectorAll('#tagFilterMenu input[type="checkbox"], #domainFilterMenu input[type="checkbox"]')
  .forEach(cb => cb.checked = false);
  
  if (selectionMode) {
    toggleSelectionMode();
  }
  
  filtered = [...data];
  
  // --- MODIFICA ---
  // Reimposta anche la paginazione
  displayedCount = loadIncrement;

  const tagCounts = getTagCounts(filtered);
  buildTagFilterMenu(tagCounts);
  const domains = getUniqueDomains(filtered);
  const domCounts = getDomainCounts(filtered);
  renderDomainFilter(domains, domCounts);
  
  // --- MODIFICA ---
  // Aggiorna la vista con la nuova funzione
  updateVisibleCards();
  
  showNotification('Filtri resettati');
  updateExportCount();
}

// Il resto del codice rimane invariato...
function fallbackCopyText(text) { const textarea = document.createElement("textarea"); textarea.value = text; textarea.setAttribute("readonly", ""); textarea.style.position = "absolute"; textarea.style.left = "-9999px"; document.body.appendChild(textarea); textarea.select(); try { document.execCommand("copy"); showNotification("Copiato negli appunti!"); } catch (err) { console.error("Fallback copy failed", err); alert("Errore durante la copia negli appunti."); } document.body.removeChild(textarea); }
function getDomainCounts(dataset) { const counts = {}; dataset.forEach((item) => { const domain = getDomain(item.url); counts[domain] = (counts[domain] || 0) + 1; }); return counts; }
function getTagCounts(dataset) { const counts = {}; dataset.forEach((item) => { const tags = item.tags ? item.tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0) : ["Uncategorized"]; if (tags.length === 0) tags.push("Uncategorized"); tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }); }); return counts; }
const tagColors = {};
document.getElementById("uploadCSVButton").addEventListener("click", function() { document.getElementById("csvFile").click(); });
function generateTagColor(tag) { if (!tagColors[tag]) { const hue = Math.floor(Math.random() * 360); tagColors[tag] = `hsl(${hue}, 70%, 80%)`; } return tagColors[tag]; }
function exportSelected() { const selectedData = filtered.filter((item) => selectedItems.has(item.url)); if (selectedData.length === 0) { showNotification("Nessun tale selezionato."); return; } const fileName = "export_selected.csv"; const csvContent = Papa.unparse(selectedData); const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", fileName); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
function buildFileName() { const query = document.getElementById("searchInput").value.trim(); const startRaw = document.getElementById("startDate").value; const endRaw = document.getElementById("endDate").value; const tags = selectedTags; let parts = []; if (query) { parts.push(`searched ${query}`); } if (startRaw && endRaw) { const start = new Date(startRaw); const end = new Date(endRaw); const startStr = start.toLocaleDateString("it-IT").replace(/\//g, "-"); const endStr = end.toLocaleDateString("it-IT").replace(/\//g, "-"); parts.push(`between ${startStr} and ${endStr}`); } else if (startRaw) { const start = new Date(startRaw); const startStr = start.toLocaleDateString("it-IT").replace(/\//g, "-"); parts.push(`from ${startStr}`); } else if (endRaw) { const end = new Date(endRaw); const endStr = end.toLocaleDateString("it-IT").replace(/\//g, "-"); parts.push(`until ${endStr}`); } if (tags.length > 0) { parts.push(`with tags ${tags.join(", ")}`); } if (parts.length === 0) { return "export.csv"; } let filename = parts.join(" ") + ".csv"; filename = filename.replace(/\s+/g, "_"); return filename; }
function exportResults(type = "csv") { const selectedData = selectionMode && selectedItems.size > 0 ? filtered.filter((item) => selectedItems.has(item.url)) : filtered; if (selectedData.length === 0) { showNotification("Nessun elemento da esportare."); return; } if (type === "csv") { const fileName = buildFileName(); const csvContent = Papa.unparse(selectedData); const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", fileName); document.body.appendChild(link); link.click(); document.body.removeChild(link); } if (type === "markdown") { const md = selectedData.map((item) => `[${item.title}](${item.url})`).join("\n"); copyToClipboard(md); showNotification("Markdown copiato negli appunti."); } if (type === "text") { const urls = selectedData.map((item) => item.url).join("\n"); copyToClipboard(urls); showNotification("Link copiati negli appunti."); } if (type === "archive") { const archiveLinks = selectedData.map(item => { const baseUrl = item.url.split("?")[0]; return `[${item.title}](https://archive.is/latest/${baseUrl})`; }).join("\n"); copyToClipboard(archiveLinks); showNotification("Link Archive.is copiati negli appunti."); } const menu = document.getElementById("exportMenu"); menu.classList.add("hidden"); document.removeEventListener("click", handleOutsideClick); }
function copyToClipboard(text) { navigator.clipboard.writeText(text).catch((err) => { alert("Errore durante la copia negli appunti"); console.error(err); }); }
function toggleExportMenu(event) { event.stopPropagation(); const menu = document.getElementById("exportMenu"); menu.classList.toggle("hidden"); if (!menu.classList.contains("hidden")) { document.addEventListener("click", handleOutsideClick); } }
function handleOutsideClick(event) { const menu = document.getElementById("exportMenu"); if (!menu.contains(event.target)) { menu.classList.add("hidden"); document.removeEventListener("click", handleOutsideClick); } }
function getUniqueDomains(data) { const domains = new Set(); data.forEach((item) => { const domain = getDomain(item.url); if (domain) domains.add(domain); }); return Array.from(domains).sort(); }
function renderDomainFilter(domains, domainCounts) { const menu = document.getElementById("domainFilterMenu"); menu.innerHTML = ""; menu.classList.toggle("hidden", domains.length === 0); const domainsWithCounts = domains.map(domain => [domain, domainCounts[domain] || 0]); domainsWithCounts.sort((a, b) => b[1] - a[1]); domainsWithCounts.forEach(([domain, count]) => { const label = document.createElement("label"); label.style.cursor = "pointer"; label.style.marginRight = "0px"; const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.value = domain; checkbox.checked = selectedDomains.includes(domain); checkbox.addEventListener("change", (e) => { if (e.target.checked) { if (!selectedDomains.includes(domain)) { selectedDomains.push(domain); } } else { selectedDomains = selectedDomains.filter((d) => d !== domain); } applyFilters(); }); label.appendChild(checkbox); label.append(` ${domain} (${count})`); menu.appendChild(label); }); }
function getSelectedDomains() { return selectedDomains; }
function getDomain(url) { try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; } }