const app = getApp();

// COS 头像目录，城市名需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';

// 把关键字拆成单字，字与字之间允许任意字符，实现「模糊顺序匹配」
function buildPattern(keyword) {
  return '(.*)(' + keyword.split('').join(')(.*)(') + ')(.*)';
}

Page({
  data: {
    city: [],
    inputValue: "",
  },

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

  loadMoreCity() {
    const keyword = (this.data.inputValue || '').trim();
    if (!keyword) {
      this.setData({
        city: []
      });
      return;
    }

    const pattern = buildPattern(keyword);
    const options = {
      sort: {
        pinyin: 1
      }
    };
    const render = res => {
      const data = (res.result || []).map(item => Object.assign({}, item, {
        avatar: COS_AVATAR + encodeURIComponent(item.name) + '.png',
      }));
      this.setData({
        city: data
      });
    };

    // 优先带 $options:'i' 忽略大小写；若服务端不支持该字段，回退为普通正则
    app.mpServerless.db.collection('city').find({
      name: {
        $regex: pattern,
        $options: 'i'
      }
    }, options).then(render).catch(() => {
      return app.mpServerless.db.collection('city').find({
        name: {
          $regex: pattern
        }
      }, options).then(render).catch(console.error);
    });
  },

  bindKeyInput: function (e) {
    this.setData({
      inputValue: e.detail.value || ""
    })
    this.loadMoreCity();
  },

  // 搜索栏输入名字后页面跳转
  bindconfirmT: function (e) {
    const keyword = (e.detail.value || '').trim();
    if (!keyword) return;

    app.mpServerless.db.collection('city').find({
      name: keyword
    }, {}).then(res => {
      const city = res.result && res.result[0];
      if (!city) {
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
