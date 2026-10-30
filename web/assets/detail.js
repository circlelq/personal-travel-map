// 城市详情页：封面 + 概览 + 按景点分组的照片

import { fetchCityById, describeError } from './cloud.js';
import {
  groupPhotos,
  buildSubtitle,
  buildStats,
  coverNameUrl,
  fallbackCoverUrl,
} from './city.js';

const root = document.getElementById('root');

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

// ---------------------------------------------------------------------------
// 全屏看图：封面在前，之后是分组摊平后的顺序，左右滑不会滑出当前景点
// ---------------------------------------------------------------------------

let gallery = [];
let galleryIndex = 0;

function openGallery(index) {
  if (!gallery.length) return;

  galleryIndex = (index + gallery.length) % gallery.length;

  const box = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');

  img.src = gallery[galleryIndex];
  document.getElementById('lightbox-counter').textContent =
    (galleryIndex + 1) + ' / ' + gallery.length;

  box.hidden = false;
}

function closeGallery() {
  document.getElementById('lightbox').hidden = true;
  document.getElementById('lightbox-img').removeAttribute('src');
}

function stepGallery(step) {
  openGallery(galleryIndex + step);
}

function setupGallery() {
  document.getElementById('lightbox-close').addEventListener('click', closeGallery);
  document.getElementById('lightbox').addEventListener('click', event => {
    // 点到图片本身不关，点背景才关
    if (event.target.id === 'lightbox') closeGallery();
  });

  document.addEventListener('keydown', event => {
    const box = document.getElementById('lightbox');
    if (box.hidden) return;

    if (event.key === 'Escape') closeGallery();
    if (event.key === 'ArrowLeft') stepGallery(-1);
    if (event.key === 'ArrowRight') stepGallery(1);
  });
}

// ---------------------------------------------------------------------------

function renderCity(city) {
  const groups = groupPhotos(city);
  const cover = coverNameUrl(city.name, false);

  // 全屏看图的一维顺序：封面 + 分组摊平后的照片
  gallery = [coverNameUrl(city.name, true)];
  groups.forEach(group => {
    group.photos.forEach(photo => gallery.push(photo.original));
  });

  const stats = buildStats(city);
  const subtitle = buildSubtitle(city);

  const statsHtml = stats.length
    ? `<div class="stats">${stats.map(item => `
        <div class="stat">
          <span class="stat-num">${esc(item.value)}</span>
          <span class="stat-label">${esc(item.label)}</span>
        </div>`).join('')}</div>`
    : '';

  // 第 0 位是封面，照片从 1 起算
  let cursor = 1;

  const groupsHtml = groups.map(group => {
    const head = group.name
      ? `<div class="spot-head">
           <div class="spot-name">${esc(group.name)}</div>
           <div class="spot-meta">${esc(group.subtitle)}</div>
         </div>`
      : '';

    // galleryIndex 从 1 起：第 0 位是封面。分组摊平的顺序与往 gallery
    // 里 push 的顺序完全一致，所以顺序累加即可，不用 indexOf 去反查
    const cells = group.photos.map(photo => `
      <div class="cell ${photo.wide ? 'cell-wide' : ''}">
        <div class="tile" data-gallery="${cursor++}">
          <img
            class="cell-img"
            src="${esc(photo.preview)}"
            alt="${esc(group.name || city.name)}"
            loading="lazy"
          >
          ${photo.legend ? `<div class="cell-legend">${esc(photo.legend)}</div>` : ''}
        </div>
      </div>`).join('');

    return `<div class="spot">${head}<div class="grid">${cells}</div></div>`;
  }).join('');

  setState(`
    <div class="detail">
      <a class="back" href="./index.html">&larr; 全部城市</a>

      <div class="hero">
        <img
          class="hero-cover"
          id="hero-cover"
          src="${esc(cover)}"
          alt="${esc(city.name)}"
          data-fallback="${esc(fallbackCoverUrl(city))}"
        >
        <div class="hero-body">
          <div class="hero-name">${esc(city.name)}</div>
          ${subtitle ? `<div class="hero-sub">${esc(subtitle)}</div>` : ''}
        </div>
      </div>

      ${statsHtml}

      ${groupsHtml ? `<div class="section">
        <div class="section-title">照片</div>
        ${groupsHtml}
      </div>` : ''}

      <div class="footer">— ${esc(city.name)} —</div>
    </div>
  `);

  bindCoverFallback();
  bindTiles();

  document.title = city.name + ' · 旅行地图';
}

// 城市同名封面不一定存在，失败了退到第一张照片，保底用头像；
// 封面本身也能点开看大图
function bindCoverFallback() {
  const img = document.getElementById('hero-cover');
  if (!img) return;

  img.addEventListener('click', () => openGallery(0));

  const fallback = img.dataset.fallback;
  if (!fallback) return;

  img.addEventListener('error', () => {
    if (img.src === fallback) return; // 已经换过一次，别死循环
    img.src = fallback;
  });
}

function bindTiles() {
  root.querySelectorAll('.tile[data-gallery]').forEach(tile => {
    tile.addEventListener('click', () => openGallery(Number(tile.dataset.gallery)));
  });
}

function renderError(err) {
  setState(`<div class="state">
    加载失败
    <div class="state-hint">${esc(describeError(err))}</div>
  </div>`);
}

setState('<div class="state">加载中…</div>');
setupGallery();

const cityId = new URLSearchParams(location.search).get('id');

if (!cityId) {
  setState('<div class="state">缺少城市参数</div>');
} else {
  fetchCityById(cityId)
    .then(city => {
      if (!city) {
        setState('<div class="state">没有找到该城市</div>');
        return;
      }
      renderCity(city);
    })
    .catch(err => {
      console.error(err);
      renderError(err);
    });
}
