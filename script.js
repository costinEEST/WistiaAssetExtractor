class WistiaAssetExtractor {
  #assets = [];
  #filteredAssets = [];
  #selectedAssets = new Set();
  #sortConfig = { key: null, direction: "asc" };
  #isLoading = false;

  constructor() {
    this.#init();
  }

  #init() {
    this.#bindEvents();
    this.#setupKeyboardShortcuts();
    this.#setupAccessibility();
    this.#updateUI();
  }

  #bindEvents() {
    const elements = {
      videoInput: document.getElementById("video-input"),
      extractBtn: document.getElementById("extract-btn"),
      tableSearch: document.getElementById("table-search"),
      selectAllBtn: document.getElementById("select-all-btn"),
      bulkDownloadBtn: document.getElementById("bulk-download-btn"),
      exportBtn: document.getElementById("export-btn"),
      selectAllCheckbox: document.getElementById("select-all-checkbox"),
      exportMenu: document.getElementById("export-menu"),
      helpBtn: document.getElementById("help-btn"),
      keyboardShortcutsBtn: document.getElementById("keyboard-shortcuts-btn"),
    };

    elements.videoInput?.addEventListener("input", this.#handleInputChange);
    elements.videoInput?.addEventListener("keydown", this.#handleInputKeydown);
    elements.extractBtn?.addEventListener("click", this.#handleExtractAssets);
    elements.tableSearch?.addEventListener("input", this.#handleSearchInput);
    elements.selectAllBtn?.addEventListener("click", this.#handleSelectAll);
    elements.bulkDownloadBtn?.addEventListener(
      "click",
      this.#handleBulkDownload
    );
    elements.exportBtn?.addEventListener("click", this.#handleExportToggle);
    elements.selectAllCheckbox?.addEventListener(
      "change",
      this.#handleSelectAllCheckbox
    );
    elements.exportMenu?.addEventListener("click", this.#handleExportOption);
    elements.helpBtn?.addEventListener("click", () =>
      this.#showModal("help-modal")
    );
    elements.keyboardShortcutsBtn?.addEventListener("click", () =>
      this.#showModal("shortcuts-modal")
    );

    document
      .querySelectorAll(".sort-btn")
      .forEach((btn) => btn.addEventListener("click", this.#handleSort));

    document
      .querySelectorAll(".modal-close")
      .forEach((close) => close.addEventListener("click", this.#hideAllModals));

    document
      .querySelectorAll(".modal")
      .forEach((modal) =>
        modal.addEventListener(
          "click",
          (e) => e.target === modal && this.#hideAllModals()
        )
      );

    document.addEventListener(
      "click",
      (e) => !e.target.closest(".dropdown") && this.#hideDropdown()
    );
  }

  #setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.#hideAllModals();
        this.#hideDropdown();
        return;
      }

      const isInputActive = e.target.tagName === "INPUT";
      const hasModifier = e.ctrlKey || e.metaKey;

      if (isInputActive && e.key !== "Enter" && !hasModifier) return;

      const shortcuts = {
        Enter: () => hasModifier && this.#handleExtractAssets(),
        a: () => hasModifier && !isInputActive && this.#handleSelectAll(),
        d: () => hasModifier && this.#handleBulkDownload(),
        " ": () =>
          e.target.type === "checkbox" &&
          (e.preventDefault(), e.target.click()),
      };

      shortcuts[e.key]?.() && e.preventDefault();
    });
  }

  #setupAccessibility() {
    const skipLink = Object.assign(document.createElement("a"), {
      href: "#main-content",
      textContent: "Skip to main content",
      className: "skip-link",
    });
    document.body.prepend(skipLink);

    const liveRegion = Object.assign(document.createElement("div"), {
      id: "live-region",
      className: "visually-hidden",
    });
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    document.body.append(liveRegion);

    const mainContent = document.querySelector(".main-content");
    mainContent?.setAttribute("id", "main-content");
    mainContent?.setAttribute("role", "main");
  }

  #updateUI() {
    this.#updateControlButtons();
    this.#updateTable();
    this.#updateEmptyState();
  }

  #updateControlButtons() {
    const hasAssets = this.#assets.length > 0;
    const hasSelected = this.#selectedAssets.size > 0;
    const allSelected =
      this.#selectedAssets.size === this.#filteredAssets.length &&
      this.#filteredAssets.length > 0;

    document.getElementById("table-search").disabled = !hasAssets;
    document.getElementById("select-all-btn").disabled = !hasAssets;
    document.getElementById("bulk-download-btn").disabled = !hasSelected;
    document.getElementById("export-btn").disabled = !hasAssets;

    const selectAllBtn = document.getElementById("select-all-btn");
    selectAllBtn.innerHTML = allSelected
      ? '<svg class="icon" aria-hidden="true"><use href="#icon-times"></use></svg> Deselect All'
      : '<svg class="icon" aria-hidden="true"><use href="#icon-check-double"></use></svg> Select All';

    const bulkDownloadBtn = document.getElementById("bulk-download-btn");
    bulkDownloadBtn.innerHTML = hasSelected
      ? `<svg class="icon" aria-hidden="true"><use href="#icon-download"></use></svg> Download Selected (${
          this.#selectedAssets.size
        })`
      : '<svg class="icon" aria-hidden="true"><use href="#icon-download"></use></svg> Download Selected';
  }

  #updateTable() {
    const tbody = document.getElementById("assets-tbody");
    const selectAllCheckbox = document.getElementById("select-all-checkbox");

    tbody.innerHTML = "";

    if (!this.#filteredAssets.length) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const selectedCount = this.#filteredAssets.filter((asset) =>
      this.#selectedAssets.has(asset.id)
    ).length;

    selectAllCheckbox.checked = selectedCount === this.#filteredAssets.length;
    selectAllCheckbox.indeterminate =
      selectedCount > 0 && selectedCount < this.#filteredAssets.length;

    this.#filteredAssets.forEach((asset) =>
      tbody.appendChild(this.#createAssetRow(asset))
    );

    this.#announceToScreenReader(
      `Table updated with ${this.#filteredAssets.length} assets`
    );
  }

  #createAssetRow(asset) {
    const row = document.createElement("tr");
    row.dataset.assetId = asset.id;

    const checkbox = Object.assign(document.createElement("input"), {
      type: "checkbox",
      className: "select-checkbox",
      checked: this.#selectedAssets.has(asset.id),
      ariaLabel: `Select ${asset.display_name ?? "asset"}`,
    });
    checkbox.addEventListener("change", () =>
      this.#handleAssetSelect(asset.id)
    );

    const cells = [
      { element: checkbox },
      { className: "asset-name", text: asset.display_name ?? "Unknown" },
      { className: "asset-size", text: this.#formatSize(asset.size) },
      {
        className: "asset-dimensions",
        text:
          asset.width && asset.height
            ? `${asset.width} × ${asset.height}`
            : "N/A",
      },
      {
        className: "asset-url",
        text: asset.url ?? "N/A",
        title: asset.url ?? "N/A",
      },
    ];

    cells.forEach(({ element, className, text, title }) => {
      const cell = document.createElement("td");
      if (className) cell.className = className;
      if (text) cell.textContent = text;
      if (title) cell.title = title;
      if (element) cell.appendChild(element);
      else row.appendChild(cell);
      if (!element) return;
      row.appendChild(cell);
    });

    const actionsCell = document.createElement("td");
    actionsCell.className = "asset-actions";

    if (asset.url) {
      const copyBtn = Object.assign(document.createElement("button"), {
        className: "action-btn copy-btn",
        innerHTML:
          '<svg class="icon" aria-hidden="true"><use href="#icon-copy"></use></svg>',
        ariaLabel: `Copy URL for ${asset.display_name ?? "asset"}`,
      });
      copyBtn.addEventListener("click", () =>
        this.#copyToClipboard(asset.url, copyBtn)
      );

      const downloadBtn = Object.assign(document.createElement("a"), {
        className: "action-btn download-btn",
        innerHTML:
          '<svg class="icon" aria-hidden="true"><use href="#icon-download"></use></svg>',
        href: asset.url,
        download: asset.display_name ?? "download",
        target: "_blank",
        ariaLabel: `Download ${asset.display_name ?? "asset"}`,
      });

      actionsCell.append(copyBtn, downloadBtn);
    }

    row.appendChild(actionsCell);
    return row;
  }

  #updateEmptyState() {
    const emptyState = document.getElementById("empty-state");
    const tableWrapper = document.querySelector(".table-wrapper");
    const showEmpty = !this.#assets.length && !this.#isLoading;

    emptyState.style.display = showEmpty ? "flex" : "none";
    tableWrapper.style.display = showEmpty ? "none" : "block";
  }

  #handleInputChange = () => {
    const input = document.getElementById("video-input");
    document.getElementById("input-error").classList.remove("show");

    if (input.value.trim() && !this.#isValidInput(input.value)) {
      this.#showError("Please enter a valid Wistia video ID or URL");
    }
  };

  #handleInputKeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.#handleExtractAssets();
    }
  };

  #handleExtractAssets = async () => {
    if (this.#isLoading) return;

    const input = document.getElementById("video-input");
    const videoId = this.#extractVideoId(input.value.trim());

    if (!videoId) {
      this.#showError("Please enter a valid Wistia video ID or URL");
      input.focus();
      return;
    }

    this.#clearError();
    this.#setLoading(true);

    try {
      this.#announceToScreenReader("Extracting video assets...");
      const assets = await this.#fetchAssets(videoId);
      this.#assets = assets;
      this.#filteredAssets = [...assets];
      this.#selectedAssets.clear();
      this.#updateUI();
      this.#showToast(
        "success",
        "Assets extracted successfully",
        `Found ${assets.length} assets`
      );
      this.#announceToScreenReader(
        `Successfully extracted ${assets.length} assets`
      );
    } catch (error) {
      console.error("Error extracting assets:", error);
      this.#showError(
        error.message ??
          "Failed to extract assets. Please check the video ID and try again."
      );
      this.#showToast(
        "error",
        "Extraction failed",
        error.message ?? "Please check the video ID and try again."
      );
    } finally {
      this.#setLoading(false);
    }
  };

  #handleSearchInput = (e) => {
    const query = e.target.value.toLowerCase().trim();

    this.#filteredAssets = query
      ? this.#assets.filter((asset) =>
          [asset.display_name, asset.url, asset.ext].some((field) =>
            field?.toLowerCase().includes(query)
          )
        )
      : [...this.#assets];

    this.#updateUI();
    this.#announceToScreenReader(
      `Search results: ${this.#filteredAssets.length} assets found`
    );
  };

  #handleSelectAll = () => {
    const allSelected = this.#filteredAssets.every((asset) =>
      this.#selectedAssets.has(asset.id)
    );

    this.#filteredAssets.forEach((asset) =>
      allSelected
        ? this.#selectedAssets.delete(asset.id)
        : this.#selectedAssets.add(asset.id)
    );

    this.#announceToScreenReader(
      allSelected
        ? "All assets deselected"
        : `All ${this.#filteredAssets.length} assets selected`
    );
    this.#updateUI();
  };

  #handleSelectAllCheckbox = (e) => {
    this.#filteredAssets.forEach((asset) =>
      e.target.checked
        ? this.#selectedAssets.add(asset.id)
        : this.#selectedAssets.delete(asset.id)
    );
    this.#updateUI();
  };

  #handleAssetSelect = (assetId) => {
    this.#selectedAssets.has(assetId)
      ? this.#selectedAssets.delete(assetId)
      : this.#selectedAssets.add(assetId);
    this.#updateUI();
  };

  #handleBulkDownload = () => {
    if (!this.#selectedAssets.size) {
      this.#showToast(
        "warning",
        "No assets selected",
        "Please select assets to download"
      );
      return;
    }

    const selectedAssets = this.#assets.filter((asset) =>
      this.#selectedAssets.has(asset.id)
    );

    selectedAssets.forEach((asset, index) => {
      if (!asset.url) return;

      setTimeout(() => {
        const link = Object.assign(document.createElement("a"), {
          href: asset.url,
          download: asset.display_name ?? `asset_${index + 1}`,
          target: "_blank",
        });
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 500);
    });

    this.#showToast(
      "success",
      "Download started",
      `Downloading ${this.#selectedAssets.size} selected assets`
    );
    this.#announceToScreenReader(
      `Started downloading ${this.#selectedAssets.size} selected assets`
    );
  };

  #handleExportToggle = () => {
    document.getElementById("export-menu").classList.toggle("show");
  };

  #handleExportOption = (e) => {
    const format = e.target.closest(".dropdown-item")?.dataset.format;
    if (!format) return;

    this.#hideDropdown();
    this.#exportData(format);
  };

  #handleSort = (e) => {
    const sortKey = e.target.closest(".sortable")?.dataset.sort;
    if (!sortKey) return;

    if (this.#sortConfig.key === sortKey) {
      this.#sortConfig.direction =
        this.#sortConfig.direction === "asc" ? "desc" : "asc";
    } else {
      this.#sortConfig.key = sortKey;
      this.#sortConfig.direction = "asc";
    }

    this.#sortAssets();
    this.#updateUI();
    this.#updateSortIndicators();
  };

  async #fetchAssets(videoId) {
    try {
      const response = await fetch(
        `https://fast.wistia.net/embed/iframe/${videoId}?videoFoam=true`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to fetch video data. Please check the video ID."
        );
      }

      const text = await response.text();
      const jsonMatch = text.match(/iframeInit\((.*?), \{\}/);

      if (!jsonMatch) {
        throw new Error(
          "Could not find video data in response. The video might be private or the ID might be incorrect."
        );
      }

      const jsonData = JSON.parse(jsonMatch[1]);

      if (!jsonData.assets?.length) {
        throw new Error("No assets found for this video.");
      }

      return jsonData.assets.map((asset, index) => ({
        ...asset,
        id: `asset_${index}`,
        display_name: asset.display_name ?? `Asset ${index + 1}`,
        size: asset.size ?? 0,
        width: asset.width ?? null,
        height: asset.height ?? null,
        url: this.#processAssetUrl(asset.url, asset.ext, asset.type),
        ext: asset.ext ?? "mp4",
        type: asset.type ?? "video",
      }));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid response format. Please check the video ID.");
      }
      throw error;
    }
  }

  #processAssetUrl(url, ext, type) {
    if (!url) return null;

    const extension =
      ext ||
      {
        original: "mp4",
        iphone_video: "mp4",
        mp4_video: "mp4",
        md_mp4_video: "mp4",
        hd_mp4_video: "mp4",
        still_image: "jpg",
        storyboard: "jpg",
      }[type] ||
      "mp4";

    return url.replace(/\.bin$/, `.${extension}`);
  }

  #extractVideoId(input) {
    if (!input) return null;

    const patterns = [
      /wvideo=([a-zA-Z0-9]+)/,
      /medias\/([a-zA-Z0-9]+)/,
      /embed\/iframe\/([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) return match[1];
    }

    return /^[a-zA-Z0-9]+$/.test(input) ? input : null;
  }

  #isValidInput(input) {
    return this.#extractVideoId(input) !== null;
  }

  #sortAssets() {
    this.#filteredAssets.sort((a, b) => {
      const { key, direction } = this.#sortConfig;

      const getValue = (item) => {
        switch (key) {
          case "size":
            return item.size ?? 0;
          case "name":
            return item.display_name ?? "";
          case "width":
            return (item.width ?? 0) * (item.height ?? 0);
          default:
            return item[key] ?? "";
        }
      };

      const aValue = getValue(a);
      const bValue = getValue(b);

      const compare =
        typeof aValue === "number"
          ? aValue - bValue
          : String(aValue)
              .toLowerCase()
              .localeCompare(String(bValue).toLowerCase());

      return direction === "desc" ? -compare : compare;
    });
  }

  #updateSortIndicators() {
    document.querySelectorAll(".sort-btn").forEach((btn) => {
      const icon = btn.querySelector(".sort-icon");
      const isActive =
        btn.closest(".sortable")?.dataset.sort === this.#sortConfig.key;

      btn.classList.toggle("active", isActive);
      if (isActive) {
        icon.innerHTML = `<use href="#icon-sort-${
          this.#sortConfig.direction === "asc" ? "up" : "down"
        }"></use>`;
      } else {
        icon.innerHTML = '<use href="#icon-sort"></use>';
      }
    });
  }

  #formatSize(bytes) {
    if (!bytes) return "N/A";

    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
  }

  async #copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      const originalContent = button.innerHTML;
      button.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#icon-check"></use></svg>';
      button.classList.add("success");

      setTimeout(() => {
        button.innerHTML = originalContent;
        button.classList.remove("success");
      }, 2000);

      this.#showToast(
        "success",
        "Copied to clipboard",
        "URL copied successfully"
      );
    } catch (error) {
      console.error("Failed to copy:", error);
      this.#showToast(
        "error",
        "Copy failed",
        "Could not copy URL to clipboard"
      );
    }
  }

  #exportData(format) {
    if (!this.#assets.length) {
      this.#showToast(
        "warning",
        "No data to export",
        "Please extract assets first"
      );
      return;
    }

    const data = this.#assets.map(
      ({ display_name, size, width, height, url, type, ext }) => ({
        name: display_name,
        size,
        width,
        height,
        url,
        type,
        extension: ext,
      })
    );

    const exports = {
      csv: {
        content: this.#convertToCSV(data),
        filename: "wistia_assets.csv",
        mimeType: "text/csv",
      },
      json: {
        content: JSON.stringify(data, null, 2),
        filename: "wistia_assets.json",
        mimeType: "application/json",
      },
    };

    const { content, filename, mimeType } = exports[format];
    this.#downloadFile(content, filename, mimeType);
    this.#showToast(
      "success",
      "Export completed",
      `Data exported as ${format.toUpperCase()}`
    );
  }

  #convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const rows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    return rows.join("\n");
  }

  #downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), {
      href: url,
      download: filename,
    });

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  #setLoading(loading) {
    this.#isLoading = loading;
    const extractBtn = document.getElementById("extract-btn");
    const loadingState = document.getElementById("loading-state");

    extractBtn.disabled = loading;
    extractBtn.classList.toggle("loading", loading);
    loadingState.classList.toggle("show", loading);

    this.#updateEmptyState();
  }

  #showError(message) {
    const errorElement = document.getElementById("input-error");
    const input = document.getElementById("video-input");

    errorElement.textContent = message;
    errorElement.classList.add("show");
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }

  #clearError() {
    document.getElementById("input-error").classList.remove("show");
    document.getElementById("video-input").removeAttribute("aria-invalid");
  }

  #showToast(type, title, message) {
    const container = document.getElementById("toast-container");
    const iconMap = {
      success: "icon-check-circle",
      error: "icon-exclamation-circle",
      warning: "icon-exclamation-triangle",
    };

    const toast = Object.assign(document.createElement("div"), {
      className: `toast ${type}`,
      innerHTML: `
        <svg class="icon toast-icon" aria-hidden="true">
          <use href="#${iconMap[type]}"></use>
        </svg>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button type="button" class="toast-close" aria-label="Close notification">
          <svg class="icon" aria-hidden="true">
            <use href="#icon-times"></use>
          </svg>
        </button>
      `,
    });

    container.appendChild(toast);

    toast
      .querySelector(".toast-close")
      .addEventListener("click", () => this.#hideToast(toast));

    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => this.#hideToast(toast), 5000);
  }

  #hideToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }

  #showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    const firstFocusable = modal.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    this.#trapFocus(modal);
  }

  #hideAllModals = () => {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    });
  };

  #hideDropdown() {
    document.getElementById("export-menu").classList.remove("show");
  }

  #trapFocus(element) {
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = [...element.querySelectorAll(focusableSelector)];
    const [firstFocusable, lastFocusable] = [
      focusableElements.at(0),
      focusableElements.at(-1),
    ];

    const handleTabKey = (e) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey && document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    };

    element.addEventListener("keydown", handleTabKey);

    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (m) => m.type === "attributes" && m.attributeName === "class"
        ) &&
        !element.classList.contains("show")
      ) {
        element.removeEventListener("keydown", handleTabKey);
        observer.disconnect();
      }
    });

    observer.observe(element, { attributes: true });
  }

  #announceToScreenReader(message) {
    const liveRegion = document.getElementById("live-region");
    liveRegion && (liveRegion.textContent = message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.wistiaExtractor = new WistiaAssetExtractor();
});

"serviceWorker" in navigator &&
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
