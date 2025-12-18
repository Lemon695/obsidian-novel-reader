<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import type NovelReaderPlugin from '../../main';
  import type { Novel, ReadingProgress } from '../../types';
  import type { EpubNote } from '../../types/epub/epub-reader';
  import NoteDialog from '../NoteDialog.svelte';
  import type {
    EpubBook,
    EpubChapter,
    EpubNavigationItem,
    EpubRendition,
  } from '../../types/epub/epub-rendition';
  import ReaderSettingsMenu from '../setting/ReaderSettingsMenu.svelte';
  import ReaderSidebar from '../reader/ReaderSidebar.svelte';
  import ReaderNavigation from '../reader/ReaderNavigation.svelte';
  import HoverTOC from '../reader/HoverTOC.svelte';
  import KeyboardNavigationHandler from '../reader/KeyboardNavigationHandler.svelte';
  import ReadingSessionManager from '../reader/ReadingSessionManager.svelte';

  // Define helper type locally
  interface ProgressPosition {
    chapterIndex: number;
    chapterTitle: string;
    chapterId?: number;
    cfi?: string;
    scrollPosition?: number;
    timestamp?: number;
  }

  import type { ChapterHistory } from '../../types/reading-stats';
  import ReaderProgressManager from '../reader/ReaderProgressManager.svelte';
  import type { Note } from '../../types/notes';
  import LoadingSpinner from '../LoadingSpinner.svelte';
  import BookmarkPanelWrapper from '../reader/BookmarkPanelWrapper.svelte';
  import type { Bookmark } from '../../types/bookmark';
  import { EpubRenderer, ReaderStyleManager, ReaderBookmarkManager } from '../../services/renderer';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
  export let initialCfi: string | null = null;
  export let savedProgress: ReadingProgress | null = null;
  export let book: EpubBook | null = null;
  export let toc: unknown[] = [];
  export let chapters: EpubChapter[] = [];

  let rendition: EpubRendition;
  let isLoading = true;
  let showNoteDialog = false;
  let selectedTextForNote = '';
  let notes: EpubNote[] = [];
  let readerContainer: HTMLElement | null = null;
  let readerElement: HTMLElement; // 阅读器主元素引用

  // 统一渲染器实例
  let renderer: EpubRenderer | null = null;
  let styleManager: ReaderStyleManager | null = null;

  let currentChapter: EpubChapter | null = null;
  export let currentChapterId: number | null = null;
  const viewInstanceId = `epub-view-${novel.id}-${Date.now()}`;
  // 添加漫画检测逻辑
  let isManga = false;
  let readingStats: unknown = null;
  export let chapterHistory: ChapterHistory[] = []; // 章节历史记录（export让view层可以更新）
  let isActive = false;
  let contentLoaded = false;
  export let initialChapterId: number | null = null; //初始章节（从父组件传入）

  let selectedNote: Note | null = null; //笔记
  let noteViewerPosition = { x: 0, y: 0 };
  let noteViewerVisible = false; // 控制笔记查看器显示

  let isReadingActive = false;
  let sessionStartTime: number | null = null;
  let lastActivityTime = Date.now();

  // 唯一实例ID用于调试
  const instanceId = `EPUB-${novel.id.substring(0, 8)}-${Date.now()}`;
  console.log(`[${instanceId}] Component created for novel: ${novel.title}`);

  // hover模式相关状态
  let isMenuVisible = false;

  // 目录面板显示状态
  let showOutlinePanel = false;

  // 书签管理器
  let bookmarkManager: ReaderBookmarkManager | null = null;
  let showBookmarkPanel = false;

  // 从书签管理器中提取 store
  $: hasBookmarkAtCurrentPosition = bookmarkManager?.hasBookmarkAtCurrentPosition;

  // 进度管理
  let progressPosition: ProgressPosition = {
    chapterIndex: 0,
    chapterTitle: '',
    chapterId: 0,
    cfi: '',
  };

  // 更新进度位置的响应式语句
  // 注意：不在这里调用 rendition.currentLocation() 因为它可能在初始化阶段未就绪
  // CFI 将在实际保存进度时由 ReaderProgressManager 从其他来源获取
  $: if (currentChapter) {
    const chapterIndex = chapters.findIndex((c) => c.id === currentChapter.id);
    progressPosition = {
      chapterIndex: chapterIndex >= 0 ? chapterIndex : 0,
      chapterTitle: currentChapter.title,
      chapterId: currentChapter.id,
      cfi: '', // CFI 不在响应式语句中获取，避免初始化问题
    };
  }

  // 计算当前章节索引供 ReaderNavigation 使用
  $: currentChapterIndex = currentChapter
    ? chapters.findIndex((c) => c.id === currentChapter.id)
    : 0;

  type VirtualPage = {
    pageNum: number;
    chapterId: number;
    chapterTitle: string;
    subPage?: number;
    totalSubPages?: number;
  };

  let virtualPages: VirtualPage[] = [];
  let viewMode: 'chapters' | 'pages' = 'chapters';

  // EPUB 悬浮目录：目录/页码切换功能
  let currentPageNum = 1;
  let totalPages = 0; // EPUB 总页数
  let currentVirtualPage: (typeof virtualPages)[0] | null = null;

  // 计算虚拟页码（EPUB基于章节，章节数少时细分）
  function calculateVirtualPages() {
    virtualPages = [];
    let pageNum = 1;

    chapters.forEach((chapter) => {
      // 每个章节至少一页
      virtualPages.push({
        pageNum: pageNum++,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
      });

      // 如果章节数很少（<20），可以细分章节为多页
      if (chapters.length < 20) {
        const subPagesCount = Math.min(5, Math.ceil(chapter.title.length / 50));
        for (let i = 1; i < subPagesCount; i++) {
          virtualPages.push({
            pageNum: pageNum++,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            subPage: i + 1,
            totalSubPages: subPagesCount,
          });
        }
      }
    });

    // 更新总页数
    totalPages = virtualPages.length;

    // 初始化第一页
    if (virtualPages.length > 0) {
      currentVirtualPage = virtualPages[0];
      currentPageNum = 1;
    }
  }

  // 根据当前章节计算当前页码
  function updateCurrentPage() {
    if (viewMode === 'chapters') {
      // 章节模式：基于当前章节
      if (!currentChapter || virtualPages.length === 0) return;

      // 提取局部变量解决TypeScript控制流分析问题
      const chapter = currentChapter;
      const page = virtualPages.find((p) => p.chapterId === chapter.id);
      if (page) {
        currentPageNum = page.pageNum;
      }
    } else {
      // 页码模式：基于当前虚拟页
      if (currentVirtualPage) {
        currentPageNum = currentVirtualPage.pageNum;
      }
    }
  }

  // 跳转到指定页码
  async function jumpToPage(pageNum: number) {
    const page = virtualPages.find((p) => p.pageNum === pageNum);
    if (!page) return;

    currentVirtualPage = page;
    currentPageNum = pageNum;

    const targetChapter = chapters.find((ch) => ch.id === page.chapterId);
    if (targetChapter) {
      const success = await displayChapter(targetChapter);
      if (success) {
        currentChapter = targetChapter;
        currentChapterId = targetChapter.id;
        saveProgress();

        // 检查书签状态
        // 书签状态由 bookmarkManager 自动管理

        // 触发章节切换事件以记录历史
        dispatch('chapterChanged', {
          chapterId: targetChapter.id,
          chapterTitle: targetChapter.title,
        });

        // 重新激活键盘导航
        isActive = true;
      }
    }
  }

  // 切换到上一页/下一页
  function switchEpubPage(direction: 'prev' | 'next') {
    const currentIndex = virtualPages.findIndex((p) => p.pageNum === currentPageNum);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (direction === 'prev') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    } else {
      nextIndex = currentIndex < virtualPages.length - 1 ? currentIndex + 1 : currentIndex;
    }

    if (nextIndex !== currentIndex) {
      jumpToPage(virtualPages[nextIndex].pageNum);
    }
  }

  // 从 novel.customSettings 读取用户偏好
  $: {
    if (novel?.customSettings?.epubViewMode) {
      viewMode = novel.customSettings.epubViewMode;
    } else {
      // 优先显示目录，如果没有目录则显示页码
      viewMode = chapters.length > 0 ? 'chapters' : 'pages';
    }
  }

  // 当章节变化时更新页码
  $: if (currentChapter && virtualPages.length > 0) {
    updateCurrentPage();
  }

  // 切换目录/页码显示模式
  async function toggleViewMode() {
    viewMode = viewMode === 'chapters' ? 'pages' : 'chapters';

    // 保存用户选择到 novel.customSettings
    if (!novel.customSettings) {
      novel.customSettings = {};
    }
    novel.customSettings.epubViewMode = viewMode;

    // 更新到数据库
    await plugin.libraryService.updateNovel(novel);
  }

  //添加笔记、右键菜单
  let selectedText = '';
  let currentCfi = '';
  let showMenu = false;

  let menuPosition = { x: 0, y: 0 };

  $: {
    // 使用块作用域+局部变量检查，让TypeScript正确推断类型
    const chapter = currentChapter;
    if (chapter) {
      console.log('EpubReaderViewComponent--->', JSON.stringify(chapter));

      //无视警告,正常数据,可打印
      currentChapterId = chapter.id;
      console.log('EPUB,currentChapterId---', currentChapterId);
    }
  }

  onMount(async () => {
    console.log('Component mounting...');

    // 添加全局错误处理器，捕获非标准EPUB DOM错误
    const errorHandler = (event: ErrorEvent) => {
      const error = event.error;
      if (error && error.message) {
        // 检查是否是非标准DOM相关的错误
        if (
          error.message.includes('getElementsByTagName is not a function') ||
          error.message.includes('createElement is not a function') ||
          error.message.includes('getElementById is not a function') ||
          error.message.includes('getElementsByClassName is not a function')
        ) {
          console.warn('Suppressed non-standard EPUB DOM error:', error.message);
          event.preventDefault(); // 阻止错误传播到控制台
          return true;
        }
      }
    };

    window.addEventListener('error', errorHandler);

    // 创建并使用特定实例的内容区域
    const contentArea = document.getElementById(`content-area-${viewInstanceId}`);
    if (!contentArea) {
      console.error('Content area not found');
      return;
    }

    console.log('Content area found, initializing reader...');

    readerContainer = document.createElement('div');
    readerContainer.id = `epub-container-${viewInstanceId}`;
    readerContainer.classList.add('epub-viewer-container');

    contentArea.appendChild(readerContainer);

    await initializeReader();

    // 清理：组件卸载时移除错误处理器
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  });

  onMount(async () => {
    if (chapters) {
      contentLoaded = true;

      // 书签由 bookmarkManager 管理

      // 计算虚拟页码
      calculateVirtualPages();

      // 章节历史现在由view层传入，不需要在这里加载

      console.log(`[${instanceId}] 📚 章节初始化参数:`, {
        savedProgressChapterId: savedProgress?.position?.chapterId,
        initialChapterId: initialChapterId,
        totalChapters: chapters.length,
      });

      // 恢复上次阅读进度
      // 优先使用传入的initialChapterId（从setNovelData传来），如果没有则使用savedProgress
      if (initialChapterId !== null) {
        // 使用传入的初始章节ID（最高优先级）
        const savedChapter = chapters.find((ch) => ch.id === initialChapterId);
        console.log(
          `[${instanceId}] ✅ 使用传入的initialChapterId: ${initialChapterId}`,
          savedChapter
        );
        if (savedChapter) {
          currentChapter = savedChapter;
          currentChapterId = savedChapter.id;
          // initializeReader已经会直接显示该章节，无需延迟调用
          console.log(`[${instanceId}] 📖 章节状态已设置，等待initializeReader显示`);
        }
      } else if (savedProgress?.position?.chapterId) {
        // 使用savedProgress中的章节ID
        currentChapterId = savedProgress.position.chapterId;
        const savedChapter = chapters.find((ch) => ch.id === currentChapterId);
        console.log(
          `[${instanceId}] 📖 使用savedProgress中的章节ID: ${currentChapterId}`,
          savedChapter
        );
        if (savedChapter) {
          currentChapter = savedChapter;
          // initializeReader已经会直接显示该章节，无需延迟调用
          console.log(`[${instanceId}] 📖 章节状态已设置，等待initializeReader显示`);
        }
      } else if (chapters.length > 0) {
        // 否则加载第一章
        console.log(`[${instanceId}] 📄 没有保存的进度，加载第一章`);
        currentChapter = chapters[0];
        currentChapterId = chapters[0].id;
      }
    }
  });

  // 保存 iframe 事件监听器的清理函数
  let iframeEventCleanups: Array<() => void> = [];
  let iframeSetupTimeout: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    console.log('Adding event listeners');
    // 键盘事件已改为主div的on:keydown，不再使用全局window监听
    window.addEventListener('noteIconClick', handleNoteIconClick as EventListener);

    const visibilityHandler = () => {
      isActive = !document.hidden;
    };

    // 监听页面焦点
    document.addEventListener('visibilitychange', visibilityHandler);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleClickOutside);

    // 返回清理函数，移除所有事件监听器
    return () => {
      // 清理 iframe 设置的定时器
      if (iframeSetupTimeout) {
        clearTimeout(iframeSetupTimeout);
        iframeSetupTimeout = null;
      }

      // 清理所有 iframe 事件监听器
      iframeEventCleanups.forEach((cleanup) => cleanup());
      iframeEventCleanups = [];

      // 清理全局事件监听器
      window.removeEventListener('noteIconClick', handleNoteIconClick as EventListener);
      document.removeEventListener('visibilitychange', visibilityHandler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // 辅助函数：查找章节对应的spine索引
  function findSpineIndex(chapter: EpubChapter): number | null {
    if (!book || !chapter.href) return null;

    // 清理href
    const cleanHref = chapter.href.split('#')[0].split('?')[0];

    // 在spine中查找匹配的项
    for (let i = 0; i < book.spine.items.length; i++) {
      const spineItem = book.spine.items[i];
      const spineHref = spineItem.href?.split('#')[0].split('?')[0] || '';

      // 比较清理后的href，支持相对路径和绝对路径
      if (
        spineHref === cleanHref ||
        spineHref.endsWith('/' + cleanHref) ||
        cleanHref.endsWith('/' + spineHref)
      ) {
        return i;
      }
    }

    return null;
  }

  // 辅助函数：显示章节内容（带回退机制）
  async function displayChapter(chapter: EpubChapter): Promise<boolean> {
    if (!rendition || !book || !chapter.href) return false;

    try {
      // 方法1：尝试使用清理后的href
      const cleanHref = chapter.href.split('#')[0].split('?')[0];
      await rendition.display(cleanHref);

      // 切换章节后重新获取焦点，确保键盘事件能继续响应
      const readerElement = document.querySelector('.epub-reader') as HTMLElement;
      if (readerElement) {
        setTimeout(() => readerElement.focus(), 100);
      }

      return true;
    } catch (error) {
      console.warn('Failed to display by href, trying spine index:', error);

      try {
        // 方法2：尝试使用spine索引
        const spineIndex = findSpineIndex(chapter);
        if (spineIndex !== null) {
          await rendition.display(spineIndex);

          // 切换章节后重新获取焦点
          const readerElement = document.querySelector('.epub-reader') as HTMLElement;
          if (readerElement) {
            setTimeout(() => readerElement.focus(), 100);
          }

          return true;
        }
      } catch (spineError) {
        console.error('Failed to display by spine index:', spineError);
      }

      // 方法3：尝试使用原始href（最后的尝试）
      try {
        await rendition.display(chapter.href);

        // 切换章节后重新获取焦点
        const readerElement = document.querySelector('.epub-reader') as HTMLElement;
        if (readerElement) {
          setTimeout(() => readerElement.focus(), 100);
        }

        return true;
      } catch (originalError) {
        console.error('Failed to display chapter by any method:', originalError);
        return false;
      }
    }
  }

  async function initializeReader() {
    if (!readerContainer) {
      console.error('Reader container still not available');
      return;
    }

    try {
      if (!book) {
        return;
      }

      isManga = await isMangaEpub(book, novel, chapters);
      console.log('isManga---' + isManga);

      const container = document.getElementById(`epub-container-${viewInstanceId}`);
      if (!container) {
        throw new Error('Container not found');
      }

      rendition = book.renderTo(container, {
        width: '100%',
        height: '100%',
        flow: 'scrolled-doc', // 漫画模式使用分页
        manager: isManga ? 'continuous' : 'default',
        orientation: 'vertical',
        spread: 'none', // 禁用双页显示
        keyBindings: false, // 禁用默认键盘绑定
      });

      // 修复非标准DOM：在epub.js使用之前为document添加缺失的方法
      rendition.hooks.content.register((contents: unknown) => {
        try {
          if (contents && contents.document) {
            const doc = contents.document;

            // Polyfill getElementsByTagName if missing
            if (typeof doc.getElementsByTagName !== 'function') {
              doc.getElementsByTagName = function (tagName: string) {
                console.warn('Using polyfilled getElementsByTagName for non-standard EPUB DOM');
                try {
                  // 尝试使用querySelectorAll作为替代
                  if (typeof doc.querySelectorAll === 'function') {
                    return doc.querySelectorAll(tagName);
                  }
                  // 返回空的HTMLCollection-like对象
                  return [];
                } catch (e) {
                  return [];
                }
              };
            }

            // Polyfill createElement if missing
            if (typeof doc.createElement !== 'function') {
              doc.createElement = function (tagName: string) {
                console.warn('Using polyfilled createElement for non-standard EPUB DOM');
                // 返回一个模拟的元素对象
                return {
                  tagName: tagName.toUpperCase(),
                  setAttribute: function () {},
                  getAttribute: function () {
                    return null;
                  },
                  appendChild: function () {},
                  removeChild: function () {},
                  classList: {
                    add: function () {},
                    remove: function () {},
                    contains: function () {
                      return false;
                    },
                  },
                };
              };
            }

            // Polyfill getElementById if missing
            if (typeof doc.getElementById !== 'function') {
              doc.getElementById = function (id: string) {
                console.warn('Using polyfilled getElementById for non-standard EPUB DOM');
                try {
                  if (typeof doc.querySelector === 'function') {
                    return doc.querySelector(`#${id}`);
                  }
                  return null;
                } catch (e) {
                  return null;
                }
              };
            }
          }
        } catch (error) {
          console.warn('Error polyfilling EPUB document methods:', error);
        }
      });

      // 添加基本类名到 EPUB 文档
      rendition.hooks.content.register((contents: unknown) => {
        try {
          // 安全检查：确保document和body存在且有效
          if (!contents || !contents.document || !contents.document.body) {
            console.warn('EPUB content structure is invalid, skipping hooks');
            return;
          }

          // 检查是否有getElementsByTagName方法（标准DOM检查）
          if (typeof contents.document.getElementsByTagName !== 'function') {
            console.warn('EPUB document is not a standard DOM, skipping hooks');
            return;
          }

          const body = contents.document.body;

          // 安全地添加类名
          if (body.classList && typeof body.classList.add === 'function') {
            body.classList.add('epub-doc');
          }

          // 为 iframe 内的文档添加点击事件监听
          if (typeof contents.document.addEventListener === 'function') {
            const iframeClickHandler = (event: MouseEvent) => {
              try {
                // 检查点击是否在选中文本区域外
                const selection = contents.window?.getSelection?.();
                if (!selection || selection.toString().trim() === '') {
                  showMenu = false;
                  selectedText = '';
                }
              } catch (err) {
                console.warn('Error handling click event:', err);
              }
            };

            contents.document.addEventListener('click', iframeClickHandler);

            // 保存清理函数
            iframeEventCleanups.push(() => {
              contents.document.removeEventListener('click', iframeClickHandler);
            });
          }
        } catch (error) {
          console.warn('Error registering EPUB content hooks:', error);
        }
      });

      // 加载初始位置 - 优先使用要恢复的章节，避免闪烁
      let displayTarget = null;

      // 优先级1: 使用initialCfi
      if (initialCfi) {
        displayTarget = initialCfi;
        console.log(`[${instanceId}] 🎯 使用initialCfi初始化显示`);
      }
      // 优先级2: 检查是否有要恢复的章节ID
      else if (initialChapterId !== null && chapters.length > 0) {
        const targetChapter = chapters.find((ch) => ch.id === initialChapterId);
        if (targetChapter && targetChapter.href) {
          displayTarget = targetChapter.href.split('#')[0].split('?')[0];
          console.log(`[${instanceId}] 🎯 使用initialChapterId初始化显示:`, targetChapter.title);
        }
      }
      // 优先级3: 检查savedProgress中的章节ID
      else if (savedProgress?.position?.chapterId && chapters.length > 0) {
        // 显式提取以避免TypeScript控制流分析问题
        const position = savedProgress.position;
        const targetChapter = position ? chapters.find((ch) => ch.id === position.chapterId) : null;
        if (targetChapter && targetChapter.href) {
          displayTarget = targetChapter.href.split('#')[0].split('?')[0];
          console.log(`[${instanceId}] 🎯 使用savedProgress初始化显示:`, targetChapter.title);
        }
      }

      // 执行显示
      if (displayTarget) {
        await rendition.display(displayTarget);
      } else {
        await rendition.display();
      }

      // 设置手势和触摸事件
      rendition.on('touchstart', (event: TouchEvent) => {
        event.preventDefault();
      });
      rendition.on('touchend', (event: TouchEvent) => {
        event.preventDefault();
      });

      // 处理文本选择
      rendition.on('selected', handleTextSelection);

      // 监听位置变化
      rendition.on('relocated', handleRelocated);

      // 初始化统一渲染器
      try {
        renderer = new EpubRenderer(rendition);
        styleManager = new ReaderStyleManager(renderer, plugin, novel.id);
        styleManager.applyAllSettings();
        console.log(`[${viewInstanceId}] 样式管理器初始化成功`);

        // 初始化书签管理器
        try {
          bookmarkManager = new ReaderBookmarkManager(
            plugin.bookmarkService,
            novel.id,
            async (bookmark) => {
              await handleJumpToBookmark(bookmark);
            }
          );
          await bookmarkManager.initialize();
          console.log(`[${viewInstanceId}] 书签管理器初始化成功`);
        } catch (error) {
          console.error(`[${viewInstanceId}] 书签管理器初始化失败:`, error);
        }

        // 加载笔记
        await loadNotes();
        console.log(`[${viewInstanceId}] 渲染器初始化成功`);
      } catch (error) {
        console.error(`[${viewInstanceId}] 渲染器初始化失败:`, error);
      }

      isLoading = false;

      // 开始阅读会话
      startReadingSession();
    } catch (error) {
      console.error('Error initializing EPUB:', error);
      isLoading = false;
    }
  }

  // 统一导航处理函数
  function handleNavigationPrev() {
    if (viewMode === 'pages') {
      jumpToPage(currentPageNum - 1);
    } else {
      handleSwitchChapter('prev');
    }
  }

  function handleNavigationNext() {
    if (viewMode === 'pages') {
      jumpToPage(currentPageNum + 1);
    } else {
      handleSwitchChapter('next');
    }
  }

  onDestroy(() => {
    // 清理渲染器
    try {
      if (renderer) {
        renderer.destroy();
        renderer = null;
        styleManager = null;
        console.log(`[${viewInstanceId}] 渲染器已清理`);
      }
    } catch (error) {
      console.error(`[${viewInstanceId}] 渲染器清理失败:`, error);
    }

    if (rendition) {
      rendition.destroy();
    }
    if (book) {
      book.destroy();
    }

    // 只移除当前实例的容器
    const container = document.getElementById(`epub-container-${viewInstanceId}`);
    if (container) {
      container.remove();
    }

    endReadingSession();
  });

  async function handleKeyEvents(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      // await rendition.prev();
      saveProgress();
    } else if (event.key === 'ArrowRight') {
      // await rendition.next();
      saveProgress();
    }
  }

  // 辅助函数：安全获取当前CFI
  function getCurrentCfi(): string {
    if (rendition) {
      return (rendition as any).currentLocation()?.start?.cfi || '';
    }
    return '';
  }

  function handleTextSelection(cfiRange: string, contents: unknown) {
    try {
      console.log(`[${instanceId}] 📝 Text selected, cfiRange:`, cfiRange);

      // 安全检查：确保contents和window存在
      if (!contents || !contents.window || typeof contents.window.getSelection !== 'function') {
        console.warn('Invalid contents object in text selection');
        return;
      }

      const selection = contents.window.getSelection();
      if (!selection) {
        return;
      }

      selectedText = selection.toString().trim();

      if (selectedText) {
        currentCfi = cfiRange;

        // 获取EPubJS的iframe元素
        const iframe = document.querySelector(`#epub-container-${viewInstanceId} iframe`);
        if (iframe && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // 获取iframe的位置
          const iframeRect = iframe.getBoundingClientRect();

          // 计算绝对位置：iframe的偏移量 + 选择区域在iframe中的相对位置
          const absoluteX = iframeRect.left + rect.left + rect.width / 2;
          // 计算Y轴位置，确保菜单在选中文本下方
          const absoluteY = iframeRect.top + rect.bottom + 5;

          menuPosition = {
            x: absoluteX,
            y: absoluteY,
          };
        }

        // 重要：选择文字后恢复焦点到主元素，确保键盘事件继续工作
        // 使用短延迟确保选择操作完成
        setTimeout(() => {
          if (readerElement) {
            console.log(`[${instanceId}] 🔵 Refocusing reader element after text selection`);
            readerElement.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.warn('Error handling text selection:', error);
    }
  }

  // 添加右键菜单事件处理
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();

    if (selectedText) {
      // 使用已经计算好的menuPosition，不需要重新计算
      showMenu = true;
    }
  }

  function handleNoteEdit(event: CustomEvent) {
    const { note } = event.detail;
    selectedNote = note;
    // 确保设置正确的选中文本
    selectedTextForNote = note.selectedText;
    showNoteDialog = true;

    // 重置当前选中的文本，避免影响新增笔记
    selectedText = '';
    currentCfi = '';
  }

  async function handleNoteSave(event: CustomEvent) {
    try {
      if (selectedNote) {
        // 编辑已有笔记
        notes = notes.map((note) =>
          note.id === selectedNote?.id
            ? {
                ...note,
                content: event.detail.content,
                timestamp: Date.now(),
                // 保持原有的选中文本
                selectedText: note.selectedText,
              }
            : note
        );
      } else {
        // 添加新笔记
        const note: EpubNote = {
          id: uuidv4(),
          chapterId: currentChapter?.id || 0,
          chapterName: currentChapter?.title || '',
          selectedText: selectedTextForNote, // 使用临时存储的选中文本
          content: event.detail.content,
          timestamp: Date.now(),
          cfi: currentCfi,
          textIndex: 0,
          textLength: selectedText.length,
          lineNumber: 0,
        };
        notes = [...notes, note];
      }

      await saveNotes();

      // 清理所有状态
      clearNoteState();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  }

  // 添加状态清理函数
  function clearNoteState() {
    selectedNote = null;
    selectedText = '';
    selectedTextForNote = '';
    currentCfi = '';
    showNoteDialog = false;
    showMenu = false;
  }

  // 修改关闭对话框的处理函数
  function handleNoteDialogClose() {
    clearNoteState();
  }

  async function saveNotes() {
    try {
      const notesData = {
        novelId: novel.id,
        novelName: novel.title,
        notes,
      };

      const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
      await plugin.app.vault.adapter.write(notesPath, JSON.stringify(notesData, null, 2));
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  }

  async function loadNotes() {
    try {
      const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
      if (await plugin.app.vault.adapter.exists(notesPath)) {
        const data = await plugin.app.vault.adapter.read(notesPath);
        const notesData = JSON.parse(data);
        notes = notesData.notes;
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
      notes = [];
    }
  }

  function saveProgress() {
    if (!rendition || !book || !currentChapter) return;

    // 计算进度百分比
    const cfi = rendition.location?.start?.cfi || '';
    const percentage = book.locations.percentageFromCfi(cfi) || 0;
    const progressPercent = (currentChapter.id / chapters.length) * 100;

    const progress: ReadingProgress = {
      novelId: novel.id,
      chapterIndex: currentChapter.id - 1, // 章节索引（从0开始，用于计算进度百分比）
      progress: progressPercent,
      timestamp: Date.now(),
      totalChapters: chapters.length,
      position: {
        chapterId: currentChapter.id, // 章节ID（从1开始，用于恢复阅读位置）
        chapterTitle: currentChapter.title,
        cfi: cfi, // 确保不是undefined
        percentage: percentage,
      },
    };

    console.log(`[${instanceId}] 💾 saveProgress called`, progress);
    dispatch('saveProgress', { progress });
  }

  function startReadingSession() {
    dispatch('startReading', {
      chapterId: currentChapter?.id || 0,
      chapterTitle: currentChapter?.title || '',
    });
  }

  function endReadingSession() {
    dispatch('endReading');
  }

  async function isMangaEpub(
    book: EpubBook,
    novel: Novel,
    chapters: EpubChapter[]
  ): Promise<boolean> {
    // 1. 检查文件名中的关键词
    const pathHasMangaKeyword =
      novel.path.toLowerCase().includes('manga') ||
      novel.path.toLowerCase().includes('comic') ||
      novel.path.toLowerCase().includes('卷');

    // 2. 检查 spine 数量与章节数的比例
    const spineItemCount = book.spine.length;
    const chapterCount = chapters.length;
    const spineChapterRatio = spineItemCount / (chapterCount || 1);
    const hasHighSpineRatio = spineChapterRatio > 5; // 如果每章平均超过5个文件，可能是漫画

    console.log('Manga.V1 detection results:', {
      spineItemCount,
      chapterCount,
      spineChapterRatio,
      hasHighSpineRatio,
    });

    // 3. 检查文件内容特征
    let hasImageDominance = false;
    try {
      // 采样检查前几个章节的内容
      const sampleSize = Math.min(3, book.spine.length);
      let totalImages = 0;
      let totalText = 0;

      for (let i = 0; i < sampleSize; i++) {
        const spineItem = book.spine.get(i);
        const content = await spineItem.load();
        const images = content.querySelectorAll('img');
        const text = content.body.textContent || '';

        totalImages += images.length;
        totalText += text.replace(/\s+/g, '').length;
      }

      // 如果图片数量多且文本较少，很可能是漫画
      hasImageDominance = totalImages > 3 && totalText / totalImages < 100;
    } catch (error) {
      console.warn('Error checking content characteristics:', error);
    }

    // 4. 检查元数据中的标题关键词
    const titleHasMangaKeyword = !!(
      book.package?.metadata?.title?.toLowerCase().includes('卷') ||
      book.package?.metadata?.title?.toLowerCase().includes('vol')
    );

    // 综合判断
    console.log('Manga detection results:', {
      pathHasMangaKeyword,
      hasHighSpineRatio,
      hasImageDominance,
      titleHasMangaKeyword,
      spineChapterRatio,
    });

    return !!(
      pathHasMangaKeyword ||
      hasHighSpineRatio ||
      hasImageDominance ||
      titleHasMangaKeyword
    );
  }

  // 键盘导航处理函数
  async function handlePrevChapter() {
    if (viewMode === 'pages') {
      switchEpubPage('prev');
    } else {
      await handleSwitchChapter('prev');
    }
  }

  async function handleNextChapter() {
    if (viewMode === 'pages') {
      switchEpubPage('next');
    } else {
      await handleSwitchChapter('next');
    }
  }

  function handleToggleTOC() {
    showOutlinePanel = !showOutlinePanel;
  }

  function handleClosePanel() {
    if (showOutlinePanel) {
      showOutlinePanel = false;
    }
  }

  // 处理章节切换
  async function handleSwitchChapter(direction: 'prev' | 'next') {
    console.log('handleSwitchChapter-1--', direction, currentChapter, chapters);
    if (!currentChapter || !chapters.length) return;

    const currentIndex = chapters.findIndex((ch) => ch.id === currentChapter?.id);
    let nextIndex: number;

    if (direction === 'prev') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    } else {
      nextIndex = currentIndex < chapters.length - 1 ? currentIndex + 1 : currentIndex;
    }

    console.log('handleSwitchChapter-2--', nextIndex, currentIndex);
    if (nextIndex !== currentIndex) {
      const nextChapter = chapters[nextIndex];
      // 更新当前章节并显示
      currentChapter = nextChapter;
      currentChapterId = nextChapter.id;

      // 使用辅助函数显示章节
      await displayChapter(nextChapter);

      // 等待rendition.location更新后再保存进度
      await waitForRelocated();

      // 触发章节更改事件
      dispatch('chapterChanged', {
        chapterId: nextChapter.id,
        chapterTitle: nextChapter.title,
      });

      // 保存阅读进度（左右键切换时也需要保存）
      saveProgress();

      // 检查书签状态
      // 书签状态由 bookmarkManager 自动管理
    }
  }

  // 添加笔记图标点击事件监听
  const handleNoteIconClick = (event: CustomEvent) => {
    const noteId = event.detail.noteId;
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      selectedNote = note;
      const noteMarker = document.querySelector(`[data-note-id="${noteId}"]`);
      if (noteMarker) {
        const rect = noteMarker.getBoundingClientRect();
        noteViewerPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top,
        };
        noteViewerVisible = true;
      }
    }
  };

  // 处理焦点变化
  function handleVisibilityChange() {
    if (document.hidden) {
      if (isReadingActive) {
        endCurrentSession();
      }
    } else {
      updateActivity();
    }
  }

  // 更新用户活动时间
  function updateActivity() {
    lastActivityTime = Date.now();

    // 如果之前不活跃，重新开始会话
    if (!isReadingActive) {
      startNewSession();
    }
  }

  // 开始新会话
  function startNewSession() {
    if (!currentChapter) return;

    sessionStartTime = Date.now();
    isReadingActive = true;
    lastActivityTime = Date.now();

    dispatch('startReading', {
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      startTime: sessionStartTime,
    });
  }

  // 结束当前会话
  function endCurrentSession() {
    if (!isReadingActive || !sessionStartTime) return;

    const sessionEndTime = Date.now();
    const sessionDuration = sessionEndTime - sessionStartTime;

    dispatch('endReading', {
      endTime: sessionEndTime,
      duration: sessionDuration,
    });

    isReadingActive = false;
    sessionStartTime = null;
  }

  function toggleOutlinePanel() {
    showOutlinePanel = !showOutlinePanel;
  }

  // 处理位置变化
  function handleRelocated(location: any) {
    if (!location || !location.start) return;

    // 查找当前章节
    // 优先使用href匹配
    const href = location.start.href;
    const cfi = location.start.cfi;

    let chapter = chapters.find((ch) => href.includes(ch.href));

    // 如果没有匹配到，尝试使用spine index
    if (!chapter && location.start.index !== undefined) {
      // 这里的逻辑可能需要根据实际epub结构调整
      // 一些epub的chapter与spine一一对应
      // 但这里我们主要依赖href
    }

    if (chapter) {
      if (!currentChapter || currentChapter.id !== chapter.id) {
        currentChapter = chapter;
        currentChapterId = chapter.id;

        // 触发事件
        dispatch('chapterChanged', {
          chapterId: chapter.id,
          chapterTitle: chapter.title,
        });
      }

      // 更新书签管理器位置
      if (bookmarkManager) {
        bookmarkManager.updateCurrentPosition({
          novelId: novel.id,
          novelTitle: novel.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          progress: location.start.percentage || 0,
          metadata: {
            cfi: cfi,
          },
        });
      }
    }
  }

  // 等待rendition.location更新的辅助函数
  // 确保在保存进度前，rendition.location已经更新为新章节的位置
  async function waitForRelocated(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!rendition) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.warn(`[${instanceId}] ⚠️ relocated event timeout, continuing anyway`);
        resolve();
      }, 2000); // 最多等待2秒

      const relocatedHandler = () => {
        console.log(`[${instanceId}] ✅ relocated event fired, location updated`);
        clearTimeout(timeout);
        if (rendition && rendition.off) {
          rendition.off('relocated', relocatedHandler);
        }
        resolve();
      };

      rendition.on('relocated', relocatedHandler);
    });
  }

  export async function jumpToChapter(chapterId: number) {
    const chapter = chapters.find((ch) => ch.id === chapterId);
    if (chapter) {
      // 更新当前章节
      currentChapter = chapter;
      currentChapterId = chapter.id;

      // 使用辅助函数显示章节
      await displayChapter(chapter);

      // 等待rendition.location更新后再保存进度
      await waitForRelocated();

      // 触发章节切换事件
      dispatch('chapterChanged', {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
      });

      // 保存阅读进度（此时rendition.location已更新）
      saveProgress();
    }
  }

  // ==================== 书签功能 ====================
  // 书签功能现在由 ReaderBookmarkManager 统一管理

  // 跳转到书签
  async function handleJumpToBookmark(bookmark: Bookmark) {
    // 优先使用 CFI 跳转
    if (rendition && bookmark.contextBefore) {
      try {
        console.log(`[${instanceId}] Jumping to bookmark CFI:`, bookmark.contextBefore);
        await rendition.display(bookmark.contextBefore);
        showBookmarkPanel = false;
        return;
      } catch (error) {
        console.warn('Failed to jump to CFI, falling back to chapter ID:', error);
      }
    }

    // 回退到章节 ID 跳转
    console.log(`[${instanceId}] Jumping to bookmark chapter ID:`, bookmark.chapterId);
    await jumpToChapter(bookmark.chapterId);

    // 更新访问统计
    plugin.bookmarkService.jumpToBookmark(bookmark);

    // 关闭书签面板
    showBookmarkPanel = false;
  }

  // 处理添加笔记
  async function handleAddNote(event: CustomEvent) {
    // 重置编辑状态
    selectedNote = null;
    if (selectedText) {
      // 确保在打开笔记对话框时选中文本仍然存在
      selectedTextForNote = selectedText;
      showNoteDialog = true;
      showMenu = false; // 关闭菜单
    }
  }

  async function handleCopy() {
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText);
        showMenu = false; // 关闭菜单
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  }

  function handleClickOutside(event: MouseEvent) {
    // 检查点击是否在菜单外部
    const target = event.target as HTMLElement;
    const menuElement = document.querySelector('.selection-menu');

    if (menuElement && !menuElement.contains(target)) {
      // 如果点击不在菜单内，并且不是正在选择文本，则隐藏菜单
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        showMenu = false;
        selectedText = '';
      }
    }
  }

  // hover模式事件处理
  function handleMouseEnter() {
    if (displayMode === 'hover') {
      isMenuVisible = true;
    }
  }

  function handleMouseLeave() {
    if (displayMode === 'hover') {
      isMenuVisible = false;
    }
  }
</script>

<div
  class="epub-reader"
  bind:this={readerElement}
  on:mouseenter={() => (isActive = true)}
  on:mouseleave={() => (isActive = false)}
  on:focus={() => (isActive = true)}
  on:blur={() => (isActive = false)}
  tabindex="0"
>
  <ReadingSessionManager
    currentChapterId={currentChapter?.id || null}
    currentChapterTitle={currentChapter?.title || ''}
    bind:isActive
    on:startReading={(e) => console.log('Start Reading', e.detail)}
    on:endReading={(e) => console.log('End Reading', e.detail)}
  >
    <!-- 目录面板 -->
    <ReaderSidebar
      show={showOutlinePanel}
      chapters={chapters.map((ch, index) => ({
        ...ch,
        page: index + 1,
      }))}
      currentChapterId={currentChapter?.id || null}
      {viewMode}
      {virtualPages}
      {currentPageNum}
      showPageToggle={true}
      on:chapterSelect={(e) => {
        jumpToChapter(e.detail.chapter.id);
        showOutlinePanel = false;
      }}
      on:pageSelect={(e) => {
        jumpToPage(e.detail.page.pageNum);
        showOutlinePanel = false;
      }}
      on:toggleViewMode={toggleViewMode}
      on:close={() => (showOutlinePanel = false)}
    />

    <div class="content-area" id={`content-area-${viewInstanceId}`}>
      <!-- 悬浮章节模式 - 使用 HoverTOC 组件 -->
      <HoverTOC
        show={displayMode === 'hover'}
        chapters={chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          level: ch.level || 0,
        }))}
        currentChapterId={currentChapter?.id || null}
        {viewMode}
        {virtualPages}
        {currentPageNum}
        canToggleView={chapters.length > 0}
        on:chapterSelect={async (e) => {
          await jumpToChapter(e.detail.chapter.id);
          isActive = true;
        }}
        on:pageSelect={(e) => jumpToPage(e.detail.page.pageNum)}
        on:toggleViewMode={toggleViewMode}
      />

      {#if isLoading}
        <LoadingSpinner message="正在加载EPUB电子书..." />
      {/if}

      <!-- 添加文本选择菜单 -->
      {#if showMenu}
        <div
          class="selection-menu"
          style="left: {menuPosition.x}px; top: {menuPosition.y}px"
          on:click|stopPropagation
        >
          <button class="menu-item" on:click={handleCopy}> 复制 </button>
          <button
            class="menu-item"
            on:click={() => {
              if (selectedText) {
                // 构造一个模拟的 CustomEvent
                const mockEvent = new CustomEvent('addNote', {
                  detail: {
                    selectedText: selectedText,
                    // 其他需要的字段可以根据 handleAddNote 的需求添加
                  },
                });
                handleAddNote(mockEvent);
              }
            }}
          >
            添加笔记
          </button>
        </div>
      {/if}

      {#if showNoteDialog}
        <NoteDialog
          isOpen={showNoteDialog}
          selectedText={selectedTextForNote}
          existingNote={selectedNote}
          on:save={handleNoteSave}
          on:close={handleNoteDialogClose}
        />
      {/if}

      <!-- 底部导航栏已移至 ReadingSessionManager -->

      <!-- 工具栏 -->
      <div class="toolbar">
        <ReaderSettingsMenu
          {plugin}
          {novel}
          readerType="epub"
          currentChapterId={currentChapter?.id || 0}
          {notes}
          {readingStats}
          {chapterHistory}
          hasBookmarkAtCurrentPosition={bookmarkManager
            ? ($hasBookmarkAtCurrentPosition ?? false)
            : false}
          {styleManager}
          on:showBookmarks={() => (showBookmarkPanel = true)}
          on:addBookmark={() => {
            if (bookmarkManager && currentChapter && rendition) {
              const currentCfi = getCurrentCfi();
              bookmarkManager.toggleBookmark({
                novelId: novel.id,
                novelTitle: novel.title,
                chapterId: currentChapter.id,
                chapterTitle: currentChapter.title,
                progress: 0,
                contextBefore: currentCfi,
              });
            }
          }}
          on:jumpToChapter={async (event) => {
            await jumpToChapter(event.detail.chapterId);
          }}
          on:editNote={handleNoteEdit}
        />
      </div>

      <!-- 底部导航栏 -->
      <ReaderNavigation
        currentChapter={currentChapterIndex}
        totalChapters={chapters.length}
        currentPage={viewMode === 'pages' ? currentPageNum : currentChapterIndex + 1}
        totalPages={viewMode === 'pages' ? virtualPages.length : chapters.length}
        canGoPrev={viewMode === 'pages'
          ? currentPageNum
            ? currentPageNum > 1
            : false
          : currentChapterIndex > 0}
        canGoNext={viewMode === 'pages'
          ? currentPageNum && virtualPages.length
            ? currentPageNum < virtualPages.length
            : false
          : currentChapterIndex < chapters.length - 1}
        showProgress={true}
        on:prev={handleNavigationPrev}
        on:next={handleNavigationNext}
        on:toggleTOC={toggleOutlinePanel}
      />
    </div>
  </ReadingSessionManager>

  <!-- 键盘导航处理组件 -->
  <KeyboardNavigationHandler
    enabled={isActive}
    readerType="epub"
    canGoPrev={currentChapterIndex > 0}
    canGoNext={currentChapterIndex < chapters.length - 1}
    on:prevChapter={handleNavigationPrev}
    on:nextChapter={handleNavigationNext}
    on:toggleTOC={handleToggleTOC}
    on:closePanel={handleClosePanel}
  />

  <!-- 进度管理组件 -->
  <ReaderProgressManager
    {plugin}
    {novel}
    readerType="epub"
    totalChapters={chapters.length}
    bind:currentPosition={progressPosition}
    on:save={(e) => {
      console.log('[EPUB] Progress auto-saved:', e.detail.progress);
    }}
  />
</div>

<!-- 书签面板 -->
<BookmarkPanelWrapper
  {plugin}
  novelId={novel.id}
  currentChapterId={currentChapter?.id || 0}
  show={showBookmarkPanel}
  on:jump={(e) => {
    if (bookmarkManager) {
      bookmarkManager.goToBookmark(e.detail);
    }
  }}
  on:close={() => (showBookmarkPanel = false)}
/>

<style>
  /* 设置 */
  .toolbar {
    position: fixed;
    top: var(--novel-spacing-lg);
    right: var(--novel-spacing-md);
    z-index: 1000;
  }

  .epub-reader {
    height: 100%;
    display: flex;
    flex-direction: row;
    position: relative;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    overflow: hidden;
    position: relative;
    padding-bottom: 56px;
  }

  :global(.epub-viewer-container) {
    width: 100%;
    height: 100%;
    overflow-y: auto !important;
  }

  /* EPUB iframe 内部样式 */
  :global(.epub-viewer-container iframe) {
    width: 100% !important;
    height: 100% !important;
  }

  /* EPUB 文档样式 - 应用统一设计系统 */
  :global(.epub-doc) {
    padding: var(--novel-spacing-lg) var(--novel-spacing-2xl) !important;
    line-height: 1.8 !important;
    font-size: 16px !important;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.epub-doc p) {
    margin: 1em 0 !important;
  }

  /* 漫画阅读器相关样式 */
  :global(.epub-viewer-container.manga-mode) {
    width: 100%;
    height: 100%;
    overflow-y: auto !important;
    scroll-behavior: smooth;
  }

  :global(.epub-viewer-container.manga-mode iframe) {
    width: 100% !important;
    min-height: 100% !important;
    border: none !important;
  }

  :global(.manga-content) {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 0 !important;
  }

  :global(.manga-content img) {
    max-width: 100% !important;
    height: auto !important;
    display: block !important;
    margin: 0 auto !important;
  }

  /* 优化滚动条样式 */
  :global(.epub-viewer-container.manga-mode::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.epub-viewer-container.manga-mode::-webkit-scrollbar-track) {
    background: var(--background-primary);
  }

  :global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb) {
    background: var(--background-modifier-border);
    border-radius: 4px;
  }

  :global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb:hover) {
    background: var(--background-modifier-hover);
  }

  .selection-menu {
    position: fixed;
    z-index: 1000;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 4px;
    transform: translate(-50%, -50%);
  }

  /* 添加显示隐藏的动画效果 */
  .selection-menu.entering {
    opacity: 0;
    transform: translate(-50%, 10px);
  }

  .selection-menu.visible {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .menu-item {
    display: block;
    padding: 6px 12px;
    min-width: 100px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-normal);
    font-size: 14px;
    border-radius: 4px;
    text-align: left;
    width: 100%;
    transition: background-color 0.2s;
  }

  .menu-item:hover {
    background-color: var(--background-modifier-hover);
  }

  .menu-item + .menu-item {
    margin-top: 2px;
  }
</style>
