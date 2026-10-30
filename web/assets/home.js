// 首页：把所有城市按最近到访排序，铺成瀑布流

import { fetchAllCities, describeError } from './cloud.js';
import { compareByLastVisit, coverUrl, fallbackCoverUrl } from './city.js';

const root = document.getElementById('root');

// 城市名、景点名都来自数据库，拼进 HTML 前统一转义
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function setState(html) {
  root.innerHTML = html;
}

function renderList(cities) {
  cities.sort(compareByLastVisit);

  if (!cities.length) {
    setState('<div class="state">还没有城市数据</div>');
    return;
  }

  const cards = cities.map(city => {
    const cover = coverUrl(city);
    const fallback = fallbackCoverUrl(city);
    const meta = city.photos.length ? city.photos.length + ' 张照片' : '';

    return `<a class="card" href="./city.html?id=${encodeURIComponent(city._id)}">
      <img
        class="card-cover"
        src="${esc(cover)}"
        alt="${esc(city.name)}"
        loading="lazy"
        data-fallback="${esc(fallback)}"
      >
      <div class="card-body">
        <div class="card-title">${esc(city.name)}</div>
        <div class="card-meta">${esc(meta)}</div>
      </div>
    </a>`;
  }).join('');

  setState('<div class="waterfall">' + cards + '</div>');
  bindCoverFallback();
}

// 城市同名封面不一定存在，加载失败时换成第一张照片，保底用头像
function bindCoverFallback() {
  root.querySelectorAll('img.card-cover').forEach(img => {
    const fallback = img.dataset.fallback;
    if (!fallback) return;

    img.addEventListener('error', () => {
      if (img.src === fallback) return; // 已经换过一次，别死循环
      img.src = fallback;
    });
  });
}

function renderError(err) {
  setState(`<div class="state">
    加载失败
    <div class="state-hint">${esc(describeError(err))}</div>
  </div>`);
}

setState('<div class="state">加载中…</div>');

fetchAllCities()
  .then(renderList)
  .catch(err => {
    console.error(err);
    renderError(err);
  });
