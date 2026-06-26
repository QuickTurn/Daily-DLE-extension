const DEFAULT_CATEGORIES = ["Word-Game", "Geo-Game", "Music-Game", "Puzzle-Game", "Movie-Game", "Undefined", "Uncategorized"];
const FALLBACK_CATEGORY = "Uncategorized"; // darf nie gelöscht werden

let currentFolderId = null;
let bookmarkData = {};
let categoryStates = {};
let categoryOrder = [];

// Merkt sich beim Bookmark-Drag, aus welcher Liste das Item kommt
let draggedBookmarkList = null;

async function reloadStorageState() {
  const stored = await browser.storage.local.get(["bookmarkData", "categoryStates", "categoryOrder"]);
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};
  categoryOrder = stored.categoryOrder || categoryOrder;
}

async function saveBookmarkData() {
  await browser.storage.local.set({ bookmarkData });
}

async function saveCategoryStates() {
  await browser.storage.local.set({ categoryStates });
}

async function saveCategoryOrder() {
  await browser.storage.local.set({ categoryOrder });
}

async function getBookmarksFromFolder(folderId) {
  const results = await browser.bookmarks.getSubTree(folderId);
  const folder = results[0];
  const allBookmarks = [];

  function collectBookmarks(node) {
    if (node.url) {
      allBookmarks.push(node);
    }
    if (node.children) {
      node.children.forEach(collectBookmarks);
    }
  }

  collectBookmarks(folder);
  return allBookmarks;
}

async function updateResetStatus() {
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];
  let hasChanges = false;

  for (const [id, data] of Object.entries(bookmarkData)) {
    if (!data.lastChecked) continue;
    const lastDate = data.lastChecked.split("T")[0];
    if (lastDate < todayUTC) {
      data.doneToday = false;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await saveBookmarkData();
  }
}

// Vorhandene Kategorien in gespeicherter Reihenfolge; unbekannte hinten dran
function getOrderedCategories(categoriesPresent) {
  const ordered = categoryOrder.filter((c) => categoriesPresent.includes(c));
  const extras = categoriesPresent.filter((c) => !categoryOrder.includes(c));
  return [...ordered, ...extras];
}

// Bookmarks innerhalb einer Kategorie nach gespeichertem order-Wert sortieren.
function sortBookmarksByOrder(bookmarks) {
  return [...bookmarks].sort((a, b) => {
    const oa = bookmarkData[a.id]?.order ?? Number.MAX_SAFE_INTEGER;
    const ob = bookmarkData[b.id]?.order ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });
}

// Findet das Element, vor dem das gezogene Element eingefügt werden soll.
function getDragAfterElement(container, selector, y) {
  const els = [...container.querySelectorAll(selector)];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    }
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

async function persistCategoryOrderFromDOM() {
  const categoryContainer = document.getElementById("categoryContainer");
  const blocks = [...categoryContainer.querySelectorAll(".category-block")];
  const domOrder = blocks.map((b) => b.dataset.category).filter(Boolean);
  const hidden = categoryOrder.filter((c) => !domOrder.includes(c));
  categoryOrder = [...domOrder, ...hidden];
  await saveCategoryOrder();
}

async function persistBookmarkOrderFromDOM(list) {
  if (!list) return;
  const items = [...list.querySelectorAll(".bookmark-item")];
  items.forEach((item, idx) => {
    const id = item.dataset.bookmarkId;
    if (!id) return;
    bookmarkData[id] = { ...bookmarkData[id], order: idx };
  });
  await saveBookmarkData();
}

function createCategoryBlock(category, bookmarks) {
  const catTemplate = document.getElementById("categoryTemplate");
  const catClone = document.importNode(catTemplate.content, true);
  const block = catClone.querySelector(".category-block");
  const checkbox = block.querySelector(".categoryEnabled");
  const nameSpan = block.querySelector(".categoryName");
  const toggleImg = block.querySelector(".toggleCategory");
  const list = block.querySelector(".bookmark-list");
  const handle = block.querySelector(".categoryDragHandle");

  block.dataset.category = category;
  nameSpan.textContent = category;

  if (categoryStates[category] === undefined) {
    categoryStates[category] = { enabled: true, open: true };
  }

  const state = categoryStates[category];
  checkbox.checked = state.enabled ?? true;

  if (!state.open) {
    list.style.display = "none";
  } else {
    toggleImg.classList.add("open");
  }

  checkbox.addEventListener("change", () => {
    categoryStates[category] = { ...categoryStates[category], enabled: checkbox.checked };
    saveCategoryStates();
  });

  toggleImg.addEventListener("click", () => {
    const isVisible = list.style.display !== "none";
    list.style.display = isVisible ? "none" : "block";
    categoryStates[category] = { ...categoryStates[category], open: !isVisible };
    toggleImg.classList.toggle("open", !isVisible);
    saveCategoryStates();
  });

  // Drag: Block nur draggable, solange der Griff gehalten wird.
  handle.addEventListener("mousedown", () => block.setAttribute("draggable", "true"));
  handle.addEventListener("mouseup", () => block.removeAttribute("draggable"));

  block.addEventListener("dragstart", (e) => {
    block.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", category);
  });

  block.addEventListener("dragend", () => {
    block.classList.remove("dragging");
    block.removeAttribute("draggable");
    persistCategoryOrderFromDOM();
  });

  list.addEventListener("dragover", (e) => {
    if (!draggedBookmarkList || draggedBookmarkList !== list) return;
    e.preventDefault();
    e.stopPropagation();
    const dragging = list.querySelector(".bookmark-item.dragging");
    if (!dragging) return;
    const afterEl = getDragAfterElement(list, ".bookmark-item:not(.dragging)", e.clientY);
    if (afterEl == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterEl);
    }
  });

  bookmarks.forEach((bm) => {
    const item = createBookmarkItem(bm);
    list.appendChild(item);
  });

  return block;
}

function createBookmarkItem(bookmark) {
  const bmClone = document.getElementById("bookmarkTemplate").content.cloneNode(true);
  const li = bmClone.querySelector("li");
  const titleSpan = li.querySelector(".title");
  const checkbox = li.querySelector(".doneCheckbox");
  const categorySelect = li.querySelector(".categorySelect");
  const handle = li.querySelector(".bookmarkDragHandle");

  li.dataset.bookmarkId = bookmark.id;
  titleSpan.textContent = bookmark.title;

  categoryOrder.forEach((catOption) => {
    const option = document.createElement("option");
    option.value = catOption;
    option.textContent = catOption;
    categorySelect.appendChild(option);
  });

  const data = bookmarkData[bookmark.id] || {};
  checkbox.checked = data.doneToday || false;
  categorySelect.value = data.category || FALLBACK_CATEGORY;

  checkbox.addEventListener("change", () => {
    bookmarkData[bookmark.id] = {
      ...bookmarkData[bookmark.id],
      doneToday: checkbox.checked,
      lastChecked: new Date().toISOString()
    };
    saveBookmarkData();
  });

  categorySelect.addEventListener("change", () => {
    bookmarkData[bookmark.id] = {
      ...bookmarkData[bookmark.id],
      category: categorySelect.value
    };
    saveBookmarkData();
    loadFolder(currentFolderId);
  });

  handle.addEventListener("mousedown", () => li.setAttribute("draggable", "true"));
  handle.addEventListener("mouseup", () => li.removeAttribute("draggable"));

  li.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    draggedBookmarkList = li.closest(".bookmark-list");
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", bookmark.id);
  });

  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    li.removeAttribute("draggable");
    persistBookmarkOrderFromDOM(draggedBookmarkList);
    draggedBookmarkList = null;
  });

  return li;
}

function groupBookmarksByCategory(bookmarks) {
  const grouped = {};
  bookmarks.forEach((bm) => {
    const data = bookmarkData[bm.id] || {};
    const category = data.category || FALLBACK_CATEGORY;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(bm);
  });
  return grouped;
}

async function loadFolder(folderId) {
  const categoryContainer = document.getElementById("categoryContainer");
  const info = document.getElementById("info");

  categoryContainer.innerHTML = "";
  const bookmarks = await getBookmarksFromFolder(folderId);
  const grouped = groupBookmarksByCategory(bookmarks);

  const ordered = getOrderedCategories(Object.keys(grouped));
  ordered.forEach((category) => {
    const sorted = sortBookmarksByOrder(grouped[category]);
    const block = createCategoryBlock(category, sorted);
    categoryContainer.appendChild(block);
  });

  info.textContent = `Loaded ${bookmarks.length} bookmarks.`;
}

// Play Mode Sachen
async function startPlayMode() {
  if (!currentFolderId) return;

  await reloadStorageState();
  const allBookmarks = await getBookmarksFromFolder(currentFolderId);

  const grouped = groupBookmarksByCategory(allBookmarks);
  const ordered = getOrderedCategories(Object.keys(grouped));

  const toPlay = [];
  ordered.forEach((cat) => {
    if (categoryStates[cat]?.enabled !== true) return;
    const sorted = sortBookmarksByOrder(grouped[cat]);
    sorted.forEach((bm) => {
      const data = bookmarkData[bm.id] || {};
      if (data.doneToday === true) return;
      toPlay.push(bm);
    });
  });

  await browser.storage.local.set({
    playState: {
      index: 0,
      folderId: currentFolderId,
      bookmarkIds: toPlay.map((b) => b.id)
    }
  });

  if (toPlay.length > 0) {
    await browser.tabs.create({ url: toPlay[0].url });
  }
}

async function addCategory(rawName) {
  const status = document.getElementById("settingsStatus");
  const name = rawName.trim();

  if (!name) return;

  const exists = categoryOrder.some((c) => c.toLowerCase() === name.toLowerCase());
  if (exists) {
    status.textContent = `„${name}" existiert bereits.`;
    status.className = "settings-status error";
    return;
  }

  categoryOrder.push(name);
  categoryStates[name] = { enabled: true, open: true };
  await saveCategoryOrder();
  await saveCategoryStates();

  status.textContent = `„${name}" hinzugefügt.`;
  status.className = "settings-status ok";
  renderCategoryManageList();
}

async function deleteCategory(name) {
  if (name === FALLBACK_CATEGORY) return;

  // Bookmarks dieser Kategorie zurück auf den Fallback (nichts geht verloren).
  let bookmarksChanged = false;
  for (const id of Object.keys(bookmarkData)) {
    if (bookmarkData[id].category === name) {
      delete bookmarkData[id].category;
      bookmarksChanged = true;
    }
  }

  categoryOrder = categoryOrder.filter((c) => c !== name);
  delete categoryStates[name];

  await saveCategoryOrder();
  await saveCategoryStates();
  if (bookmarksChanged) await saveBookmarkData();

  const status = document.getElementById("settingsStatus");
  status.textContent = `„${name}" gelöscht.`;
  status.className = "settings-status ok";
  renderCategoryManageList();
}

function renderCategoryManageList() {
  const container = document.getElementById("categoryManageList");
  container.innerHTML = "";

  categoryOrder.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "manage-row";

    const name = document.createElement("span");
    name.className = "manage-name";
    name.textContent = cat;
    row.appendChild(name);

    if (cat === FALLBACK_CATEGORY) {
      const locked = document.createElement("span");
      locked.className = "manage-locked";
      locked.textContent = "Standard";
      row.appendChild(locked);
    } else {
      const del = document.createElement("button");
      del.className = "manage-delete";
      del.textContent = "×";
      del.title = "Kategorie löschen";

      del.addEventListener("click", () => {
        if (del.dataset.confirm === "1") {
          deleteCategory(cat);
        } else {
          del.dataset.confirm = "1";
          del.textContent = "Löschen?";
          del.classList.add("confirm");
          setTimeout(() => {
            del.dataset.confirm = "0";
            del.textContent = "×";
            del.classList.remove("confirm");
          }, 3000);
        }
      });

      row.appendChild(del);
    }

    container.appendChild(row);
  });
}


function showSettings() {
  document.getElementById("settingsStatus").textContent = "";
  document.getElementById("mainView").hidden = true;
  document.getElementById("settingsView").hidden = false;
  renderCategoryManageList();
}

function showMain() {
  document.getElementById("settingsView").hidden = true;
  document.getElementById("mainView").hidden = false;
  // Hauptansicht neu aufbauen, damit Dropdowns die Kategorie-Änderungen zeigen.
  if (currentFolderId) loadFolder(currentFolderId);
}

async function initializeCategoryOrder() {
  if (!categoryOrder || categoryOrder.length === 0) {
    categoryOrder = [...DEFAULT_CATEGORIES];
    await saveCategoryOrder();
    return;
  }
  if (!categoryOrder.includes(FALLBACK_CATEGORY)) {
    categoryOrder.push(FALLBACK_CATEGORY);
    await saveCategoryOrder();
  }
}

async function initializeCategoryStates() {
  let needsSave = false;
  categoryOrder.forEach((cat) => {
    if (!categoryStates[cat]) {
      categoryStates[cat] = { enabled: true, open: true };
      needsSave = true;
    }
  });
  if (needsSave) await saveCategoryStates();
}

async function populateFolderSelect() {
  const folderSelect = document.getElementById("folderSelect");
  const nodes = await browser.bookmarks.getTree();
  const folders = [];

  function traverse(node) {
    if (node.children) {
      if (!node.url) {
        folders.push(node);
      }
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);

  folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.title || "(No name)";
    folderSelect.appendChild(option);
  });

  return folderSelect;
}

document.addEventListener("DOMContentLoaded", async () => {
  await reloadStorageState();
  const { lastFolderId } = await browser.storage.local.get("lastFolderId");
  currentFolderId = lastFolderId || null;

  await initializeCategoryOrder();
  await initializeCategoryStates();
  await updateResetStatus();

  document.addEventListener("mouseup", () => {
    document.querySelectorAll('[draggable="true"]').forEach((el) => el.removeAttribute("draggable"));
  });

  const categoryContainer = document.getElementById("categoryContainer");
  categoryContainer.addEventListener("dragover", (e) => {
    const dragging = categoryContainer.querySelector(".category-block.dragging");
    if (!dragging) return;
    e.preventDefault();
    const afterEl = getDragAfterElement(categoryContainer, ".category-block:not(.dragging)", e.clientY);
    if (afterEl == null) {
      categoryContainer.appendChild(dragging);
    } else {
      categoryContainer.insertBefore(dragging, afterEl);
    }
  });

  const folderSelect = await populateFolderSelect();
  const startPlayBtn = document.getElementById("startPlayBtn");

  if (currentFolderId) {
    folderSelect.value = currentFolderId;
    await loadFolder(currentFolderId);
  }

  folderSelect.addEventListener("change", async () => {
    currentFolderId = folderSelect.value;
    await browser.storage.local.set({ lastFolderId: currentFolderId });
    await loadFolder(currentFolderId);
  });

  startPlayBtn.addEventListener("click", startPlayMode);

  document.getElementById("openSettingsBtn").addEventListener("click", showSettings);
  document.getElementById("backBtn").addEventListener("click", showMain);

  const newCategoryInput = document.getElementById("newCategoryInput");
  const addCategoryBtn = document.getElementById("addCategoryBtn");

  addCategoryBtn.addEventListener("click", async () => {
    await addCategory(newCategoryInput.value);
    newCategoryInput.value = "";
    newCategoryInput.focus();
  });

  newCategoryInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await addCategory(newCategoryInput.value);
      newCategoryInput.value = "";
    }
  });
});