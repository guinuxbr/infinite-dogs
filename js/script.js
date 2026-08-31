// @ts-check

/**
 * @fileoverview Infinite Dogs - Core Application Logic & Services
 * ================================================================
 * This client-side module powers the Infinite Dogs application. It connects to the
 * public Dog CEO REST API (https://dog.ceo/dog-api/) to provide an infinite scrolling
 * gallery of dog pictures with breed filtering, full-screen lightbox exploration,
 * local favorites management, dark/light theme switching, and keyboard navigation.
 *
 * Architecture Overview:
 * ----------------------
 * 1. Storage & State: Manages application state, theme persistence, and localStorage favorites.
 * 2. Theme Management: Handles dark/light theme switching and system preference auto-detection.
 * 3. Breed Formatter: Normalizes and formats URL slugs (e.g. "retriever-golden") into readable names.
 * 4. Toast Notifications: Non-blocking floating status alerts.
 * 5. Dog API Services: Asynchronous fetch clients for breed listings and photo batches.
 * 6. Gallery & Cards: DOM factory for dog cards with lazy loading, skeleton loaders, and action overlays.
 * 7. Lightbox Modal: Full-screen interactive viewer with image preloading and next/previous controls.
 * 8. Favorites System: LocalStorage-backed bookmarking system with an interactive modal manager.
 * 9. Shortcuts & Modals: Centralized keyboard shortcuts and accessibility dialog handlers.
 * 10. Service Worker: PWA offline caching registration.
 *
 * @author Guilherme Marques (https://guinuxbr.com)
 * @license GNU GPLv3
 */

// ==========================================================================
// Type Definitions (JSDoc Data Models)
// ==========================================================================

/**
 * Represents a single dog photo item loaded from the Dog API.
 * @typedef {Object} DogPhoto
 * @property {string} id - Unique identifier for the dog (currently the image URL).
 * @property {string} url - Direct HTTPS URL to the dog photograph on Dog CEO CDN.
 * @property {string} rawBreed - Raw breed slug extracted from URL path (e.g. "retriever-golden").
 * @property {string} breed - Formatted, human-readable breed title (e.g. "Golden Retriever").
 */

/**
 * Represents a dog bookmark saved in localStorage.
 * @typedef {Object} FavoriteDog
 * @property {string} url - Direct HTTPS URL to the dog photograph.
 * @property {string} breed - Formatted breed name.
 * @property {number} savedAt - Epoch timestamp (ms) when the item was favorited.
 */

/**
 * Represents a breed option entry in the dropdown filter list.
 * @typedef {Object} BreedOption
 * @property {string} value - API slug or path (e.g. "hound" or "retriever/golden").
 * @property {string} label - Human-readable label displayed in UI (e.g. "Golden Retriever").
 * @property {string} key - Normalized lowercase search token for quick filtering.
 */

/**
 * Raw response format returned by the Dog API breeds list endpoint.
 * @typedef {Object} BreedListApiResponse
 * @property {Record<string, string[]>} message - Dictionary mapping main breeds to array of sub-breeds.
 * @property {string} status - API status indicator ("success" or "error").
 */

/**
 * Raw response format returned by the Dog API random images endpoints.
 * @typedef {Object} RandomImagesApiResponse
 * @property {string[]} message - Array of image URL strings.
 * @property {string} status - API status indicator ("success" or "error").
 */

/**
 * Allowed color theme modes.
 * @typedef {"system" | "light" | "dark"} ThemeMode
 */

/**
 * Allowed toast alert severity types.
 * @typedef {"info" | "success" | "error"} ToastType
 */

// ==========================================================================
// DOM Element References
// ==========================================================================

/**
 * Centralized dictionary of cached DOM element references.
 */
const dom = {
  // --- Header Navigation & Tools ---
  btnThemeToggle: /** @type {HTMLButtonElement} */ (document.getElementById("btn-theme-toggle")),
  iconTheme: /** @type {HTMLElement} */ (document.getElementById("icon-theme")),
  btnFavoritesToggle: /** @type {HTMLButtonElement} */ (document.getElementById("btn-favorites-toggle")),
  favoritesBadge: /** @type {HTMLElement} */ (document.getElementById("favorites-badge")),
  btnShortcutsToggle: /** @type {HTMLButtonElement} */ (document.getElementById("btn-shortcuts-toggle")),

  // --- Controls Deck ---
  selectBreed: /** @type {HTMLSelectElement} */ (document.getElementById("select-breed")),
  inputSearch: /** @type {HTMLInputElement} */ (document.getElementById("input-search")),
  btnClear: /** @type {HTMLButtonElement} */ (document.getElementById("btn-clear")),
  quickTagsList: /** @type {HTMLElement} */ (document.getElementById("quick-tags-list")),
  btnFetchMore: /** @type {HTMLButtonElement} */ (document.getElementById("btn-fetch-more")),
  btnFetchText: /** @type {HTMLElement} */ (document.getElementById("btn-fetch-text")),
  btnRefresh: /** @type {HTMLButtonElement} */ (document.getElementById("btn-refresh")),
  toggleInfinite: /** @type {HTMLInputElement} */ (document.getElementById("toggle-infinite")),
  layoutBtns: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(".btn-layout")),

  // --- Status & Statistics ---
  statCount: /** @type {HTMLElement} */ (document.getElementById("stat-count")),
  activeFilterBadge: /** @type {HTMLElement} */ (document.getElementById("active-filter-badge")),
  filterName: /** @type {HTMLElement} */ (document.getElementById("filter-name")),
  btnResetFilter: /** @type {HTMLButtonElement} */ (document.getElementById("btn-reset-filter")),
  statusMessage: /** @type {HTMLElement} */ (document.getElementById("status-message")),

  // --- Gallery Section ---
  imageContainer: /** @type {HTMLElement} */ (document.getElementById("image-container")),
  gallerySkeleton: /** @type {HTMLElement} */ (document.getElementById("gallery-skeleton")),
  loader: /** @type {HTMLElement} */ (document.getElementById("loader")),
  manualLoadMore: /** @type {HTMLElement} */ (document.getElementById("manual-load-more")),
  btnManualMore: /** @type {HTMLButtonElement} */ (document.getElementById("btn-manual-more")),

  // --- Fullscreen Lightbox Modal ---
  modalLightbox: /** @type {HTMLElement} */ (document.getElementById("modal-lightbox")),
  btnCloseLightbox: /** @type {HTMLButtonElement} */ (document.getElementById("btn-close-lightbox")),
  btnLightboxPrev: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-prev")),
  btnLightboxNext: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-next")),
  lightboxImg: /** @type {HTMLImageElement} */ (document.getElementById("lightbox-img")),
  lightboxLoader: /** @type {HTMLElement} */ (document.getElementById("lightbox-loader")),
  lightboxBreedBadge: /** @type {HTMLElement} */ (document.getElementById("lightbox-breed-badge")),
  lightboxBreedTitle: /** @type {HTMLElement} */ (document.getElementById("lightbox-breed-title")),
  lightboxCounter: /** @type {HTMLElement} */ (document.getElementById("lightbox-counter")),
  btnLightboxFav: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-fav")),
  iconLightboxFav: /** @type {HTMLElement} */ (document.getElementById("icon-lightbox-fav")),
  labelLightboxFav: /** @type {HTMLElement} */ (document.getElementById("label-lightbox-fav")),
  btnLightboxCopy: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-copy")),
  btnLightboxDownload: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-download")),
  btnLightboxShare: /** @type {HTMLButtonElement} */ (document.getElementById("btn-lightbox-share")),

  // --- Favorites Manager Modal ---
  modalFavorites: /** @type {HTMLElement} */ (document.getElementById("modal-favorites")),
  btnCloseFavorites: /** @type {HTMLButtonElement} */ (document.getElementById("btn-close-favorites")),
  btnCloseFavoritesAlt: /** @type {HTMLButtonElement} */ (document.getElementById("btn-close-favorites-alt")),
  favoritesListContainer: /** @type {HTMLElement} */ (document.getElementById("favorites-list-container")),
  btnClearAllFavorites: /** @type {HTMLButtonElement} */ (document.getElementById("btn-clear-all-favorites")),

  // --- Keyboard Shortcuts Modal ---
  modalShortcuts: /** @type {HTMLElement} */ (document.getElementById("modal-shortcuts")),
  btnCloseShortcuts: /** @type {HTMLButtonElement} */ (document.getElementById("btn-close-shortcuts")),
  btnCloseShortcutsAlt: /** @type {HTMLButtonElement} */ (document.getElementById("btn-close-shortcuts-alt")),

  // --- Floating Elements ---
  btnScrollTop: /** @type {HTMLButtonElement} */ (document.getElementById("btn-scroll-top")),
  toastContainer: /** @type {HTMLElement} */ (document.getElementById("toast-container")),
};

// ==========================================================================
// Application State
// ==========================================================================

/**
 * Global reactive runtime state.
 */
const state = {
  /** @type {Record<string, string[]>} Full raw breed hierarchy mapping from Dog CEO API */
  allBreeds: {},

  /** @type {BreedOption[]} Formatted list of breed options for select dropdown & search */
  breedOptions: [],

  /** @type {string} Currently selected breed slug (e.g. "" for random, or "retriever-golden") */
  selectedBreed: "",

  /** @type {string} Active search keyword filtering the breed dropdown */
  searchFilter: "",

  /** @type {DogPhoto[]} Array of all dog objects currently rendered in the active gallery */
  loadedDogs: [],

  /** @type {number} Index of currently displayed dog in the lightbox modal (-1 if closed) */
  currentLightboxIndex: -1,

  /** @type {boolean} Indicates if a network fetch operation is currently in flight */
  isLoading: false,

  /** @type {boolean} True once the initial startup batch of dogs has finished loading */
  isInitialLoaded: false,

  /** @type {boolean} Whether automatic loading upon scrolling near page bottom is active */
  infiniteScroll: true,

  /** @type {FavoriteDog[]} Array of bookmarked favorite dogs saved in localStorage */
  favorites: [],

  /** @type {ThemeMode} Current active theme mode */
  theme: "system",

  /** @type {AbortController | null} Controller for canceling pending in-flight fetch requests */
  activeAbortController: null,
};

// ==========================================================================
// LocalStorage Keys
// ==========================================================================

/**
 * Storage keys used for client-side persistence in localStorage.
 * @readonly
 * @enum {string}
 */
const STORAGE_KEYS = {
  FAVORITES: "infinite_dogs_favorites_v1",
  THEME: "infinite_dogs_theme_v1",
  INFINITE: "infinite_dogs_infinite_scroll_v1",
  LAYOUT: "infinite_dogs_layout_v1",
};

// ==========================================================================
// 1. Storage & State Initialization
// ==========================================================================

/**
 * Initializes and restores state from browser localStorage.
 * Restores saved favorites, theme preference, infinite scroll preference, and column layout.
 *
 * @returns {void}
 */
function loadStoredState() {
  // 1. Load saved favorites
  try {
    const storedFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (storedFavs) {
      state.favorites = JSON.parse(storedFavs);
    }
  } catch (e) {
    console.error("Failed to load favorites from localStorage:", e);
    state.favorites = [];
  }
  updateFavoritesBadge();

  // 2. Load theme preference
  try {
    const storedTheme = /** @type {ThemeMode} */ (localStorage.getItem(STORAGE_KEYS.THEME) || "system");
    setTheme(storedTheme, false);
  } catch (e) {
    console.error("Failed to load theme preference:", e);
  }

  // 3. Load Infinite Scroll toggle setting
  try {
    const storedInfinite = localStorage.getItem(STORAGE_KEYS.INFINITE);
    if (storedInfinite !== null) {
      state.infiniteScroll = storedInfinite === "true";
      if (dom.toggleInfinite) {
        dom.toggleInfinite.checked = state.infiniteScroll;
      }
    }
  } catch (e) {
    console.error("Failed to load infinite scroll preference:", e);
  }

  // 4. Load gallery column layout preference
  try {
    const storedLayout = localStorage.getItem(STORAGE_KEYS.LAYOUT) || "4";
    setLayoutColumns(parseInt(storedLayout, 10));
  } catch (e) {
    console.error("Failed to load layout preference:", e);
  }
}

/**
 * Persists the current favorites array to browser localStorage and updates UI badges.
 *
 * @returns {void}
 */
function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favorites));
  } catch (e) {
    console.error("Failed to save favorites to localStorage:", e);
  }
  updateFavoritesBadge();
  renderFavoritesList();
}

/**
 * Updates the numerical count badge in the header for saved favorites.
 *
 * @returns {void}
 */
function updateFavoritesBadge() {
  const count = state.favorites.length;
  if (!dom.favoritesBadge) return;

  if (count > 0) {
    dom.favoritesBadge.style.display = "inline-block";
    dom.favoritesBadge.textContent = count > 99 ? "99+" : count.toString();
  } else {
    dom.favoritesBadge.style.display = "none";
  }
}

// ==========================================================================
// 2. Theme Management
// ==========================================================================

/**
 * Sets the active application visual theme (light, dark, or system).
 *
 * @param {ThemeMode} theme - Theme name to activate.
 * @param {boolean} [save=true] - Whether to persist the selection to localStorage.
 * @returns {void}
 */
function setTheme(theme, save = true) {
  state.theme = theme;
  const root = document.documentElement;

  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", isDark ? "dark" : "light");
    updateThemeIcon(isDark);
  } else {
    root.setAttribute("data-theme", theme);
    updateThemeIcon(theme === "dark");
  }

  if (save) {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  }
}

/**
 * Updates the theme toggle button icon based on active mode.
 *
 * @param {boolean} isDark - True if dark mode is currently active.
 * @returns {void}
 */
function updateThemeIcon(isDark) {
  if (dom.iconTheme) {
    dom.iconTheme.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
}

/**
 * Toggles between Light and Dark themes with toast notification feedback.
 *
 * @returns {void}
 */
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(/** @type {ThemeMode} */ (newTheme), true);
  showToast(`Switched to ${newTheme === "dark" ? "Dark" : "Light"} mode`, "info");
}

// ==========================================================================
// 3. Breed Names & Formatting Utilities
// ==========================================================================

/**
 * Dictionary of custom and compound breed names that require special formatting.
 * @type {Record<string, string>}
 */
const SPECIAL_BREED_NAMES = {
  germanshepherd: "German Shepherd",
  "shepherd-german": "German Shepherd",
  "shepherd-australian": "Australian Shepherd",
  "australian-shepherd": "Australian Shepherd",
  mexicanhairless: "Mexican Hairless",
  "hairless-mexican": "Mexican Hairless",
  cotondetulear: "Coton De Tulear",
  stbernard: "St. Bernard",
  bullterrier: "Bull Terrier",
  "bullterrier-staffordshire": "Staffordshire Bull Terrier",
  "terrier-american": "American Terrier",
  "terrier-australian": "Australian Terrier",
  "terrier-bedlington": "Bedlington Terrier",
  "terrier-border": "Border Terrier",
  "terrier-cairn": "Cairn Terrier",
  "terrier-dandie": "Dandie Dinmont Terrier",
  "terrier-fox": "Fox Terrier",
  "terrier-irish": "Irish Terrier",
  "terrier-kerryblue": "Kerry Blue Terrier",
  "terrier-lakeland": "Lakeland Terrier",
  "terrier-norfolk": "Norfolk Terrier",
  "terrier-norwich": "Norwich Terrier",
  "terrier-patterdale": "Patterdale Terrier",
  "terrier-russell": "Russell Terrier",
  "terrier-scottish": "Scottish Terrier",
  "terrier-sealyham": "Sealyham Terrier",
  "terrier-silky": "Silky Terrier",
  "terrier-tibetan": "Tibetan Terrier",
  "terrier-toy": "Toy Terrier",
  "terrier-welsh": "Welsh Terrier",
  "terrier-westhighland": "West Highland White Terrier",
  "terrier-wheaten": "Soft-coated Wheaten Terrier",
  "terrier-yorkshire": "Yorkshire Terrier",
  "corgi-cardigan": "Cardigan Welsh Corgi",
  "corgi-pembroke": "Pembroke Welsh Corgi",
  pembroke: "Pembroke Welsh Corgi",
  cardigan: "Cardigan Welsh Corgi",
};

/**
 * Converts a raw breed slug or path into a capitalized, human-friendly title.
 * Handles sub-breeds (e.g. "retriever-golden" -> "Golden Retriever") and special exceptions.
 *
 * @param {string} breedStr - The breed slug to format (e.g. "retriever-golden" or "hound/afghan").
 * @returns {string} The formatted breed title (e.g. "Golden Retriever").
 *
 * @example
 * formatBreedName("retriever-golden"); // Returns "Golden Retriever"
 * formatBreedName("germanshepherd");  // Returns "German Shepherd"
 */
function formatBreedName(breedStr) {
  if (!breedStr) return "Unknown Buddy";

  const clean = breedStr.toLowerCase().replace("/", "-").trim();
  if (SPECIAL_BREED_NAMES[clean]) {
    return SPECIAL_BREED_NAMES[clean];
  }

  const parts = clean.split("-");
  if (parts.length === 2) {
    const [main, sub] = parts;
    const reversed = `${sub}-${main}`;
    if (SPECIAL_BREED_NAMES[reversed]) {
      return SPECIAL_BREED_NAMES[reversed];
    }
    return `${capitalize(sub)} ${capitalize(main)}`;
  }

  return capitalize(parts[0]);
}

/**
 * Capitalizes the first letter of a word and lowers the rest.
 *
 * @param {string} str - Input string.
 * @returns {string} Capitalized string.
 */
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extracts the breed sub-path from a full Dog CEO CDN image URL.
 * URL format: "https://images.dog.ceo/breeds/{breed_subpath}/{filename}.jpg"
 *
 * @param {string} url - The complete image URL.
 * @returns {string} Extracted breed slug (e.g. "hound-afghan" or "pembroke").
 *
 * @example
 * extractBreedFromUrl("https://images.dog.ceo/breeds/hound-afghan/n02088094_1128.jpg");
 * // Returns "hound-afghan"
 */
function extractBreedFromUrl(url) {
  try {
    const match = url.match(/breeds\/([^/]+)\//);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {
    console.warn("Could not extract breed from url:", url);
  }
  return "dog";
}

// ==========================================================================
// 4. Toast Notifications
// ==========================================================================

/**
 * Displays an animated, non-blocking toast alert at the bottom of the screen.
 *
 * @param {string} message - Notification text to display.
 * @param {ToastType} [type="info"] - Alert severity ("info", "success", "error").
 * @param {number} [duration=3000] - Duration in milliseconds before dismissing.
 * @returns {void}
 *
 * @example
 * showToast("Dog photo link copied!", "success");
 */
function showToast(message, type = "info", duration = 3000) {
  if (!dom.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconClass = "fa-solid fa-circle-info";
  if (type === "success") iconClass = "fa-solid fa-circle-check";
  if (type === "error") iconClass = "fa-solid fa-triangle-exclamation";

  toast.innerHTML = `
    <i class="${iconClass}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => {
      toast.remove();
    });
  }, duration);
}

/**
 * Escapes HTML characters to prevent XSS vulnerabilities when interpolating dynamic text.
 *
 * @param {string} text - Raw input string.
 * @returns {string} Sanitized string safe for HTML insertion.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ==========================================================================
// 5. API Services & Breed Loading
// ==========================================================================

/**
 * Base URL for the public Dog CEO REST API.
 * @constant {string}
 */
const API_BASE = "https://dog.ceo/api";

/**
 * Fetches the complete master dictionary of all recognized dog breeds and sub-breeds.
 * Populates the internal breed list and the breed select dropdown.
 *
 * @async
 * @returns {Promise<void>}
 */
async function fetchAllBreeds() {
  try {
    const res = await fetch(`${API_BASE}/breeds/list/all`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    /** @type {BreedListApiResponse} */
    const data = await res.json();

    if (data.status === "success" && data.message) {
      state.allBreeds = data.message;
      buildBreedOptions();
      populateBreedDropdown();
    }
  } catch (error) {
    console.warn("Could not load dog breeds list:", error);
  }
}

/**
 * Transforms the raw breed dictionary into sorted, searchable BreedOption objects.
 *
 * @returns {void}
 */
function buildBreedOptions() {
  /** @type {BreedOption[]} */
  const options = [];

  for (const [breed, subBreeds] of Object.entries(state.allBreeds)) {
    if (subBreeds.length === 0) {
      options.push({
        value: breed,
        label: formatBreedName(breed),
        key: `${breed} ${formatBreedName(breed)}`.toLowerCase(),
      });
    } else {
      // Add parent category
      options.push({
        value: breed,
        label: `${capitalize(breed)} (All)`,
        key: `${breed} ${capitalize(breed)}`.toLowerCase(),
      });

      // Add each sub-breed
      subBreeds.forEach((sub) => {
        const val = `${breed}/${sub}`;
        const label = `${capitalize(sub)} ${capitalize(breed)}`;
        options.push({
          value: val,
          label: label,
          key: `${breed} ${sub} ${label}`.toLowerCase(),
        });
      });
    }
  }

  // Sort alphabetically by label
  options.sort((a, b) => a.label.localeCompare(b.label));
  state.breedOptions = options;
}

/**
 * Re-populates the `<select>` breed dropdown, optionally filtered by search text.
 *
 * @param {string} [filterText=""] - Keyword filter entered by user.
 * @returns {void}
 */
function populateBreedDropdown(filterText = "") {
  if (!dom.selectBreed) return;
  dom.selectBreed.innerHTML = `<option value="">🎲 All Breeds (Random)</option>`;

  const filter = filterText.toLowerCase().trim();
  const filtered = filter
    ? state.breedOptions.filter((opt) => opt.key.includes(filter))
    : state.breedOptions;

  filtered.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === state.selectedBreed) {
      option.selected = true;
    }
    dom.selectBreed.appendChild(option);
  });
}

// ==========================================================================
// 6. Dog Fetching & Gallery Rendering
// ==========================================================================

/**
 * Fetches a batch of dog images from the Dog API and appends or replaces gallery cards.
 *
 * @async
 * @param {number} [count=12] - Number of images to fetch.
 * @param {boolean} [append=true] - If true, appends to existing gallery; if false, clears gallery first.
 * @returns {Promise<void>}
 */
async function fetchDogs(count = 12, append = true) {
  if (state.isLoading) return;

  // Cancel pending request if one is active (avoids race conditions on rapid filter clicks)
  if (state.activeAbortController) {
    state.activeAbortController.abort();
  }
  state.activeAbortController = new AbortController();

  setLoading(true, append);
  clearStatusMessage();

  let url = `${API_BASE}/breeds/image/random/${count}`;

  if (state.selectedBreed) {
    const breedPath = state.selectedBreed.replace("-", "/");
    url = `${API_BASE}/breed/${breedPath}/images/random/${count}`;
  }

  try {
    const res = await fetch(url, { signal: state.activeAbortController.signal });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    /** @type {RandomImagesApiResponse} */
    const data = await res.json();

    if (data.status === "success" && Array.isArray(data.message)) {
      /** @type {DogPhoto[]} */
      const newDogs = data.message.map((imgUrl) => {
        const rawBreed = extractBreedFromUrl(imgUrl);
        return {
          id: imgUrl,
          url: imgUrl,
          rawBreed: rawBreed,
          breed: formatBreedName(rawBreed),
        };
      });

      if (!append) {
        state.loadedDogs = [];
        dom.imageContainer.innerHTML = "";
      }

      const startIndex = state.loadedDogs.length;
      state.loadedDogs.push(...newDogs);
      renderDogBatch(newDogs, startIndex);
      updateGalleryStats();

      if (!state.isInitialLoaded) {
        state.isInitialLoaded = true;
      }
    } else {
      throw new Error("No images returned from API");
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("Error fetching dog images:", error);
    setStatusMessage("Could not retrieve dog pictures. Check your connection.", "error");
    showToast("Failed to load pictures. Please try again.", "error");
  } finally {
    setLoading(false, append);
  }
}

/**
 * Updates UI loading state indicators, disabling buttons and showing skeleton placeholders.
 *
 * @param {boolean} loading - True if loading is in progress.
 * @param {boolean} [append=false] - True if appending to existing gallery items.
 * @returns {void}
 */
function setLoading(loading, append = false) {
  state.isLoading = loading;

  if (loading) {
    if (!append || state.loadedDogs.length === 0) {
      dom.gallerySkeleton.classList.add("active");
    }
    dom.loader.hidden = false;
    dom.btnFetchMore.disabled = true;
    dom.btnRefresh.disabled = true;
    if (dom.btnManualMore) dom.btnManualMore.disabled = true;
  } else {
    dom.gallerySkeleton.classList.remove("active");
    dom.loader.hidden = true;
    dom.btnFetchMore.disabled = false;
    dom.btnRefresh.disabled = false;
    if (dom.btnManualMore) dom.btnManualMore.disabled = false;
  }
}

/**
 * Renders an array of dog items into DOM card components and appends them to the container.
 *
 * @param {DogPhoto[]} dogs - Array of dog photo objects to render.
 * @param {number} startIdx - Starting global index offset in state.loadedDogs.
 * @returns {void}
 */
function renderDogBatch(dogs, startIdx) {
  const fragment = document.createDocumentFragment();

  dogs.forEach((dog, idx) => {
    const globalIndex = startIdx + idx;
    const card = createDogCard(dog, globalIndex);
    fragment.appendChild(card);
  });

  dom.imageContainer.appendChild(fragment);
}

/**
 * Creates an interactive DOM dog card element with image, badges, and action overlay.
 *
 * @param {DogPhoto} dog - The dog photo data.
 * @param {number} index - Index of this dog in state.loadedDogs.
 * @returns {HTMLElement} The constructed `<article class="dog-card">` element.
 */
function createDogCard(dog, index) {
  const card = document.createElement("article");
  card.className = "dog-card";
  card.dataset.index = index.toString();
  card.dataset.url = dog.url;

  const isFav = isFavorite(dog.url);

  card.innerHTML = `
    <div class="dog-card-media">
      <span class="card-breed-badge"><i class="fa-solid fa-paw"></i> ${escapeHtml(dog.breed)}</span>
      <img src="${dog.url}" alt="${escapeHtml(dog.breed)}" loading="lazy" width="300" height="300">
      <div class="card-actions-overlay">
        <div class="card-actions-left">
          <button type="button" class="btn-card-action btn-card-fav ${isFav ? "active-fav" : ""}" title="${isFav ? "Remove Favorite" : "Save Favorite"}" aria-label="Favorite">
            <i class="${isFav ? "fa-solid" : "fa-regular"} fa-heart"></i>
          </button>
          <button type="button" class="btn-card-action btn-card-view" title="View Fullscreen" aria-label="View Fullscreen">
            <i class="fa-solid fa-expand"></i>
          </button>
        </div>
        <div class="card-actions-right">
          <button type="button" class="btn-card-action btn-card-copy" title="Copy Image Link" aria-label="Copy Link">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button type="button" class="btn-card-action btn-card-download" title="Download Image" aria-label="Download">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const img = /** @type {HTMLImageElement} */ (card.querySelector("img"));
  img.addEventListener("load", () => {
    img.classList.add("image-loaded");
  });

  img.addEventListener("error", () => {
    img.alt = "Failed to load dog photo";
    img.src = "favicon.png";
    img.classList.add("image-loaded");
  });

  // Card Event Listeners
  const btnFav = /** @type {HTMLButtonElement} */ (card.querySelector(".btn-card-fav"));
  btnFav.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavoriteDog(dog);
    updateCardFavState(card, dog.url);
  });

  const btnView = /** @type {HTMLButtonElement} */ (card.querySelector(".btn-card-view"));
  btnView.addEventListener("click", (e) => {
    e.stopPropagation();
    openLightbox(index);
  });

  const btnCopy = /** @type {HTMLButtonElement} */ (card.querySelector(".btn-card-copy"));
  btnCopy.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(dog.url, "Dog picture link copied to clipboard!");
  });

  const btnDownload = /** @type {HTMLButtonElement} */ (card.querySelector(".btn-card-download"));
  btnDownload.addEventListener("click", (e) => {
    e.stopPropagation();
    downloadImage(dog.url, `${dog.breed.toLowerCase().replace(/\s+/g, "_")}.jpg`);
  });

  // Clicking anywhere on the card opens full-screen Lightbox
  card.addEventListener("click", () => {
    openLightbox(index);
  });

  return card;
}

/**
 * Synchronizes the visual favorite heart icon on a specific card element.
 *
 * @param {HTMLElement} card - The dog card element.
 * @param {string} url - The dog image URL.
 * @returns {void}
 */
function updateCardFavState(card, url) {
  const btnFav = card.querySelector(".btn-card-fav");
  if (!btnFav) return;
  const isFav = isFavorite(url);
  btnFav.className = `btn-card-action btn-card-fav ${isFav ? "active-fav" : ""}`;
  btnFav.setAttribute("title", isFav ? "Remove Favorite" : "Save Favorite");
  btnFav.innerHTML = `<i class="${isFav ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
}

/**
 * Updates gallery counter text and active filter indicator badge.
 *
 * @returns {void}
 */
function updateGalleryStats() {
  if (dom.statCount) {
    dom.statCount.textContent = state.loadedDogs.length.toString();
  }

  if (state.selectedBreed) {
    dom.activeFilterBadge.style.display = "inline-flex";
    dom.filterName.textContent = formatBreedName(state.selectedBreed);
  } else {
    dom.activeFilterBadge.style.display = "none";
  }
}

/**
 * Displays an inline status message inside the controls deck.
 *
 * @param {string} msg - Message text.
 * @param {"info" | "success" | "error"} [type="info"] - Severity type.
 * @returns {void}
 */
function setStatusMessage(msg, type = "info") {
  dom.statusMessage.className = `status-message ${type}`;
  dom.statusMessage.textContent = msg;
}

/**
 * Clears the inline status message.
 *
 * @returns {void}
 */
function clearStatusMessage() {
  dom.statusMessage.textContent = "";
  dom.statusMessage.className = "status-message";
}

// ==========================================================================
// 7. Lightbox Modal
// ==========================================================================

/**
 * Opens the high-resolution full-screen Lightbox viewer for a specific dog index.
 *
 * @param {number} index - Index of the dog in `state.loadedDogs`.
 * @returns {void}
 */
function openLightbox(index) {
  if (index < 0 || index >= state.loadedDogs.length) return;
  state.currentLightboxIndex = index;
  const dog = state.loadedDogs[index];

  dom.lightboxBreedTitle.textContent = dog.breed;
  dom.lightboxCounter.textContent = `${index + 1} / ${state.loadedDogs.length}`;

  dom.lightboxLoader.classList.add("active");
  dom.lightboxImg.style.opacity = "0.3";

  dom.lightboxImg.onload = () => {
    dom.lightboxLoader.classList.remove("active");
    dom.lightboxImg.style.opacity = "1";
  };

  dom.lightboxImg.onerror = () => {
    dom.lightboxLoader.classList.remove("active");
    dom.lightboxImg.style.opacity = "1";
  };

  dom.lightboxImg.src = dog.url;
  dom.lightboxImg.alt = dog.breed;

  updateLightboxFavButton(dog.url);

  dom.modalLightbox.classList.add("active");
  dom.modalLightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

/**
 * Closes the full-screen Lightbox modal and restores body scrolling.
 *
 * @returns {void}
 */
function closeLightbox() {
  dom.modalLightbox.classList.remove("active");
  dom.modalLightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/**
 * Navigates to the next dog image in the Lightbox (with wrap-around).
 *
 * @returns {void}
 */
function nextLightboxImage() {
  if (state.loadedDogs.length === 0) return;
  let nextIdx = state.currentLightboxIndex + 1;
  if (nextIdx >= state.loadedDogs.length) {
    nextIdx = 0; // Wrap around to first image
  }
  openLightbox(nextIdx);
}

/**
 * Navigates to the previous dog image in the Lightbox (with wrap-around).
 *
 * @returns {void}
 */
function prevLightboxImage() {
  if (state.loadedDogs.length === 0) return;
  let prevIdx = state.currentLightboxIndex - 1;
  if (prevIdx < 0) {
    prevIdx = state.loadedDogs.length - 1; // Wrap around to last image
  }
  openLightbox(prevIdx);
}

/**
 * Synchronizes the Favorite button state inside the Lightbox modal.
 *
 * @param {string} url - Image URL of the active dog.
 * @returns {void}
 */
function updateLightboxFavButton(url) {
  const isFav = isFavorite(url);
  if (isFav) {
    dom.btnLightboxFav.classList.add("active-favorite");
    dom.iconLightboxFav.className = "fa-solid fa-heart";
    dom.labelLightboxFav.textContent = "Saved";
  } else {
    dom.btnLightboxFav.classList.remove("active-favorite");
    dom.iconLightboxFav.className = "fa-regular fa-heart";
    dom.labelLightboxFav.textContent = "Favorite";
  }
}

// ==========================================================================
// 8. Favorites System
// ==========================================================================

/**
 * Checks whether an image URL is currently in the favorites list.
 *
 * @param {string} url - The dog image URL.
 * @returns {boolean} True if favorited.
 */
function isFavorite(url) {
  return state.favorites.some((fav) => fav.url === url);
}

/**
 * Toggles a dog's favorite bookmark status, saves state, and updates all matching UI elements.
 *
 * @param {{ url: string, breed: string }} dog - Dog photo data object.
 * @returns {void}
 */
function toggleFavoriteDog(dog) {
  const index = state.favorites.findIndex((fav) => fav.url === dog.url);
  if (index > -1) {
    state.favorites.splice(index, 1);
    showToast(`Removed from favorites`, "info");
  } else {
    state.favorites.unshift({
      url: dog.url,
      breed: dog.breed,
      savedAt: Date.now(),
    });
    showToast(`Saved ${dog.breed} to favorites! ❤️`, "success");
  }
  saveFavorites();

  // Synchronize matching card elements in the active gallery
  document.querySelectorAll(`.dog-card[data-url="${CSS.escape(dog.url)}"]`).forEach((card) => {
    updateCardFavState(/** @type {HTMLElement} */ (card), dog.url);
  });
}

/**
 * Opens the Saved Favorites manager modal.
 *
 * @returns {void}
 */
function openFavoritesModal() {
  renderFavoritesList();
  dom.modalFavorites.classList.add("active");
  dom.modalFavorites.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

/**
 * Closes the Saved Favorites manager modal.
 *
 * @returns {void}
 */
function closeFavoritesModal() {
  dom.modalFavorites.classList.remove("active");
  dom.modalFavorites.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/**
 * Renders the grid of saved favorites inside the favorites modal.
 *
 * @returns {void}
 */
function renderFavoritesList() {
  if (!dom.favoritesListContainer) return;

  if (state.favorites.length === 0) {
    dom.favoritesListContainer.innerHTML = `
      <p class="empty-state-text">No favorite dogs saved yet. Click the ❤️ button on any photo to save your favorite buddies!</p>
    `;
    dom.btnClearAllFavorites.style.display = "none";
    return;
  }

  dom.btnClearAllFavorites.style.display = "inline-flex";
  dom.favoritesListContainer.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "favorites-grid";

  state.favorites.forEach((fav) => {
    const item = document.createElement("div");
    item.className = "favorite-item";
    item.innerHTML = `
      <div class="fav-thumb-container" title="View dog in Lightbox">
        <img src="${fav.url}" alt="${escapeHtml(fav.breed)}" loading="lazy">
      </div>
      <div class="fav-details">
        <span class="fav-breed-name" title="${escapeHtml(fav.breed)}">${escapeHtml(fav.breed)}</span>
        <div class="fav-item-actions">
          <button type="button" class="btn-fav-action btn-fav-copy" title="Copy URL" aria-label="Copy link">
            <i class="fa-regular fa-copy"></i>
          </button>
          <button type="button" class="btn-fav-action btn-fav-download" title="Download" aria-label="Download">
            <i class="fa-solid fa-download"></i>
          </button>
          <button type="button" class="btn-fav-action btn-fav-remove" title="Remove" aria-label="Remove favorite">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;

    // Click thumbnail to open in full-screen Lightbox
    const thumb = /** @type {HTMLElement} */ (item.querySelector(".fav-thumb-container"));
    thumb.addEventListener("click", () => {
      closeFavoritesModal();
      let existingIndex = state.loadedDogs.findIndex((d) => d.url === fav.url);
      if (existingIndex === -1) {
        state.loadedDogs.unshift({
          id: fav.url,
          url: fav.url,
          rawBreed: extractBreedFromUrl(fav.url),
          breed: fav.breed,
        });
        existingIndex = 0;
      }
      openLightbox(existingIndex);
    });

    const btnCopy = /** @type {HTMLButtonElement} */ (item.querySelector(".btn-fav-copy"));
    btnCopy.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(fav.url, "Favorite dog link copied!");
    });

    const btnDownload = /** @type {HTMLButtonElement} */ (item.querySelector(".btn-fav-download"));
    btnDownload.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadImage(fav.url, `${fav.breed.toLowerCase().replace(/\s+/g, "_")}.jpg`);
    });

    const btnRemove = /** @type {HTMLButtonElement} */ (item.querySelector(".btn-fav-remove"));
    btnRemove.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavoriteDog({ url: fav.url, breed: fav.breed });
    });

    grid.appendChild(item);
  });

  dom.favoritesListContainer.appendChild(grid);
}

/**
 * Prompts user confirmation and deletes all saved favorites from localStorage.
 *
 * @returns {void}
 */
function clearAllFavorites() {
  if (confirm("Are you sure you want to remove all saved favorites?")) {
    state.favorites = [];
    saveFavorites();
    // Synchronize cards in active gallery
    document.querySelectorAll(".dog-card").forEach((card) => {
      const url = /** @type {HTMLElement} */ (card).dataset.url || "";
      updateCardFavState(/** @type {HTMLElement} */ (card), url);
    });
    showToast("Cleared all favorites", "info");
  }
}

// ==========================================================================
// 9. Keyboard Shortcuts Modal
// ==========================================================================

/**
 * Opens the keyboard shortcuts quick reference guide modal.
 *
 * @returns {void}
 */
function openShortcutsModal() {
  dom.modalShortcuts.classList.add("active");
  dom.modalShortcuts.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

/**
 * Closes the keyboard shortcuts modal.
 *
 * @returns {void}
 */
function closeShortcutsModal() {
  dom.modalShortcuts.classList.remove("active");
  dom.modalShortcuts.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

// ==========================================================================
// 10. Layout, Actions & Helpers
// ==========================================================================

/**
 * Updates the gallery masonry column count (e.g. 2, 3, or 4 columns).
 *
 * @param {number} cols - Number of columns to apply.
 * @returns {void}
 */
function setLayoutColumns(cols) {
  dom.imageContainer.className = `image-container cols-${cols}`;
  dom.gallerySkeleton.className = `gallery-skeleton-container cols-${cols}`;

  dom.layoutBtns.forEach((btn) => {
    if (parseInt(btn.dataset.cols || "4", 10) === cols) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  try {
    localStorage.setItem(STORAGE_KEYS.LAYOUT, cols.toString());
  } catch (e) {}
}

/**
 * Copies a string to the system clipboard using the async Clipboard API (with textarea fallback).
 *
 * @async
 * @param {string} text - String to copy.
 * @param {string} [successMsg="Copied to clipboard!"] - Toast message on success.
 * @returns {Promise<void>}
 */
async function copyToClipboard(text, successMsg = "Copied to clipboard!") {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for non-secure HTTP contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(successMsg, "success");
  } catch (err) {
    console.error("Failed to copy:", err);
    showToast("Could not copy to clipboard", "error");
  }
}

/**
 * Downloads an image directly to the client's machine by fetching as a blob.
 *
 * @async
 * @param {string} imageUrl - Direct URL of the image to download.
 * @param {string} [filename="dog.jpg"] - Suggested download filename.
 * @returns {Promise<void>}
 */
async function downloadImage(imageUrl, filename = "dog.jpg") {
  try {
    showToast("Starting download...", "info");
    const response = await fetch(imageUrl, { mode: "cors" });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
    showToast("Download complete!", "success");
  } catch (e) {
    console.warn("Direct blob download failed, falling back to opening in new tab:", e);
    window.open(imageUrl, "_blank");
  }
}

/**
 * Shares a dog photo using the native mobile/desktop Web Share API (or copies link as fallback).
 *
 * @async
 * @param {DogPhoto} dog - The dog photo data.
 * @returns {Promise<void>}
 */
async function shareDog(dog) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Infinite Dogs - ${dog.breed}`,
        text: `Look at this adorable ${dog.breed} on Infinite Dogs!`,
        url: dog.url,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name !== "AbortError") {
        copyToClipboard(dog.url, "Link copied to clipboard!");
      }
    }
  } else {
    copyToClipboard(dog.url, "Link copied to clipboard!");
  }
}

/**
 * Handles user selection of a breed, updating filters and triggering a fresh fetch.
 *
 * @param {string} breedValue - The selected breed slug (or "" for all/random).
 * @returns {void}
 */
function handleBreedSelection(breedValue) {
  state.selectedBreed = breedValue;
  updateQuickTagsState(breedValue);
  populateBreedDropdown(dom.inputSearch.value);
  fetchDogs(15, false); // Clear and reload gallery with filtered breed
}

/**
 * Updates the active state of quick popular breed pill buttons.
 *
 * @param {string} breedValue - Active breed slug.
 * @returns {void}
 */
function updateQuickTagsState(breedValue) {
  const pills = dom.quickTagsList.querySelectorAll(".tag-pill");
  pills.forEach((pill) => {
    const el = /** @type {HTMLElement} */ (pill);
    if (el.dataset.breed === breedValue) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

// ==========================================================================
// 11. Event Listeners & Interaction Setup
// ==========================================================================

/**
 * Registers all application event listeners (clicks, inputs, scrolling, keyboard shortcuts).
 *
 * @returns {void}
 */
function setupEventListeners() {
  // Theme Toggle
  dom.btnThemeToggle.addEventListener("click", toggleTheme);

  // Modal Open/Close Controls
  dom.btnFavoritesToggle.addEventListener("click", openFavoritesModal);
  dom.btnCloseFavorites.addEventListener("click", closeFavoritesModal);
  dom.btnCloseFavoritesAlt.addEventListener("click", closeFavoritesModal);
  dom.btnClearAllFavorites.addEventListener("click", clearAllFavorites);

  dom.btnShortcutsToggle.addEventListener("click", openShortcutsModal);
  dom.btnCloseShortcuts.addEventListener("click", closeShortcutsModal);
  dom.btnCloseShortcutsAlt.addEventListener("click", closeShortcutsModal);

  // Lightbox Modal Controls
  dom.btnCloseLightbox.addEventListener("click", closeLightbox);
  dom.btnLightboxNext.addEventListener("click", nextLightboxImage);
  dom.btnLightboxPrev.addEventListener("click", prevLightboxImage);

  dom.btnLightboxFav.addEventListener("click", () => {
    if (state.currentLightboxIndex >= 0) {
      const dog = state.loadedDogs[state.currentLightboxIndex];
      toggleFavoriteDog(dog);
      updateLightboxFavButton(dog.url);
    }
  });

  dom.btnLightboxCopy.addEventListener("click", () => {
    if (state.currentLightboxIndex >= 0) {
      const dog = state.loadedDogs[state.currentLightboxIndex];
      copyToClipboard(dog.url, "Dog photo link copied!");
    }
  });

  dom.btnLightboxDownload.addEventListener("click", () => {
    if (state.currentLightboxIndex >= 0) {
      const dog = state.loadedDogs[state.currentLightboxIndex];
      downloadImage(dog.url, `${dog.breed.toLowerCase().replace(/\s+/g, "_")}.jpg`);
    }
  });

  dom.btnLightboxShare.addEventListener("click", () => {
    if (state.currentLightboxIndex >= 0) {
      const dog = state.loadedDogs[state.currentLightboxIndex];
      shareDog(dog);
    }
  });

  // Modal Backdrop Click Dismissal
  [dom.modalFavorites, dom.modalShortcuts, dom.modalLightbox].forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        if (modal === dom.modalFavorites) closeFavoritesModal();
        if (modal === dom.modalShortcuts) closeShortcutsModal();
        if (modal === dom.modalLightbox) closeLightbox();
      }
    });
  });

  // Fetch More / Fresh Batch Buttons
  dom.btnFetchMore.addEventListener("click", () => fetchDogs(15, true));
  dom.btnRefresh.addEventListener("click", () => fetchDogs(15, false));
  if (dom.btnManualMore) {
    dom.btnManualMore.addEventListener("click", () => fetchDogs(15, true));
  }

  // Breed Select Dropdown Change
  dom.selectBreed.addEventListener("change", (e) => {
    const target = /** @type {HTMLSelectElement} */ (e.target);
    handleBreedSelection(target.value);
  });

  // Live Breed Search Input
  dom.inputSearch.addEventListener("input", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const val = target.value;
    dom.btnClear.style.display = val.length > 0 ? "block" : "none";
    populateBreedDropdown(val);
  });

  dom.btnClear.addEventListener("click", () => {
    dom.inputSearch.value = "";
    dom.btnClear.style.display = "none";
    populateBreedDropdown("");
    dom.inputSearch.focus();
  });

  // Popular Breed Quick Tag Pills
  dom.quickTagsList.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const pill = target.closest(".tag-pill");
    if (pill) {
      const breed = /** @type {HTMLElement} */ (pill).dataset.breed || "";
      dom.selectBreed.value = breed;
      handleBreedSelection(breed);
    }
  });

  // Reset Active Filter Badge
  dom.btnResetFilter.addEventListener("click", () => {
    dom.selectBreed.value = "";
    handleBreedSelection("");
  });

  // Infinite Scroll Toggle Switch
  dom.toggleInfinite.addEventListener("change", (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    state.infiniteScroll = target.checked;
    try {
      localStorage.setItem(STORAGE_KEYS.INFINITE, state.infiniteScroll.toString());
    } catch (err) {}

    if (state.infiniteScroll) {
      dom.manualLoadMore.style.display = "none";
    } else {
      dom.manualLoadMore.style.display = "flex";
    }
  });

  // Layout Columns Switcher
  dom.layoutBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cols = parseInt(btn.dataset.cols || "4", 10);
      setLayoutColumns(cols);
    });
  });

  // Window Scrolling (Scroll-to-Top & Infinite Scroll Trigger)
  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY || window.pageYOffset;

    // Show/hide floating scroll-to-top button
    if (scrollY > 400) {
      dom.btnScrollTop.classList.add("visible");
    } else {
      dom.btnScrollTop.classList.remove("visible");
    }

    // Infinite scroll check: trigger fetch when within 800px of page bottom
    if (
      state.infiniteScroll &&
      !state.isLoading &&
      state.isInitialLoaded &&
      window.innerHeight + scrollY >= document.body.offsetHeight - 800
    ) {
      fetchDogs(12, true);
    }
  });

  dom.btnScrollTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Global Keyboard Shortcuts
  window.addEventListener("keydown", (e) => {
    const activeEl = /** @type {HTMLElement} */ (document.activeElement);
    const isTyping = activeEl && ["INPUT", "SELECT", "TEXTAREA"].includes(activeEl.tagName);

    // Escape Key Handler (closes topmost open modal/lightbox)
    if (e.key === "Escape") {
      if (dom.modalLightbox.classList.contains("active")) {
        closeLightbox();
        return;
      }
      if (dom.modalFavorites.classList.contains("active")) {
        closeFavoritesModal();
        return;
      }
      if (dom.modalShortcuts.classList.contains("active")) {
        closeShortcutsModal();
        return;
      }
      if (dom.inputSearch.value) {
        dom.inputSearch.value = "";
        dom.btnClear.style.display = "none";
        populateBreedDropdown("");
      }
      return;
    }

    // Lightbox Left/Right Arrow & Quick Key Navigation
    if (dom.modalLightbox.classList.contains("active")) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextLightboxImage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevLightboxImage();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        dom.btnLightboxCopy.click();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        dom.btnLightboxFav.click();
      }
      return;
    }

    // Ignore single-key shortcuts while typing in inputs
    if (isTyping) return;

    if (e.key === " " || e.key.toLowerCase() === "n") {
      e.preventDefault();
      fetchDogs(15, true);
    } else if (e.key === "/") {
      e.preventDefault();
      dom.inputSearch.focus();
    } else if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      openFavoritesModal();
    } else if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      toggleTheme();
    } else if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      openShortcutsModal();
    }
  });

  // Listen for operating system dark/light theme preference changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.theme === "system") {
      setTheme("system", false);
    }
  });
}

// ==========================================================================
// 12. Service Worker Registration
// ==========================================================================

/**
 * Registers the PWA service worker (sw.js) when served over HTTP/HTTPS.
 *
 * @returns {void}
 */
function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          console.log("Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("Service Worker registration failed:", err);
        });
    });
  }
}

// ==========================================================================
// 13. Application Entry Point
// ==========================================================================

/**
 * Main application bootstrap function.
 * Initializes storage, binds event listeners, registers service workers,
 * loads master breed lists, and fetches initial dog photos.
 *
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  loadStoredState();
  setupEventListeners();
  registerServiceWorker();

  // Load master breed dictionary and initial batch of dog pictures
  await fetchAllBreeds();
  fetchDogs(16, false);
}

// Kick off initialization once DOM content is ready
document.addEventListener("DOMContentLoaded", init);
