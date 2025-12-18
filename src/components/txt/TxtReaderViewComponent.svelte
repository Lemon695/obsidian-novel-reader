<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import type { Novel, ReadingProgress } from '../../types';
  import type NovelReaderPlugin from '../../main';
  import type { ChapterHistory } from '../../types/reading-stats';
  import type { ChapterProgress } from '../../types/txt/txt-reader';
  import {
    handleChapterChange,
    parseChapters,
    switchChapter,
  } from '../../lib/txt.reader/chapter-logic';
  import ReaderProgressManager from '../reader/ReaderProgressManager.svelte';
  import { scrollPage } from '../../lib/txt.reader/scroll-control';
  import type { Note } from '../../types/notes';
  import NoteDialog from '../NoteDialog.svelte';
  import { v4 as uuidv4 } from 'uuid';
  import NoteViewer from '../NoteViewer.svelte';
  import ReaderSettingsMenu from '../setting/ReaderSettingsMenu.svelte';
  import { Notice } from 'obsidian';
  import TextSelectionMenu from '../TextSelectionMenu.svelte';
  import { NotesService } from '../../services/note/notes-service';
  import { icons } from '../library/icons';
  import { debounce, throttle } from '../../utils/debounce';
  import BookmarkPanelWrapper from '../reader/BookmarkPanelWrapper.svelte';
  import type { Bookmark } from '../../types/bookmark';
  import { ReadingStatsService } from '../../services/reading-stats-service';
  import ReaderSidebar from '../reader/ReaderSidebar.svelte';
  import ReaderNavigation from '../reader/ReaderNavigation.svelte';
  import HoverTOC from '../reader/HoverTOC.svelte';
  import KeyboardNavigationHandler from '../reader/KeyboardNavigationHandler.svelte';
  import ReadingSessionManager from '../reader/ReadingSessionManager.svelte';
  // 统一渲染器
  import { TxtRenderer, ReaderStyleManager, ReaderBookmarkManager } from '../../services/renderer';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let content: string = '';
  export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
  export let currentChapterId: number | null = null;
  export let initialChapterId: number | null = null; //初始打开图书选择的章节ID
  export let initialNoteId: string | undefined = undefined;
  export let savedProgress: ReadingProgress | null = null;
  export let chapters: ChapterProgress[] = [];

  // 唯一实例ID用于调试
  const instanceId = `TXT-${novel.id.substring(0, 8)}-${Date.now()}`;
  console.log(`[${instanceId}] Component created for novel: ${novel.title}`);

  let notesService: NotesService; //笔记

  let isActive = false;
  let readerElement: HTMLElement; // 阅读器主元素引用

  // 统一渲染器实例
  let renderer: TxtRenderer | null = null;
  let styleManager: ReaderStyleManager | null = null;

  let currentChapter: ChapterProgress | null = null;
  let contentLoaded = false;
  let isMenuVisible = false;

  // 目录面板显示状态
  let showOutlinePanel = false;

  // ReadingSessionManager handles this now
  let chapterElements: Map<number, HTMLElement> = new Map();

  let notes: Note[] = [];
  let noteViewerPosition = { x: 0, y: 0 };

  let showNoteDialog = false; // 控制笔记对话框显示
  let noteViewerVisible = false; // 控制笔记查看器显示
  let selectedNote: Note | null = null;
  let selectedTextForNote = '';
  let selectedTextIndex = 0;
  let currentLineNumber = 0;

  let readingStats: unknown = null;

  // 书签管理器
  let bookmarkManager: ReaderBookmarkManager | null = null;
  let showBookmarkPanel = false;

  // 节流函数引用（用于清理）
  let throttledCheckBookmark: (() => void) | null = null;

  // 从书签管理器中提取 store
  $: hasBookmarkAtCurrentPosition = bookmarkManager?.hasBookmarkAtCurrentPosition;

  let processedContent: { notes: Note[]; text: string; lineNumber: number }[];
  let chapterHistory: ChapterHistory[] = [];
  let selectedTextChapterId = 0;
  let showNoteList = false;

  // TXT 悬浮目录：目录/页码切换功能
  const LINES_PER_PAGE = 160; // 每页显示160行
  let viewMode: 'chapters' | 'pages' = 'chapters';
  let virtualPages: Array<{
    pageNum: number;
    chapterId: number;
    chapterTitle: string;
    startLine: number;
    endLine: number;
    absoluteStartLine: number; // 原始文本绝对行号
    absoluteEndLine: number; // 原始文本绝对行号
  }> = [];
  let currentPageNum = 1;
  let currentVirtualPage: (typeof virtualPages)[0] | null = null;

  // 进度位置类型定义（与 ReaderProgressManager 一致）
  interface ProgressPosition {
    chapterIndex: number;
    chapterTitle: string;
    timestamp?: number;
    scrollPosition?: number;
    cfi?: string;
    chapterId?: number;
    pageNum?: number;
  }

  // 进度管理
  let progressPosition: ProgressPosition = {
    chapterIndex: 0,
    chapterTitle: '',
    scrollPosition: 0,
  };

  // 更新进度位置的响应式语句
  $: if (currentChapter || currentVirtualPage) {
    if (viewMode === 'chapters' && currentChapter) {
      // 章节模式
      const chapterIndex = chapters.findIndex((c) => c.id === currentChapter.id);
      progressPosition = {
        chapterIndex: (chapterIndex >= 0 ? chapterIndex : 0) + 1, // Save as 1-based index
        chapterTitle: currentChapter.title,
        chapterId: currentChapter.id,
        scrollPosition: 0,
      };
    } else if (viewMode === 'pages' && currentVirtualPage) {
      progressPosition = {
        // use pageNum as chapterIndex (1-based) for Page Mode
        chapterIndex: currentVirtualPage.pageNum,
        chapterTitle: currentVirtualPage.chapterTitle || `第 ${currentVirtualPage.pageNum} 页`,
        chapterId: currentVirtualPage.chapterId || 0,
        scrollPosition: 0,
        pageNum: currentVirtualPage.pageNum,
      };
    }
  }

  // 计算基于行数的虚拟页码
  function calculateVirtualPages() {
    virtualPages = [];
    let pageNum = 1;

    // 页码模式：直接按原始文本160行分页，不考虑章节
    if (viewMode === 'pages' || chapters.length === 0) {
      const lines = content.split('\n');
      const totalLines = lines.length;

      for (let startLine = 0; startLine < totalLines; startLine += LINES_PER_PAGE) {
        const endLine = Math.min(startLine + LINES_PER_PAGE - 1, totalLines - 1);

        virtualPages.push({
          pageNum: pageNum++,
          chapterId: 0, // 页码模式不关联章节
          chapterTitle: '',
          startLine: startLine,
          endLine: endLine,
          absoluteStartLine: startLine,
          absoluteEndLine: endLine,
        });
      }
    } else {
      // 章节模式：基于章节分页
      let absoluteLineOffset = 0;

      chapters.forEach((chapter) => {
        const lines = chapter.content.split('\n');
        const totalLines = lines.length;

        // 为每个章节按行数分页
        for (let startLine = 0; startLine < totalLines; startLine += LINES_PER_PAGE) {
          const endLine = Math.min(startLine + LINES_PER_PAGE - 1, totalLines - 1);

          virtualPages.push({
            pageNum: pageNum++,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            startLine: startLine,
            endLine: endLine,
            absoluteStartLine: absoluteLineOffset + startLine,
            absoluteEndLine: absoluteLineOffset + endLine,
          });
        }

        absoluteLineOffset += totalLines;
      });
    }

    // 初始化第一页
    if (virtualPages.length > 0) {
      currentVirtualPage = virtualPages[0];
      currentPageNum = 1;
    }
  }

  async function jumpToLineNumber(lineNumber: number) {
    await tick();
    const contentElement = document.querySelector('.content-area');
    if (!(contentElement instanceof HTMLElement)) return;

    const target = contentElement.querySelector(`p[data-line-number="${lineNumber}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function handleJumpToNote(event: CustomEvent) {
    const { note } = event.detail as { note: Note };
    if (!note) return;
    await jumpToNote(note);
  }

  async function jumpToNote(note: Note) {
    if (!note) return;

    if (viewMode !== 'chapters') {
      viewMode = 'chapters';
      if (!novel.customSettings) {
        novel.customSettings = {};
      }
      novel.customSettings.txtViewMode = viewMode;
      calculateVirtualPages();
      await plugin.libraryService.updateNovel(novel);
    }

    const chapter = chapters.find((ch) => ch.id === note.chapterId);
    if (chapter) {
      selectChapter(chapter);
    }

    if (note.lineNumber >= 0) {
      await jumpToLineNumber(note.lineNumber);
      return;
    }

    if (note.textIndex >= 0) {
      const approxLine = Math.max(0, Math.floor(note.textIndex / 80));
      await jumpToLineNumber(approxLine);
    }
  }

  let lastAutoJumpNoteId: string | undefined;
  $: if (initialNoteId && notes && notes.length > 0 && initialNoteId !== lastAutoJumpNoteId) {
    const note = notes.find((n) => n.id === initialNoteId);
    if (note) {
      lastAutoJumpNoteId = initialNoteId;
      void jumpToNote(note);
    }
  }

  // 根据当前章节计算当前页码
  function updateCurrentPage() {
    if (viewMode === 'chapters') {
      // 章节模式：基于当前章节
      if (!currentChapter || virtualPages.length === 0) return;

      // 提取局部变量解决TypeScript控制流分析问题
      const chapter = currentChapter;
      const page = virtualPages.find((p) => p.chapterId === chapter.id && p.startLine === 0);
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
  function jumpToPage(pageNum: number) {
    const page = virtualPages.find((p) => p.pageNum === pageNum);
    if (!page) return;

    currentVirtualPage = page;
    currentPageNum = pageNum;

    if (viewMode === 'pages') {
      // 页码模式：不依赖章节，直接保存页码进度
      // 如果有章节信息，设置一个有效的currentChapter以避免空指针
      if (page.chapterId > 0) {
        const targetChapter = chapters.find((ch) => ch.id === page.chapterId);
        if (targetChapter && (!currentChapter || currentChapter.id !== targetChapter.id)) {
          currentChapter = targetChapter;
        }
      } else if (chapters.length > 0 && !currentChapter) {
        // 页码模式下，设置一个默认章节以避免空指针
        currentChapter = chapters[0];
      }

      // 记录页码历史
      recordPageHistory(pageNum);
    } else {
      // 章节模式：在跨章节时更新currentChapter
      const targetChapter = chapters.find((ch) => ch.id === page.chapterId);
      if (targetChapter && (!currentChapter || currentChapter.id !== targetChapter.id)) {
        currentChapter = targetChapter;
        currentChapterId = targetChapter.id;

        // 记录章节历史和保存进度
        recordChapterHistory(targetChapter);
      }
    }
  }

  // 切换到上一页/下一页
  function switchPage(direction: 'prev' | 'next') {
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

  // 记录页码历史
  async function recordPageHistory(pageNum: number) {
    const pageTitle = `第 ${pageNum} 页`;
    try {
      await plugin.chapterHistoryService.addHistory(novel.id, pageNum, pageTitle);
      const newHistory = await plugin.chapterHistoryService.getHistory(novel.id);
      chapterHistory = newHistory;
    } catch (error) {
      console.error('Failed to record page history:', error);
    }
  }

  // 获取当前虚拟页的内容
  function getCurrentPageContent(): string[] {
    if (!currentVirtualPage) return [];

    if (viewMode === 'pages') {
      // 页码模式：使用原始文本，完全不考虑章节
      const lines = content.split('\n');
      return lines.slice(
        currentVirtualPage.absoluteStartLine,
        currentVirtualPage.absoluteEndLine + 1
      );
    } else {
      // 章节模式：使用章节内容
      if (!currentChapter) return [];
      const lines = currentChapter.content.split('\n');
      return lines.slice(currentVirtualPage.startLine, currentVirtualPage.endLine + 1);
    }
  }

  // 从 novel.customSettings 读取用户偏好
  $: {
    if (novel?.customSettings?.txtViewMode) {
      viewMode = novel.customSettings.txtViewMode;
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
    novel.customSettings.txtViewMode = viewMode;

    // 重新计算虚拟页（因为页码模式和章节模式的分页逻辑不同）
    calculateVirtualPages();

    // 更新到数据库
    await plugin.libraryService.updateNovel(novel);
  }

  // 合并所有 onMount 逻辑，避免重复的事件监听器
  onMount(() => {
    let noteFileModifyHandler: any;
    let noteIconClickListener: EventListener;

    // 1. 初始化笔记服务
    notesService = new NotesService(plugin.app, plugin);

    // 获取当前小说的笔记文件路径
    const currentNotePath = plugin.pathsService.getNotesPath(novel.id);
    console.log('监听笔记文件:', currentNotePath);

    // 监听笔记文件变化，实时更新
    noteFileModifyHandler = plugin.app.vault.on('modify', async (file) => {
      // 检查是否是当前小说的笔记文件（精确匹配）
      if (file.path === currentNotePath) {
        console.log('笔记文件已修改，重新加载笔记:', file.path);

        // 添加小延迟确保文件已完全写入
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 重新加载笔记
        const newNotes = await notesService.loadNotes(novel.id);
        console.log('重新加载后的笔记数量:', newNotes.length);
        notes = newNotes;

        // 触发重新渲染
        if (currentChapter) {
          currentChapter = { ...currentChapter };
        }
      }
    });

    void (async () => {
      notes = await notesService.loadNotes(novel.id);
      await loadReadingStats();

      // 1.5. 初始化统一渲染器
      await tick();
      try {
        if (readerElement) {
          renderer = new TxtRenderer(readerElement);
          styleManager = new ReaderStyleManager(renderer, plugin, novel.id);
          styleManager.applyAllSettings();
          console.log(`[${instanceId}] 渲染器初始化成功`);
        }
      } catch (error) {
        console.error(`[${instanceId}] 渲染器初始化失败:`, error);
      }

      // 1.6. 初始化书签管理器
      try {
        bookmarkManager = new ReaderBookmarkManager(
          plugin.bookmarkService,
          novel.id,
          async (bookmark) => {
            await handleJumpToBookmark(bookmark);
          }
        );
        await bookmarkManager.initialize();
        console.log(`[${instanceId}] 书签管理器初始化成功`);
      } catch (error) {
        console.error(`[${instanceId}] 书签管理器初始化失败:`, error);
      }

      // 2. 解析章节和恢复阅读进度
      if (content) {
        parseAndSetChapters();
        contentLoaded = true;

        // 恢复上次阅读进度
        if (savedProgress?.position?.chapterId) {
          currentChapterId = savedProgress.position.chapterId;
          const savedChapter = chapters.find((ch) => ch.id === currentChapterId);
          if (savedChapter) {
            currentChapter = savedChapter;
          }

          // 如果是页码模式且有保存的页码进度，恢复到对应页码
          if (viewMode === 'pages' && savedProgress.chapterIndex !== undefined) {
            const savedPageNum = savedProgress.chapterIndex; // pageNum saved as chapterIndex (1-based)
            const savedPage = virtualPages.find((p) => p.pageNum === savedPageNum);
            if (savedPage) {
              currentVirtualPage = savedPage;
              currentPageNum = savedPageNum;
            }
          }
        } else if (initialChapterId !== null) {
          // 如果有初始章节ID，加载该章节
          const savedChapter = chapters.find((ch) => ch.id === initialChapterId);
          if (savedChapter) {
            currentChapter = savedChapter;
            currentChapterId = savedChapter.id;
          }
        } else if (chapters.length > 0) {
          // 否则加载第一章
          currentChapter = chapters[0];
          currentChapterId = chapters[0].id;
        }
      }

      // 初始化时滚动到当前章节
      if (currentChapter) {
      }

      // 添加笔记图标点击事件监听
      const handleNoteIconClick = async (event: CustomEvent) => {
        const noteId = event.detail.noteId;

        // 重新加载笔记，确保显示最新内容
        console.log('点击笔记图标，重新加载笔记');
        notes = await notesService.loadNotes(novel.id);

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

      // 添加所有事件监听器（确保每个事件只监听一次）
      // 键盘事件已改为主div的on:keydown，不再使用全局window监听
      noteIconClickListener = (evt: Event) => {
        void handleNoteIconClick(evt as CustomEvent);
      };
      window.addEventListener('noteIconClick', noteIconClickListener);
    })();

    // 8. 返回清理函数，移除所有事件监听器
    return () => {
      // 清理渲染器
      try {
        if (renderer) {
          renderer.destroy();
          renderer = null;
          styleManager = null;
          console.log(`[${instanceId}] 渲染器已清理`);
        }
      } catch (error) {
        console.error(`[${instanceId}] 渲染器清理失败:`, error);
      }

      // 清理防抖函数，防止内存泄漏
      debouncedRenderChapter.cancel();
      debouncedScrollToChapter.cancel();

      // 移除所有事件监听器
      // 键盘事件已改为主div的on:keydown，不需要在这里移除
      if (noteIconClickListener) {
        window.removeEventListener('noteIconClick', noteIconClickListener);
      }

      if (noteFileModifyHandler) {
        plugin.app.vault.offref(noteFileModifyHandler);
      }
    };
  });

  $: if (content && !contentLoaded) {
    parseAndSetChapters();
    contentLoaded = true;
  }

  $: if (currentChapterId !== null && chapters.length > 0) {
    console.log(`[${instanceId}] 🔄 Reactive statement triggered by currentChapterId change`, {
      currentChapterId: currentChapterId,
      novelId: novel.id,
      novelTitle: novel.title,
      isActive: isActive,
      stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n'),
    });

    const chapter = chapters.find((c) => c.id === currentChapterId);
    if (chapter) {
      currentChapter = chapter;
      // 只在章节模式下保存章节进度，页码模式下由switchPage单独处理
    }
  }

  // 防抖的章节内容渲染（延迟300ms执行，减少DOM重绘）
  const debouncedRenderChapter = debounce((chapter: ChapterProgress) => {
    processedContent = renderChapterContent(chapter);
  }, 300);

  // 防抖的滚动操作（延迟200ms执行）
  const debouncedScrollToChapter = debounce((container: HTMLElement) => {
    scrollToActiveChapter(container);
  }, 200);

  // 章节切换时更新会话
  $: if (currentChapter) {
    // 只在章节模式下记录章节历史，页码模式下由recordPageHistory单独处理
    if (viewMode === 'chapters') {
      handleChapterChange(currentChapter, novel, plugin.chapterHistoryService, (newHistory) => {
        chapterHistory = newHistory as ChapterHistory[];
      });
    }

    // 使用防抖渲染章节内容，减少高频DOM操作
    debouncedRenderChapter(currentChapter);
  }

  // 当打开全屏目录时，自动滚动到当前章节

  function parseAndSetChapters() {
    chapters = parseChapters(content, novel);
    if (chapters.length > 0) {
      currentChapter = chapters[0];
    }
    // 计算虚拟页码
    calculateVirtualPages();
    // 触发自定义事件通知父组件章节更新
    const event = new CustomEvent('chaptersUpdated', {
      detail: { chapters },
    });
    window.dispatchEvent(event);
  }

  // sidebar切换函数

  // 键盘导航处理函数
  function handlePrevChapter() {
    if (viewMode === 'pages') {
      switchPage('prev');
    } else {
      handleSwitchChapter('prev');
    }
  }

  function handleNextChapter() {
    if (viewMode === 'pages') {
      switchPage('next');
    } else {
      handleSwitchChapter('next');
    }
  }

  function handleToggleTOC() {
    showOutlinePanel = !showOutlinePanel;
  }

  function handleClosePanel() {
    if (showOutlinePanel) {
      showOutlinePanel = false;
    } else if (showBookmarkPanel) {
      showBookmarkPanel = false;
    } else if (showNoteList) {
      showNoteList = false;
    }
  }

  function smoothScrollToTop(element: HTMLElement | Window, duration: number) {
    const start = element === window ? window.scrollY : (element as HTMLElement).scrollTop;
    const change = -start; // 滚动到顶部，目标位置是 0
    const startTime = performance.now();

    function animateScroll(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // 限制进度在 0 到 1 之间
      const easeInOutQuad =
        progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; // 缓动函数
      const position = start + change * easeInOutQuad;

      if (element === window) {
        window.scrollTo(0, position);
      } else {
        (element as HTMLElement).scrollTop = position;
      }

      if (elapsed < duration) {
        requestAnimationFrame(animateScroll);
      }
    }

    requestAnimationFrame(animateScroll);
  }

  // 处理章节切换
  function handleSwitchChapter(direction: 'prev' | 'next') {
    console.log(`[${instanceId}] 📖 handleSwitchChapter called`, {
      direction: direction,
      currentChapterId: currentChapterId,
      currentChapterTitle: currentChapter?.title,
      novelTitle: novel.title,
    });

    switchChapter(
      direction,
      currentChapter,
      chapters,
      (newChapter) => {
        console.log(`[${instanceId}] 📝 Updating currentChapterId in handleSwitchChapter`, {
          oldChapterId: currentChapterId,
          newChapterId: newChapter.id,
          newChapterTitle: newChapter.title,
        });

        currentChapter = newChapter;
        currentChapterId = newChapter.id;

        // 更新书签管理器的当前位置
        bookmarkManager?.updateCurrentPosition({
          novelId: novel.id,
          novelTitle: novel.title,
          chapterId: newChapter.id,
          chapterTitle: newChapter.title,
          progress: 0,
        });

        // 书签状态由 bookmarkManager 自动管理

        dispatch('chapterChanged', { chapterId: newChapter.id });
      },
      () => {
        setTimeout(() => {
          const contentElement = document.querySelector('.content-area');
          const duration = 100; // 滚动持续时间（毫秒）

          if (contentElement instanceof HTMLElement) {
            smoothScrollToTop(contentElement, duration);
          }

          smoothScrollToTop(window, duration);
        }, 100);
      }
    );
  }

  function toggleOutlinePanel() {
    showOutlinePanel = !showOutlinePanel;
  }

  function selectChapter(chapter: ChapterProgress) {
    currentChapter = chapter;
    currentChapterId = chapter.id;

    // 记录章节历史
    recordChapterHistory(chapter);

    // 更新书签管理器的当前位置
    bookmarkManager?.updateCurrentPosition({
      novelId: novel.id,
      novelTitle: novel.title,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      progress: 0,
    });

    // 滚动到顶部
    setTimeout(() => {
      const contentElement = document.querySelector('.content-area');
      const duration = 100;

      if (contentElement instanceof HTMLElement) {
        smoothScrollToTop(contentElement, duration);
      }

      smoothScrollToTop(window, duration);

      // 设置焦点到阅读器主元素，使键盘事件生效
      if (readerElement) {
        readerElement.focus();
      }

      // 滚动后再次检查书签（因为滚动位置已改变）
      // 书签状态由 bookmarkManager 自动管理
    }, 100);
  }

  // 记录章节历史
  async function recordChapterHistory(chapter: ChapterProgress) {
    try {
      await plugin.chapterHistoryService.addHistory(novel.id, chapter.id, chapter.title);
      const newHistory = await plugin.chapterHistoryService.getHistory(novel.id);
      chapterHistory = newHistory;
    } catch (error) {
      console.error('Failed to record chapter history:', error);
    }
  }

  // 统一的滚动处理函数
  function scrollToActiveChapter(container: HTMLElement) {
    if (!container || currentChapter === null) return;

    const activeElement = chapterElements.get(currentChapter.id);
    if (!activeElement) return;

    const containerHeight = container.clientHeight;
    const elementOffset = activeElement.offsetTop;
    const elementHeight = activeElement.clientHeight;

    // 计算滚动位置，使当前章节居中显示
    const scrollPosition = elementOffset - containerHeight / 2 + elementHeight / 2;

    container.scrollTo({
      top: scrollPosition,
      behavior: 'smooth',
    });
  }

  // 跟踪章节元素
  function setChapterElement(node: HTMLElement, id: number) {
    chapterElements.set(id, node);
    return {
      destroy() {
        chapterElements.delete(id);
      },
    };
  }

  function handleScroll(dir: 'up' | 'down') {
    scrollPage(dir, '.content-area');
  }

  async function handleAddNote(event: CustomEvent) {
    console.log('handleAddNote event:', event.detail);
    closeAllNoteDialogs(); // 先关闭所有笔记弹窗

    selectedTextForNote = event.detail.selectedText;
    selectedTextIndex = event.detail.textIndex;
    selectedTextChapterId = event.detail.chapterId;
    currentLineNumber = event.detail.lineNumber; // 保存行号
    showNoteDialog = true;
  }

  // 4. 修改保存笔记的逻辑以匹配新的渲染方式
  async function handleNoteSave(event: CustomEvent) {
    if (!currentChapter) return;

    if (selectedNote) {
      // 编辑已有笔记
      notes = notes.map((note) =>
        note.id === selectedNote?.id
          ? { ...note, content: event.detail.content, timestamp: Date.now() }
          : note
      );
    } else {
      // 添加新笔记
      const note: Note = {
        id: uuidv4(),
        chapterId: currentChapter.id,
        chapterName: currentChapter.title,
        selectedText: selectedTextForNote,
        content: event.detail.content,
        timestamp: Date.now(),
        textIndex: selectedTextIndex,
        textLength: selectedTextForNote.length,
        lineNumber: currentLineNumber,
      };
      notes = [...notes, note];
    }

    await saveNotes();
    closeAllNoteDialogs(); // 保存后关闭所有弹窗

    // 触发更新
    if (currentChapter) {
      currentChapter = { ...currentChapter };
    }
  }

  function renderChapterContent(chapter: ChapterProgress) {
    if (!chapter) return [];

    const lines = chapter.content.split('\n');

    // 返回行信息对象数组,包含原始文本和笔记信息
    return lines.map((line, lineIdx) => {
      // 获取这一行的笔记
      const lineNotes = notes.filter((note) => note.lineNumber === lineIdx);

      return {
        text: line,
        notes: lineNotes,
        lineNumber: lineIdx,
      };
    });
  }

  // 监听章节变化时更新统计
  $: if (currentChapter) {
    loadReadingStats();
  }

  function addNoteMarkers(paragraph: string, chapterId: number, lineIndex: number): string {
    if (!notes || !currentChapter) return paragraph;

    // 筛选当前行的笔记
    const lineNotes = notes.filter(
      (note) => note.chapterId === chapterId && note.lineNumber === lineIndex
    );

    if (lineNotes.length === 0) return paragraph;

    let result = paragraph;
    const sortedNotes = [...lineNotes].sort((a, b) => b.textIndex - a.textIndex);

    for (const note of sortedNotes) {
      const start = note.textIndex;
      const end = start + note.textLength;

      if (start >= 0 && end <= result.length) {
        const before = result.slice(0, start);
        const highlighted = result.slice(start, end);
        const after = result.slice(end);

        // 修改这里，给笔记图标添加数据属性和点击事件处理
        result = `${before}<span class="note-highlight" data-note-id="${note.id}">
                ${highlighted}
                <button
                    class="note-marker"
                    data-note-id="${note.id}"
                    onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('noteIconClick', {detail: {noteId: '${note.id}'}}))"
                    title="点击查看笔记">
                    ${icons.note}
                </button>
            </span>${after}`;
      }
    }

    return result;
  }

  async function handleNoteDelete(event: CustomEvent) {
    const { noteId } = event.detail;
    notes = notes.filter((n) => n.id !== noteId);
    await saveNotes();
    noteViewerVisible = false;
    selectedNote = null;

    // 触发重新渲染
    if (currentChapter) {
      currentChapter = { ...currentChapter };
    }
  }

  function handleNoteEdit(event: CustomEvent) {
    const { note } = event.detail;
    noteViewerVisible = false; // 关闭查看器
    selectedNote = note; // 保存当前编辑的笔记
    selectedTextForNote = note.selectedText; // 确保显示正确的选中文本
    showNoteDialog = true; // 显示编辑对话框
  }

  function handleNoteDialogClose() {
    closeAllNoteDialogs();
  }

  function closeAllNoteDialogs() {
    showNoteDialog = false;
    noteViewerVisible = false;
    selectedNote = null;
    selectedTextForNote = '';
  }

  function handleNoteClick(event: MouseEvent, noteId: string) {
    event.stopPropagation();
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      closeAllNoteDialogs(); // 先关闭所有笔记弹窗

      selectedNote = note;
      const target = event.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      noteViewerPosition = {
        x: rect.left,
        y: rect.top,
      };
      noteViewerVisible = true;
    }
  }

  // 获取阅读统计
  async function loadReadingStats() {
    if (novel) {
      try {
        const statsService = new ReadingStatsService(plugin.app, plugin);
        readingStats = await statsService.getNovelStats(novel.id);
      } catch (error) {
        console.error('Failed to load reading stats:', error);
      }
    }
  }

  async function saveNotes() {
    console.log('保存笔记:', novel.id, '笔记数量:', notes.length);
    await notesService.saveNotes(novel.id, novel.title, notes);
    console.log('笔记保存完成');
  }

  async function loadNotesForNovel() {
    notes = await notesService.loadNotes(novel.id);
  }

  // ==================== 书签功能 ====================
  // 书签功能现在由 ReaderBookmarkManager 统一管理
  // 跳转到书签
  async function handleJumpToBookmark(bookmark: Bookmark) {
    // 切换到对应章节
    if (bookmark.chapterId !== currentChapter?.id) {
      const targetChapter = chapters.find((c) => c.id === bookmark.chapterId);
      if (targetChapter) {
        selectChapter(targetChapter);
      }
    }

    // 滚动到书签位置
    setTimeout(() => {
      if (readerElement) {
        readerElement.scrollTop = bookmark.position;
      }
    }, 200);

    // 更新访问统计
    plugin.bookmarkService.jumpToBookmark(bookmark);

    // 关闭书签面板
    showBookmarkPanel = false;
  }
</script>

<!-- Main Reader Container -->
<div
  class="txt-reader"
  bind:this={readerElement}
  tabindex="0"
  role="region"
  aria-label="Novel Reader"
>
  <!-- 目录面板 -->
  <ReaderSidebar
    show={showOutlinePanel}
    chapters={(chapters || []).map((ch, index) => ({ ...ch, page: index + 1 }))}
    currentChapterId={currentChapterId || 0}
    {viewMode}
    {virtualPages}
    {currentPageNum}
    showPageToggle={false}
    on:chapterSelect={(e) => {
      selectChapter(e.detail.chapter);
      showOutlinePanel = false;
    }}
    on:pageSelect={(e) => {
      jumpToPage(e.detail.page.pageNum);
      showOutlinePanel = false;
    }}
    on:toggleViewMode={toggleViewMode}
    on:close={() => (showOutlinePanel = false)}
  />

  <ReadingSessionManager
    currentChapterId={viewMode === 'chapters' ? currentChapterId || null : currentPageNum}
    currentChapterTitle={viewMode === 'chapters'
      ? currentChapter?.title || ''
      : `第 ${currentPageNum} 页`}
    bind:isActive
    on:startReading={(e) => console.log('Start Reading', e.detail)}
    on:endReading={(e) => console.log('End Reading', e.detail)}
  >
    <!-- 悬浮章节模式 - 使用 HoverTOC 组件 -->
    <HoverTOC
      show={displayMode === 'hover'}
      chapters={chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        level: 0,
        subChapters: [],
      }))}
      currentChapterId={currentChapterId || 0}
      {viewMode}
      {virtualPages}
      {currentPageNum}
      canToggleView={false}
      on:chapterSelect={(e) => selectChapter(e.detail.chapter)}
      on:pageSelect={(e) => jumpToPage(e.detail.page.pageNum)}
      on:toggleViewMode={toggleViewMode}
    />

    <!-- 大纲章节模式 -->

    <!-- 侧边栏模式（可折叠） -->

    <!-- 内容区域 -->
    <div class="content-area">
      {#if viewMode === 'chapters'}
        <!-- 章节模式：显示完整章节 -->
        {#if currentChapter}
          <div class="chapter-content">
            <h2>{currentChapter.title}</h2>
            <div class="content-text">
              {#each currentChapter.content.split('\n') as paragraph, index}
                <p data-line-number={index}>
                  {@html addNoteMarkers(paragraph, currentChapter.id, index)}
                </p>
              {/each}
            </div>
            <!-- 导航栏 -->
            <ReaderNavigation
              currentChapter={currentChapterId || 1}
              totalChapters={chapters.length}
              currentPage={currentChapterId || 1}
              totalPages={chapters.length}
              canGoPrev={currentChapterId !== null && currentChapterId > 0}
              canGoNext={currentChapterId !== null && currentChapterId < chapters.length - 1}
              on:prev={() => handleSwitchChapter('prev')}
              on:next={() => handleSwitchChapter('next')}
              on:toggleTOC={toggleOutlinePanel}
            />
          </div>
        {:else}
          <div class="no-chapter">请选择要阅读的章节</div>
        {/if}
      {:else}
        <!-- 页码模式：只显示当前虚拟页的内容 -->
        {#if currentVirtualPage}
          <div class="chapter-content">
            <h2>第 {currentVirtualPage.pageNum} 页</h2>
            <div class="content-text">
              {#each getCurrentPageContent() as paragraph, index}
                <p data-line-number={currentVirtualPage.absoluteStartLine + index}>
                  {@html addNoteMarkers(
                    paragraph,
                    currentVirtualPage.chapterId || 0,
                    currentVirtualPage.absoluteStartLine + index
                  )}
                </p>
              {/each}
            </div>
            <!-- 页码导航已由 ReaderNavigation 组件统一处理 -->
          </div>
        {:else}
          <div class="no-chapter">请选择要阅读的页面</div>
        {/if}
      {/if}

      <TextSelectionMenu
        novelId={novel?.id || ''}
        chapterId={currentChapter?.id || 0}
        on:addNote={handleAddNote}
      />

      {#if showNoteDialog}
        <NoteDialog
          isOpen={showNoteDialog}
          selectedText={selectedTextForNote}
          existingNote={selectedNote}
          on:save={handleNoteSave}
          on:close={handleNoteDialogClose}
        />
      {/if}
    </div>

    {#if selectedNote && noteViewerVisible}
      <NoteViewer
        note={selectedNote}
        position={noteViewerPosition}
        visible={noteViewerVisible}
        on:close={closeAllNoteDialogs}
        on:delete={handleNoteDelete}
        on:edit={handleNoteEdit}
      />
    {/if}

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

    <div class="toolbar">
      <ReaderSettingsMenu
        {plugin}
        {novel}
        {content}
        readerType="txt"
        currentChapterId={currentChapter?.id}
        {notes}
        {readingStats}
        {chapterHistory}
        hasBookmarkAtCurrentPosition={bookmarkManager
          ? ($hasBookmarkAtCurrentPosition ?? false)
          : false}
        {styleManager}
        on:showBookmarks={() => (showBookmarkPanel = true)}
        on:addBookmark={() => {
          if (bookmarkManager && currentChapter) {
            bookmarkManager.toggleBookmark({
              novelId: novel.id,
              novelTitle: novel.title,
              chapterId: currentChapter.id,
              chapterTitle: currentChapter.title,
              progress: readerElement?.scrollTop || 0,
            });
          }
        }}
        on:jumpToNote={handleJumpToNote}
        on:savePattern={async (event) => {
          try {
            const { novel: updatedNovel, chapters: newChapters } = event.detail;

            // 第一步：保存到数据库
            const saveResult = await plugin.libraryService.updateNovel(updatedNovel);

            if (saveResult) {
              // 第二步：只有保存成功后才更新本地状态
              // 使用不可变方式更新，避免触发额外的响应式更新
              novel = Object.assign({}, updatedNovel);
              chapters = [...newChapters];

              // 第三步：通知视图更新
              window.dispatchEvent(
                new CustomEvent('chaptersUpdated', {
                  detail: { chapters: newChapters },
                })
              );

              new Notice('章节解析规则已保存');
            }
          } catch (error) {
            console.error('Failed to save pattern:', error);
            new Notice('保存章节解析规则失败');
          }
        }}
        on:deleteNote={async (event) => {
          await handleNoteDelete(event);
          // 重新渲染当前章节以更新笔记显示
          if (currentChapter) {
            currentChapter = { ...currentChapter };
          }
        }}
        on:editNote={(event) => {
          handleNoteEdit(event);
          showNoteList = false; // 关闭列表面板
        }}
        on:jumpToChapter={async (event) => {
          const { chapterId, chapterTitle } = event.detail;

          // 判断是页码历史还是章节历史
          if (chapterTitle && chapterTitle.includes('页')) {
            // 页码历史：提取页码并跳转
            const pageMatch = chapterTitle.match(/第\s*(\d+)\s*页/);
            if (pageMatch) {
              const pageNum = parseInt(pageMatch[1], 10);
              // 切换到页码模式
              if (viewMode !== 'pages') {
                viewMode = 'pages';
                if (!novel.customSettings) {
                  novel.customSettings = {};
                }
                novel.customSettings.txtViewMode = viewMode;
                calculateVirtualPages();
                await plugin.libraryService.updateNovel(novel);
              }
              // 跳转到指定页码
              jumpToPage(pageNum);
              // 触发滚动到顶部
              const contentElement = document.querySelector('.content-area');
              if (contentElement) {
                contentElement.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }
          } else {
            // 章节历史：跳转到章节
            const chapter = chapters.find((ch) => ch.id === chapterId);
            if (chapter) {
              if (viewMode === 'pages') {
                // 如果在页码模式点击章节，切换回章节模式（或者跳转到该章节第一页）
                // 这里选择切换回章节模式以保持一致性
                viewMode = 'chapters';
                if (!novel.customSettings) {
                  novel.customSettings = {};
                }
                novel.customSettings.txtViewMode = viewMode;
                calculateVirtualPages();
                await plugin.libraryService.updateNovel(novel);
              }
              selectChapter(chapter);
            }
          }
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

    <!-- 键盘导航处理组件 -->
    <ReaderProgressManager
      {plugin}
      {novel}
      readerType="txt"
      totalChapters={chapters.length}
      bind:currentPosition={progressPosition}
      on:save={(e) => {
        console.log('[TXT] Progress auto-saved:', e.detail.progress);
        dispatch('saveProgress', e.detail);
      }}
    />

    <KeyboardNavigationHandler
      enabled={isActive}
      readerType="txt"
      canGoPrev={currentChapter ? chapters.findIndex((c) => c.id === currentChapter.id) > 0 : false}
      canGoNext={currentChapter
        ? chapters.findIndex((c) => c.id === currentChapter.id) < chapters.length - 1
        : false}
      on:prevChapter={handlePrevChapter}
      on:nextChapter={handleNextChapter}
      on:toggleTOC={handleToggleTOC}
      on:closePanel={handleClosePanel}
    />
  </ReadingSessionManager>
</div>

<style>
  .novel-reader {
    height: 100%;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    padding: 24px 40px 60px 40px;
    min-width: 0;
    background: var(--background-primary);
  }

  .chapter-content {
    max-width: 800px;
    margin: 0 auto;
    background: var(--background-primary);
    padding: var(--novel-spacing-2xl);
    border-radius: var(--novel-radius-lg);
    box-shadow: var(--novel-shadow-sm);
  }

  .chapter-content h2 {
    margin-bottom: var(--novel-spacing-xl);
    padding-bottom: var(--novel-spacing-lg);
    border-bottom: 2px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-xs);
    font-size: var(--novel-font-size-2xl);
    font-weight: var(--novel-font-weight-semibold);
    color: var(--text-normal);
  }

  .content-text {
    line-height: inherit;
    font-size: inherit;
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
    color: inherit;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .content-text p {
    margin: 1.2em 0;
    text-indent: 2em;
    padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
    margin-left: calc(var(--novel-spacing-sm) * -1);
    margin-right: calc(var(--novel-spacing-sm) * -1);
    border-radius: var(--novel-radius-sm);
    transition: background-color 0.2s ease;
  }

  .content-text p:hover {
    background-color: var(--background-modifier-hover);
  }

  .no-chapter {
    text-align: center;
    color: var(--text-muted);
    padding: 32px;
  }

  /* 设置 */
  .toolbar {
    position: fixed;
    top: 13px; /* 原来10px，往下3px变成13px */
    right: 15px; /* 原来10px，往左5px变成15px */
    z-index: 1000;
  }

  /* ==================== 书签样式 ==================== */

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
