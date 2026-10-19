const app = getApp();

import {
  normalizeCity,
  avatarUrl,
  previewUrl,
  originalUrl,
  coverNameUrl,
  fallbackCoverUrl,
} from '../../utils/city';

// 地图卡片的最小可视跨度（公里）：标记点少时也要留出城市尺度的视野，
// 否则 includePoints 会把镜头怼到最大级别，只剩一个图钉看不出是哪
const MIN_VIEW_KM = 22;

// 纬度每度对应的地面距离（公里）
const KM_PER_DEGREE = 111.32;

Page({
  data: {
    loading: true,
    error: '',
    city: {},
    markers: [],
    photos: [],
    previewUrls: [],
    cover: "",
    coverOriginal: "",
    subtitle: "",
    stats: [],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    const cityId = options.city_id;
    if (!cityId) {
      this.setData({
        loading: false,
        error: '缺少城市参数',
      });
      return;
    }

    app.mpServerless.db.collection('city').find({
      _id: cityId,
    }, {}).then(res => {
      const city = normalizeCity(res.result && res.result[0]);
      if (!city) {
        this.setData({
          loading: false,
          error: '没有找到该城市',
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
          name: point.name || city.name,
          callout: {
            content: point.name || city.name,
            color: '#2C2C2A',
            fontSize: 12,
            bgColor: '#FFFFFF',
            padding: 8,
            borderRadius: 8,
            display: 'BYCLICK',
            textAlign: 'center',
          },
        };
      });
      const photos = city.photos.map(item => {
        return {
          preview: previewUrl(city.name, item.file),
          original: originalUrl(city.name, item.file),
          legend: [item.title, item.date].filter(Boolean).join(' · '),
        };
      });

      this.setData({
        loading: false,
        city: city,
        markers: markers,
        photos: photos,
        previewUrls: [coverNameUrl(city.name, true)].concat(
          photos.map(item => item.original)
        ),
        cover: coverNameUrl(city.name, false),
        coverOriginal: coverNameUrl(city.name, true),
        subtitle: buildSubtitle(city),
        stats: buildStats(city),
      }, () => {
        this.includePointsOne(false);
      });
    }).catch(err => {
      console.error(err);
      this.setData({
        loading: false,
        error: '加载失败，请稍后再试',
      });
    });
  },

  // 打开大图，可左右滑动浏览该城市的所有照片
  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;
    const urls = this.data.previewUrls;
    if (!src || !urls.length) return;

    wx.previewImage({
      current: src,
      urls: urls,
    });
  },

  // 城市同名封面缺失时改用第一张照片
  onCoverError() {
    const city = this.data.city;
    if (!city || !city.name) return;

    const fallback = fallbackCoverUrl(city);
    if (fallback === this.data.cover) return;

    this.setData({
      cover: fallback,
      coverOriginal: fallback,
    });
  },

  // fromUpdate：来自 map 的 updated 事件，说明地图确实渲染好了，
  // 这次之后就锁定视野，用户手动缩放/拖动时不再被拉回去
  includePointsOne(fromUpdate) {
    if (this._mapFitted || !this.data.markers.length) return;
    if (fromUpdate) this._mapFitted = true;

    const mapCtx = wx.createMapContext('map', this);
    mapCtx.includePoints({
      padding: [56, 28, 28, 28],
      points: buildViewPoints(this.data.markers, MIN_VIEW_KM),
    });
  },

  onMapUpdated() {
    this.includePointsOne(true);
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
      name: marker.name || name,
      address: name,
    });
  },

  onShareAppMessage: function (res) {
    if (res && res.from === 'button') {
      // 来自页面内转发按钮
      console.log(res.target)
    }
    return {
      title: this.data.city.name,
      path: '/pages/cityDetail/cityDetail?city_id=' + this.data.city._id,
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
    }
  },

  naviToMiniBili: function () {
    const bid = this.data.city.links.bili;
    const timestamp = new Date().getTime();
    const path = 'pages/video/video?__preload_=' + (timestamp * 10 + 3) +
      '&__key_=' + (timestamp * 10 + 4) + '&bvid=' + bid;

    wx.navigateToMiniProgram({
      appId: 'wx7564fd5313d24844',
      path: path,
      envVersion: 'release',
    });
  },

  naviToMiniXhs: function () {
    const xhs = this.data.city.links.xhs;
    const timestamp = new Date().getTime();
    const path = 'pages/main/note/index?height=3024&type=normal' +
      '&xsecToken=' + xhs.xsecToken + '&from=author_page&noteIdx=0&id=' + xhs.id;

    wx.navigateToMiniProgram({
      appId: 'wxb296433268a1c654',
      path: path,
      envVersion: 'release',
    });
  },
})

// 把标记点的外接矩形撑到至少 minKm 见方，返回给 includePoints 用的对角两点
function buildViewPoints(markers, minKm) {
  const lats = [];
  const lngs = [];
  markers.forEach(item => {
    const lat = Number(item.latitude);
    const lng = Number(item.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    lats.push(lat);
    lngs.push(lng);
  });
  if (!lats.length) return markers;

  const minLat = Math.min.apply(null, lats);
  const maxLat = Math.max.apply(null, lats);
  const minLng = Math.min.apply(null, lngs);
  const maxLng = Math.max.apply(null, lngs);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // 经度每度的距离随纬度收窄，高纬度城市要按比例放宽
  const cos = Math.max(Math.cos(centerLat * Math.PI / 180), 0.2);
  const halfLat = Math.max((maxLat - minLat) / 2, minKm / 2 / KM_PER_DEGREE);
  const halfLng = Math.max((maxLng - minLng) / 2, minKm / 2 / (KM_PER_DEGREE * cos));

  return [{
    latitude: centerLat - halfLat,
    longitude: centerLng - halfLng,
  }, {
    latitude: centerLat + halfLat,
    longitude: centerLng + halfLng,
  }];
}

// 封面下方的一行说明：所在地、最近到访、到访次数
function buildSubtitle(city) {
  const parts = [];

  const place = [city.country, city.region].filter(Boolean).join(' · ');
  if (place) parts.push(place);

  if (city.visits.length) {
    let text = '最近到访 ' + city.visits[0];
    if (city.visits.length > 1) {
      text += '，共 ' + city.visits.length + ' 次';
    }
    parts.push(text);
  }

  return parts.join(' · ');
}

// 概览数字，为零的项不显示
function buildStats(city) {
  const stats = [];

  if (city.photos.length) {
    stats.push({
      value: city.photos.length,
      label: '张照片',
    });
  }
  if (city.visits.length) {
    stats.push({
      value: city.visits.length,
      label: '次到访',
    });
  }
  if (city.locations.length) {
    stats.push({
      value: city.locations.length,
      label: '个地点',
    });
  }

  return stats;
}
