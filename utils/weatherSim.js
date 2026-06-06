/**
 * 天气模拟 — 6 种随机天气，2s 延迟模拟网络请求
 */
var SIMULATIONS = [
  { icon: "☀️",  description: "晴朗",     tempMin: 20, tempMax: 28, conditions: ["晴朗","温暖"],       precipitationChance: 5,  windKmph: 8 },
  { icon: "⛅",   description: "多云",     tempMin: 15, tempMax: 22, conditions: ["晴朗"],              precipitationChance: 15, windKmph: 12 },
  { icon: "🌧️",  description: "中雨",     tempMin: 10, tempMax: 18, conditions: ["降水","潮湿"],       precipitationChance: 65, windKmph: 18 },
  { icon: "🌬️",  description: "大风降温", tempMin: 3,  tempMax: 12, conditions: ["降温","大风"],       precipitationChance: 20, windKmph: 32 },
  { icon: "❄️",   description: "小雪",       tempMin: -3, tempMax: 5,  conditions: ["降雪","严寒","大风"], precipitationChance: 40, windKmph: 22 },
  { icon: "⛈️",  description: "雷阵雨",   tempMin: 14, tempMax: 22, conditions: ["降水","潮湿","大风"], precipitationChance: 80, windKmph: 25 }
];

function simulateWeather(dateString) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      var opt = SIMULATIONS[Math.floor(Math.random() * SIMULATIONS.length)];
      var tempRange = opt.tempMin + '~' + opt.tempMax + '°C';
      var rawDay = {
        date: dateString,
        minTempC: opt.tempMin,
        maxTempC: opt.tempMax,
        avgTempC: Math.round((opt.tempMin + opt.tempMax) / 2),
        description: opt.description,
        chanceOfRain: opt.precipitationChance,
        windKmph: opt.windKmph
      };
      resolve({
        icon: opt.icon,
        tempMin: opt.tempMin,
        tempMax: opt.tempMax,
        tempRange: tempRange,
        conditions: opt.conditions,
        precipitationChance: opt.precipitationChance,
        windKmph: opt.windKmph,
        description: opt.description,
        rawDays: [rawDay]
      });
    }, 2000);
  });
}

module.exports = { simulateWeather: simulateWeather };
