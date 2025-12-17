<script lang="ts">
  import { onMount, createEventDispatcher, onDestroy } from 'svelte';
  import * as pdfjs from 'pdfjs-dist';
  import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
  import { TextLayer } from 'pdfjs-dist';
  import type NovelReaderPlugin from '../../main';
  import type { Novel } from '../../types';
  import { TFile, Notice } from 'obsidian';
  import ReaderSettingsMenu from '../setting/ReaderSettingsMenu.svelte';
  import ReaderSidebar from '../reader/ReaderSidebar.svelte';
  import ReaderNavigation from '../reader/ReaderNavigation.svelte';
  import HoverTOC from '../reader/HoverTOC.svelte';
  import KeyboardNavigationHandler from '../reader/KeyboardNavigationHandler.svelte';
  import BookmarkPanelWrapper from '../reader/BookmarkPanelWrapper.svelte';
  import type { ProgressPosition } from '../reader/ReaderProgressManager.svelte';
  import type { ChapterHistory } from '../../types/reading-stats';
  import { icons } from '../library/icons';
  import LoadingSpinner from '../LoadingSpinner.svelte';
  import type { Bookmark } from '../../types/bookmark';
  import { NotesService } from '../../services/note/notes-service';
  import NoteDialog from '../NoteDialog.svelte';
  import NoteViewer from '../NoteViewer.svelte';

  import ReadingSessionManager from '../reader/ReadingSessionManager.svelte';
  import ReaderProgressManager from '../reader/ReaderProgressManager.svelte';

  // Define helper type locally to avoid import issues
  interface ProgressPosition {
    chapterIndex: number;
    chapterTitle: string;
    // PDF specific
    pageNum?: number;
    // Common
    timestamp?: number;
  }

  import { v4 as uuidv4 } from 'uuid';
  import { getPDFWorkerPath } from '../../constants/app-config';
  // 统一渲染器
  import { PdfRenderer, ReaderStyleManager, ReaderBookmarkManager } from '../../services/renderer';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
  export let initialPage: number;
  export let initialNoteId: string | undefined = undefined;

  // 为每个PDF实例生成唯一ID，避免多个PDF视图冲突
  const pdfInstanceId = `pdf-${novel.id}-${Date.now()}`;
  let pdfContainerElement: HTMLElement;

  let pdfDoc: PDFDocumentProxy | null = null;
  let zoomLevel = 1.5;
  let isLoading = true;
  let numPages = 1; //总页数
  let currentPage: number; //当前页
  let readerContainer: HTMLElement | null = null;
  let readerElement: HTMLElement; // PDF阅读器主元素引用
  let showingCoverPage = true;

  import type { PDFOutline } from '../../types';
  import type { Note } from '../../types/notes';
  let outlines: PDFOutline[] = []; //PDF大纲数据
  let isActive = false;
  export let chapterHistory: ChapterHistory[] = []; //章节历史记录（export让view层可以更新）
  let currentChapter: PDFOutline | null = null;
  let pendingRender = false;
  let containerInitialized = false;

  // 统一渲染器实例
  let renderer: PdfRenderer | null = null;
  let styleManager: ReaderStyleManager | null = null;

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
    pageNum: 1,
  };

  // 更新进度位置的响应式语句
  $: if (currentPage && numPages) {
    progressPosition = {
      chapterIndex: currentPage - 1,
      chapterTitle: `Page ${currentPage}`,
      chapterId: currentPage, // Explicitly save page number as chapterId for consistency
      pageNum: currentPage,
    };
  }

  // PDF 悬浮目录：目录/页码切换功能
  // 'chapters' = 显示目录，'pages' = 显示页码列表
  let viewMode: 'chapters' | 'pages' = 'chapters';

  // 从 novel.customSettings 读取用户偏好
  $: {
    if (novel?.customSettings?.pdfViewMode) {
      viewMode = novel.customSettings.pdfViewMode;
    } else {
      // 优先显示目录，如果没有目录则显示页码
      viewMode = chapters.length > 0 ? 'chapters' : 'pages';
    }
  }

  $: currentPage = showingCoverPage ? 1 : currentPage;

  let pageState = {
    currentPage,
    showingCoverPage,
  };

  // 创建响应式声明
  $: pageState = {
    currentPage,
    showingCoverPage,
  };

  $: currentChapterIndex = getCurrentChapter(currentPage);

  // 当页码变化时，根据显示模式滚动到对应位置（使用防抖优化）

  // 为每个章节创建一个活动状态的映射
  $: chapterActiveStates = chapters.map((chapter, index) => {
    console.log('3. Computing active state for chapter:', chapter.title);
    return index === currentChapterIndex;
  });

  // 章节大纲数据
  let chapters: Array<{
    title: string;
    startPage: number;
    endPage: number | null;
    subChapters?: Array<{
      title: string;
      startPage: number;
      endPage: number | null;
    }>;
  }> = [];

  let notesService: NotesService;
  let notes: Note[] = []; // 笔记（统一使用 notes.json）
  let isNoteCaptureMode = false;
  let isSelectingNoteArea = false;
  let selectionStart: { x: number; y: number } | null = null;
  let selectionEnd: { x: number; y: number } | null = null;
  let pendingPdfLocation: Note['pdfLocation'] | null = null;

  let showNoteDialog = false;
  let selectedTextForNote = '';
  let selectedNote: Note | null = null;

  let noteViewerVisible = false;
  let noteViewerPosition = { x: 0, y: 0 };

  let showPdfSelectionMenu = false;
  let pdfSelectionMenuPosition = { x: 0, y: 0 };
  let pdfSelectedText = '';
  let pdfSelectedRects: Array<{ xPct: number; yPct: number; wPct: number; hPct: number }> = [];

  let pageWrapperEl: HTMLDivElement | null = null;
  let canvasLayerEl: HTMLDivElement | null = null;
  let textLayerEl: HTMLDivElement | null = null;
  let noteOverlayEl: HTMLDivElement | null = null;

  let readingStats: unknown = null; // 阅读状态

  $: currentPageNotes = notes.filter((n) => {
    // chapterId 在 PDF 中就是页码（与 bookmark/history 设计一致）
    if (n.chapterId !== currentPage) return false;
    return true;
  });

  async function initializePDF() {
    try {
      // 使用 Blob URL 加载 worker (绕过 Electron 的 file:// 限制)
      const vaultPath = (plugin.app.vault.adapter as any).getBasePath();
      const workerUrl = await getPDFWorkerPath(plugin.app, vaultPath, (plugin as any).manifest.dir);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      console.log('PDF Worker URL:', workerUrl);
    } catch (error) {
      console.error('Failed to configure PDF worker:', error);
      new Notice('PDF 引擎配置失败,请检查插件安装');
      throw error;
    }

    try {
      if (!plugin || !novel) {
        throw new Error('Plugin or novel not initialized');
      }

      const file = plugin.app.vault.getAbstractFileByPath(novel.path);
      if (!(file instanceof TFile)) {
        throw new Error('PDF file not found');
      }

      const arrayBuffer = await plugin.contentLoaderService.loadPdfContent(file);
      pdfDoc = await pdfjs.getDocument(arrayBuffer).promise;

      numPages = pdfDoc.numPages;

      // 获取保存的阅读进度
      const progress = await plugin.libraryService.getProgress(novel.id);

      // 如果有初始页码，使用它；否则使用进度；最后才使用第1页
      if (initialPage) {
        currentPage = initialPage;
        showingCoverPage = false;
      } else if (progress?.position?.page) {
        currentPage = progress.position.page;
        showingCoverPage = false;
      } else {
        currentPage = 1;
        showingCoverPage = true;
      }

      console.log('Setting initial page to:', currentPage, 'showingCoverPage:', showingCoverPage);

      // 确保页码在有效范围内
      if (currentPage < 1) currentPage = 1;
      if (currentPage > numPages) currentPage = numPages;

      // 获取大纲
      outlines = (await pdfDoc.getOutline()) || [];
      await processOutlines(outlines);
      console.log('processOutlines---' + JSON.stringify(chapters));

      // 如果容器已经准备好，直接渲染
      if (readerContainer) {
        await renderPage('initializePDF');
      } else {
        pendingRender = true; // 标记需要渲染
      }

      // 初始化统一渲染器
      try {
        if (readerContainer) {
          // 创建缩放回调函数
          const handleZoomChange = async (newZoom: number) => {
            zoomLevel = newZoom;
            if (readerContainer) {
              await renderPage('jumpToPage');
              dispatch('pageChanged', { pageNum: currentPage });

              // 更新书签管理器的当前位置
              bookmarkManager?.updateCurrentPosition({
                novelId: novel.id,
                novelTitle: novel.title,
                chapterId: currentPage,
                chapterTitle: `Page ${currentPage}`,
                progress: currentPage,
              });
            }
          };

          renderer = new PdfRenderer(readerContainer, handleZoomChange);
          styleManager = new ReaderStyleManager(renderer, plugin, novel.id);
          styleManager.applyAllSettings();
          console.log(`[${pdfInstanceId}] 渲染器初始化成功`);
        }
      } catch (error) {
        console.error(`[${pdfInstanceId}] 渲染器初始化失败:`, error);
      }

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
        console.log(`[${pdfInstanceId}] 书签管理器初始化成功`);
      } catch (error) {
        console.error(`[${pdfInstanceId}] 书签管理器初始化失败:`, error);
      }

      isLoading = false;
    } catch (error) {
      console.error('Error loading PDF:', error);
      isLoading = false;
    }
  }

  async function processOutlines(outlines: PDFOutline[], level: number = 0): Promise<void> {
    if (outlines && pdfDoc) {
      // 检查第一个章节是否从第1页开始
      let firstChapterStartPage = -1;
      if (outlines.length > 0 && outlines[0].dest) {
        firstChapterStartPage = (await pdfDoc.getPageIndex(outlines[0].dest[0])) + 1;
      }

      // 如果第一个章节不是从第1页开始，添加"首页"章节
      if (firstChapterStartPage > 1) {
        chapters.push({
          title: '首页',
          startPage: 1,
          endPage: firstChapterStartPage - 1,
          subChapters: [],
        });
      }

      for (const item of outlines) {
        const startPageIndex = item.dest ? await pdfDoc.getPageIndex(item.dest[0]) : null;

        if (startPageIndex !== null) {
          const chapter = {
            title: item.title || `章节`,
            startPage: startPageIndex + 1,
            endPage: null,
            subChapters: [] as Array<{ title: string; startPage: number; endPage: number | null }>,
          };

          if (item.items) {
            for (const subItem of item.items) {
              const subStartPageIndex = subItem.dest
                ? await pdfDoc.getPageIndex(subItem.dest[0])
                : null;
              if (subStartPageIndex !== null) {
                chapter.subChapters?.push({
                  title: subItem.title || `子章节`,
                  startPage: subStartPageIndex + 1,
                  endPage: null,
                });
              }
            }
          }

          chapters.push(chapter);
        }
      }

      // 更新章节结束页
      for (let i = 0; i < chapters.length - 1; i++) {
        chapters[i].endPage = chapters[i + 1].startPage - 1;

        // 更新子章节结束页
        if (chapters[i].subChapters) {
          for (let j = 0; j < chapters[i].subChapters!.length - 1; j++) {
            chapters[i].subChapters![j].endPage = chapters[i].subChapters![j + 1].startPage - 1;
          }
          // 最后一个子章节的结束页是下一个主章节的起始页减1
          const lastSubChapter = chapters[i].subChapters![chapters[i].subChapters!.length - 1];
          if (lastSubChapter) {
            lastSubChapter.endPage = chapters[i + 1].startPage - 1;
          }
        }
      }

      // 处理最后一章（如果存在章节）
      if (chapters.length > 0) {
        const lastChapter = chapters[chapters.length - 1];
        lastChapter.endPage = pdfDoc.numPages;
        if (lastChapter.subChapters && lastChapter.subChapters.length > 0) {
          for (let j = 0; j < lastChapter.subChapters.length - 1; j++) {
            lastChapter.subChapters[j].endPage = lastChapter.subChapters[j + 1].startPage - 1;
          }
          const lastSubChapter = lastChapter.subChapters[lastChapter.subChapters.length - 1];
          if (lastSubChapter) {
            lastSubChapter.endPage = pdfDoc.numPages;
          }
        }
      }
    }
  }

  async function renderPage(logType: string) {
    console.log('renderPage---', logType);
    if (!pdfDoc) {
      console.log('PDF doc or container not available');
      return;
    }

    if (!canvasLayerEl || !pageWrapperEl) {
      console.log('Container not available, waiting...');
      pendingRender = true;
      await waitForContainer();
    }

    const pageNum = showingCoverPage ? 1 : currentPage;
    console.log('renderPage---', currentPage, showingCoverPage, pageNum);
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: zoomLevel });

    if (!canvasLayerEl || !pageWrapperEl) {
      throw new Error('Reader container still not available after waiting');
    }

    // 更新wrapper尺寸（用于百分比定位标记）
    pageWrapperEl.style.width = `${viewport.width}px`;
    pageWrapperEl.style.height = `${viewport.height}px`;

    // pdf.js textLayer 需要该CSS变量与 viewport.scale 保持一致
    pageWrapperEl.style.setProperty('--scale-factor', String(viewport.scale));
    if (textLayerEl) {
      textLayerEl.style.setProperty('--scale-factor', String(viewport.scale));
    }

    // 清空canvas层（保留Svelte渲染的overlay层）
    canvasLayerEl.innerHTML = '';

    if (textLayerEl) {
      textLayerEl.innerHTML = '';
    }

    // 创建新的 canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    canvasLayerEl.appendChild(canvas);

    if (context) {
      // 渲染 PDF 页面到 canvas
      // PDF.js 5.x 使用 canvas 参数替代 canvasContext
      await page.render({
        canvas: canvas,
        viewport: viewport,
      }).promise;
    }

    if (textLayerEl) {
      try {
        const textContent = await page.getTextContent();
        // 渲染文本层(用于文本选择)
        // PDF.js 4.x 使用 TextLayer 类替代 renderTextLayer 函数
        try {
          const textLayer = new TextLayer({
            textContentSource: textContent,
            container: textLayerEl,
            viewport: viewport,
          });
          await textLayer.render();
        } catch (error) {
          console.error('[PDF] TextLayer render failed:', error);
        }
      } catch (error) {
        console.error('[PDF] Failed to render text layer:', error);
      }
    }

    // 保存阅读进度
    // 更新书签管理器位置
    if (bookmarkManager) {
      bookmarkManager.updateCurrentPosition({
        novelId: novel.id,
        novelTitle: novel.title,
        chapterId: pageNum,
        chapterTitle: `Page ${pageNum}`,
        progress: pageNum,
      });
    }
  }

  async function jumpToPageAndLocate(
    pageNum: number,
    location: Note['pdfLocation'] | null | undefined
  ) {
    if (!pdfDoc) return;

    currentPage = pageNum;
    showingCoverPage = false;

    await renderPage('jumpToPageAndLocate');

    dispatch('pageChanged', { pageNum: pageNum });

    // 更新书签管理器的当前位置
    bookmarkManager?.updateCurrentPosition({
      novelId: novel.id,
      novelTitle: novel.title,
      chapterId: pageNum,
      chapterTitle: `Page ${pageNum}`,
      progress: pageNum,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    if (!readerContainer || !pageWrapperEl || !location) return;
    const yCenter = (location.yPct + location.hPct / 2) * (pageWrapperEl.clientHeight || 1);
    const targetTop = Math.max(0, yCenter - readerContainer.clientHeight / 2);
    readerContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
  }

  async function handleJumpToNote(event: CustomEvent) {
    const { note } = event.detail as { note: Note };
    if (!note) return;
    await jumpToPageAndLocate(note.chapterId, note.pdfLocation);
  }

  async function loadNotesForNovel(): Promise<void> {
    try {
      notes = await notesService.loadNotes(novel.id);
    } catch (error) {
      console.error('Failed to load notes:', error);
      notes = [];
    }
  }

  async function saveNotesForNovel(): Promise<void> {
    await notesService.saveNotes(novel.id, novel.title, notes);
  }

  function toggleNoteCaptureMode() {
    isNoteCaptureMode = !isNoteCaptureMode;
    // 退出模式时清理选择状态
    if (!isNoteCaptureMode) {
      isSelectingNoteArea = false;
      selectionStart = null;
      selectionEnd = null;
      pendingPdfLocation = null;
    }
  }

  function getRelativePoint(event: MouseEvent): { x: number; y: number } | null {
    if (!noteOverlayEl) return null;
    const rect = noteOverlayEl.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startSelection(event: MouseEvent) {
    if (!isNoteCaptureMode) return;
    // 避免点到已有标记时开启框选
    const target = event.target as HTMLElement;
    if (target.closest('.pdf-note-marker') || target.closest('.pdf-note-highlight')) {
      return;
    }
    const p = getRelativePoint(event);
    if (!p) return;
    isSelectingNoteArea = true;
    selectionStart = p;
    selectionEnd = p;
    event.preventDefault();
  }

  function isSelectionInsideCurrentPdf(selection: Selection): boolean {
    if (!textLayerEl) return false;
    if (selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node instanceof Element ? node : node.parentElement;
    if (!el) return false;
    return textLayerEl.contains(el);
  }

  function capturePdfSelectionRects(range: Range): {
    rects: Array<{ xPct: number; yPct: number; wPct: number; hPct: number }>;
    union: { xPct: number; yPct: number; wPct: number; hPct: number } | null;
  } {
    if (!pageWrapperEl) {
      return { rects: [], union: null };
    }

    const pageRect = pageWrapperEl.getBoundingClientRect();
    const rectList = Array.from(range.getClientRects());

    const rects = rectList
      .map((r) => {
        const left = Math.max(r.left, pageRect.left);
        const top = Math.max(r.top, pageRect.top);
        const right = Math.min(r.right, pageRect.right);
        const bottom = Math.min(r.bottom, pageRect.bottom);
        const w = Math.max(0, right - left);
        const h = Math.max(0, bottom - top);
        if (w < 1 || h < 1) return null;
        return {
          xPct: (left - pageRect.left) / (pageRect.width || 1),
          yPct: (top - pageRect.top) / (pageRect.height || 1),
          wPct: w / (pageRect.width || 1),
          hPct: h / (pageRect.height || 1),
        };
      })
      .filter(Boolean) as Array<{ xPct: number; yPct: number; wPct: number; hPct: number }>;

    if (rects.length === 0) {
      return { rects: [], union: null };
    }

    const xMin = Math.min(...rects.map((r) => r.xPct));
    const yMin = Math.min(...rects.map((r) => r.yPct));
    const xMax = Math.max(...rects.map((r) => r.xPct + r.wPct));
    const yMax = Math.max(...rects.map((r) => r.yPct + r.hPct));

    return {
      rects,
      union: {
        xPct: xMin,
        yPct: yMin,
        wPct: xMax - xMin,
        hPct: yMax - yMin,
      },
    };
  }

  function handlePdfTextMouseUp(event: MouseEvent) {
    if (isNoteCaptureMode) return;
    const selection = window.getSelection();
    const text = selection?.toString() || '';
    if (!selection || text.trim().length === 0) {
      showPdfSelectionMenu = false;
      pdfSelectedText = '';
      pdfSelectedRects = [];
      return;
    }

    if (!isSelectionInsideCurrentPdf(selection)) {
      showPdfSelectionMenu = false;
      pdfSelectedText = '';
      pdfSelectedRects = [];
      return;
    }

    const range = selection.getRangeAt(0);
    const { rects, union } = capturePdfSelectionRects(range);
    if (!union) {
      showPdfSelectionMenu = false;
      pdfSelectedText = '';
      pdfSelectedRects = [];
      return;
    }

    pdfSelectedText = text;
    pdfSelectedRects = rects;
    pdfSelectionMenuPosition = { x: event.clientX, y: event.clientY };
    showPdfSelectionMenu = true;
  }

  async function handlePdfSelectionCopy() {
    try {
      await navigator.clipboard.writeText(pdfSelectedText);
      showPdfSelectionMenu = false;
    } catch (error) {
      console.error('Failed to copy selection:', error);
    }
  }

  function handlePdfSelectionAddNote() {
    if (!pdfSelectedText || pdfSelectedRects.length === 0) return;

    const xMin = Math.min(...pdfSelectedRects.map((r) => r.xPct));
    const yMin = Math.min(...pdfSelectedRects.map((r) => r.yPct));
    const xMax = Math.max(...pdfSelectedRects.map((r) => r.xPct + r.wPct));
    const yMax = Math.max(...pdfSelectedRects.map((r) => r.yPct + r.hPct));

    pendingPdfLocation = {
      page: currentPage,
      xPct: xMin,
      yPct: yMin,
      wPct: xMax - xMin,
      hPct: yMax - yMin,
      rects: pdfSelectedRects,
    };

    selectedNote = null;
    selectedTextForNote = pdfSelectedText;
    showNoteDialog = true;
    showPdfSelectionMenu = false;

    const selection = window.getSelection();
    selection?.removeAllRanges();
  }

  function updateSelection(event: MouseEvent) {
    if (!isSelectingNoteArea) return;
    const p = getRelativePoint(event);
    if (!p) return;
    selectionEnd = p;
    event.preventDefault();
  }

  function endSelection(event: MouseEvent) {
    if (!isSelectingNoteArea) return;
    const p = getRelativePoint(event);
    if (!p) return;
    selectionEnd = p;

    isSelectingNoteArea = false;

    if (!selectionStart || !selectionEnd || !pageWrapperEl) {
      selectionStart = null;
      selectionEnd = null;
      return;
    }

    const width = pageWrapperEl.clientWidth || 1;
    const height = pageWrapperEl.clientHeight || 1;

    const x1 = Math.max(0, Math.min(selectionStart.x, selectionEnd.x));
    const y1 = Math.max(0, Math.min(selectionStart.y, selectionEnd.y));
    const x2 = Math.max(0, Math.max(selectionStart.x, selectionEnd.x));
    const y2 = Math.max(0, Math.max(selectionStart.y, selectionEnd.y));

    const w = Math.max(2, x2 - x1);
    const h = Math.max(2, y2 - y1);

    // 过小的框选视为误触
    if (w < 6 && h < 6) {
      selectionStart = null;
      selectionEnd = null;
      return;
    }

    pendingPdfLocation = {
      page: currentPage,
      xPct: x1 / width,
      yPct: y1 / height,
      wPct: w / width,
      hPct: h / height,
    };

    selectedNote = null;
    selectedTextForNote = `PDF 第 ${currentPage} 页标注`;
    showNoteDialog = true;

    // 完成一次标注后自动退出标注模式（避免误触）
    isNoteCaptureMode = false;
    selectionStart = null;
    selectionEnd = null;
    event.preventDefault();
  }

  function openNoteViewer(note: Note, event: MouseEvent) {
    selectedNote = note;
    noteViewerPosition = { x: event.clientX, y: event.clientY };
    noteViewerVisible = true;
  }

  function closePdfSelectionMenu() {
    showPdfSelectionMenu = false;
  }

  function handleNoteDialogClose() {
    showNoteDialog = false;
    pendingPdfLocation = null;
    selectedNote = null;
  }

  async function handleNoteSave(event: CustomEvent) {
    try {
      if (selectedNote) {
        // 编辑
        notes = notes.map((n) =>
          n.id === selectedNote?.id
            ? { ...n, content: event.detail.content, timestamp: Date.now() }
            : n
        );
      } else {
        // 新增
        const note: Note = {
          id: uuidv4(),
          chapterId: currentPage,
          chapterName: `第 ${currentPage} 页`,
          selectedText: selectedTextForNote,
          content: event.detail.content,
          timestamp: Date.now(),
          textIndex: 0,
          textLength: selectedTextForNote.length,
          lineNumber: 0,
          pdfLocation: pendingPdfLocation || undefined,
        };
        notes = [...notes, note];
      }

      await saveNotesForNovel();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      showNoteDialog = false;
      pendingPdfLocation = null;
      selectedNote = null;
    }
  }

  async function handleNoteDelete(event: CustomEvent) {
    const { noteId } = event.detail;
    notes = notes.filter((n) => n.id !== noteId);
    await saveNotesForNovel();
    noteViewerVisible = false;
    selectedNote = null;
  }

  function handleNoteEdit(event: CustomEvent) {
    const { note } = event.detail as { note: Note };
    noteViewerVisible = false;
    selectedNote = note;
    selectedTextForNote = note.selectedText;
    pendingPdfLocation = note.pdfLocation || null;
    showNoteDialog = true;
  }

  function handleZoom(action: 'in' | 'out') {
    if (action === 'in') {
      zoomLevel = Math.min(zoomLevel * 1.2, 3.0);
    } else {
      zoomLevel = Math.max(zoomLevel / 1.2, 0.5);
    }
    renderPage('handleZoom');
  }

  function handlePageChange(pageNum: number) {
    if (pageNum >= 1 && pageNum <= numPages && pageNum !== currentPage) {
      currentPage = pageNum;
      showingCoverPage = false;
      renderPage('handlePageChange');

      // 触发pageChanged事件以记录历史和进度
      dispatch('pageChanged', { pageNum: pageNum });

      // 设置焦点到阅读器主元素，使键盘事件生效
      setTimeout(() => {
        if (readerElement) {
          readerElement.focus();
        }
      }, 50);
    }
  }

  function toggleOutlinePanel() {
    showOutlinePanel = !showOutlinePanel;
  }

  function handleOutlineClick(pageNumber: number) {
    if (pageNumber !== currentPage) {
      console.log('1. handleOutlineClick: changing page to', pageNumber);
      currentPage = pageNumber;
      showingCoverPage = false;
      renderPage('handleOutlineClick');

      // 触发pageChanged事件（view层会记录历史并更新chapterHistory）
      dispatch('pageChanged', { pageNum: pageNumber });

      // 设置焦点到阅读器主元素，使键盘事件生效
      setTimeout(() => {
        if (readerElement) {
          readerElement.focus();
        }
      }, 50);
    }
  }

  // ==================== 书签功能 ====================
  // 书签功能现在由 ReaderBookmarkManager 统一管理

  // 跳转到书签
  async function handleJumpToBookmark(bookmark: Bookmark) {
    currentPage = bookmark.chapterId; // PDF 中 chapterId 就是页码
    await renderPage('handleJumpToBookmark');
    showBookmarkPanel = false;
  }

  onMount(async () => {
    console.log('Component mounting with initial page:', initialPage);

    notesService = new NotesService(plugin.app, plugin);
    await loadNotesForNovel();

    // 监听笔记文件变化（与TXT一致：写入后自动刷新）
    const currentNotePath = plugin.pathsService.getNotesPath(novel.id);
    const noteFileModifyHandler = plugin.app.vault.on('modify', async (file) => {
      if (file.path === currentNotePath) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await loadNotesForNovel();
      }
    });

    // 加载书签
    // 书签由 bookmarkManager 管理

    // 加载章节历史
    try {
      chapterHistory = await plugin.chapterHistoryService.getHistory(novel.id);
    } catch (error) {
      console.error('Failed to load chapter history:', error);
    }

    // 获取或创建容器元素（使用唯一ID）
    // Wait for bind:this to populate (might be delayed due to slot)
    let retryCount = 0;
    while (!pdfContainerElement && retryCount < 50) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      retryCount++;
    }

    if (!pdfContainerElement) {
      console.error('Container element not found after waiting. ID:', pdfInstanceId);
      // Fallback to getElementById just in case bind failed but ID exists
      pdfContainerElement = document.getElementById(pdfInstanceId) as HTMLElement;
    }

    const container = pdfContainerElement;
    if (container) {
      readerContainer = container;
      containerInitialized = true;
      console.log('Container initialized with ID:', pdfInstanceId);

      // 如果PDF已加载且有待渲染的页面
      if (pdfDoc && pendingRender) {
        console.log('Processing pending render');
        await renderPage('init');
        pendingRender = false;
      }
    } else {
      console.error('Container element not found');
    }

    await initializePDF();

    if (initialNoteId) {
      const note = notes.find((n) => n.id === initialNoteId);
      if (note?.pdfLocation) {
        await jumpToPageAndLocate(note.chapterId, note.pdfLocation);
      }
    }

    // 设置初始焦点，使键盘事件生效
    setTimeout(() => {
      if (readerElement) {
        readerElement.focus();
      }
    }, 100);

    const handleDocMouseUp = (e: MouseEvent) => {
      handlePdfTextMouseUp(e);
    };

    const handleDocClick = (e: MouseEvent) => {
      if (!showPdfSelectionMenu) return;
      const target = e.target as HTMLElement;
      if (!target.closest('.pdf-selection-menu')) {
        closePdfSelectionMenu();
      }
    };
    document.addEventListener('mouseup', handleDocMouseUp);
    document.addEventListener('click', handleDocClick);

    return () => {
      plugin.app.vault.offref(noteFileModifyHandler);
      document.removeEventListener('mouseup', handleDocMouseUp);
      document.removeEventListener('click', handleDocClick);
    };
  });

  onDestroy(() => {
    console.log(`[${pdfInstanceId}] Component destroying...`);

    // 清理渲染器
    try {
      if (renderer) {
        renderer.destroy();
        renderer = null;
        styleManager = null;
        console.log(`[${pdfInstanceId}] 渲染器已清理`);
      }
    } catch (error) {
      console.error(`[${pdfInstanceId}] 渲染器清理失败:`, error);
    }

    // 清理工作
    if (readerContainer) {
      readerContainer.innerHTML = '';
    }
    pdfDoc = null;
    readerContainer = null;
  });

  // 键盘导航处理函数
  function handlePrevChapter() {
    handleSwitchChapter('prev');
  }

  function handleNextChapter() {
    handleSwitchChapter('next');
  }

  function handleToggleTOC() {
    showOutlinePanel = !showOutlinePanel;
  }

  function handleClosePanel() {
    if (showOutlinePanel) {
      showOutlinePanel = false;
    } else if (showPdfSelectionMenu) {
      closePdfSelectionMenu();
    }
  }

  // 处理章节切换
  function handleSwitchChapter(direction: 'prev' | 'next') {
    let nextIndex: number;

    if (direction === 'prev') {
      nextIndex = currentPage > 0 ? currentPage - 1 : currentPage;
    } else {
      nextIndex = currentPage < numPages - 1 ? currentPage + 1 : currentPage;
    }

    if (nextIndex !== currentPage) {
      handleOutlineClick(nextIndex);
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

  // 获取当前页面所在的章节
  function getCurrentChapter(page: number): number {
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      if (page >= chapter.startPage && page <= (chapter.endPage || numPages)) {
        return i;
      }
    }
    return -1;
  }

  // 判断子章节是否为当前章节
  function isCurrentSubChapter(subChapter: PDFOutline): boolean {
    return currentPage >= subChapter.startPage && currentPage <= (subChapter.endPage || numPages);
  }

  // 处理章节跳转
  function handleJumpToChapter(event: CustomEvent) {
    const { chapterId } = event.detail;
    // 实现页面跳转逻辑
    const pageNumber = chapters[chapterId]?.startPage || 1;
    handleOutlineClick(pageNumber);
  }

  // 等待容器初始化
  function waitForContainer(): Promise<void> {
    return new Promise((resolve) => {
      const checkContainer = () => {
        if (readerContainer && pageWrapperEl && canvasLayerEl && textLayerEl && noteOverlayEl) {
          resolve();
        } else {
          setTimeout(checkContainer, 50); // 每50ms检查一次
        }
      };
      checkContainer();
    });
  }

  // 切换目录/页码显示模式
  async function toggleViewMode() {
    viewMode = viewMode === 'chapters' ? 'pages' : 'chapters';

    // 保存用户选择到 novel.customSettings
    if (!novel.customSettings) {
      novel.customSettings = {};
    }
    novel.customSettings.pdfViewMode = viewMode;

    // 更新到数据库
    await plugin.libraryService.updateNovel(novel);
  }

  // 章节元素追踪（用于自动滚动）

  // 滚动到当前激活章节（基于页码）
</script>

<div
  class="pdf-reader"
  bind:this={readerElement}
  tabindex="0"
  on:mouseenter={() => (isActive = true)}
  on:mouseleave={() => (isActive = false)}
>
  <!-- 目录面板 -->
  <ReaderSidebar
    show={showOutlinePanel}
    chapters={(chapters || []).map((ch, index) => ({
      ...ch,
      page: ch.startPage || index + 1,
    }))}
    currentChapterId={currentPage}
    viewMode="chapters"
    virtualPages={[]}
    currentPageNum={currentPage}
    showPageToggle={false}
    on:chapterSelect={(e) => {
      handleOutlineClick(e.detail.chapter.id);
      showOutlinePanel = false;
    }}
    on:close={() => (showOutlinePanel = false)}
  />

  <ReadingSessionManager
    {plugin}
    {novel}
    chapters={(chapters || []).map((ch) => ({
      id: ch.startPage,
      title: ch.title,
      subChapters: ch.subChapters?.map((sub) => ({
        id: sub.startPage,
        title: sub.title,
      })),
    }))}
    currentChapterId={currentPage}
    currentChapterTitle={`第 ${currentPage} 页`}
    totalChapters={numPages}
    bind:isActive
    on:startReading={(e) => console.log('Start Reading', e.detail)}
    on:endReading={(e) => console.log('End Reading', e.detail)}
    on:chapterSelect={(e) => handleOutlineClick(e.detail.chapterId)}
    on:toggleTOC={toggleOutlinePanel}
    on:prevChapter={() => handlePageChange(currentPage - 1)}
    on:nextChapter={() => handlePageChange(currentPage + 1)}
    canGoPrev={currentPage > 1}
    canGoNext={currentPage < (numPages || 0)}
  >
    <!-- Sidebar handled by manager -->

    <div class="content-area">
      <!-- 内容区域 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button
            class="tool-button"
            class:active-note-mode={isNoteCaptureMode}
            on:click={toggleNoteCaptureMode}
            title={isNoteCaptureMode ? '退出添加笔记模式' : '添加笔记（拖拽框选区域）'}
          >
            <span class="zoom-icon">{@html icons.note}</span>
          </button>
          <button class="tool-button" on:click={() => handleZoom('out')} title="缩小">
            <span class="zoom-icon">{@html icons.zoomOut}</span>
          </button>
          <button class="tool-button" on:click={() => handleZoom('in')} title="放大">
            <span class="zoom-icon">{@html icons.zoomIn}</span>
          </button>
          <span class="zoom-level">{Math.round(zoomLevel * 100)}%</span>
        </div>

        <!-- 设置菜单组件 -->
        <ReaderSettingsMenu
          {plugin}
          {novel}
          readerType="pdf"
          currentChapterId={currentPage || 0}
          {notes}
          {readingStats}
          {chapterHistory}
          hasBookmarkAtCurrentPosition={bookmarkManager
            ? ($hasBookmarkAtCurrentPosition ?? false)
            : false}
          {styleManager}
          on:showBookmarks={() => (showBookmarkPanel = true)}
          on:addBookmark={() => {
            if (bookmarkManager && currentPage) {
              bookmarkManager.toggleBookmark({
                novelId: novel.id,
                novelTitle: novel.title,
                chapterId: currentPage,
                chapterTitle: currentChapter?.title || `第 ${currentPage} 页`,
                progress: currentPage,
              });
            }
          }}
          on:deleteNote={handleNoteDelete}
          on:editNote={handleNoteEdit}
          on:jumpToNote={handleJumpToNote}
          on:jumpToChapter={(event) => {
            const { chapterId, chapterTitle } = event.detail;
            // PDF的历史记录都是页码形式（如"第 X 页"）
            if (chapterTitle && chapterTitle.includes('页')) {
              const pageMatch = chapterTitle.match(/第\s*(\d+)\s*页/);
              if (pageMatch) {
                const pageNum = parseInt(pageMatch[1], 10);
                handleOutlineClick(pageNum);
              }
            } else if (typeof chapterId === 'number') {
              // 如果chapterId是数字，直接作为页码使用
              handleOutlineClick(chapterId);
            }
          }}
        />
      </div>

      <div id={pdfInstanceId} class="pdf-container" bind:this={pdfContainerElement}>
        {#if isLoading}
          <LoadingSpinner message="正在加载PDF文档..." />
        {/if}

        <div class="pdf-page-wrapper" bind:this={pageWrapperEl}>
          <div class="pdf-canvas-layer" bind:this={canvasLayerEl}></div>
          <div class="pdf-text-layer textLayer" bind:this={textLayerEl} role="document"></div>

          <div class="pdf-note-layer" role="presentation">
            {#each currentPageNotes as note (note.id)}
              {#if note.pdfLocation}
                {#if note.pdfLocation.rects && note.pdfLocation.rects.length > 0}
                  {#each note.pdfLocation.rects as r}
                    <button
                      class="pdf-note-highlight-rect"
                      type="button"
                      aria-label="查看笔记"
                      style={`left:${r.xPct * 100}%;top:${r.yPct * 100}%;width:${r.wPct * 100}%;height:${r.hPct * 100}%;`}
                      on:click={(e) => openNoteViewer(note, e)}
                    ></button>
                  {/each}
                {:else}
                  <button
                    class="pdf-note-highlight-rect"
                    type="button"
                    aria-label="查看笔记"
                    style={`left:${note.pdfLocation.xPct * 100}%;top:${note.pdfLocation.yPct * 100}%;width:${note.pdfLocation.wPct * 100}%;height:${note.pdfLocation.hPct * 100}%;`}
                    on:click={(e) => openNoteViewer(note, e)}
                  ></button>
                {/if}

                <button
                  class="pdf-note-marker"
                  type="button"
                  title="查看笔记"
                  style={`left:${(note.pdfLocation.xPct + note.pdfLocation.wPct) * 100}%;top:${note.pdfLocation.yPct * 100}%;`}
                  on:click|stopPropagation={(e) => openNoteViewer(note, e)}
                >
                  {@html icons.note}
                </button>
              {/if}
            {/each}
          </div>

          <div
            class="pdf-capture-overlay"
            class:active={isNoteCaptureMode}
            bind:this={noteOverlayEl}
            role="presentation"
            on:mousedown={startSelection}
            on:mousemove={updateSelection}
            on:mouseup={endSelection}
          >
            {#if selectionStart && selectionEnd && pageWrapperEl}
              {@const w = pageWrapperEl.clientWidth || 1}
              {@const h = pageWrapperEl.clientHeight || 1}
              {@const x1 = Math.max(0, Math.min(selectionStart.x, selectionEnd.x))}
              {@const y1 = Math.max(0, Math.min(selectionStart.y, selectionEnd.y))}
              {@const x2 = Math.max(0, Math.max(selectionStart.x, selectionEnd.x))}
              {@const y2 = Math.max(0, Math.max(selectionStart.y, selectionEnd.y))}
              <div
                class="pdf-selection-rect"
                style={`left:${(x1 / w) * 100}%;top:${(y1 / h) * 100}%;width:${((x2 - x1) / w) * 100}%;height:${((y2 - y1) / h) * 100}%;`}
              ></div>
            {/if}
          </div>
        </div>

        <!-- 底部导航栏 -->
        <ReaderNavigation
          currentChapter={currentPage}
          totalChapters={numPages || 0}
          {currentPage}
          totalPages={numPages || 0}
          canGoPrev={currentPage > 1}
          canGoNext={currentPage < (numPages || 0)}
          on:prev={() => handlePageChange(currentPage - 1)}
          on:next={() => handlePageChange(currentPage + 1)}
          on:toggleTOC={toggleOutlinePanel}
        />
      </div>

      <!-- 底部导航栏已移至 ReadingSessionManager -->
    </div>
  </ReadingSessionManager>

  <!-- 悬浮目录 -->
  <HoverTOC
    show={displayMode === 'hover'}
    chapters={chapters.map((ch) => ({
      id: ch.startPage,
      title: ch.title,
      level: 0,
      subChapters:
        ch.subChapters?.map((sub) => ({
          id: sub.startPage,
          title: sub.title,
          level: 1,
        })) || [],
    }))}
    currentChapterId={currentPage}
    viewMode="chapters"
    virtualPages={[]}
    currentPageNum={currentPage}
    canToggleView={false}
    on:chapterSelect={(e) => handleOutlineClick(e.detail.chapter.id)}
    on:pageSelect={(e) => handlePageChange(e.detail.page.pageNum)}
  />

  <!-- 键盘导航 -->
  <KeyboardNavigationHandler
    enabled={isActive}
    readerType="pdf"
    canGoPrev={currentPage > 1}
    canGoNext={currentPage < (numPages || 0)}
    on:prevChapter={() => handlePageChange(currentPage - 1)}
    on:nextChapter={() => handlePageChange(currentPage + 1)}
    on:toggleTOC={toggleOutlinePanel}
    on:closePanel={() => (showOutlinePanel = false)}
  />

  <!-- 进度管理组件 -->
  <ReaderProgressManager
    {plugin}
    {novel}
    readerType="pdf"
    totalChapters={numPages || 0}
    bind:currentPosition={progressPosition}
    on:save={(e) => {
      console.log('[PDF] Progress auto-saved:', e.detail.progress);
    }}
  />
</div>

{#if showNoteDialog}
  <NoteDialog
    isOpen={showNoteDialog}
    selectedText={selectedTextForNote}
    existingNote={selectedNote}
    on:save={handleNoteSave}
    on:close={handleNoteDialogClose}
  />
{/if}

{#if showPdfSelectionMenu}
  <div
    class="pdf-selection-menu"
    style={`left:${pdfSelectionMenuPosition.x}px;top:${pdfSelectionMenuPosition.y}px;`}
  >
    <button class="menu-item" on:click={handlePdfSelectionCopy}>复制</button>
    <button class="menu-item" on:click={handlePdfSelectionAddNote}>添加笔记</button>
  </div>
{/if}

{#if selectedNote && noteViewerVisible}
  <NoteViewer
    note={selectedNote}
    position={noteViewerPosition}
    visible={noteViewerVisible}
    on:close={() => {
      noteViewerVisible = false;
      selectedNote = null;
    }}
    on:delete={handleNoteDelete}
    on:edit={handleNoteEdit}
  />
{/if}

<style>
  .pdf-reader {
    height: 100%;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    padding-bottom: 56px; /* 为底部导航栏留出空间 */
  }

  .toolbar {
    padding: 8px 16px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--background-primary);
    z-index: 10;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: var(--background-modifier-border);
    color: var(--text-normal);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tool-button:hover {
    background: var(--background-modifier-hover);
  }

  .tool-button.active-note-mode {
    background: rgba(var(--interactive-accent-rgb), 0.25);
    border: 1px solid var(--interactive-accent);
  }

  .zoom-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
  }

  .zoom-level {
    font-size: 14px;
    color: var(--text-muted);
    min-width: 48px;
    text-align: center;
  }

  .pdf-container {
    flex: 1;
    overflow: auto;
    position: relative;
    background: var(--background-primary);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: var(--novel-spacing-lg);
  }

  .pdf-page-wrapper {
    position: relative;
    margin: 0 auto;
    box-shadow: var(--novel-shadow-md);
    background: white;
  }

  .pdf-canvas {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .text-layer {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    opacity: 0.2;
    line-height: 1;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--novel-spacing-md);
  }

  .pdf-canvas-layer {
    position: relative;
  }

  .pdf-note-layer {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .pdf-capture-overlay {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .pdf-capture-overlay.active {
    cursor: crosshair;
    pointer-events: auto;
  }

  .pdf-text-layer {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
  }

  .textLayer {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    line-height: 1;
    overflow: hidden;
  }

  .textLayer :global(span) {
    color: transparent;
    -webkit-text-fill-color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
  }

  .textLayer :global(span::selection) {
    background: rgba(0, 0, 255, 0.25);
  }

  .textLayer :global(.endOfContent) {
    display: block;
    position: absolute;
    left: 0;
    top: 100%;
    right: 0;
    bottom: 0;
    z-index: -1;
    cursor: default;
  }

  .pdf-selection-rect {
    position: absolute;
    border: 2px dashed var(--interactive-accent);
    background: rgba(var(--interactive-accent-rgb), 0.08);
    pointer-events: none;
  }

  .pdf-note-highlight-rect {
    position: absolute;
    padding: 0;
    margin: 0;
    background: rgba(255, 215, 0, 0.18);
    border: 2px solid rgba(255, 215, 0, 0.6);
    border-radius: 4px;
    box-sizing: border-box;
    cursor: pointer;
    outline: none;
    pointer-events: auto;
  }

  .pdf-note-marker {
    position: absolute;
    transform: translate(-50%, -80%);
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--interactive-accent);
    background: var(--background-primary);
    color: var(--interactive-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
  }

  .pdf-selection-menu {
    position: fixed;
    z-index: 1000;
    background: linear-gradient(
      135deg,
      var(--background-primary) 0%,
      var(--background-secondary) 100%
    );
    border: 2px solid var(--interactive-accent);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    padding: 6px;
    transform: translate(-50%, -50%);
  }

  .pdf-selection-menu .menu-item {
    display: block;
    padding: 10px 16px;
    min-width: 120px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-normal);
    font-size: 14px;
    font-weight: 500;
    border-radius: 6px;
    text-align: left;
    width: 100%;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;
  }

  .pdf-selection-menu .menu-item:hover {
    background: var(--background-modifier-hover);
    border-left-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateX(2px);
  }

  .pdf-selection-menu .menu-item + .menu-item {
    margin-top: 4px;
  }

  .pdf-note-marker :global(svg) {
    width: 14px;
    height: 14px;
    stroke: currentColor;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 1.2em;
  }

  /* ==================== 书签样式 ==================== */
</style>
