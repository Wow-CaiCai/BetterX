  const AD_LABELS = ['广告', '推广', 'Ad', 'Promoted', 'Publicidad', 'Anúncio', '広告', '광고'];
  // X 新增的独立程序化广告位（Google SafeFrame），不属于 article，需隐藏整个卡片以免留下空白。
  const STANDALONE_AD_SELECTOR = '[data-testid="whoToFollowSspAd"], [data-testid$="SspAd"]';
  const PREMIUM_UPSELL_SELECTOR = 'aside[role="complementary"][aria-label], a[href*="/i/premium_sign_up"]';
  const PREMIUM_UPSELL_LABELS = new Set([
    '订阅 Premium', '訂閱 Premium', 'Subscribe to Premium',
    'プレミアムにサブスクライブ', 'Premium 구독하기',
  ]);
  const PREMIUM_UPSELL_ACTION_LABELS = new Set([
    '订阅', '訂閱', 'Subscribe', 'サブスクライブ', '구독하기',
  ]);
  const NFL_SCORES_SELECTOR = '[data-testid="nfl_scores_sidebar"]';
  function isAdArticle(article) {
    if (!article || !article.querySelector) return false;
    const cell = article.closest('[data-testid="cellInnerDiv"]') || article;
    // 特征1：广告展示追踪像素（只有推广帖才有；top/right/bottom/left-impression-pixel）。
    // 注意：视频帖也会用 placementTracking 包裹播放器，但不含 impression-pixel，故不能用 placementTracking 判定。
    if (cell.querySelector && cell.querySelector('[data-testid$="impression-pixel"]')) return true;
    // 特征2：头部独立的“广告”标签（排除正文里恰好提到“广告”的情况）
    const nodes = article.querySelectorAll('span, div[dir="ltr"]');
    for (const el of nodes) {
      if (el.closest && el.closest('[data-testid="tweetText"]')) continue;
      const t = (el.textContent || '').trim();
      if (t && t.length <= 12 && AD_LABELS.includes(t)) return true;
    }
    return false;
  }

  function hideAdElement(article) {
    const cell = article.closest('[data-testid="cellInnerDiv"]') || article;
    if (cell && cell.classList) cell.classList.add('BetterX-ad-hidden');
    else if (cell) cell.style.display = 'none';
  }

  function hideStandaloneAdElement(element) {
    if (!element) return;
    const container = element.matches && element.matches(STANDALONE_AD_SELECTOR)
      ? element
      : (element.closest ? element.closest(STANDALONE_AD_SELECTOR) : null);
    if (!container) return;
    if (container.classList) container.classList.add('BetterX-ad-hidden');
    else if (container.style) container.style.display = 'none';
  }

  function hidePremiumUpsellElement(element) {
    if (!element || !element.closest) return;
    const aside = element.matches && element.matches('aside[role="complementary"]')
      ? element
      : element.closest('aside[role="complementary"]');
    if (aside) {
      const label = (aside.getAttribute('aria-label') || '').trim();
      const hasPremiumSignupLink = !!aside.querySelector('a[href*="/i/premium_sign_up"]');
      if (!hasPremiumSignupLink && !PREMIUM_UPSELL_LABELS.has(label)) return;

      // PC 端 aside 外还有一层带边框和留白的卡片容器；仅在它没有其他内容时一并隐藏。
      const wrapper = aside.parentElement && aside.parentElement.children.length === 1
        ? aside.parentElement
        : aside;
      wrapper.classList.add('BetterX-ad-hidden');
      return;
    }

    // 移动端只有一个“订阅”链接，没有 aside；动作文本校验可避免误伤普通 Premium 导航入口。
    const signupLink = element.matches && element.matches('a[href*="/i/premium_sign_up"]')
      ? element
      : element.closest('a[href*="/i/premium_sign_up"]');
    const actionLabel = (signupLink && (signupLink.innerText || signupLink.textContent) || '').trim();
    if (!signupLink || !PREMIUM_UPSELL_ACTION_LABELS.has(actionLabel)) return;

    // 提供的移动端 DOM 中按钮外有三层独占包装；逐层确认没有兄弟元素后再隐藏，避免留下占位。
    let wrapper = signupLink;
    for (let depth = 0; depth < 3; depth++) {
      const parent = wrapper.parentElement;
      if (!parent || parent.children.length !== 1
          || parent.matches('body, main, header, nav, [role="navigation"]')) break;
      wrapper = parent;
    }
    wrapper.classList.add('BetterX-ad-hidden');
  }

  function sweepStandaloneAds(root) {
    if (!state.settings.hideAds) return;
    const scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(STANDALONE_AD_SELECTOR)) hideStandaloneAdElement(scope);
    if (scope.closest) hideStandaloneAdElement(scope.closest(STANDALONE_AD_SELECTOR));
    scope.querySelectorAll(STANDALONE_AD_SELECTOR).forEach(hideStandaloneAdElement);
    if (scope.matches && scope.matches(PREMIUM_UPSELL_SELECTOR)) hidePremiumUpsellElement(scope);
    if (scope.closest) hidePremiumUpsellElement(scope.closest(PREMIUM_UPSELL_SELECTOR));
    scope.querySelectorAll(PREMIUM_UPSELL_SELECTOR).forEach(hidePremiumUpsellElement);
  }

  function sweepAds(root) {
    if (!state.settings.hideAds) return;
    getArticlesFromScope(root).forEach((a) => {
      if (isAdArticle(a)) hideAdElement(a);
    });
    sweepStandaloneAds(root);
  }

  function unhideAds() {
    document.querySelectorAll('.BetterX-ad-hidden').forEach((el) => el.classList.remove('BetterX-ad-hidden'));
  }

  function applyAdHiding() {
    if (state.settings.hideAds) sweepAds();
    else unhideAds();
  }

  function getNflEntryContainer(element) {
    if (!element) return null;
    const marker = element.matches && element.matches(NFL_SCORES_SELECTOR)
      ? element
      : (element.closest ? element.closest(NFL_SCORES_SELECTOR) : null);
    if (!marker) return null;
    // nfl_scores_sidebar 是卡片内的追踪层；其父节点才包含标题、球队和比赛入口。
    const container = marker.parentElement;
    return container && !container.matches('body, main, [data-testid="sidebarColumn"]')
      ? container
      : marker;
  }

  function hideNflEntryElement(element) {
    const container = getNflEntryContainer(element);
    if (container && container.classList) container.classList.add('BetterX-nfl-hidden');
  }

  function sweepNflEntries(root = document) {
    if (!state.settings.hideNfl) return;
    const scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(NFL_SCORES_SELECTOR)) hideNflEntryElement(scope);
    if (scope.closest) hideNflEntryElement(scope.closest(NFL_SCORES_SELECTOR));
    scope.querySelectorAll(NFL_SCORES_SELECTOR).forEach(hideNflEntryElement);
  }

  function unhideNflEntries() {
    document.querySelectorAll('.BetterX-nfl-hidden')
      .forEach((element) => element.classList.remove('BetterX-nfl-hidden'));
  }

  function applyNflHiding() {
    if (state.settings.hideNfl) sweepNflEntries();
    else unhideNflEntries();
  }
  // ── 界面简化与宽屏 ─────────────────────────────────────────────────
  // 参考 X/Twitter Clean-up & Wide Layout Display；改用可逆 CSS 和现有批处理观察器，
  // 不复制其无防抖的全页 MutationObserver，也不写入不可恢复的内联宽度。
  const LAYOUT_EXCLUDED_PATHS = ['/messages', '/settings'];
  const LAYOUT_NAV_LABELS = new Set([
    '书签', '書籤', 'Bookmarks', 'ブックマーク', '북마크',
    '工作机会', '工作機會', 'Careers', '求人', '채용 정보',
    '创作者工作室', '創作者工作室', 'Creator Studio', 'クリエイタースタジオ', '크리에이터 스튜디오',
    '社区', '社群', 'Communities', 'コミュニティ', '커뮤니티',
    '商业', '商業', 'Business', 'ビジネス', '비즈니스',
    'Premium', 'プレミアム', '认证组织', '認證組織', 'Verified Orgs', '認証済み組織', '인증된 조직',
    '营利', '營利', 'Monetization', '収益化', '수익 창출', '广告', '廣告', 'Ads', '広告', '광고',
  ]);
  const LAYOUT_SUBSCRIBE_LABELS = new Set([
    '订阅 Premium', '訂閱 Premium', 'Subscribe to Premium', 'プレミアムにサブスクライブ', 'Premium 구독하기',
  ]);
  const LAYOUT_FOOTER_LABELS = new Set(['页脚', '頁尾', 'Footer', 'フッター', '바닥글']);
  const LAYOUT_SHOW_MORE_LABELS = new Set(['显示更多', '顯示更多', 'Show more', 'さらに表示', '더 보기']);
  const LAYOUT_STRUCTURE_SELECTOR = 'main, header[role="banner"], [data-testid="primaryColumn"]';
  const LAYOUT_STRUCTURE_CLASSES = [
    'BetterX-layout-primary', 'BetterX-layout-row', 'BetterX-layout-main',
    'BetterX-layout-shell', 'BetterX-layout-left-width-target',
  ];
  const LAYOUT_MEDIA_SELECTOR = '[data-testid="tweetPhoto"], [data-testid="videoComponent"], [data-testid="card.layoutLarge.media"], [data-testid="ScrollSnap-List"], .BetterX-native-media-grid';
  const LAYOUT_MEDIA_BOUNDARY_SELECTOR = '[data-testid="tweetText"], [data-testid="User-Name"], [data-testid="Tweet-User-Avatar"], [data-testid="card.wrapper"], [role="group"], article';
  const layoutMediaRatios = new WeakMap();
  const LAYOUT_DOM_CLASSES = [
    'BetterX-layout-clean-hidden', 'BetterX-layout-showmore-hidden', 'BetterX-layout-media',
    'BetterX-layout-video-aspect', 'BetterX-layout-video-spacer', ...LAYOUT_STRUCTURE_CLASSES,
  ];

  function layoutEnhancementsActive() {
    return !!state.settings.layoutEnabled
      && !LAYOUT_EXCLUDED_PATHS.some((path) => location.pathname.startsWith(path));
  }

  function ensureLayoutStyle() {
    let style = state.layoutStyleEl;
    if (!style || !style.isConnected) {
      style = document.getElementById('BetterX-layout-style') || document.createElement('style');
      style.id = 'BetterX-layout-style';
      if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
      state.layoutStyleEl = style;
    }
    return style;
  }

  function clearLayoutClasses(classes) {
    const selector = classes.map((className) => `.${className}`).join(', ');
    document.querySelectorAll(selector).forEach((el) => el.classList.remove(...classes));
  }

  function clearLayoutDomClasses() {
    clearAdaptiveMediaLayout();
    clearLayoutClasses(LAYOUT_DOM_CLASSES);
  }
  function clearLayoutStructureClasses() { clearLayoutClasses(LAYOUT_STRUCTURE_CLASSES); }

  function getLayoutElements() {
    const primaryCandidates = [...document.querySelectorAll('main [data-testid="primaryColumn"]')];
    const primary = primaryCandidates.find((el) => {
      const rect = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && css.display !== 'none' && css.visibility !== 'hidden';
    }) || primaryCandidates[0] || null;
    const main = primary ? primary.closest('main') : [...document.querySelectorAll('main[role="main"]')].find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
    }) || null;
    const row = primary ? primary.parentElement : null;
    // X 当前结构中，真正随导航栏改变宽度的是 header 下第二层 div。
    const leftWidthTarget = document.querySelector('header[role="banner"] > div > div')
      || document.querySelector('header[role="banner"] > div:first-child');
    return { primary, main, row, leftWidthTarget };
  }

  function updateDetectedLayoutWidthInputs() {
    if (state.settings.layoutAutoWidth === false) return;
    if (state.timelineWidthEl && document.activeElement !== state.timelineWidthEl && state.detectedTimelineWidth) {
      state.timelineWidthEl.value = String(state.detectedTimelineWidth);
    }
    if (state.leftbarWidthEl && document.activeElement !== state.leftbarWidthEl && state.detectedLeftbarWidth) {
      state.leftbarWidthEl.value = String(state.detectedLeftbarWidth);
    }
  }

  function detectNativeLayoutWidths(elements) {
    const { primary, leftWidthTarget } = elements;
    // 结构类已经生效时保留首次读到的原生值，避免把“填满后”的宽度误认为原生宽度。
    if (primary && !primary.classList.contains('BetterX-layout-primary')) {
      const width = Math.round(primary.getBoundingClientRect().width);
      if (width >= 300 && width <= 3000) state.detectedTimelineWidth = width;
    }
    if (leftWidthTarget && !(primary && primary.classList.contains('BetterX-layout-primary'))
        && !leftWidthTarget.classList.contains('BetterX-layout-left-width-target')) {
      const width = Math.round(leftWidthTarget.getBoundingClientRect().width);
      if (width >= 120 && width <= 600) state.detectedLeftbarWidth = width;
    }
    updateDetectedLayoutWidthInputs();
  }

  function bindLayoutStructureClasses(elements, needsStructure, expandCenter, manualWidth) {
    const { primary, main, row, leftWidthTarget } = elements;
    const targets = new Map(LAYOUT_STRUCTURE_CLASSES.map((name) => [name, new Set()]));
    const retain = (name, node) => { if (node) targets.get(name).add(node); };
    if (needsStructure) {
      retain('BetterX-layout-primary', primary);
      retain('BetterX-layout-row', row);
      retain('BetterX-layout-main', main);
      if (manualWidth) retain('BetterX-layout-left-width-target', leftWidthTarget);
    }
    if (needsStructure && expandCenter && main) {
      // 填满中间栏或隐藏任意侧栏后，贯通到 #react-root，释放剩余空间的宽度限制。
      let ancestor = row ? row.parentElement : main.parentElement;
      while (ancestor && ancestor !== document.body) {
        if (ancestor !== main) retain('BetterX-layout-shell', ancestor);
        if (ancestor.id === 'react-root') break;
        ancestor = ancestor.parentElement;
      }
    }
    // 常规刷新保留现有约束，仅在节点或设置改变时增删，避免恢复原生布局再扩宽。
    targets.forEach((nodes, name) => {
      document.querySelectorAll(`.${name}`).forEach((node) => {
        if (!nodes.has(node)) node.classList.remove(name);
      });
      nodes.forEach((node) => {
        if (!node.classList.contains(name)) node.classList.add(name);
      });
    });
  }

  function buildLayoutCss(options) {
    const {
      autoWidth, timelineWidth, leftbarWidth, effectiveLeftbarWidth,
      hideLeftbar, hideSidebar, expandCenter,
    } = options;
    const rules = [
      '.BetterX-layout-clean-hidden, .BetterX-layout-showmore-hidden { display: none !important; }',
      // 外链卡片直接使用原生标识：React 会覆盖 class 和内联 max-width，不能只依赖脚本标记。
      // 只按可用空间和窗口限制宽度；媒体加载、播放器比例变化不会再改变整块宽度。
      `article .BetterX-layout-media,
       .BetterX-layout-primary article .BetterX-layout-media,
       article:where(:not([role="dialog"] article, #BetterX-root article)) [data-testid="card.wrapper"],
       .BetterX-layout-primary article:where(:not([role="dialog"] article, #BetterX-root article)) [data-testid="card.wrapper"] {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: min(100%, 960px, 120vh) !important;
        min-width: 0 !important; flex-grow: 0 !important;
      }`,
      `article .BetterX-layout-video-aspect {
        aspect-ratio: var(--BetterX-media-ratio, 1) !important;
        max-height: 72vh !important;
      }
       article .BetterX-layout-video-spacer {
        height: 0 !important; padding-top: 0 !important;
        padding-bottom: min(72vh, calc(100% / var(--BetterX-media-ratio, 1))) !important;
      }`,
      `article .BetterX-layout-media .BetterX-unlocked.xv-n1 video {
        max-height: min(510px, 72vh) !important;
      }`,
    ];

    if (hideLeftbar) rules.push('header[role="banner"] { display: none !important; }');
    if (hideSidebar) rules.push('[data-testid="sidebarColumn"] { display: none !important; }');

    // X 新版布局中只改 header 内层 div 不一定会释放左栏占位；手动模式同时约束外层 header。
    if (!autoWidth && !hideLeftbar) {
      rules.push(`
        header[role="banner"] {
          box-sizing: border-box !important;
          width: ${leftbarWidth}px !important;
          min-width: ${leftbarWidth}px !important;
          max-width: ${leftbarWidth}px !important;
          flex: 0 0 ${leftbarWidth}px !important;
        }
        header[role="banner"] > div,
        header[role="banner"] > div > div,
        .BetterX-layout-left-width-target {
          box-sizing: border-box !important;
          width: ${leftbarWidth}px !important;
          min-width: 0 !important;
          max-width: ${leftbarWidth}px !important;
        }
      `);
      if (leftbarWidth <= 120) {
        rules.push(`
          /* 窄左栏进入仅图标模式，避免 X 的文字标签撑回原宽度。 */
          header[role="banner"] nav[role="navigation"] a[role="link"] div[dir="ltr"],
          header[role="banner"] nav[role="navigation"] [data-testid="AppTabBar_More_Menu"] div[dir="ltr"],
          header[role="banner"] [data-testid="SideNav_AccountSwitcher_Button"] div[dir="ltr"],
          header[role="banner"] [data-testid="SideNav_NewTweet_Button"] span {
            display: none !important;
          }
          header[role="banner"] nav[role="navigation"] a[role="link"],
          header[role="banner"] nav[role="navigation"] [data-testid="AppTabBar_More_Menu"],
          header[role="banner"] [data-testid="SideNav_AccountSwitcher_Button"],
          header[role="banner"] [data-testid="SideNav_NewTweet_Button"] {
            box-sizing: border-box !important;
            max-width: ${Math.max(44, leftbarWidth)}px !important;
          }
        `);
      }
    }

    if (expandCenter) {
      rules.push(`
        .BetterX-layout-shell {
          width: 100% !important; max-width: none !important; min-width: 0 !important;
          margin-inline: 0 !important;
        }
        .BetterX-layout-main {
          width: 100% !important; max-width: none !important; min-width: 0 !important;
          flex: 1 1 0% !important; margin-inline: auto !important;
        }
        .BetterX-layout-row {
          width: 100% !important; max-width: none !important; min-width: 0 !important;
          margin-inline: auto !important;
        }
        .BetterX-layout-primary {
          width: auto !important; max-width: none !important; min-width: 0 !important;
          flex: 1 1 0% !important; margin-inline: 0 !important;
        }
        .BetterX-layout-primary > div,
        .BetterX-layout-primary > div > div,
        .BetterX-layout-primary .r-1ye8kvj,
        .BetterX-layout-primary [data-testid="cellInnerDiv"],
        .BetterX-layout-primary [data-testid="cellInnerDiv"] > div,
        .BetterX-layout-primary [data-testid="cellInnerDiv"] article,
        .BetterX-layout-primary [data-testid="cellInnerDiv"] article > div {
          box-sizing: border-box !important;
          width: 100% !important; max-width: none !important; min-width: 0 !important;
          margin-inline: 0 !important;
        }
      `);
      if (!hideLeftbar) {
        rules.push(`
          /* 固定可见左栏的占位，让中间栏填满侧栏之外的剩余空间。 */
          .BetterX-layout-shell {
            justify-content: flex-start !important;
            align-items: flex-start !important;
          }
          header[role="banner"] {
            box-sizing: border-box !important;
            width: ${effectiveLeftbarWidth}px !important;
            min-width: ${effectiveLeftbarWidth}px !important;
            max-width: ${effectiveLeftbarWidth}px !important;
            flex: 0 0 ${effectiveLeftbarWidth}px !important;
          }
        `);
      }
    } else if (!autoWidth) {
      rules.push(`
        .BetterX-layout-main { max-width: none !important; min-width: 0 !important; flex: 1 1 auto !important; }
        .BetterX-layout-row { width: max-content !important; max-width: none !important; margin-inline: auto !important; }
        .BetterX-layout-primary {
          width: ${timelineWidth}px !important; max-width: none !important;
          flex: 0 0 ${timelineWidth}px !important; margin-inline: auto !important;
        }
        .BetterX-layout-left-width-target { width: ${leftbarWidth}px !important; }
      `);
    }

    if (state.settings.layoutHideMessageGrok !== false) {
      rules.push(`
        [data-testid="chat-drawer-root"], [data-testid="GrokDrawer"] {
          opacity: 0 !important; pointer-events: none !important;
          transform: translate(200px, 200px) !important;
        }
      `);
    }
    return rules.join('\n');
  }

  function getLayoutScopeElements(root, selector) {
    const scope = root && root.querySelectorAll ? root : document;
    const elements = new Set(scope.querySelectorAll(selector));
    if (scope.matches && scope.matches(selector)) elements.add(scope);
    const ancestor = scope.closest && scope.closest(selector);
    if (ancestor) elements.add(ancestor);
    return elements;
  }

  function layoutRootAffectsStructure(root) {
    return !!(root && ((root.matches && root.matches(LAYOUT_STRUCTURE_SELECTOR))
      || (root.querySelector && root.querySelector(LAYOUT_STRUCTURE_SELECTOR))));
  }

  function clearAdaptiveMediaLayout(root = document) {
    getLayoutScopeElements(root, '.BetterX-layout-video-aspect, .BetterX-layout-video-spacer')
      .forEach((node) => node.classList.remove('BetterX-layout-video-aspect', 'BetterX-layout-video-spacer'));
    getLayoutScopeElements(root, '.BetterX-layout-media').forEach((container) => {
      container.classList.remove('BetterX-layout-media');
      container.style.removeProperty('--BetterX-media-ratio');
      layoutMediaRatios.delete(container);
    });
  }

  function getAdaptiveMediaContainer(marker, article) {
    let container = marker;
    // 播放器嵌套会超过十层，且播放前后层数不同；按正文边界找同一个外层，不能按层数截断。
    while (container.parentElement) {
      const parent = container.parentElement;
      if (!parent || parent === article || !article.contains(parent)) break;
      const hasPostContent = [...parent.querySelectorAll(LAYOUT_MEDIA_BOUNDARY_SELECTOR)]
        .some((node) => !node.closest(LAYOUT_MEDIA_SELECTOR));
      if (hasPostContent) break;
      container = parent;
    }
    return container;
  }

  function getAdaptiveMediaRatio(container) {
    if (container.matches('.BetterX-media-grid, .BetterX-native-media-grid.xv-multi')
        || container.querySelector('.BetterX-media-grid, .BetterX-native-media-grid.xv-multi')) return 16 / 9;
    const cached = layoutMediaRatios.get(container);
    if (cached) return cached;
    // 原生占位比例决定稳定的预览盒尺寸；图片/视频加载后的真实比例只影响盒内缩放。
    const ratioSelector = '[style*="aspect-ratio"], [style*="padding-bottom"], [style*="padding-top"]';
    const ratioNodes = [...container.querySelectorAll(ratioSelector)];
    if (container.matches(ratioSelector)) ratioNodes.push(container);
    const candidates = [];
    for (const ratioNode of ratioNodes) {
      const aspect = (ratioNode.style.aspectRatio || '').match(/^(?:auto\s+)?(\d*\.?\d+)(?:\s*\/\s*(\d*\.?\d+))?$/);
      if (aspect && Number(aspect[1]) > 0 && Number(aspect[2] || 1) > 0) {
        candidates.push(Number(aspect[1]) / Number(aspect[2] || 1));
        continue;
      }
      const padding = ratioNode.style.paddingBottom || ratioNode.style.paddingTop || '';
      if (padding.endsWith('%') && parseFloat(padding) > 0) candidates.push(100 / parseFloat(padding));
    }
    if (!candidates.length) {
      const video = container.matches('[data-testid="videoComponent"]')
        ? container : container.querySelector('[data-testid="videoComponent"]');
      const aspect = video && getComputedStyle(video).aspectRatio.match(/^(\d*\.?\d+)(?:\s*\/\s*(\d*\.?\d+))?$/);
      if (aspect && Number(aspect[1]) > 0 && Number(aspect[2] || 1) > 0) {
        candidates.push(Number(aspect[1]) / Number(aspect[2] || 1));
      }
    }
    const ratio = candidates.length ? Math.min(...candidates) : 1;
    // 骨架还未提供比例时不缓存回退值，避免把临时空盒锁成正方形。
    if (candidates.length) layoutMediaRatios.set(container, ratio);
    return ratio;
  }

  function stabilizeAdaptiveVideoLayout(container) {
    const isGrid = container.matches('.BetterX-media-grid, .BetterX-native-media-grid.xv-multi')
      || container.querySelector('.BetterX-media-grid, .BetterX-native-media-grid.xv-multi');
    if (isGrid) {
      getLayoutScopeElements(container, '.BetterX-layout-video-aspect, .BetterX-layout-video-spacer')
        .forEach((node) => node.classList.remove('BetterX-layout-video-aspect', 'BetterX-layout-video-spacer'));
      return;
    }
    const selector = '[style*="aspect-ratio"], [style*="padding-bottom"], [style*="padding-top"], [data-testid="videoComponent"]';
    const slots = [...container.querySelectorAll(selector)];
    if (container.matches(selector)) slots.push(container);
    for (const slot of slots) {
      const padding = slot.style.paddingBottom || slot.style.paddingTop || '';
      const isSpacer = padding.endsWith('%') && parseFloat(padding) > 0;
      // X 的比例占位是播放器绝对定位层的空兄弟节点，并不包含 videoComponent。
      const isVideoSiblingSpacer = isSpacer && slot.children.length === 0
        && slot.parentElement && container.contains(slot.parentElement)
        && slot.parentElement.querySelector('[data-testid="videoComponent"]');
      if (!isVideoSiblingSpacer && !slot.closest('[data-testid="videoComponent"]')
          && !slot.querySelector('[data-testid="videoComponent"]')) continue;
      const hasAspect = slot.style.aspectRatio
        || (slot.matches('[data-testid="videoComponent"]') && getComputedStyle(slot).aspectRatio !== 'auto');
      const className = isSpacer
        ? 'BetterX-layout-video-spacer' : (hasAspect ? 'BetterX-layout-video-aspect' : '');
      if (className && !slot.classList.contains(className)) slot.classList.add(className);
    }
  }

  function applyAdaptiveMediaLayout(root = document) {
    if (!layoutEnhancementsActive()) {
      clearAdaptiveMediaLayout(root);
      return;
    }
    getLayoutScopeElements(root, 'article').forEach((article) => {
      if (article.closest('#BetterX-root, [role="dialog"]')) {
        clearAdaptiveMediaLayout(article);
        return;
      }
      const containers = new Set();
      article.querySelectorAll(LAYOUT_MEDIA_SELECTOR).forEach((marker) => {
        containers.add(getAdaptiveMediaContainer(marker, article));
      });
      // 仅清理已被 X 替换的旧容器，避免刷新和播放器更新时反复撤销/重加尺寸限制。
      getLayoutScopeElements(article, '.BetterX-layout-media').forEach((container) => {
        if (containers.has(container)) return;
        // 只移除这一层的限制；递归清理会连带删除保留外层的比例缓存。
        container.classList.remove('BetterX-layout-media');
        container.style.removeProperty('--BetterX-media-ratio');
        layoutMediaRatios.delete(container);
      });
      getLayoutScopeElements(article, '.BetterX-layout-video-aspect, .BetterX-layout-video-spacer')
        .forEach((slot) => {
          if (!slot.closest('.BetterX-layout-media')) {
            slot.classList.remove('BetterX-layout-video-aspect', 'BetterX-layout-video-spacer');
          }
        });
      containers.forEach((container) => {
        const ratio = String(getAdaptiveMediaRatio(container));
        if (!container.classList.contains('BetterX-layout-media')) container.classList.add('BetterX-layout-media');
        if (container.style.getPropertyValue('--BetterX-media-ratio') !== ratio) {
          container.style.setProperty('--BetterX-media-ratio', ratio);
        }
        stabilizeAdaptiveVideoLayout(container);
      });
    });
  }

  function applyLayoutDomCleanup(root = document) {
    getLayoutScopeElements(root, '.BetterX-layout-clean-hidden, .BetterX-layout-showmore-hidden')
      .forEach((el) => el.classList.remove('BetterX-layout-clean-hidden', 'BetterX-layout-showmore-hidden'));
    if (state.settings.layoutCleanNavigation !== false) {
      getLayoutScopeElements(root, 'nav[role="navigation"] div[dir="ltr"]').forEach((item) => {
        const label = (item.textContent || '').trim();
        if (!LAYOUT_NAV_LABELS.has(label)) return;
        const target = item.closest('a, div[role="link"]');
        if (target) target.classList.add('BetterX-layout-clean-hidden');
      });
      getLayoutScopeElements(root, '[data-testid="super-upsell-UpsellCardRenderProperties"]')
        .forEach((el) => el.classList.add('BetterX-layout-clean-hidden'));
      getLayoutScopeElements(root, '[aria-label]').forEach((element) => {
        const label = (element.getAttribute('aria-label') || '').trim();
        if (LAYOUT_SUBSCRIBE_LABELS.has(label)
            || (element.matches('nav[role="navigation"]') && LAYOUT_FOOTER_LABELS.has(label))) {
          element.classList.add('BetterX-layout-clean-hidden');
        }
      });
    }
    if (state.settings.layoutHideShowMore && !state.settings.autoExpandPostText) {
      getLayoutScopeElements(root, 'article a[role="link"]').forEach((link) => {
        if (LAYOUT_SHOW_MORE_LABELS.has((link.textContent || '').trim())) link.classList.add('BetterX-layout-showmore-hidden');
      });
    }
  }

  function applyLayoutEnhancements() {
    if (!document.documentElement) return;
    const style = ensureLayoutStyle();
    if (!layoutEnhancementsActive()) {
      style.textContent = '';
      clearLayoutDomClasses();
      return;
    }

    const autoWidth = state.settings.layoutAutoWidth !== false;
    const timelineWidth = clampInt(state.settings.timelineWidth, 100, 3000, DEFAULT_SETTINGS.timelineWidth);
    const leftbarWidth = clampInt(state.settings.leftbarWidth, 50, 500, DEFAULT_SETTINGS.leftbarWidth);
    const fillCenter = !!state.settings.layoutFillCenter;
    const hideLeftbar = !!state.settings.layoutHideLeftbar;
    const hideSidebar = !!state.settings.layoutHideSidebar;
    const expandCenter = fillCenter || hideLeftbar || hideSidebar;
    const needsStructure = expandCenter || !autoWidth;
    let elements = getLayoutElements();
    // 从手动宽度切回纯自动模式时，先同步撤销旧结构规则，再读取真正的原生尺寸。
    if (autoWidth && !needsStructure && elements.primary && elements.primary.classList.contains('BetterX-layout-primary')) {
      style.textContent = '';
      clearLayoutStructureClasses();
      elements = getLayoutElements();
    }
    if (autoWidth) detectNativeLayoutWidths(elements);
    const effectiveLeftbarWidth = autoWidth
      ? clampInt(state.detectedLeftbarWidth, 120, 600, leftbarWidth)
      : leftbarWidth;
    bindLayoutStructureClasses(elements, needsStructure, expandCenter, !autoWidth);
    const css = buildLayoutCss({
      autoWidth, timelineWidth, leftbarWidth, effectiveLeftbarWidth,
      hideLeftbar, hideSidebar, expandCenter,
    });
    if (style.textContent !== css) style.textContent = css;
    applyLayoutDomCleanup();
    applyAdaptiveMediaLayout();
  }

  // ── 内容净化：黄推 / 成人引流机器人 ─────────────────────────────────
  // 只处理已经渲染的 DOM，不改写 XHR / Fetch 返回值，也不自动拉黑或举报账号。
