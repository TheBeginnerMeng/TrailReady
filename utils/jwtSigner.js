/**
 * 和风天气 JWT 签名器 — Ed25519 via tweetnacl
 *
 * 在小程序环境中无法使用 npm 包 (jose/jsonwebtoken)，
 * 因此内嵌 tweetnacl (nacl-fast.min.js) 做 Ed25519 签名。
 *
 * 用法：
 *   var jwt = require('./jwtSigner.js');
 *   var token = jwt.createToken(privateKeyPem, kid, sub);
 *   // → "eyJhbGci...payload...signature"
 *
 * Token 自动缓存，默认 15 分钟内复用，过期前 5 分钟自动续签。
 */

var nacl = require('./nacl-fast.min.js');

/* ══════════════════════════════════════════════
 *  1. Base64URL 编码
 * ══════════════════════════════════════════════ */
var B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlEncode(bytes) {
  var result = '';
  var len = bytes.length;
  var i = 0;
  while (i < len) {
    var a = bytes[i] & 0xff; i++;
    var b = i < len ? bytes[i] & 0xff : 0; i++;
    var c = i < len ? bytes[i] & 0xff : 0; i++;
    var triplet = (a << 16) | (b << 8) | c;
    result += B64URL.charAt((triplet >> 18) & 0x3f);
    result += B64URL.charAt((triplet >> 12) & 0x3f);
    if (i - 2 < len) result += B64URL.charAt((triplet >> 6) & 0x3f);
    if (i - 1 < len) result += B64URL.charAt(triplet & 0x3f);
  }
  return result;
}

/* ══════════════════════════════════════════════
 *  2. PEM 解析 → 32 字节种子
 * ══════════════════════════════════════════════ */

/**
 * 解析 Ed25519 PKCS#8 私钥 PEM，返回 32 字节种子。
 *
 * 公钥格式 (SPKI) 的特征是有 BIT STRING(0x03) 且无 INTEGER 版本号。
 * 如果检测到公钥，会抛出明确错误。
 */
function parsePrivateKeyPem(pem) {
  var b64 = pem.replace(/-----.*?-----/g, '').replace(/\s/g, '');

  function b64decode(s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var result = [];
    var pad = s.length % 4;
    if (pad) s += '===='.slice(pad);
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    for (var i = 0; i < s.length; i += 4) {
      var a = chars.indexOf(s[i]), b = chars.indexOf(s[i + 1]),
          c = chars.indexOf(s[i + 2]), d = chars.indexOf(s[i + 3]);
      var n = (a << 18) | (b << 12) | (c << 6) | d;
      result.push((n >> 16) & 0xff);
      if (s[i + 2] !== '=') result.push((n >> 8) & 0xff);
      if (s[i + 3] !== '=') result.push(n & 0xff);
    }
    return result;
  }

  var der = b64decode(b64);
  if (!der || der.length < 32) return null;

  // 公钥检测
  var hasBitString = false, hasVersionInt = false;
  for (var scan = 0; scan < der.length && scan < 20; scan++) {
    if (der[scan] === 0x03) hasBitString = true;
    if (der[scan] === 0x02) hasVersionInt = true;
  }
  if (!hasVersionInt && hasBitString) {
    throw new Error(
      '这不是私钥，是一个公钥（SPKI 格式）！\n' +
      '公钥无法用于 JWT 签名。\n\n' +
      '🔧 生成正确的 Ed25519 私钥：\n' +
      'openssl genpkey -algorithm ED25519 -out ed25519-private.pem\n' +
      'openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem\n\n' +
      '① 公钥 (.pub) 上传到和风天气控制台凭据管理\n' +
      '② 私钥 (.pem) 内容填入 JWT_PRIVATE_KEY'
    );
  }

  function readLength(pos) {
    var len = der[pos + 1];
    if (len & 0x80) {
      var numOctets = len & 0x7f;
      var val = 0;
      for (var j = 0; j < numOctets; j++) val = (val << 8) | der[pos + 2 + j];
      return { len: val, headerSize: 2 + numOctets };
    }
    return { len: len, headerSize: 2 };
  }

  var idx = 0;

  // SEQUENCE
  if (der[idx] === 0x30) { var info = readLength(idx); idx += info.headerSize; }
  else return null;

  // INTEGER version
  if (idx < der.length && der[idx] === 0x02) {
    var info = readLength(idx);
    idx += info.headerSize + info.len;
  }

  // SEQUENCE (AlgorithmIdentifier)
  if (idx < der.length && der[idx] === 0x30) {
    var info = readLength(idx);
    idx += info.headerSize;
    // OID
    if (idx < der.length && der[idx] === 0x06) {
      var oidInfo = readLength(idx);
      idx += oidInfo.headerSize + oidInfo.len;
    }
  }

  // OCTET STRING wrapper
  if (idx < der.length && der[idx] === 0x04) {
    var info = readLength(idx);
    idx += info.headerSize;
    // Inner OCTET STRING = the 32-byte seed
    if (idx < der.length && der[idx] === 0x04) {
      var innerInfo = readLength(idx);
      idx += innerInfo.headerSize;
      return der.slice(idx, idx + Math.min(innerInfo.len, 32));
    }
    return der.slice(idx, idx + Math.min(info.len, 32));
  }

  if (der.length >= 32) return der.slice(der.length - 32);
  return null;
}

/* ══════════════════════════════════════════════
 *  3. JWT 生成 (tweetnacl 签名)
 * ══════════════════════════════════════════════ */

var _cachedToken = null;
var _cachedExp = 0;
var CACHE_MARGIN = 300; // 5 分钟

/**
 * 创建 JWT Token（带缓存）
 *
 * @param {string}  privateKeyPem  - Ed25519 PEM 格式私钥
 * @param {string}  kid            - 凭据 ID
 * @param {string}  sub            - 项目 ID
 * @param {number}  ttlSeconds     - 有效期秒数，默认 900
 * @returns {string}               - 完整的 JWT Token
 */
function createToken(privateKeyPem, kid, sub, ttlSeconds) {
  var now = Math.floor(Date.now() / 1000);
  if (_cachedToken && now < _cachedExp - CACHE_MARGIN) {
    return _cachedToken;
  }

  ttlSeconds = ttlSeconds || 900;

  // 1. 解析 PEM → 32 字节种子
  var seed = parsePrivateKeyPem(privateKeyPem);
  if (!seed || seed.length < 32) {
    throw new Error('无效的 Ed25519 私钥 PEM（需 32 字节种子）');
  }

  // 2. 从种子生成 tweetnacl 密钥对
  var keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));

  // 3. 构建 JWT Header
  var header = { alg: 'EdDSA', kid: kid };
  var headerJson = JSON.stringify(header);
  var headerB64 = base64UrlEncode(strToUtf8(headerJson));

  // 4. 构建 JWT Payload
  var iat = now - 30;
  var exp = iat + ttlSeconds;
  var payload = { sub: sub, iat: iat, exp: exp };
  var payloadJson = JSON.stringify(payload);
  var payloadB64 = base64UrlEncode(strToUtf8(payloadJson));

  // 5. 签名
  var signingInput = headerB64 + '.' + payloadB64;
  var msgBytes = new Uint8Array(strToUtf8(signingInput));
  var sig = nacl.sign.detached(msgBytes, keyPair.secretKey);
  var sigB64 = base64UrlEncode(Array.from(sig));

  // 6. 组装
  var token = signingInput + '.' + sigB64;

  _cachedToken = token;
  _cachedExp = exp;

  return token;
}

/** 字符串 → UTF-8 字节数组 */
function strToUtf8(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
    else { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
  }
  return bytes;
}

module.exports = {
  createToken: createToken,
  _clearCache: function () { _cachedToken = null; _cachedExp = 0; }
};
