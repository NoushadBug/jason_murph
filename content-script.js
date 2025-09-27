(() => {
  const OVERLAY_ID = "uconn-menu-poster-overlay";
  const POSTER_ID = "uconn-menu-poster";
  const TRIGGER_ID = "uconn-menu-poster-trigger";
  const FONTS_LINK_ID = "uconn-menu-poster-fonts";
  const STYLESHEET_LINK_ID = "uconn-menu-poster-styles";
  const LOGO_PATH = new URL("https://upload.wikimedia.org/wikipedia/en/thumb/5/56/University_of_Connecticut_seal.svg/1200px-University_of_Connecticut_seal.svg.png").href;

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

  const INFO_PAGE_CONTENT = [
    {
      title: "Weekday Hours",
      groups: [
        {
          name: "South & Northwest",
          lines: [
            "Breakfast: 7:00am-10:45am",
            "Lunch: 11:00am-2:15pm",
            "Dinner: 3:45pm-7:15pm",
            "Late Night: South & Northwest are open until 10pm Sunday through Thursday"
          ]
        },
        {
          name: "Connecticut Hall, Putnam, Gelfenbien",
          lines: [
            "Breakfast: 7:00am-10:45am",
            "Lunch: 11:00am-2:30pm",
            "Dinner: 4:00pm-7:15pm",
            "Gelfenbien & Putnam Grab & Go's",
            "Monday-Thursday: 4:00pm-10:00pm",
            "Friday: 4:00pm-8:00pm"
          ]
        },
        {
          name: "McMahon",
          lines: [
            "Breakfast: 7:00am-10:45am",
            "Lunch: 11:00am-2:00pm",
            "Dinner: 3:30pm-7:15pm"
          ]
        },
        {
          name: "North & Whitney",
          lines: [
            "Breakfast: 7:00am-10:45am",
            "Lunch: 11:00am-3:00pm",
            "Dinner: 3:30pm-7:15pm"
          ]
        }
      ]
    },
    {
      title: "Weekend Hours",
      groups: [
        {
          name: "South",
          lines: [
            "Breakfast (Saturday): 7:00am-9:30am",
            "Breakfast (Sunday): 8:00am-9:30am",
            "Brunch: 9:30am-2:15pm",
            "Dinner: 3:45pm-7:15pm",
            "Late Night: South open until 10pm on Sunday"
          ]
        },
        {
          name: "Northwest",
          lines: [
            "Brunch: 10:30am-2:15pm",
            "Dinner: 3:45pm-7:15pm",
            "Late Night: Northwest open until 10pm on Sunday"
          ]
        },
        {
          name: "North & Whitney",
          lines: [
            "Brunch: 10:30am-3:00pm",
            "Dinner: 4:30pm-7:15pm"
          ]
        },
        {
          name: "McMahon",
          lines: [
            "Brunch: 10:30am-2:00pm",
            "Dinner: 3:30pm-7:15pm"
          ]
        },
        {
          name: "Gelfenbien & Putnam",
          lines: [
            "Brunch: 9:30am-2:30pm",
            "Dinner: 4:00pm-7:15pm"
          ]
        },
        {
          name: "Connecticut Hall",
          lines: [
            "Brunch: 10:30am-2:30pm",
            "Dinner: 4:00pm-7:15pm"
          ]
        }
      ]
    }
  ];

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

    const headerRow = mealEl.closest("table")?.parentElement?.parentElement;
    const itemsTable = headerRow?.nextElementSibling?.querySelector("table");
    const rows = itemsTable
      ? Array.from(itemsTable.querySelectorAll(":scope > tbody > tr, :scope > tr"))
      : [];

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

  const createInfoPage = (ctx) => {
    const page = ctx.createElement("div");
    page.className = "uconn-menu-info";

    const title = ctx.createElement("div");
    title.className = "uconn-menu-info__title";
    title.innerText = "Information";
    page.appendChild(title);

    INFO_PAGE_CONTENT.forEach((sectionData) => {
      const section = ctx.createElement("section");
      section.className = "uconn-menu-info__section";

      const heading = ctx.createElement("div");
      heading.className = "uconn-menu-info__section-title";
      heading.innerText = sectionData.title;
      section.appendChild(heading);

      const grid = ctx.createElement("div");
      grid.className = "uconn-menu-info__grid";

      sectionData.groups.forEach((group) => {
        const groupEl = ctx.createElement("div");
        groupEl.className = "uconn-menu-info__group";

        const groupTitle = ctx.createElement("div");
        groupTitle.className = "uconn-menu-info__group-title";
        groupTitle.innerText = group.name;
        groupEl.appendChild(groupTitle);

        group.lines.forEach((line) => {
          const lineEl = ctx.createElement("div");
          lineEl.className = "uconn-menu-info__line";
          lineEl.innerText = line;
          groupEl.appendChild(lineEl);
        });

        grid.appendChild(groupEl);
      });

      section.appendChild(grid);
      page.appendChild(section);
    });

    const footer = ctx.createElement("div");
    footer.className = "uconn-menu-info__footer";
    footer.innerText = "https://dining.uconn.edu/";
    page.appendChild(footer);

    return page;
  };

  const buildPoster = (ctx, data, { onPrint, onClose }) => {
    const overlay = ctx.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "uconn-menu-overlay";

    const printButton = ctx.createElement("button");
    printButton.type = "button";
    printButton.className = "uconn-menu-overlay__print";
    printButton.innerText = "Save / Print";
    printButton.addEventListener("click", onPrint);

    const dismiss = ctx.createElement("button");
    dismiss.type = "button";
    dismiss.className = "uconn-menu-overlay__close";
    dismiss.innerText = "×";
    dismiss.addEventListener("click", onClose);

    const topActions = ctx.createElement("div");
    topActions.className = "uconn-menu-overlay__top-actions";
    topActions.appendChild(printButton);
    topActions.appendChild(dismiss);

    const actions = ctx.createElement("div");
    actions.className = "uconn-menu-overlay__actions";

    const instructions = ctx.createElement("div");
    instructions.className = "uconn-menu-overlay__instructions";
    instructions.innerText = "Click items to toggle suggested (green). Double-click text to edit.";

    actions.appendChild(instructions);

    const poster = ctx.createElement("div");
    poster.id = POSTER_ID;
    poster.className = "uconn-menu-poster";

    const header = ctx.createElement("div");
    header.className = "uconn-menu-poster__header";

    const leftLogo = ctx.createElement("img");
    leftLogo.src = LOGO_PATH;
    leftLogo.alt = "UConn";
    leftLogo.className = "uconn-menu-poster__logo";

    const rightLogo = leftLogo.cloneNode();

    const headerText = ctx.createElement("div");
    headerText.className = "uconn-menu-poster__header-text";

    const title = ctx.createElement("div");
    title.className = "uconn-menu-poster__title";
    title.innerText = "Daily Menu";
    title.setAttribute("contenteditable", "true");

    const dateLine = ctx.createElement("div");
    dateLine.className = "uconn-menu-poster__date";
    dateLine.innerText = data.menuDate.short || data.menuDate.long || "";
    dateLine.setAttribute("contenteditable", "true");

    const subtitle = ctx.createElement("div");
    subtitle.className = "uconn-menu-poster__subtitle";
    subtitle.innerHTML = "Suggested Meals in <span class=\"uconn-menu-poster__subtitle-em\">GREEN</span>";
    subtitle.setAttribute("contenteditable", "true");

    headerText.appendChild(title);
    headerText.appendChild(dateLine);
    headerText.appendChild(subtitle);

    header.appendChild(leftLogo);
    header.appendChild(headerText);
    header.appendChild(rightLogo);

    const hall = ctx.createElement("div");
    hall.className = "uconn-menu-poster__hall";
    hall.innerText = data.hallName || "Dining Hall";
    hall.setAttribute("contenteditable", "true");

    const grid = ctx.createElement("div");
    grid.className = "uconn-menu-poster__grid";

    data.meals.forEach((meal) => {
      grid.appendChild(createMealColumn(ctx, meal));
    });

    poster.appendChild(header);
    poster.appendChild(hall);
    poster.appendChild(grid);

    overlay.appendChild(topActions);
    overlay.appendChild(actions);
    overlay.appendChild(poster);

    const infoPage = createInfoPage(ctx);
    overlay.appendChild(infoPage);

    overlay.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") {
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

  const ensureFonts = (ctxDoc = document) => {
    if (!ctxDoc?.head || ctxDoc.getElementById(FONTS_LINK_ID)) {
      return;
    }
    const link = ctxDoc.createElement("link");
    link.id = FONTS_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;600;700&display=swap";
    ctxDoc.head.appendChild(link);
  };

  const ensureStylesheet = (ctxDoc) => {
    if (!ctxDoc?.head || ctxDoc.getElementById(STYLESHEET_LINK_ID)) {
      return;
    }
    const link = ctxDoc.createElement("link");
    link.id = STYLESHEET_LINK_ID;
    link.rel = "stylesheet";
    const stylesheetURL = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("styles/content.css")
      : "styles/content.css";
    link.href = stylesheetURL;
    ctxDoc.head.appendChild(link);
  };

  const afterPrintCleanupAttached = new WeakSet();

  const setPrintingState = (ctxDoc, isPrinting) => {
    if (!ctxDoc?.body) {
      return;
    }
    if (isPrinting) {
      ctxDoc.body.dataset.uconnPrinting = "true";
    } else {
      delete ctxDoc.body.dataset.uconnPrinting;
    }
  };

  const ensureAfterPrintCleanup = (printWindow, ctxDoc) => {
    if (!printWindow || afterPrintCleanupAttached.has(printWindow)) {
      return;
    }
    printWindow.addEventListener("afterprint", () => setPrintingState(ctxDoc, false));
    afterPrintCleanupAttached.add(printWindow);
  };

  const printPoster = (printWindow, ctxDoc) => {
    const poster = ctxDoc?.getElementById(POSTER_ID);
    if (!poster) {
      (printWindow || window).alert("Poster not ready yet. Try generating it again.");
      return;
    }

    ensureAfterPrintCleanup(printWindow || window, ctxDoc);
    setPrintingState(ctxDoc, true);
    (printWindow || window).focus();
    (printWindow || window).print();
    (printWindow || window).setTimeout(() => setPrintingState(ctxDoc, false), 1500);
  };

  const openPoster = () => {
    const data = parseMenuData();
    if (!data.meals.length) {
      alert("UConn Menu Formatter: no menu data detected on this page.");
      return;
    }

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      alert("UConn Menu Formatter: pop-up blocked. Please allow pop-ups for this site.");
      return;
    }

    const previewDoc = previewWindow.document;
    previewDoc.open();
    previewDoc.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
    previewDoc.close();

    previewDoc.title = data.menuDate.long || data.hallName || "UConn Dining Menu";
    previewDoc.body.style.margin = "0";

    ensureStylesheet(previewDoc);
    ensureFonts(previewDoc);

    const closePreview = () => {
      setPrintingState(previewDoc, false);
      previewWindow.close();
    };

    const overlay = buildPoster(previewDoc, data, {
      onPrint: () => printPoster(previewWindow, previewDoc),
      onClose: closePreview
    });

    previewDoc.body.appendChild(overlay);
    previewWindow.focus();
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

  // Expose parser for debugging/testing without affecting runtime behaviour.
  if (typeof window !== "undefined") {
    window.__uconnMenuFormatter = Object.assign(
      window.__uconnMenuFormatter || {},
      { parseMenuData }
    );
  }
})();
