/**
 * 和风天气 API — 真实天气数据获取 + 网络 Debug
 *
 * 认证体系（双轨制）：
 *   城市查询 (GeoAPI) → JWT EdDSA（凭据 ID: JWT_CREDENTIAL_ID）
 *   天气预报 (v7)     → API Key Header（X-QW-Api-Key）
 *
 * 配置前：
 *   1. 前往 https://console.qweather.com 创建项目
 *   2. 添加 API KEY 凭据 → 填入下方 QWEATHER_KEY
 *   3. 添加 JWT 凭据 → 填入下方 JWT_CREDENTIAL_ID + JWT_PROJECT_ID + JWT_PRIVATE_KEY
 *   4. 微信小程序后台「服务器域名」→ 加入 API_HOST
 *
 * ⚠️ 真机 Checklist：
 *   1. 开发者工具「不校验合法域名」仅开发时有效，真机必须配置白名单
 *   2. code="403" → Key/JWT 无效或未激活
 *   3. code="20001" → Key 已过期或余额不足
 */

// ───── API 配置 ─────
// ⚠️ 请前往 config.js 填写你的 API 密钥（config.js 已加入 .gitignore）
//    如果 config.js 不存在，复制 config.example.js 并重命名为 config.js
var _config = getConfig();

// ⚠️ 请替换为你自己的和风天气 API Key（控制台 → 项目管理 → 凭据 → API KEY）
var QWEATHER_KEY = _config.qweatherKey;

// ⚠️ 控制台 → 设置 → API Host，使用自定义 Host 统一访问所有接口
//    格式：https://你的标识.re.qweatherapi.com
var API_HOST = _config.qweatherHost;

// ───── JWT 认证配置（城市查询用） ─────
var jwtSigner = require('./jwtSigner.js');

// ⚠️ 凭据 ID（控制台 → 项目管理 → 凭据 → JWT 类型）
var JWT_CREDENTIAL_ID = _config.jwtCredentialId;

// ⚠️ 项目 ID（控制台 → 项目管理 → 设置 → 项目 ID）
var JWT_PROJECT_ID = _config.jwtProjectId;

// ⚠️ Ed25519 私钥 PEM（生成后上传公钥到控制台，私钥填入此处）
var JWT_PRIVATE_KEY = _config.jwtPrivateKey;

// ───── 腾讯地图 WebService API Key（地点联想搜索用） ─────
var MAP_KEY = _config.mapKey;

// ───── 腾讯地图 SK（签名校验密钥）─────
var MAP_SK = _config.mapSk;

// ───── 加载配置 ─────
function getConfig() {
  try {
    var config = require('./config.js');
    return config;
  } catch (e) {
    // 如果 config.js 不存在，返回空值（API 调用将返回模拟数据）
    console.warn('⚠️ config.js 未找到，请复制 config.example.js → config.js 并填入 API 密钥');
    return {
      qweatherKey: '',
      qweatherHost: '',
      jwtCredentialId: '',
      jwtProjectId: '',
      jwtPrivateKey: '',
      mapKey: '',
      mapSk: ''
    };
  }
}

// 🔧 开发开关：设为 true 跳过真实 API 请求，静默走模拟数据（不弹窗）。
//    真机调试时，若域名白名单尚未配置，设为 true 可免反复弹窗。
//    域名白名单配好后改回 false 即可启用真实天气。
var SKIP_REAL_API = false;

// 防止重复弹窗：模块生命周期内同类型错误只弹一次
var _hasShownDomainError = false;

/* ──────────── MD5 纯 JS 实现 ──────────── */

/**
 * 腾讯位置服务 WebServiceAPI 签名校验
 * 签名算法：对请求参数按 key 升序排列，拼接为
 *   <请求路径>?<排序后的queryString><SK>
 * 然后计算该字符串的 MD5（小写），即为 sig。
 * 文档：https://lbs.qq.com/faq/serverFaq/webServiceKey
 */
function _md5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    } else return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return (x ^ y ^ z); }
  function I(x, y, z) { return (y ^ (x | (~z))); }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWordsTemp1 = lMessageLength + 8;
    var lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
    var lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
    var lWordArray = Array(lNumberOfWords - 1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }
  function wordToHex(lValue) {
    var wordToHexValue = '', wordToHexValueTemp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValueTemp.substring(wordToHexValueTemp.length - 2);
    }
    return wordToHexValue;
  }
  function utf8Encode(string) {
    string = string.replace(/\r\n/g, '\n');
    var utftext = '';
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);
      if (c < 128) { utftext += String.fromCharCode(c); }
      else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }
  var x = Array();
  var k, AA, BB, CC, DD, a, b, c, d;
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  string = utf8Encode(string);
  x = convertToWordArray(string);
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x04881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * 生成腾讯地图 WebServiceAPI 签名
 * @param {string} path   - 接口路径，如 '/ws/place/v1/suggestion'
 * @param {object} params - 请求参数对象（不含 sig）
 * @returns {string} sig  - MD5 签名（小写），SK 未配置时返回空字符串
 */
function _signMapRequest(path, params) {
  if (!MAP_SK) return '';

  var keys = Object.keys(params).sort();
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(keys[i] + '=' + params[keys[i]]);
  }
  var queryString = parts.join('&');
  var signStr = path + '?' + queryString + MAP_SK;
  var sig = _md5(signStr);
  // 调试用：console.log('  🔑 签名原文: ' + signStr);
  // 调试用：console.log('  🔑 计算结果: ' + sig);
  return sig;
}

/* ──────────── 天气代码 → 内部格式映射 ──────────── */

var CONDITION_MAP = {
  '100': ['晴朗'],
  '101': ['晴朗'], '102': ['晴朗'], '103': ['晴朗'],
  '104': ['潮湿'],
  '200': ['大风'], '201': ['大风'], '202': ['大风'], '203': ['大风'],
  '204': ['大风'], '205': ['大风'], '206': ['大风'], '207': ['大风'],
  '208': ['大风'], '209': ['大风'], '210': ['大风'], '211': ['大风'],
  '212': ['大风'], '213': ['大风'],
  '300': ['降水'], '301': ['降水'], '302': ['降水', '降温'],
  '303': ['降水', '降温'], '304': ['降水', '降温'], '305': ['降水', '潮湿'],
  '306': ['降水', '潮湿'], '307': ['降水', '大风'], '308': ['降水', '大风'],
  '309': ['降水', '潮湿'], '310': ['降水', '大风', '降温'], '311': ['降水', '大风', '降温'],
  '312': ['降水', '大风'], '313': ['降水', '严寒'], '314': ['降水'],
  '315': ['降水'], '316': ['降水', '大风'], '317': ['降水', '大风'],
  '318': ['降水', '大风', '降温'],
  '400': ['降雪', '严寒'], '401': ['降雪', '严寒'], '402': ['降雪', '严寒'],
  '403': ['降雪', '严寒'], '404': ['降水', '降温'], '405': ['降水', '降温'],
  '406': ['降水', '降温'], '407': ['降雪', '严寒'],
  '500': ['潮湿'], '501': ['潮湿'], '502': ['大风'], '503': ['大风'],
  '504': ['大风'], '507': ['大风'], '508': ['大风']
};

var ICON_MAP = {
  '100': '☀️', '101': '⛅', '102': '⛅', '103': '☁️', '104': '☁️',
  '300': '🌧️', '301': '🌧️', '302': '⛈️', '303': '⛈️', '304': '⛈️',
  '305': '🌧️', '306': '🌧️', '307': '🌧️', '308': '🌧️', '309': '🌧️',
  '310': '⛈️', '311': '⛈️', '312': '⛈️', '313': '🌧️', '314': '🌧️',
  '315': '🌧️', '316': '🌧️', '317': '🌧️', '318': '🌧️',
  '400': '❄️', '401': '❄️', '402': '❄️', '403': '❄️', '404': '🌧️',
  '405': '🌧️', '406': '🌧️', '407': '❄️',
  '500': '🌫️', '501': '🌫️', '502': '🌫️', '503': '🌫️', '504': '🌫️',
  '507': '🌫️', '508': '🌫️'
};

var DESC_MAP = {
  '100': '晴', '101': '多云', '102': '少云', '103': '晴间多云', '104': '阴',
  '200': '有风', '201': '平静', '202': '微风', '203': '和风', '204': '清风',
  '205': '强风', '206': '疾风', '207': '大风', '208': '烈风', '209': '风暴',
  '210': '狂风暴', '211': '飓风', '212': '龙卷风', '213': '热带风暴',
  '300': '阵雨', '301': '强阵雨', '302': '雷阵雨', '303': '强雷阵雨',
  '304': '冰雹雷阵雨', '305': '小雨', '306': '中雨', '307': '大雨',
  '308': '极端降雨', '309': '毛毛雨', '310': '暴雨', '311': '大暴雨',
  '312': '特大暴雨', '313': '冻雨', '314': '小到中雨', '315': '中到大雨',
  '316': '大到暴雨', '317': '暴雨到大暴雨', '318': '大暴雨到特大暴雨',
  '400': '小雪', '401': '中雪', '402': '大雪', '403': '暴雪',
  '404': '雨夹雪', '405': '雨雪天气', '406': '阵雨夹雪', '407': '阵雪',
  '500': '薄雾', '501': '雾', '502': '霾', '503': '扬沙', '504': '浮尘',
  '507': '沙尘暴', '508': '强沙尘暴'
};

/* ──────────── 核心 API ──────────── */

/**
 * 通过城市名获取 Location ID（JWT 认证）
 * 参考: https://dev.qweather.com/docs/api/geoapi/city-lookup/
 */
function getLocationId(cityName) {
  var url = API_HOST + '/geo/v2/city/lookup';
  var params = { location: cityName };

  // 生成 JWT Token
  var jwtToken;
  try {
    jwtToken = jwtSigner.createToken(JWT_PRIVATE_KEY, JWT_CREDENTIAL_ID, JWT_PROJECT_ID);
  } catch (e) {
    console.error('【JWT签名失败】', e.message);
    return Promise.reject(new Error('JWT 签名失败: ' + e.message));
  }

  console.log('═══ 和风天气 → 城市查询 ═══');
  console.log('  URL:', url);
  console.log('  参数:', JSON.stringify(params));
  console.log('  认证: Bearer JWT (kid=' + JWT_CREDENTIAL_ID + ', sub=' + JWT_PROJECT_ID + ')');

  return new Promise(function (resolve, reject) {
    console.log('  🌐 请求: ' + url);
    wx.request({
      url: url,
      data: params,
      timeout: 15000,
      header: {
        'Authorization': 'Bearer ' + jwtToken
      },
      success: function (res) {
        console.log('  HTTP状态码:', res.statusCode);
        console.log('  响应 data:', JSON.stringify(res.data));

        // ═══ 防御：空数据 ═══
        if (!res.data) {
          console.error('【和风API】城市查询返回空数据');
          reject(new Error('城市查询返回空数据'));
          return;
        }

        // ═══ 分支 A：地点不存在或输入非法 ═══
        // 兼容两种 API 错误格式：
        //   旧格式: { code: "404" }          → code 为字符串 404/400
        //   新格式: { error: { status: 400, type: "...no-such-location" } }
        var isNotFoundByCode = (res.data.code === '404' || res.data.code === '400') || res.statusCode === 404;
        var isNotFoundByError = res.data.error &&
          (res.data.error.status === 400 || res.data.error.status === 404) &&
          (String(res.data.error.type || '').indexOf('no-such-location') >= 0 ||
           res.data.error.title === 'No Such Location');
        if (isNotFoundByCode || isNotFoundByError) {
          console.error('【和风API】城市未找到: ' + cityName);
          var notFoundErr = new Error('未找到城市「' + cityName + '」');
          notFoundErr.isLocationNotFound = true;
          reject(notFoundErr);
          return;
        }

        // ═══ 分支 B：其他不可控的业务错误 → 仅控制台记录 ═══
        if (res.data.code && res.data.code !== '200') {
          console.error('【和风API】城市查询业务错误 code=' + res.data.code, JSON.stringify(res.data));
          reject(new Error('城市查询业务错误: ' + res.data.code));
          return;
        }
        if (res.data.error) {
          console.error('【和风API】城市查询业务错误 error=', JSON.stringify(res.data.error));
          reject(new Error('城市查询业务错误: ' + (res.data.error.title || res.data.error.status)));
          return;
        }

        // ═══ 分支 C：完全成功 ═══
        if (res.data.location && res.data.location.length > 0) {
          console.log('  ✅ 城市ID:', res.data.location[0].id);
          resolve(res.data.location[0].id);
        } else {
          console.warn('  ⚠️ 找到城市「' + cityName + '」但无 location 数据');
          reject(new Error('未找到城市「' + cityName + '」，请尝试更精确的地名'));
        }
      },
      fail: function (err) {
        var rawMsg = (err && err.errMsg) || JSON.stringify(err);
        console.error('【和风API】城市查询网络错误 [' + url + ']:', rawMsg);

        // 检测域名白名单错误（真机最常见原因）
        var isDomainErr = rawMsg.indexOf('url not in domain list') >= 0 ||
                          rawMsg.indexOf('not in domain') >= 0 ||
                          rawMsg.indexOf('合法域名') >= 0;

        if (SKIP_REAL_API) {
          console.warn('  → SKIP_REAL_API=true，静默跳过');
          reject(err);
          return;
        }

        if (isDomainErr) {
          if (!_hasShownDomainError) {
            _hasShownDomainError = true;
            wx.showModal({
              title: '域名未在白名单',
              content: '真机请求被拦截，以下域名未加入「服务器域名」白名单：\n\n' + API_HOST + '\n\n📋 配置步骤：\n微信公众平台(mp.weixin.qq.com)\n→ 开发管理 → 开发设置\n→ 服务器域名 → request合法域名\n→ 添加上述域名 → 保存\n\n⏳ 配置后约 5 分钟生效\n\n💡 临时方案：\n在 weatherApi.js 顶部将 SKIP_REAL_API\n设为 true，跳过真实请求。',
              showCancel: false,
              confirmText: '知道了'
            });
          } else {
            console.warn('  → 域名错误已弹窗过，不再重复');
          }
        } else {
          // ═══ 分支 D：真正断网 / 超时 → 轻量 Toast ═══
          wx.showToast({
            title: '信号进入无人区',
            icon: 'none',
            duration: 2000
          });
        }
        err.isNetworkError = true;
        reject(err);
      }
    });
  });
}

/**
 * 阶梯动态预报 — 根据「今天 → 行程结束日期」的跨度匹配 API 端点
 *   ≤3 → 3d    4-7 → 7d    8-10 → 10d    11-15 → 15d    >15 → 30d
 */
var MAX_FORECAST_DAYS = 30;

function getForecastDaysParam(endDateString) {
  // 计算今天到行程结束日期的天数差（含今天）
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var end = new Date(endDateString + 'T00:00:00');
  var diffTime = end.getTime() - today.getTime();
  var offsetDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 包含今天

  console.log('  📐 跨度计算: 今天 ~ ' + endDateString + ' = ' + offsetDays + ' 天（含今天）');

  if (offsetDays <= 3)  return '3d';
  if (offsetDays <= 7)  return '7d';
  if (offsetDays <= 10) return '10d';
  if (offsetDays <= 15) return '15d';
  return '30d';
}

/**
 * 获取 N 天天气预报（动态阶梯端点）
 * @param {string} locationId - 城市 Location ID
 * @param {string} daysParam  - 阶梯参数，如 "3d" / "7d" / "15d" / "30d"
 */
function getWeatherNDay(locationId, daysParam) {
  var url = API_HOST + '/v7/weather/' + daysParam;
  var params = { location: locationId };

  console.log('═══ 和风天气 → ' + daysParam + ' 预报 ═══');
  console.log('  URL:', url);
  console.log('  参数:', JSON.stringify(params));
  console.log('  认证: Header X-QW-Api-Key');

  return new Promise(function (resolve, reject) {
    console.log('  🌐 请求: ' + url);
    wx.request({
      url: url,
      data: params,
      timeout: 15000,
      header: {
        'X-QW-Api-Key': QWEATHER_KEY
      },
      success: function (res) {
        console.log('  HTTP状态码:', res.statusCode);
        console.log('  响应 data (前200字符):', JSON.stringify(res.data).substring(0, 200));

        // ═══ 防御：空数据 ═══
        if (!res.data) {
          console.error('【和风API】天气查询返回空数据');
          reject(new Error('天气查询返回空数据'));
          return;
        }

        // ═══ 分支 A：地点不存在或输入非法 ═══
        // 兼容两种 API 错误格式：
        //   旧格式: { code: "404" }          → code 为字符串 404/400
        //   新格式: { error: { status: 400, type: "...no-such-location" } }
        var isNotFoundByCode = (res.data.code === '404' || res.data.code === '400') || res.statusCode === 404;
        var isNotFoundByError = res.data.error &&
          (res.data.error.status === 400 || res.data.error.status === 404) &&
          (String(res.data.error.type || '').indexOf('no-such-location') >= 0 ||
           res.data.error.title === 'No Such Location');
        if (isNotFoundByCode || isNotFoundByError) {
          console.error('【和风API】天气查询城市未找到');
          var notFoundErr = new Error('未找到该地点天气数据');
          notFoundErr.isLocationNotFound = true;
          reject(notFoundErr);
          return;
        }

        // ═══ 分支 B：其他不可控的业务错误 → 仅控制台记录 ═══
        if (res.data.code && res.data.code !== '200') {
          console.error('【和风API】天气查询业务错误 code=' + res.data.code, JSON.stringify(res.data));
          reject(new Error('天气查询业务错误: ' + res.data.code));
          return;
        }
        if (res.data.error) {
          console.error('【和风API】天气查询业务错误 error=', JSON.stringify(res.data.error));
          reject(new Error('天气查询业务错误: ' + (res.data.error.title || res.data.error.status)));
          return;
        }

        // ═══ 分支 C：完全成功 ═══
        var daily = res.data.daily;
        if (daily && daily.length > 0) {
          console.log('  ✅ 获取到 ' + daily.length + ' 天预报');
          console.log('  首日:', daily[0].fxDate, DESC_MAP[daily[0].iconDay] || '?', daily[0].tempMin + '~' + daily[0].tempMax + '°C');
          resolve(daily);
        } else {
          console.warn('  ⚠️ 返回成功但无 daily 数据');
          reject(new Error('天气数据为空'));
        }
      },
      fail: function (err) {
        var rawMsg = (err && err.errMsg) || JSON.stringify(err);
        console.error('【和风API】天气查询网络错误 [' + url + ']:', rawMsg);

        var isDomainErr = rawMsg.indexOf('url not in domain list') >= 0 ||
                          rawMsg.indexOf('not in domain') >= 0 ||
                          rawMsg.indexOf('合法域名') >= 0;

        if (SKIP_REAL_API) {
          console.warn('  → SKIP_REAL_API=true，静默跳过');
          reject(err);
          return;
        }

        if (isDomainErr) {
          if (!_hasShownDomainError) {
            _hasShownDomainError = true;
            wx.showModal({
              title: '域名未在白名单',
              content: '真机请求被拦截，以下域名未加入「服务器域名」白名单：\n\n' + API_HOST + '\n\n📋 配置步骤：\n微信公众平台(mp.weixin.qq.com)\n→ 开发管理 → 开发设置\n→ 服务器域名 → request合法域名\n→ 添加上述域名 → 保存\n\n⏳ 配置后约 5 分钟生效',
              showCancel: false,
              confirmText: '知道了'
            });
          }
        } else {
          // ═══ 分支 D：真正断网 / 超时 → 轻量 Toast ═══
          wx.showToast({
            title: '信号进入无人区',
            icon: 'none',
            duration: 2000
          });
        }
        err.isNetworkError = true;
        reject(err);
      }
    });
  });
}

/**
 * 将和风天气单日数据转为 TrailReady 内部格式
 */
function mapDayWeather(qwDay) {
  var code = qwDay.iconDay || '100';
  var conditions = CONDITION_MAP[code] || ['晴朗'];
  // ═══ 夜间码不再合并到白天标签 ═══
  // 旧逻辑将夜间天气标签强行合并进 conditions，导致晴天 + 夜间小雨
  // 出现 ['晴朗','降水','潮湿'] 的误导性组合。徒步用户关心的是
  // 活动时段的天气，夜间天气如有必要应单独展示，此处只保留白天条件。

  var tempMin = parseInt(qwDay.tempMin) || 10;
  var tempMax = parseInt(qwDay.tempMax) || 25;

  return {
    icon: ICON_MAP[code] || '🌤️',
    tempMin: tempMin,
    tempMax: tempMax,
    tempRange: tempMin + '~' + tempMax + '°C',
    conditions: conditions,
    precipitationChance: parseInt(qwDay.precip) || 0,
    windKmph: parseInt(qwDay.windSpeedDay) || 0,
    description: DESC_MAP[code] || '未知',
    rawDays: [{
      date: qwDay.fxDate,
      minTempC: tempMin,
      maxTempC: tempMax,
      avgTempC: Math.round((tempMin + tempMax) / 2),
      description: DESC_MAP[code] || '',
      chanceOfRain: parseInt(qwDay.precip) || 0,
      windKmph: parseInt(qwDay.windSpeedDay) || 0
    }]
  };
}

/**
 * 按日期在预报列表中查找对应天气
 */
function findDayWeather(dailyList, dateString) {
  for (var i = 0; i < dailyList.length; i++) {
    if (dailyList[i].fxDate === dateString) {
      return mapDayWeather(dailyList[i]);
    }
  }
  return null;
}

/**
 * ═══════════════════════════════════════════
 * 经典气候模型 — 远期日期降级方案
 * ═══════════════════════════════════════════
 * 当目标日期超出气象预报范围（未来 >30 天）时，
 * 根据月份生成静态季节性气候数据，确保不白屏、不报错。
 */
var SEASONAL_CLIMATE = {
  winter: { icon: '❄️', description: '经典冬季模型', conditions: ['降温', '严寒'],
    tempMin: -8, tempMax: 3, precipChance: 25, windKmph: 18 },
  spring: { icon: '🌤️', description: '经典春季模型', conditions: ['潮湿', '降水'],
    tempMin: 8, tempMax: 22, precipChance: 40, windKmph: 15 },
  summer: { icon: '☀️', description: '经典夏季模型', conditions: ['晴朗', '潮湿'],
    tempMin: 20, tempMax: 35, precipChance: 30, windKmph: 10 },
  fall:   { icon: '🍂', description: '经典秋季模型', conditions: ['大风', '降温'],
    tempMin: 5, tempMax: 20, precipChance: 20, windKmph: 20 }
};

function getSeasonFromMonth(month) {
  if (month === 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'fall';
}

function makeClimateWeather(dateString) {
  var parts = dateString.split('-');
  var month = parseInt(parts[1]) || 6;
  var season = getSeasonFromMonth(month);
  var model = SEASONAL_CLIMATE[season];
  var jitter = function (base, range) { return Math.round(base + (Math.random() - 0.5) * range); };
  return {
    icon: model.icon, tempMin: jitter(model.tempMin, 4), tempMax: jitter(model.tempMax, 6),
    tempRange: jitter(model.tempMin, 4) + '~' + jitter(model.tempMax, 6) + '°C',
    conditions: model.conditions.slice(), precipitationChance: jitter(model.precipChance, 15),
    windKmph: jitter(model.windKmph, 8), description: model.description,
    rawDays: [{ date: dateString, minTempC: jitter(model.tempMin, 4),
      maxTempC: jitter(model.tempMax, 6), avgTempC: Math.round((model.tempMin + model.tempMax) / 2),
      description: model.description, chanceOfRain: jitter(model.precipChance, 15),
      windKmph: jitter(model.windKmph, 8) }]
  };
}

function isDateInForecastRange(dateString) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var maxDate = new Date(today.getTime() + MAX_FORECAST_DAYS * 24 * 60 * 60 * 1000);
  var target = new Date(dateString + 'T00:00:00');
  return target <= maxDate && target >= today;
}

/**
 * 核心接口：根据目的地获取整个行程的天气（基于跨度天数的阶梯动态预报）
 *
 * @param {string}   destination  - 城市名，如 "北京"、"稻城亚丁"
 * @param {string[]} dateStrings  - 行程日期数组，如 ["2026-06-28", "2026-06-29", "2026-06-30"]
 * @returns {Promise<Object>} { "2026-06-28": weatherObj, ... }
 */
function fetchTripWeather(destination, dateStrings) {
  // 开发模式跳过
  if (SKIP_REAL_API) {
    console.warn('【和风天气】SKIP_REAL_API=true，跳过真实请求');
    return Promise.reject(new Error('SKIP_REAL_API 开发模式'));
  }

  if (!QWEATHER_KEY || QWEATHER_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('【和风天气】未配置 API Key，跳过真实请求');
    return Promise.reject(new Error('未配置和风天气 API Key'));
  }

  console.log('═══ 和风天气 → 行程天气（文本查询） ═══');
  console.log('  目的地:', destination);
  console.log('  日期:', JSON.stringify(dateStrings));

  // 先查 Location ID，再统一走 _resolveWeatherFromLocation
  return getLocationId(destination).then(function (locationId) {
    return _resolveWeatherFromLocation(locationId, destination, dateStrings);
  });
}

/**
 * ═══════════════════════════════════════
 *  🔬 纯净测试函数 — 验证 API 通道
 * ═══════════════════════════════════════
 * 用固定城市（拉萨）和固定日期测试整个链路。
 * 在 onLoad 中自动调用，结果打印到控制台。
 *
 * 成功 / 失败 → 仅控制台输出，不弹窗打扰用户
 */
function testChannel() {
  if (SKIP_REAL_API) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  🔬 和风天气 API 通道测试               ║');
    console.log('║  SKIP_REAL_API=true，跳过测试           ║');
    console.log('╚══════════════════════════════════════════╝');
    return Promise.reject(new Error('SKIP_REAL_API 开发模式'));
  }

  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🔬 和风天气 API 通道测试开始            ║');
  console.log('╠══════════════════════════════════════════╣');
  // 调试用：console.log('║  API Key :', QWEATHER_KEY.substring(0, 8) + '…');
  // 调试用：console.log('║  API Host:', API_HOST);
  console.log('║  认证方式:', QWEATHER_KEY ? 'API Key ✓' : '❌ 未配置');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  测试城市: 拉萨');
  console.log('║  测试日期: 明天（T+1）');
  console.log('╚══════════════════════════════════════════╝');

  var testCity = '拉萨';
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var y = tomorrow.getFullYear();
  var m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  var d = String(tomorrow.getDate()).padStart(2, '0');
  var testDate = y + '-' + m + '-' + d;

  return fetchTripWeather(testCity, [testDate]).then(function (result) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅ 和风天气 API 通道测试通过！         ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('📡 完整 JSON 回传:');
    console.log(JSON.stringify(result, null, 2));

    var w = result[testDate];
    if (w) {
      console.log('📡 测试结果: ' + w.description + ' ' + w.tempRange);
    }

    return result;
  }).catch(function (err) {
    console.error('╔══════════════════════════════════════════╗');
    console.error('║  ❌ 和风天气 API 通道测试失败！         ║');
    console.error('╚══════════════════════════════════════════╝');
    console.error('错误详情:', err && err.message || err);
    console.error('完整错误对象:', JSON.stringify(err));
    console.error('');
    console.error('🔧 排查步骤:');
    console.error('  1. 确认 API Key 有效 → https://console.qweather.com');
    console.error('  2. 确认「服务器域名」白名单包含:');
    console.error('     - ' + API_HOST);
    console.error('  3. 确认 API Host 正确: ' + API_HOST);
    console.error('  4. 在开发者工具中勾选「不校验合法域名」仅限开发时有效');
    console.error('');

    return Promise.reject(err);
  });
}

/* ──────────── 腾讯地图 Mock 降级数据 ──────────── */
var MOCK_POI_DATA = {
  '东湖': [
    { title: '东湖风景区', address: '湖北省武汉市武昌区沿湖大道16号', lat: 30.55, lng: 114.38, category: '旅游景点:风景名胜' },
    { title: '东湖生态旅游风景区', address: '湖北省武汉市洪山区珞喻路', lat: 30.52, lng: 114.42, category: '旅游景点:公园' },
    { title: '东湖公园', address: '广东省深圳市罗湖区爱国路', lat: 22.55, lng: 114.14, category: '旅游景点:公园' },
    { title: '南昌市东湖区', address: '江西省南昌市东湖区', lat: 28.69, lng: 115.87, category: '行政区划:区县' }
  ],
  '华山': [
    { title: '华山风景名胜区', address: '陕西省渭南市华阴市G310(连天线)', lat: 34.48, lng: 110.09, category: '旅游景点:风景名胜' },
    { title: '华山国家森林公园', address: '陕西省渭南市华阴市', lat: 34.49, lng: 110.08, category: '旅游景点:森林公园' }
  ],
  '雨崩': [
    { title: '雨崩村', address: '云南省迪庆藏族自治州德钦县云岭乡', lat: 28.40, lng: 98.79, category: '旅游景点:村落' }
  ],
  '四姑娘山': [
    { title: '四姑娘山景区', address: '四川省阿坝藏族羌族自治州小金县', lat: 31.11, lng: 102.90, category: '旅游景点:风景名胜' }
  ],
  '香格里拉': [
    { title: '香格里拉', address: '云南省迪庆藏族自治州香格里拉市', lat: 27.83, lng: 99.70, category: '行政区划:地级市' },
    { title: '香格里拉·普达措国家公园', address: '云南省迪庆藏族自治州香格里拉市建塘镇', lat: 27.86, lng: 99.99, category: '旅游景点:国家级景点' }
  ],
  '稻城': [
    { title: '稻城亚丁风景区', address: '四川省甘孜藏族自治州稻城县', lat: 28.46, lng: 100.28, category: '旅游景点:风景名胜' },
    { title: '稻城县', address: '四川省甘孜藏族自治州稻城县', lat: 29.04, lng: 100.29, category: '行政区划:县' }
  ],
  '梅里雪山': [
    { title: '梅里雪山国家公园', address: '云南省迪庆藏族自治州德钦县', lat: 28.44, lng: 98.68, category: '旅游景点:森林公园' }
  ],
  '武功山': [
    { title: '武功山国家级风景名胜区', address: '江西省萍乡市芦溪县', lat: 27.47, lng: 114.19, category: '旅游景点:风景名胜' }
  ]
};

/**
 * ═══════════════════════════════════════
 *  🔍 模糊搜索 — 腾讯地图关键词输入提示 + Mock 降级
 * ═══════════════════════════════════════
 * 直接调用腾讯地图 WebService API 的 suggestion 接口，
 * 输出景区、地名、行政区划等精准 POI 结果。
 * 当 Key 未配置或开发开关开启时，自动走内置 Mock 数据。
 */
function searchCities(query) {
  if (!query || !query.trim()) {
    return Promise.resolve([]);
  }

  var keyword = query.trim();

  // ─── 分支 A：开发模式 / 无 Key → Mock 降级 ───
  var isMapKeyReady = MAP_KEY && MAP_KEY !== 'YOUR_TENCENT_MAP_KEY_HERE';
  if (SKIP_REAL_API || !isMapKeyReady) {
    console.log('🔍 地图搜索（Mock）: "' + keyword + '"');
    return Promise.resolve(_mockSearch(keyword));
  }

  // ─── 分支 B：真实腾讯地图 API ───
  console.log('🔍 腾讯地图→地点搜索: "' + keyword + '"');
  var url = 'https://apis.map.qq.com/ws/place/v1/suggestion';
  var path = '/ws/place/v1/suggestion';
  var params = {
    keyword: keyword,
    key: MAP_KEY,
    // region_fix: 1 让结果更聚焦国内
    region_fix: 1
  };

  // ─── 签名校验（SK 已配置时生效）───
  var sig = _signMapRequest(path, params);
  if (sig) {
    params.sig = sig;
    console.log('  🔐 签名已附加: sig=' + sig);
  }

  return new Promise(function (resolve) {
    console.log('  🌐 请求: ' + url);
    wx.request({
      url: url,
      data: params,
      timeout: 15000,
      success: function (res) {
        if (!res.data || res.data.status !== 0 || !res.data.data) {
          console.warn('【腾讯地图】suggestion 异常:', JSON.stringify(res.data).substring(0, 200));
          resolve([]);
          return;
        }
        var list = (res.data.data || []).map(function (item, idx) {
          return {
            id: item.id || ('poi_' + idx),
            name: item.title || '',
            address: item.address || '',
            lat: item.location ? item.location.lat : 0,
            lng: item.location ? item.location.lng : 0,
            category: item.category || ''
          };
        });
        console.log('  ✅ 腾讯地图返回 ' + list.length + ' 条');
        resolve(list);
      },
      fail: function (err) {
        console.error('【腾讯地图】请求失败 [' + url + ']:', (err && err.errMsg) || JSON.stringify(err));
        resolve([]);
      }
    });
  });
}

/**
 * 内置 Mock 搜索 — 字面匹配，Key 就位前也能跑了验证 UI
 */
function _mockSearch(keyword) {
  var results = [];

  // 精确 key 匹配
  if (MOCK_POI_DATA[keyword]) {
    results = MOCK_POI_DATA[keyword];
  } else {
    // 模糊匹配：title 包含关键词
    Object.keys(MOCK_POI_DATA).forEach(function (k) {
      MOCK_POI_DATA[k].forEach(function (item) {
        if (item.title.indexOf(keyword) >= 0 || item.address.indexOf(keyword) >= 0) {
          results.push(item);
        }
      });
    });
  }

  return results.map(function (item) {
    return {
      name: item.title,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
      category: item.category || ''
    };
  });
}

/* ──────────── 共享：天气解析核心 ──────────── */

/**
 * 根据 locationId 完成完整的天气查询（30天边界过滤 + 气候模型降级）
 * 被 fetchTripWeather 和 fetchTripWeatherById 共用
 */
function _resolveWeatherFromLocation(locationId, destination, dateStrings) {
  var sortedDates = dateStrings.slice().sort();
  var endDateString = sortedDates[sortedDates.length - 1];
  var daysParam = getForecastDaysParam(endDateString);

  console.log('═══ 和风天气 → 行程天气（已有 Location ID） ═══');
  console.log('  目的地:', destination);
  console.log('  Location ID:', locationId);
  console.log('  结束日期:', endDateString);
  console.log('  阶梯端点:', daysParam);

  var inRange = [];
  var outOfRange = [];
  dateStrings.forEach(function (ds) {
    if (isDateInForecastRange(ds)) { inRange.push(ds); }
    else { outOfRange.push(ds); }
  });

  var climateResult = {};
  outOfRange.forEach(function (ds) {
    climateResult[ds] = makeClimateWeather(ds);
    console.log('  📡 远期日期 [' + ds + '] → 经典气候模型');
  });

  if (inRange.length === 0) {
    console.log('  ⏭️ 全部日期超出30天预报范围，跳过 API 请求，使用气候模型');
    return Promise.resolve(climateResult);
  }

  return getWeatherNDay(locationId, daysParam).then(function (dailyList) {
    var result = {};
    var matched = 0;
    var missed = 0;

    inRange.forEach(function (ds) {
      var weather = findDayWeather(dailyList, ds);
      if (weather) {
        result[ds] = weather;
        matched++;
        console.log('  🎯 日期匹配: ' + ds + ' → ' + weather.description + ' ' + weather.tempRange);
      } else {
        missed++;
        console.warn('  ⚠️  未匹配: ' + ds + '（API 返回未覆盖此日期）');
        result[ds] = makeClimateWeather(ds);
      }
    });

    for (var key in climateResult) {
      if (climateResult.hasOwnProperty(key)) { result[key] = climateResult[key]; }
    }

    console.log('  ✅ 行程天气映射完成: ' + matched + ' 天真实 + ' +
      missed + ' 天降级 + ' + outOfRange.length + ' 天气候模型 = ' +
      Object.keys(result).length + ' 天总计');
    return result;
  });
}

/**
 * ═══════════════════════════════════════
 *  🆔 精确 ID 天气查询 — POI/景区点击后走此通道
 * ═══════════════════════════════════════
 * 跳过城市名→Location ID 的二次查找，
 * 直接用联想搜索结果中的精准 id 请求天气预报。
 */
function fetchTripWeatherById(locationId, destination, dateStrings) {
  if (SKIP_REAL_API) {
    console.warn('【和风天气】SKIP_REAL_API=true，跳过真实请求');
    return Promise.reject(new Error('SKIP_REAL_API 开发模式'));
  }
  if (!QWEATHER_KEY || QWEATHER_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('【和风天气】未配置 API Key，跳过真实请求');
    return Promise.reject(new Error('未配置和风天气 API Key'));
  }
  return _resolveWeatherFromLocation(locationId, destination, dateStrings);
}

/**
 * ═══════════════════════════════════════
 *  🗺️ 经纬度天气查询 — 地图 POI 点击后走此通道
 * ═══════════════════════════════════════
 * 和风天气原生支持 lng,lat 格式的 location 参数，
 * 会返回距离该坐标最近气象站的预报。
 * @param {string} latLng - "lng,lat" 格式，如 "114.38,30.55"
 */
function fetchTripWeatherByLatLng(latLng, destination, dateStrings) {
  if (SKIP_REAL_API) {
    console.warn('【和风天气】SKIP_REAL_API=true，跳过真实请求');
    return Promise.reject(new Error('SKIP_REAL_API 开发模式'));
  }
  if (!QWEATHER_KEY || QWEATHER_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('【和风天气】未配置 API Key，跳过真实请求');
    return Promise.reject(new Error('未配置和风天气 API Key'));
  }
  console.log('📍 经纬度直查天气: ' + latLng + ' (' + destination + ')');
  return _resolveWeatherFromLocation(latLng, destination, dateStrings);
}

module.exports = {
  fetchTripWeather: fetchTripWeather,
  fetchTripWeatherById: fetchTripWeatherById,
  fetchTripWeatherByLatLng: fetchTripWeatherByLatLng,
  getForecastDaysParam: getForecastDaysParam,
  MAX_FORECAST_DAYS: MAX_FORECAST_DAYS,
  testChannel: testChannel,
  searchCities: searchCities
};
