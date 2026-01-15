const DEFAULT_CATEGORIES = ["Word-Game", "Geo-Game", "Music-Game", "Puzzle-Game", "Movie-Game", "Undefined", "Uncategorized"];

let currentFolderId = null;
let bookmarkData = {};
let categoryStates = {};

async function reloadStorageState() {
  const stored = await browser.storage.local.get(["bookmarkData", "categoryStates"]);
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};
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

function createCategoryBlock(category, bookmarks) {
  const catTemplate = document.getElementById("categoryTemplate");
  const catClone = document.importNode(catTemplate.content, true);
  const block = catClone.querySelector(".category-block");
  const checkbox = block.querySelector(".categoryEnabled");
  const nameSpan = block.querySelector(".categoryName");
  const toggleImg = block.querySelector(".toggleCategory");
  const list = block.querySelector(".bookmark-list");

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

  titleSpan.textContent = bookmark.title;

  DEFAULT_CATEGORIES.forEach((catOption) => {
    const option = document.createElement("option");
    option.value = catOption;
    option.textContent = catOption;
    categorySelect.appendChild(option);
  });

  const data = bookmarkData[bookmark.id] || {};
  checkbox.checked = data.doneToday || false;
  categorySelect.value = data.category || "";

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

  Object.keys(grouped).forEach((category) => {
    const block = createCategoryBlock(category, grouped[category]);
    categoryContainer.appendChild(block);
  });

  info.textContent = `Loaded ${bookmarks.length} bookmarks.`;
}

async function startPlayMode() {
  if (!currentFolderId) return;

  await reloadStorageState();
  const allBookmarks = await getBookmarksFromFolder(currentFolderId);

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
  const stored = await browser.storage.local.get(["lastFolderId", "bookmarkData", "categoryStates"]);
  
  currentFolderId = stored.lastFolderId || null;
  bookmarkData = stored.bookmarkData || {};
  categoryStates = stored.categoryStates || {};

  await initializeCategoryStates();
  await updateResetStatus();

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