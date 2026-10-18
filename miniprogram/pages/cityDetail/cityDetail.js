const app = getApp();

import {
  normalizeCity,
  avatarUrl,
  previewUrl,
  originalUrl,
  coverNameUrl,
} from '../../utils/city';

Page({
  data: {
    city: {},
    markers: [],
    photos: [],
    cover: "",
    coverOriginal: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const cityId = options.city_id;
    if (!cityId) {
      wx.showToast({
        title: '缺少城市参数',
        icon: 'none',
      });
      return;
    }

    app.mpServerless.db.collection('city').find({
      _id: cityId,
    }, {}).then(res => {
      const city = normalizeCity(res.result && res.result[0]);
      if (!city) {
        wx.showToast({
          title: '没有找到该城市',
          icon: 'none',
        });
        return;
      }

      const markers = city.locations.map((point, index) => {
        return {
          iconPath: avatarUrl(city.name),
          latitude: point.lat,
          longitude: point.lng,
          width: 50,
          height: 50,
          id: index,
        };
      });
      const photos = city.photos.map(item => {
        return {
          preview: previewUrl(city.name, item.file),
          original: originalUrl(city.name, item.file),
          legend: [item.title, item.date].filter(Boolean).join(' '),
        };
      });

      this.setData({
        city: city,
        markers: markers,
        photos: photos,
        cover: coverNameUrl(city.name, false),
        coverOriginal: coverNameUrl(city.name, true),
      }, () => {
        this.includePointsOne();
      });
    }).catch(console.error);
  },

  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: [src]
    })
  },

  includePointsOne() {
    if (!this.data.markers.length) return;

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

  regionchange(e) {
    console.log(e.type)
  },

  // 点击标记：用微信内置地图打开该位置
  markertap(event) {
    const markerId = event.detail && event.detail.markerId;
    const marker = this.data.markers.find(item => item.id === Number(markerId));
    if (!marker) return;

    const name = this.data.city.name;
    wx.openLocation({
      latitude: parseFloat(marker.latitude),
      longitude: parseFloat(marker.longitude),
      name: name,
      address: name
    })
  },

  controltap(e) {
    console.log(e.detail.controlId)
  },

  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
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
    if (res && res.from === 'button') {
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

  naviToMiniBili: function (e) {
    const bid = this.data.city.links.bili
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
    const id = this.data.city.links.xhs.id
    const xsecToken = this.data.city.links.xhs.xsecToken
    const timestamp = new Date().getTime()
    const path = `pages/main/note/index?height=3024&type=normal&xsecToken=${xsecToken}&from=author_page&noteIdx=0&id=${id}`
    wx.navigateToMiniProgram({
      appId: 'wxb296433268a1c654',
      path,
      envVersion: 'release',
      success(res) {}
    })
  }

})
