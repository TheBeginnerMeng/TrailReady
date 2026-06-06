/**
 * TrailReady 步履无忧 — 主页逻辑
 * 完整移植自 Web 版：多日路线 + 日期联动 + 装备库 CRUD + 天气模拟 + 打包推荐
 */
var dateUtils = require('../../utils/dateUtils');
var mockData = require('../../utils/mockData');
var weatherSim = require('../../utils/weatherSim');
var weatherApi = require('../../utils/weatherApi');
var recommendation = require('../../utils/recommendation');

Page({

  /* ──────────── 常量（注入 data） ──────────── */
  WEATHER_PRESET_OPTIONS: [
    { key: 'clear_warm',    label: '☀️ 晴朗温暖' },
    { key: 'clear_cool',    label: '🌤️ 晴朗凉爽' },
    { key: 'wind_cold',     label: '🌬️ 大风降温' },
    { key: 'rain_moderate', label: '🌧️ 中雨' },
    { key: 'rain_heavy',    label: '⛈️ 大雨/暴风' },
    { key: 'snow',          label: '❄️ 降雪/严寒' }
  ],

  GEAR_CATEGORY_OPTIONS: [
    { value: 'clothing',    label: '衣物层' },
    { value: 'sleeping',    label: '睡眠系统' },
    { value: 'cooking',     label: '炊具水具' },
    { value: 'electronics', label: '电子/导航' },
    { value: 'misc',        label: '其他' }
  ],

  ALL_TAGS: [
    '防风','防水','冲锋衣','硬壳','速干',
    '重保暖','轻保暖','羽绒','内衣','袜子',
    '基础层','徒步','露营','炊事','饮水',
    '导航','照明','急救','防晒','防雨',
    '燃料','路粮','旅行'
  ],

  CATEGORY_ICONS: {
    clothing:    '👕',
    sleeping:    '🏕️',
    cooking:     '🍳',
    electronics: '📡',
    misc:        '🎒'
  },

  data: {
    /* Tab */
    activeTab: 'trip',

    /* Theme */
    currentTheme: 'nature',

    /* Trip */
    startDate: '',
    totalDays: 3,
    dayPlans: [],
    tripDateRange: '',
    dateExceedsForecast: false,
    weatherLoadingIndex: -1,
    suggestions: {},
    suggestionsLoadingIndex: -1,
    destinationChain: '',
    smartLodgeHint: '',
    smartBoardText: '',

    /* Gear */
    gear: [],
    gearGrouped: [],
    gearCount: 0,
    gearWeight: 0,
    expandedCategories: {},

    /* Modal */
    modalVisible: false,
    modalClosing: false,
    editingId: '',
    formName: '',
    formCategoryIndex: 0,
    formCategoryLabel: '衣物层',
    formWeight: '',
    formTags: [],
    formError: '',

    /* Packing */
    packedItems: {},
    result: null,
    totalWeightDisplay: '0 g',
    packingGrouped: [],
    packedCount: 0,
    packedWeight: 0,
    packedPercent: 0,
    expandedPackCategories: {}
  },

  /* ================================================================ */
  /*  辅助函数（绑定在 Page 实例上）                                    */
  /* ================================================================ */

  /** 根据 startDate + totalDays 构建 dayPlan 数组 */
  _buildDayPlans: function (startDate, totalDays, existingPlans) {
    var plans = [];
    for (var i = 0; i < totalDays; i++) {
      var fd = dateUtils.formatDayDate(startDate, i);
      var old = (existingPlans && existingPlans[i]) || null;

      // 保留已有数据（模拟天气、目的地等），仅当日期变化时清除模拟天气
      var simulatedWeather = null;
      if (old && old.dateString === fd.dateString) {
        simulatedWeather = old.simulatedWeather || null;
      }

      plans.push({
        dayIndex: i + 1,
        destination: old ? old.destination : '',
        weatherPreset: old ? old.weatherPreset : 'clear_warm',
        weatherPresetIndex: old ? old.weatherPresetIndex : 0,
        dateString: fd.dateString,
        weekday: fd.weekday,
        displayDate: fd.displayDate,
        stayType: (old && old.stayType) || 'camping',
        simulatedWeather: simulatedWeather,
        fetchedWeather: null
      });
    }
    return plans;
  },

  /** 将装备按分类分组（返回数组，wx:for 可用） */
  _buildGearGrouped: function (gear, expandedMap) {
    var CATEGORY_ICONS = this.CATEGORY_ICONS;
    var map = {};
    mockData.CATEGORY_ORDER.forEach(function (cat) { map[cat] = []; });

    gear.forEach(function (item) {
      if (map[item.category]) {
        map[item.category].push(item);
      }
    });

    return mockData.CATEGORY_ORDER
      .filter(function (cat) { return map[cat].length > 0; })
      .map(function (cat) {
        var items = map[cat];
        var totalWeight = items.reduce(function (s, it) { return s + it.weight; }, 0);
        return {
          category: cat,
          icon: CATEGORY_ICONS[cat] || '📦',
          label: mockData.CATEGORY_LABELS[cat] || cat,
          items: items,
          totalWeight: totalWeight,
          expanded: expandedMap[cat] !== false // 默认展开
        };
      });
  },

  /** 将打包清单按分类分组 */
  _buildPackingGrouped: function (items, expandedMap) {
    var CATEGORY_ICONS = this.CATEGORY_ICONS;
    var map = {};
    mockData.CATEGORY_ORDER.forEach(function (cat) { map[cat] = []; });

    items.forEach(function (item) {
      if (map[item.category]) {
        map[item.category].push(item);
      }
    });

    return mockData.CATEGORY_ORDER
      .filter(function (cat) { return map[cat].length > 0; })
      .map(function (cat) {
        var catItems = map[cat];
        var catWeight = catItems.reduce(function (s, it) { return s + it.weight * it.quantity; }, 0);
        var packed = catItems.filter(function (it) { return it.packed; }).length;
        return {
          category: cat,
          icon: CATEGORY_ICONS[cat] || '📦',
          label: mockData.CATEGORY_LABELS[cat] || cat,
          items: catItems,
          catWeight: catWeight,
          total: catItems.length,
          packed: packed,
          expanded: expandedMap[cat] !== false
        };
      });
  },

  /* ================================================================ */
  /*  生命周期                                                         */
  /* ================================================================ */
  onLoad: function () {
    var gear = this._loadGear();
    var today = dateUtils.getTodayString();
    var dayPlans = this._buildDayPlans(today, 3, null);
    var dateRange = dateUtils.formatDateRange(today, 3);

    // ═══ 🎨 读取用户上次选择的主题 ═══
    var savedTheme = 'nature';
    try {
      var stored = wx.getStorageSync('user_theme');
      if (stored === 'dark' || stored === 'nature') {
        savedTheme = stored;
      }
    } catch (e) { /* 读取失败则使用默认 */ }

    this.setData({
      // 注入 WXML 模板需要的常量（来自 Page 顶层属性）
      weatherPresetOptions: this.WEATHER_PRESET_OPTIONS,
      allTags: this.ALL_TAGS,
      gearCategoryOptions: this.GEAR_CATEGORY_OPTIONS,

      startDate: today,
      dayPlans: dayPlans,
      tripDateRange: dateRange,
      gear: gear,
      gearGrouped: this._buildGearGrouped(gear, {}),
      gearCount: gear.length,
      gearWeight: gear.reduce(function (s, it) { return s + it.weight; }, 0),
      currentTheme: savedTheme
    });

    this._recompute();

    // ═══ 🔬 和风天气 API 通道测试（后台静默，仅输出控制台） ═══
    weatherApi.testChannel().catch(function () { });
  },

  /* ================================================================ */
  /*  📋 行程 — 日期 & 天数                                            */
  /* ================================================================ */
  onStartDateChange: function (e) {
    var newStart = e.detail.value;

    // ═══ 日期边界校验：出发日不得超过未来 30 天 ═══
    if (this._checkDateBoundary(newStart)) {
      wx.showToast({
        title: '气象站看不清那么远，请选择30天内的行程哦~',
        icon: 'none',
        duration: 2500
      });
      var today = dateUtils.getTodayString();
      var resetPlans = this._buildDayPlans(today, this.data.totalDays, this.data.dayPlans);
      var resetRange = dateUtils.formatDateRange(today, resetPlans.length);

      this.setData({
        startDate: today,
        dayPlans: resetPlans,
        tripDateRange: resetRange,
        dateExceedsForecast: false
      });
      this._recompute();
      return;
    }

    var dayPlans = this._buildDayPlans(newStart, this.data.totalDays, this.data.dayPlans);
    var dateRange = dateUtils.formatDateRange(newStart, dayPlans.length);
    var isExceeding = this._updateForecastWarning(newStart, this.data.totalDays);

    this.setData({
      startDate: newStart,
      dayPlans: dayPlans,
      tripDateRange: dateRange,
      dateExceedsForecast: isExceeding
    });
    this._recompute();
  },

  onDaysMinus: function () {
    if (this.data.totalDays <= 1) return;
    this._setTotalDays(this.data.totalDays - 1);
  },

  onDaysPlus: function () {
    if (this.data.totalDays >= weatherApi.MAX_FORECAST_DAYS) return;
    this._setTotalDays(this.data.totalDays + 1);
  },

  onDaysInput: function (e) {
    var v = parseInt(e.detail.value);
    if (!isNaN(v)) this._setTotalDays(Math.max(1, v));
  },

  _setTotalDays: function (total) {
    // ═══ 30 天硬边界：超出部分安全降级 ═══
    if (total > weatherApi.MAX_FORECAST_DAYS) {
      total = weatherApi.MAX_FORECAST_DAYS;
      wx.showModal({
        title: '🏔️ 气象站尽力了',
        content: '由于现代气象雷达的科学极限，系统目前最多仅能为您预报【未来 30 天内】的天气。已自动为您截取前 30 天的行程进行装备匹配，超出部分将参考经典气候推荐。',
        showCancel: false,
        confirmText: '好的'
      });
    }

    var dayPlans = this._buildDayPlans(this.data.startDate, total, this.data.dayPlans);
    var dateRange = dateUtils.formatDateRange(this.data.startDate, total);
    var isExceeding = this._updateForecastWarning(this.data.startDate, total);

    this.setData({
      totalDays: total,
      dayPlans: dayPlans,
      tripDateRange: dateRange,
      dateExceedsForecast: isExceeding
    });
    this._recompute();
  },

  /**
   * 严格阻断：出发日期是否超过未来 30 天
   * @returns {boolean}
   */
  _checkDateBoundary: function (startDate) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var maxDate = new Date(today.getTime() + weatherApi.MAX_FORECAST_DAYS * 24 * 60 * 60 * 1000);
    var selected = new Date(startDate + 'T00:00:00');
    return selected > maxDate;
  },

  /**
   * 动态更新预报警告状态：行程中任一天超过未来 30 天即触发
   * @returns {boolean}
   */
  _updateForecastWarning: function (startDate, totalDays) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var maxDate = new Date(today.getTime() + weatherApi.MAX_FORECAST_DAYS * 24 * 60 * 60 * 1000);

    var start = new Date(startDate + 'T00:00:00');
    if (start > maxDate) return true;

    var end = new Date(startDate + 'T00:00:00');
    end.setDate(end.getDate() + totalDays - 1);
    return end > maxDate;
  },

  /* ================================================================ */
  /*  📋 行程 — 按天住宿方式                                            */
  /* ================================================================ */
  onStayTypeToggle: function (e) {
    var index = e.currentTarget.dataset.index;
    var type = e.currentTarget.dataset.type;
    var updateData = {};
    updateData['dayPlans[' + index + '].stayType'] = type;
    this.setData(updateData);
    this._recompute();
  },

  /* ================================================================ */
  /*  📋 行程 — 目的地 & 天气                                           */
  /* ================================================================ */

  // 防抖定时器引用（页面级，不参与 setData）
  _citySearchTimer: null,
  _activeCityIndex: -1,
  _dropdownVisibleForMask: false,

  onDestinationInput: function (e) {
    var index = e.currentTarget.dataset.index;
    var value = e.detail.value;
    var key = 'dayPlans[' + index + '].destination';
    var updateData = {};
    updateData[key] = value;
    // 手动编辑即清除缓存的精准坐标 & ID，后续走文本查询
    updateData['dayPlans[' + index + ']._locationLngLat'] = '';
    updateData['dayPlans[' + index + ']._locationId'] = '';
    this.setData(updateData);

    // 清空输入 → 隐藏联想
    if (!value || !value.trim()) {
      this.setData({
        ['suggestions[' + index + ']']: null,
        suggestionsLoadingIndex: -1
      });
      this._updateMaskVisibility();
      return;
    }

    // 300ms 防抖联想搜索
    this._searchCitiesDebounced(index, value.trim());
  },

  onDestinationFocus: function (e) {
    var index = e.currentTarget.dataset.index;
    this._activeCityIndex = index;
    // 如果当前输入已有关键词且有缓存结果，直接展示
    var day = this.data.dayPlans[index];
    if (day && day.destination && day.destination.trim()) {
      this._searchCitiesDebounced(index, day.destination.trim());
    }
  },

  /** 300ms 防抖联想搜索 */
  _searchCitiesDebounced: function (index, query) {
    var self = this;
    if (this._citySearchTimer) clearTimeout(this._citySearchTimer);

    this._citySearchTimer = setTimeout(function () {
      self.setData({ suggestionsLoadingIndex: index });

      weatherApi.searchCities(query).then(function (cities) {
        // 防止过期响应覆盖新输入
        var currentVal = (self.data.dayPlans[index] || {}).destination || '';
        if (currentVal.trim() !== query) return;

        var updateData = {};
        updateData['suggestions[' + index + ']'] = cities;
        updateData['suggestionsLoadingIndex'] = -1;
        self.setData(updateData);
        self._updateMaskVisibility();
      }).catch(function () {
        self.setData({
          ['suggestions[' + index + ']']: [],
          suggestionsLoadingIndex: -1
        });
        self._updateMaskVisibility();
      });
    }, 300);
  },

  /** 更新透明遮罩可见性：任一天有下拉即展示 */
  _updateMaskVisibility: function () {
    var hasDropdown = false;
    var suggestions = this.data.suggestions;
    if (suggestions) {
      // suggestions 是 sparse array，遍历 dayPlans 索引
      for (var i = 0; i < this.data.dayPlans.length; i++) {
        if (suggestions[i] && suggestions[i].length > 0) {
          hasDropdown = true;
          break;
        }
      }
    }
    if (this._dropdownVisibleForMask !== hasDropdown) {
      this._dropdownVisibleForMask = hasDropdown;
      this.setData({ suggestionMaskVisible: hasDropdown });
    }
  },

  /** 点击遮罩层 → 仅隐藏全部下拉，不触发任何查询 */
  hideAllSuggestions: function () {
    var updateData = { suggestionMaskVisible: false };
    this._dropdownVisibleForMask = false;
    this.data.dayPlans.forEach(function (_, i) {
      updateData['suggestions[' + i + ']'] = null;
    });
    updateData['suggestionsLoadingIndex'] = -1;
    this.setData(updateData);
    this._activeCityIndex = -1;
  },

  /** 点击联想项 — 选中 POI 并触发天气查询（地图经纬度优先） */
  onSelectCity: function (e) {
    var index = e.currentTarget.dataset.dayIndex;
    var city = e.currentTarget.dataset.city;

    if (!city || !city.name) return;

    // ⏳ 立即展示 Loading（用户明确点选，体验完全合理）
    wx.showLoading({ title: '正在气象站连线...', mask: true });

    // 填入 POI 名称 + 存入经纬度（lng,lat 格式给和风天气用）
    var updateData = {};
    updateData['dayPlans[' + index + '].destination'] = city.name;
    updateData['dayPlans[' + index + ']._locationLngLat'] = (city.lng && city.lat)
      ? city.lng + ',' + city.lat
      : '';
    updateData['dayPlans[' + index + ']._locationId'] = city.id || '';
    updateData['suggestions[' + index + ']'] = null;
    updateData['suggestionsLoadingIndex'] = -1;
    updateData['weatherLoadingIndex'] = index;
    this.setData(updateData);
    this._updateMaskVisibility();

    // 触发天气查询
    this._fetchWeatherForIndex(index, city.name);
  },

  /**
   * ═══════════════════════════════════════
   *  🛡️ 失焦 — 已废除掩藏下拉逻辑
   * ═══════════════════════════════════════
   * 下拉列表的关闭现在由全屏透明遮罩层接管：
   *   点击选项 → catchtap 选中并自动收起
   *   点击其他区域 → 遮罩层捕获并关闭
   * bindblur 已从 input 上移除，此函数仅留作占位，
   * 防止旧代码引用报错，不做任何实际操作。
   */
  onDestinationBlur: function () {
    // 键盘收起时不做任何下拉隐藏操作
  },

  /** 统一天气查询入口 — 包裹 Loading 提示，优先走地图经纬度通道 */
  _fetchWeatherForIndex: function (index, destination) {
    var self = this;
    var dateStrings = this.data.dayPlans.map(function (d) { return d.dateString; });
    var day = this.data.dayPlans[index];

    wx.showLoading({ title: '正在气象站连线...', mask: true });

    // 优先级：地图经纬度 > 和风 Location ID > 文本模糊查询
    var latLng = day._locationLngLat;
    var locationId = day._locationId;
    var weatherPromise;
    if (latLng) {
      // 腾讯地图 POI → 经纬度直查和风天气（最精准，内置最近气象站定位）
      weatherPromise = weatherApi.fetchTripWeatherByLatLng(latLng, destination, dateStrings);
    } else if (locationId) {
      weatherPromise = weatherApi.fetchTripWeatherById(locationId, destination, dateStrings);
    } else {
      weatherPromise = weatherApi.fetchTripWeather(destination, dateStrings);
    }

    weatherPromise.then(function (weatherMap) {
      wx.hideLoading();
      var updateData = { weatherLoadingIndex: -1 };
      // 只更新被查询的那一天，不动其他天
      // 旧逻辑遍历所有 dayPlans，会把 Day1/Day2 的天气也覆盖成当前查询城市的天气
      var queriedDateString = self.data.dayPlans[index].dateString;
      var w = weatherMap[queriedDateString];
      if (w) {
        updateData['dayPlans[' + index + '].simulatedWeather'] = w;
      }
      self.setData(updateData);
      self._recompute();
    }).catch(function (err) {
      wx.hideLoading();
      var errDetail = err && err.message ? err.message : String(err);
      console.warn('【天气加载】真实 API 失败:', errDetail);

      // ═══════════════════════════════════════════
      //  █ 分支 A｜地点找不到 → 强行阻断，不降级
      // ═══════════════════════════════════════════
      if (err && err.isLocationNotFound) {
        wx.showModal({
          title: '🗺️ 目的地输入有误',
          content: '气象站找不到您输入的城市或景区名称。请检查是否有错别字，或尝试输入更知名的主县城/核心景区名（如输入「迪庆」或「香格里拉」）。',
          showCancel: false,
          confirmText: '知晓'
        });
        var clearData = { weatherLoadingIndex: -1 };
        clearData['dayPlans[' + index + '].destination'] = '';
        self.setData(clearData);
        self._recompute();
        return;
      }

      // ═══════════════════════════════════════════
      //  █ 分支 B｜真正网络故障 → 允许模拟兜底
      // ═══════════════════════════════════════════
      if (err && err.isNetworkError) {
        wx.showToast({
          title: '信号进入无人区，已切换为模拟数据',
          icon: 'none',
          duration: 2500
        });
        weatherSim.simulateWeather(day.dateString).then(function (weather) {
          var updateData = {};
          updateData['dayPlans[' + index + '].simulatedWeather'] = weather;
          updateData['weatherLoadingIndex'] = -1;
          self.setData(updateData);
          self._recompute();
        });
        return;
      }

      // ═══════════════════════════════════════════
      //  █ 分支 C｜其他业务错误 → 阻断，保持界面稳定
      // ═══════════════════════════════════════════
      self.setData({ weatherLoadingIndex: -1 });
    });
  },

  onWeatherPresetChange: function (e) {
    var index = e.currentTarget.dataset.index;
    var presetIndex = parseInt(e.detail.value);
    var presetKey = this.WEATHER_PRESET_OPTIONS[presetIndex].key;

    var updateData = {};
    updateData['dayPlans[' + index + '].weatherPreset'] = presetKey;
    updateData['dayPlans[' + index + '].weatherPresetIndex'] = presetIndex;
    updateData['dayPlans[' + index + '].simulatedWeather'] = null;
    this.setData(updateData);
    this._recompute();
  },

  /* ================================================================ */
  /*  🎒 装备 — CRUD                                                    */
  /* ================================================================ */
  onTapAddGear: function () {
    this.setData({
      modalVisible: true,
      modalClosing: false,
      editingId: '',
      formName: '',
      formCategoryIndex: 0,
      formCategoryLabel: '衣物层',
      formWeight: '',
      formTags: [],
      formError: ''
    });
  },

  onTapEditGear: function (e) {
    var id = e.currentTarget.dataset.id;
    var item = null;
    var gear = this.data.gear;
    for (var i = 0; i < gear.length; i++) {
      if (gear[i].id === id) { item = gear[i]; break; }
    }
    if (!item) return;

    var catOpts = this.GEAR_CATEGORY_OPTIONS;
    var catIndex = 0;
    for (var j = 0; j < catOpts.length; j++) {
      if (catOpts[j].value === item.category) { catIndex = j; break; }
    }

    this.setData({
      modalVisible: true,
      modalClosing: false,
      editingId: id,
      formName: item.name,
      formCategoryIndex: catIndex,
      formCategoryLabel: catOpts[catIndex].label,
      formWeight: String(item.weight),
      formTags: item.tags && item.tags.slice ? item.tags.slice() : [],
      formError: ''
    });
  },

  closeModal: function () {
    var self = this;
    this.setData({ modalClosing: true });
    setTimeout(function () {
      self.setData({
        modalVisible: false,
        modalClosing: false,
        editingId: '',
        formError: ''
      });
    }, 200);
  },

  onFormNameInput: function (e) {
    this.setData({ formName: e.detail.value, formError: '' });
  },

  onFormCategoryChange: function (e) {
    var idx = parseInt(e.detail.value);
    var catOpts = this.GEAR_CATEGORY_OPTIONS;
    this.setData({
      formCategoryIndex: idx,
      formCategoryLabel: catOpts[idx].label,
      formError: ''
    });
  },

  onFormWeightInput: function (e) {
    this.setData({ formWeight: e.detail.value, formError: '' });
  },

  onToggleTag: function (e) {
    var tag = e.currentTarget.dataset.tag;
    if (!tag) return;

    var formTags = this.data.formTags || [];
    formTags = formTags.slice();

    var idx = -1;
    for (var i = 0; i < formTags.length; i++) {
      if (formTags[i] === tag) {
        idx = i;
        break;
      }
    }

    if (idx >= 0) {
      // 已选中 → 移除（反选）
      formTags.splice(idx, 1);
    } else {
      // 未选中 → 添加
      formTags.push(tag);
    }

    this.setData({
      formTags: formTags,
      formError: ''
    });
  },

  onSaveGear: function () {
    var name = (this.data.formName || '').trim();
    var weight = parseInt(this.data.formWeight);
    var catOpts = this.GEAR_CATEGORY_OPTIONS;
    var category = catOpts[this.data.formCategoryIndex].value;
    var tags = this.data.formTags;
    // 防御：确保 tags 始终是纯数组
    if (!Array.isArray(tags)) {
      tags = [];
    }

    // 校验
    if (!name) {
      this.setData({ formError: '请输入装备名称' });
      return;
    }
    if (!this.data.formWeight || isNaN(weight) || weight <= 0) {
      this.setData({ formError: '请输入有效的重量（大于 0）' });
      return;
    }

    var gear = this.data.gear.slice();

    if (this.data.editingId) {
      // 编辑
      for (var i = 0; i < gear.length; i++) {
        if (gear[i].id === this.data.editingId) {
          gear[i] = {
            id: gear[i].id,
            name: name,
            weight: weight,
            category: category,
            tags: tags
          };
          break;
        }
      }
    } else {
      // 新增
      gear.push({
        id: String(Date.now()),
        name: name,
        weight: weight,
        category: category,
        tags: tags
      });
    }

    this._persistGear(gear);
    this._updateGearData(gear);
    this._recompute();
    this.closeModal();
  },

  onDeleteGear: function (e) {
    var id = e.currentTarget.dataset.id;
    var item = null;
    var gear = this.data.gear;
    for (var i = 0; i < gear.length; i++) {
      if (gear[i].id === id) { item = gear[i]; break; }
    }

    var self = this;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除装备「' + (item ? item.name : '') + '」吗？\n此操作不可撤销，打包清单将实时联动更新。',
      confirmColor: self.data.currentTheme === 'dark' ? '#FF5252' : '#D94F4F',
      success: function (res) {
        if (res.confirm) {
          var newGear = self.data.gear.filter(function (g) { return g.id !== id; });
          self._persistGear(newGear);
          self._updateGearData(newGear);
          self._recompute();
        }
      }
    });
  },

  /* ================================================================ */
  /*  ✅ 打包 — 交互                                                    */
  /* ================================================================ */
  onTogglePacked: function (e) {
    var id = e.currentTarget.dataset.id;
    var packedItems = Object.assign({}, this.data.packedItems);
    if (packedItems[id]) {
      delete packedItems[id];
    } else {
      packedItems[id] = true;
    }
    this.setData({ packedItems: packedItems });
    this._updatePackingStats();
  },

  /* ================================================================ */
  /*  折叠/展开                                                        */
  /* ================================================================ */
  onToggleCategory: function (e) {
    var cat = e.currentTarget.dataset.cat;
    var expanded = Object.assign({}, this.data.expandedCategories);
    expanded[cat] = expanded[cat] === false;
    this.setData({
      expandedCategories: expanded,
      gearGrouped: this._buildGearGrouped(this.data.gear, expanded)
    });
  },

  onTogglePackCategory: function (e) {
    var cat = e.currentTarget.dataset.cat;
    var expanded = Object.assign({}, this.data.expandedPackCategories);
    expanded[cat] = expanded[cat] === false;
    this.setData({
      expandedPackCategories: expanded,
      packingGrouped: this._buildPackingGrouped(
        (this.data.result && this.data.result.items) || [],
        expanded
      )
    });
  },

  /* ================================================================ */
  /*  标签切换                                                        */
  /* ================================================================ */
  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    // 切换到打包标签时刷新统计
    if (tab === 'packing') {
      this._updatePackingStats();
    }
    // 切换到装备标签时刷新分组
    if (tab === 'gear') {
      this.setData({
        gearGrouped: this._buildGearGrouped(this.data.gear, this.data.expandedCategories),
        gearCount: this.data.gear.length,
        gearWeight: this.data.gear.reduce(function (s, it) { return s + it.weight; }, 0)
      });
    }
  },

  /* ================================================================ */
  /*  🎨 主题切换                                                      */
  /* ================================================================ */
  onToggleTheme: function () {
    var newTheme = this.data.currentTheme === 'dark' ? 'nature' : 'dark';
    this.setData({ currentTheme: newTheme });
    // 持久化到本地存储，下次打开依然是你喜欢的风格
    try {
      wx.setStorageSync('user_theme', newTheme);
    } catch (e) {
      console.warn('主题偏好保存失败', e);
    }
    // 切换时给予轻柔的触感反馈
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  /* ================================================================ */
  /*  内部方法                                                         */
  /* ================================================================ */

  /** 重新运行推荐引擎 */
  _recompute: function () {
    var tripData = {
      dayPlans: this.data.dayPlans,
      startDate: this.data.startDate
    };

    // 是否有任何目的地
    var hasDest = tripData.dayPlans.some(function (d) { return d.destination && d.destination.trim(); });

    var result = null;
    if (hasDest && this.data.gear.length > 0) {
      result = recommendation.generateMultiDayPackingList(tripData, this.data.gear);
    }

    // 注入 packed 状态
    var packedItems = this.data.packedItems;
    if (result && result.items) {
      result.items.forEach(function (item) {
        item.packed = !!packedItems[item.id];
      });
    }

    // 目的地链
    var chain = tripData.dayPlans
      .filter(function (d) { return d.destination && d.destination.trim(); })
      .map(function (d) { return d.destination.trim(); })
      .join(' → ');

    // 智能宿营看板
    var dayPlans = this.data.dayPlans;
    var campingDays = dayPlans.filter(function (d) { return d.stayType === 'camping'; }).length;
    var hotelDays = dayPlans.length - campingDays;

    var smartLodgeHint = '';
    if (campingDays === 0) {
      smartLodgeHint = '🏨 全程旅馆';
    } else if (hotelDays === 0) {
      smartLodgeHint = '⛺ 全程扎营（' + campingDays + '天）';
    } else {
      smartLodgeHint = '🔀 混合 · ' + campingDays + '天扎营 + ' + hotelDays + '天旅馆';
    }

    var smartBoardText = '';
    if (hasDest) {
      if (campingDays > 0 && hotelDays > 0) {
        smartBoardText = '检测到您有 ' + campingDays + ' 天需要野外扎营，已自动为您备齐露营重装。其余 ' + hotelDays + ' 天旅馆住宿日建议在民宿补充路粮。';
      } else if (campingDays === 0) {
        smartBoardText = '全程住店，已为您极限减负！';
      }
    }

    var totalWeightDisplay = result
      ? recommendation.formatWeight(result.totalWeight)
      : '0 g';

    var packingGrouped = result
      ? this._buildPackingGrouped(result.items, this.data.expandedPackCategories)
      : [];

    this.setData({
      result: result,
      totalWeightDisplay: totalWeightDisplay,
      packingGrouped: packingGrouped,
      destinationChain: chain,
      smartLodgeHint: smartLodgeHint,
      smartBoardText: smartBoardText
    });

    this._updatePackingStats();
  },

  /** 更新打包统计 */
  _updatePackingStats: function () {
    var result = this.data.result;
    if (!result || !result.items) {
      this.setData({ packedCount: 0, packedWeight: 0, packedPercent: 0 });
      return;
    }

    var packedCount = 0;
    var packedWeight = 0;
    result.items.forEach(function (item) {
      if (item.packed) {
        packedCount++;
        packedWeight += item.weight * item.quantity;
      }
    });

    var totalItems = result.items.length;
    var percent = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;

    this.setData({
      packedCount: packedCount,
      packedWeight: packedWeight,
      packedPercent: percent
    });
  },

  /** 更新装备数据并刷新分组显示 */
  _updateGearData: function (gear) {
    this.setData({
      gear: gear,
      gearGrouped: this._buildGearGrouped(gear, this.data.expandedCategories),
      gearCount: gear.length,
      gearWeight: gear.reduce(function (s, it) { return s + it.weight; }, 0)
    });
  },

  /** 从本地缓存加载装备 */
  _loadGear: function () {
    try {
      var raw = wx.getStorageSync('trail_gear_closet');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // 数据损坏 → 回退到默认
    }
    // 保存默认数据到缓存
    var defaults = mockData.DEFAULT_GEAR;
    try { wx.setStorageSync('trail_gear_closet', JSON.stringify(defaults)); } catch (e) {}
    return defaults;
  },

  /** 持久化装备到本地缓存 */
  _persistGear: function (gear) {
    try {
      wx.setStorageSync('trail_gear_closet', JSON.stringify(gear));
    } catch (e) {
      console.warn('装备数据保存失败', e);
    }
  },

  /** 空操作 — 阻止冒泡 */
  noop: function () {}
});
