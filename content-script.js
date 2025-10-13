(() => {
  const POSTER_ID = "uconn-menu-poster";
  const TRIGGER_ID = "uconn-menu-poster-trigger";
  const FONTS_LINK_ID = "uconn-menu-poster-fonts";
  const STYLESHEET_LINK_ID = "uconn-menu-poster-styles";
  const LOGO_PATH = (() => {
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
      return chrome.runtime.getURL("images/logo.png");
    }
    if (typeof browser !== "undefined" && browser.runtime && typeof browser.runtime.getURL === "function") {
      return browser.runtime.getURL("images/logo.png");
    }
    return "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/University_of_Connecticut_seal.svg/1200px-University_of_Connecticut_seal.svg.png";
  })();
  const MENU_SECTION_SELECTOR = ".shortmenumeals";
  const NUTRITION_LINK_SELECTOR = "#pg-60-3 a[href*='shortmenu.aspx']";
  const DATE_PICKER_ID = "uconn-menu-date-picker";
  const TRIGGER_WRAPPER_ID = "uconn-menu-trigger-wrapper";
  const TRIGGER_BUSY_TEXT = "Generating...";
  const MAX_MEAL_ITEMS_PER_COLUMN = 10;
  const MIN_MEAL_COLUMNS = 1;
  const AUTO_FONT_MIN = -24;
  const AUTO_FONT_STEP = 1;
  const AUTO_SPACE_STEP = 2;
  const AUTO_SPACE_MAX = 40;
  let triggerButton = null;
  let isGenerating = false;
  const domParser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  let datePickerInput = null;
  let selectedDateIso = null;
  let allowedDateRange = null;

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

  const HIGHLIGHT_COLORS = {
    green: "#22c55e",
    blue: "#0b2c6a",
    white: "#ffffff",
    black: "#000000"
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

  const parseMenuData = (rootDoc = document) => {
    const scope = rootDoc || document;
    const hallName = cleanText(scope.querySelector(".headlocation")?.textContent || "");
    const titleText = cleanText(scope.querySelector(".shortmenutitle")?.textContent || "");
    const menuDate = parsePosterDate(titleText);

    const meals = [];
    scope.querySelectorAll(".shortmenumeals").forEach((mealEl) => {
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

  /**
   * Calculates the selectable date range so the picker covers the current week and the next.
   */
  const getSelectableDateRange = () => {
    // Returning null removes date range restrictions.
    // The original implementation limited selection to the current and next week.
    return { start: null, end: null };
  };

  const formatDateToIso = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isIsoDateWithinRange = (isoDate, range) => {
    if (!isoDate || !range?.start || !range?.end) {
      return false;
    }
    const probe = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(probe.valueOf())) {
      return false;
    }
    return probe >= range.start && probe <= range.end;
  };

  const formatIsoDateForQuery = (isoDate) => {
    if (!isoDate) {
      return null;
    }
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) {
      return null;
    }
    const numericMonth = Number.parseInt(month, 10);
    const numericDay = Number.parseInt(day, 10);
    if (Number.isNaN(numericMonth) || Number.isNaN(numericDay)) {
      return null;
    }
    return `${numericMonth}/${numericDay}/${year}`;
  };

  const normalizeUrl = (href) => {
    if (!href) {
      return null;
    }
    try {
      return new URL(href, document.baseURI).href;
    } catch (error) {
      console.warn("[UConn Menu Formatter] Skipping invalid URL", href, error);
      return null;
    }
  };

  const applySelectedDateToUrl = (url) => {
    if (!url || !selectedDateIso) {
      return url;
    }
    const queryDate = formatIsoDateForQuery(selectedDateIso);
    if (!queryDate) {
      return url;
    }
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("dtdate", queryDate);
      return urlObj.toString();
    } catch (error) {
      console.warn("[UConn Menu Formatter] Unable to apply date to URL", url, error);
      return url;
    }
  };

  const collectNutritionMenuLinks = () => {
    return Array.from(document.querySelectorAll(NUTRITION_LINK_SELECTOR))
      .filter((anchor) => {
        const label = cleanText(anchor.textContent || anchor.innerText || "");
        return label.toUpperCase() !== "EVERYDAY ITEMS";
      })
      .map((anchor) => normalizeUrl(anchor.getAttribute("href")))
      .filter((href, index, arr) => href && arr.indexOf(href) === index);
  };

  const sendBackgroundFetch = (url) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id || !chrome.runtime?.sendMessage) {
      return Promise.reject(new Error("extension messaging unavailable"));
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "uconn-menu-fetch", url }, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || "Messaging failed"));
          return;
        }
        if (!response) {
          reject(new Error("Empty response from background"));
          return;
        }
        if (response.success && typeof response.html === "string") {
          resolve(response.html);
        } else {
          reject(new Error(response.error || "Background fetch failed"));
        }
      });
    });
  };

  const fetchMenuHtml = async (url) => {
    try {
      return await sendBackgroundFetch(url);
    } catch (error) {
      console.warn("[UConn Menu Formatter] Background fetch failed, retrying in-page", url, error);
    }

    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to load menu (${error.message || error})`);
    }
  };

  const fetchMenuDocument = async (url) => {
    if (!domParser) {
      throw new Error("DOMParser unavailable");
    }
    const html = await fetchMenuHtml(url);
    return domParser.parseFromString(html, "text/html");
  };

  const gatherNutritionMenus = async () => {
    const links = collectNutritionMenuLinks();
    if (!links.length) {
      return { menus: [], errors: [] };
    }

    const errors = [];
    const results = await Promise.all(
      links.map(async (originalUrl) => {
        const url = applySelectedDateToUrl(originalUrl);
        try {
          const menuDoc = await fetchMenuDocument(url);
          const data = parseMenuData(menuDoc);
          if (!data.meals.length) {
            throw new Error("no menu data detected");
          }
          return data;
        } catch (error) {
          errors.push({ url, error });
          return null;
        }
      })
    );

    return {
      menus: results.filter(Boolean),
      errors
    };
  };

  const setTriggerState = (state) => {
    if (!triggerButton) {
      return;
    }
    if (state === "busy") {
      if (!triggerButton.dataset.originalText) {
        triggerButton.dataset.originalText = triggerButton.innerText;
      }
      triggerButton.disabled = true;
      triggerButton.innerText = TRIGGER_BUSY_TEXT;
      triggerButton.classList.add("is-loading");
    } else {
      triggerButton.disabled = false;
      triggerButton.innerText = triggerButton.dataset.originalText || "Generate Poster";
      triggerButton.classList.remove("is-loading");
    }
  };

  /**
   * Distributes meal cards into dynamically sized columns while preserving category order.
   */
  const distributeMealItemsIntoColumns = (ctx, container, entries) => {
    if (!container) {
      return;
    }

    container.textContent = "";
    const totalItems = Array.isArray(entries) ? entries.length : 0;
    const computedColumnCount = totalItems
      ? Math.max(MIN_MEAL_COLUMNS, Math.ceil(totalItems / MAX_MEAL_ITEMS_PER_COLUMN))
      : MIN_MEAL_COLUMNS;
    container.style.setProperty("--uconn-meal-columns", String(computedColumnCount));
    const baseTarget = Math.floor(totalItems / computedColumnCount);
    const remainder = totalItems % computedColumnCount;

    const columns = [];
    for (let index = 0; index < computedColumnCount; index += 1) {
      const column = ctx.createElement("div");
      column.className = "uconn-menu-meal__column";
      container.appendChild(column);
      columns.push({
        el: column,
        itemCount: 0,
        lastCategory: null,
        target: baseTarget + (index < remainder ? 1 : 0)
      });
    }

    if (!totalItems) {
      return;
    }

    let columnIndex = 0;
    entries.forEach((entry) => {
      if (!entry || !entry.element) {
        return;
      }

      while (
        columnIndex < columns.length - 1 &&
        columns[columnIndex].itemCount >= columns[columnIndex].target
      ) {
        columnIndex += 1;
      }

      const column = columns[columnIndex];
      const categoryName = typeof entry.category === "string" && entry.category.trim() ? entry.category : null;

      if (categoryName) {
        if (column.lastCategory !== categoryName) {
          const categoryLabel = ctx.createElement("div");
          categoryLabel.className = "uconn-menu-item__category";
          categoryLabel.innerText = categoryName;
          categoryLabel.setAttribute("contenteditable", "true");
          column.el.appendChild(categoryLabel);
          column.lastCategory = categoryName;
        }
      } else {
        column.lastCategory = null;
      }

      column.el.appendChild(entry.element);
      column.itemCount += 1;
    });
  };

  /**
   * Adds a delete control to an individual dish card and removes orphaned category labels.
   */
  const attachDishDeleteControl = (ctx, card) => {
    if (!ctx || !card) {
      return;
    }

    const deleteButton = ctx.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "uconn-menu-item__delete";
    deleteButton.setAttribute("aria-label", "Remove dish");
    deleteButton.innerText = "×";
    deleteButton.addEventListener("click", (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      const parentColumn = card.parentElement;
      if (!parentColumn) {
        card.remove();
        return;
      }

      let categoryLabel = null;
      let previous = card.previousElementSibling;
      while (previous) {
        if (previous.classList && previous.classList.contains("uconn-menu-item__category")) {
          categoryLabel = previous;
          break;
        }
        if (previous.classList && previous.classList.contains("uconn-menu-item")) {
          break;
        }
        previous = previous.previousElementSibling;
      }

      card.remove();

      if (!categoryLabel || categoryLabel.parentElement !== parentColumn) {
        return;
      }

      let sibling = categoryLabel.nextElementSibling;
      while (sibling && !(sibling.classList && sibling.classList.contains("uconn-menu-item__category"))) {
        if (sibling.classList && sibling.classList.contains("uconn-menu-item")) {
          return;
        }
        sibling = sibling.nextElementSibling;
      }

      categoryLabel.remove();
    });

    card.appendChild(deleteButton);
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

    const entries = [];
    meal.items.forEach((item) => {
      const categoryName = typeof item.category === "string" ? item.category.trim() : null;
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

      entries.push({
        category: categoryName,
        element: card
      });

      attachDishDeleteControl(ctx, card);
    });

    distributeMealItemsIntoColumns(ctx, list, entries);
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

  /**
   * Waits for the next animation frame so layout updates settle before snapshotting.
   */
  const waitForNextFrame = (ctxWindow) => {
    return new Promise((resolve) => {
      const targetWindow = ctxWindow || window;
      if (targetWindow && typeof targetWindow.requestAnimationFrame === "function") {
        targetWindow.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 16);
    });
  };

  /**
   * Awaits document font loading to keep measurements consistent for printing.
   */
  const waitForFontsReady = async (ctxDoc) => {
    const fontSet = ctxDoc?.fonts;
    if (!fontSet) {
      return;
    }
    const readyPromise = fontSet.ready;
    if (readyPromise && typeof readyPromise.then === "function") {
      try {
        await readyPromise;
      } catch (error) {
        console.warn("[UConn Menu Formatter] Font loading did not complete", error);
      }
    }
  };

  /**
   * Automatically shrinks page typography and spacing until each poster fits the fixed canvas height.
   */
  const applyAutoFontScaling = (ctxWindow, ctxDoc) => {
    return new Promise((resolve) => {
      if (!ctxDoc) {
        resolve();
        return;
      }

      const schedule = ctxWindow && typeof ctxWindow.requestAnimationFrame === "function"
        ? ctxWindow.requestAnimationFrame.bind(ctxWindow)
        : ctxDoc.defaultView && typeof ctxDoc.defaultView.requestAnimationFrame === "function"
          ? ctxDoc.defaultView.requestAnimationFrame.bind(ctxDoc.defaultView)
          : (fn) => setTimeout(fn, 0);

      schedule(() => {
        try {
          const pages = Array.from(ctxDoc.querySelectorAll(".uconn-menu-page--poster"));
          pages.forEach((page) => {
            const poster = page.querySelector(".uconn-menu-poster");
            if (!poster) {
              return;
            }

            page.style.setProperty("--uconn-font-scale-auto", "0px");
            page.style.setProperty("--uconn-space-mod-auto", "0px");
            const availableHeight = poster.clientHeight;
            if (!availableHeight) {
              return;
            }

            let iterations = 0;
            while (poster.scrollHeight > availableHeight && iterations < 48) {
              const currentScale = Number.parseFloat(page.style.getPropertyValue("--uconn-font-scale-auto") || "0") || 0;
              if (currentScale <= AUTO_FONT_MIN) {
                page.style.setProperty("--uconn-font-scale-auto", `${AUTO_FONT_MIN}px`);
                page.style.setProperty("--uconn-space-mod-auto", `${AUTO_SPACE_MAX}px`);
                break;
              }

              const nextScale = currentScale - AUTO_FONT_STEP;
              page.style.setProperty("--uconn-font-scale-auto", `${nextScale}px`);
              const currentSpace = Number.parseFloat(page.style.getPropertyValue("--uconn-space-mod-auto") || "0") || 0;
              const nextSpace = Math.min(AUTO_SPACE_MAX, currentSpace + AUTO_SPACE_STEP);
              page.style.setProperty("--uconn-space-mod-auto", `${nextSpace}px`);
              poster.getBoundingClientRect();
              iterations += 1;
            }
          });
        } finally {
          resolve();
        }
      });
    });
  };

  const buildPosterPage = (ctx, data, options = {}) => {
    const { assignId = false } = options;
    const page = ctx.createElement("section");
    page.className = "uconn-menu-page uconn-menu-page--poster";

    const poster = ctx.createElement("div");
    poster.className = "uconn-menu-poster";
    if (assignId) {
      poster.id = POSTER_ID;
    }

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

    page.appendChild(poster);

    return page;
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

  /**
   * Toggles the preview toolbar visibility when preparing to print.
   */
  const setToolbarHiddenForPrint = (ctxDoc, hidden) => {
    const toolbar = ctxDoc?.querySelector?.(".uconn-menu-toolbar");
    if (!toolbar) {
      return;
    }
    if (hidden) {
      toolbar.classList.add("uconn-menu-toolbar--hidden-for-print");
    } else {
      toolbar.classList.remove("uconn-menu-toolbar--hidden-for-print");
    }
  };

  const setPrintingState = (ctxDoc, isPrinting) => {
    if (!ctxDoc?.body) {
      return;
    }
    if (isPrinting) {
      ctxDoc.body.dataset.uconnPrinting = "true";
    } else {
      delete ctxDoc.body.dataset.uconnPrinting;
    }
    setToolbarHiddenForPrint(ctxDoc, Boolean(isPrinting));
  };

  const printPoster = async (previewWindow, ctxDoc) => {
    const ctxWindow = previewWindow || window;
    const pagesContainer = ctxDoc?.querySelector(".uconn-menu-pages");
    if (!pagesContainer) {
      ctxWindow.alert("Poster not ready yet. Try generating it again.");
      return;
    }

    setPrintingState(ctxDoc, true);

    try {
      await waitForFontsReady(ctxDoc);
      await waitForNextFrame(ctxWindow);
      await applyAutoFontScaling(ctxWindow, ctxDoc);
      await waitForNextFrame(ctxWindow);
      ctxWindow.focus();
      ctxWindow.print();
    } catch (error) {
      ctxWindow.console?.error?.("[UConn Menu Formatter] Failed to launch print dialog", error);
      ctxWindow.alert("UConn Menu Formatter: unable to start printing. Please try again.");
    } finally {
      setPrintingState(ctxDoc, false);
    }
  };

  const renderPreview = (menuDataList, options = {}) => {
    const { errors = [] } = options;
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      throw new Error("pop-up blocked. Please allow pop-ups for this site.");
    }

    const previewDoc = previewWindow.document;
    previewDoc.open();
    previewDoc.write("<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
    previewDoc.close();

    const firstMenu = menuDataList[0];
    const hallNames = menuDataList.map((item) => item.hallName).filter(Boolean);
    const uniqueHallNames = hallNames.filter((value, index, arr) => arr.indexOf(value) === index);
    const titleParts = [];
    if (uniqueHallNames.length) {
      titleParts.push(uniqueHallNames.join(", "));
    }
    if (firstMenu?.menuDate?.long) {
      titleParts.push(firstMenu.menuDate.long);
    }
    previewDoc.title = titleParts.length ? titleParts.join(" | ") : "UConn Dining Menu";
    previewDoc.body.style.margin = "0";
    previewDoc.body.classList.add("uconn-menu-preview");
    ensureStylesheet(previewDoc);
    ensureFonts(previewDoc);
    const handleBeforePrint = () => setPrintingState(previewDoc, true);
    const handleAfterPrint = () => setPrintingState(previewDoc, false);
    previewWindow.addEventListener("beforeprint", handleBeforePrint);
    previewWindow.addEventListener("afterprint", handleAfterPrint);
    previewWindow.addEventListener("unload", () => {
      previewWindow.removeEventListener("beforeprint", handleBeforePrint);
      previewWindow.removeEventListener("afterprint", handleAfterPrint);
    });
    const closePreview = () => {
      setPrintingState(previewDoc, false);
      previewWindow.close();
    };

    const documentRoot = previewDoc.createElement("div");
    documentRoot.className = "uconn-menu-document";

    const toolbar = previewDoc.createElement("header");
    toolbar.className = "uconn-menu-toolbar";

    const instructions = previewDoc.createElement("div");
    instructions.className = "uconn-menu-toolbar__instructions";
    instructions.innerText = "Select text to apply color. Double-click to edit.";

    const actions = previewDoc.createElement("div");
    actions.className = "uconn-menu-toolbar__actions";

    const fontSmallerButton = previewDoc.createElement("button");
    fontSmallerButton.type = "button";
    fontSmallerButton.className = "uconn-menu-toolbar__button";
    fontSmallerButton.innerHTML = "&ndash;";
    fontSmallerButton.title = "Decrease font size";
    fontSmallerButton.addEventListener("click", () => {
      const pages = previewDoc.querySelector(".uconn-menu-pages");
      if (!pages) return;
      // Adjust the CSS variable used throughout the stylesheet so all text scales together.
      const computed = (previewWindow && typeof previewWindow.getComputedStyle === 'function')
        ? previewWindow.getComputedStyle(pages)
        : previewDoc.defaultView.getComputedStyle(pages);
      const current = computed.getPropertyValue("--uconn-font-scale-mod") || "0px";
      const currentVal = Number.parseFloat(current) || 0;
      const newVal = Math.max(-20, currentVal - 1);
      pages.style.setProperty("--uconn-font-scale-mod", `${newVal}px`);
      // Also reduce spacing (gaps/padding). Space reduction increases as font scale decreases.
      const currentSpace = Number.parseFloat(computed.getPropertyValue("--uconn-space-mod") || "0") || 0;
      const newSpace = Math.min(40, currentSpace + 2); // cap reduction
      pages.style.setProperty("--uconn-space-mod", `${newSpace}px`);
    });

    const fontBiggerButton = previewDoc.createElement("button");
    fontBiggerButton.type = "button";
    fontBiggerButton.className = "uconn-menu-toolbar__button";
    fontBiggerButton.innerHTML = "+";
    fontBiggerButton.title = "Increase font size";
    fontBiggerButton.addEventListener("click", () => {
      const pages = previewDoc.querySelector(".uconn-menu-pages");
      if (!pages) return;
      const computed = (previewWindow && typeof previewWindow.getComputedStyle === 'function')
        ? previewWindow.getComputedStyle(pages)
        : previewDoc.defaultView.getComputedStyle(pages);
      const current = computed.getPropertyValue("--uconn-font-scale-mod") || "0px";
      const currentVal = Number.parseFloat(current) || 0;
      const newVal = Math.min(20, currentVal + 1);
      pages.style.setProperty("--uconn-font-scale-mod", `${newVal}px`);
      // Restore spacing when increasing font size.
      const currentSpace = Number.parseFloat(computed.getPropertyValue("--uconn-space-mod") || "0") || 0;
      const newSpace = Math.max(0, currentSpace - 2);
      pages.style.setProperty("--uconn-space-mod", `${newSpace}px`);
    });

    const colorPalette = previewDoc.createElement("div");
    colorPalette.className = "uconn-menu-toolbar__color-palette";

    const applyColor = (color) => {
      const selection = previewDoc.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) {
        return;
      }
      // Use execCommand to wrap the selection. It's the most reliable way for contenteditable.
      previewDoc.execCommand("styleWithCSS", false, true);
      previewDoc.execCommand("foreColor", false, color);
    };

    Object.entries(HIGHLIGHT_COLORS).forEach(([name, color]) => {
      const swatch = previewDoc.createElement("button");
      swatch.type = "button";
      swatch.className = "uconn-menu-toolbar__color-swatch";
      swatch.title = `Set color to ${name}`;
      swatch.style.backgroundColor = color;
      if (name === "white") {
        swatch.style.border = "1px solid rgba(31, 41, 55, 0.35)";
      }
      swatch.addEventListener("click", () => applyColor(color));
      colorPalette.appendChild(swatch);
    });

    const fontControls = previewDoc.createElement("div");
    fontControls.className = "uconn-menu-toolbar__font-controls";
    fontControls.appendChild(fontSmallerButton);
    fontControls.appendChild(fontBiggerButton);

    const printButton = previewDoc.createElement("button");
    printButton.type = "button";
    printButton.className = "uconn-menu-toolbar__button uconn-menu-toolbar__button--primary";
    printButton.innerText = "Print / Save PDF";
    printButton.addEventListener("click", () => {
      printButton.disabled = true;
      printButton.classList.add("is-disabled");
      Promise.resolve(printPoster(previewWindow, previewDoc)).finally(() => {
        printButton.disabled = false;
        printButton.classList.remove("is-disabled");
      });
    });

    const closeButton = previewDoc.createElement("button");
    closeButton.type = "button";
    closeButton.className = "uconn-menu-toolbar__button uconn-menu-toolbar__button--secondary";
    closeButton.innerText = "Close";
    closeButton.addEventListener("click", closePreview);

    actions.appendChild(fontControls);
    actions.appendChild(colorPalette);
    actions.appendChild(printButton);
    actions.appendChild(closeButton);

    toolbar.appendChild(instructions);
    toolbar.appendChild(actions);

    const pages = previewDoc.createElement("main");
    pages.className = "uconn-menu-pages";
    // Set a default font-size so adjustments via the toolbar take effect reliably.
    pages.style.fontSize = "16px";

    menuDataList.forEach((menuData, index) => {
      const posterPage = buildPosterPage(previewDoc, menuData, { assignId: index === 0 });
      pages.appendChild(posterPage);
    });

    const infoPage = createInfoPage(previewDoc);
    infoPage.classList.add("uconn-menu-page", "uconn-menu-page--info");
    pages.appendChild(infoPage);

    documentRoot.appendChild(toolbar);
    documentRoot.appendChild(pages);

    previewDoc.body.appendChild(documentRoot);
    applyAutoFontScaling(previewWindow, previewDoc);
    previewWindow.focus();

    if (errors.length) {
      const errorMessage = errors
        .map((entry) => `${entry.url}: ${entry.error?.message || entry.error || "unknown error"}`)
        .join("\n");
      previewWindow.console?.warn?.("[UConn Menu Formatter] Some menus failed to load", errorMessage);
      setTimeout(() => {
        const message = `UConn Menu Formatter: some menus could not be loaded.\n\n${errorMessage}`;
        if (previewWindow.closed) {
          alert(message);
        } else {
          previewWindow.alert(message);
        }
      }, 250);
    }
  };

  const openPoster = async () => {
    if (isGenerating) {
      return;
    }

    const isMenuPage = Boolean(document.querySelector(MENU_SECTION_SELECTOR));
    isGenerating = true;
    setTriggerState("busy");

    try {
      if (isMenuPage) {
        const currentUrl = window.location?.href;
        const targetUrl = applySelectedDateToUrl(currentUrl);
        let data;
        if (targetUrl && targetUrl !== currentUrl) {
          const menuDoc = await fetchMenuDocument(targetUrl);
          data = parseMenuData(menuDoc);
        } else {
          data = parseMenuData(document);
        }
        if (!data.meals.length) {
          throw new Error("no menu data detected on this page.");
        }
        renderPreview([data]);
        return;
      }

      const { menus, errors } = await gatherNutritionMenus();
      if (!menus.length) {
        const message = errors.length
          ? `${errors.length} menu${errors.length === 1 ? "" : "s"} failed to load.`
          : "no links detected on this page.";
        throw new Error(`Unable to prepare menus: ${message}`);
      }

      renderPreview(menus, { errors });
    } catch (error) {
      alert(`UConn Menu Formatter: ${error.message || error}`);
    } finally {
      isGenerating = false;
      setTriggerState("idle");
    }
  };

  const handleDateChange = (event) => {
    const value = (event.target?.value || "").trim();
    if (!value) {
      event.target.value = selectedDateIso || "";
      return;
    }

    selectedDateIso = value;
  };

  const ensureDatePicker = () => {
    if (datePickerInput && document.getElementById(DATE_PICKER_ID)) {
      return;
    }

    allowedDateRange = getSelectableDateRange();
    const previousSelection = selectedDateIso;
    const todayIso = formatDateToIso(new Date());
    selectedDateIso = previousSelection || todayIso;

    const existingInput = document.getElementById(DATE_PICKER_ID);
    if (existingInput) {
      datePickerInput = existingInput;
    } else {
      datePickerInput = document.createElement("input");
      datePickerInput.type = "date";
      datePickerInput.id = DATE_PICKER_ID;
      datePickerInput.className = "uconn-menu-trigger__date-input";
      datePickerInput.addEventListener("change", handleDateChange);
    }

    const minIso = formatDateToIso(allowedDateRange.start);
    const maxIso = formatDateToIso(allowedDateRange.end);
    datePickerInput.min = minIso || "";
    datePickerInput.max = maxIso || "";
    if (selectedDateIso) {
      datePickerInput.value = selectedDateIso;
    }
  };

  const injectTrigger = () => {
    ensureDatePicker();

    let wrapper = document.getElementById(TRIGGER_WRAPPER_ID);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = TRIGGER_WRAPPER_ID;
      wrapper.className = "uconn-menu-trigger-wrapper";
      document.body.appendChild(wrapper);
    }

    let label = wrapper.querySelector(".uconn-menu-trigger__date-label");
    if (!label) {
      label = document.createElement("label");
      label.setAttribute("for", DATE_PICKER_ID);
      label.className = "uconn-menu-trigger__date-label";
      label.innerText = "Menu date";
      wrapper.appendChild(label);
    }

    if (datePickerInput.parentElement !== label) {
      label.appendChild(datePickerInput);
    }

    let button = document.getElementById(TRIGGER_ID);
    if (!button) {
      button = document.createElement("button");
      button.id = TRIGGER_ID;
      button.type = "button";
      button.innerText = "Generate Poster";
      button.className = "uconn-menu-trigger";
      button.dataset.originalText = button.innerText;
      button.addEventListener("click", () => {
        openPoster();
      });
    } else if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerText;
    }

    if (!wrapper.contains(button)) {
      wrapper.appendChild(button);
    }
    triggerButton = button;
  };

  const bootstrap = () => {
    if (!document.querySelector(MENU_SECTION_SELECTOR) && collectNutritionMenuLinks().length === 0) {
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
