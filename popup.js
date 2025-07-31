const defaultCategories = ["Word", "Geo", "Music"];

let currentFolderId = null;
let bookmarkData = {}; // id -> { doneToday, lastChecked, category }

document.addEventListener("DOMContentLoaded", async () => {
  const folderSelect = document.getElementById("folderSelect");
  const info = document.getElementById("info");
  const list = document.getElementById("bookmarkList");
  const template = document.getElementById("bookmarkTemplate");

  // Load saved state
  const stored = await browser.storage.local.get(["lastFolderId", "bookmarkData"]);
  currentFolderId = stored.lastFolderId || null;
  bookmarkData = stored.bookmarkData || {};

  await updateResetStatus();

  // Load bookmark folders
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

  async function loadFolder(folderId) {
    list.innerHTML = "";
    const results = await browser.bookmarks.getSubTree(folderId);
    const folder = results[0];
    const bookmarks = folder.children.filter((b) => b.url);

    bookmarks.forEach((bm) => {
      const clone = document.importNode(template.content, true);
      const li = clone.querySelector("li");
      const titleSpan = li.querySelector(".title");
      const checkbox = li.querySelector(".doneCheckbox");
      const categorySelect = li.querySelector(".categorySelect");

      titleSpan.textContent = bm.title;
      categorySelect.innerHTML = "";

      // Add default categories
      defaultCategories.forEach((cat) => {
        const option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });

      // Load stored data
      const data = bookmarkData[bm.id] || {};
      checkbox.checked = data.doneToday || false;
      categorySelect.value = data.category || "";

      // Handlers
      checkbox.addEventListener("change", () => {
        bookmarkData[bm.id] = {
          ...bookmarkData[bm.id],
          doneToday: checkbox.checked,
          lastChecked: new Date().toISOString()
        };
        saveData();
      });

      categorySelect.addEventListener("change", () => {
        bookmarkData[bm.id] = {
          ...bookmarkData[bm.id],
          category: categorySelect.value
        };
        saveData();
      });

      list.appendChild(li);
    });

    info.textContent = `Loaded ${bookmarks.length} bookmarks.`;
  }

  async function saveData() {
    await browser.storage.local.set({ bookmarkData });
  }

  async function updateResetStatus() {
    const now = new Date();
    const todayUTC = now.toISOString().split("T")[0];

    for (const [id, data] of Object.entries(bookmarkData)) {
      if (!data.lastChecked) continue;
      const lastDate = data.lastChecked.split("T")[0];
      if (lastDate < todayUTC) {
        data.doneToday = false;
        // Don't update lastChecked until checkbox is changed again
      }
    }
    await saveData();
  }
});
