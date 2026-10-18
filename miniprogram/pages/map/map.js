// map.js
const app = getApp();

// COS 头像目录，城市名需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';

Page({
  data: {
    markers: [],
    selected: null,
    showCard: false,
    latitude: 34.089061,
    longitude: 111.708984,
    scale: 4,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadMarkers();
  },

  loadMarkers() {
    app.mpServerless.db.collection('city').find({}, {}).then(res => {
      const allCity = res.result || [];
      const markers = [];
      let number = 0;

      allCity.forEach(city => {
        const avatar = COS_AVATAR + encodeURIComponent(city.name) + '.png';
        const points = city.markers || {};

        Object.keys(points).forEach(key => {
          const point = points[key];
          const coordinates = point && point.coordinates;
          if (!coordinates || coordinates.length < 2) return;

          markers.push({
            id: number,
            city_id: city._id,
            latitude: coordinates[0],
            longitude: coordinates[1],
            iconPath: avatar,
            width: 50,
            height: 50,
            joinCluster: true,
            // 点击才显示气泡，常显会在城市密集处糊成一片
            callout: {
              content: city.name,
              color: '#2C2C2A',
              fontSize: 12,
              bgColor: '#FFFFFF',
              padding: 8,
              borderRadius: 8,
              borderWidth: 0,
              display: 'BYCLICK',
              textAlign: 'center',
            },
            // 卡片直接取用，省掉一次查库
            name: city.name,
            avatar: avatar,
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

  // 点击标记：不直接跳走，先浮出底部卡片
  markertap(event) {
    const markerId = event.detail && event.detail.markerId;
    const marker = this.data.markers.find(item => item.id === Number(markerId));
    if (!marker) return; // 点到聚合簇时拿不到单个 marker，忽略

    this._lastMarkerTap = Date.now();
    this.setData({
      selected: marker,
      showCard: true,
    });

    // 把选中的点移到视野中央，避免被底部卡片挡住
    const mapCtx = wx.createMapContext('map', this);
    mapCtx.moveToLocation({
      latitude: marker.latitude,
      longitude: marker.longitude,
      fail: () => {},
    });
  },

  // 点地图空白处收起卡片；markertap 可能连带触发，用时间戳过滤
  tapMap() {
    if (Date.now() - (this._lastMarkerTap || 0) < 400) return;
    if (this.data.showCard) {
      this.setData({
        showCard: false
      });
    }
  },

  regionchange(e) {
    // 视角变化不处理，避免移动地图后卡片被误收起
  },

  goDetail() {
    const selected = this.data.selected;
    if (!selected) return;

    wx.navigateTo({
      url: '/pages/cityDetail/cityDetail?city_id=' + selected.city_id,
    });
  },

  // 点击回位：收起卡片并把全部足迹纳入视野
  clickBack() {
    this.setData({
      showCard: false
    });
    this.resetViewport();
  },

  // 回到自己的位置
  clickLocation() {
    const mapCtx = wx.createMapContext('map', this);
    mapCtx.moveToLocation({
      fail: () => {
        wx.showToast({
          title: '定位不可用',
          icon: 'none',
        });
      },
    });
  },

  // 把所有 marker 纳入视野并开启点聚合
  resetViewport() {
    if (!this.data.markers.length) return;

    const mapCtx = wx.createMapContext('map', this);
    mapCtx.includePoints({
      padding: [80, 60, 120, 60],
      points: this.data.markers,
      success: () => {
        mapCtx.initMarkerCluster({
          gridSize: 14,
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

  //转发功能
  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
      // 来自页面内转发按钮
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
  }
})
