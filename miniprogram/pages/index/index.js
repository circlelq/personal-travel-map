const app = getApp();

// COS 头像目录，城市名需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';

Page({
  data: {
    city: [],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.pageId) {
      wx.navigateTo({
        url: '/pages/cityDetail/cityDetail?city_id=' + options.pageId,
      })
    }
    this.loadMoreCity();
  },

  loadMoreCity() {
    const city = this.data.city;
    app.mpServerless.db.collection('city').find({}, {
      sort: {
        pinyin: 1
      },
      skip: city.length,
      limit: 20,
    }).then(res => {
      const data = (res.result || []).map(item => Object.assign({}, item, {
        avatar: COS_AVATAR + encodeURIComponent(item.name) + '.png',
      }));
      this.setData({
        city: city.concat(data)
      });
    }).catch(console.error);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    this.loadMoreCity();
  },

  //转发此页面的设置
  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: 'circle 的旅行地图',
      path: '/pages/index/index', // 路径，传递参数到指定页面。
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

  // 转发到朋友圈
  onShareTimeline: function (res) {
    if (res && res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: 'circle 的旅行地图',
      path: '/pages/index/index', // 路径，传递参数到指定页面。
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

  // 搜索栏输入名字后页面跳转
  bindconfirmT: function (e) {
    const keyword = (e.detail.value || '').trim();
    if (!keyword) return;

    app.mpServerless.db.collection('city').find({
      name: keyword
    }, {}).then(res => {
      const city = res.result && res.result[0];
      if (!city) {
        wx.showToast({
          title: '没有找到该城市',
          icon: 'none',
        });
        return;
      }
      wx.navigateTo({
        url: '/pages/cityDetail/cityDetail?city_id=' + city._id,
      })
    }).catch(console.error);
  },
})
