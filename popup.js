const DEFAULT_CATEGORIES = ["Word-Game", "Geo-Game", "Music-Game", "Puzzle-Game", "Movie-Game", "Undefined", "Uncategorized"];

let currentFolderId = null;
let bookmarkData = {};
let categoryStates = {};
let categoryOrder = [];

// (Bookmarks dürfen vorerst nur innerhalb der eigenen Kategorie verschoben werden)
let draggedBookmarkList = null;

async function reloadStorageState() {
  const stored = await browser.storage.local.get(["bookmarkData", "categoryStates", "categoryOrder"]);
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};
  categoryOrder = stored.categoryOrder || categoryOrder;
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

async function saveBookmarkData() {
  await browser.storage.local.set({ bookmarkData });
}

async function saveCategoryStates() {
  await browser.storage.local.set({ categoryStates });
}

async function saveCategoryOrder() {
  await browser.storage.local.set({ categoryOrder });
}

// Liefert die vorhandenen Kategorien in der gespeicherten Reihenfolge.
function getOrderedCategories(categoriesPresent) {
  const ordered = categoryOrder.filter((c) => categoriesPresent.includes(c));
  const extras = categoriesPresent.filter((c) => !categoryOrder.includes(c));
  return [...ordered, ...extras];
}

// Bookmarks ohne order behalten ihre relative Reihenfolge und landen hinten.
function sortBookmarksByOrder(bookmarks) {
  return [...bookmarks].sort((a, b) => {
    const oa = bookmarkData[a.id]?.order ?? Number.MAX_SAFE_INTEGER;
    const ob = bookmarkData[b.id]?.order ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });
}

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

  // Block wird nur draggable, solange der Griff gehalten wird.
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

  // Bookmark Sortierung innerhalb genau dieser Liste
  list.addEventListener("dragover", (e) => {
    if (!draggedBookmarkList || draggedBookmarkList !== list) return; // nur eigene Liste
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

  DEFAULT_CATEGORIES.forEach((catOption) => {
    const option = document.createElement("option");
    option.value = catOption;
    option.textContent = catOption;
    categorySelect.appendChild(option);
  });

  const data = bookmarkData[bookmark.id] || {};
  checkbox.checked = data.doneToday || false;
  categorySelect.value = data.category || "Uncategorized";

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
    e.stopPropagation(); // verhindert, dass der Kategorie-Drag mitgetriggert wird
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
    const category = data.category || "Uncategorized";
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

async function initializeCategoryStates() {
  let needsSave = false;

  DEFAULT_CATEGORIES.forEach((cat) => {
    if (!categoryStates[cat]) {
      categoryStates[cat] = { enabled: true, open: true };
      needsSave = true;
    }
  });

  if (needsSave) {
    await saveCategoryStates();
  }
}

async function initializeCategoryOrder() {
  let needsSave = false;

  DEFAULT_CATEGORIES.forEach((cat) => {
    if (!categoryOrder.includes(cat)) {
      categoryOrder.push(cat);
      needsSave = true;
    }
  });

  if (needsSave) {
    await saveCategoryOrder();
  }
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
  const stored = await browser.storage.local.get(["lastFolderId", "bookmarkData", "categoryStates", "categoryOrder"]);

  currentFolderId = stored.lastFolderId || null;
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};
  categoryOrder = stored.categoryOrder || [];

  await initializeCategoryStates();
  await initializeCategoryOrder();
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
});