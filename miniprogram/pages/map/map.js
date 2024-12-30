// map.js
const app = getApp();

Page({

  data: {
    markers: [],
    allCity: {}
  },
  regionchange(e) {
    console.log(e.type)
  },
  markertap(event) {
    console.log(event.detail.markerId)
    const markers = this.data.markers;
    for (let i = 0; i < markers.length; i++) {
      if (event.markerId === markers[i].id) {
        wx.navigateTo({
          url: '/pages/cityDetail/cityDetail' + '?city_id=' + markers[i].city_id,
          success: (result) => {
            console.log("成功跳转");
          },
          fail: (res) => {},
          complete: (res) => {},
        })
      }
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    app.mpServerless.db.collection('city').find({}, {}).then(res => {
      const {
        result: allCity
      } = res;
      this.setData({
        allCity: allCity
      });
    }).then(res => {
      var number = 0
      for (var cityNum in this.data.allCity) {
        for (var i in this.data.allCity[cityNum].markers) {
          var marker = [{
            iconPath: "https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/" + encodeURIComponent(this.data.allCity[cityNum].name) + ".png",
            latitude: this.data.allCity[cityNum].markers[i].coordinates[0],
            longitude: this.data.allCity[cityNum].markers[i].coordinates[1],
            joinCluster: true,
            width: 50,
            height: 50,
            city_id: this.data.allCity[cityNum]._id,
            id: number,
          }]
          this.setData({
            markers: this.data.markers.concat(marker),
          });
          number++
        }
      }
    }).then(res => {
      const mapCtx = wx.createMapContext('map', this);
      mapCtx.includePoints({
        padding: [60, 36, 0, 36],
        points: this.data.markers,
        success: res => {
          console.log('includePoints success');
          mapCtx.initMarkerCluster({
            gridSize: 14,
            success: res => {
              console.log('initMarkerCluster success');
            },
            fail: err => {
              console.log('initMarkerCluster fail', err);
            }
          });
        },
        fail: err => {
          console.log('includePoints fail', err);
        }
      });
    })
  },

  controltap(e) {
    console.log(e.detail.controlId)
  },
  //转发功能
  onShareAppMessage: function () {
    let users = wx.getStorageSync('user');
    if (res.from === 'button') {}
    return {
      path: 'pages/map/map', // 路径，传递参数到指定页面。
      success: function (res) {}
    }
  },

  // 转发到朋友圈
  onShareTimeline: function (res) {
    if (ops.from === 'button') {
      // 来自页面内转发按钮
      console.log(ops.target)
    }
    return {
      path: 'pages/map/map', // 路径，传递参数到指定页面。
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

  // 点击回位
  clickBack() {
    const mapCtx = wx.createMapContext('map', this);
    mapCtx.includePoints({
      padding: [60, 36, 0, 36],
      points: this.data.markers,
      success: res => {
        console.log('includePoints success');
        mapCtx.initMarkerCluster({
          gridSize: 14,
          success: res => {
            console.log('initMarkerCluster success');
          },
          fail: err => {
            console.log('initMarkerCluster fail', err);
          }
        });
      },
      fail: err => {
        console.log('includePoints fail', err);
      }
    });
  }
})