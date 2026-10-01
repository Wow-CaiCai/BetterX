import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/features/ads-layout.part.js', import.meta.url), 'utf8');
const start = source.indexOf('  function clearAdaptiveMediaLayout');
const end = source.indexOf('  function applyLayoutDomCleanup', start);
assert.ok(start >= 0 && end > start);
const declarations = ['LAYOUT_MEDIA_SELECTOR', 'LAYOUT_MEDIA_BOUNDARY_SELECTOR']
  .map((name) => source.match(new RegExp(`  const ${name} = [^\\n]+;`))[0]).join('\n');

const classes = new Set();
const properties = new Map();
const mutations = { added: 0, removed: 0, written: 0 };
const image = {
  tagName: 'IMG', naturalWidth: 0, naturalHeight: 0,
};
let grid = false;
const container = {
  classList: {
    contains: (name) => classes.has(name),
    add: (name) => { mutations.added++; classes.add(name); },
    remove: (name) => { mutations.removed++; classes.delete(name); },
  },
  style: {
    getPropertyValue: (name) => properties.get(name) || '',
    setProperty: (name, value) => { mutations.written++; properties.set(name, value); },
    removeProperty: (name) => properties.delete(name),
  },
  matches: (selector) => grid && selector.includes('BetterX-media-grid'),
  querySelector: () => null,
  querySelectorAll(selector) {
    return selector === '[data-testid="tweetPhoto"] img, video' ? [image] : [];
  },
};
const article = {
  isConnected: true,
  closest: () => null,
  querySelectorAll: () => [container],
};
container.parentElement = article;
const settings = { active: true };
const api = vm.runInNewContext(`(() => {
${declarations}
  const layoutMediaRatios = new WeakMap();
${source.slice(start, end)}
  return { getAdaptiveMediaContainer, getAdaptiveMediaRatio, stabilizeAdaptiveVideoLayout, applyAdaptiveMediaLayout };
})()`, {
  document: {},
  layoutEnhancementsActive: () => settings.active,
  getLayoutScopeElements: (_root, selector) => selector === 'article'
    ? [article] : (selector === '.BetterX-layout-media' && classes.has('BetterX-layout-media') ? [container] : []),
});

const ratioContainer = (styles = [], grid = false) => ({
  matches: (selector) => grid && selector.includes('BetterX-media-grid'),
  querySelector: () => null,
  querySelectorAll: () => styles.map((style) => ({ style })),
});
assert.equal(api.getAdaptiveMediaRatio(ratioContainer(), []), 1, '未加载时应有安全的比例回退');
assert.equal(api.getAdaptiveMediaRatio(ratioContainer([{ paddingBottom: '200%' }]), []), 0.5,
  '图片未加载前应使用原生比例占位');
assert.equal(api.getAdaptiveMediaRatio(ratioContainer([{ aspectRatio: 'auto 16 / 9' }]), []), 16 / 9);
assert.equal(api.getAdaptiveMediaRatio(ratioContainer([{ aspectRatio: '0 / 0', paddingTop: '0%' }]), []), 1,
  '无效或零比例不能产生无限宽度');
assert.equal(api.getAdaptiveMediaRatio(ratioContainer([{ paddingBottom: '600px' }]), []), 1,
  '固定像素间距不能当成比例');
assert.equal(api.getAdaptiveMediaRatio(ratioContainer([], true), [1 / 3]), 16 / 9,
  '网格应使用整体比例，而非其中某张长图的比例');
const nativeSlot = { paddingBottom: '200%' };
const cachedContainer = ratioContainer([nativeSlot]);
assert.equal(api.getAdaptiveMediaRatio(cachedContainer), 0.5);
nativeSlot.paddingBottom = '50%';
assert.equal(api.getAdaptiveMediaRatio(cachedContainer), 0.5,
  'X 修改占位层或加载视频元数据后，已确定的比例不能来回变化');
const pendingStyles = [];
const pendingContainer = ratioContainer(pendingStyles);
assert.equal(api.getAdaptiveMediaRatio(pendingContainer), 1);
pendingStyles.push({ paddingBottom: '200%' });
assert.equal(api.getAdaptiveMediaRatio(pendingContainer), 0.5,
  '空骨架的回退值不能覆盖后来首次提供的有效比例');

const boundary = { closest: () => null };
const body = { querySelectorAll: () => [boundary], parentElement: article };
const frame = { querySelectorAll: () => [], parentElement: body };
const marker = { parentElement: frame };
const scopedArticle = { contains: () => true };
assert.equal(api.getAdaptiveMediaContainer(marker, scopedArticle), frame,
  '应找到媒体外层，并在正文、作者或操作栏处停止');
const videoControls = { closest: () => marker };
frame.querySelectorAll = () => [videoControls];
assert.equal(api.getAdaptiveMediaContainer(marker, scopedArticle), frame,
  '视频内部控制栏不能阻止找到媒体外层');

let deepVideo = marker;
for (let depth = 0; depth < 18; depth++) deepVideo = { parentElement: deepVideo };
assert.equal(api.getAdaptiveMediaContainer(deepVideo, scopedArticle), frame,
  '深层播放器和外层图片标记必须找到同一容器，不能在第十层重复限制宽度');

const spacerClasses = new Set();
const siblingSpacer = {
  style: { paddingBottom: '177.258%' }, children: [],
  classList: {
    contains: (name) => spacerClasses.has(name),
    add: (name) => spacerClasses.add(name),
  },
  closest: () => null, querySelector: () => null, matches: () => false,
};
const videoFrame = { querySelector: () => ({}) };
siblingSpacer.parentElement = videoFrame;
const siblingContainer = {
  matches: () => false, querySelector: () => null,
  querySelectorAll: () => [siblingSpacer], contains: (node) => node === videoFrame,
};
api.stabilizeAdaptiveVideoLayout(siblingContainer);
assert.ok(spacerClasses.has('BetterX-layout-video-spacer'),
  '播放器的空兄弟占位层也必须锁定比例，不能遗漏原生视频的高度控制节点');
siblingSpacer.style.paddingBottom = '56.25%';
api.stabilizeAdaptiveVideoLayout(siblingContainer);
assert.equal(spacerClasses.size, 1, '播放器更改原生比例时仍应保留稳定占位样式');
spacerClasses.clear();
videoFrame.querySelector = () => null;
api.stabilizeAdaptiveVideoLayout(siblingContainer);
assert.equal(spacerClasses.size, 0, '普通图片的占位不能被当作视频占位锁定');

api.applyAdaptiveMediaLayout(article);
assert.ok(classes.has('BetterX-layout-media'));
assert.equal(properties.get('--BetterX-media-ratio'), '1');
image.naturalWidth = 600;
image.naturalHeight = 1800;
for (let refresh = 0; refresh < 20; refresh++) api.applyAdaptiveMediaLayout(article);
assert.equal(properties.get('--BetterX-media-ratio'), '1', '加载真实图片后不能重新改变预览盒大小');
assert.deepEqual(mutations, { added: 1, removed: 0, written: 1 },
  '重复刷新应保留尺寸限制，不得先撤销再应用或重复写 CSS');
grid = true;
api.applyAdaptiveMediaLayout(article);
assert.equal(properties.get('--BetterX-media-ratio'), String(16 / 9), '开启网格时才切换盒比例');
grid = false;
api.applyAdaptiveMediaLayout(article);
assert.equal(properties.get('--BetterX-media-ratio'), '1', '关闭网格应恢复原先的稳定比例');
settings.active = false;
api.applyAdaptiveMediaLayout(article);
assert.ok(!classes.has('BetterX-layout-media'), '关闭功能应恢复原生布局');
assert.equal(properties.size, 0, '关闭功能后应清除 CSS 变量');

settings.active = true;
article.closest = () => ({});
api.applyAdaptiveMediaLayout(article);
assert.ok(!classes.has('BetterX-layout-media'), '浮层和 BetterX 面板内的媒体不能被修改');

console.log('Adaptive media retains stable sizing across loading and refreshes, with reversible grid changes.');
