/**
 * 默认装备数据 & 天气预设
 */
var DEFAULT_GEAR = [
  // ---- 衣物层 ----
  { id: "1",  name: "Arc'teryx Beta LT 硬壳冲锋衣",          weight: 365, category: "clothing",    tags: ["冲锋衣","硬壳","防水","防风"] },
  { id: "2",  name: "Patagonia Down Sweater 羽绒服",         weight: 371, category: "clothing",    tags: ["羽绒","重保暖"] },
  { id: "3",  name: "Icebreaker Merino 200 美利奴内衣",       weight: 195, category: "clothing",    tags: ["内衣","基础层","速干"] },
  { id: "4",  name: "Darn Tough 美利奴登山袜",               weight: 65,  category: "clothing",    tags: ["袜子","速干"] },
  { id: "5",  name: "迪卡侬 MH500 速干登山裤",               weight: 290, category: "clothing",    tags: ["速干","徒步"] },
  { id: "16", name: "Outdoor Research 防风软壳裤",           weight: 340, category: "clothing",    tags: ["防风","徒步"] },
  { id: "17", name: "Mountain Hardwear 轻薄抓绒衣",          weight: 280, category: "clothing",    tags: ["轻保暖","速干"] },

  // ---- 睡眠系统 ----
  { id: "6",  name: "Zpacks Duplex 超轻帐篷",                weight: 550, category: "sleeping",    tags: ["露营","防雨"] },
  { id: "7",  name: "Therm-a-Rest NeoAir XLite 睡垫",        weight: 340, category: "sleeping",    tags: ["露营"] },
  { id: "8",  name: "WM UltraLite 睡袋 (-7°C)",              weight: 820, category: "sleeping",    tags: ["羽绒","重保暖","露营"] },

  // ---- 炊具水具 ----
  { id: "9",  name: "MSR PocketRocket 2 炉头",               weight: 73,  category: "cooking",     tags: ["炊事"] },
  { id: "10", name: "Sawyer Squeeze 净水器",                 weight: 85,  category: "cooking",     tags: ["饮水","徒步"] },
  { id: "11", name: "TOAKS 550ml 钛锅",                      weight: 72,  category: "cooking",     tags: ["炊事"] },
  { id: "gas-canister", name: "MSR IsoPro 230g 高山气罐",    weight: 356, category: "cooking",     tags: ["炊事","燃料"] },
  { id: "food-1", name: "Mountain House 冻干路粮 (单日)",     weight: 400, category: "cooking",     tags: ["路粮","徒步"] },

  // ---- 电子/导航 ----
  { id: "12", name: "Garmin InReach Mini 2 卫星通讯器",      weight: 100, category: "electronics", tags: ["导航"] },
  { id: "13", name: "Black Diamond Spot 400 头灯",           weight: 78,  category: "electronics", tags: ["照明"] },
  { id: "18", name: "Nitecore NB10000 超轻充电宝",           weight: 150, category: "electronics", tags: ["导航"] },

  // ---- 其他 ----
  { id: "14", name: "Osprey Exos 48 背包",                  weight: 1180, category: "misc",       tags: ["徒步"] },
  { id: "15", name: "Adventure Medical Kits 急救包",         weight: 230, category: "misc",        tags: ["急救"] },
  { id: "19", name: "Sea to Summit 背包防雨罩",              weight: 120, category: "misc",        tags: ["防雨"] },
  { id: "20", name: "Banana Boat SPF50 防晒霜",              weight: 88,  category: "misc",        tags: ["防晒"] },
  { id: "hotel-1", name: "身份证",                            weight: 5,   category: "misc",       tags: ["旅行"] },
  { id: "hotel-2", name: "洗漱包（牙刷/牙膏/毛巾）",          weight: 300, category: "misc",        tags: ["旅行"] },
  { id: "hotel-3", name: "多口充电头 + 数据线",               weight: 120, category: "misc",        tags: ["旅行"] },
  { id: "hotel-4", name: "换洗拖鞋",                          weight: 200, category: "misc",        tags: ["旅行"] }
];

var CATEGORY_LABELS = {
  clothing: "衣物层",
  sleeping: "睡眠系统",
  cooking: "炊具水具",
  electronics: "电子/导航",
  misc: "其他"
};

var CATEGORY_ORDER = ["clothing", "sleeping", "cooking", "electronics", "misc"];

var WEATHER_PRESETS = {
  clear_warm:  { label: "晴朗温暖",   tempRange: "18~28°C",  icon: "☀️",  conditions: ["晴朗","温暖"] },
  clear_cool:  { label: "晴朗凉爽",   tempRange: "10~18°C",  icon: "🌤️",  conditions: ["晴朗"] },
  wind_cold:   { label: "大风降温",   tempRange: "0~8°C",    icon: "🌬️",  conditions: ["降温","大风"] },
  rain_moderate:{ label: "中雨",      tempRange: "10~15°C",  icon: "🌧️",  conditions: ["降水","潮湿"] },
  rain_heavy:  { label: "大雨/暴风",  tempRange: "5~12°C",   icon: "⛈️",  conditions: ["降水","潮湿","降温","大风"] },
  snow:        { label: "降雪/严寒",  tempRange: "-8~3°C",   icon: "❄️",  conditions: ["降雪","严寒","大风","高海拔"] }
};

var ALL_TAGS = [
  "防风","防水","冲锋衣","硬壳","速干",
  "重保暖","轻保暖","羽绒","内衣","袜子",
  "基础层","徒步","露营","炊事","饮水",
  "导航","照明","急救","防晒","防雨",
  "燃料","路粮","旅行"
];

var GEAR_CATEGORY_OPTIONS = [
  { value: "clothing",    label: "衣物层" },
  { value: "sleeping",    label: "睡眠系统" },
  { value: "cooking",     label: "炊具水具" },
  { value: "electronics", label: "电子/导航" },
  { value: "misc",        label: "其他" }
];

module.exports = {
  DEFAULT_GEAR: DEFAULT_GEAR,
  CATEGORY_LABELS: CATEGORY_LABELS,
  CATEGORY_ORDER: CATEGORY_ORDER,
  WEATHER_PRESETS: WEATHER_PRESETS,
  ALL_TAGS: ALL_TAGS,
  GEAR_CATEGORY_OPTIONS: GEAR_CATEGORY_OPTIONS
};
