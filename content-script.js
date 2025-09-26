(() => {
  const OVERLAY_ID = "uconn-menu-poster-overlay";
  const POSTER_ID = "uconn-menu-poster";
  const TRIGGER_ID = "uconn-menu-poster-trigger";
  const FONTS_LINK_ID = "uconn-menu-poster-fonts";
  const LOGO_PATH = new URL("logo.gif", window.location.origin).href;

  const ICON_TAGS = {
    vegetarian: "Vegetarian",
    vegan: "Vegan",
    glutenfree: "Gluten Friendly",
    sodium: "Lower Sodium",
    nuts: "Contains Nuts",
    nogarlicandonions: "No Garlic/Onion",
    halal: "Halal",
    fish: "Fish",
    shellfish: "Shellfish",
    eggs: "Eggs",
    dairy: "Dairy"
  };

  const cleanText = (value = "") => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const parsePosterDate = (titleText) => {
    if (!titleText) {
      return { raw: "", short: "", long: "" };
    }

    const match = titleText.match(/Menus\s+for\s+(.+)/i);
    if (!match) {
      return { raw: titleText.trim(), short: titleText.trim(), long: titleText.trim() };
    }

    const raw = match[1].trim();
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.valueOf())) {
      return { raw, short: raw, long: raw };
    }

    const long = parsed.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    const short = parsed.toLocaleDateString(undefined, {
      month: "numeric",
      day: "numeric"
    });

    return { raw, short, long };
  };

  const extractIconTags = (row) => {
    const icons = [];
    row.querySelectorAll("img[src*='LegendImages']").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const key = Object.keys(ICON_TAGS).find((name) => src.toLowerCase().includes(name));
      if (key) {
        icons.push(ICON_TAGS[key]);
      }
    });
    return icons;
  };

  const parseMealColumn = (mealEl) => {
    const mealName = cleanText(mealEl.textContent);
    if (!mealName) {
      return null;
    }

    const headerRow = mealEl.closest("tr");
    const itemsTable = headerRow?.nextElementSibling?.querySelector("table");
    const rows = itemsTable ? Array.from(itemsTable.querySelectorAll(":scope > tr")) : [];

    const items = [];
    let currentCategory = "";

    for (let idx = 0; idx < rows.length; idx += 1) {
      const row = rows[idx];
      const categoryEl = row.querySelector(".shortmenucats");
      if (categoryEl) {
        currentCategory = cleanText(categoryEl.textContent).replace(/^-+|-+$/g, "").trim();
        continue;
      }

      const recipeEl = row.querySelector(".shortmenurecipes");
      if (!recipeEl) {
        continue;
      }

      const title = cleanText(recipeEl.textContent);
      if (!title) {
        continue;
      }

      const item = {
        title,
        category: currentCategory || null,
        tags: extractIconTags(row),
        notes: [],
        allergenText: ""
      };

      let pointer = idx + 1;
      while (pointer < rows.length) {
        const probe = rows[pointer];
        if (probe.querySelector(".shortmenurecipes") || probe.querySelector(".shortmenucats")) {
          break;
        }

        const descEl = probe.querySelector(".shortmenuproddesc");
        if (descEl) {
          const lines = descEl.textContent
            .split(/\n+/)
            .map((line) => cleanText(line))
            .filter(Boolean);

          lines.forEach((line) => {
            const match = line.match(/Allergens?:\s*(.+)/i);
            if (match) {
              const [, allergens] = match;
              item.allergenText = item.allergenText
                ? `${item.allergenText}; ${allergens.trim()}`
                : allergens.trim();
            } else if (!item.notes.includes(line)) {
              item.notes.push(line);
            }
          });
        }

        pointer += 1;
      }

      idx = pointer - 1;
      items.push(item);
    }

    return { name: mealName, items };
  };

  const parseMenuData = () => {
    const hallName = cleanText(document.querySelector(".headlocation")?.textContent || "");
    const titleText = cleanText(document.querySelector(".shortmenutitle")?.textContent || "");
    const menuDate = parsePosterDate(titleText);

    const meals = [];
    document.querySelectorAll(".shortmenumeals").forEach((mealEl) => {
      const meal = parseMealColumn(mealEl);
      if (meal) {
        meals.push(meal);
      }
    });

    return {
      hallName,
      menuDate,
      meals
    };
  };

  const createMealColumn = (ctx, meal) => {
    const section = ctx.createElement("section");
    section.className = "uconn-menu-meal";

    const header = ctx.createElement("header");
    header.className = "uconn-menu-meal__header";
    header.innerText = meal.name;
    header.setAttribute("contenteditable", "true");
    section.appendChild(header);

    const list = ctx.createElement("div");
    list.className = "uconn-menu-meal__items";

    let activeCategory = null;

    meal.items.forEach((item) => {
      if (item.category && item.category !== activeCategory) {
        activeCategory = item.category;
        const categoryLabel = ctx.createElement("div");
        categoryLabel.className = "uconn-menu-item__category";
        categoryLabel.innerText = activeCategory;
        categoryLabel.setAttribute("contenteditable", "true");
        list.appendChild(categoryLabel);
      }

      const card = ctx.createElement("article");
      card.className = "uconn-menu-item";
      card.dataset.suggested = "false";

      const title = ctx.createElement("div");
      title.className = "uconn-menu-item__title";
      title.innerText = item.title;
      title.setAttribute("contenteditable", "true");
      card.appendChild(title);

      if (item.notes.length) {
        item.notes.forEach((note) => {
          const noteEl = ctx.createElement("div");
          noteEl.className = "uconn-menu-item__note";
          noteEl.innerText = note;
          noteEl.setAttribute("contenteditable", "true");
          card.appendChild(noteEl);
        });
      }

      if (item.allergenText) {
        const allergens = ctx.createElement("div");
        allergens.className = "uconn-menu-item__allergens";
        allergens.innerText = `Allergens: ${item.allergenText}`;
        allergens.setAttribute("contenteditable", "true");
        card.appendChild(allergens);
      }

      if (item.tags.length) {
        const tags = ctx.createElement("div");
        tags.className = "uconn-menu-item__tags";
        tags.innerText = item.tags.join(" · ");
        tags.setAttribute("contenteditable", "true");
        card.appendChild(tags);
      }

      list.appendChild(card);
    });

    section.appendChild(list);
    return section;
  };

  const buildPoster = (data, printPoster) => {
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "uconn-menu-overlay";

    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "uconn-menu-overlay__close";
    dismiss.innerText = "×";
    dismiss.addEventListener("click", () => {
      setPrintingState(false);
      overlay.remove();
    });

    const actions = document.createElement("div");
    actions.className = "uconn-menu-overlay__actions";

    const instructions = document.createElement("div");
    instructions.className = "uconn-menu-overlay__instructions";
    instructions.innerText = "Click items to toggle suggested (green). Double-click text to edit.";

    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "uconn-menu-overlay__print";
    printButton.innerText = "Print Poster";
    printButton.addEventListener("click", printPoster);

    actions.appendChild(instructions);
    actions.appendChild(printButton);

    const poster = document.createElement("div");
    poster.id = POSTER_ID;
    poster.className = "uconn-menu-poster";

    const header = document.createElement("div");
    header.className = "uconn-menu-poster__header";

    const leftLogo = document.createElement("img");
    leftLogo.src = LOGO_PATH;
    leftLogo.alt = "UConn";
    leftLogo.className = "uconn-menu-poster__logo";

    const rightLogo = leftLogo.cloneNode();

    const headerText = document.createElement("div");
    headerText.className = "uconn-menu-poster__header-text";

    const title = document.createElement("div");
    title.className = "uconn-menu-poster__title";
    title.innerText = "Daily Menu";
    title.setAttribute("contenteditable", "true");

    const dateLine = document.createElement("div");
    dateLine.className = "uconn-menu-poster__date";
    dateLine.innerText = data.menuDate.short || data.menuDate.long || "";
    dateLine.setAttribute("contenteditable", "true");

    const subtitle = document.createElement("div");
    subtitle.className = "uconn-menu-poster__subtitle";
    subtitle.innerText = "Suggested Meals in GREEN";
    subtitle.setAttribute("contenteditable", "true");

    headerText.appendChild(title);
    headerText.appendChild(dateLine);
    headerText.appendChild(subtitle);

    header.appendChild(leftLogo);
    header.appendChild(headerText);
    header.appendChild(rightLogo);

    const hall = document.createElement("div");
    hall.className = "uconn-menu-poster__hall";
    hall.innerText = data.hallName || "Dining Hall";
    hall.setAttribute("contenteditable", "true");

    const grid = document.createElement("div");
    grid.className = "uconn-menu-poster__grid";

    data.meals.forEach((meal) => {
      grid.appendChild(createMealColumn(poster.ownerDocument, meal));
    });

    poster.appendChild(header);
    poster.appendChild(hall);
    poster.appendChild(grid);

    overlay.appendChild(dismiss);
    overlay.appendChild(actions);
    overlay.appendChild(poster);

    overlay.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest(".uconn-menu-overlay__close")) {
        return;
      }

      const item = target.closest(".uconn-menu-item");
      if (!item) {
        return;
      }

      if (target.closest("[contenteditable='true']")) {
        return;
      }

      const state = item.dataset.suggested === "true";
      item.dataset.suggested = state ? "false" : "true";
    });

    return overlay;
  };

  const ensureFonts = () => {
    if (document.getElementById(FONTS_LINK_ID)) {
      return;
    }
    const link = document.createElement("link");
    link.id = FONTS_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:ital,wght@0,400;0,600;0,700;1,500&display=swap";
    document.head.appendChild(link);
  };

  let afterPrintCleanupAttached = false;

  const setPrintingState = (isPrinting) => {
    if (isPrinting) {
      document.body.dataset.uconnPrinting = "true";
    } else {
      delete document.body.dataset.uconnPrinting;
    }
  };

  const ensureAfterPrintCleanup = () => {
    if (afterPrintCleanupAttached) {
      return;
    }
    window.addEventListener("afterprint", () => setPrintingState(false));
    afterPrintCleanupAttached = true;
  };

  const printPoster = () => {
    const poster = document.getElementById(POSTER_ID);
    if (!poster) {
      alert("Poster not ready yet. Try generating it again.");
      return;
    }

    ensureAfterPrintCleanup();
    setPrintingState(true);
    window.print();
    window.setTimeout(() => setPrintingState(false), 1500);
  };

  const openPoster = () => {
    if (document.getElementById(OVERLAY_ID)) {
      return;
    }
    const data = parseMenuData();
    if (!data.meals.length) {
      alert("UConn Menu Formatter: no menu data detected on this page.");
      return;
    }

    ensureFonts();
    const overlay = buildPoster(data, printPoster);
    document.body.appendChild(overlay);
  };

  const injectTrigger = () => {
    if (document.getElementById(TRIGGER_ID)) {
      return;
    }

    const button = document.createElement("button");
    button.id = TRIGGER_ID;
    button.type = "button";
    button.innerText = "Generate Poster";
    button.className = "uconn-menu-trigger";
    button.addEventListener("click", openPoster);

    document.body.appendChild(button);
  };

  const bootstrap = () => {
    if (!document.querySelector(".shortmenumeals")) {
      return;
    }
    injectTrigger();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
