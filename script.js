class WistiaAssetExtractor {
  constructor() {
    this.assets = [];
    this.filteredAssets = [];
    this.selectedAssets = new Set();
    this.sortConfig = { key: null, direction: "asc" };
    this.isLoading = false;

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupKeyboardShortcuts();
    this.setupAccessibility();
    this.updateUI();
  }

  // Event binding
  bindEvents() {
    // Input and extraction
    const videoInput = document.getElementById("video-input");
    const extractBtn = document.getElementById("extract-btn");

    videoInput.addEventListener("input", this.handleInputChange.bind(this));
    videoInput.addEventListener("keydown", this.handleInputKeydown.bind(this));
    extractBtn.addEventListener("click", this.handleExtractAssets.bind(this));

    // Search functionality
    const tableSearch = document.getElementById("table-search");
    tableSearch.addEventListener("input", this.handleSearchInput.bind(this));

    // Control buttons
    const selectAllBtn = document.getElementById("select-all-btn");
    const bulkDownloadBtn = document.getElementById("bulk-download-btn");
    const exportBtn = document.getElementById("export-btn");
    const selectAllCheckbox = document.getElementById("select-all-checkbox");

    selectAllBtn.addEventListener("click", this.handleSelectAll.bind(this));
    bulkDownloadBtn.addEventListener(
      "click",
      this.handleBulkDownload.bind(this)
    );
    exportBtn.addEventListener("click", this.handleExportToggle.bind(this));
    selectAllCheckbox.addEventListener(
      "change",
      this.handleSelectAllCheckbox.bind(this)
    );

    // Export dropdown
    const exportMenu = document.getElementById("export-menu");
    exportMenu.addEventListener("click", this.handleExportOption.bind(this));

    // Table sorting
    const sortButtons = document.querySelectorAll(".sort-btn");
    sortButtons.forEach((btn) => {
      btn.addEventListener("click", this.handleSort.bind(this));
    });

    // Modal controls
    const helpBtn = document.getElementById("help-btn");
    const keyboardShortcutsBtn = document.getElementById(
      "keyboard-shortcuts-btn"
    );
    const modals = document.querySelectorAll(".modal");
    const modalCloses = document.querySelectorAll(".modal-close");

    helpBtn.addEventListener("click", () => this.showModal("help-modal"));
    keyboardShortcutsBtn.addEventListener("click", () =>
      this.showModal("shortcuts-modal")
    );

    modalCloses.forEach((close) => {
      close.addEventListener("click", this.hideAllModals.bind(this));
    });

    modals.forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.hideAllModals();
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown")) {
        this.hideDropdown();
      }
    });
  }

  // Keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Escape key
      if (e.key === "Escape") {
        this.hideAllModals();
        this.hideDropdown();
        return;
      }

      // Skip if modifier key is not pressed or if typing in input
      if (
        e.target.tagName === "INPUT" &&
        e.key !== "Enter" &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        return;
      }

      // Ctrl/Cmd + Enter - Extract assets
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        this.handleExtractAssets();
        return;
      }

      // Ctrl/Cmd + A - Select all (when not in input)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "a" &&
        e.target.tagName !== "INPUT"
      ) {
        e.preventDefault();
        this.handleSelectAll();
        return;
      }

      // Ctrl/Cmd + D - Download selected
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        this.handleBulkDownload();
        return;
      }

      // Enter key on extract button
      if (e.key === "Enter" && e.target.id === "extract-btn") {
        this.handleExtractAssets();
        return;
      }

      // Space key on checkboxes
      if (e.key === " " && e.target.type === "checkbox") {
        e.preventDefault();
        e.target.checked = !e.target.checked;
        e.target.dispatchEvent(new Event("change"));
        return;
      }
    });
  }

  // Accessibility setup
  setupAccessibility() {
    // Add skip to content link
    const skipLink = document.createElement("a");
    skipLink.href = "#main-content";
    skipLink.textContent = "Skip to main content";
    skipLink.className = "skip-link";
    document.body.insertBefore(skipLink, document.body.firstChild);

    // Add aria-live regions for dynamic content
    const liveRegion = document.createElement("div");
    liveRegion.id = "live-region";
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.className = "visually-hidden";
    document.body.appendChild(liveRegion);

    // Add main landmark
    const mainContent = document.querySelector(".main-content");
    if (mainContent) {
      mainContent.id = "main-content";
      mainContent.setAttribute("role", "main");
    }
  }

  // UI Updates
  updateUI() {
    this.updateControlButtons();
    this.updateTable();
    this.updateEmptyState();
  }

  updateControlButtons() {
    const hasAssets = this.assets.length > 0;
    const hasSelected = this.selectedAssets.size > 0;

    // Enable/disable controls based on state
    document.getElementById("table-search").disabled = !hasAssets;
    document.getElementById("select-all-btn").disabled = !hasAssets;
    document.getElementById("bulk-download-btn").disabled = !hasSelected;
    document.getElementById("export-btn").disabled = !hasAssets;

    // Update select all button text
    const selectAllBtn = document.getElementById("select-all-btn");
    if (
      this.selectedAssets.size === this.filteredAssets.length &&
      this.filteredAssets.length > 0
    ) {
      selectAllBtn.innerHTML =
        '<i class="fas fa-times" aria-hidden="true"></i> Deselect All';
    } else {
      selectAllBtn.innerHTML =
        '<i class="fas fa-check-double" aria-hidden="true"></i> Select All';
    }

    // Update bulk download button text
    const bulkDownloadBtn = document.getElementById("bulk-download-btn");
    if (hasSelected) {
      bulkDownloadBtn.innerHTML = `<i class="fas fa-download" aria-hidden="true"></i> Download Selected (${this.selectedAssets.size})`;
    } else {
      bulkDownloadBtn.innerHTML =
        '<i class="fas fa-download" aria-hidden="true"></i> Download Selected';
    }
  }

  updateTable() {
    const tbody = document.getElementById("assets-tbody");
    const selectAllCheckbox = document.getElementById("select-all-checkbox");

    tbody.innerHTML = "";

    if (this.filteredAssets.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    // Update select all checkbox state
    const selectedCount = this.filteredAssets.filter((asset) =>
      this.selectedAssets.has(asset.id)
    ).length;
    if (selectedCount === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (selectedCount === this.filteredAssets.length) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }

    // Render table rows
    this.filteredAssets.forEach((asset) => {
      const row = this.createAssetRow(asset);
      tbody.appendChild(row);
    });

    // Update live region for screen readers
    this.announceToScreenReader(
      `Table updated with ${this.filteredAssets.length} assets`
    );
  }

  createAssetRow(asset) {
    const row = document.createElement("tr");
    row.setAttribute("data-asset-id", asset.id);

    // Selection checkbox
    const selectCell = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "select-checkbox";
    checkbox.checked = this.selectedAssets.has(asset.id);
    checkbox.setAttribute(
      "aria-label",
      `Select ${asset.display_name || "asset"}`
    );
    checkbox.addEventListener("change", () => this.handleAssetSelect(asset.id));
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    // Name
    const nameCell = document.createElement("td");
    nameCell.className = "asset-name";
    nameCell.textContent = asset.display_name || "Unknown";
    row.appendChild(nameCell);

    // Size
    const sizeCell = document.createElement("td");
    sizeCell.className = "asset-size";
    sizeCell.textContent = this.formatSize(asset.size);
    row.appendChild(sizeCell);

    // Dimensions
    const dimensionsCell = document.createElement("td");
    dimensionsCell.className = "asset-dimensions";
    if (asset.width && asset.height) {
      dimensionsCell.textContent = `${asset.width} × ${asset.height}`;
    } else {
      dimensionsCell.textContent = "N/A";
    }
    row.appendChild(dimensionsCell);

    // URL
    const urlCell = document.createElement("td");
    urlCell.className = "asset-url";
    urlCell.textContent = asset.url || "N/A";
    urlCell.setAttribute("title", asset.url || "N/A");
    row.appendChild(urlCell);

    // Actions
    const actionsCell = document.createElement("td");
    actionsCell.className = "asset-actions";

    if (asset.url) {
      // Copy button
      const copyBtn = document.createElement("button");
      copyBtn.className = "action-btn copy-btn";
      copyBtn.innerHTML = '<i class="fas fa-copy" aria-hidden="true"></i>';
      copyBtn.setAttribute(
        "aria-label",
        `Copy URL for ${asset.display_name || "asset"}`
      );
      copyBtn.addEventListener("click", () =>
        this.copyToClipboard(asset.url, copyBtn)
      );
      actionsCell.appendChild(copyBtn);

      // Download button
      const downloadBtn = document.createElement("a");
      downloadBtn.className = "action-btn download-btn";
      downloadBtn.innerHTML =
        '<i class="fas fa-download" aria-hidden="true"></i>';
      downloadBtn.href = asset.url;
      downloadBtn.download = asset.display_name || "download";
      downloadBtn.target = "_blank";
      downloadBtn.setAttribute(
        "aria-label",
        `Download ${asset.display_name || "asset"}`
      );
      actionsCell.appendChild(downloadBtn);
    }

    row.appendChild(actionsCell);
    return row;
  }

  updateEmptyState() {
    const emptyState = document.getElementById("empty-state");
    const tableWrapper = document.querySelector(".table-wrapper");

    if (this.assets.length === 0 && !this.isLoading) {
      emptyState.style.display = "flex";
      tableWrapper.style.display = "none";
    } else {
      emptyState.style.display = "none";
      tableWrapper.style.display = "block";
    }
  }

  // Event handlers
  handleInputChange() {
    const input = document.getElementById("video-input");
    const errorElement = document.getElementById("input-error");

    // Clear previous error
    errorElement.classList.remove("show");

    // Validate input
    if (input.value.trim() && !this.isValidInput(input.value)) {
      this.showError("Please enter a valid Wistia video ID or URL");
    }
  }

  handleInputKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      this.handleExtractAssets();
    }
  }

  async handleExtractAssets() {
    if (this.isLoading) return;

    const input = document.getElementById("video-input");
    const videoId = this.extractVideoId(input.value.trim());

    if (!videoId) {
      this.showError("Please enter a valid Wistia video ID or URL");
      input.focus();
      return;
    }

    this.clearError();
    this.setLoading(true);

    try {
      this.announceToScreenReader("Extracting video assets...");
      const assets = await this.fetchAssets(videoId);
      this.assets = assets;
      this.filteredAssets = [...assets];
      this.selectedAssets.clear();
      this.updateUI();
      this.showToast(
        "success",
        "Assets extracted successfully",
        `Found ${assets.length} assets`
      );
      this.announceToScreenReader(
        `Successfully extracted ${assets.length} assets`
      );
    } catch (error) {
      console.error("Error extracting assets:", error);
      this.showError(
        error.message ||
          "Failed to extract assets. Please check the video ID and try again."
      );
      this.showToast(
        "error",
        "Extraction failed",
        error.message || "Please check the video ID and try again."
      );
    } finally {
      this.setLoading(false);
    }
  }

  handleSearchInput(e) {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      this.filteredAssets = [...this.assets];
    } else {
      this.filteredAssets = this.assets.filter(
        (asset) =>
          (asset.display_name || "").toLowerCase().includes(query) ||
          (asset.url || "").toLowerCase().includes(query) ||
          (asset.ext || "").toLowerCase().includes(query)
      );
    }

    this.updateUI();
    this.announceToScreenReader(
      `Search results: ${this.filteredAssets.length} assets found`
    );
  }

  handleSelectAll() {
    const allSelected = this.filteredAssets.every((asset) =>
      this.selectedAssets.has(asset.id)
    );

    if (allSelected) {
      // Deselect all

      this.filteredAssets.forEach((asset) =>
        this.selectedAssets.delete(asset.id)
      );
      this.announceToScreenReader("All assets deselected");
    } else {
      // Select all
      this.filteredAssets.forEach((asset) => this.selectedAssets.add(asset.id));
      this.announceToScreenReader(
        `All ${this.filteredAssets.length} assets selected`
      );
    }

    this.updateUI();
  }

  handleSelectAllCheckbox(e) {
    if (e.target.checked) {
      this.filteredAssets.forEach((asset) => this.selectedAssets.add(asset.id));
    } else {
      this.filteredAssets.forEach((asset) =>
        this.selectedAssets.delete(asset.id)
      );
    }
    this.updateUI();
  }

  handleAssetSelect(assetId) {
    if (this.selectedAssets.has(assetId)) {
      this.selectedAssets.delete(assetId);
    } else {
      this.selectedAssets.add(assetId);
    }
    this.updateUI();
  }

  handleBulkDownload() {
    if (this.selectedAssets.size === 0) {
      this.showToast(
        "warning",
        "No assets selected",
        "Please select assets to download"
      );
      return;
    }

    const selectedAssetsList = this.assets.filter((asset) =>
      this.selectedAssets.has(asset.id)
    );
    let downloadCount = 0;

    selectedAssetsList.forEach((asset, index) => {
      if (asset.url) {
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = asset.url;
          link.download = asset.display_name || `asset_${index + 1}`;
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          downloadCount++;
        }, index * 500); // Stagger downloads
      }
    });

    this.showToast(
      "success",
      "Download started",
      `Downloading ${this.selectedAssets.size} selected assets`
    );
    this.announceToScreenReader(
      `Started downloading ${this.selectedAssets.size} selected assets`
    );
  }

  handleExportToggle() {
    const dropdown = document.getElementById("export-menu");
    dropdown.classList.toggle("show");
  }

  handleExportOption(e) {
    const format = e.target.closest(".dropdown-item")?.dataset.format;
    if (!format) return;

    this.hideDropdown();
    this.exportData(format);
  }

  handleSort(e) {
    const sortKey = e.target.closest(".sortable")?.dataset.sort;
    if (!sortKey) return;

    // Toggle sort direction
    if (this.sortConfig.key === sortKey) {
      this.sortConfig.direction =
        this.sortConfig.direction === "asc" ? "desc" : "asc";
    } else {
      this.sortConfig.key = sortKey;
      this.sortConfig.direction = "asc";
    }

    this.sortAssets();
    this.updateUI();
    this.updateSortIndicators();
  }

  // Core functionality
  async fetchAssets(videoId) {
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

      if (!jsonData.assets || !Array.isArray(jsonData.assets)) {
        throw new Error("No assets found for this video.");
      }

      return jsonData.assets.map((asset, index) => ({
        ...asset,
        id: `asset_${index}`,
        display_name: asset.display_name || `Asset ${index + 1}`,
        size: asset.size || 0,
        width: asset.width || null,
        height: asset.height || null,
        url: this.processAssetUrl(asset.url, asset.ext, asset.type),
        ext: asset.ext || "mp4",
        type: asset.type || "video",
      }));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("Invalid response format. Please check the video ID.");
      }
      throw error;
    }
  }

  processAssetUrl(url, ext, type) {
    if (!url) return null;

    // Determine the correct extension based on type and ext field
    let extension = ext || "";

    // If no extension provided, determine from type
    if (!extension) {
      switch (type) {
        case "original":
          extension = "mp4";
          break;
        case "iphone_video":
        case "mp4_video":
        case "md_mp4_video":
        case "hd_mp4_video":
          extension = "mp4";
          break;
        case "still_image":
        case "storyboard":
          extension = "jpg";
          break;
        default:
          extension = "mp4";
      }
    }

    // Replace .bin extension with proper extension
    const finalExtension = extension ? `.${extension}` : ".mp4";
    return url.replace(/\.bin$/, finalExtension);
  }

  extractVideoId(input) {
    if (!input) return null;

    // Clean input
    input = input.trim();

    // Try to extract from wvideo parameter
    const wvideoMatch = input.match(/wvideo=([a-zA-Z0-9]+)/);
    if (wvideoMatch) {
      return wvideoMatch[1];
    }

    // Try to extract from medias URL
    const mediasMatch = input.match(/medias\/([a-zA-Z0-9]+)/);
    if (mediasMatch) {
      return mediasMatch[1];
    }

    // Try to extract from embed URL
    const embedMatch = input.match(/embed\/iframe\/([a-zA-Z0-9]+)/);
    if (embedMatch) {
      return embedMatch[1];
    }

    // Check if it's already a video ID (alphanumeric string)
    if (/^[a-zA-Z0-9]+$/.test(input)) {
      return input;
    }

    return null;
  }

  isValidInput(input) {
    return this.extractVideoId(input) !== null;
  }

  sortAssets() {
    this.filteredAssets.sort((a, b) => {
      const { key, direction } = this.sortConfig;
      let aValue = a[key];
      let bValue = b[key];

      // Handle special cases
      if (key === "size") {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else if (key === "name") {
        aValue = a.display_name || "";
        bValue = b.display_name || "";
      } else if (key === "width") {
        aValue = (a.width || 0) * (a.height || 0);
        bValue = (b.width || 0) * (b.height || 0);
      }

      // Convert to string for comparison if not number
      if (typeof aValue !== "number") {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return direction === "desc" ? -result : result;
    });
  }

  updateSortIndicators() {
    const sortButtons = document.querySelectorAll(".sort-btn");

    sortButtons.forEach((btn) => {
      const icon = btn.querySelector(".sort-icon");
      btn.classList.remove("active");

      if (btn.closest(".sortable")?.dataset.sort === this.sortConfig.key) {
        btn.classList.add("active");
        icon.className =
          this.sortConfig.direction === "asc"
            ? "fas fa-sort-up sort-icon"
            : "fas fa-sort-down sort-icon";
      } else {
        icon.className = "fas fa-sort sort-icon";
      }
    });
  }

  // Utility functions
  formatSize(bytes) {
    if (!bytes || bytes === 0) return "N/A";

    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
  }

  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      // Update button appearance
      const originalContent = button.innerHTML;
      button.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
      button.classList.add("success");

      // Reset after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.classList.remove("success");
      }, 2000);

      this.showToast(
        "success",
        "Copied to clipboard",
        "URL copied successfully"
      );
    } catch (error) {
      console.error("Failed to copy:", error);
      this.showToast("error", "Copy failed", "Could not copy URL to clipboard");
    }
  }

  exportData(format) {
    if (this.assets.length === 0) {
      this.showToast(
        "warning",
        "No data to export",
        "Please extract assets first"
      );
      return;
    }

    const data = this.assets.map((asset) => ({
      name: asset.display_name,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      url: asset.url,
      type: asset.type,
      extension: asset.ext,
    }));

    let content, filename, mimeType;

    if (format === "csv") {
      content = this.convertToCSV(data);
      filename = "wistia_assets.csv";
      mimeType = "text/csv";
    } else if (format === "json") {
      content = JSON.stringify(data, null, 2);
      filename = "wistia_assets.json";
      mimeType = "application/json";
    }

    this.downloadFile(content, filename, mimeType);
    this.showToast(
      "success",
      "Export completed",
      `Data exported as ${format.toUpperCase()}`
    );
  }

  convertToCSV(data) {
    const headers = Object.keys(data[0]);
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(","));

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header] || "";
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });

    return csvRows.join("\n");
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // UI State Management
  setLoading(loading) {
    this.isLoading = loading;
    const extractBtn = document.getElementById("extract-btn");
    const loadingState = document.getElementById("loading-state");

    if (loading) {
      extractBtn.disabled = true;
      extractBtn.classList.add("loading");
      loadingState.classList.add("show");
    } else {
      extractBtn.disabled = false;
      extractBtn.classList.remove("loading");
      loadingState.classList.remove("show");
    }

    this.updateEmptyState();
  }

  showError(message) {
    const errorElement = document.getElementById("input-error");
    errorElement.textContent = message;
    errorElement.classList.add("show");

    // Focus management for accessibility
    const input = document.getElementById("video-input");
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }

  clearError() {
    const errorElement = document.getElementById("input-error");
    errorElement.classList.remove("show");

    const input = document.getElementById("video-input");
    input.removeAttribute("aria-invalid");
  }

  showToast(type, title, message) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const iconClass = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
    }[type];

    toast.innerHTML = `
          <i class="${iconClass} toast-icon" aria-hidden="true"></i>
          <div class="toast-content">
              <div class="toast-title">${title}</div>
              <div class="toast-message">${message}</div>
          </div>
          <button type="button" class="toast-close" aria-label="Close notification">
              <i class="fas fa-times" aria-hidden="true"></i>
          </button>
      `;

    container.appendChild(toast);

    // Add close functionality
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => this.hideToast(toast));

    // Show toast
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideToast(toast);
    }, 5000);
  }

  hideToast(toast) {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    // Focus management
    const firstFocusable = modal.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Trap focus within modal
    this.trapFocus(modal);
  }

  hideAllModals() {
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  hideDropdown() {
    const dropdown = document.getElementById("export-menu");
    dropdown.classList.remove("show");
  }

  trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener("keydown", handleTabKey);

    // Remove event listener when modal is hidden
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          if (!element.classList.contains("show")) {
            element.removeEventListener("keydown", handleTabKey);
            observer.disconnect();
          }
        }
      });
    });

    observer.observe(element, { attributes: true });
  }

  announceToScreenReader(message) {
    const liveRegion = document.getElementById("live-region");
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.wistiaExtractor = new WistiaAssetExtractor();
});

// Service Worker registration for offline functionality (optional)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed, continue without it
    });
  });
}
