import {
  normalizeCity,
  compareByLastVisit,
  coverUrl,
  fallbackCoverUrl,
} from '../../utils/city';
import { checkAdmin } from '../../utils/admin';
import { fetchAllCities } from '../../utils/db';

Page({
  data: {
    columns: [[], []],
    // 编辑只对管理员开放，身份由云函数判定，默认隐藏入口
    canEdit: false,
  },

  // 排版用的内部状态，不进 data，避免无谓的视图层通信
  _columns: [[], []],
  _count: 0,
  // 从编辑页返回后置为 true，触发一次重新拉取
  _needReload: false,

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
    this.checkCanEdit();
  },

  // 问一次云函数「我是不是管理员」，不是就不显示编辑入口。
  // 判定放在服务端，客户端改数据也骗不过去
  checkCanEdit() {
    checkAdmin().then(body => {
      // 首次迁移时用这个 openid 填云函数里的 ADMIN_USER_IDS，
      // 拿到之后可以把这行日志删掉
      console.info('云开发身份', body.userId, 'isAdmin:', !!body.isAdmin);

      this.setData({
        canEdit: !!body.isAdmin,
      });
    }).catch(err => {
      // 调用失败时保持隐藏，不影响浏览，原因打到控制台
      console.error('查询编辑权限失败', err);
    });
  },

  onShow: function () {
    // 编辑页改完照片后返回，瀑布流要反映最新数据
    if (!this._needReload) return;

    this._needReload = false;
    this._columns = [[], []];
    this._count = 0;
    this.loadCity();
  },

  // 全量取回，排序放在客户端，省掉对嵌套字段排序的依赖。
  // 分页拉取由 fetchAllCities 内部处理，绕开小程序端单次 20 条的上限
  async loadCity() {
    try {
      const list = await fetchAllCities();

      const data = list
        .map(normalizeCity)
        .filter(Boolean)
        .map(item => Object.assign({}, item, {
          cover: coverUrl(item),
          coverFallback: fallbackCoverUrl(item),
          photoCount: item.photos.length,
        }));

      data.sort(compareByLastVisit);

      // 只把排版需要的 columns 推给视图层，源数据留在逻辑层
      this.appendToWaterfall(data);
    } catch (err) {
      console.error('加载城市失败', err);
    }
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

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: '/pages/cityDetail/cityDetail?city_id=' + id,
    });
  },

  // 长按卡片进入编辑页，改这座城市照片的名称和日期。
  // 先震一下，让人知道长按已经生效，不会误以为是卡住了
  goEdit(e) {
    if (!this.data.canEdit) return;

    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.vibrateShort({
      type: 'medium',
      fail: () => {},
    });
    this._needReload = true;

    wx.navigateTo({
      url: '/pages/cityEdit/cityEdit?city_id=' + id,
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
  onShareAppMessage: function () {
    return {
      title: 'circle 的旅行地图',
      path: '/pages/index/index',
    }
  },

  // 转发到朋友圈
  onShareTimeline: function () {
    return {
      title: 'circle 的旅行地图',
      path: '/pages/index/index',
    }
  },
})
