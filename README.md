# Daily-DLE Extension

## Overview

**Daily-DLE Extension** is a lightweight Firefox add-on designed to streamline your daily routine of visiting browser-based games, especially designed for the "DLE" games (like Wordle, Globle, ReHeardle etc.). It lets you select one of your existing browser bookmark folders, organize the saved sites into categories, arrange them in exactly the order you want, and play through them with simple hotkeys. No need to switch tabs or open bookmarks manually. Perfect for speeding up your daily DLE game streaks!

---

## Features

- **Bookmark Folder Selection**  
  Choose any folder from your browser's bookmarks. The extension automatically loads all websites inside it.

- **Play Mode (in your category order)**  
  Automatically opens all enabled, not-yet-done websites in sequence using your chosen hotkeys. Play Mode now follows **your** arrangement: it goes category by category in the order you set, and within each category in the order you arranged the bookmarks. So e.g. all your Music games play back-to-back instead of being interrupted by whatever order they happen to sit in the bookmark folder. Your current progress is remembered, and already-done sites are skipped.

- **Categories**  
  Assign a category to each bookmark via the dropdown next to it. The extension ships with these defaults:
  - `Word-Game`, `Geo-Game`, `Music-Game`, `Puzzle-Game`, `Movie-Game`, `Undefined`, `Uncategorized`  
  Bookmarks without a category default to `Uncategorized`. You can disable an entire category from Play Mode using the checkbox next to its name.

- **Custom Categories (Add / Delete)**  
  Click **✎ Edit Categories** at the bottom of the popup to open the management view (it opens inside the same popup so no separate window). There you can:
  - **Add** your own categories by typing a name and pressing Enter or "Hinzufügen".
  - **Delete** any category via the **×** button (with a two-click confirmation). `Uncategorized` is protected and cannot be deleted, since it's the fallback.
  - Deleting a category is non-destructive: any bookmarks in it are moved back to `Uncategorized` to ensure nothing is lost.

- **Custom Ordering (Drag & Drop)**  
  Each category and each bookmark has a drag handle (**⠿**) on its left. Grab it with the left mouse button and drag to reorder:
  - Reorder **categories** to control the order they're played in.
  - Reorder **bookmarks within a category** to fine-tune the sequence.
  Your arrangement is saved automatically and is exactly what Play Mode uses.

- **Done Today Tracking**  
  Mark websites as "Done Today" so you know which ones you've already visited. These checkmarks reset automatically every night at **00:00 UTC**.

---

## Hotkeys

You can use the following keyboard shortcuts to control Play Mode:

- `Ctrl + Shift + Y` → **Mark current website as done** and open the next one
- `Ctrl + Alt + Y` → **Skip current website** without marking it as done

> These hotkeys work even without having the extension popup open.

---

## Usage

1. Click the extension icon in the toolbar.
2. Pick your bookmark folder from the dropdown.
3. Assign categories to your bookmarks, then drag categories and bookmarks into the order you like.
4. (Optional) Click **✎ Edit Categories** to add or remove categories.
5. Hit **▶ Start** and play through your games with the hotkeys.

---

## Testing

**Initial Setup:**
1. Install the extension in Firefox
2. Create a bookmark folder with at least 3-5 test bookmarks (e.g., different news sites or game sites)
3. Click the extension icon in the toolbar

**Basic Testing:**
1. **Folder Selection:** Select your test folder from the dropdown
2. **Categories:** Assign categories to bookmarks using the dropdown next to each bookmark
3. **Done Checkboxes:** Check/uncheck the "Done Today" checkbox for any bookmark
4. **Category Toggle:** Click the arrow next to a category to collapse/expand it
5. **Category Enable/Disable:** Use the checkbox next to category names to enable/disable them

**Custom Categories Testing:**
1. Click **✎ Edit Categories**
2. Add a new category (type a name → Enter). It should appear in the list and in every bookmark's dropdown.
3. Assign a bookmark to the new category, go back, then delete the category (× → confirm).
4. The bookmark should fall back to `Uncategorized` automatically.

**Ordering Testing:**
1. Drag a category by its **⠿** handle to a new position.
2. Drag a bookmark within a category to reorder it.
3. Start Play Mode and confirm games open in your category/bookmark order.

**Play Mode Testing:**
1. Click the "▶ Start" button
2. First bookmark should open in a new tab
3. Press `Ctrl+Shift+Y` → Current bookmark is marked as done, next one opens
4. Press `Ctrl+Shift+Y` again → Navigate to the next bookmark
5. Close all tabs and click "▶ Start" again → Only unmarked bookmarks should open

**Daily Reset Testing:**
- The "Done Today" flags reset automatically at 00:00 UTC
- For immediate testing: Use browser DevTools → Storage → Extension Storage → delete `bookmarkData` to simulate reset

**No Account Required:** This extension works entirely offline with local browser data.

---

## Why Use It?

If you're playing multiple daily games across different websites (like Wordle, Globle, ReHeardle etc.), this extension helps you:

- Avoid having to open the bookmark folder and search for the next website each time
- Play your games grouped and ordered exactly the way you want, regardless of bookmark-folder order
- Keep track of which games you've already played
- Categorize and organize your game bookmarks, including your own custom categories
- Stay in the flow with keyboard-based navigation

---

## Privacy & Data

- **No data collection** – All data is stored locally in your browser
- **No external connections** – The extension works completely offline
- **No tracking** – Your browsing activity stays private

---

## Notes

- This extension currently works with **Firefox** and reads from your **browser's bookmark folders**
- Bookmark changes (e.g. adding new websites) are picked up automatically the next time you open the extension. New bookmarks appear at the end of their category until you drag them into place.

---

## Future Ideas

- Drag a bookmark directly into another category (instead of using the dropdown)
- Per-bookmark reset times
- Automatic detection of game completion via content scripts

---

## License

MIT – feel free to use, adapt, and build upon it.