/**
 * 打包清单推荐引擎 — 完整移植自 Web 版
 * 输入：tripData (multi-day plans + lodging mode) + gearCloset (装备数组)
 * 输出：{ items, warnings, totalWeight, infoMessages, climateSummary }
 */
var WEATHER_PRESETS = require('./mockData.js').WEATHER_PRESETS;

function getDayWeather(day) {
  var weather = day.fetchedWeather || day.simulatedWeather;
  if (weather) {
    return {
      tempMin: weather.tempMin,
      tempMax: weather.tempMax,
      conditions: weather.conditions
    };
  }
  var preset = WEATHER_PRESETS[day.weatherPreset];
  var parts = preset.tempRange.replace('°C', '').split('~');
  return {
    tempMin: parseInt(parts[0]) || 15,
    tempMax: parseInt(parts[1]) || 25,
    conditions: preset.conditions
  };
}

function generateMultiDayPackingList(tripData, gearCloset) {
  var dayPlans = tripData.dayPlans;
  var N = dayPlans.length;

  // 按天聚合：计算扎营天数与全旅馆判定
  var hasCamping = dayPlans.some(function (d) { return d.stayType === 'camping'; });
  var allHotel = dayPlans.every(function (d) { return d.stayType === 'hotel'; });
  var campingDays = dayPlans.filter(function (d) { return d.stayType === 'camping'; }).length;
  var hotelDays = N - campingDays;

  var warnings = [];
  var infoMessages = [];

  // ---- 1. Aggregate weather ----
  var allDaysWeather = dayPlans.map(function (d) { return getDayWeather(d); });
  var minTemp = Math.min.apply(null, allDaysWeather.map(function (w) { return w.tempMin; }));
  var maxTemp = Math.max.apply(null, allDaysWeather.map(function (w) { return w.tempMax; }));
  var tempSpread = maxTemp - minTemp;

  var rainyDays = [];
  var windyDays = [];
  var snowyDays = [];
  var coldDays = [];

  for (var i = 0; i < allDaysWeather.length; i++) {
    var w = allDaysWeather[i];
    var dayNum = i + 1;
    if (w.conditions.indexOf('降水') >= 0 || w.conditions.indexOf('潮湿') >= 0) rainyDays.push(dayNum);
    if (w.conditions.indexOf('降雪') >= 0) snowyDays.push(dayNum);
    if (w.conditions.indexOf('大风') >= 0) windyDays.push(dayNum);
    if (w.conditions.indexOf('严寒') >= 0 || w.conditions.indexOf('降温') >= 0 || w.tempMin < 5) coldDays.push(dayNum);
  }

  var allConditions = {};
  allDaysWeather.forEach(function (w) { w.conditions.forEach(function (c) { allConditions[c] = true; }); });
  var condKeys = Object.keys(allConditions);

  var hasPrecipitation = condKeys.indexOf('降水') >= 0 || condKeys.indexOf('降雪') >= 0 || condKeys.indexOf('潮湿') >= 0;
  var hasSnow = condKeys.indexOf('降雪') >= 0;
  var hasWind = condKeys.indexOf('大风') >= 0;
  var isAnyCold = condKeys.indexOf('严寒') >= 0 || condKeys.indexOf('降温') >= 0 || minTemp < 8;
  var isSevereCold = minTemp < 5;
  var isBelowZero = minTemp < 0;

  var challenges = [];
  if (rainyDays.length > 0) challenges.push('Day ' + rainyDays.join(', ') + ' 有降水，注意防潮与防水');
  if (snowyDays.length > 0) challenges.push('Day ' + snowyDays.join(', ') + ' 有降雪，注意防寒与湿滑路面');
  if (windyDays.length > 0) challenges.push('Day ' + windyDays.join(', ') + ' 有大风，确保防风层完备');
  if (tempSpread >= 15) challenges.push('全程温差达 ' + tempSpread + '°C（' + minTemp + '~' + maxTemp + '°C），建议分层穿搭');

  var climateSummary = {
    minTemp: minTemp, maxTemp: maxTemp, tempSpread: tempSpread,
    rainyDays: rainyDays, windyDays: windyDays, snowyDays: snowyDays, coldDays: coldDays,
    challenges: challenges
  };

  // ---- 2. Build packing items ----
  var packingMap = {};

  function addItem(gear, quantity, reason) {
    if (packingMap[gear.id]) {
      var existing = packingMap[gear.id];
      existing.quantity = Math.max(existing.quantity, quantity);
      if (reason && existing.reason && existing.reason.indexOf(reason) < 0) {
        existing.reason = existing.reason + '；' + reason;
      } else if (reason && !existing.reason) {
        existing.reason = reason;
      }
      return;
    }
    packingMap[gear.id] = {
      id: gear.id, name: gear.name, weight: gear.weight,
      category: gear.category, tags: gear.tags,
      packed: false, quantity: quantity, reason: reason
    };
  }

  // 2a. Core categories (always needed)
  for (var j = 0; j < gearCloset.length; j++) {
    var gear = gearCloset[j];
    if (gear.category === 'electronics' || gear.category === 'misc') {
      addItem(gear, 1, '核心装备');
    }
  }

  // 2b. Clothing logic
  for (var k = 0; k < gearCloset.length; k++) {
    var g = gearCloset[k];
    if (g.category !== 'clothing') continue;
    var tags = g.tags;

    if (tags.indexOf('内衣') >= 0 || tags.indexOf('基础层') >= 0) {
      var qty = Math.min(3, Math.ceil(N / 2));
      addItem(g, qty, '行程' + N + '天，建议' + qty + '件换洗');
    }
    if (tags.indexOf('袜子') >= 0) {
      var sqty = Math.max(1, Math.min(N + 1, 5));
      addItem(g, sqty, '行程' + N + '天，建议' + sqty + '双');
    }
    if (hasPrecipitation && (tags.indexOf('防水') >= 0 || tags.indexOf('冲锋衣') >= 0 || tags.indexOf('硬壳') >= 0 || tags.indexOf('防风') >= 0)) {
      addItem(g, 1, '检测到降水日，已强制加入防水层');
      if (warnings.indexOf('检测到降水，已强制加入防水层') < 0) warnings.push('检测到降水，已强制加入防水层');
    }
    if (isSevereCold && (tags.indexOf('重保暖') >= 0 || tags.indexOf('羽绒') >= 0)) {
      addItem(g, 1, '行程最低温' + minTemp + '°C < 5°C，强制加入重度保暖层');
    } else if (isAnyCold && !isSevereCold && tags.indexOf('轻保暖') >= 0) {
      addItem(g, 1, '行程有降温天，建议加入轻度保暖层');
    }
    if (tags.indexOf('速干') >= 0 && tags.indexOf('徒步') >= 0) {
      addItem(g, 1, '徒步基础装备');
    }
  }

  // 2c. Rain cover
  if (hasPrecipitation) {
    for (var m = 0; m < gearCloset.length; m++) {
      var rg = gearCloset[m];
      if (rg.tags.indexOf('防雨') >= 0 && rg.category === 'misc') {
        addItem(rg, 1, '检测到降水日，已加入背包防雨罩');
      }
    }
  }

  // 2d. Sunscreen if warm
  if (maxTemp > 20) {
    for (var n = 0; n < gearCloset.length; n++) {
      var sg = gearCloset[n];
      if (sg.tags.indexOf('防晒') >= 0 && sg.category === 'misc') {
        addItem(sg, 1, '气温较高，建议防晒');
      }
    }
  }

  // ---- 3. Lodging logic (per-day stayType) ----
  if (hasCamping) {
    // 至少有一天扎营 → 加入全套睡眠系统 + 炊事装备
    for (var a = 0; a < gearCloset.length; a++) {
      var cg = gearCloset[a];
      if (cg.category === 'sleeping') {
        var reason = '野外扎营（' + campingDays + '天）— 必需装备';
        if (isBelowZero && cg.tags.indexOf('羽绒') >= 0) {
          reason = '野外扎营 — 最低温' + minTemp + '°C < 0°C，请确认睡袋温标满足需求';
          if (warnings.indexOf('⚠️ 气温低于0°C，请检查睡袋舒适温标') < 0) {
            warnings.push('⚠️ 气温低于0°C，请检查睡袋舒适温标是否匹配当前环境');
          }
        }
        addItem(cg, 1, reason);
      }
      if (cg.category === 'cooking') {
        addItem(cg, 1, '野外扎营 — 必需装备');
      }
    }

    // 完整性检查
    var hasTent = false, hasSleepingBag = false, hasStove = false;
    Object.keys(packingMap).forEach(function (id) {
      var item = packingMap[id];
      if (item.category === 'sleeping' && item.tags.indexOf('露营') >= 0) hasTent = true;
      if (item.category === 'sleeping' && (item.tags.indexOf('羽绒') >= 0 || item.tags.indexOf('重保暖') >= 0)) hasSleepingBag = true;
      if (item.category === 'cooking' && item.tags.indexOf('炊事') >= 0) hasStove = true;
    });
    if (!hasTent) warnings.push('⚠️ 野外露宿需要帐篷/庇护所，装备库中未检测到帐篷类装备');
    if (!hasSleepingBag) warnings.push('⚠️ 野外露宿需要睡袋，装备库中未检测到睡袋类装备');
    if (!hasStove) warnings.push('⚠️ 野外露宿需要炊具，装备库中未检测到炉具类装备');

    // 消耗品：路粮数量 = 扎营天数
    for (var c = 0; c < gearCloset.length; c++) {
      var lg = gearCloset[c];
      if (lg.tags.indexOf('路粮') >= 0) {
        addItem(lg, campingDays, '野外扎营 ' + campingDays + ' 天，需 ' + campingDays + ' 份路粮');
      }
      if (lg.tags.indexOf('燃料') >= 0) {
        var gasQty = Math.max(1, campingDays);
        addItem(lg, gasQty, '野外扎营 ' + campingDays + ' 天，建议 ' + gasQty + ' 罐气罐');
      }
    }

    if (campingDays > 3) {
      warnings.push('🔥 长途荒野（扎营 ' + campingDays + ' 天），请带足路粮与燃料');
    }
    if (hotelDays > 0) {
      infoMessages.push('检测到您有 ' + campingDays + ' 天需要野外扎营，已自动为您备齐露营重装。其余 ' + hotelDays + ' 天旅馆住宿日建议在民宿补充路粮。');
    }
  }

  if (allHotel) {
    // 全旅馆模式：剔除睡眠与炊事重装
    Object.keys(packingMap).forEach(function (id) {
      var item = packingMap[id];
      if (item.category === 'sleeping' || item.category === 'cooking') delete packingMap[id];
    });
    // 加入旅行物品
    for (var d = 0; d < gearCloset.length; d++) {
      var hg = gearCloset[d];
      if (hg.tags.indexOf('旅行') >= 0) addItem(hg, 1, '住旅馆 — 旅行常备物品');
    }
    infoMessages.push('全程住店，已为您极限减负！');
  }

  // ---- 4. Validation ----
  if (hasPrecipitation) {
    var hasWaterproof = false;
    Object.keys(packingMap).forEach(function (id) {
      var item = packingMap[id];
      if (item.tags.indexOf('防水') >= 0 || item.tags.indexOf('冲锋衣') >= 0 || item.tags.indexOf('硬壳') >= 0) hasWaterproof = true;
    });
    if (!hasWaterproof) warnings.push('⚠️ 装备库中缺少防水冲锋衣，请补充！');
  }
  if (isSevereCold) {
    var hasWarm = false;
    Object.keys(packingMap).forEach(function (id) {
      var item = packingMap[id];
      if (item.tags.indexOf('重保暖') >= 0 || item.tags.indexOf('羽绒') >= 0) hasWarm = true;
    });
    if (!hasWarm) warnings.push('⚠️ 装备库中缺少保暖衣物，请补充！');
  }
  if (hasSnow) warnings.push('⚠️ 预计有降雪天气，请携带冰爪与雪地装备');
  if (hasWind) warnings.push('⚠️ 预计有大风天气，确保防风层完备');
  if (minTemp < 5 && allHotel) {
    infoMessages.push('提示：部分日子最低温仅 ' + minTemp + '°C，虽是旅馆出行也建议带一件保暖外套。');
  }

  var items = Object.keys(packingMap).map(function (id) { return packingMap[id]; });
  var totalWeight = items.reduce(function (s, it) { return s + it.weight * it.quantity; }, 0);

  return { items: items, warnings: warnings, totalWeight: totalWeight, infoMessages: infoMessages, climateSummary: climateSummary };
}

function formatWeight(grams) {
  if (grams >= 1000) return (grams / 1000).toFixed(1) + ' kg';
  return grams + ' g';
}

module.exports = {
  generateMultiDayPackingList: generateMultiDayPackingList,
  formatWeight: formatWeight
};
