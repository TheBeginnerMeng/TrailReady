# 🏔️ TrailReady 步履无忧

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![WeChat](https://img.shields.io/badge/wechat-miniprogram-07C160.svg)](https://developers.weixin.qq.com/miniprogram/dev/framework/)

> **多日徒步行程规划 + 智能装备打包清单** — 微信小程序

TrailReady（步履无忧）是一款面向户外徒步和露营爱好者的微信小程序。它帮助你规划多日旅程、管理装备库，并基于天气预报智能生成每日打包清单，确保「带对装备，不带多余的」。

---

## ✨ 功能亮点

| 模块 | 说明 |
|------|------|
| 📋 **行程规划** | 多日路线编排，每日可独立设置目的地、住宿模式（扎营/旅馆）、天气预测 |
| 🌤️ **实时天气** | 对接**和风天气 API** v7，获取未来 30 天真实气象数据；支持地理位置直查 |
| 🎒 **装备库** | CRUD 管理个人装备，按衣物层/睡眠系统/炊具水具/电子导航/其他五大分类 |
| ✅ **智能清单** | 根据行程天数的天气、住宿类型（露营 vs 旅馆）自动生成打包推荐 |
| 🎨 **双主题切换** | 「日系山野小清新」+「暗黑机甲风」一键切换，偏好本地持久化 |
| 🗺️ **地点搜索** | 对接腾讯地图 API，输入目的地实时联想搜索 |

---

## 📸 界面预览

| 行程规划 | 装备库 | 打包清单 |
|:---:|:---:|:---:|
| ![行程](screenshots/01-trip-planner-camping.png) | ![装备](screenshots/03-gear-closet.png) | ![清单](screenshots/02-hotel-light-mode.png) |

---

## 🏗️ 项目架构

```
trailready-miniapp/
├── app.js                    # 小程序入口
├── app.json                  # 全局配置
├── app.wxss                  # 全局样式（双主题 CSS 变量）
├── project.config.json       # 微信开发者工具配置
├── pages/
│   └── index/                # 主页（行程 + 装备 + 清单 三标签页）
│       ├── index.js          # 页面逻辑（~1000 行）
│       ├── index.wxml        # 页面模板
│       ├── index.wxss        # 页面样式（全部 CSS 变量化）
│       ├── index.json        # 页面配置
│       └── tag-utils.wxs     # WXS 标签工具
├── utils/
│   ├── weatherApi.js         # 和风天气 + 腾讯地图 API 封装
│   ├── jwtSigner.js          # Ed25519 JWT 签名器（内嵌 tweetnacl）
│   ├── recommendation.js     # 打包清单推荐引擎
│   ├── mockData.js           # 预设装备数据 & 天气预设
│   ├── weatherSim.js         # 天气模拟器（无 API 时的回退方案）
│   ├── dateUtils.js          # 日期工具
│   ├── nacl-fast.min.js      # tweetnacl Ed25519 加密库
│   └── config.example.js     # API 密钥配置模板
├── screenshots/              # 截图
└── README.md
```

### 主题系统设计

通过 **CSS 变量** 实现零 `!important` 的无缝双主题切换：

- `.theme-nature` — 日系山野小清新（燕麦色底 + 森林绿主色）
- `.theme-dark` — 暗黑机甲风（深黑底色 + 荧光绿主色）

共定义 **42 个 CSS 变量**，覆盖背景、文字、边框、投影、语义色全部维度，所有样式统一引用 `var(--xxx)`，主题切换零闪烁。

---

## 🚀 快速开始

### 前置要求

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（[注册小程序](https://mp.weixin.qq.com/)）

### 1. 克隆仓库

```bash
git clone https://github.com/TheBeginnerMeng/TrailReady.git
cd TrailReady/trailready-miniapp
```

### 2. 配置 API 密钥

```bash
cd utils
cp config.example.js config.js
```

编辑 `config.js`，填入你的 API 密钥：

```js
module.exports = {
  qweatherKey:     'your-key',        // 和风天气 API Key
  qweatherHost:    'https://xxx.re.qweatherapi.com',  // 和风天气自定义 Host
  jwtCredentialId: 'your-cred-id',    // 和风天气 JWT 凭据 ID
  jwtProjectId:    'your-project-id', // 和风天气 项目 ID
  jwtPrivateKey:   '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
  mapKey:          'your-map-key',     // 腾讯地图 WebService Key
  mapSk:           'your-map-sk'       // 腾讯地图签名校验密钥
};
```

> ⚠️ `config.js` 已加入 `.gitignore`，不会被提交到仓库。

### 3. 在微信开发者工具中打开

1. 启动微信开发者工具
2. 选择「导入项目」
3. 目录选择 `trailready-miniapp/`
4. 填入你的 AppID
5. 开始调试

### 第三方 API 注册指南

| 服务 | 用途 | 注册地址 |
|------|------|----------|
| 和风天气 | 30 天天气预报、城市搜索 | https://console.qweather.com |
| 腾讯地图 | 地点联想搜索 | https://lbs.qq.com |

---

## 🔧 数据流程

```
用户操作                         数据流
──────────                    ──────────
设置目的地/天数    ──→  和风天气 API (真实天气)
                          │
                          ├── API 不可用 → weatherSim.js (模拟)
                          │
                          └── 成功 → 写入 dayPlan.weather
                                    │
检查住宿模式       ──→  是否为露营日？
                          │
                          ├── 露营 → 推荐帐篷+睡袋+炊具
                          └── 旅馆 → 推荐洗漱包+身份证
                                    │
遍历装备库         ──→  recommendation.js
                          │
                          ├── 温度匹配 → 推荐相应保暖层
                          ├── 天气匹配 → 推荐雨具/防晒
                          └── 标签匹配 → 按装备 tag 筛选
                                    │
打包清单           ←──   合并推荐结果 + 手动增删
```

---

## 📦 依赖

| 库 | 版本 | 说明 |
|----|------|------|
| [tweetnacl](https://github.com/dchest/tweetnacl-js) | ^1.0.3 | Ed25519 签名（用于和风天气 JWT 认证） |

> tweetnacl 以 inline 方式嵌入 `utils/nacl-fast.min.js`，在小程序环境下无需 npm 构建即可使用。

---

## 🛠️ 开发说明

### 天气 API 开关

在 `utils/weatherApi.js` 中：

```js
var SKIP_REAL_API = false;  // true = 使用模拟天气，false = 调用真实 API
```

开发时如果域名白名单未配置，设为 `true` 可避免反复弹窗。

### 微信小程序域名白名单

真机调试需要在微信小程序后台配置以下 `request` 合法域名：

- `https://*.qweatherapi.com`（和风天气）
- `https://apis.map.qq.com`（腾讯地图）

---

## 📄 License

MIT © TheBeginnerMeng

---

<p align="center">
  <sub>Made with ❤️ for hikers, campers & trail runners</sub>
</p>
