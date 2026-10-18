const app = getApp();

// COS 目录，城市名与照片名都需要 URL 编码后拼接
const COS_AVATAR = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E5%A4%B4%E5%83%8F/';
const COS_PREVIEW = 'https://city-1257850266.cos.ap-guangzhou.myqcloud.com/%E9%A2%84%E8%A7%88%E5%9B%BE/';

// 列表项封面：首张照片，没有照片的城市用头像兜底
function buildCover(item) {
  const nameEncoded = encodeURIComponent(item.name);
  const photos = item.photo || [];
  return Object.assign({}, item, {
    cover: photos.length
      ? COS_PREVIEW + nameEncoded + '/' + encodeURIComponent(photos[0][0]) + '.jpg'
      : COS_AVATAR + nameEncoded + '.png',
    photoCount: photos.length,
  });
}

// 把关键字拆成单字，字与字之间允许任意字符，实现「模糊顺序匹配」
function buildPattern(keyword) {
  return '(.*)(' + keyword.split('').join(')(.*)(') + ')(.*)';
}

Page({
  data: {
    city: [],
    inputValue: "",
    emptyText: "输入城市名称开始搜索",
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
        city: [],
        emptyText: "输入城市名称开始搜索"
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
      const data = (res.result || []).map(buildCover);
      this.setData({
        city: data,
        emptyText: data.length ? "" : "没有找到相关城市"
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
