/*!
 * AIボケ査定 — 広告スロット描画 (bokesatei.com/ad.js)
 *
 * 発表ページ(/r/{date}/)側には枠と読込の2行しか書かない:
 *   <div id="ad-slot"></div>            … 上部枠
 *   <div data-ad></div>                 … 下部枠(id重複を避けるため属性で指定)
 *   <script src="/ad.js"></script>
 *
 * 発表ページはGASが日次で自動生成し、過去分は再生成しない。
 * よって「広告の中身」は必ずこのファイル1枚に閉じ込め、AD_MODE の切替だけで
 * 既存の全発表ページの広告を差し替えられる状態を保つこと(ページ側HTMLは触らない)。
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------
  // 広告モード — ここ1行の変更で全発表ページの広告が切り替わる
  //   'SELF_AD'  : 自社サービス(TateGaki)のバナー
  //   'SPONSOR'  : 個別スポンサーのバナー(SPONSOR_AD を埋めてから切替)
  //   'ADSENSE'  : Google AdSense(ADSENSE_CLIENT / ADSENSE_SLOT を埋めてから切替)
  //   'NONE'     : 広告を出さない(枠は高さゼロのまま潰れる)
  // ------------------------------------------------------------------
  var AD_MODE = 'SELF_AD';

  /** SELF_AD 用クリエイティブ */
  var SELF_AD = {
    href: 'https://tategaki.site/?utm_source=bokesatei&utm_medium=banner&utm_campaign=self_ad',
    src: '/ads/tategaki.jpg',
    alt: 'TateGaki - Google Docsで縦書き',
    width: 512,
    height: 256
  };

  /** SPONSOR 用クリエイティブ。掲載決定時に SELF_AD と同じ形で埋める(null の間は何も出さない) */
  var SPONSOR_AD = null;

  /** ADSENSE 用。審査通過後に発行値を入れる(空の間は何も出さない) */
  var ADSENSE_CLIENT = ''; // 例: 'ca-pub-0000000000000000'
  var ADSENSE_SLOT = '';   // 例: '1234567890'

  // 表示幅は最大512px・画面が狭ければ幅100%(height:auto + aspect-ratio で比率維持)。
  // a を display:block にするのは必須: inline-block だと幅が中身依存になり、
  // 画像の読込前は intrinsic 幅が無いため width:100% が解決できず枠ごと 0×0 に潰れる。
  var CSS = [
    '.ad{margin:22px 0}',
    '.ad a{display:block;max-width:512px;margin:0 auto;line-height:0;text-decoration:none}',
    '.ad img{display:block;width:100%;height:auto;border-radius:8px}'
  ].join('');

  function slots() {
    return [].slice.call(document.querySelectorAll('#ad-slot, [data-ad]'));
  }

  function injectCss() {
    if (document.getElementById('ad-css')) return;
    var style = document.createElement('style');
    style.id = 'ad-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /** 枠を空にして描画準備。textContent='' で既存内容を消す(innerHTML は使わない) */
  function reset(el) {
    el.className = 'ad';
    el.textContent = '';
  }

  /**
   * バナー1枚の <a><img></a> を組み立てる。rel="sponsored" は広告リンクの必須表記。
   * @param {boolean} eager 1枚目(お題直下・ファーストビュー)は遅延読込しない
   */
  function bannerNode(creative, eager) {
    var a = document.createElement('a');
    a.href = creative.href;
    a.target = '_blank';
    a.rel = 'noopener sponsored';

    var img = document.createElement('img');
    img.src = creative.src;
    img.alt = creative.alt;
    // width/height 属性 + aspect-ratio で読込前から高さを確定させ、レイアウトずれ(CLS)と
    // 「高さ0で遅延読込が発火しない」を同時に防ぐ
    img.width = creative.width;
    img.height = creative.height;
    img.style.aspectRatio = creative.width + '/' + creative.height;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    // 画像が落ちている場合は枠ごと消す(発表ページに壊れた画像アイコンを残さない)
    img.onerror = function () {
      if (a.parentNode) a.parentNode.textContent = '';
    };

    a.appendChild(img);
    return a;
  }

  function renderBanner(targets, creative) {
    injectCss();
    targets.forEach(function (el, i) {
      reset(el);
      el.appendChild(bannerNode(creative, i === 0));
    });
  }

  function renderAdsense(targets) {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return; // 未設定なら枠を空のままにする
    injectCss();

    if (!document.getElementById('adsense-lib')) {
      var lib = document.createElement('script');
      lib.id = 'adsense-lib';
      lib.async = true;
      lib.crossOrigin = 'anonymous';
      lib.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='
        + encodeURIComponent(ADSENSE_CLIENT);
      document.head.appendChild(lib);
    }

    targets.forEach(function (el) {
      reset(el);
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
      ins.setAttribute('data-ad-slot', ADSENSE_SLOT);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      el.appendChild(ins);
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  }

  function render() {
    var targets = slots();
    if (!targets.length) return;

    if (AD_MODE === 'ADSENSE') return renderAdsense(targets);
    if (AD_MODE === 'SELF_AD') return renderBanner(targets, SELF_AD);
    if (AD_MODE === 'SPONSOR' && SPONSOR_AD) return renderBanner(targets, SPONSOR_AD);
    // 'NONE' / 未設定のスポンサー枠 → 何も描画しない
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
