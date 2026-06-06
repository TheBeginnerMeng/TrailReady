/**
 * TrailReady API 配置模板
 *
 * 使用方法：
 *   1. 复制本文件为 config.js：  cp config.example.js config.js
 *   2. 在下方填入你的 API 密钥
 *   3. config.js 已被 .gitignore 忽略，不会提交到 Git
 */

module.exports = {
  // ═══════════════════════════════════════════
  // 和风天气 API（天气预报、城市搜索）
  // 获取地址：https://console.qweather.com
  // ═══════════════════════════════════════════

  /** 和风天气 API Key（控制台 → 项目管理 → 凭据 → API KEY） */
  qweatherKey: '',

  /** 和风天气自定义 API Host（控制台 → 设置 → API Host）
   *  格式：https://你的标识.re.qweatherapi.com */
  qweatherHost: '',

  // ═══════════════════════════════════════════
  // 和风天气 JWT 认证（城市查询 GeoAPI）
  // ═══════════════════════════════════════════

  /** JWT 凭据 ID（控制台 → 项目管理 → 凭据 → JWT 类型） */
  jwtCredentialId: '',

  /** JWT 项目 ID（控制台 → 项目管理 → 设置 → 项目 ID） */
  jwtProjectId: '',

  /** Ed25519 私钥 PEM
   *
   *  生成方式：
   *    openssl genpkey -algorithm ED25519 -out ed25519-private.pem
   *    openssl pkey -pubout -in ed25519-private.pem > ed25519-public.pem
   *
   *  将公钥上传到和风天气控制台 → 凭据页面
   *  私钥内容（包括 BEGIN/END 行）填入下方
   */
  jwtPrivateKey: '',

  // ═══════════════════════════════════════════
  // 腾讯地图 WebService API（地点联想搜索）
  // 获取地址：https://lbs.qq.com
  // ═══════════════════════════════════════════

  /** 腾讯地图 WebService API Key（控制台 → 应用管理 → 创建应用） */
  mapKey: '',

  /** 腾讯地图 SK（签名校验密钥，控制台 → Key 管理 → 签名校验）
   *  如不需要签名校验可留空 */
  mapSk: ''
};
