// map.js
const app = getApp();

// COS 头像目录，城市名需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';

Page({

  data: {
    markers: []
  },

  regionchange(e) {
    console.log(e.type)
  },

  markertap(event) {
    const markerId = event.detail && event.detail.markerId;
    const marker = this.data.markers.find(item => item.id === Number(markerId));
    if (!marker) return;

    wx.navigateTo({
      url: '/pages/cityDetail/cityDetail?city_id=' + marker.city_id,
      success: () => {
        console.log("成功跳转");
      },
    })
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    app.mpServerless.db.collection('city').find({}, {}).then(res => {
      const allCity = res.result || [];
      const markers = [];
      let number = 0;

      allCity.forEach(city => {
        const points = city.markers || {};
        Object.keys(points).forEach(key => {
          const point = points[key];
          const coordinates = point && point.coordinates;
          if (!coordinates || coordinates.length < 2) return;

          markers.push({
            iconPath: COS_AVATAR + encodeURIComponent(city.name) + '.png',
            latitude: coordinates[0],
            longitude: coordinates[1],
            joinCluster: true,
            width: 50,
            height: 50,
            city_id: city._id,
            id: number,
          });
          number++;
        });
      });

      // 一次性 setData，避免每个 marker 触发一次视图层通信
      this.setData({
        markers: markers
      }, () => {
        this.resetViewport();
      });
    }).catch(console.error);
  },

  controltap(e) {
    console.log(e.detail.controlId)
  },

  //转发功能
  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
      console.log(res.target)
    }
    return {
      title: 'circle 的旅行地图',
      path: '/pages/map/map', // 路径，传递参数到指定页面。
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
      path: '/pages/map/map', // 路径，传递参数到指定页面。
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

  // 把所有 marker 纳入视野并开启点聚合
  resetViewport() {
    if (!this.data.markers.length) return;

    const mapCtx = wx.createMapContext('map', this);
    mapCtx.includePoints({
      padding: [60, 36, 0, 36],
      points: this.data.markers,
      success: () => {
        console.log('includePoints success');
        mapCtx.initMarkerCluster({
          gridSize: 14,
          success: () => {
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
  },

  // 点击回位
  clickBack() {
    this.resetViewport();
  }
})
