const app = getApp();

// COS 目录，城市名与照片名都需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';
const COS_PREVIEW = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E9%A2%84%E8%A7%88%E5%9B%BE/';
const COS_ORIGINAL = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%8E%9F%E5%9B%BE/';

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
      const city = res.result && res.result[0];
      if (!city) {
        wx.showToast({
          title: '没有找到该城市',
          icon: 'none',
        });
        return;
      }

      const nameEncoded = encodeURIComponent(city.name);
      const points = Object.keys(city.markers || {})
        .map(key => (city.markers[key] || {}).coordinates)
        .filter(coordinates => coordinates && coordinates.length >= 2);
      const markers = points.map((coordinates, index) => {
        return {
          iconPath: COS_AVATAR + nameEncoded + '.png',
          latitude: coordinates[0],
          longitude: coordinates[1],
          width: 50,
          height: 50,
          id: index,
        };
      });
      const photos = (city.photo || []).map(item => {
        const photoName = encodeURIComponent(item[0]);
        return {
          preview: COS_PREVIEW + nameEncoded + '/' + photoName + '.jpg',
          original: COS_ORIGINAL + nameEncoded + '/' + photoName + '.jpg',
          legend: [item[1], item[2]].filter(Boolean).join(' '),
        };
      });

      this.setData({
        city: city,
        markers: markers,
        photos: photos,
        cover: COS_PREVIEW + nameEncoded + '/' + nameEncoded + '.jpg',
        coverOriginal: COS_ORIGINAL + nameEncoded + '/' + nameEncoded + '.jpg',
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
    wx.navigateToMiniProgram({
      appId: 'wxb296433268a1c654',
      path,
      envVersion: 'release',
      success(res) {}
    })
  }

})
