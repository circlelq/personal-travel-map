const app = getApp();

Page({
  data: {
    city: [],
    inputValue: "NaN",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.pageId) {
      wx.navigateTo({
        url: '/pages/city/' + options.pageId + '/' + options.pageId,
      })
    }
    this.loadMoreCity();
  },

  loadMoreCity() {
    const city = this.data.city;
    app.mpServerless.db.collection('city').find({
      name: {
        $regex: this.data.inputValue
      }
    }, {
      sort: {
        pinyin: 1
      },
      // skip: city.length,
      // limit: 20,
    }).then(res => {
      const {
        result: data
      } = res;
      this.setData({
        city: data
      });
    }).catch(console.error);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    this.loadMoreCity();
  },

  bindKeyInput: function (e) {
    if (e.detail.value == "") {
      this.setData({
        city: []
      })
    } else {
      this.setData({
        inputValue: "(?i)" + "(.*)(" + e.detail.value.split('').join(')(.*)(') + ")(.*)"
      })
      this.loadMoreCity();
    }
  },

  // 搜索栏输入名字后页面跳转
  bindconfirmT: function (e) {
    if (e.detail.value) {
      const city = this.data.city;
      app.mpServerless.db.collection('city').find({
        name: e.detail.value
      }, {}).then(res => {
        wx.navigateTo({
          url: '/pages/cityDetail/cityDetail?city_id=' + res.result[0]._id,
        })
      }).catch(console.error);
    }
  },
})