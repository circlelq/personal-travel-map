Page({
  data: {},

  //转发功能
  onShareAppMessage: function () {
    return {
      title: 'circle 的旅行地图',
      path: '/pages/about/about',
    }
  },

  // 转发到朋友圈
  onShareTimeline: function () {
    return {
      title: 'circle 的旅行地图',
      path: '/pages/about/about',
    }
  },

  copy1: function () {
    wx.setClipboardData({
      data: 'yuanlq@pku.edu.cn',
    })
  },

  copy5: function () {
    wx.setClipboardData({
      data: 'https://github.com/circlelq/personal-travel-map',
    })
  }
})
