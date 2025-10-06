# UConn Dining Menu Formatter

Chrome extension that turns UConn Dining's "short menu" pages into a Canva-style poster with one click.

## Load the extension
- Open `chrome://extensions/`, enable **Developer mode**, then choose **Load unpacked**.
- Select this project folder (contains `manifest.json`, `content-script.js`, `styles/`).
- Pin the extension if you want faster access to the trigger button.

## Use it
- Browse to any short menu page, e.g. `https://nutritionanalysis.dds.uconn.edu/shortmenu.aspx?...`.
- A floating **Generate Poster** button appears in the bottom-right corner.
- Click the button to open the overlay poster.
  - Click a menu item to toggle the green "suggested" styling.
  - Double-click text (titles, notes, allergens, categories) to tweak wording or add ratings.
  - Press **Print / Save PDF** to open the browser print dialog and export the poster. Use the system "Save as PDF" option to download.
  - Use the `×` button to close the overlay when you are done.

## Customising the look
- Typography, colours, spacing, and responsive rules live in `styles/content.css`.
- Poster content is rendered by `content-script.js`; adjust the DOM builders there if you want to rearrange sections or add new data points.
- Category labels are pulled from the menu's section names (e.g. `-- FEAST --`). Remove or restyle them in `createMealColumn` if you prefer a flat list.

## Notes & limitations
- Built for Chrome/Chromium browsers using Manifest V3. Other Chromium-based browsers that support MV3 content scripts should work.
- The parser expects the current FoodPro "short menu" structure. If UConn changes the markup, update `parseMealColumn` so it can find meal headers, categories, and item rows again.
- The extension does not store data or call external APIs; it only reads the content already on the page and adds styling/fonts from Google Fonts for the poster view.
