//app.js

// 微信云开发。env 换成你在云开发控制台建的环境 ID
const CLOUD_ENV = 'cloud1-d3g2jsmt2f7b64682';

App({
  onLaunch: async function () {
    this.checkUpdate();

    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline'],
    });

    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请在开发者工具里把基础库调到 2.2.3 以上');
      return;
    }

    // 云开发不需要显式登录：callFunction 自带调用者的 OPENID，
    // 云函数里用 cloud.getWXContext() 就能拿到，页面直接发请求即可
    wx.cloud.init({
      env: CLOUD_ENV,
      traceUser: true,
    });
  },

  // 检查并应用小程序版本更新
  checkUpdate() {
    if (!wx.canIUse('getUpdateManager')) {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用该功能，请升级到最新微信版本后重试。'
      })
      return
    }

    const updateManager = wx.getUpdateManager()
    updateManager.onCheckForUpdate(function (res) {
      if (!res.hasUpdate) return

      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已经准备好，是否重启应用？',
          success: function (res) {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })
      updateManager.onUpdateFailed(function () {
        wx.showModal({
          title: '已经有新版本了哟~',
          content: '新版本已经上线啦~，请您删除当前小程序，重新搜索打开哟~'
        })
      })
    })
  },
})
