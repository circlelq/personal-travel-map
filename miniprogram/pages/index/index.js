const app = getApp();

import {
  normalizeCity,
  compareByLastVisit,
  coverUrl,
  fallbackCoverUrl,
} from '../../utils/city';

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
    this.loadCity();
  },

  // 城市数量有限，一次取完，排序放在客户端，省掉对嵌套字段排序的依赖
  loadCity() {
    app.mpServerless.db.collection('city').find({}, {
      limit: 100,
    }).then(res => {
      const data = (res.result || [])
        .map(normalizeCity)
        .filter(Boolean)
        .map(item => Object.assign({}, item, {
          cover: coverUrl(item),
          coverFallback: fallbackCoverUrl(item),
          photoCount: item.photos.length,
        }));

      data.sort(compareByLastVisit);

      this.setData({
        city: data
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

  // 城市同名封面缺失时换成首张照片，再失败就保持原样，避免反复触发
  onCoverError(e) {
    const path = e.currentTarget.dataset.path;
    const src = e.currentTarget.dataset.src;
    const current = e.currentTarget.dataset.current;

    if (!path || !src || src === current) return;

    this.setData({
      [path]: src,
    });
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
        console.log("转发成功:" + JSON.stringify(res));
      },
      fail: function (res) {
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
        console.log("转发成功:" + JSON.stringify(res));
      },
      fail: function (res) {
        console.log("转发失败:" + JSON.stringify(res));
      }
    }
  },
})
