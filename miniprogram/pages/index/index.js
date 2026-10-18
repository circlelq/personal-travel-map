const app = getApp();

// COS 目录，城市名与照片名都需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';
const COS_PREVIEW = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E9%A2%84%E8%A7%88%E5%9B%BE/';

Page({
  data: {
    city: [],
    columns: [[], []],
  },

  // 排版用的内部状态，不进 data，避免无谓的视图层通信
  _columns: [[], []],
  _count: 0,

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
      const data = (res.result || []).map(item => {
        const nameEncoded = encodeURIComponent(item.name);
        const photos = item.photo || [];
        return Object.assign({}, item, {
          // 首张照片作封面，没有照片的城市用头像兜底
          cover: photos.length
            ? COS_PREVIEW + nameEncoded + '/' + encodeURIComponent(photos[0][0]) + '.jpg'
            : COS_AVATAR + nameEncoded + '.png',
          photoCount: photos.length,
        });
      });

      this.setData({
        city: city.concat(data)
      });
      this.appendToWaterfall(data);
    }).catch(console.error);
  },

  // 按数据顺序左右交替落列，卡片高度由图片自身比例撑开，不追求两列底部齐平
  appendToWaterfall(items) {
    if (!items.length) return;

    items.forEach(item => {
      this._columns[this._count % 2].push(item);
      this._count++;
    });

    this.setData({
      columns: [this._columns[0].slice(), this._columns[1].slice()]
    });
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
})
