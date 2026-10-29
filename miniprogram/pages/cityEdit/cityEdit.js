import {
  normalizeCity,
  previewUrl,
  originalUrl,
  coverNameUrl,
  fallbackCoverUrl,
} from '../../utils/city';
import { updatePhotos } from '../../utils/admin';
import { fetchCityById } from '../../utils/db';

Page({
  data: {
    loading: true,
    error: '',
    cityId: '',
    cityName: '',
    cover: '',
    photos: [],
    saving: false,
    dirty: false,
  },

  // 进入页面时的数据快照，用来判断有没有改动过
  _snapshot: '',

  onLoad: function (options) {
    const cityId = options.city_id;
    if (!cityId) {
      this.setData({
        loading: false,
        error: '缺少城市参数',
      });
      return;
    }

    this.setData({
      cityId: cityId,
    });
    this.loadCity(cityId);
  },

  onUnload() {
    wx.disableAlertBeforeUnload();
  },

  async loadCity(cityId) {
    let city;
    try {
      const list = await fetchCityById(cityId);
      city = normalizeCity(list[0]);
    } catch (err) {
      console.error(err);
      this.setData({
        loading: false,
        error: '加载失败，请稍后再试',
      });
      return;
    }

    if (!city) {
      this.setData({
        loading: false,
        error: '没有找到该城市',
      });
      return;
    }

    const photos = city.photos.map((item, index) => ({
      key: 'photo-' + index,
      file: item.file,
      preview: previewUrl(city.name, item.file),
      original: originalUrl(city.name, item.file),
      // 名称为空时详情页没有说明文字，用文件名当输入框占位提示，
      // 让人知道这张图对应 COS 上的哪一个文件
      title: item.title,
      date: item.date,
      spot: item.spot,
    }));

    this.setData({
      loading: false,
      cityId: city._id,
      cityName: city.name,
      cover: coverNameUrl(city.name, false),
      photos: photos,
      previewUrls: photos.map(item => item.original),
    });
    wx.setNavigationBarTitle({
      title: '编辑 · ' + city.name,
    });

    this._snapshot = serialize(photos);
  },

  // 同一个景点的照片一般是连续录入的，所以填这一行时把后面还空着的行一起带上，
  // 已经填过的行不动。只在有值时才向后填，清空不会带倒一整串
  onSpotInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photos = this.data.photos;
    if (!photos[index]) return;

    const value = e.detail.value;
    const patch = {
      ['photos[' + index + '].spot']: value,
    };

    if (value.trim()) {
      for (let i = index + 1; i < photos.length; i++) {
        if (!photos[i].spot) patch['photos[' + i + '].spot'] = value;
      }
    }

    this.setData(patch, () => {
      this.syncDirty();
    });
  },

  onTitleInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photo = this.data.photos[index];
    if (!photo) return;

    this.setData({
      ['photos[' + index + '].title']: e.detail.value,
    }, () => {
      this.syncDirty();
    });
  },

  onDateChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!this.data.photos[index]) return;

    this.setData({
      ['photos[' + index + '].date']: e.detail.value,
    }, () => {
      this.syncDirty();
    });
  },

  onClearDate(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!this.data.photos[index]) return;

    this.setData({
      ['photos[' + index + '].date']: '',
    }, () => {
      this.syncDirty();
    });
  },

  previewPhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photo = this.data.photos[index];
    if (!photo) return;

    wx.previewImage({
      current: photo.original,
      urls: this.data.previewUrls.length ? this.data.previewUrls : [photo.original],
    });
  },

  onCoverError() {
    if (!this.data.cityName) return;

    const fallback = fallbackCoverUrl({ name: this.data.cityName, photos: [] });
    if (fallback === this.data.cover) return;

    this.setData({
      cover: fallback,
    });
  },

  // 改动过就让「保存」亮起来，并给左滑返回加一道确认，避免白改
  syncDirty() {
    const dirty = serialize(this.data.photos) !== this._snapshot;
    if (dirty === this.data.dirty) return;

    this.setData({
      dirty: dirty,
    });

    if (dirty) {
      wx.enableAlertBeforeUnload({
        message: '修改还没保存，确定要离开吗？',
      });
    } else {
      wx.disableAlertBeforeUnload();
    }
  },

  onCancel() {
    if (this.data.dirty) {
      wx.showModal({
        title: '放弃修改',
        content: '修改还没保存，确定要离开吗？',
        confirmColor: '#557e56',
        success: res => {
          if (res.confirm) wx.navigateBack();
        }
      });
      return;
    }
    wx.navigateBack();
  },

  onSave() {
    if (this.data.saving || !this.data.dirty) return;

    this.setData({
      saving: true,
    });

    this.updatePhotos(this.data.cityId, 0).then(() => {
      this._snapshot = serialize(this.data.photos);
      this.setData({
        saving: false,
        dirty: false,
      });
      // 自己返回时不需要再弹「放弃修改」
      wx.disableAlertBeforeUnload();

      wx.showToast({
        title: '已保存',
        icon: 'success',
        duration: 800,
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 700);
    }).catch(err => {
      console.error(err);
      this.setData({
        saving: false,
      });
      showSaveError(err);
    });
  },

  // 写操作走云函数而不是直连数据库：city 集合对客户端是只读的，
  // 「谁能编辑」由云函数里的管理员名单决定，客户端说了不算
  updatePhotos(cityId) {
    const photos = this.data.photos.map(item => {
      const photo = {
        file: item.file,
      };
      if (item.spot) photo.spot = item.spot;
      if (item.title) photo.title = item.title;
      if (item.date) photo.date = item.date;
      return photo;
    });

    return updatePhotos(cityId, photos).then(body => {
      if (body.success) return body;

      const err = new Error(body.message || '保存失败');
      err.code = body.code || '';
      err.userId = body.userId || '';
      throw err;
    });
  },
})

// 只比较会被保存的字段，视图层的预览图地址之类不参与
function serialize(photos) {
  return JSON.stringify((photos || []).map(item => ({
    spot: item.spot || '',
    title: item.title || '',
    date: item.date || '',
  })));
}

// 云函数返回的错误码比原始报错更能说明问题，按码分别给能照做的提示
function showSaveError(err) {
  const code = err && err.code;

  if (code === 'FORBIDDEN') {
    const how = err.userId
      ? '\n\n你的 openid 是 ' + err.userId + '，把它填进 cloudfunctions/updateCityPhotos/index.js 的 ADMIN_USER_IDS 再重新部署即可。'
      : '';
    wx.showModal({
      title: '没有编辑权限',
      content: '当前微信号不在管理员名单里。' + how,
      showCancel: false,
      confirmColor: '#557e56',
    });
    return;
  }

  if (code === 'BAD_REQUEST' || code === 'NOT_FOUND') {
    wx.showModal({
      title: '保存失败',
      content: (err && err.message) || '数据没有通过服务端校验',
      showCancel: false,
      confirmColor: '#557e56',
    });
    return;
  }

  wx.showToast({
    title: '保存失败，请稍后再试',
    icon: 'none',
  });
}
