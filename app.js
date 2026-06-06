// TrailReady 步履无忧 — 微信小程序入口
App({
  onLaunch() {
    // 可在此处获取系统信息
    var sysInfo = wx.getSystemInfoSync();
    this.globalData.systemInfo = sysInfo;
    console.log('🚀 TrailReady 启动成功 | 系统:', sysInfo.model);
  },
  globalData: {
    systemInfo: null
  }
});
