const defaultCategories = ["Word-Game", "Geo-Game", "Music-Game", "Puzzle-Game", "Movie-Game", "Undefined", "Uncategorized"];

let currentFolderId = null;
let bookmarkData = {};
let categoryStates = {};

// Lädt die gespeicherten bookmark/category-Zustände frisch aus dem Storage (verhindert stale Daten).
async function reloadStorageState() {
  const stored = await browser.storage.local.get(["bookmarkData", "categoryStates"]);
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};
}

// Holt alle Bookmarks (keine Unterordner) aus einem Ordner.
async function getBookmarksFromFolder(folderId) {
  const results = await browser.bookmarks.getSubTree(folderId);
  const folder = results[0];
  return folder.children.filter((b) => b.url);
}

// Setzt die doneToday-Flags zurück, falls ein neuer Tag begonnen hat (lokale, einfache Prüfung).
async function updateResetStatus() {
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];

  for (const [id, data] of Object.entries(bookmarkData)) {
    if (!data.lastChecked) continue;
    const lastDate = data.lastChecked.split("T")[0];
    if (lastDate < todayUTC) {
      data.doneToday = false;
    }
  }
  await saveBookmarkData();
}

async function saveBookmarkData() {
  await browser.storage.local.set({ bookmarkData });
}

async function saveCategoryStates() {
  await browser.storage.local.set({ categoryStates });
}

// Lädt den ausgewählten Ordner ins UI, gruppiert nach Kategorien und bindet Events.
async function loadFolder(folderId) {
  const categoryContainer = document.getElementById("categoryContainer");
  const info = document.getElementById("info");

  categoryContainer.innerHTML = "";
  const bookmarks = await getBookmarksFromFolder(folderId);

  // Gruppieren nach Kategorie
  const grouped = {};
  bookmarks.forEach((bm) => {
    const data = bookmarkData[bm.id] || {};
    const category = data.category || "Uncategorized";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(bm);
  });

  for (const cat of Object.keys(grouped)) {
    const catTemplate = document.getElementById("categoryTemplate");
    const catClone = document.importNode(catTemplate.content, true);
    const block = catClone.querySelector(".category-block");
    const checkbox = block.querySelector(".categoryEnabled");
    const nameSpan = block.querySelector(".categoryName");
    const toggleImg = block.querySelector(".toggleCategory");
    const list = block.querySelector(".bookmark-list");

    nameSpan.textContent = cat;

    if (categoryStates[cat] === undefined) {
      categoryStates[cat] = { enabled: true, open: true };
    }
    checkbox.checked = categoryStates[cat]?.enabled ?? true;
    if (categoryStates[cat]?.open === false) {
      list.style.display = "none";
    } else {
      toggleImg.classList.add("open");
    }

    // Kategorie-Aktivierung speichern
    checkbox.addEventListener("change", () => {
      categoryStates[cat] = { ...categoryStates[cat], enabled: checkbox.checked };
      saveCategoryStates();
    });

    toggleImg.addEventListener("click", () => {
      const isVisible = list.style.display !== "none";
      list.style.display = isVisible ? "none" : "block";
      categoryStates[cat] = { ...categoryStates[cat], open: !isVisible };
      toggleImg.classList.toggle("open", !isVisible);
      saveCategoryStates();
    });

    grouped[cat].forEach((bm) => {
      const bmClone = document.getElementById("bookmarkTemplate").content.cloneNode(true);
      const li = bmClone.querySelector("li");
      const titleSpan = li.querySelector(".title");
      const checkbox = li.querySelector(".doneCheckbox");
      const categorySelect = li.querySelector(".categorySelect");

      titleSpan.textContent = bm.title;

      categorySelect.innerHTML = "";
      defaultCategories.forEach((catOption) => {
        const option = document.createElement("option");
        option.value = catOption;
        option.textContent = catOption;
        categorySelect.appendChild(option);
      });

      const data = bookmarkData[bm.id] || {};
      checkbox.checked = data.doneToday || false;
      categorySelect.value = data.category || "";

      checkbox.addEventListener("change", () => {
        bookmarkData[bm.id] = {
          ...bookmarkData[bm.id],
          doneToday: checkbox.checked,
          lastChecked: new Date().toISOString()
        };
        saveBookmarkData();
      });

      categorySelect.addEventListener("change", () => {
        bookmarkData[bm.id] = { ...bookmarkData[bm.id], category: categorySelect.value };
        saveBookmarkData();
        loadFolder(currentFolderId); // simpel: UI komplett neu gruppieren
      });

      list.appendChild(li);
    });

    categoryContainer.appendChild(block);
  }

  info.textContent = `Loaded ${bookmarks.length} bookmarks.`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const folderSelect = document.getElementById("folderSelect");
  const startPlayBtn = document.getElementById("startPlayBtn");

  const stored = await browser.storage.local.get(["lastFolderId", "bookmarkData", "categoryStates"]);
  currentFolderId = stored.lastFolderId || null;
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};

  defaultCategories.forEach(cat => {
    if (!categoryStates[cat]) categoryStates[cat] = { enabled: true, open: true };
  });

  // Täglich-Reset (Popup-seitig) prüfen
  await updateResetStatus();

  const nodes = await browser.bookmarks.getTree();
  const folders = [];
  const traverse = (node) => {
    if (node.children) {
      if (!node.url) folders.push(node);
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);

  folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.title || "(No name)";
    folderSelect.appendChild(option);
  });

  if (currentFolderId) {
    folderSelect.value = currentFolderId;
    loadFolder(currentFolderId);
  }

  folderSelect.addEventListener("change", async () => {
    currentFolderId = folderSelect.value;
    await browser.storage.local.set({ lastFolderId: currentFolderId });
    loadFolder(currentFolderId);
  });

  // Startet den Play Mode
  startPlayBtn.addEventListener("click", async () => {
    if (!currentFolderId) return;

    // Frische States ziehen
    await reloadStorageState();

    const allBookmarks = await getBookmarksFromFolder(currentFolderId);

    // Nur aktivierte Kategorien und NICHT erledigte Bookmarks spielen
    const toPlay = allBookmarks.filter((bm) => {
      const data = bookmarkData[bm.id] || {};
      const cat = data.category || "Uncategorized";
      if (categoryStates[cat]?.enabled !== true) return false;
      if (data.doneToday === true) return false;
      return true;
    });

    await browser.storage.local.set({
      playState: {
        index: 0,
        folderId: currentFolderId,
        bookmarkIds: toPlay.map((b) => b.id)
      }
    });

    if (toPlay.length > 0) {
      const first = toPlay[0];
      await browser.tabs.create({ url: first.url }); // bewusst neuer Tab
    }
  });
});
