/**
 * 日期工具 — 原生 JS Date 处理跨月/跨年，适配小程序环境
 */
var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getTodayString() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function formatDayDate(startDate, offset) {
  var d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return {
    dateString: y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
    weekday: WEEKDAYS[d.getDay()],
    displayDate: m + '月' + day + '日 ' + WEEKDAYS[d.getDay()]
  };
}

function formatDateRange(startDate, days) {
  var start = new Date(startDate + 'T00:00:00');
  var end = new Date(startDate + 'T00:00:00');
  end.setDate(end.getDate() + days - 1);

  function fmt(d) {
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }

  return fmt(start) + ' — ' + fmt(end) + '（共' + days + '天）';
}

module.exports = {
  WEEKDAYS: WEEKDAYS,
  getTodayString: getTodayString,
  formatDayDate: formatDayDate,
  formatDateRange: formatDateRange
};
