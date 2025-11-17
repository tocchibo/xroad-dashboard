(() => {
  "use strict";

  const REQUIRED_COLUMNS = [
    "施設名",
    "路線名",
    "架設年度_西暦",
    "橋長(m)",
    "径間数",
    "上部工（使用材料）",
    "道路管理者名称",
    "道路管理者_管理事務所名",
    "起点側位置_緯度",
    "起点側位置_経度",
    "点検記録_点検実施年度",
    "点検記録_判定区分",
  ];

  const COLUMN_ALIASES = {
    "道路管理者名称": ["道路管理者名", "道路管理者_名称"],
    "道路管理者_管理事務所名": ["道路管理者管理事務所名", "道路管理事務所名"],
    "上部工（使用材料）": ["上部工_使用材料等", "上部工_使用材料", "上部工使用材料"],
    "架設年度_西暦": ["架設年度", "架設年"],
    "橋長(m)": ["橋長", "橋長【m】", "橋長(ｍ)"],
    "径間数": ["径間", "径間数（径間）"],
    "点検記録_点検実施年度": ["点検記録_点検実施年次", "点検実施年度"],
    "点検記録_判定区分": ["点検判定区分", "判定区分"],
    "起点側位置_緯度": ["緯度"],
    "起点側位置_経度": ["経度"],
  };

  const BRIDGE_TYPES = ["PC橋", "RC橋", "鋼橋", "その他"];
  const BRIDGE_TYPE_RULES = [
    { type: "PC橋", keywords: ["PC", "ＰＣ", "PRC", "ＰＲＣ", "プレストレスト", "ポストテンション"] },
    { type: "RC橋", keywords: ["RC", "ＲＣ", "鉄筋", "REINFORCED", "ＲＥＩＮＦＯＲＣＥＤ"] },
    { type: "鋼橋", keywords: ["鋼", "Ｓ造", "STEEL", "スチール", "トラス", "鋼桁"] },
  ];

  const INSPECTION_LEVELS = ["I", "II", "III", "IV", "UNKNOWN"];
  const INSPECTION_COLOR_MAP = {
    I: "#2563eb",
    II: "#16a34a",
    III: "#facc15",
    IV: "#dc2626",
    UNKNOWN: "#9ca3af",
  };

  const BRIDGE_TYPE_COLOR_MAP = {
    "PC橋": "#2563eb",
    "RC橋": "#0f766e",
    "鋼橋": "#f97316",
    "その他": "#8b5cf6",
  };

  const PC_TENSION_SEGMENTS = [
    { key: "pretension", label: "プレテン", color: "#0ea5e9" },
    { key: "posttension", label: "ポステン", color: "#f97316" },
    { key: "other", label: "不明", color: "#94a3b8" },
  ];

  const PC_POST_SEGMENTS = [
    { key: "hollow", label: "ポステン中空床版" },
    { key: "tGirder", label: "ポステンT桁" },
    { key: "box", label: "ポステン箱桁" },
    { key: "other", label: "その他" },
  ];

  const PC_POST_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#94a3b8"];

  const DATASET_COLORS = ["#0ea5e9", "#10b981", "#f97316", "#ec4899", "#6366f1", "#14b8a6"];
  const DEFAULT_MAP_CENTER = [36.2048, 138.2529];
  const MAP_MARKER_BASE_SCALE = 0.55;
  const MAP_MARKER_MIN_DELTA = -50;
  const MAP_MARKER_MAX_DELTA = 50;
  const MAP_MARKER_BASE_SIZE = 22;
  const MAP_MARKER_MIN_SIZE = 6;

  const state = {
    datasets: [],
    logs: [],
    filters: {
      bridgeTypes: new Set(BRIDGE_TYPES),
      inspectionLevels: new Set(INSPECTION_LEVELS),
      lengthBinSize: 10,
      stockMode: "count",
      stockScope: "bridgeType",
      yearGrouping: "decade",
      excludeCulvert: false,
    },
    charts: {
      stock: null,
      rating: null,
      length: null,
      year: null,
      pcTension: null,
      pcPost: null,
    },
    map: null,
    mapLayer: null,
    forceFitMap: false,
    prevMapCount: 0,
    lastUploadSummaries: [],
    mapMarkerScale: MAP_MARKER_BASE_SCALE,
  };

  const elements = {
    datasetList: document.querySelector("[data-dataset-list]"),
    datasetEmpty: document.querySelector("[data-dataset-empty]"),
    dropzone: document.querySelector("[data-dropzone]"),
    fileInput: document.querySelector("[data-file-input]"),
    uploadFeedback: document.querySelector("[data-upload-feedback]"),
    logList: document.querySelector("[data-log-list]"),
    logClear: document.querySelector("[data-clear-log]"),
    bridgeTypeFilter: document.querySelector("[data-filter-bridge-types]"),
    inspectionFilter: document.querySelector("[data-filter-inspections]"),
    culvertFilter: document.querySelector("[data-filter-exclude-culvert]"),
    lengthBinRange: document.querySelector("[data-length-bin-range]"),
    lengthBinLabel: document.querySelector("[data-length-bin-label]"),
    stockModeSelect: document.querySelector("[data-stock-mode]"),
    stockScopeSelect: document.querySelector("[data-stock-scope]"),
    yearGroupingSelect: document.querySelector("[data-year-grouping]"),
    kpis: {
      datasets: document.querySelector('[data-kpi="datasets"]'),
      bridges: document.querySelector('[data-kpi="bridges"]'),
      length: document.querySelector('[data-kpi="length"]'),
      flagged: document.querySelector('[data-kpi="flagged"]'),
    },
    mapCount: document.querySelector("[data-map-count]"),
    mapMissing: document.querySelector("[data-map-missing]"),
    mapSizeRange: document.querySelector("[data-marker-size-range]"),
    mapSizeLabel: document.querySelector("[data-marker-size-label]"),
    culvertHints: Array.from(document.querySelectorAll("[data-culvert-hint]")),
  };

  init();

  function init() {
    buildFilterChips();
    bindRangeControl();
    bindSelectControls();
    bindCulvertFilter();
    bindMapControls();
    bindDropzone();
    bindLogClear();
    initCharts();
    initMap();
    renderUploadFeedback();
    renderLogs();
    if (!window.Papa) addLog("Papa Parse の読み込みに失敗しました。", "error");
    if (!window.Chart) addLog("Chart.js が利用できません。", "error");
    if (!window.L) addLog("Leaflet が利用できません。", "error");
  }

  function buildFilterChips() {
    if (elements.bridgeTypeFilter) {
      BRIDGE_TYPES.forEach((type) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = type;
        chip.textContent = type;
        chip.addEventListener("click", () => toggleFilter(state.filters.bridgeTypes, type, chip));
        elements.bridgeTypeFilter.appendChild(chip);
      });
    }
    if (elements.inspectionFilter) {
      INSPECTION_LEVELS.forEach((level) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = level;
        chip.textContent = level;
        chip.addEventListener("click", () => toggleFilter(state.filters.inspectionLevels, level, chip));
        elements.inspectionFilter.appendChild(chip);
      });
    }
  }

  function toggleFilter(set, value, chipEl) {
    if (set.has(value)) {
      set.delete(value);
      chipEl.classList.remove("is-active");
    } else {
      set.add(value);
      chipEl.classList.add("is-active");
    }
    refreshAll();
  }

  function bindRangeControl() {
    const range = elements.lengthBinRange;
    if (!range) return;
    const updateLabel = () => {
      if (elements.lengthBinLabel) {
        elements.lengthBinLabel.textContent = `${state.filters.lengthBinSize} m`;
      }
    };
    range.addEventListener("input", (event) => {
      const value = Number(event.currentTarget.value);
      if (!Number.isFinite(value)) return;
      state.filters.lengthBinSize = value;
      updateLabel();
      updateLengthChart();
    });
    state.filters.lengthBinSize = Number(range.value) || 10;
    updateLabel();
  }

  function bindMapControls() {
    const range = elements.mapSizeRange;
    if (!range) return;
    const clampDelta = (value) => Math.min(Math.max(value, MAP_MARKER_MIN_DELTA), MAP_MARKER_MAX_DELTA);
    const updateLabel = () => {
      if (elements.mapSizeLabel) {
        const ratio = state.mapMarkerScale / MAP_MARKER_BASE_SCALE;
        elements.mapSizeLabel.textContent = `${Math.round(ratio * 100)}%`;
      }
    };
    const applyValue = (deltaPercent) => {
      if (!Number.isFinite(deltaPercent)) return;
      const clamped = clampDelta(deltaPercent);
      state.mapMarkerScale = MAP_MARKER_BASE_SCALE * (1 + clamped / 100);
      range.value = clamped;
      updateLabel();
      updateMap();
    };
    range.addEventListener("input", (event) => {
      applyValue(Number(event.currentTarget.value));
    });
    const initialDelta = Number(range.value);
    applyValue(Number.isFinite(initialDelta) ? initialDelta : 0);
  }

  function bindSelectControls() {
    elements.stockModeSelect?.addEventListener("change", (event) => {
      state.filters.stockMode = event.currentTarget.value;
      updateStockChart();
    });
    elements.stockScopeSelect?.addEventListener("change", (event) => {
      state.filters.stockScope = event.currentTarget.value;
      updateStockChart();
    });
    elements.yearGroupingSelect?.addEventListener("change", (event) => {
      state.filters.yearGrouping = event.currentTarget.value;
      updateYearChart();
    });
  }

  function bindCulvertFilter() {
    const checkbox = elements.culvertFilter;
    if (!checkbox) return;
    checkbox.checked = state.filters.excludeCulvert;
    checkbox.addEventListener("change", (event) => {
      state.filters.excludeCulvert = Boolean(event.currentTarget.checked);
      refreshAll();
    });
  }

  function bindDropzone() {
    const dropzone = elements.dropzone;
    const fileInput = elements.fileInput;
    if (!dropzone || !fileInput) return;
    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-active");
      });
    });
    ["dragleave", "dragend"].forEach((eventName) => {
      dropzone.addEventListener(eventName, () => dropzone.classList.remove("is-active"));
    });
    dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-active");
      const files = event.dataTransfer?.files;
      if (files?.length) handleIncomingFiles(files);
    });
    dropzone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        fileInput.click();
      }
    });
    fileInput.addEventListener("change", (event) => {
      const { files } = event.currentTarget;
      if (files?.length) {
        handleIncomingFiles(files);
      }
      fileInput.value = "";
    });
  }

  function bindLogClear() {
    elements.logClear?.addEventListener("click", () => {
      state.logs = [];
      renderLogs();
    });
  }

  function handleIncomingFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    state.lastUploadSummaries = [];
    files.forEach((file) => parseCsv(file));
  }

  function parseCsv(file) {
    if (!window.Papa) {
      addLog("Papa Parse が利用できないため CSV を読み込めません。", "error");
      return;
    }
    addLog(`「${file.name}」の解析を開始`, "info");
    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "Shift_JIS",
      dynamicTyping: false,
      transformHeader: (header) => (header ?? "").trim(),
      complete: (results) => handleParseResult(file, results),
      error: (error) => addLog(`「${file.name}」の読み込みに失敗: ${error.message}`, "error"),
    });
  }

  function handleParseResult(file, results) {
    const fields = results?.meta?.fields ?? [];
    const missing = REQUIRED_COLUMNS.filter((column) => !hasColumn(fields, column));
    if (missing.length) {
      addLog(`「${file.name}」に必須列が不足: ${missing.join(", ")}`, "error");
      return;
    }

    const datasetId = `dataset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalized = (Array.isArray(results.data) ? results.data : [])
      .map((row) => normalizeRow(row, datasetId))
      .filter((row) => row !== null);

    if (!normalized.length) {
      addLog(`「${file.name}」には有効なレコードがありませんでした。`, "warning");
      return;
    }

    const datasetLabel = deriveDatasetLabel(file, normalized);
    const datasetColor = DATASET_COLORS[state.datasets.length % DATASET_COLORS.length];
    const stats = computeDatasetStats(normalized);
    state.datasets.unshift({
      id: datasetId,
      label: datasetLabel,
      fileName: file.name,
      lastUpdated: formatDate(new Date(file.lastModified || Date.now())),
      records: normalized,
      stats,
      active: true,
      color: datasetColor,
    });
    state.forceFitMap = true;
    state.lastUploadSummaries.push({ fileName: file.name, label: datasetLabel, rows: normalized.length });

    addLog(`「${file.name}」を dataset「${datasetLabel}」として登録 (${normalized.length} 件)`, "info");
    if (results.errors?.length) {
      addLog(`「${file.name}」解析時に警告 ${results.errors.length} 件`, "warning");
    }
    renderUploadFeedback();
    refreshAll();
  }

  function hasColumn(fields, columnName) {
    if (fields.includes(columnName)) return true;
    const aliases = COLUMN_ALIASES[columnName];
    return Array.isArray(aliases) ? aliases.some((alias) => fields.includes(alias)) : false;
  }

  function normalizeRow(row, datasetId) {
    const values = row || {};
    const facilityName = sanitizeText(values["施設名"]);
    const routeName = sanitizeText(values["路線名"]);
    const builtYear = parseNumber(values["架設年度_西暦"] ?? values["架設年度"]);
    const bridgeLengthM = parseNumber(values["橋長(m)"]);
    const spans = parseNumber(values["径間数"]);
    const materialRaw = sanitizeText(
      values["上部工（使用材料）"] ??
        values["上部工_使用材料等"] ??
        values["上部工_使用材料"] ??
        values["上部工使用材料"]
    );
    const managementName = sanitizeText(
      values["道路管理者名称"] ?? values["道路管理者_名称"] ?? values["道路管理者名"]
    );
    const managementOffice = sanitizeText(
      values["道路管理者_管理事務所名"] ?? values["道路管理者管理事務所名"]
    );
    const lat = parseNumber(values["起点側位置_緯度"]);
    const lng = parseNumber(values["起点側位置_経度"]);
    const inspectionYear = parseNumber(values["点検記録_点検実施年度"]);
    const inspectionLevel = normalizeInspection(values["点検記録_判定区分"]);
    const superstructureType = sanitizeText(values["上部構造形式"]);
    const superstructureForm = sanitizeText(
      values["上部工（構造形式）"] ?? values["上部工_構造形式"] ?? values["上部工構造形式"]
    );
    const pcMetadata = derivePcMetadata(superstructureType, superstructureForm, materialRaw);
    const isCulvert = detectCulvert(superstructureType, superstructureForm);

    const isEmpty =
      !facilityName &&
      !routeName &&
      builtYear === null &&
      bridgeLengthM === null &&
      !materialRaw &&
      !managementName &&
      inspectionYear === null &&
      inspectionLevel === "UNKNOWN";
    if (isEmpty) return null;

    return {
      id: `${datasetId}-${Math.random().toString(36).slice(2, 8)}`,
      datasetId,
      datasetLabel: managementName || datasetId,
      facilityName: facilityName || "名称未設定",
      routeName: routeName || "路線名未設定",
      builtYear: builtYear ?? null,
      bridgeLengthM: bridgeLengthM ?? 0,
      spans: spans ?? null,
      materialRaw,
      managementName,
      managementOffice,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      inspectionYear: inspectionYear ?? null,
      inspectionLevel,
      bridgeType: deriveBridgeType(materialRaw),
      superstructureType,
      superstructureForm,
      isCulvert,
      pcTensionType: pcMetadata.tensionType,
      pcPostCategory: pcMetadata.postCategory,
    };
  }

  function deriveBridgeType(material) {
    if (!material) return "その他";
    const normalized = material.toUpperCase();
    for (const rule of BRIDGE_TYPE_RULES) {
      if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
        return rule.type;
      }
    }
    return "その他";
  }

  function derivePcMetadata(superstructureType, superstructureForm, materialRaw) {
    const sources = [superstructureType, superstructureForm, materialRaw].filter(Boolean);
    if (!sources.length) {
      return { tensionType: null, postCategory: null };
    }
    const normalized = normalizeForMatch(sources.join(" "));
    let tensionType = null;
    if (
      includesAnyKeyword(normalized, [
        "ポステン",
        "ﾎﾟｽﾃﾝ",
        "ポストテン",
        "ポストテンション",
        "POSTTENSION",
        "POST-TENSION",
        "POST TENSION",
      ])
    ) {
      tensionType = "posttension";
    } else if (
      includesAnyKeyword(normalized, ["プレテン", "ﾌﾟﾚﾃﾝ", "プリテン", "PRETENSION", "PRE-TENSION", "PRE TENSION"])
    ) {
      tensionType = "pretension";
    }

    let postCategory = null;
    if (tensionType === "posttension") {
      const detailSource = normalizeForMatch(superstructureType?.split("_")[1] || superstructureType || "");
      if (detailSource.includes("中空床版")) postCategory = "hollow";
      else if (detailSource.includes("T桁")) postCategory = "tGirder";
      else if (detailSource.includes("箱桁")) postCategory = "box";
      else if (detailSource) {
        postCategory = "other";
      }
    }
    return { tensionType, postCategory };
  }

  function detectCulvert(superstructureType, superstructureForm) {
    const combined = [superstructureType, superstructureForm].filter(Boolean).join(" ");
    if (!combined) return false;
    const normalized = normalizeForMatch(combined);
    return includesAnyKeyword(normalized, ["カルバート", "溝橋", "CULVERT"]);
  }

  function deriveDatasetLabel(file, records) {
    const withManagement = records.find((record) => record.managementName);
    if (withManagement?.managementName) return withManagement.managementName;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return baseName || file.name;
  }

  function computeDatasetStats(records) {
    const bridgeCount = records.length;
    const totalLengthKm = records.reduce((sum, record) => sum + (record.bridgeLengthM || 0), 0) / 1000;
    const flagged = records.filter((record) => record.inspectionLevel === "III" || record.inspectionLevel === "IV")
      .length;
    const inspected = records.filter((record) => record.inspectionLevel !== "UNKNOWN").length;
    const years = records
      .map((record) => record.builtYear)
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b);
    const yearRange = years.length ? `${years[0]}-${years[years.length - 1]}` : "架設年不明";
    const withCoords = records.filter((record) => Number.isFinite(record.lat) && Number.isFinite(record.lng)).length;
    return {
      bridgeCount,
      totalLengthKm,
      flagged,
      inspectionRate: bridgeCount ? inspected / bridgeCount : 0,
      yearRange,
      withCoords,
      missingCoords: bridgeCount - withCoords,
    };
  }

  function refreshAll() {
    updateDatasetList();
    updateKpis();
    updateCharts();
    updateMap();
  }

  function updateDatasetList() {
    if (!elements.datasetList) return;
    const hasDatasets = state.datasets.length > 0;
    if (elements.datasetEmpty) {
      elements.datasetEmpty.hidden = hasDatasets;
    }
    elements.datasetList.innerHTML = "";
    if (!hasDatasets) return;
    state.datasets.forEach((dataset) => {
      elements.datasetList.appendChild(createDatasetCard(dataset));
    });
  }

  function createDatasetCard(dataset) {
    const item = document.createElement("li");
    item.className = "dataset-item";
    if (!dataset.active) item.classList.add("is-muted");

    const header = document.createElement("div");
    header.className = "dataset-header";

    const title = document.createElement("p");
    title.className = "dataset-name";
    title.textContent = dataset.label;
    const badge = document.createElement("span");
    badge.className = "tag tag-outline";
    badge.textContent = dataset.fileName;
    title.appendChild(badge);

    const toggle = document.createElement("label");
    toggle.className = "switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = dataset.active;
    checkbox.addEventListener("change", () => {
      dataset.active = checkbox.checked;
      refreshAll();
    });
    const slider = document.createElement("span");
    slider.className = "switch-slider";
    const srOnly = document.createElement("span");
    srOnly.className = "sr-only";
    srOnly.textContent = `${dataset.label} を表示する`;
    toggle.append(checkbox, slider, srOnly);

    header.append(title, toggle);

    const meta = document.createElement("p");
    meta.className = "dataset-meta";
    meta.textContent = `${formatNumber(dataset.stats.bridgeCount)} 橋 / ${dataset.stats.totalLengthKm.toFixed(
      2
    )} km ・ 最終更新 ${dataset.lastUpdated}`;

    const tags = document.createElement("div");
    tags.className = "dataset-tags";
    tags.append(createTag(`III/IV ${dataset.stats.flagged}`, "tag-success"));
    tags.append(createTag(dataset.stats.yearRange));
    tags.append(createTag(`座標欠損 ${dataset.stats.missingCoords}`, "tag-muted"));

    const progress = document.createElement("div");
    progress.className = "progress";
    const progressInner = document.createElement("span");
    progressInner.style.width = `${Math.round(dataset.stats.inspectionRate * 100)}%`;
    progress.append(progressInner);

    const progressLabel = document.createElement("p");
    progressLabel.className = "progress-label";
    progressLabel.textContent = `点検完了率 ${Math.round(dataset.stats.inspectionRate * 100)}%`;

    item.append(header, meta, tags, progress, progressLabel);
    return item;
  }

  function createTag(text, modifier) {
    const span = document.createElement("span");
    span.className = "tag";
    if (modifier) span.classList.add(modifier);
    span.textContent = text;
    return span;
  }

  function updateKpis() {
    const activeDatasets = state.datasets.filter((dataset) => dataset.active);
    const records = getFilteredRecords();
    const totalLengthKm = records.reduce((sum, record) => sum + (record.bridgeLengthM || 0), 0) / 1000;
    const flagged = records.filter((record) => record.inspectionLevel === "III" || record.inspectionLevel === "IV")
      .length;
    setText(elements.kpis.datasets, formatNumber(activeDatasets.length));
    setText(elements.kpis.bridges, formatNumber(records.length));
    setText(elements.kpis.length, totalLengthKm.toFixed(2));
    setText(elements.kpis.flagged, formatNumber(flagged));
  }

  function updateCharts() {
    updateStockChart();
    updateRatingChart();
    updateLengthChart();
    updateYearChart();
    updatePcTensionChart();
    updatePcPostChart();
    updateCulvertHints();
  }

  function initCharts() {
    if (!window.Chart) return;
    state.charts.stock = createChart("chart-stock", {
      type: "bar",
      data: { labels: [], datasets: [{ label: "橋梁数", data: [], backgroundColor: "#2563eb" }] },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "橋梁数" } },
        },
        plugins: { legend: { display: false } },
      },
    });

    state.charts.rating = createChart("chart-rating", {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    });

    state.charts.length = createChart("chart-length", {
      data: {
        labels: [],
        datasets: [
          { type: "bar", label: "橋梁数", data: [], backgroundColor: "#0ea5e9", order: 1 },
          {
            type: "line",
            label: "累積相対度数",
            data: [],
            yAxisID: "y1",
            borderColor: "#f97316",
            tension: 0.3,
            borderWidth: 2,
            backgroundColor: "#f97316",
            pointRadius: 3,
            pointBackgroundColor: "#f97316",
            fill: false,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "橋梁数" } },
          y1: {
            position: "right",
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: "累積相対度数 (%)" },
            min: 0,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`,
            },
          },
        },
      },
    });

    state.charts.year = createChart("chart-year", {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, title: { display: true, text: "橋梁数" } },
        },
      },
    });

    state.charts.pcTension = createChart("chart-pc-tension", {
      type: "bar",
      data: {
        labels: PC_TENSION_SEGMENTS.map((segment) => segment.label),
        datasets: [
          {
            label: "橋梁数",
            data: PC_TENSION_SEGMENTS.map(() => 0),
            backgroundColor: PC_TENSION_SEGMENTS.map((segment) => segment.color),
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "橋梁数" } },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });

    state.charts.pcPost = createChart("chart-pc-post", {
      type: "bar",
      data: {
        labels: PC_POST_SEGMENTS.map((segment) => segment.label),
        datasets: [
          {
            label: "橋梁数",
            data: PC_POST_SEGMENTS.map(() => 0),
            backgroundColor: PC_POST_COLORS,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "橋梁数" } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  function createChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return null;
    const mergedConfig = {
      ...config,
      options: {
        responsive: true,
        ...(config.options || {}),
        maintainAspectRatio: false,
      },
    };
    return new window.Chart(canvas.getContext("2d"), mergedConfig);
  }

  function updateStockChart() {
    const chart = state.charts.stock;
    if (!chart) return;
    const records = getFilteredRecords();
    const { stockMode, stockScope } = state.filters;
    const labelText = stockMode === "count" ? "橋梁数" : "総延長 (km)";
    let labels = [];
    let values = [];

    if (stockScope === "dataset") {
      const datasetMap = new Map();
      state.datasets
        .filter((dataset) => dataset.active)
        .forEach((dataset) => datasetMap.set(dataset.id, { label: dataset.label, value: 0 }));
      records.forEach((record) => {
        const entry = datasetMap.get(record.datasetId);
        if (!entry) return;
        entry.value += stockMode === "count" ? 1 : (record.bridgeLengthM || 0) / 1000;
      });
      labels = Array.from(datasetMap.values()).map((entry) => entry.label);
      values = Array.from(datasetMap.values()).map((entry) =>
        stockMode === "count" ? entry.value : Number(entry.value.toFixed(2))
      );
    } else {
      labels = BRIDGE_TYPES;
      const aggregated = BRIDGE_TYPES.map(() => 0);
      records.forEach((record) => {
        const index = BRIDGE_TYPES.indexOf(record.bridgeType);
        if (index === -1) return;
        aggregated[index] += stockMode === "count" ? 1 : (record.bridgeLengthM || 0) / 1000;
      });
      values = aggregated.map((value) => (stockMode === "count" ? value : Number(value.toFixed(2))));
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].label = labelText;
    chart.options.scales.y.title = { display: true, text: stockMode === "count" ? "橋梁数" : "総延長 (km)" };
    chart.update();
  }

  function updateRatingChart() {
    const chart = state.charts.rating;
    if (!chart) return;
    const records = getFilteredRecords();
    chart.data.labels = INSPECTION_LEVELS;
    chart.data.datasets = BRIDGE_TYPES.map((type) => ({
      label: type,
      data: INSPECTION_LEVELS.map((level) =>
        records.filter((record) => record.bridgeType === type && record.inspectionLevel === level).length
      ),
      backgroundColor: BRIDGE_TYPE_COLOR_MAP[type],
    }));
    chart.update();
  }

  function updateLengthChart() {
    const chart = state.charts.length;
    if (!chart) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.bridgeLengthM));
    if (!records.length) {
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.data.datasets[1].data = [];
      chart.update();
      return;
    }
    const binSize = state.filters.lengthBinSize || 10;
    const maxLength = Math.max(...records.map((record) => record.bridgeLengthM));
    const binCount = Math.max(1, Math.ceil(maxLength / binSize));
    const labels = Array.from({ length: binCount }, (_, index) => {
      const start = index * binSize;
      const end = start + binSize;
      return `${start}-${end}m`;
    });
    const counts = new Array(binCount).fill(0);
    records.forEach((record) => {
      const index = Math.min(Math.floor(record.bridgeLengthM / binSize), binCount - 1);
      counts[index] += 1;
    });
    const cumulativeRelative = [];
    counts.reduce((sum, count, index) => {
      const nextSum = sum + count;
      cumulativeRelative[index] = Number(((nextSum / records.length) * 100).toFixed(1));
      return nextSum;
    }, 0);
    chart.data.labels = labels;
    chart.data.datasets[0].data = counts;
    chart.data.datasets[1].data = cumulativeRelative;
    chart.update();
  }

  function updateYearChart() {
    const chart = state.charts.year;
    if (!chart) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.builtYear));
    if (!records.length) {
      chart.data.labels = [];
      chart.data.datasets = [];
      chart.update();
      return;
    }
    const bucketMap = new Map();
    const grouping = state.filters.yearGrouping;
    records.forEach((record) => {
      const bucketKey = grouping === "year" ? record.builtYear : Math.floor(record.builtYear / 10) * 10;
      const label = grouping === "year" ? `${bucketKey}年` : `${bucketKey}年代`;
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, {
          label,
          counts: BRIDGE_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {}),
        });
      }
      bucketMap.get(bucketKey).counts[record.bridgeType] += 1;
    });
    const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => a - b);
    chart.data.labels = sortedKeys.map((key) => bucketMap.get(key).label);
    chart.data.datasets = BRIDGE_TYPES.map((type) => ({
      label: type,
      data: sortedKeys.map((key) => bucketMap.get(key).counts[type]),
      backgroundColor: BRIDGE_TYPE_COLOR_MAP[type],
      stack: "year",
    }));
    chart.update();
  }

  function updatePcTensionChart() {
    const chart = state.charts.pcTension;
    if (!chart) return;
    const records = getFilteredRecords({ skipCulvertFilter: true }).filter(
      (record) => record.bridgeType === "PC橋"
    );
    const counts = {
      pretension: 0,
      posttension: 0,
      other: 0,
    };
    records.forEach((record) => {
      const key = record.pcTensionType;
      if (key && counts[key] !== undefined) {
        counts[key] += 1;
      } else {
        counts.other += 1;
      }
    });
    chart.data.labels = PC_TENSION_SEGMENTS.map((segment) => segment.label);
    chart.data.datasets[0].data = PC_TENSION_SEGMENTS.map((segment) => counts[segment.key]);
    chart.update();
  }

  function updatePcPostChart() {
    const chart = state.charts.pcPost;
    if (!chart) return;
    const records = getFilteredRecords({ skipCulvertFilter: true }).filter(
      (record) => record.bridgeType === "PC橋" && record.pcTensionType === "posttension"
    );
    const counts = Object.fromEntries(PC_POST_SEGMENTS.map((segment) => [segment.key, 0]));
    records.forEach((record) => {
      const key = record.pcPostCategory && counts[record.pcPostCategory] !== undefined ? record.pcPostCategory : "other";
      counts[key] += 1;
    });
    chart.data.labels = PC_POST_SEGMENTS.map((segment) => segment.label);
    chart.data.datasets[0].data = PC_POST_SEGMENTS.map((segment) => counts[segment.key]);
    chart.update();
  }

  function updateCulvertHints() {
    const shouldShow = Boolean(state.filters.excludeCulvert);
    if (!Array.isArray(elements.culvertHints)) return;
    elements.culvertHints.forEach((hint) => {
      if (!hint) return;
      hint.hidden = !shouldShow;
    });
  }

  function updateMap() {
    if (!state.map || !state.mapLayer) return;
    const records = getFilteredRecords();
    const withCoords = [];
    let missing = 0;
    state.mapLayer.clearLayers();
    records.forEach((record) => {
      if (Number.isFinite(record.lat) && Number.isFinite(record.lng)) {
        const marker = window.L.marker([record.lat, record.lng], {
          icon: createMarkerIcon(record),
          keyboard: false,
        });
        marker.bindPopup(createPopupContent(record));
        state.mapLayer.addLayer(marker);
        withCoords.push(record);
      } else {
        missing += 1;
      }
    });
    setText(elements.mapCount, formatNumber(withCoords.length));
    setText(elements.mapMissing, formatNumber(missing));
    if ((state.forceFitMap || state.prevMapCount === 0) && withCoords.length) {
      const bounds = window.L.latLngBounds(withCoords.map((record) => [record.lat, record.lng]));
      state.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
      state.forceFitMap = false;
    } else if (!withCoords.length && state.prevMapCount > 0) {
      state.map.setView(DEFAULT_MAP_CENTER, 5);
    }
    state.prevMapCount = withCoords.length;
  }

  function createMarkerIcon(record) {
    const grade = record.inspectionLevel || "UNKNOWN";
    const color = INSPECTION_COLOR_MAP[grade] || INSPECTION_COLOR_MAP.UNKNOWN;
    const shapeClass = `marker-shape-${getBridgeTypeKey(record.bridgeType)}`;
    const scale =
      state.mapMarkerScale && Number.isFinite(state.mapMarkerScale) ? state.mapMarkerScale : MAP_MARKER_BASE_SCALE;
    const size = Math.max(MAP_MARKER_MIN_SIZE, Math.round(MAP_MARKER_BASE_SIZE * scale));
    const anchor = Math.round(size / 2);
    const style = `background-color:${color};width:${size}px;height:${size}px;`;
    return window.L.divIcon({
      className: "bridge-marker-wrapper",
      html: `<span class="bridge-marker ${shapeClass}" style="${style}"></span>`,
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    });
  }

  function createPopupContent(record) {
    const builtYear = record.builtYear ? `${record.builtYear}年` : "不明";
    const length = Number.isFinite(record.bridgeLengthM) ? `${record.bridgeLengthM.toFixed(1)} m` : "不明";
    return `
      <div class="map-popup">
        <strong>${escapeHtml(record.facilityName)}</strong><br />
        路線: ${escapeHtml(record.routeName)}<br />
        橋種: ${record.bridgeType} / 判定: ${record.inspectionLevel}<br />
        架設: ${builtYear} / 橋長: ${length}
      </div>
    `;
  }

  function getBridgeTypeKey(type) {
    switch (type) {
      case "PC橋":
        return "pc";
      case "RC橋":
        return "rc";
      case "鋼橋":
        return "steel";
      default:
        return "other";
    }
  }

  function initMap() {
    const mapElement = document.getElementById("map");
    if (!mapElement || !window.L) return;
    state.map = window.L.map(mapElement, { center: DEFAULT_MAP_CENTER, zoom: 5, preferCanvas: true });
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.map);
    state.mapLayer = window.L.layerGroup().addTo(state.map);
  }

  function getFilteredRecords(options = {}) {
    const { skipCulvertFilter = false } = options;
    const activeDatasetIds = new Set(state.datasets.filter((dataset) => dataset.active).map((dataset) => dataset.id));
    const { bridgeTypes, inspectionLevels } = state.filters;
    const records = [];
    state.datasets.forEach((dataset) => {
      if (!activeDatasetIds.has(dataset.id)) return;
      dataset.records.forEach((record) => {
        if (!bridgeTypes.has(record.bridgeType)) return;
        if (!inspectionLevels.has(record.inspectionLevel)) return;
        if (!skipCulvertFilter && state.filters.excludeCulvert && record.isCulvert) return;
        records.push(record);
      });
    });
    return records;
  }

  function renderUploadFeedback() {
    if (!elements.uploadFeedback) return;
    elements.uploadFeedback.innerHTML = "";
    if (!state.lastUploadSummaries.length) {
      const p = document.createElement("p");
      p.textContent = "まだファイルは読み込まれていません。csv_example の CSV を指定してください。";
      elements.uploadFeedback.append(p);
      return;
    }
    const title = document.createElement("p");
    title.textContent = `最新の読み込み: ${state.lastUploadSummaries.length} ファイル`;
    const list = document.createElement("ul");
    list.className = "feedback-list";
    state.lastUploadSummaries.forEach((entry) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${escapeHtml(entry.fileName)}</strong> → ${escapeHtml(entry.label)} (${entry.rows} 件)`;
      list.appendChild(item);
    });
    elements.uploadFeedback.append(title, list);
  }

  function addLog(message, level = "info") {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      level,
      timestamp: new Date(),
    };
    state.logs.unshift(entry);
    if (state.logs.length > 80) {
      state.logs.pop();
    }
    renderLogs();
  }

  function renderLogs() {
    const container = elements.logList;
    if (!container) return;
    container.innerHTML = "";
    if (!state.logs.length) {
      const empty = document.createElement("p");
      empty.className = "log-empty";
      empty.textContent = "読み込みイベントはまだありません。";
      container.appendChild(empty);
      return;
    }
    state.logs.forEach((entry) => {
      const logItem = document.createElement("p");
      logItem.className = "log-entry";
      if (entry.level === "error") logItem.classList.add("is-error");
      else if (entry.level === "warning") logItem.classList.add("is-warning");
      const message = document.createElement("strong");
      message.textContent = entry.message;
      const timestamp = document.createElement("time");
      timestamp.dateTime = entry.timestamp.toISOString();
      timestamp.textContent = formatDateTime(entry.timestamp);
      logItem.append(message, timestamp);
      container.appendChild(logItem);
    });
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function formatNumber(value) {
    return Number.isFinite(value) ? value.toLocaleString("ja-JP") : "0";
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (value === null || value === undefined) return null;
    const cleaned = String(value).replace(/[^\d.-]/g, "");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sanitizeText(value) {
    if (typeof value === "string") {
      return value.trim();
    }
    return value ?? "";
  }

  function normalizeInspection(value) {
    if (value === null || value === undefined) return "UNKNOWN";
    let text = String(value).trim().toUpperCase();
    if (!text) return "UNKNOWN";
    const romanMap = { "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III", "Ⅳ": "IV" };
    text = text.replace(/[ⅠⅡⅢⅣ]/g, (match) => romanMap[match]);
    text = text.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
    const normalized = {
      I: "I",
      1: "I",
      II: "II",
      2: "II",
      III: "III",
      3: "III",
      IV: "IV",
      4: "IV",
    };
    return normalized[text] || normalized[text.replace(/[^IV0-9]/g, "")] || "UNKNOWN";
  }

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  }

  function formatDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${formatDate(date)} ${hours}:${minutes}`;
  }

  function escapeHtml(text) {
    return (text ?? "").toString().replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return char;
      }
    });
  }

  function includesAnyKeyword(text, keywords) {
    if (!text) return false;
    return keywords.some((keyword) => text.includes(normalizeForMatch(keyword)));
  }

  function normalizeForMatch(value) {
    if (value === null || value === undefined) return "";
    const text = value.toString();
    return typeof text.normalize === "function" ? text.normalize("NFKC").toUpperCase() : text.toUpperCase();
  }
})();
