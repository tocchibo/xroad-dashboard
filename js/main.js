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
    { type: "RC橋", keywords: ["RC", "ＲＣ", "鉄筋"] },
    { type: "鋼橋", keywords: ["鋼", "Ｓ造", "スチール", "トラス", "鋼桁"] },
  ];

  const INSPECTION_LEVELS = ["I", "II", "III", "IV", "UNKNOWN"];
  const INSPECTION_COLOR_MAP = {
    I: "#2563eb",
    II: "#16a34a",
    III: "#facc15",
    IV: "#dc2626",
    UNKNOWN: "#9ca3af",
  };
  const INSPECTION_LABEL_MAP = {
    I: "I",
    II: "II",
    III: "III",
    IV: "IV",
    UNKNOWN: "不明",
  };

  const BRIDGE_TYPE_COLOR_MAP = {
    "PC橋": "#2563eb",
    "RC橋": "#0f766e",
    "鋼橋": "#f97316",
    "その他": "#8b5cf6",
  };

  const IMPORTANCE_LEVELS = ["Ａ種の橋", "Ｂ種の橋", "記載なし"];
  const CROSSING_TYPES = ["跨線橋", "跨道橋", "その他"];
  const CROSSING_RAIL_KEYWORDS = ["その他鉄道", "新幹線"];
  const CROSSING_ROAD_MANAGERS = ["高速道路会社", "国", "市区町村", "都道府県", "政令市"];

  const SPEC_YEAR_UNKNOWN = "不明";
  const OFFICE_UNKNOWN_LABEL = "（未設定）";
  const ROUTE_UNKNOWN_LABEL = "路線名未設定";
  const MUNICIPALITY_UNKNOWN_LABEL = OFFICE_UNKNOWN_LABEL;
  const SPEC_YEAR_ORDER = [
    "S46耐震設計指針より前",
    "S46耐震設計指針",
    "S55道示",
    "H2道示",
    "H8道示（復旧仕様含む）",
    "H14道示",
    "H24道示",
    "H29道示",
    SPEC_YEAR_UNKNOWN,
  ];

const PC_TENSION_SEGMENTS = [
  { key: "プレテン", label: "プレテン", color: "#0ea5e9" },
  { key: "ポステン", label: "ポステン", color: "#f97316" },
  { key: "不明", label: "不明", color: "#94a3b8" },
];

const PC_POST_SEGMENTS = [
  { key: "中空床版", label: "ポステン中空床版" },
  { key: "T桁", label: "ポステンT桁" },
  { key: "箱桁", label: "ポステン箱桁" },
  { key: "その他", label: "その他" },
];

  const PC_POST_COLORS = ["#0ea5e9", "#f97316", "#10b981", "#94a3b8"];
  const PC_TENSION_KEYS = new Set(PC_TENSION_SEGMENTS.map((segment) => segment.key));
  const PC_POST_KEYS = new Set(PC_POST_SEGMENTS.map((segment) => segment.key));

  const DATASET_COLORS = ["#0ea5e9", "#10b981", "#f97316", "#ec4899", "#6366f1", "#14b8a6"];
  const SPAN_COUNT_BIN_SIZE = 1;
  const SPAN_LENGTH_BIN_SIZE = 5;
  const DEFAULT_MAP_CENTER = [36.2048, 138.2529];
  const MAP_MARKER_BASE_SCALE = 0.55;
  const MAP_MARKER_MIN_DELTA = -50;
  const MAP_MARKER_MAX_DELTA = 50;
  const MAP_MARKER_BASE_SIZE = 22;
  const MAP_MARKER_MIN_SIZE = 6;
  const DETAIL_PAGE_SIZE_DEFAULT = 100;
  const DETAIL_PAGE_SIZE_OPTIONS = [50, 100, 200, 500];
  const BASE_LAYER_CONFIG = {
    standard: {
      label: "OpenStreetMap",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      },
    },
    positron: {
      label: "CartoDB Positron",
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      options: {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      },
    },
    darkmatter: {
      label: "CartoDB Dark Matter",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      options: {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      },
    },
  };

  const state = {
    datasets: [],
    logs: [],
    filters: {
      bridgeTypes: new Set(BRIDGE_TYPES),
      inspectionLevels: new Set(INSPECTION_LEVELS),
      specYears: new Set(),
      useSpecYearInference: false,
      lengthBinSize: 10,
      stockMode: "count",
      stockScope: "bridgeType",
      yearGrouping: "decade",
      excludeCulvert: false,
      pcTension: new Set(PC_TENSION_SEGMENTS.map((segment) => segment.key)),
      pcPost: new Set(PC_POST_SEGMENTS.map((segment) => segment.key)),
      builtYearMin: null,
      builtYearMax: null,
      includeUnknownBuiltYear: false,
      lengthMin: null,
      lengthMax: null,
      spanCountMin: null,
      spanCountMax: null,
      spanLengthMin: null,
      spanLengthMax: null,
      managementOffices: new Set(),
      routeNames: new Set(),
      municipalities: new Set(),
      crossingTypes: new Set(CROSSING_TYPES),
      importanceLevels: new Set(IMPORTANCE_LEVELS),
    },
    filterOptions: {
      specYears: [],
      managementOffices: [],
      routeNames: [],
      municipalities: [],
      builtYear: { min: null, max: null },
      length: { min: null, max: null },
      spans: { min: null, max: null },
      spanLength: { min: null, max: null },
    },
    charts: {
      stock: null,
      rating: null,
      length: null,
      spanCount: null,
      spanLength: null,
      year: null,
      pcTension: null,
      pcPost: null,
    },
    map: null,
    mapLayer: null,
    clusterLayer: null,
    activeMarkerLayer: null,
    mapBaseLayers: {},
    activeBaseLayer: null,
    selectedBaseLayer: "standard",
    forceFitMap: false,
    prevMapCount: 0,
    lastUploadSummaries: [],
    mapMarkerScale: MAP_MARKER_BASE_SCALE,
    mapGrayscale: false,
    cluster: {
      enabled: false,
    },
    pcFilterExpanded: false,
    filterDrawerOpen: false,
    detailView: {
      active: false,
      sourceTitle: "",
      bucketLabel: "",
      records: [],
      searchQuery: "",
      page: 1,
      pageSize: DETAIL_PAGE_SIZE_DEFAULT,
      sortKey: null,
      sortDirection: "asc",
    },
    datasetListShowFilteredStats: false,
  };

  const elements = {
    datasetList: document.querySelector("[data-dataset-list]"),
    datasetEmpty: document.querySelector("[data-dataset-empty]"),
    datasetTableWrap: document.querySelector("[data-dataset-table-wrap]"),
    datasetStatsToggle: document.querySelector("[data-dataset-stats-toggle]"),
    datasetToggleList: document.querySelector("[data-dataset-toggle-list]"),
    datasetToggleEmpty: document.querySelector("[data-dataset-toggle-empty]"),
    dropzone: document.querySelector("[data-dropzone]"),
    fileInput: document.querySelector("[data-file-input]"),
    uploadFeedback: document.querySelector("[data-upload-feedback]"),
    logList: document.querySelector("[data-log-list]"),
    logClear: document.querySelector("[data-clear-log]"),
    bridgeTypeFilter: document.querySelector("[data-filter-bridge-types]"),
    inspectionFilter: document.querySelector("[data-filter-inspections]"),
    crossingFilter: document.querySelector("[data-filter-crossing]"),
    importanceFilter: document.querySelector("[data-filter-importance]"),
    culvertFilter: document.querySelector("[data-filter-exclude-culvert]"),
    specYearFilter: document.querySelector("[data-filter-spec-year]"),
    specYearInferToggle: document.querySelector("[data-filter-spec-infer]"),
    managementOfficeFilter: document.querySelector("[data-filter-office]"),
    managementOfficeFilterSearch: document.querySelector("[data-filter-office-search]"),
    managementOfficeFilterSelectAll: document.querySelector("[data-filter-office-select-all]"),
    managementOfficeFilterClear: document.querySelector("[data-filter-office-clear]"),
    managementOfficeFilterCount: document.querySelector("[data-filter-office-count]"),
    managementOfficeFilterList: document.querySelector("[data-filter-office-list]"),
    routeFilter: document.querySelector("[data-filter-route]"),
    routeFilterSearch: document.querySelector("[data-filter-route-search]"),
    routeFilterSelectAll: document.querySelector("[data-filter-route-select-all]"),
    routeFilterClear: document.querySelector("[data-filter-route-clear]"),
    routeFilterCount: document.querySelector("[data-filter-route-count]"),
    routeFilterList: document.querySelector("[data-filter-route-list]"),
    municipalityFilter: document.querySelector("[data-filter-municipality]"),
    municipalityFilterSearch: document.querySelector("[data-filter-municipality-search]"),
    municipalityFilterSelectAll: document.querySelector("[data-filter-municipality-select-all]"),
    municipalityFilterClear: document.querySelector("[data-filter-municipality-clear]"),
    municipalityFilterCount: document.querySelector("[data-filter-municipality-count]"),
    municipalityFilterList: document.querySelector("[data-filter-municipality-list]"),
    pcFilterToggle: document.querySelector("[data-pc-filter-toggle]"),
    pcFilterBody: document.querySelector("[data-pc-filter-body]"),
    pcFilterReset: document.querySelector("[data-pc-filter-reset]"),
    pcTensionFilter: document.querySelector("[data-filter-pc-tension]"),
    pcPostFilter: document.querySelector("[data-filter-pc-post]"),
    builtYearMinInput: document.querySelector("[data-filter-built-min]"),
    builtYearMaxInput: document.querySelector("[data-filter-built-max]"),
    builtYearUnknownToggle: document.querySelector("[data-filter-built-include-unknown]"),
    lengthMinInput: document.querySelector("[data-filter-length-min]"),
    lengthMaxInput: document.querySelector("[data-filter-length-max]"),
    spanCountMinInput: document.querySelector("[data-filter-spans-min]"),
    spanCountMaxInput: document.querySelector("[data-filter-spans-max]"),
    spanLengthMinInput: document.querySelector("[data-filter-span-length-min]"),
    spanLengthMaxInput: document.querySelector("[data-filter-span-length-max]"),
    builtYearMinSlider: document.querySelector('[data-range-slider="builtYear"][data-slider-type="min"]'),
    builtYearMaxSlider: document.querySelector('[data-range-slider="builtYear"][data-slider-type="max"]'),
    lengthMinSlider: document.querySelector('[data-range-slider="bridgeLength"][data-slider-type="min"]'),
    lengthMaxSlider: document.querySelector('[data-range-slider="bridgeLength"][data-slider-type="max"]'),
    spanCountMinSlider: document.querySelector('[data-range-slider="spanCount"][data-slider-type="min"]'),
    spanCountMaxSlider: document.querySelector('[data-range-slider="spanCount"][data-slider-type="max"]'),
    spanLengthMinSlider: document.querySelector('[data-range-slider="spanLength"][data-slider-type="min"]'),
    spanLengthMaxSlider: document.querySelector('[data-range-slider="spanLength"][data-slider-type="max"]'),
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
    kpiCulvertHint: document.querySelector("[data-kpi-culvert-hint]"),
    mapCanvas: document.getElementById("map"),
    mapCount: document.querySelector("[data-map-count]"),
    mapMissing: document.querySelector("[data-map-missing]"),
    mapSizeRange: document.querySelector("[data-marker-size-range]"),
    mapSizeLabel: document.querySelector("[data-marker-size-label]"),
    baseLayerSelect: document.querySelector("[data-base-layer]"),
    mapGrayscaleToggle: document.querySelector("[data-map-grayscale-toggle]"),
    mapClusterToggle: document.querySelector("[data-map-cluster-toggle]"),
    clusterBlock: document.querySelector("[data-cluster-block]"),
    culvertHints: Array.from(document.querySelectorAll("[data-culvert-hint]")),
    filterDrawer: document.querySelector("[data-filter-drawer]"),
    filterDrawerClose: document.querySelector("[data-filter-drawer-close]"),
    filterDrawerBackdrop: document.querySelector("[data-filter-drawer-backdrop]"),
    filterResetButton: document.querySelector("[data-filter-reset]"),
    filterInfoOpen: document.querySelector("[data-filter-info-open]"),
    filterInfoModal: document.querySelector("[data-filter-info-modal]"),
    filterInfoClose: document.querySelector("[data-filter-info-close]"),
    filterInfoBackdrop: document.querySelector("[data-filter-info-backdrop]"),
    detailSelection: document.querySelector("[data-detail-selection]"),
    detailClear: document.querySelector("[data-detail-clear]"),
    detailSearch: document.querySelector("[data-detail-search]"),
    detailPageSize: document.querySelector("[data-detail-page-size]"),
    detailCount: document.querySelector("[data-detail-count]"),
    detailRange: document.querySelector("[data-detail-range]"),
    detailPage: document.querySelector("[data-detail-page]"),
    detailPrev: document.querySelector("[data-detail-prev]"),
    detailNext: document.querySelector("[data-detail-next]"),
    detailBody: document.querySelector("[data-detail-body]"),
    detailEmpty: document.querySelector("[data-detail-empty]"),
    detailSortButtons: Array.from(document.querySelectorAll("[data-detail-sort-key]")),
    detailModal: document.querySelector("[data-detail-modal]"),
    detailBackdrop: document.querySelector("[data-detail-backdrop]"),
    detailClose: document.querySelector("[data-detail-close]"),
  };

  const RANGE_FILTER_CONFIGS = {
    builtYear: {
      key: "builtYear",
      statsKey: "builtYear",
      stateMinKey: "builtYearMin",
      stateMaxKey: "builtYearMax",
      minInput: elements.builtYearMinInput,
      maxInput: elements.builtYearMaxInput,
      minSlider: elements.builtYearMinSlider,
      maxSlider: elements.builtYearMaxSlider,
      step: 1,
      decimals: 0,
    },
    bridgeLength: {
      key: "bridgeLength",
      statsKey: "length",
      stateMinKey: "lengthMin",
      stateMaxKey: "lengthMax",
      minInput: elements.lengthMinInput,
      maxInput: elements.lengthMaxInput,
      minSlider: elements.lengthMinSlider,
      maxSlider: elements.lengthMaxSlider,
      step: 1,
      decimals: 0,
    },
    spanCount: {
      key: "spanCount",
      statsKey: "spans",
      stateMinKey: "spanCountMin",
      stateMaxKey: "spanCountMax",
      minInput: elements.spanCountMinInput,
      maxInput: elements.spanCountMaxInput,
      minSlider: elements.spanCountMinSlider,
      maxSlider: elements.spanCountMaxSlider,
      step: 1,
      decimals: 0,
    },
    spanLength: {
      key: "spanLength",
      statsKey: "spanLength",
      stateMinKey: "spanLengthMin",
      stateMaxKey: "spanLengthMax",
      minInput: elements.spanLengthMinInput,
      maxInput: elements.spanLengthMaxInput,
      minSlider: elements.spanLengthMinSlider,
      maxSlider: elements.spanLengthMaxSlider,
      step: 0.1,
      decimals: 1,
    },
  };

  let filterInfoLastFocus = null;
  let detailModalLastFocus = null;

  init();

  function init() {
    buildFilterChips();
    bindPcFilterControls();
    bindFilterDrawer();
    bindGlobalFilterReset();
    bindRangeControl();
    bindSelectControls();
    bindCulvertFilter();
    bindDatasetListStatsToggle();
    bindAdvancedFilters();
    bindMapControls();
    bindClusterControls();
    bindBaseLayerSelect();
    bindDropzone();
    bindLogClear();
    initFilterInfoModal();
    initDetailView();
    initCharts();
    initMap();
    rebuildDynamicFilters();
    renderUploadFeedback();
    renderLogs();
    renderDetailView();
    if (!window.Papa) addLog("Papa Parse の読み込みに失敗しました。", "error");
    if (!window.Chart) addLog("Chart.js が利用できません。", "error");
    if (!window.L) addLog("Leaflet が利用できません。", "error");
  }

  function getInspectionLabel(level) {
    return INSPECTION_LABEL_MAP[level] || level;
  }

  function buildFilterChips() {
    if (elements.bridgeTypeFilter) {
      BRIDGE_TYPES.forEach((type) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = type;
        chip.textContent = type;
        chip.setAttribute("aria-pressed", "true");
        chip.addEventListener("click", () => {
          toggleFilter(state.filters.bridgeTypes, type, chip);
          if (type === "PC橋") {
            updatePcFilterUI();
          }
        });
        elements.bridgeTypeFilter.appendChild(chip);
      });
    }
    if (elements.inspectionFilter) {
      INSPECTION_LEVELS.forEach((level) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = level;
        chip.textContent = getInspectionLabel(level);
        chip.setAttribute("aria-pressed", "true");
        chip.addEventListener("click", () => toggleFilter(state.filters.inspectionLevels, level, chip));
        elements.inspectionFilter.appendChild(chip);
      });
    }
    if (elements.crossingFilter) {
      CROSSING_TYPES.forEach((type) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = type;
        chip.textContent = type;
        chip.setAttribute("aria-pressed", "true");
        chip.addEventListener("click", () => toggleFilter(state.filters.crossingTypes, type, chip));
        elements.crossingFilter.appendChild(chip);
      });
    }
    if (elements.importanceFilter) {
      IMPORTANCE_LEVELS.forEach((level) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip is-active";
        chip.dataset.value = level;
        chip.textContent = level;
        chip.setAttribute("aria-pressed", "true");
        chip.addEventListener("click", () => toggleFilter(state.filters.importanceLevels, level, chip));
        elements.importanceFilter.appendChild(chip);
      });
    }
    buildPcFilterChips();
    updatePcFilterUI();
  }

  function toggleFilter(set, value, chipEl) {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
    if (chipEl) {
      const isActive = set.has(value);
      chipEl.classList.toggle("is-active", isActive);
      chipEl.setAttribute("aria-pressed", String(isActive));
    }
    refreshAll();
  }

  function buildPcFilterChips() {
    if (elements.pcTensionFilter) {
      elements.pcTensionFilter.innerHTML = "";
      PC_TENSION_SEGMENTS.forEach((segment) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.dataset.value = segment.key;
        chip.textContent = segment.label;
        chip.setAttribute("aria-pressed", String(state.filters.pcTension.has(segment.key)));
        chip.addEventListener("click", () => handlePcTensionToggle(segment.key, chip));
        elements.pcTensionFilter.appendChild(chip);
      });
    }
    if (elements.pcPostFilter) {
      elements.pcPostFilter.innerHTML = "";
      PC_POST_SEGMENTS.forEach((segment) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.dataset.value = segment.key;
        chip.textContent = segment.label;
        chip.setAttribute("aria-pressed", String(state.filters.pcPost.has(segment.key)));
        chip.addEventListener("click", () => handlePcPostToggle(segment.key, chip));
        elements.pcPostFilter.appendChild(chip);
      });
    }
  }

  function bindPcFilterControls() {
    const toggle = elements.pcFilterToggle;
    const body = elements.pcFilterBody;
    if (toggle && body) {
      toggle.addEventListener("click", () => {
        state.pcFilterExpanded = !state.pcFilterExpanded;
        updatePcFilterVisibility();
      });
      updatePcFilterVisibility();
    }
    if (elements.pcFilterReset) {
      elements.pcFilterReset.addEventListener("click", () => {
        resetPcFilters();
      });
    }
  }

  function updatePcFilterVisibility() {
    const body = elements.pcFilterBody;
    const toggle = elements.pcFilterToggle;
    if (!body || !toggle) return;
    const expanded = Boolean(state.pcFilterExpanded);
    body.hidden = !expanded;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "PC橋詳細フィルタを隠す" : "PC橋詳細フィルタを表示";
  }

  function resetPcFilters() {
    state.filters.pcTension = new Set(PC_TENSION_SEGMENTS.map((segment) => segment.key));
    state.filters.pcPost = new Set(PC_POST_SEGMENTS.map((segment) => segment.key));
    updatePcFilterUI();
    refreshAll();
  }

  function handlePcTensionToggle(value, chip) {
    if (chip?.disabled) return;
    toggleSetSelection(state.filters.pcTension, value);
    refreshAll();
    updatePcFilterUI();
  }

  function handlePcPostToggle(value, chip) {
    if (chip?.disabled) return;
    toggleSetSelection(state.filters.pcPost, value);
    refreshAll();
    updatePcFilterUI();
  }

  function toggleSetSelection(set, value) {
    if (set.has(value)) {
      set.delete(value);
    } else {
      set.add(value);
    }
  }

  function updatePcFilterUI() {
    const pcActive = state.filters.bridgeTypes.has("PC橋");
    const postEnabled = pcActive && state.filters.pcTension.has("ポステン");
    syncPcChips(elements.pcTensionFilter, state.filters.pcTension, pcActive);
    syncPcChips(elements.pcPostFilter, state.filters.pcPost, postEnabled);
  }

  function syncPcChips(container, activeSet, isEnabled) {
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = activeSet.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
      chip.disabled = !isEnabled;
      chip.setAttribute("aria-disabled", String(!isEnabled));
    });
  }

  function syncBridgeTypeChips() {
    const container = elements.bridgeTypeFilter;
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = state.filters.bridgeTypes.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncInspectionChips() {
    const container = elements.inspectionFilter;
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = state.filters.inspectionLevels.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncCrossingChips() {
    const container = elements.crossingFilter;
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = state.filters.crossingTypes.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function syncImportanceChips() {
    const container = elements.importanceFilter;
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = state.filters.importanceLevels.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function rebuildDynamicFilters() {
    const prevSpecOptions = state.filterOptions?.specYears ?? [];
    const prevOfficeOptions = state.filterOptions?.managementOffices ?? [];
    const prevRouteOptions = state.filterOptions?.routeNames ?? [];
    const prevMunicipalityOptions = state.filterOptions?.municipalities ?? [];
    const prevSpecSelection = new Set(state.filters.specYears);
    const prevOfficeSelection = new Set(state.filters.managementOffices);
    const prevRouteSelection = new Set(state.filters.routeNames);
    const prevMunicipalitySelection = new Set(state.filters.municipalities);
    const stats = collectFilterOptionStats();
    state.filterOptions = stats;
    syncSpecYearSelection(stats.specYears, prevSpecOptions, prevSpecSelection);
    syncManagementOfficeSelection(stats.managementOffices, prevOfficeOptions, prevOfficeSelection);
    syncRouteSelection(stats.routeNames, prevRouteOptions, prevRouteSelection);
    syncMunicipalitySelection(stats.municipalities, prevMunicipalityOptions, prevMunicipalitySelection);
    renderSpecYearChips(stats.specYears);
    renderManagementOfficeOptions(stats.managementOffices);
    renderRouteOptions(stats.routeNames);
    renderMunicipalityOptions(stats.municipalities);
    updateNumericPlaceholders(stats);
  }

  function resetAllFilters() {
    state.filters.bridgeTypes = new Set(BRIDGE_TYPES);
    state.filters.inspectionLevels = new Set(INSPECTION_LEVELS);
    state.filters.excludeCulvert = false;
    state.filters.useSpecYearInference = false;
    state.filters.pcTension = new Set(PC_TENSION_SEGMENTS.map((segment) => segment.key));
    state.filters.pcPost = new Set(PC_POST_SEGMENTS.map((segment) => segment.key));
    state.filters.builtYearMin = null;
    state.filters.builtYearMax = null;
    state.filters.includeUnknownBuiltYear = false;
    state.filters.lengthMin = null;
    state.filters.lengthMax = null;
    state.filters.spanCountMin = null;
    state.filters.spanCountMax = null;
    state.filters.spanLengthMin = null;
    state.filters.spanLengthMax = null;
    state.filters.crossingTypes = new Set(CROSSING_TYPES);
    state.filters.importanceLevels = new Set(IMPORTANCE_LEVELS);
    const specOptions = state.filterOptions.specYears ?? [];
    state.filters.specYears = specOptions.length ? new Set(specOptions) : new Set();
    const officeOptions = state.filterOptions.managementOffices ?? [];
    state.filters.managementOffices = officeOptions.length ? new Set(officeOptions) : new Set();
    if (elements.managementOfficeFilterSearch) elements.managementOfficeFilterSearch.value = "";
    const routeOptions = state.filterOptions.routeNames ?? [];
    state.filters.routeNames = routeOptions.length ? new Set(routeOptions) : new Set();
    if (elements.routeFilterSearch) elements.routeFilterSearch.value = "";
    const municipalityOptions = state.filterOptions.municipalities ?? [];
    state.filters.municipalities = municipalityOptions.length ? new Set(municipalityOptions) : new Set();
    if (elements.municipalityFilterSearch) elements.municipalityFilterSearch.value = "";

    syncBridgeTypeChips();
    syncInspectionChips();
    syncCrossingChips();
    syncImportanceChips();
    syncSpecYearChips();
    renderManagementOfficeOptions(state.filterOptions.managementOffices);
    renderRouteOptions(state.filterOptions.routeNames);
    renderMunicipalityOptions(state.filterOptions.municipalities);
    updatePcFilterUI();
    updateNumericPlaceholders(state.filterOptions);
    if (elements.culvertFilter) elements.culvertFilter.checked = false;
    if (elements.specYearInferToggle) elements.specYearInferToggle.checked = false;
    if (elements.builtYearUnknownToggle) elements.builtYearUnknownToggle.checked = false;
    refreshAll();
  }

  function collectFilterOptionStats() {
    const specYearSet = new Set();
    const officeSet = new Set();
    const routeSet = new Set();
    const municipalitySet = new Set();
    let builtMin = null;
    let builtMax = null;
    let lengthMin = null;
    let lengthMax = null;
    let spansMin = null;
    let spansMax = null;
    let spanLengthMin = null;
    let spanLengthMax = null;
    let hasUnknownSpec = false;
    state.datasets.forEach((dataset) => {
      dataset.records.forEach((record) => {
        const builtYear = record.builtYear;
        if (Number.isFinite(builtYear)) {
          builtMin = builtMin === null ? builtYear : Math.min(builtMin, builtYear);
          builtMax = builtMax === null ? builtYear : Math.max(builtMax, builtYear);
        }
        const bridgeLength = record.bridgeLengthM;
        if (Number.isFinite(bridgeLength)) {
          lengthMin = lengthMin === null ? bridgeLength : Math.min(lengthMin, bridgeLength);
          lengthMax = lengthMax === null ? bridgeLength : Math.max(lengthMax, bridgeLength);
        }
        const spans = record.spans;
        if (Number.isFinite(spans)) {
          spansMin = spansMin === null ? spans : Math.min(spansMin, spans);
          spansMax = spansMax === null ? spans : Math.max(spansMax, spans);
        }
        const spanLength = record.spanLengthM;
        if (Number.isFinite(spanLength)) {
          spanLengthMin = spanLengthMin === null ? spanLength : Math.min(spanLengthMin, spanLength);
          spanLengthMax = spanLengthMax === null ? spanLength : Math.max(spanLengthMax, spanLength);
        }
        const actualSpec = record.specYearLabel;
        if (actualSpec && actualSpec !== SPEC_YEAR_UNKNOWN) {
          specYearSet.add(actualSpec);
        } else {
          hasUnknownSpec = true;
        }
        if (record.specYearInferred) {
          specYearSet.add(record.specYearInferred);
        }
        officeSet.add(getManagementOfficeLabel(record));
        routeSet.add(getRouteNameLabel(record));
        municipalitySet.add(getMunicipalityLabel(record));
      });
    });
    if (hasUnknownSpec) {
      specYearSet.add(SPEC_YEAR_UNKNOWN);
    }
    return {
      specYears: sortSpecYearOptions(Array.from(specYearSet)),
      managementOffices: Array.from(officeSet).sort((a, b) => a.localeCompare(b, "ja-JP")),
      routeNames: Array.from(routeSet).sort((a, b) => a.localeCompare(b, "ja-JP")),
      municipalities: Array.from(municipalitySet).sort((a, b) => a.localeCompare(b, "ja-JP")),
      builtYear: { min: builtMin, max: builtMax },
      length: { min: lengthMin, max: lengthMax },
      spans: { min: spansMin, max: spansMax },
      spanLength: { min: spanLengthMin, max: spanLengthMax },
    };
  }

  function syncSpecYearSelection(options, previousOptions = [], previousSelection = state.filters.specYears) {
    const prevOptionsCount = Array.isArray(previousOptions) ? previousOptions.length : 0;
    const prevSelectionSet = previousSelection instanceof Set ? previousSelection : new Set();
    const treatAsAllSelected = prevSelectionSet.size === 0 || prevSelectionSet.size === prevOptionsCount;
    if (!options.length) {
      state.filters.specYears = new Set();
      return;
    }
    if (treatAsAllSelected) {
      state.filters.specYears = new Set(options);
      return;
    }
    const next = new Set();
    options.forEach((value) => {
      if (prevSelectionSet.has(value)) {
        next.add(value);
      }
    });
    if (!next.size) {
      options.forEach((value) => next.add(value));
    }
    state.filters.specYears = next;
  }

  function syncManagementOfficeSelection(
    options,
    previousOptions = [],
    previousSelection = state.filters.managementOffices
  ) {
    const prevOptionsCount = Array.isArray(previousOptions) ? previousOptions.length : 0;
    const prevSelectionSet = previousSelection instanceof Set ? previousSelection : new Set();
    const treatAsAllSelected = prevSelectionSet.size === 0 || prevSelectionSet.size === prevOptionsCount;
    if (!options.length) {
      state.filters.managementOffices = new Set();
      return;
    }
    if (treatAsAllSelected) {
      state.filters.managementOffices = new Set(options);
      return;
    }
    const next = new Set();
    options.forEach((value) => {
      if (prevSelectionSet.has(value)) {
        next.add(value);
      }
    });
    if (!next.size) {
      options.forEach((value) => next.add(value));
    }
    state.filters.managementOffices = next;
  }

  function syncRouteSelection(options, previousOptions = [], previousSelection = state.filters.routeNames) {
    const prevOptionsCount = Array.isArray(previousOptions) ? previousOptions.length : 0;
    const prevSelectionSet = previousSelection instanceof Set ? previousSelection : new Set();
    const treatAsAllSelected = prevSelectionSet.size === 0 || prevSelectionSet.size === prevOptionsCount;
    if (!options.length) {
      state.filters.routeNames = new Set();
      return;
    }
    if (treatAsAllSelected) {
      state.filters.routeNames = new Set(options);
      return;
    }
    const next = new Set();
    options.forEach((value) => {
      if (prevSelectionSet.has(value)) {
        next.add(value);
      }
    });
    if (!next.size) {
      options.forEach((value) => next.add(value));
    }
    state.filters.routeNames = next;
  }

  function syncMunicipalitySelection(options, previousOptions = [], previousSelection = state.filters.municipalities) {
    const prevOptionsCount = Array.isArray(previousOptions) ? previousOptions.length : 0;
    const prevSelectionSet = previousSelection instanceof Set ? previousSelection : new Set();
    const treatAsAllSelected = prevSelectionSet.size === 0 || prevSelectionSet.size === prevOptionsCount;
    if (!options.length) {
      state.filters.municipalities = new Set();
      return;
    }
    if (treatAsAllSelected) {
      state.filters.municipalities = new Set(options);
      return;
    }
    const next = new Set();
    options.forEach((value) => {
      if (prevSelectionSet.has(value)) {
        next.add(value);
      }
    });
    if (!next.size) {
      options.forEach((value) => next.add(value));
    }
    state.filters.municipalities = next;
  }

  function renderSpecYearChips(options) {
    const container = elements.specYearFilter;
    if (!container) return;
    container.innerHTML = "";
    if (!options.length) {
      const empty = document.createElement("p");
      empty.className = "filter-helper";
      empty.textContent = "CSV を読み込むと候補が表示されます。";
      container.appendChild(empty);
      return;
    }
    options.forEach((value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.value = value;
      chip.textContent = value;
      const isActive = state.filters.specYears.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
      chip.addEventListener("click", () => handleSpecYearToggle(value, chip));
      container.appendChild(chip);
    });
  }

  function handleSpecYearToggle(value, chip) {
    toggleSetSelection(state.filters.specYears, value);
    refreshAll();
    syncSpecYearChips();
  }

  function syncSpecYearChips() {
    const container = elements.specYearFilter;
    if (!container) return;
    container.querySelectorAll("button").forEach((chip) => {
      const value = chip.dataset.value;
      const isActive = state.filters.specYears.has(value);
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  function getManagementOfficeSearchQuery() {
    const input = elements.managementOfficeFilterSearch;
    if (!input) return "";
    return normalizeForMatch(input.value.trim());
  }

  function getFilteredManagementOfficeOptions(options) {
    const query = getManagementOfficeSearchQuery();
    if (!query) return options;
    return options.filter((value) => normalizeForMatch(value).includes(query));
  }

  function updateManagementOfficeFilterCount(options) {
    const count = elements.managementOfficeFilterCount;
    if (!count) return;
    const total = options.length;
    if (!total) {
      count.textContent = "0件";
      return;
    }
    const visible = getFilteredManagementOfficeOptions(options).length;
    const selected = state.filters.managementOffices.size;
    const selectionLabel =
      selected === total ? "全選択" : selected === 0 ? "選択 0 件" : `選択 ${formatNumber(selected)} 件`;
    count.textContent = `表示 ${formatNumber(visible)} / 全 ${formatNumber(total)} 件 ・${selectionLabel}`;
  }

  function renderManagementOfficeOptions(options) {
    const list = elements.managementOfficeFilterList;
    if (!list) return;
    list.innerHTML = "";
    if (elements.managementOfficeFilterSearch) {
      elements.managementOfficeFilterSearch.disabled = !options.length;
      if (!options.length) {
        elements.managementOfficeFilterSearch.value = "";
      }
    }
    if (elements.managementOfficeFilterSelectAll) {
      elements.managementOfficeFilterSelectAll.disabled = !options.length;
    }
    if (elements.managementOfficeFilterClear) {
      elements.managementOfficeFilterClear.disabled = !options.length;
    }
    if (!options.length) {
      const placeholder = document.createElement("p");
      placeholder.className = "filter-placeholder";
      placeholder.textContent = "CSV を読み込んでください";
      list.appendChild(placeholder);
      updateManagementOfficeFilterCount(options);
      return;
    }
    const filtered = getFilteredManagementOfficeOptions(options);
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "filter-placeholder";
      empty.textContent = "該当する管理事務所名がありません";
      list.appendChild(empty);
      updateManagementOfficeFilterCount(options);
      return;
    }
    filtered.forEach((value) => {
      const label = document.createElement("label");
      label.className = "filter-checklist-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = state.filters.managementOffices.has(value);
      checkbox.dataset.officeOption = "true";
      const text = document.createElement("span");
      text.className = "filter-checklist-label";
      text.textContent = value;
      label.append(checkbox, text);
      list.appendChild(label);
    });
    updateManagementOfficeFilterCount(options);
  }

  function getRouteSearchQuery() {
    const input = elements.routeFilterSearch;
    if (!input) return "";
    return normalizeForMatch(input.value.trim());
  }

  function getFilteredRouteOptions(options) {
    const query = getRouteSearchQuery();
    if (!query) return options;
    return options.filter((value) => normalizeForMatch(value).includes(query));
  }

  function updateRouteFilterCount(options) {
    const count = elements.routeFilterCount;
    if (!count) return;
    const total = options.length;
    if (!total) {
      count.textContent = "0件";
      return;
    }
    const visible = getFilteredRouteOptions(options).length;
    const selected = state.filters.routeNames.size;
    const selectionLabel =
      selected === total ? "全選択" : selected === 0 ? "選択 0 件" : `選択 ${formatNumber(selected)} 件`;
    count.textContent = `表示 ${formatNumber(visible)} / 全 ${formatNumber(total)} 件 ・${selectionLabel}`;
  }

  function renderRouteOptions(options) {
    const list = elements.routeFilterList;
    if (!list) return;
    list.innerHTML = "";
    if (elements.routeFilterSearch) {
      elements.routeFilterSearch.disabled = !options.length;
      if (!options.length) {
        elements.routeFilterSearch.value = "";
      }
    }
    if (elements.routeFilterSelectAll) {
      elements.routeFilterSelectAll.disabled = !options.length;
    }
    if (elements.routeFilterClear) {
      elements.routeFilterClear.disabled = !options.length;
    }
    if (!options.length) {
      const placeholder = document.createElement("p");
      placeholder.className = "filter-placeholder";
      placeholder.textContent = "CSV を読み込んでください";
      list.appendChild(placeholder);
      updateRouteFilterCount(options);
      return;
    }
    const filtered = getFilteredRouteOptions(options);
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "filter-placeholder";
      empty.textContent = "該当する路線名がありません";
      list.appendChild(empty);
      updateRouteFilterCount(options);
      return;
    }
    filtered.forEach((value) => {
      const label = document.createElement("label");
      label.className = "filter-checklist-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = state.filters.routeNames.has(value);
      checkbox.dataset.routeOption = "true";
      const text = document.createElement("span");
      text.className = "filter-checklist-label";
      text.textContent = value;
      label.append(checkbox, text);
      list.appendChild(label);
    });
    updateRouteFilterCount(options);
  }

  function getMunicipalitySearchQuery() {
    const input = elements.municipalityFilterSearch;
    if (!input) return "";
    return normalizeForMatch(input.value.trim());
  }

  function getFilteredMunicipalityOptions(options) {
    const query = getMunicipalitySearchQuery();
    if (!query) return options;
    return options.filter((value) => normalizeForMatch(value).includes(query));
  }

  function updateMunicipalityFilterCount(options) {
    const count = elements.municipalityFilterCount;
    if (!count) return;
    const total = options.length;
    if (!total) {
      count.textContent = "0件";
      return;
    }
    const visible = getFilteredMunicipalityOptions(options).length;
    const selected = state.filters.municipalities.size;
    const selectionLabel =
      selected === total ? "全選択" : selected === 0 ? "選択 0 件" : `選択 ${formatNumber(selected)} 件`;
    count.textContent = `表示 ${formatNumber(visible)} / 全 ${formatNumber(total)} 件 ・${selectionLabel}`;
  }

  function renderMunicipalityOptions(options) {
    const list = elements.municipalityFilterList;
    if (!list) return;
    list.innerHTML = "";
    if (elements.municipalityFilterSearch) {
      elements.municipalityFilterSearch.disabled = !options.length;
      if (!options.length) {
        elements.municipalityFilterSearch.value = "";
      }
    }
    if (elements.municipalityFilterSelectAll) {
      elements.municipalityFilterSelectAll.disabled = !options.length;
    }
    if (elements.municipalityFilterClear) {
      elements.municipalityFilterClear.disabled = !options.length;
    }
    if (!options.length) {
      const placeholder = document.createElement("p");
      placeholder.className = "filter-placeholder";
      placeholder.textContent = "CSV を読み込んでください";
      list.appendChild(placeholder);
      updateMunicipalityFilterCount(options);
      return;
    }
    const filtered = getFilteredMunicipalityOptions(options);
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "filter-placeholder";
      empty.textContent = "該当する市区町村名がありません";
      list.appendChild(empty);
      updateMunicipalityFilterCount(options);
      return;
    }
    filtered.forEach((value) => {
      const label = document.createElement("label");
      label.className = "filter-checklist-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = state.filters.municipalities.has(value);
      checkbox.dataset.municipalityOption = "true";
      const text = document.createElement("span");
      text.className = "filter-checklist-label";
      text.textContent = value;
      label.append(checkbox, text);
      list.appendChild(label);
    });
    updateMunicipalityFilterCount(options);
  }

  function updateNumericPlaceholders(stats) {
    Object.values(RANGE_FILTER_CONFIGS).forEach((config) => {
      const rangeStats = stats[config.statsKey];
      updateRangeInputPlaceholders(config, rangeStats);
      syncRangeInputsFromState(config.key);
      syncRangeSlidersFromState(config.key, rangeStats);
    });
  }

  function updateRangeInputPlaceholders(config, range) {
    const { minInput, maxInput, decimals = 0 } = config;
    if (minInput) {
      minInput.placeholder = Number.isFinite(range?.min) ? formatRangeValue(range.min, decimals) : "";
      if (Number.isFinite(range?.min)) minInput.min = range.min;
      else minInput.removeAttribute("min");
      if (Number.isFinite(range?.max)) minInput.max = range.max;
      else minInput.removeAttribute("max");
    }
    if (maxInput) {
      maxInput.placeholder = Number.isFinite(range?.max) ? formatRangeValue(range.max, decimals) : "";
      if (Number.isFinite(range?.min)) maxInput.min = range.min;
      else maxInput.removeAttribute("min");
      if (Number.isFinite(range?.max)) maxInput.max = range.max;
      else maxInput.removeAttribute("max");
    }
  }

  function setRangeState(key, min, max) {
    const config = RANGE_FILTER_CONFIGS[key];
    if (!config) return;
    state.filters[config.stateMinKey] = Number.isFinite(min) ? min : null;
    state.filters[config.stateMaxKey] = Number.isFinite(max) ? max : null;
    refreshAll();
  }

  function syncRangeInputsFromState(key) {
    const config = RANGE_FILTER_CONFIGS[key];
    if (!config) return;
    const decimals = config.decimals || 0;
    const minValue = state.filters[config.stateMinKey];
    const maxValue = state.filters[config.stateMaxKey];
    if (config.minInput) {
      config.minInput.value = Number.isFinite(minValue) ? formatRangeValue(minValue, decimals) : "";
    }
    if (config.maxInput) {
      config.maxInput.value = Number.isFinite(maxValue) ? formatRangeValue(maxValue, decimals) : "";
    }
  }

  function syncRangeSlidersFromState(key, statsRange) {
    const config = RANGE_FILTER_CONFIGS[key];
    if (!config?.minSlider || !config?.maxSlider) return;
    const hasRange = Number.isFinite(statsRange?.min) && Number.isFinite(statsRange?.max);
    const minBound = hasRange ? statsRange.min : 0;
    const maxBound = hasRange ? statsRange.max : minBound;
    const step = config.step || 1;
    const decimals = config.decimals || 0;
    config.minSlider.disabled = !hasRange;
    config.maxSlider.disabled = !hasRange;
    config.minSlider.min = hasRange ? minBound : 0;
    config.minSlider.max = hasRange ? maxBound : 0;
    config.maxSlider.min = hasRange ? minBound : 0;
    config.maxSlider.max = hasRange ? maxBound : 0;
    config.minSlider.step = step;
    config.maxSlider.step = step;
    const stateMin = state.filters[config.stateMinKey];
    const stateMax = state.filters[config.stateMaxKey];
    const fallbackMin = Number.isFinite(stateMin) ? stateMin : minBound;
    const fallbackMax = Number.isFinite(stateMax) ? stateMax : maxBound;
    config.minSlider.value = formatRangeValue(fallbackMin, decimals);
    config.maxSlider.value = formatRangeValue(fallbackMax, decimals);
  }

  function formatRangeValue(value, decimals = 0) {
    if (!Number.isFinite(value)) return "";
    if (decimals <= 0) return String(Math.round(value));
    return Number(value).toFixed(decimals);
  }

  function sortSpecYearOptions(values) {
    return values.sort((a, b) => {
      const indexA = SPEC_YEAR_ORDER.indexOf(a);
      const indexB = SPEC_YEAR_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b, "ja-JP");
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  function bindFilterDrawer() {
    const drawer = elements.filterDrawer;
    if (!drawer) return;
    const toggleButtons = Array.from(document.querySelectorAll("[data-filter-drawer-toggle]"));
    const closeButton = elements.filterDrawerClose;
    const backdrop = elements.filterDrawerBackdrop;
    const inlineMediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 1280px)")
        : { matches: false };
    if (backdrop) {
      backdrop.hidden = true;
    }

    const isInlineMode = () => Boolean(inlineMediaQuery?.matches);

    const syncBodyClasses = () => {
      const inlineMode = isInlineMode();
      document.body.classList.toggle("drawer-inline-mode", inlineMode);
      document.body.classList.toggle("drawer-inline-open", inlineMode && state.filterDrawerOpen);
    };

    const syncBackdrop = () => {
      if (!backdrop) return;
      if (isInlineMode()) {
        backdrop.classList.remove("is-active");
        backdrop.hidden = true;
        return;
      }
      if (state.filterDrawerOpen) {
        backdrop.hidden = false;
        backdrop.classList.add("is-active");
      } else {
        backdrop.classList.remove("is-active");
        backdrop.hidden = true;
      }
    };

    const updateToggleState = () => {
      toggleButtons.forEach((button) => {
        if (!button) return;
        button.setAttribute("aria-expanded", String(state.filterDrawerOpen));
        button.classList.toggle("is-active", state.filterDrawerOpen);
      });
    };

    const updateDrawerAria = () => {
      drawer.setAttribute("aria-hidden", String(!state.filterDrawerOpen));
    };

    const openDrawer = () => {
      state.filterDrawerOpen = true;
      drawer.classList.add("is-active");
      syncBackdrop();
      syncBodyClasses();
      updateToggleState();
      updateDrawerAria();
    };

    const closeDrawer = () => {
      state.filterDrawerOpen = false;
      drawer.classList.remove("is-active");
      syncBackdrop();
      syncBodyClasses();
      updateToggleState();
      updateDrawerAria();
    };

    const toggleDrawer = () => {
      if (state.filterDrawerOpen) closeDrawer();
      else openDrawer();
    };

    toggleButtons.forEach((button) => button?.addEventListener("click", toggleDrawer));
    closeButton?.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.filterDrawerOpen) {
        closeDrawer();
      }
    });

    document.addEventListener("click", (event) => {
      if (!state.filterDrawerOpen || isInlineMode()) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (drawer.contains(target)) return;
      if (toggleButtons.some((button) => button?.contains(target))) return;
      closeDrawer();
    });

    const handleBreakpointChange = () => {
      syncBodyClasses();
      syncBackdrop();
    };

    if (typeof inlineMediaQuery.addEventListener === "function") {
      inlineMediaQuery.addEventListener("change", handleBreakpointChange);
    } else if (typeof inlineMediaQuery.addListener === "function") {
      inlineMediaQuery.addListener(handleBreakpointChange);
    }

    closeDrawer();
    handleBreakpointChange();
  }

  function bindGlobalFilterReset() {
    elements.filterResetButton?.addEventListener("click", () => {
      resetAllFilters();
    });
  }

  function initFilterInfoModal() {
    const openButton = elements.filterInfoOpen;
    const closeButton = elements.filterInfoClose;
    const backdrop = elements.filterInfoBackdrop;
    openButton?.addEventListener("click", openFilterInfoModal);
    closeButton?.addEventListener("click", closeFilterInfoModal);
    backdrop?.addEventListener("click", closeFilterInfoModal);
  }

  function openFilterInfoModal() {
    const modal = elements.filterInfoModal;
    const backdrop = elements.filterInfoBackdrop;
    if (!modal || !backdrop) return;
    filterInfoLastFocus = document.activeElement;
    modal.hidden = false;
    backdrop.hidden = false;
    modal.classList.add("is-active");
    backdrop.classList.add("is-active");
    modal.setAttribute("aria-hidden", "false");
    elements.filterInfoClose?.focus();
    document.addEventListener("keydown", handleFilterInfoKeydown);
  }

  function closeFilterInfoModal() {
    const modal = elements.filterInfoModal;
    const backdrop = elements.filterInfoBackdrop;
    if (!modal || !backdrop) return;
    modal.classList.remove("is-active");
    backdrop.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    backdrop.hidden = true;
    document.removeEventListener("keydown", handleFilterInfoKeydown);
    if (filterInfoLastFocus && typeof filterInfoLastFocus.focus === "function") {
      try {
        filterInfoLastFocus.focus();
      } catch (_) {
        // ignore focus errors
      }
    }
  }

  function handleFilterInfoKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFilterInfoModal();
    }
  }

  function openDetailModal() {
    const modal = elements.detailModal;
    const backdrop = elements.detailBackdrop;
    if (!modal || !backdrop) return;
    detailModalLastFocus = document.activeElement;
    modal.hidden = false;
    backdrop.hidden = false;
    modal.classList.add("is-active");
    backdrop.classList.add("is-active");
    modal.setAttribute("aria-hidden", "false");
    elements.detailClose?.focus();
    document.addEventListener("keydown", handleDetailModalKeydown);
  }

  function closeDetailModal(options = {}) {
    const { restoreFocus = true } = options;
    const modal = elements.detailModal;
    const backdrop = elements.detailBackdrop;
    if (!modal || !backdrop) return;
    modal.classList.remove("is-active");
    backdrop.classList.remove("is-active");
    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    backdrop.hidden = true;
    document.removeEventListener("keydown", handleDetailModalKeydown);
    if (restoreFocus && detailModalLastFocus && typeof detailModalLastFocus.focus === "function") {
      try {
        detailModalLastFocus.focus();
      } catch (_) {
        // ignore focus errors
      }
    }
  }

  function handleDetailModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearDetailView({ preservePageSize: true, closeModal: true });
    }
  }

  function initDetailView() {
    elements.detailClose?.addEventListener("click", () => {
      clearDetailView({ preservePageSize: true, closeModal: true });
    });
    elements.detailBackdrop?.addEventListener("click", () => {
      clearDetailView({ preservePageSize: true, closeModal: true });
    });
    elements.detailSortButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const sortKey = button.dataset.detailSortKey || null;
        if (!sortKey) return;
        handleDetailSortToggle(sortKey);
      });
    });
    const pageSizeSelect = elements.detailPageSize;
    if (pageSizeSelect) {
      if (!pageSizeSelect.options.length) {
        DETAIL_PAGE_SIZE_OPTIONS.forEach((size) => {
          const option = document.createElement("option");
          option.value = String(size);
          option.textContent = `${size}件`;
          pageSizeSelect.appendChild(option);
        });
      }
      pageSizeSelect.value = String(state.detailView.pageSize);
      pageSizeSelect.addEventListener("change", () => {
        const value = Number.parseInt(pageSizeSelect.value, 10);
        if (!Number.isFinite(value) || value <= 0) return;
        state.detailView.pageSize = value;
        state.detailView.page = 1;
        renderDetailView();
      });
    }
    elements.detailSearch?.addEventListener("input", () => {
      state.detailView.searchQuery = elements.detailSearch?.value?.trim() ?? "";
      state.detailView.page = 1;
      renderDetailView();
    });
    elements.detailClear?.addEventListener("click", () => {
      clearDetailView({ preservePageSize: true, closeModal: true });
    });
    elements.detailPrev?.addEventListener("click", () => {
      if (state.detailView.page <= 1) return;
      state.detailView.page -= 1;
      renderDetailView();
    });
    elements.detailNext?.addEventListener("click", () => {
      state.detailView.page += 1;
      renderDetailView();
    });
  }

  function clearDetailView(options = {}) {
    const {
      preservePageSize = true,
      skipRender = false,
      closeModal = true,
      restoreFocus = true,
      preserveSort = true,
    } = options;
    const nextPageSize = preservePageSize
      ? state.detailView.pageSize || DETAIL_PAGE_SIZE_DEFAULT
      : DETAIL_PAGE_SIZE_DEFAULT;
    const nextSortKey = preserveSort ? state.detailView.sortKey : null;
    const nextSortDirection = preserveSort ? state.detailView.sortDirection || "asc" : "asc";
    state.detailView = {
      active: false,
      sourceTitle: "",
      bucketLabel: "",
      records: [],
      searchQuery: "",
      page: 1,
      pageSize: nextPageSize,
      sortKey: nextSortKey,
      sortDirection: nextSortDirection,
    };
    if (elements.detailSearch) {
      elements.detailSearch.value = "";
    }
    if (elements.detailPageSize) {
      elements.detailPageSize.value = String(nextPageSize);
    }
    if (closeModal) {
      closeDetailModal({ restoreFocus });
    }
    if (!skipRender) {
      renderDetailView();
    }
  }

  function openDetailViewFromChart({ sourceTitle, bucketLabel, records }) {
    const pageSize = state.detailView.pageSize || DETAIL_PAGE_SIZE_DEFAULT;
    const sortKey = state.detailView.sortKey || null;
    const sortDirection = state.detailView.sortDirection || "asc";
    state.detailView = {
      active: true,
      sourceTitle: sourceTitle || "グラフ",
      bucketLabel: bucketLabel || "対象",
      records: Array.isArray(records) ? records.slice() : [],
      searchQuery: "",
      page: 1,
      pageSize,
      sortKey,
      sortDirection,
    };
    if (elements.detailSearch) {
      elements.detailSearch.value = "";
    }
    if (elements.detailPageSize) {
      elements.detailPageSize.value = String(pageSize);
    }
    renderDetailView();
    openDetailModal();
  }

  function renderDetailView() {
    const { active, sourceTitle, bucketLabel, records, searchQuery } = state.detailView;
    const pageSize = Math.max(1, state.detailView.pageSize || DETAIL_PAGE_SIZE_DEFAULT);
    if (elements.detailPageSize && elements.detailPageSize.value !== String(pageSize)) {
      elements.detailPageSize.value = String(pageSize);
    }
    if (elements.detailSearch) {
      elements.detailSearch.disabled = !active;
    }
    if (elements.detailPageSize) {
      elements.detailPageSize.disabled = !active;
    }
    if (elements.detailClear) {
      elements.detailClear.disabled = !active;
    }
    updateDetailSortButtons(active);
    if (!active) {
      setText(elements.detailSelection, "グラフの棒や区分をクリックすると、該当橋梁を一覧表示します。");
      setText(elements.detailCount, "0");
      setText(elements.detailRange, "0-0 / 0");
      setText(elements.detailPage, "0 / 0");
      if (elements.detailPrev) elements.detailPrev.disabled = true;
      if (elements.detailNext) elements.detailNext.disabled = true;
      if (elements.detailBody) elements.detailBody.innerHTML = "";
      if (elements.detailEmpty) {
        elements.detailEmpty.hidden = false;
        elements.detailEmpty.textContent = "グラフ要素を選択するとここに橋梁一覧が表示されます。";
      }
      return;
    }

    const datasetLabelMap = new Map(state.datasets.map((dataset) => [dataset.id, dataset.label]));
    const filtered = filterDetailRecords(records, searchQuery, datasetLabelMap);
    const sorted = sortDetailRecords(filtered, datasetLabelMap);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    state.detailView.page = Math.min(Math.max(1, state.detailView.page), totalPages);
    const pageStart = total ? (state.detailView.page - 1) * pageSize : 0;
    const pageEnd = Math.min(pageStart + pageSize, total);
    const pageRecords = sorted.slice(pageStart, pageEnd);

    setText(elements.detailSelection, `${sourceTitle} / ${bucketLabel}`);
    setText(elements.detailCount, formatNumber(total));
    setText(
      elements.detailRange,
      total ? `${formatNumber(pageStart + 1)}-${formatNumber(pageEnd)} / ${formatNumber(total)}` : "0-0 / 0"
    );
    setText(elements.detailPage, `${state.detailView.page} / ${totalPages}`);
    if (elements.detailPrev) elements.detailPrev.disabled = state.detailView.page <= 1 || total === 0;
    if (elements.detailNext) elements.detailNext.disabled = state.detailView.page >= totalPages || total === 0;

    if (elements.detailBody) {
      elements.detailBody.innerHTML = "";
      const fragment = document.createDocumentFragment();
      pageRecords.forEach((record, index) => {
        fragment.appendChild(createDetailRow(record, pageStart + index + 1, datasetLabelMap));
      });
      elements.detailBody.appendChild(fragment);
    }
    if (elements.detailEmpty) {
      elements.detailEmpty.hidden = pageRecords.length > 0;
      if (!pageRecords.length) {
        elements.detailEmpty.textContent = searchQuery
          ? "検索条件に一致する橋梁はありません。"
          : "選択条件に一致する橋梁はありません。";
      }
    }
  }

  function handleDetailSortToggle(sortKey) {
    if (!sortKey) return;
    if (state.detailView.sortKey === sortKey) {
      state.detailView.sortDirection = state.detailView.sortDirection === "asc" ? "desc" : "asc";
    } else {
      state.detailView.sortKey = sortKey;
      state.detailView.sortDirection = "asc";
    }
    state.detailView.page = 1;
    renderDetailView();
  }

  function updateDetailSortButtons(active) {
    elements.detailSortButtons.forEach((button) => {
      const sortKey = button.dataset.detailSortKey || "";
      const label = button.dataset.sortLabel || button.textContent || "";
      const isActive = Boolean(active && sortKey && state.detailView.sortKey === sortKey);
      const direction = isActive ? state.detailView.sortDirection : null;
      const indicator = direction === "asc" ? " ▲" : direction === "desc" ? " ▼" : " ↕";
      button.textContent = `${label}${indicator}`;
      button.disabled = !active;
      button.setAttribute("aria-pressed", String(isActive));
      const parentHeader = button.closest("th");
      if (parentHeader) {
        parentHeader.setAttribute("aria-sort", isActive ? (direction === "asc" ? "ascending" : "descending") : "none");
      }
    });
  }

  function sortDetailRecords(records, datasetLabelMap) {
    const { sortKey, sortDirection } = state.detailView;
    if (!sortKey) return records;
    const direction = sortDirection === "desc" ? -1 : 1;
    const sortable = records.map((record, index) => ({ record, index }));
    sortable.sort((a, b) => {
      const compared = compareDetailRecords(a.record, b.record, sortKey, datasetLabelMap);
      if (compared !== 0) return compared * direction;
      return a.index - b.index;
    });
    return sortable.map((entry) => entry.record);
  }

  function compareDetailRecords(a, b, sortKey, datasetLabelMap) {
    switch (sortKey) {
      case "datasetLabel":
        return compareDetailText(
          datasetLabelMap.get(a.datasetId) || a.datasetLabel || a.datasetId,
          datasetLabelMap.get(b.datasetId) || b.datasetLabel || b.datasetId
        );
      case "facilityName":
        return compareDetailText(a.facilityName, b.facilityName);
      case "routeName":
        return compareDetailText(a.routeName, b.routeName);
      case "bridgeType":
        return compareDetailText(a.bridgeType, b.bridgeType);
      case "inspectionLevel":
        return getInspectionSortRank(a.inspectionLevel) - getInspectionSortRank(b.inspectionLevel);
      case "builtYear":
        return compareDetailNumbers(a.builtYear, b.builtYear);
      case "bridgeLengthM":
        return compareDetailNumbers(a.bridgeLengthM, b.bridgeLengthM);
      case "spans":
        return compareDetailNumbers(a.spans, b.spans);
      case "spanLengthM":
        return compareDetailNumbers(a.spanLengthM, b.spanLengthM);
      case "specYear":
        return getSpecYearSortRank(a) - getSpecYearSortRank(b);
      case "managementOffice":
        return compareDetailText(getManagementOfficeLabel(a), getManagementOfficeLabel(b));
      case "municipality":
        return compareDetailText(getMunicipalityLabel(a), getMunicipalityLabel(b));
      default:
        return 0;
    }
  }

  function compareDetailNumbers(a, b) {
    const aNum = Number.isFinite(a) ? a : null;
    const bNum = Number.isFinite(b) ? b : null;
    if (aNum === null && bNum === null) return 0;
    if (aNum === null) return 1;
    if (bNum === null) return -1;
    return aNum - bNum;
  }

  function compareDetailText(a, b) {
    const left = (a ?? "").toString();
    const right = (b ?? "").toString();
    return left.localeCompare(right, "ja-JP", { numeric: true, sensitivity: "base" });
  }

  function getInspectionSortRank(level) {
    const index = INSPECTION_LEVELS.indexOf(level);
    return index === -1 ? INSPECTION_LEVELS.length : index;
  }

  function getSpecYearSortRank(record) {
    const value = getRecordSpecYearValue(record, state.filters.useSpecYearInference) || SPEC_YEAR_UNKNOWN;
    const index = SPEC_YEAR_ORDER.indexOf(value);
    return index === -1 ? SPEC_YEAR_ORDER.length : index;
  }

  function filterDetailRecords(records, searchQuery, datasetLabelMap) {
    const normalizedQuery = normalizeForMatch(searchQuery || "");
    if (!normalizedQuery) return records;
    return records.filter((record) => {
      const specYear = getRecordSpecYearValue(record, state.filters.useSpecYearInference) || SPEC_YEAR_UNKNOWN;
      const candidates = [
        datasetLabelMap.get(record.datasetId) || record.datasetLabel || record.datasetId,
        record.facilityName,
        record.routeName,
        record.bridgeType,
        getInspectionLabel(record.inspectionLevel),
        getManagementOfficeLabel(record),
        getMunicipalityLabel(record),
        specYear,
      ];
      return candidates.some((value) => normalizeForMatch(value).includes(normalizedQuery));
    });
  }

  function createDetailRow(record, rowNo, datasetLabelMap) {
    const tr = document.createElement("tr");
    const datasetLabel = datasetLabelMap.get(record.datasetId) || record.datasetLabel || record.datasetId;
    const specYear = getRecordSpecYearValue(record, state.filters.useSpecYearInference) || SPEC_YEAR_UNKNOWN;
    const builtYear = Number.isFinite(record.builtYear) ? String(Math.round(record.builtYear)) : "不明";
    const bridgeLength = Number.isFinite(record.bridgeLengthM) ? record.bridgeLengthM.toFixed(1) : "-";
    const spans = Number.isFinite(record.spans) ? String(Math.round(record.spans)) : "-";
    const spanLength = Number.isFinite(record.spanLengthM) ? record.spanLengthM.toFixed(1) : "-";
    const cells = [
      String(rowNo),
      datasetLabel,
      record.facilityName,
      record.routeName,
      record.bridgeType,
      getInspectionLabel(record.inspectionLevel),
      builtYear,
      bridgeLength,
      spans,
      spanLength,
      specYear,
      getManagementOfficeLabel(record),
      getMunicipalityLabel(record),
    ];
    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value ?? "";
      tr.appendChild(td);
    });
    return tr;
  }

  function setChartDrilldownContext(chart, sourceTitle, resolver) {
    if (!chart) return;
    chart.$detailSourceTitle = sourceTitle;
    chart.$detailResolver = typeof resolver === "function" ? resolver : null;
  }

  function handleChartElementClick(chart, activeElements) {
    if (!chart || !Array.isArray(activeElements) || !activeElements.length) return;
    if (typeof chart.$detailResolver !== "function") return;
    const clicked = activeElements[0];
    const resolved = chart.$detailResolver(clicked);
    if (!resolved || !Array.isArray(resolved.records)) return;
    openDetailViewFromChart({
      sourceTitle: chart.$detailSourceTitle || "グラフ",
      bucketLabel: resolved.bucketLabel || "対象",
      records: resolved.records,
    });
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
    if (range) {
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
    const grayscaleToggle = elements.mapGrayscaleToggle;
    if (grayscaleToggle) {
      const applyGrayscale = (enabled) => {
        state.mapGrayscale = Boolean(enabled);
        elements.mapCanvas?.classList.toggle("is-grayscale", state.mapGrayscale);
      };
      grayscaleToggle.checked = state.mapGrayscale;
      grayscaleToggle.addEventListener("change", (event) => {
        applyGrayscale(event.currentTarget.checked);
      });
      applyGrayscale(grayscaleToggle.checked);
    }
  }

  function bindClusterControls() {
    const toggle = elements.mapClusterToggle;
    if (!toggle) return;
    toggle.checked = state.cluster.enabled;
    toggle.addEventListener("change", (event) => {
      state.cluster.enabled = Boolean(event.currentTarget.checked);
      updateClusterControlState();
      updateMap();
    });
    updateClusterControlState();
  }

  function bindBaseLayerSelect() {
    const select = elements.baseLayerSelect;
    if (!select) return;
    select.value = state.selectedBaseLayer;
    select.addEventListener("change", (event) => {
      const value = event.currentTarget.value;
      state.selectedBaseLayer = value;
      if (state.map) {
        setBaseLayer(value);
      }
    });
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

  function bindDatasetListStatsToggle() {
    const checkbox = elements.datasetStatsToggle;
    if (!checkbox) return;
    checkbox.checked = state.datasetListShowFilteredStats;
    checkbox.disabled = state.datasets.length === 0;
    checkbox.addEventListener("change", (event) => {
      state.datasetListShowFilteredStats = Boolean(event.currentTarget.checked);
      updateDatasetList();
    });
  }

  function bindAdvancedFilters() {
    bindSpecYearInferenceToggle();
    bindBuiltYearUnknownToggle();
    bindManagementOfficeFilter();
    bindRouteFilter();
    bindMunicipalityFilter();
    bindRangeInputs();
    bindRangeSliders();
    bindRangeClearButtons();
  }

  function bindSpecYearInferenceToggle() {
    const checkbox = elements.specYearInferToggle;
    if (!checkbox) return;
    checkbox.checked = state.filters.useSpecYearInference;
    checkbox.addEventListener("change", (event) => {
      state.filters.useSpecYearInference = Boolean(event.currentTarget.checked);
      refreshAll();
    });
  }

  function bindBuiltYearUnknownToggle() {
    const checkbox = elements.builtYearUnknownToggle;
    if (!checkbox) return;
    checkbox.checked = Boolean(state.filters.includeUnknownBuiltYear);
    checkbox.addEventListener("change", (event) => {
      state.filters.includeUnknownBuiltYear = Boolean(event.currentTarget.checked);
      refreshAll();
    });
  }

  function bindManagementOfficeFilter() {
    const list = elements.managementOfficeFilterList;
    if (list) {
      list.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('input[type="checkbox"][data-office-option="true"]')) return;
        const value = target.value;
        if (target.checked) {
          state.filters.managementOffices.add(value);
        } else {
          state.filters.managementOffices.delete(value);
        }
        updateManagementOfficeFilterCount(state.filterOptions?.managementOffices ?? []);
        refreshAll();
      });
    }
    elements.managementOfficeFilterSearch?.addEventListener("input", () => {
      renderManagementOfficeOptions(state.filterOptions?.managementOffices ?? []);
    });
    elements.managementOfficeFilterSelectAll?.addEventListener("click", () => {
      const options = state.filterOptions?.managementOffices ?? [];
      const visible = getFilteredManagementOfficeOptions(options);
      if (!visible.length) return;
      const next = new Set(state.filters.managementOffices);
      visible.forEach((value) => next.add(value));
      state.filters.managementOffices = next;
      renderManagementOfficeOptions(options);
      refreshAll();
    });
    elements.managementOfficeFilterClear?.addEventListener("click", () => {
      const options = state.filterOptions?.managementOffices ?? [];
      const visible = getFilteredManagementOfficeOptions(options);
      if (!visible.length) return;
      if (!state.filters.managementOffices.size) return;
      const next = new Set(state.filters.managementOffices);
      visible.forEach((value) => next.delete(value));
      state.filters.managementOffices = next;
      renderManagementOfficeOptions(options);
      refreshAll();
    });
  }

  function bindRouteFilter() {
    const list = elements.routeFilterList;
    if (list) {
      list.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('input[type="checkbox"][data-route-option="true"]')) return;
        const value = target.value;
        if (target.checked) {
          state.filters.routeNames.add(value);
        } else {
          state.filters.routeNames.delete(value);
        }
        updateRouteFilterCount(state.filterOptions?.routeNames ?? []);
        refreshAll();
      });
    }
    elements.routeFilterSearch?.addEventListener("input", () => {
      renderRouteOptions(state.filterOptions?.routeNames ?? []);
    });
    elements.routeFilterSelectAll?.addEventListener("click", () => {
      const options = state.filterOptions?.routeNames ?? [];
      const visible = getFilteredRouteOptions(options);
      if (!visible.length) return;
      const next = new Set(state.filters.routeNames);
      visible.forEach((value) => next.add(value));
      state.filters.routeNames = next;
      renderRouteOptions(options);
      refreshAll();
    });
    elements.routeFilterClear?.addEventListener("click", () => {
      const options = state.filterOptions?.routeNames ?? [];
      const visible = getFilteredRouteOptions(options);
      if (!visible.length) return;
      if (!state.filters.routeNames.size) return;
      const next = new Set(state.filters.routeNames);
      visible.forEach((value) => next.delete(value));
      state.filters.routeNames = next;
      renderRouteOptions(options);
      refreshAll();
    });
  }

  function bindMunicipalityFilter() {
    const list = elements.municipalityFilterList;
    if (list) {
      list.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('input[type="checkbox"][data-municipality-option="true"]')) return;
        const value = target.value;
        if (target.checked) {
          state.filters.municipalities.add(value);
        } else {
          state.filters.municipalities.delete(value);
        }
        updateMunicipalityFilterCount(state.filterOptions?.municipalities ?? []);
        refreshAll();
      });
    }
    elements.municipalityFilterSearch?.addEventListener("input", () => {
      renderMunicipalityOptions(state.filterOptions?.municipalities ?? []);
    });
    elements.municipalityFilterSelectAll?.addEventListener("click", () => {
      const options = state.filterOptions?.municipalities ?? [];
      const visible = getFilteredMunicipalityOptions(options);
      if (!visible.length) return;
      const next = new Set(state.filters.municipalities);
      visible.forEach((value) => next.add(value));
      state.filters.municipalities = next;
      renderMunicipalityOptions(options);
      refreshAll();
    });
    elements.municipalityFilterClear?.addEventListener("click", () => {
      const options = state.filterOptions?.municipalities ?? [];
      const visible = getFilteredMunicipalityOptions(options);
      if (!visible.length) return;
      if (!state.filters.municipalities.size) return;
      const next = new Set(state.filters.municipalities);
      visible.forEach((value) => next.delete(value));
      state.filters.municipalities = next;
      renderMunicipalityOptions(options);
      refreshAll();
    });
  }

  function bindRangeInputs() {
    Object.values(RANGE_FILTER_CONFIGS).forEach((config) => {
      if (!config.minInput && !config.maxInput) return;
      const handle = () => {
        const decimals = config.decimals || 0;
        let min = parseInputNumber(config.minInput);
        let max = parseInputNumber(config.maxInput);
        if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
          if (document.activeElement === config.minInput && config.maxInput) {
            max = min;
            config.maxInput.value = formatRangeValue(max, decimals);
          } else if (document.activeElement === config.maxInput && config.minInput) {
            min = max;
            config.minInput.value = formatRangeValue(min, decimals);
          } else {
            const temp = min;
            min = max;
            max = temp;
          }
        }
        setRangeState(config.key, min, max);
        syncRangeSlidersFromState(config.key, state.filterOptions?.[config.statsKey]);
      };
      config.minInput?.addEventListener("change", handle);
      config.maxInput?.addEventListener("change", handle);
    });
  }

  function bindRangeSliders() {
    Object.values(RANGE_FILTER_CONFIGS).forEach((config) => {
      if (!config.minSlider || !config.maxSlider) return;
      const handleSlider = (type) => {
        let minValue = Number.parseFloat(config.minSlider.value);
        let maxValue = Number.parseFloat(config.maxSlider.value);
        if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return;
        if (minValue > maxValue) {
          if (type === "min") {
            maxValue = minValue;
            config.maxSlider.value = formatRangeValue(maxValue, config.decimals);
          } else {
            minValue = maxValue;
            config.minSlider.value = formatRangeValue(minValue, config.decimals);
          }
        }
        setRangeState(config.key, minValue, maxValue);
        syncRangeInputsFromState(config.key);
      };
      config.minSlider.addEventListener("input", () => handleSlider("min"));
      config.maxSlider.addEventListener("input", () => handleSlider("max"));
    });
  }

  function bindRangeClearButtons() {
    document.querySelectorAll("[data-range-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.rangeClear;
        const config = RANGE_FILTER_CONFIGS[key];
        if (!config) return;
        setRangeState(key, null, null);
        config.minInput && (config.minInput.value = "");
        config.maxInput && (config.maxInput.value = "");
        syncRangeInputsFromState(key);
        syncRangeSlidersFromState(key, state.filterOptions?.[config.statsKey]);
      });
    });
  }

  function parseInputNumber(input) {
    if (!input) return null;
    const value = parseNumber(input.value);
    return Number.isFinite(value) ? value : null;
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
    rebuildDynamicFilters();

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
    const bridgeLengthValue = parseNumber(values["橋長(m)"]);
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
    const municipalityName = sanitizeText(
      values["行政区域_市区町村名"] ?? values["行政区域_市区町村"] ?? values["行政区域_市町村名"]
    );
    const railStatus = sanitizeText(values["道路橋下状況_鉄道"]);
    const roadManager = sanitizeText(values["道路橋下状況_道路_道路管理者"]);
    const lat = parseNumber(values["起点側位置_緯度"]);
    const lng = parseNumber(values["起点側位置_経度"]);
    const inspectionYear = parseNumber(values["点検記録_点検実施年度"]);
    const inspectionLevel = normalizeInspection(values["点検記録_判定区分"]);
    const superstructureType = sanitizeText(values["上部構造形式"]);
    const superstructureForm = sanitizeText(
      values["上部工（構造形式）"] ?? values["上部工_構造形式"] ?? values["上部工構造形式"]
    );
    const pcMetadata = derivePcMetadata(superstructureType, superstructureForm, materialRaw);
    const culvertFlag = sanitizeText(values["溝橋(ｶﾙﾊﾞｰﾄ)"]);
    const isCulvert = detectCulvert(superstructureType, superstructureForm, culvertFlag);
    const specYearLabel = normalizeSpecYear(values["新設設計時の適用基準"]);
    const inferredSpecYear = inferSpecYearFromYear(builtYear);
    const crossingType = deriveCrossingType(railStatus, roadManager);
    const importanceLevel = normalizeImportance(values["橋の重要度"]);
    const spanLengthM =
      Number.isFinite(bridgeLengthValue) && Number.isFinite(spans) && spans > 0
        ? bridgeLengthValue / spans
        : null;

    const isEmpty =
      !facilityName &&
      !routeName &&
      builtYear === null &&
      bridgeLengthValue === null &&
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
      routeName: routeName || ROUTE_UNKNOWN_LABEL,
      builtYear: builtYear ?? null,
      bridgeLengthM: Number.isFinite(bridgeLengthValue) ? bridgeLengthValue : null,
      spans: Number.isFinite(spans) ? spans : null,
      materialRaw,
      managementName,
      managementOffice,
      municipalityName: municipalityName || MUNICIPALITY_UNKNOWN_LABEL,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      inspectionYear: inspectionYear ?? null,
      inspectionLevel,
      bridgeType: deriveBridgeType(materialRaw, superstructureType, superstructureForm),
      superstructureType,
      superstructureForm,
      isCulvert,
      pcTensionType: pcMetadata.tensionType,
      pcPostCategory: pcMetadata.postCategory,
      specYearLabel: specYearLabel ?? null,
      specYearInferred: inferredSpecYear,
      crossingType,
      importanceLevel,
      spanLengthM,
    };
  }

  function deriveBridgeType(material, superstructureType, superstructureForm) {
    const sources = [material, superstructureType, superstructureForm].filter((value) => Boolean(value && value.trim()));
    if (!sources.length) return "その他";
    for (const source of sources) {
      const normalized = normalizeForMatch(source);
      if (!normalized) continue;
      for (const rule of BRIDGE_TYPE_RULES) {
        if (rule.keywords.some((keyword) => normalized.includes(normalizeForMatch(keyword)))) {
          return rule.type;
        }
      }
    }
    return "その他";
  }

  function deriveCrossingType(railStatus, roadManager) {
    const railNormalized = normalizeForMatch(railStatus);
    if (includesAnyKeyword(railNormalized, CROSSING_RAIL_KEYWORDS)) {
      return "跨線橋";
    }
    const roadNormalized = normalizeForMatch(roadManager);
    if (includesAnyKeyword(roadNormalized, CROSSING_ROAD_MANAGERS)) {
      return "跨道橋";
    }
    return "その他";
  }

  function normalizeImportance(value) {
    const normalized = normalizeForMatch(value);
    if (!normalized) return "記載なし";
    if (normalized.includes("A種") || normalized.includes("Ａ種") || normalized.includes("A種ノ橋")) return "Ａ種の橋";
    if (normalized.includes("B種") || normalized.includes("Ｂ種") || normalized.includes("B種ノ橋")) return "Ｂ種の橋";
    return "記載なし";
  }

  function derivePcMetadata(superstructureType, superstructureForm, materialRaw) {
    const sources = [superstructureType, superstructureForm, materialRaw].filter(Boolean);
    if (!sources.length) {
      return { tensionType: null, postCategory: null };
    }
    const normalized = normalizeForMatch(sources.join(" "));
    let tensionType = null;
    if (
      includesAnyKeyword(normalized, ["ポステン", "ﾎﾟｽﾃﾝ", "ポストテン", "ポストテンション"])
    ) {
      tensionType = "ポステン";
    } else if (
      includesAnyKeyword(normalized, ["プレテン", "ﾌﾟﾚﾃﾝ", "プリテン"])
    ) {
      tensionType = "プレテン";
    }

    let postCategory = null;
    if (tensionType === "ポステン") {
      const detailParts = [];
      if (superstructureType) {
        const baseType = superstructureType.includes("_") ? superstructureType.split("_")[1] : superstructureType;
        if (baseType) detailParts.push(baseType);
      }
      if (superstructureForm) detailParts.push(superstructureForm);
      const detailSource = normalizeForMatch(detailParts.join(" "));
      if (detailSource.includes("中空床版")) postCategory = "中空床版";
      else if (detailSource.includes("T桁")) postCategory = "T桁";
      else if (detailSource.includes("箱桁")) postCategory = "箱桁";
      else if (detailSource) {
        postCategory = "その他";
      }
    }
    return { tensionType, postCategory };
  }

function resolvePcTensionKey(value) {
  if (!value || !PC_TENSION_KEYS.has(value)) return "不明";
  return value;
}

function resolvePcPostKey(value) {
  if (!value || !PC_POST_KEYS.has(value)) return "その他";
  return value;
}

  function detectCulvert(superstructureType, superstructureForm, culvertFlag) {
    const flagNormalized = normalizeForMatch(culvertFlag || "");
    if (/[○●◯〇]/.test(culvertFlag)) return true;
    if (flagNormalized.includes("YES") || flagNormalized.includes("TRUE")) return true;
    const combined = [superstructureType, superstructureForm].filter(Boolean).join(" ");
    if (!combined) return false;
    const normalized = normalizeForMatch(combined);
    return includesAnyKeyword(normalized, ["カルバート", "溝橋", "BOXカルバート"]);
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

  function refreshAll(options = {}) {
    const { preserveDetailView = false } = options;
    if (!preserveDetailView) {
      clearDetailView({ preservePageSize: true, skipRender: true, restoreFocus: false });
    }
    updateDatasetList();
    updateKpis();
    updateCharts();
    updateMap();
    renderDetailView();
  }

  function updateDatasetList() {
    const hasDatasets = state.datasets.length > 0;
    const statsMap = getDatasetListStatsMap();
    if (elements.datasetEmpty) {
      elements.datasetEmpty.hidden = hasDatasets;
    }
    if (elements.datasetTableWrap) {
      elements.datasetTableWrap.hidden = !hasDatasets;
    }
    if (elements.datasetStatsToggle) {
      elements.datasetStatsToggle.disabled = !hasDatasets;
    }
    if (elements.datasetList) {
      elements.datasetList.innerHTML = "";
      if (hasDatasets) {
        state.datasets.forEach((dataset) => {
          const stats = statsMap.get(dataset.id);
          elements.datasetList.appendChild(createDatasetRow(dataset, stats));
        });
      }
    }
  }

  function getDatasetListStatsMap() {
    const statsMap = new Map();
    if (!state.datasetListShowFilteredStats) {
      state.datasets.forEach((dataset) => {
        statsMap.set(dataset.id, {
          bridgeCount: dataset.stats.bridgeCount,
          flagged: dataset.stats.flagged,
        });
      });
      return statsMap;
    }

    const passesFilters = createRecordFilterPredicate();
    state.datasets.forEach((dataset) => {
      let bridgeCount = 0;
      let flagged = 0;
      dataset.records.forEach((record) => {
        if (!passesFilters(record)) return;
        bridgeCount += 1;
        if (record.inspectionLevel === "III" || record.inspectionLevel === "IV") {
          flagged += 1;
        }
      });
      statsMap.set(dataset.id, { bridgeCount, flagged });
    });
    return statsMap;
  }


  function createDatasetVisibilityToggle(dataset) {
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
    return toggle;
  }

  function createDatasetRemoveButton(dataset) {
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "dataset-remove";
    removeButton.setAttribute("aria-label", `${dataset.label} を一覧から削除する`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeDataset(dataset.id));
    return removeButton;
  }

  function createDatasetRow(dataset, stats) {
    const row = document.createElement("tr");
    row.className = "dataset-row";
    if (!dataset.active) row.classList.add("is-muted");

    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.className = "dataset-name-cell";
    nameCell.textContent = dataset.label;

    const bridgeCountCell = document.createElement("td");
    bridgeCountCell.className = "dataset-number-cell";
    bridgeCountCell.textContent = formatNumber(stats.bridgeCount);

    const flaggedCell = document.createElement("td");
    flaggedCell.className = "dataset-flagged-cell";
    const flaggedRate = stats.bridgeCount ? stats.flagged / stats.bridgeCount : 0;
    const flaggedMain = document.createElement("span");
    flaggedMain.className = "dataset-flagged-main";
    flaggedMain.textContent = formatNumber(stats.flagged);
    const flaggedRateText = document.createElement("span");
    flaggedRateText.className = "dataset-flagged-rate";
    flaggedRateText.textContent = ` (${formatPercent(flaggedRate)})`;
    flaggedCell.append(flaggedMain, flaggedRateText);

    const visibilityCell = document.createElement("td");
    visibilityCell.className = "dataset-control-cell";
    visibilityCell.appendChild(createDatasetVisibilityToggle(dataset));

    const removeCell = document.createElement("td");
    removeCell.className = "dataset-control-cell";
    removeCell.appendChild(createDatasetRemoveButton(dataset));

    row.append(nameCell, bridgeCountCell, flaggedCell, visibilityCell, removeCell);
    return row;
  }

  function removeDataset(datasetId) {
    const index = state.datasets.findIndex((dataset) => dataset.id === datasetId);
    if (index === -1) return;
    const [removed] = state.datasets.splice(index, 1);
    addLog(`dataset「${removed?.label ?? datasetId}」を削除しました。`, "info");
    rebuildDynamicFilters();
    refreshAll();
  }

  function updateKpis() {
    const activeDatasets = state.datasets.filter((dataset) => dataset.active);
    const records = getFilteredRecords();
    const totalLengthKm = records.reduce((sum, record) => sum + (record.bridgeLengthM || 0), 0) / 1000;
    const flagged = records.filter((record) => record.inspectionLevel === "III" || record.inspectionLevel === "IV")
      .length;
    const flaggedRate = records.length ? flagged / records.length : 0;
    setText(elements.kpis.datasets, formatNumber(activeDatasets.length));
    setText(elements.kpis.bridges, formatNumber(records.length));
    setText(elements.kpis.length, totalLengthKm.toFixed(2));
    setText(elements.kpis.flagged, `${formatNumber(flagged)} (${formatPercent(flaggedRate)})`);
    if (elements.kpiCulvertHint) {
      elements.kpiCulvertHint.hidden = !state.filters.excludeCulvert;
    }
  }

  function updateCharts() {
    updateStockChart();
    updateRatingChart();
    updateLengthChart();
    updateSpanCountChart();
    updateSpanLengthChart();
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
          {
            type: "line",
            label: "累積相対度数",
            data: [],
            yAxisID: "y1",
            borderColor: "#4b5563",
            tension: 0,
            borderWidth: 2,
            backgroundColor: "#4b5563",
            pointRadius: 0,
            pointHoverRadius: 0,
            pointBackgroundColor: "#4b5563",
            fill: false,
          },
          { type: "bar", label: "橋梁数", data: [], backgroundColor: "#0ea5e9" },
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

    state.charts.spanCount = createChart("chart-span-count", {
      data: {
        labels: [],
        datasets: [
          {
            type: "line",
            label: "累積相対度数",
            data: [],
            yAxisID: "y1",
            borderColor: "#4b5563",
            tension: 0,
            borderWidth: 2,
            backgroundColor: "#4b5563",
            pointRadius: 0,
            pointHoverRadius: 0,
            pointBackgroundColor: "#4b5563",
            fill: false,
          },
          { type: "bar", label: "橋梁数", data: [], backgroundColor: "#0ea5e9" },
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

    state.charts.spanLength = createChart("chart-span-length", {
      data: {
        labels: [],
        datasets: [
          {
            type: "line",
            label: "累積相対度数",
            data: [],
            yAxisID: "y1",
            borderColor: "#4b5563",
            tension: 0,
            borderWidth: 2,
            backgroundColor: "#4b5563",
            pointRadius: 0,
            pointHoverRadius: 0,
            pointBackgroundColor: "#4b5563",
            fill: false,
          },
          { type: "bar", label: "橋梁数", data: [], backgroundColor: "#0ea5e9" },
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
    const baseOptions = config.options || {};
    const userOnClick = baseOptions.onClick;
    const userOnHover = baseOptions.onHover;
    const mergedConfig = {
      ...config,
      options: {
        responsive: true,
        ...baseOptions,
        maintainAspectRatio: false,
        onClick: (event, activeElements, chart) => {
          if (typeof userOnClick === "function") {
            userOnClick(event, activeElements, chart);
          }
          handleChartElementClick(chart, activeElements);
        },
        onHover: (event, activeElements, chart) => {
          if (chart?.canvas) {
            chart.canvas.style.cursor = Array.isArray(activeElements) && activeElements.length ? "pointer" : "default";
          }
          if (typeof userOnHover === "function") {
            userOnHover(event, activeElements, chart);
          }
        },
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
    let buckets = [];

    if (stockScope === "dataset") {
      const datasetMap = new Map();
      state.datasets
        .filter((dataset) => dataset.active)
        .forEach((dataset) => datasetMap.set(dataset.id, { label: dataset.label, value: 0, records: [] }));
      records.forEach((record) => {
        const entry = datasetMap.get(record.datasetId);
        if (!entry) return;
        entry.value += stockMode === "count" ? 1 : (record.bridgeLengthM || 0) / 1000;
        entry.records.push(record);
      });
      const entries = Array.from(datasetMap.values());
      labels = entries.map((entry) => entry.label);
      values = entries.map((entry) =>
        stockMode === "count" ? entry.value : Number(entry.value.toFixed(2))
      );
      buckets = entries.map((entry) => ({
        bucketLabel: entry.label,
        records: entry.records,
      }));
    } else {
      labels = BRIDGE_TYPES;
      const aggregated = BRIDGE_TYPES.map(() => 0);
      const recordBuckets = BRIDGE_TYPES.map(() => []);
      records.forEach((record) => {
        const index = BRIDGE_TYPES.indexOf(record.bridgeType);
        if (index === -1) return;
        aggregated[index] += stockMode === "count" ? 1 : (record.bridgeLengthM || 0) / 1000;
        recordBuckets[index].push(record);
      });
      values = aggregated.map((value) => (stockMode === "count" ? value : Number(value.toFixed(2))));
      buckets = BRIDGE_TYPES.map((type, index) => ({
        bucketLabel: type,
        records: recordBuckets[index],
      }));
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].label = labelText;
    chart.options.scales.y.title = { display: true, text: stockMode === "count" ? "橋梁数" : "総延長 (km)" };
    setChartDrilldownContext(chart, "橋種別ストック構成", ({ index }) => {
      const bucket = buckets[index];
      if (!bucket) return null;
      return {
        bucketLabel: bucket.bucketLabel,
        records: bucket.records,
      };
    });
    chart.update();
  }

  function updateRatingChart() {
    const chart = state.charts.rating;
    if (!chart) return;
    const records = getFilteredRecords();
    const countsByType = BRIDGE_TYPES.map(() => INSPECTION_LEVELS.map(() => 0));
    const recordBuckets = BRIDGE_TYPES.map(() => INSPECTION_LEVELS.map(() => []));
    records.forEach((record) => {
      const typeIndex = BRIDGE_TYPES.indexOf(record.bridgeType);
      const levelIndex = INSPECTION_LEVELS.indexOf(record.inspectionLevel);
      if (typeIndex === -1 || levelIndex === -1) return;
      countsByType[typeIndex][levelIndex] += 1;
      recordBuckets[typeIndex][levelIndex].push(record);
    });
    chart.data.labels = INSPECTION_LEVELS.map(getInspectionLabel);
    chart.data.datasets = BRIDGE_TYPES.map((type, typeIndex) => ({
      label: type,
      data: INSPECTION_LEVELS.map((_, levelIndex) => countsByType[typeIndex][levelIndex]),
      backgroundColor: BRIDGE_TYPE_COLOR_MAP[type],
    }));
    setChartDrilldownContext(chart, "点検判定区分の分布", ({ index, datasetIndex }) => {
      const type = BRIDGE_TYPES[datasetIndex];
      const level = INSPECTION_LEVELS[index];
      if (!type || !level) return null;
      return {
        bucketLabel: `${type} × ${getInspectionLabel(level)}`,
        records: recordBuckets[datasetIndex][index] || [],
      };
    });
    chart.update();
  }

  function updateLengthChart() {
    const chart = state.charts.length;
    if (!chart) return;
    const lineDataset = chart.data.datasets.find((dataset) => dataset.type === "line");
    const barDataset = chart.data.datasets.find((dataset) => dataset.type === "bar");
    if (!lineDataset || !barDataset) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.bridgeLengthM));
    if (!records.length) {
      chart.data.labels = [];
      lineDataset.data = [];
      barDataset.data = [];
      setChartDrilldownContext(chart, "橋長階級ヒストグラム", null);
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
    const bucketRecords = Array.from({ length: binCount }, () => []);
    records.forEach((record) => {
      const index = Math.min(Math.floor(record.bridgeLengthM / binSize), binCount - 1);
      counts[index] += 1;
      bucketRecords[index].push(record);
    });
    const cumulativeRelative = [];
    counts.reduce((sum, count, index) => {
      const nextSum = sum + count;
      cumulativeRelative[index] = Number(((nextSum / records.length) * 100).toFixed(1));
      return nextSum;
    }, 0);
    chart.data.labels = labels;
    barDataset.data = counts;
    lineDataset.data = cumulativeRelative;
    setChartDrilldownContext(chart, "橋長階級ヒストグラム", ({ index }) => {
      if (!labels[index]) return null;
      return {
        bucketLabel: labels[index],
        records: bucketRecords[index] || [],
      };
    });
    chart.update();
  }

  function updateSpanCountChart() {
    const chart = state.charts.spanCount;
    if (!chart) return;
    const lineDataset = chart.data.datasets.find((dataset) => dataset.type === "line");
    const barDataset = chart.data.datasets.find((dataset) => dataset.type === "bar");
    if (!lineDataset || !barDataset) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.spans));
    if (!records.length) {
      chart.data.labels = [];
      lineDataset.data = [];
      barDataset.data = [];
      setChartDrilldownContext(chart, "径間数ヒストグラム", null);
      chart.update();
      return;
    }
    const binSize = SPAN_COUNT_BIN_SIZE;
    const minValue = Math.min(...records.map((record) => record.spans));
    const maxValue = Math.max(...records.map((record) => record.spans));
    const start = Math.floor(minValue);
    const binCount = Math.max(1, Math.ceil((maxValue - start) / binSize));
    const labels = Array.from({ length: binCount }, (_, index) => {
      const rangeStart = start + index * binSize;
      const rangeEnd = rangeStart + binSize;
      return `${rangeStart}-${rangeEnd}径間`;
    });
    const counts = new Array(binCount).fill(0);
    const bucketRecords = Array.from({ length: binCount }, () => []);
    records.forEach((record) => {
      const index = Math.min(Math.floor((record.spans - start) / binSize), binCount - 1);
      if (index < 0) return;
      counts[index] += 1;
      bucketRecords[index].push(record);
    });
    const cumulativeRelative = [];
    counts.reduce((sum, count, index) => {
      const nextSum = sum + count;
      cumulativeRelative[index] = Number(((nextSum / records.length) * 100).toFixed(1));
      return nextSum;
    }, 0);
    chart.data.labels = labels;
    barDataset.data = counts;
    lineDataset.data = cumulativeRelative;
    setChartDrilldownContext(chart, "径間数ヒストグラム", ({ index }) => {
      if (!labels[index]) return null;
      return {
        bucketLabel: labels[index],
        records: bucketRecords[index] || [],
      };
    });
    chart.update();
  }

  function updateSpanLengthChart() {
    const chart = state.charts.spanLength;
    if (!chart) return;
    const lineDataset = chart.data.datasets.find((dataset) => dataset.type === "line");
    const barDataset = chart.data.datasets.find((dataset) => dataset.type === "bar");
    if (!lineDataset || !barDataset) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.spanLengthM));
    if (!records.length) {
      chart.data.labels = [];
      lineDataset.data = [];
      barDataset.data = [];
      setChartDrilldownContext(chart, "径間長ヒストグラム", null);
      chart.update();
      return;
    }
    const binSize = SPAN_LENGTH_BIN_SIZE;
    const maxValue = Math.max(...records.map((record) => record.spanLengthM));
    const binCount = Math.max(1, Math.ceil(maxValue / binSize));
    const labels = Array.from({ length: binCount }, (_, index) => {
      const start = index * binSize;
      const end = start + binSize;
      return `${start}-${end}m`;
    });
    const counts = new Array(binCount).fill(0);
    const bucketRecords = Array.from({ length: binCount }, () => []);
    records.forEach((record) => {
      const index = Math.min(Math.floor(record.spanLengthM / binSize), binCount - 1);
      counts[index] += 1;
      bucketRecords[index].push(record);
    });
    const cumulativeRelative = [];
    counts.reduce((sum, count, index) => {
      const nextSum = sum + count;
      cumulativeRelative[index] = Number(((nextSum / records.length) * 100).toFixed(1));
      return nextSum;
    }, 0);
    chart.data.labels = labels;
    barDataset.data = counts;
    lineDataset.data = cumulativeRelative;
    setChartDrilldownContext(chart, "径間長ヒストグラム", ({ index }) => {
      if (!labels[index]) return null;
      return {
        bucketLabel: labels[index],
        records: bucketRecords[index] || [],
      };
    });
    chart.update();
  }

  function updateYearChart() {
    const chart = state.charts.year;
    if (!chart) return;
    const records = getFilteredRecords().filter((record) => Number.isFinite(record.builtYear));
    if (!records.length) {
      chart.data.labels = [];
      chart.data.datasets = [];
      setChartDrilldownContext(chart, "架設年度分布", null);
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
          recordsByType: BRIDGE_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
          allRecords: [],
        });
      }
      const bucket = bucketMap.get(bucketKey);
      bucket.counts[record.bridgeType] += 1;
      bucket.recordsByType[record.bridgeType].push(record);
      bucket.allRecords.push(record);
    });
    const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => a - b);
    chart.data.labels = sortedKeys.map((key) => bucketMap.get(key).label);
    const bucketTotals = sortedKeys.map((key) =>
      BRIDGE_TYPES.reduce((sum, type) => sum + bucketMap.get(key).counts[type], 0)
    );
    const cumulativeRelative = [];
    bucketTotals.reduce((sum, total, index) => {
      const nextSum = sum + total;
      cumulativeRelative[index] = Number(((nextSum / records.length) * 100).toFixed(1));
      return nextSum;
    }, 0);
    const stackedDatasets = BRIDGE_TYPES.map((type) => ({
      label: type,
      data: sortedKeys.map((key) => bucketMap.get(key).counts[type]),
      backgroundColor: BRIDGE_TYPE_COLOR_MAP[type],
      stack: "year",
    }));
    const cumulativeDataset = {
      type: "line",
      label: "累積相対度数",
      data: cumulativeRelative,
      yAxisID: "y1",
      borderColor: "#4b5563",
      backgroundColor: "#4b5563",
      tension: 0,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointBackgroundColor: "#4b5563",
      fill: false,
    };
    chart.data.datasets = [cumulativeDataset, ...stackedDatasets];
    setChartDrilldownContext(chart, "架設年度分布", ({ index, datasetIndex }) => {
      const bucketKey = sortedKeys[index];
      if (bucketKey === undefined) return null;
      const bucket = bucketMap.get(bucketKey);
      if (!bucket) return null;
      if (datasetIndex === 0) {
        return {
          bucketLabel: `${bucket.label}（全橋種）`,
          records: bucket.allRecords,
        };
      }
      const type = BRIDGE_TYPES[datasetIndex - 1];
      if (!type) return null;
      return {
        bucketLabel: `${bucket.label} × ${type}`,
        records: bucket.recordsByType[type] || [],
      };
    });
    chart.update();
  }

  function updatePcTensionChart() {
    const chart = state.charts.pcTension;
    if (!chart) return;
    const records = getFilteredRecords().filter((record) => record.bridgeType === "PC橋");
    const counts = {
      プレテン: 0,
      ポステン: 0,
      不明: 0,
    };
    const recordBuckets = {
      プレテン: [],
      ポステン: [],
      不明: [],
    };
    records.forEach((record) => {
      const key = record.pcTensionType;
      if (key && counts[key] !== undefined) {
        counts[key] += 1;
        recordBuckets[key].push(record);
      } else {
        counts.不明 += 1;
        recordBuckets.不明.push(record);
      }
    });
    chart.data.labels = PC_TENSION_SEGMENTS.map((segment) => segment.label);
    chart.data.datasets[0].data = PC_TENSION_SEGMENTS.map((segment) => counts[segment.key]);
    setChartDrilldownContext(chart, "PC橋の張力方式別構成", ({ index }) => {
      const segment = PC_TENSION_SEGMENTS[index];
      if (!segment) return null;
      return {
        bucketLabel: segment.label,
        records: recordBuckets[segment.key] || [],
      };
    });
    chart.update();
  }

  function updatePcPostChart() {
    const chart = state.charts.pcPost;
    if (!chart) return;
    const records = getFilteredRecords().filter(
      (record) => record.bridgeType === "PC橋" && record.pcTensionType === "ポステン"
    );
    const counts = Object.fromEntries(PC_POST_SEGMENTS.map((segment) => [segment.key, 0]));
    const recordBuckets = Object.fromEntries(PC_POST_SEGMENTS.map((segment) => [segment.key, []]));
    records.forEach((record) => {
      const key =
        record.pcPostCategory && counts[record.pcPostCategory] !== undefined
          ? record.pcPostCategory
          : "その他";
      counts[key] += 1;
      recordBuckets[key].push(record);
    });
    chart.data.labels = PC_POST_SEGMENTS.map((segment) => segment.label);
    chart.data.datasets[0].data = PC_POST_SEGMENTS.map((segment) => counts[segment.key]);
    setChartDrilldownContext(chart, "ポステンPC橋の形式内訳", ({ index }) => {
      const segment = PC_POST_SEGMENTS[index];
      if (!segment) return null;
      return {
        bucketLabel: segment.label,
        records: recordBuckets[segment.key] || [],
      };
    });
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

  function updateClusterControlState() {
    const available = Boolean(state.clusterLayer);
    const toggle = elements.mapClusterToggle;
    if (toggle) {
      if (!available) {
        state.cluster.enabled = false;
      }
      toggle.disabled = !available;
      toggle.checked = Boolean(state.cluster.enabled && available);
    }
    elements.clusterBlock?.classList.toggle("is-disabled", !available);
  }

  function createBaseLayers() {
    const layers = {};
    if (!window.L) return layers;
    Object.entries(BASE_LAYER_CONFIG).forEach(([key, config]) => {
      layers[key] = window.L.tileLayer(config.url, { ...(config.options || {}) });
    });
    return layers;
  }

  function getMarkerLayer(useCluster) {
    if (useCluster && state.clusterLayer) return state.clusterLayer;
    return state.mapLayer;
  }

  function setBaseLayer(layerKey) {
    state.selectedBaseLayer = layerKey;
    if (!state.map || !state.mapBaseLayers || !state.mapBaseLayers[layerKey]) return;
    if (state.activeBaseLayer && state.mapBaseLayers[state.activeBaseLayer]) {
      state.map.removeLayer(state.mapBaseLayers[state.activeBaseLayer]);
    }
    state.mapBaseLayers[layerKey].addTo(state.map);
    state.activeBaseLayer = layerKey;
    if (elements.baseLayerSelect) {
      elements.baseLayerSelect.value = layerKey;
    }
  }

  function shouldUseCluster() {
    return Boolean(state.clusterLayer && state.cluster.enabled);
  }

  function updateMap() {
    if (!state.map || (!state.mapLayer && !state.clusterLayer)) return;
    const records = getFilteredRecords();
    const withCoords = [];
    let missing = 0;
    const useCluster = shouldUseCluster();
    const targetLayer = getMarkerLayer(useCluster);
    if (!targetLayer) return;
    state.mapLayer?.clearLayers();
    state.clusterLayer?.clearLayers();
    if (state.activeMarkerLayer !== targetLayer) {
      if (state.activeMarkerLayer) {
        state.map.removeLayer(state.activeMarkerLayer);
      }
      targetLayer.addTo(state.map);
      state.activeMarkerLayer = targetLayer;
    }
    records.forEach((record) => {
      if (Number.isFinite(record.lat) && Number.isFinite(record.lng)) {
        const marker = window.L.marker([record.lat, record.lng], {
          icon: createMarkerIcon(record),
          keyboard: false,
        });
        marker.bindPopup(createPopupContent(record));
        targetLayer.addLayer(marker);
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
    state.mapBaseLayers = createBaseLayers();
    if (!state.mapBaseLayers[state.selectedBaseLayer]) {
      state.selectedBaseLayer = "standard";
    }
    if (state.mapBaseLayers[state.selectedBaseLayer]) {
      setBaseLayer(state.selectedBaseLayer);
    }
    if (window.L.control && typeof window.L.control.fullscreen === "function") {
      window.L.control.fullscreen({
        position: "topleft",
        title: "全画面表示",
        titleCancel: "全画面を終了",
      }).addTo(state.map);
    }
    state.mapLayer = window.L.layerGroup();
    state.mapLayer.addTo(state.map);
    state.activeMarkerLayer = state.mapLayer;
    if (window.L.markerClusterGroup) {
      state.clusterLayer = window.L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
      });
    } else {
      state.cluster.enabled = false;
      addLog("Leaflet.markercluster が利用できません。", "warning");
    }
    updateClusterControlState();
    state.map.on("zoomend", () => {
      updateMap();
    });
  }

  function createRecordFilterPredicate(options = {}) {
    const { skipCulvertFilter = false } = options;
    const {
      bridgeTypes,
      inspectionLevels,
      pcTension,
      pcPost,
      specYears,
      useSpecYearInference,
      builtYearMin,
      builtYearMax,
      includeUnknownBuiltYear,
      lengthMin,
      lengthMax,
      spanCountMin,
      spanCountMax,
      spanLengthMin,
      spanLengthMax,
      managementOffices,
      routeNames,
      municipalities,
      crossingTypes,
      importanceLevels,
    } = state.filters;
    const specYearFilterActive = specYears.size > 0;
    const culvertFilterEnabled = !skipCulvertFilter && state.filters.excludeCulvert;
    return (record) => {
      if (!bridgeTypes.has(record.bridgeType)) return false;
      if (record.bridgeType === "PC橋") {
        const tensionKey = resolvePcTensionKey(record.pcTensionType);
        if (!pcTension.has(tensionKey)) return false;
        if (tensionKey === "ポステン") {
          const postKey = resolvePcPostKey(record.pcPostCategory);
          if (!pcPost.has(postKey)) return false;
        }
      }
      if (!inspectionLevels.has(record.inspectionLevel)) return false;
      if (culvertFilterEnabled && record.isCulvert) return false;
      if (!managementOffices.has(getManagementOfficeLabel(record))) return false;
      if (!routeNames.has(getRouteNameLabel(record))) return false;
      if (!municipalities.has(getMunicipalityLabel(record))) return false;
      const specYearValue = getRecordSpecYearValue(record, useSpecYearInference) || SPEC_YEAR_UNKNOWN;
      if (specYearFilterActive && !specYears.has(specYearValue)) return false;
      if (!crossingTypes.has(record.crossingType)) return false;
      if (!importanceLevels.has(record.importanceLevel)) return false;
      const builtYear = record.builtYear;
      const builtYearRangeActive = builtYearMin !== null || builtYearMax !== null;
      const builtYearPasses = passesNumericRange(builtYear, builtYearMin, builtYearMax);
      if (!builtYearPasses) {
        const allowUnknownBuiltYear =
          includeUnknownBuiltYear && builtYearRangeActive && !Number.isFinite(builtYear);
        if (!allowUnknownBuiltYear) return false;
      }
      if (!passesNumericRange(record.bridgeLengthM, lengthMin, lengthMax)) return false;
      if (!passesNumericRange(record.spans, spanCountMin, spanCountMax)) return false;
      if (!passesNumericRange(record.spanLengthM, spanLengthMin, spanLengthMax)) return false;
      return true;
    };
  }

  function getFilteredRecords(options = {}) {
    const { datasetIds = null, ignoreDatasetActive = false } = options;
    const allowedDatasetIds = datasetIds ? new Set(datasetIds) : null;
    const activeDatasetIds = ignoreDatasetActive
      ? null
      : new Set(state.datasets.filter((dataset) => dataset.active).map((dataset) => dataset.id));
    const passesFilters = createRecordFilterPredicate(options);
    const records = [];
    state.datasets.forEach((dataset) => {
      if (allowedDatasetIds && !allowedDatasetIds.has(dataset.id)) return;
      if (activeDatasetIds && !activeDatasetIds.has(dataset.id)) return;
      dataset.records.forEach((record) => {
        if (passesFilters(record)) {
          records.push(record);
        }
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

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    const percentage = value * 100;
    const digits = percentage >= 10 ? 0 : 1;
    return `${percentage.toFixed(digits)}%`;
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

  function normalizeSpecYear(value) {
    const text = sanitizeText(value);
    if (!text) return null;
    const normalized = text.normalize("NFKC").replace(/\s+/g, "");
    if (!normalized) return null;
    const upper = normalized.toUpperCase();
    const hasAscii = (keyword) => upper.includes(keyword);
    const hasKanji = (keyword) => normalized.includes(keyword);
    const hasEither = (keyword) => hasAscii(keyword) || hasKanji(keyword);
    const hasHeisei = (num) => hasKanji(`平成${num}`);
    const hasShowa = (num) => hasKanji(`昭和${num}`);
    if (hasKanji("不明") || hasKanji("不詳") || hasAscii("UNKNOWN") || hasAscii("N/A")) {
      return SPEC_YEAR_UNKNOWN;
    }
    if (hasAscii("H29") || hasHeisei("29")) return "H29道示";
    if (hasAscii("H24") || hasHeisei("24")) return "H24道示";
    if (hasAscii("H14") || hasHeisei("14")) return "H14道示";
    if (hasAscii("H8") || hasHeisei("8")) return "H8道示（復旧仕様含む）";
    if (hasAscii("H2") || hasHeisei("2")) return "H2道示";
    if (hasAscii("S55") || hasShowa("55")) return "S55道示";
    const isS46 = hasAscii("S46") || hasShowa("46");
    if (
      isS46 &&
      (hasKanji("より前") || hasKanji("より以前") || hasKanji("以前") || normalized.includes("ヨリマエ"))
    ) {
      return "S46耐震設計指針より前";
    }
    if (isS46 && (hasKanji("耐震設計指針") || hasAscii("TAISHIN"))) {
      return "S46耐震設計指針";
    }
    if (hasEither("S46") && hasKanji("以前")) {
      return "S46耐震設計指針より前";
    }
    return text.trim();
  }

  function inferSpecYearFromYear(year) {
    if (!Number.isFinite(year)) return null;
    if (year < 1971) return "S46耐震設計指針より前";
    if (year < 1980) return "S46耐震設計指針";
    if (year < 1990) return "S55道示";
    if (year < 1996) return "H2道示";
    if (year < 2002) return "H8道示（復旧仕様含む）";
    if (year < 2012) return "H14道示";
    if (year < 2017) return "H24道示";
    return "H29道示";
  }

  function getRecordSpecYearValue(record, useInference) {
    if (record.specYearLabel && record.specYearLabel !== SPEC_YEAR_UNKNOWN) {
      return record.specYearLabel;
    }
    if (!useInference) {
      return record.specYearLabel || SPEC_YEAR_UNKNOWN;
    }
    if (record.specYearLabel && record.specYearLabel === SPEC_YEAR_UNKNOWN) {
      if (record.specYearInferred) return record.specYearInferred;
      return SPEC_YEAR_UNKNOWN;
    }
    if (record.specYearInferred) {
      return record.specYearInferred;
    }
    return record.specYearLabel || SPEC_YEAR_UNKNOWN;
  }

  function getManagementOfficeLabel(record) {
    return record.managementOffice?.trim() ? record.managementOffice : OFFICE_UNKNOWN_LABEL;
  }

  function getRouteNameLabel(record) {
    return record.routeName?.trim() ? record.routeName : ROUTE_UNKNOWN_LABEL;
  }

  function getMunicipalityLabel(record) {
    return record.municipalityName?.trim() ? record.municipalityName : MUNICIPALITY_UNKNOWN_LABEL;
  }

  function passesNumericRange(value, min, max) {
    if (min === null && max === null) return true;
    if (!Number.isFinite(value)) return false;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
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
