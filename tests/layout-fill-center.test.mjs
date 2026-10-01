import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/features/ads-layout.part.js', import.meta.url), 'utf8');
const start = source.indexOf('  const LAYOUT_EXCLUDED_PATHS');
const end = source.indexOf('  // ── 内容净化', start);
assert.ok(start >= 0 && end > start, '找不到布局实现');

function element(width = 0) {
  const classes = new Set();
  const mutations = { added: 0, removed: 0 };
  return {
    mutations,
    classList: {
      add: (...names) => names.forEach((name) => { mutations.added++; classes.add(name); }),
      remove: (...names) => names.forEach((name) => { mutations.removed++; classes.delete(name); }),
      contains: (name) => classes.has(name),
    },
    getBoundingClientRect: () => ({ width, height: 800 }),
  };
}

const body = element();
const root = Object.assign(element(), { id: 'react-root', parentElement: body });
const shell = Object.assign(element(), { parentElement: root });
const main = Object.assign(element(), { parentElement: shell });
const row = Object.assign(element(), { parentElement: main });
const primary = Object.assign(element(600), { parentElement: row, closest: () => main });
const left = element(275);
const nodes = [root, shell, main, row, primary, left];
const style = { isConnected: true, textContent: '' };
const state = { layoutStyleEl: style, settings: {} };
const location = { pathname: '/home' };
const api = vm.runInNewContext(`(() => {
${source.slice(start, end)}
  return { applyLayoutEnhancements };
})()`, {
  state,
  location,
  DEFAULT_SETTINGS: { timelineWidth: 600, leftbarWidth: 275 },
  clampInt: (value, min, max, fallback) => Math.min(max, Math.max(min, Number(value) || fallback)),
  getComputedStyle: () => ({ display: 'flex', visibility: 'visible' }),
  document: {
    body,
    documentElement: {},
    querySelector: () => left,
    querySelectorAll(selector) {
      if (selector === 'main [data-testid="primaryColumn"]') return [primary];
      if (selector.startsWith('.')) {
        const classes = selector.split(', ').map((name) => name.slice(1));
        return nodes.filter((node) => classes.some((name) => node.classList.contains(name)));
      }
      return [];
    },
  },
});

const defaults = {
  layoutEnabled: true,
  layoutAutoWidth: true,
  timelineWidth: 430,
  leftbarWidth: 110,
  layoutCleanNavigation: false,
  layoutHideMessageGrok: false,
};
for (const autoWidth of [true, false]) {
  for (const fillCenter of [true, false]) {
    for (const hideLeftbar of [false, true]) {
      for (const hideSidebar of [false, true]) {
        state.settings = {
          ...defaults,
          layoutAutoWidth: autoWidth,
          layoutFillCenter: fillCenter,
          layoutHideLeftbar: hideLeftbar,
          layoutHideSidebar: hideSidebar,
        };
        const savedSettings = { ...state.settings };
        api.applyLayoutEnhancements();
        const expand = fillCenter || hideLeftbar || hideSidebar;
        const css = style.textContent;
        assert.equal(css.includes('header[role="banner"] { display: none !important; }'), hideLeftbar,
          '填满开关不能强制隐藏左栏');
        assert.equal(css.includes('[data-testid="sidebarColumn"] { display: none !important; }'), hideSidebar,
          '填满开关不能强制隐藏右栏');
        assert.equal(css.includes('.BetterX-layout-shell {'), expand,
          '填满开关和侧栏隐藏都应释放外层宽度');
        assert.equal(primary.classList.contains('BetterX-layout-primary'), expand || !autoWidth);
        assert.equal(root.classList.contains('BetterX-layout-shell'), expand);
        if (expand) {
          assert.match(css, /\.BetterX-layout-primary \{\s*width: auto !important;[\s\S]*?flex: 1 1 0% !important;/,
            '中间栏应弹性占满剩余空间');
          if (!hideLeftbar) {
            const width = autoWidth ? 275 : 110;
            assert.ok(css.includes(`flex: 0 0 ${width}px !important;`),
              '可见左栏应保留原生或手动宽度，避免分走中间栏剩余空间');
          }
        } else if (!autoWidth) {
          assert.ok(css.includes('flex: 0 0 430px !important;'), '关闭填满后应恢复手动时间线宽度');
        }
        assert.deepEqual(state.settings, savedSettings, '布局切换不能改写用户的侧栏设置');
      }
    }
  }
}

state.settings = { ...defaults, layoutFillCenter: true };
api.applyLayoutEnhancements();
assert.ok(primary.classList.contains('BetterX-layout-primary'));
const beforeRefresh = nodes.map((node) => ({ ...node.mutations }));
const stableCss = style.textContent;
for (let refresh = 0; refresh < 20; refresh++) api.applyLayoutEnhancements();
assert.deepEqual(nodes.map((node) => ({ ...node.mutations })), beforeRefresh,
  '重复刷新不能撤销或重加主结构约束');
assert.equal(style.textContent, stableCss, '重复刷新不能重算出不同布局宽度');
assert.ok(stableCss.includes('max-width: min(100%, 960px, 120vh) !important;'),
  '媒体宽度应只跟随可用空间和窗口，不依赖加载比例');
const mediaWidthRule = stableCss.slice(stableCss.indexOf('article .BetterX-layout-media'),
  stableCss.indexOf('article .BetterX-layout-video-aspect'));
assert.ok(mediaWidthRule.includes('article:where(:not([role="dialog"] article, #BetterX-root article)) [data-testid="card.wrapper"]'),
  '外链卡片应通过原生标识持续约束宽度，X 覆盖脚本 class 或内联 max-width 后也不能跳变');
state.settings.layoutFillCenter = false;
api.applyLayoutEnhancements();
assert.ok(!primary.classList.contains('BetterX-layout-primary'), '关闭填满后应撤销结构类');
assert.equal(state.detectedTimelineWidth, 600, '恢复自动模式后应读取原生宽度');

for (const path of ['/messages', '/settings/profile']) {
  location.pathname = '/home';
  state.settings.layoutFillCenter = true;
  api.applyLayoutEnhancements();
  location.pathname = path;
  api.applyLayoutEnhancements();
  assert.equal(style.textContent, '', '消息页和设置页应恢复原生布局');
  assert.ok(!root.classList.contains('BetterX-layout-shell'));
}
location.pathname = '/home';
api.applyLayoutEnhancements();
state.settings.layoutEnabled = false;
api.applyLayoutEnhancements();
assert.equal(style.textContent, '', '关闭布局功能应撤销 CSS');
assert.ok(nodes.every((node) => !node.classList.contains('BetterX-layout-primary')
  && !node.classList.contains('BetterX-layout-shell')), '关闭布局功能应清理结构类');

console.log('Center fill preserves sidebar preferences in automatic and manual width modes.');
