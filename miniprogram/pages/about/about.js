Page({
  data: {},

  //转发功能
  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
      console.log(res.target)
    }
    return {
      title: 'circle 的旅行地图',
      path: '/pages/about/about', // 路径，传递参数到指定页面。
      success: function (res) {}
    }
  },

  // 转发到朋友圈
  onShareTimeline: function (res) {
    if (res && res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: 'circle 的旅行地图',
      path: '/pages/about/about', // 路径，传递参数到指定页面。
      success: function (res) {
        // 转发成功
        console.log("转发成功:" + JSON.stringify(res));
      },
      fail: function (res) {
        // 转发失败
        console.log("转发失败:" + JSON.stringify(res));
      }
    }
  },

  copy1: function (e) {
    wx.setClipboardData({
      data: 'yuanlq@pku.edu.cn', //需要复制的内容
    })
  },

  // 以下三个项目链接暂不在关于页展示，需要时在 about.wxml 里加回入口即可
  copy2: function (e) {
    wx.setClipboardData({
      data: 'https://gitee.com/circlelq/AssembleMiniprogram', //需要复制的内容
    })
  },

  copy3: function (e) {
    wx.setClipboardData({
      data: 'https://gitee.com/circlelq/yan-yuan-mao-su-cha-shou-ce', //需要复制的内容
    })
  },

  copy4: function (e) {
    wx.setClipboardData({
      data: 'https://github.com/Zing22/zhongdamaopu', //需要复制的内容
    })
  }
})
