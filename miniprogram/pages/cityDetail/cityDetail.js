var city_id = "1";
const app = getApp();

Page({
  data: {
    city: {},
    markers: [],
    photoscr: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    city_id = options.city_id;
    app.mpServerless.db.collection('city').find({
      _id: city_id,
    }, {}).then(res => {
      this.setData({
        city: res.result[0],
        photoscr: "https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E9%A2%84%E8%A7%88%E5%9B%BE/" + res.result[0].name + "/" + res.result[0].name + ".jpg"
      });
    }).then(res => {
      var number = 0
      for (var i in this.data.city.markers) {
        var marker = [{
          iconPath: "https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/" + encodeURIComponent(this.data.city.name) + ".png",
          latitude: this.data.city.markers[i].coordinates[0],
          longitude: this.data.city.markers[i].coordinates[1],
          width: 50,
          height: 50,
          id: number,
        }]
        this.setData({
          markers: this.data.markers.concat(marker),
        });
        number++
      }
    });
  },

  includePointsOne() {
    const mapCtx = wx.createMapContext('map', this);
    mapCtx.includePoints({
      padding: [60, 36, 0, 36],
      points: this.data.markers,
      success: res => {
        console.log('includePoints success');
      },
      fail: err => {
        console.log('includePoints fail', err);
      }
    });
  },


  onShow: function (options) {

  },


  regionchange(e) {
    console.log(e.type)
  },
  markertap(e) {
    console.log(e.detail.markerId)
  },
  controltap(e) {
    console.log(e.detail.controlId)
  },

  onShareAppMessage: function (res) {
    if (res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: this.data.city.name,
      path: '/pages/cityDetail/cityDetail?city_id=' + this.data.city._id,
      success: function (res) {
        // 转发成功
      },
      fail: function (res) {
        // 转发失败
      }
    }
  },

  onShareTimeline: function (res) {
    if (res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: this.data.city.name,
      path: '/pages/cityDetail/cityDetail?city_id=' + this.data.city._id,
      success: function (res) {
        // 转发成功
      },
      fail: function (res) {
        // 转发失败
      }
    }
  },


  markertap(event) {
    console.log(event.detail.markerId)
    const markers = this.data.markers;
    for (let i = 0; i < markers.length; i++) {
      if (event.markerId === markers[i].id) {
        wx.openLocation({
          latitude: parseFloat(markers[i].latitude),
          longitude: parseFloat(markers[i].longitude),
          name: markers[i].name,
          address: markers[i].name
        })

      }
    }
  },

  copyBili: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['bili'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  copyWeibo: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['weibo'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  copyWechat: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['wechat'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  copyMail: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['mail'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  copyShu: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['shu'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  copyDouyin: function (e) {
    var self = this;
    wx.setClipboardData({
      data: this.data.city.officialAccount['douyin'], //需要复制的内容
      success: function (res) {
        console.log("复制成功")
      }
    })
  },
  naviToMiniBili: function (e) {
    const bid = this.data.city.officialAccount['bili']
    const timestamp = new Date().getTime()
    const path = `pages/video/video?__preload_=${timestamp*10+3}&__key_=${timestamp*10+4}&bvid=${bid}`
    wx.navigateToMiniProgram({
      appId: 'wx7564fd5313d24844',
      path,
      envVersion: 'release',
      success(res) {}
    })
  },
  naviToMiniXhs: function (e) {
    const id = this.data.city.officialAccount['xhs']['id']
    const xsecToken = this.data.city.officialAccount['xhs']['xsecToken']
    const timestamp = new Date().getTime()
    const path = `pages/main/note/index?height=3024&type=normal&xsecToken=${xsecToken}&from=author_page&noteIdx=0&id=${id}`
    console.log(path)
    wx.navigateToMiniProgram({
      appId: 'wxb296433268a1c654',
      // path: ,
      path,
      envVersion: 'release',
      success(res) {}
    })
  },
  naviToMini1: function (e) {
    wx.navigateToMiniProgram({
      appId: this.data.city.officialAccount['miniprogram1'],
      // path: 'pages/index/index',
      envVersion: 'release',
      success(res) {
        // 打开成功
      }
    })
  }

})