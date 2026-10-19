const app = getApp();

import {
  normalizeCity,
  compareByLastVisit,
  coverUrl,
  fallbackCoverUrl,
  buildCityQueries,
} from '../../utils/city';

Page({
  data: {
    city: [],
    inputValue: "",
    emptyText: "输入城市名称开始搜索",
  },

  // 输入过程中会连发请求，只认最后一次的结果
  _seq: 0,

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.pageId) {
      wx.navigateTo({
        url: '/pages/cityDetail/cityDetail?city_id=' + options.pageId,
      })
    }
  },

  async loadCity() {
    const keyword = (this.data.inputValue || '').trim();
    if (!keyword) {
      this.setData({
        city: [],
        emptyText: "输入城市名称开始搜索"
      });
      return;
    }

    const seq = ++this._seq;

    for (const query of buildCityQueries(keyword)) {
      try {
        const res = await app.mpServerless.db.collection('city').find(query, {
          limit: 100
        });

        // 期间又输入了新内容，丢弃这次的过期结果
        if (seq !== this._seq) return;

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
          city: data,
          emptyText: data.length ? "" : "没有找到相关城市"
        });
        return;
      } catch (err) {
        console.error('搜索失败，尝试下一种查询', err);
      }
    }

    if (seq !== this._seq) return;
    this.setData({
      city: [],
      emptyText: "搜索失败，请稍后再试"
    });
  },

  // 取消：返回上一页，从分享链接直接进来时回首页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/index/index',
        });
      }
    });
  },

  bindKeyInput: function (e) {
    this.setData({
      inputValue: e.detail.value || ""
    })
    this.loadCity();
  },

  // 城市同名封面缺失时换成首张照片，再失败就保持原样，避免反复触发
  onCoverError(e) {
    const index = e.currentTarget.dataset.index;
    const src = e.currentTarget.dataset.src;
    const current = e.currentTarget.dataset.current;

    if (index === undefined || !src || src === current) return;

    this.setData({
      ['city[' + index + '].cover']: src,
    });
  },

  // 搜索栏输入名字后直接进详情
  bindconfirmT: function (e) {
    const keyword = (e.detail.value || '').trim();
    if (!keyword) return;

    app.mpServerless.db.collection('city').find({
      name: keyword
    }, {}).then(res => {
      // 必须过一遍 normalizeCity：库里的 _id 是 {$oid} 形式，
      // 直接拼进 URL 会变成 [object Object]，详情页就查不到城市了
      const city = normalizeCity(res.result && res.result[0]);
      if (!city || !city._id) {
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
