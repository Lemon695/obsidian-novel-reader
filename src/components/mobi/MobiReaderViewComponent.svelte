<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import type NovelReaderPlugin from '../../main';
  import type { Novel, ReadingProgress } from '../../types';
  import { Notice } from 'obsidian';
  import LoadingSpinner from '../LoadingSpinner.svelte';
  import { MobiLoaderService } from '../../services/mobi/mobi-loader-service';
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
    scrollPosition?: number;
    timestamp?: number;
  }
  import type { ChapterProgress } from '../../types/txt/txt-reader';

  import ReaderProgressManager from '../reader/ReaderProgressManager.svelte';
  import BookmarkPanelWrapper from '../reader/BookmarkPanelWrapper.svelte';
  import TextSelectionMenu from '../TextSelectionMenu.svelte';
  import NoteDialog from '../NoteDialog.svelte';
  import { NotesService } from '../../services/note/notes-service';
  import type { Bookmark } from '../../types/bookmark';
  // 统一渲染器
  import { MobiRenderer, ReaderStyleManager, ReaderBookmarkManager } from '../../services/renderer';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let initialSection: number = 0;
  export let savedProgress: ReadingProgress | null = null;

  let viewElement: HTMLElement;
  let book: any = null;
  let view: any = null;
  let isLoading = true;
  let currentSection = 0;
  let totalSections = 0;
  let currentSectionTitle = '';
  let currentSectionHTML = ''; // 存储当前章节的 HTML 内容
  let toc: any[] = [];
  let showTOC = false; // 点击目录

  // 统一渲染器实例
  let renderer: MobiRenderer | null = null;
  let styleManager: ReaderStyleManager | null = null;
  let mobiContentElement: HTMLElement; // MOBI 内容容器
  let displayMode: 'hover' | 'none' = 'hover'; // 悬浮目录显示模式
  let isActive = false;

  // 阅读器设置
  let showSettings = false;
  let fontSize = 16;
  let lineHeight = 1.8;
  let fontFamily = 'default';
  let theme = 'light';
  let pageWidth = 800;

  // 阅读会话
  let sessionId: string | null = null;
  let sessionStartTime: number | null = null;
  let lastActivityTime = Date.now();
  let isReadingActive = false;

  // 进度管理
  let scrollPosition = 0;
  let chapterProgressDatas: ChapterProgress[] = [];

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
    scrollPosition: 0,
  };

  // 更新进度位置的响应式语句
  $: if (currentSection >= 0 && toc[currentSection]) {
    const contentArea = viewElement?.querySelector('.mobi-content');
    progressPosition = {
      chapterIndex: currentSection,
      chapterTitle: toc[currentSection]?.title || `Section ${currentSection + 1}`,
      scrollPosition: contentArea?.scrollTop || 0,
      chapterId: currentSection,
    };
  }

  // 笔记相关变量
  let notesService: NotesService;
  let notes: any[] = [];
  let showNoteDialog = false;
  let selectedNote: any | null = null;
  let selectedTextForNote = '';
  let selectedTextIndex = 0;
  let selectedTextChapterId = 0;

  const instanceId = `MOBI-${novel.id.substring(0, 8)}-${Date.now()}`;
  console.log(`[${instanceId}] MOBI Component created for: ${novel.title}`);

  onMount(async () => {
    console.log(`[${instanceId}] Component mounting...`);

    try {
      // 初始化 MOBI
      await initializeMobi();

      // 加载书签
      // 初始化书签管理器
      try {
        bookmarkManager = new ReaderBookmarkManager(
          plugin.bookmarkService,
          novel.id,
          async (bookmark) => {
            await handleGoToBookmark({ detail: bookmark } as CustomEvent<Bookmark>);
          }
        );
        await bookmarkManager.initialize();
        console.log(`[${instanceId}] 书签管理器初始化成功`);
      } catch (error) {
        console.error(`[${instanceId}] 书签管理器初始化失败:`, error);
      }

      // 初始化笔记服务
      notesService = new NotesService(plugin.app, plugin);
      await loadNotes();

      // 初始化统一渲染器
      await tick();
      try {
        if (mobiContentElement) {
          renderer = new MobiRenderer(mobiContentElement);
          styleManager = new ReaderStyleManager(renderer, plugin, novel.id);
          styleManager.applyAllSettings();
          console.log(`[${instanceId}] 渲染器初始化成功`);
        }
      } catch (error) {
        console.error(`[${instanceId}] 渲染器初始化失败:`, error);
      }

      // 自动聚焦到阅读器,使键盘事件生效
      setTimeout(() => {
        if (viewElement) {
          viewElement.focus();
          console.log(`[${instanceId}] Reader focused for keyboard events`);
        }
      }, 100);
    } catch (error) {
      console.error(`[${instanceId}] Failed to initialize MOBI:`, error);
      new Notice('Failed to load MOBI file');
      isLoading = false;
    }
  });

  // 阅读会话管理
  function startReadingSession() {
    if (!sessionId) {
      sessionId = `mobi-session-${Date.now()}`;
      sessionStartTime = Date.now();
      isReadingActive = true;
      lastActivityTime = Date.now();

      console.log(`[${instanceId}] Started reading session: ${sessionId}`);
      dispatch('sessionStart', { sessionId, novelId: novel.id });
    }
  }

  function endReadingSession() {
    if (sessionId && sessionStartTime) {
      const duration = Date.now() - sessionStartTime;
      console.log(`[${instanceId}] Ending reading session: ${sessionId}, duration: ${duration}ms`);

      dispatch('sessionEnd', {
        sessionId,
        novelId: novel.id,
        duration,
        chapterId: currentSection,
      });

      sessionId = null;
      sessionStartTime = null;
      isReadingActive = false;
    }
  }

  // 进度保存
  function saveProgress() {
    if (currentSection < 0 || !toc[currentSection]) return;

    const chapterProgress: ChapterProgress = {
      id: currentSection,
      title: toc[currentSection]?.title || `Section ${currentSection + 1}`,
      content: '',
      startPos: scrollPosition,
      endPos: scrollPosition,
    };

    // 同时保存滚动位置
    const contentArea = viewElement?.querySelector('.mobi-content');
    if (contentArea) {
      scrollPosition = contentArea.scrollTop;
    }
  }

  // 恢复滚动位置
  function restoreScrollPosition() {
    if (scrollPosition > 0) {
      const contentArea = viewElement?.querySelector('.mobi-content');
      if (contentArea) {
        contentArea.scrollTop = scrollPosition;
        console.log(`[${instanceId}] Restored scroll position: ${scrollPosition}`);
      }
    }
  }

  // 滚动处理函数
  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    scrollPosition = target.scrollTop;

    // 更新书签管理器位置
    if (bookmarkManager) {
      bookmarkManager.updateCurrentPosition({
        novelId: novel.id,
        novelTitle: novel.title,
        chapterId: currentSection,
        chapterTitle: toc[currentSection]?.title || `Section ${currentSection + 1}`,
        progress: scrollPosition,
      });
    }

    // 更新阅读进度管理器位置
    progressPosition = {
      chapterIndex: currentSection,
      chapterTitle: toc[currentSection]?.title || `Section ${currentSection + 1}`,
      chapterId: currentSection,
      scrollPosition: scrollPosition,
    };
  }

  // 书签管理函数
  // 书签功能现在由 ReaderBookmarkManager 统一管理

  async function handleGoToBookmark(event: CustomEvent<Bookmark>) {
    const bookmark = event.detail;
    console.log('[MOBI] handleGoToBookmark:', bookmark);
    if (bookmark && bookmark.chapterId >= 0 && bookmark.chapterId < totalSections) {
      // 恢复保存的滚动位置以及更新书签位置
      if (typeof bookmark.progress === 'number') {
        scrollPosition = bookmark.progress;
      }
      await loadSectionHTML(bookmark.chapterId);
      showBookmarkPanel = false;
      new Notice(`已跳转到: ${bookmark.chapterTitle}`);
    } else {
      console.error('[MOBI] Invalid bookmark:', bookmark);
    }
  }

  // 笔记管理函数
  async function loadNotes() {
    try {
      notes = await notesService.loadNotes(novel.id);
      console.log(`[${instanceId}] Loaded ${notes.length} notes`);
    } catch (error) {
      console.error(`[${instanceId}] Failed to load notes:`, error);
      notes = [];
    }
  }

  async function saveNotes() {
    try {
      await notesService.saveNotes(novel.id, novel.title, notes);
      console.log(`[${instanceId}] Saved ${notes.length} notes`);
    } catch (error) {
      console.error(`[${instanceId}] Failed to save notes:`, error);
    }
  }

  function handleAddNote(event: CustomEvent) {
    selectedTextForNote = event.detail.selectedText;
    selectedTextIndex = event.detail.textIndex;
    selectedTextChapterId = event.detail.chapterId;
    selectedNote = null;
    showNoteDialog = true;
  }

  async function handleNoteSave(event: CustomEvent) {
    if (selectedNote) {
      // 编辑已有笔记
      notes = notes.map((note) =>
        note.id === selectedNote?.id
          ? { ...note, content: event.detail.content, timestamp: Date.now() }
          : note
      );
    } else {
      // 添加新笔记
      const note = {
        id: `note-${Date.now()}`,
        chapterId: currentSection,
        chapterName: toc[currentSection]?.title || `Section ${currentSection + 1}`,
        selectedText: selectedTextForNote,
        content: event.detail.content,
        timestamp: Date.now(),
        textIndex: selectedTextIndex,
        textLength: selectedTextForNote.length,
        lineNumber: 0,
      };
      notes = [...notes, note];
    }

    await saveNotes();
    showNoteDialog = false;
    selectedNote = null;
    selectedTextForNote = '';
  }

  function handleNoteDialogClose() {
    showNoteDialog = false;
    selectedNote = null;
    selectedTextForNote = '';
  }

  // 应用阅读器设置
  function applySettings() {
    const contentArea = viewElement?.querySelector('.mobi-html-content');
    if (contentArea) {
      (contentArea as HTMLElement).style.fontSize = `${fontSize}px`;
      (contentArea as HTMLElement).style.lineHeight = `${lineHeight}`;
      (contentArea as HTMLElement).style.maxWidth = `${pageWidth}px`;
      (contentArea as HTMLElement).style.fontFamily = fontFamily === 'default' ? '' : fontFamily;
    }

    // 应用主题
    if (viewElement) {
      viewElement.classList.toggle('dark-theme', theme === 'dark');
      viewElement.classList.toggle('light-theme', theme === 'light');
    }
  }

  async function initializeMobi() {
    try {
      isLoading = true;

      // 获取文件
      const abstractFile = plugin.app.vault.getAbstractFileByPath(novel.path);
      if (!abstractFile) {
        throw new Error('MOBI file not found');
      }

      // 确保是 TFile 类型
      const file = abstractFile as import('obsidian').TFile;

      // 加载 MOBI
      const loaderService = new MobiLoaderService(plugin.app);
      book = await loaderService.loadMobi(file);

      if (!book) {
        throw new Error('Failed to load MOBI book');
      }

      // 获取目录并展平
      const rawToc = await loaderService.getTOC(book);
      console.log(`[${instanceId}] Raw TOC:`, rawToc);

      // 展平嵌套的目录结构,保留层级信息
      function flattenTOC(items: any[], level = 0, result: any[] = []): any[] {
        if (!Array.isArray(items)) {
          return result;
        }

        for (const item of items) {
          if (!item) continue;

          result.push({
            title: item.title || 'Untitled',
            href: item.href || '',
            level: level,
          });

          if (item.children && Array.isArray(item.children) && item.children.length > 0) {
            flattenTOC(item.children, level + 1, result);
          }
        }
        return result;
      }

      toc = flattenTOC(rawToc);
      console.log(`[${instanceId}] Flattened TOC:`, toc);
      totalSections = toc.length || 1;

      console.log(`[${instanceId}] MOBI loaded:`, {
        totalSections,
        initialSection,
      });

      // 直接渲染 MOBI HTML 内容,不使用 foliate-view
      try {
        console.log(`[${instanceId}] Loading section ${initialSection} HTML...`);

        // 加载当前章节的 HTML (此时 isLoading 仍为 true,显示加载中)
        await loadSectionHTML(initialSection);

        console.log(`[${instanceId}] MOBI renderer initialized (direct HTML mode)`);

        // 数据加载完成,设置 isLoading = false 显示内容
        isLoading = false;

        // 启动阅读会话
        startReadingSession();
      } catch (renderError) {
        console.error(`[${instanceId}] Failed to initialize renderer:`, renderError);
        const error = renderError as Error;
        console.error(`[${instanceId}] Error stack:`, error.stack);
        new Notice('MOBI 渲染器初始化失败。显示元数据模式。');
        isLoading = false;
      }
    } catch (error) {
      console.error(`[${instanceId}] Failed to initialize MOBI:`, error);
      const err = error as Error;
      new Notice(`Failed to load MOBI: ${err.message}`);
    } finally {
      isLoading = false;
      console.log(`[${instanceId}] isLoading set to false in finally block`);
    }
  }

  // 加载并显示指定章节的 HTML 内容
  async function loadSectionHTML(sectionIndex: number) {
    console.log(`[${instanceId}] loadSectionHTML called with index:`, sectionIndex);
    console.log(`[${instanceId}] book:`, !!book, 'totalSections:', totalSections);

    if (!book || sectionIndex < 0 || sectionIndex >= totalSections) {
      console.error(`[${instanceId}] Invalid section index or book not loaded`);
      return;
    }

    try {
      console.log(`[${instanceId}] Getting section ${sectionIndex}...`);
      const section = book.sections[sectionIndex];
      if (!section) {
        console.error(`[${instanceId}] Section ${sectionIndex} not found`);
        throw new Error(`Section ${sectionIndex} not found`);
      }

      console.log(`[${instanceId}] Creating document for section ${sectionIndex}...`);
      const doc = await section.createDocument();
      if (!doc) {
        throw new Error(`Failed to create document for section ${sectionIndex}`);
      }

      // 提取 HTML 内容
      const bodyContent = doc.body?.innerHTML || doc.documentElement?.innerHTML || '';

      if (!bodyContent) {
        console.warn(`[${instanceId}] Section ${sectionIndex} has no no content`);
        return;
      }

      console.log(`[${instanceId}] Content length:`, bodyContent.length);

      // 处理图片资源
      let processedContent = bodyContent;
      try {
        // 1. 处理带 src 属性的图片
        const imgSrcRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
        let matches = bodyContent.matchAll(imgSrcRegex);

        for (const match of matches) {
          const originalSrc = match[1];
          console.log(`[${instanceId}] Found image with src:`, originalSrc);

          // 如果是相对路径,尝试通过 section 加载资源
          if (!originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
            try {
              const resource = await section.createResource?.(originalSrc);
              if (resource) {
                const blob = new Blob([resource], { type: 'image/jpeg' });
                const blobUrl = URL.createObjectURL(blob);
                processedContent = processedContent.replace(originalSrc, blobUrl);
                console.log(`[${instanceId}] Image converted to blob URL:`, blobUrl);
              }
            } catch (imgError) {
              console.warn(`[${instanceId}] Failed to load image ${originalSrc}:`, imgError);
            }
          }
        }

        // 2. 处理带 recindex 属性的图片 (MOBI 特有)
        console.log(`[${instanceId}] Checking for recindex images...`);
        const imgRecindexRegex = /<img([^>]*?)recindex="(\d+)"([^>]*?)>/g;
        const recindexMatches = Array.from(processedContent.matchAll(imgRecindexRegex));
        console.log(`[${instanceId}] Found ${recindexMatches.length} images with recindex`);

        for (const match of recindexMatches) {
          const recindexStr = match[2];
          const recindexNum = parseInt(recindexStr, 10); // 转换为数字
          const beforeAttrs = match[1];
          const afterAttrs = match[3];
          console.log(
            `[${instanceId}] Processing image with recindex: ${recindexStr} (as number: ${recindexNum})`
          );

          try {
            // 尝试多种方法获取图片资源
            let resource = null;

            // 方法1: 通过 section.createResource (尝试字符串)
            if (!resource && section.createResource) {
              console.log(`[${instanceId}] Trying section.createResource with string...`);
              try {
                resource = await section.createResource(recindexStr);
                console.log(`[${instanceId}] section.createResource(string) result:`, !!resource);
              } catch (e) {
                console.log(`[${instanceId}] section.createResource(string) failed:`, e.message);
              }
            }

            // 方法2: 通过 section.createResource (尝试数字)
            if (!resource && section.createResource) {
              console.log(`[${instanceId}] Trying section.createResource with number...`);
              try {
                resource = await section.createResource(recindexNum);
                console.log(`[${instanceId}] section.createResource(number) result:`, !!resource);
              } catch (e) {
                console.log(`[${instanceId}] section.createResource(number) failed:`, e.message);
              }
            }

            // 方法3: 通过 book.file.loadBlob (尝试字符串)
            if (!resource && book.file?.loadBlob) {
              console.log(`[${instanceId}] Trying book.file.loadBlob with string...`);
              try {
                resource = await book.file.loadBlob(recindexStr);
                console.log(`[${instanceId}] book.file.loadBlob(string) result:`, !!resource);
              } catch (e) {
                console.log(`[${instanceId}] book.file.loadBlob(string) failed:`, e.message);
              }
            }

            // 方法4: 通过 book.file.loadBlob (尝试数字)
            if (!resource && book.file?.loadBlob) {
              console.log(`[${instanceId}] Trying book.file.loadBlob with number...`);
              try {
                resource = await book.file.loadBlob(recindexNum);
                console.log(`[${instanceId}] book.file.loadBlob(number) result:`, !!resource);
              } catch (e) {
                console.log(`[${instanceId}] book.file.loadBlob(number) failed:`, e.message);
              }
            }

            // 方法5: 通过 book.loadResource (尝试数字)
            if (!resource && book.loadResource) {
              console.log(`[${instanceId}] Trying book.loadResource with number...`);
              try {
                resource = await book.loadResource(recindexNum);
                console.log(`[${instanceId}] book.loadResource(number) result:`, !!resource);
              } catch (e) {
                console.log(`[${instanceId}] book.loadResource(number) failed:`, e.message);
              }
            }

            if (resource) {
              // 检查资源类型和大小
              console.log(`[${instanceId}] Resource type:`, typeof resource);
              console.log(`[${instanceId}] Resource instanceof Blob:`, resource instanceof Blob);

              // 如果是字符串,打印内容看看是什么
              if (typeof resource === 'string') {
                console.log(`[${instanceId}] Resource string content:`, resource.substring(0, 100));

                // 如果是 data URL,直接使用
                if (resource.startsWith('data:')) {
                  const newImgTag = `<img${beforeAttrs}src="${resource}" recindex="${recindexStr}"${afterAttrs}>`;
                  processedContent = processedContent.replace(match[0], newImgTag);
                  console.log(`[${instanceId}] ✅ Image recindex ${recindexStr} using data URL`);
                  continue;
                }

                // 如果是 blob URL,直接使用
                if (resource.startsWith('blob:')) {
                  const newImgTag = `<img${beforeAttrs}src="${resource}" recindex="${recindexStr}"${afterAttrs}>`;
                  processedContent = processedContent.replace(match[0], newImgTag);
                  console.log(`[${instanceId}] ✅ Image recindex ${recindexStr} using blob URL`);
                  continue;
                }

                // 否则可能是路径,尝试通过 book.file.loadBlob 加载
                console.warn(
                  `[${instanceId}] Resource is string but not data/blob URL, trying to load as path:`,
                  resource
                );
                if (book.file?.loadBlob) {
                  try {
                    const blobData = await book.file.loadBlob(resource);
                    if (blobData) {
                      const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
                      const blobUrl = URL.createObjectURL(blob);
                      const newImgTag = `<img${beforeAttrs}src="${blobUrl}" recindex="${recindexStr}"${afterAttrs}>`;
                      processedContent = processedContent.replace(match[0], newImgTag);
                      console.log(
                        `[${instanceId}] ✅ Image recindex ${recindexStr} loaded via path, blob size:`,
                        blob.size
                      );
                      continue;
                    }
                  } catch (e) {
                    console.error(`[${instanceId}] Failed to load blob from path:`, e);
                  }
                }
              }

              if (resource instanceof ArrayBuffer) {
                console.log(`[${instanceId}] Resource is ArrayBuffer, size:`, resource.byteLength);
              } else if (resource.byteLength !== undefined) {
                console.log(`[${instanceId}] Resource byteLength:`, resource.byteLength);
              }

              const blob =
                resource instanceof Blob ? resource : new Blob([resource], { type: 'image/jpeg' });
              console.log(`[${instanceId}] Blob created, size:`, blob.size, 'type:', blob.type);

              const blobUrl = URL.createObjectURL(blob);

              // 替换整个 img 标签,添加 src 属性
              const newImgTag = `<img${beforeAttrs}src="${blobUrl}" recindex="${recindexStr}"${afterAttrs}>`;
              processedContent = processedContent.replace(match[0], newImgTag);
              console.log(
                `[${instanceId}] ✅ Image recindex ${recindexStr} converted to blob URL:`,
                blobUrl
              );
              console.log(`[${instanceId}] Blob size: ${blob.size} bytes, type: ${blob.type}`);
            } else {
              console.warn(
                `[${instanceId}] ❌ All methods failed to load image recindex ${recindexStr}`
              );
              console.log(`[${instanceId}] Available methods:`, {
                'section.createResource': !!section.createResource,
                'book.file.loadBlob': !!book.file?.loadBlob,
                'book.loadResource': !!book.loadResource,
              });
            }
          } catch (imgError) {
            console.error(
              `[${instanceId}] Failed to load image recindex ${recindexStr}:`,
              imgError
            );
          }
        }
      } catch (error) {
        console.warn(`[${instanceId}] Failed to process images:`, error);
      }

      // 存储当前章节的 HTML 内容到响应式变量
      currentSectionHTML = processedContent;
      console.log(`[${instanceId}] Content stored, will render after isLoading = false`);

      currentSection = sectionIndex;
      // 更新书签管理器的当前位置
      bookmarkManager?.updateCurrentPosition({
        novelId: novel.id,
        novelTitle: novel.title,
        chapterId: sectionIndex,
        chapterTitle: `Section ${sectionIndex + 1}`,
        progress: sectionIndex,
      });

      // 保存阅读进度
      saveProgress();
      if (toc[sectionIndex]) {
        currentSectionTitle = toc[sectionIndex].title;
      }

      // 更新书签状态
      // 书签状态由 bookmarkManager 自动管理

      // 应用阅读器设置
      setTimeout(() => {
        applySettings();
        restoreScrollPosition();
      }, 100);

      // 保存进度
      saveProgress();

      console.log(`[${instanceId}] Section ${sectionIndex} loaded successfully`);
    } catch (error) {
      console.error(`[${instanceId}] Failed to load section ${sectionIndex}:`, error);
      new Notice('Failed to load section');
    }
  }

  function handleRelocate(event: CustomEvent) {
    // This function was previously used for foliate-view's 'relocate' event.
    // With direct HTML rendering, this event will not be fired.
    // The logic for saving progress and updating currentSection/Title will need to be managed differently
    // if page-level progress tracking is desired with direct HTML rendering.
    // For now, we keep it as per instruction, but it will be inactive.
    const { index, fraction } = event.detail;

    currentSection = index;

    // 更新章节标题
    if (toc[index]) {
      currentSectionTitle = toc[index].title;
    }

    // 保存进度
    saveProgress();
  }

  async function goToSection(index: number) {
    if (index < 0 || index >= totalSections) return;

    try {
      console.log(`[${instanceId}] Navigating to section ${index}, href:`, toc[index]?.href);
      await loadSectionHTML(index);
    } catch (error) {
      console.error(`[${instanceId}] Failed to go to section:`, error);
    }
  }

  async function nextPage() {
    const nextSection = currentSection + 1;
    if (nextSection < totalSections) {
      await goToSection(nextSection);
    }
  }

  async function prevPage() {
    const prevSection = currentSection - 1;
    if (prevSection >= 0) {
      await goToSection(prevSection);
    }
  }

  // 键盘导航处理函数
  function handlePrevChapter() {
    prevPage();
  }

  function handleNextChapter() {
    nextPage();
  }

  function handleToggleTOC() {
    showTOC = !showTOC;
  }

  function handleClosePanel() {
    if (showTOC) {
      showTOC = false;
    }
  }

  function toggleTOC() {
    showTOC = !showTOC;
  }

  function handleTOCClick(index: number) {
    goToSection(index);
    showTOC = false;
  }

  onDestroy(() => {
    console.log(`[${instanceId}] Component destroying...`);

    // 保存最后的进度
    if (currentSection >= 0) {
      saveProgress();
    }

    // 结束阅读会话
    endReadingSession();

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

    // 清理资源
    if (book) {
      book = null;
    }
  });
</script>

<div
  class="mobi-reader"
  tabindex="0"
  on:focus={() => (isActive = true)}
  on:blur={() => (isActive = false)}
  bind:this={viewElement}
>
  {#if isLoading}
    <div class="loading-container">
      <LoadingSpinner />
      <p>Loading MOBI...</p>
    </div>
  {:else}
    <ReadingSessionManager
      {plugin}
      {novel}
      chapters={(toc || []).map((item, index) => ({
        id: index,
        title: item.title,
        level: item.level || 0,
      }))}
      currentChapterId={currentSection}
      currentChapterTitle={toc[currentSection]?.title || `Section ${currentSection + 1}`}
      totalChapters={totalSections}
      bind:isActive
      on:startReading={(e) => console.log('Start Reading', e.detail)}
      on:endReading={(e) => console.log('End Reading', e.detail)}
      on:chapterSelect={(e) => {
        handleTOCClick(e.detail.chapterId);
      }}
      on:toggleTOC={toggleTOC}
      on:prevChapter={prevPage}
      on:nextChapter={nextPage}
      canGoPrev={currentSection > 0}
      canGoNext={currentSection < totalSections - 1}
    >
      <!-- 目录面板 -->
      <ReaderSidebar
        show={showTOC}
        chapters={(toc || []).map((item, index) => ({
          id: index,
          title: item.title,
          level: item.level || 0,
          page: index + 1,
        }))}
        currentChapterId={currentSection}
        viewMode="chapters"
        virtualPages={[]}
        currentPageNum={currentSection + 1}
        showPageToggle={false}
        on:chapterSelect={(e) => {
          handleTOCClick(e.detail.chapter.id);
          showTOC = false;
        }}
        on:close={() => (showTOC = false)}
      />

      <div class="mobi-content-wrapper">
        <!-- MOBI 内容渲染区域 -->
        <div class="mobi-content" bind:this={mobiContentElement} on:scroll={handleScroll}>
          {#if currentSectionHTML}
            <div class="mobi-html-content">
              {@html currentSectionHTML}
            </div>
          {:else}
            <div class="placeholder">
              <p>正在初始化 MOBI 阅读器...</p>
            </div>
          {/if}
        </div>

        <!-- 工具栏 -->
        <div class="toolbar">
          <ReaderSettingsMenu
            {plugin}
            {novel}
            readerType="mobi"
            currentChapterId={currentSection}
            {notes}
            readingStats={null}
            chapterHistory={[]}
            hasBookmarkAtCurrentPosition={bookmarkManager
              ? ($hasBookmarkAtCurrentPosition ?? false)
              : false}
            {styleManager}
            on:showBookmarks={() => (showBookmarkPanel = true)}
            on:addBookmark={() => {
              if (bookmarkManager && currentSection >= 0) {
                bookmarkManager.toggleBookmark({
                  novelId: novel.id,
                  novelTitle: novel.title,
                  chapterId: currentSection,
                  chapterTitle: toc[currentSection]?.title || `Section ${currentSection + 1}`,
                  progress: scrollPosition,
                });
              }
            }}
          />
        </div>

        <!-- 底部导航栏 -->
        <ReaderNavigation
          currentChapter={currentSection}
          totalChapters={toc.length}
          currentPage={currentSection + 1}
          totalPages={toc.length}
          canGoPrev={currentSection > 0}
          canGoNext={currentSection < totalSections - 1}
          on:prev={prevPage}
          on:next={nextPage}
          on:toggleTOC={toggleTOC}
        />

        <!-- 书签面板 -->
        <BookmarkPanelWrapper
          {plugin}
          novelId={novel.id}
          currentChapterId={currentSection}
          show={showBookmarkPanel}
          on:jump={(e) => {
            if (bookmarkManager) {
              bookmarkManager.goToBookmark(e.detail);
            }
          }}
          on:close={() => (showBookmarkPanel = false)}
        />

        <!-- 文本选择菜单 -->
        <TextSelectionMenu
          novelId={novel.id}
          chapterId={currentSection}
          on:addNote={handleAddNote}
        />

        <!-- 笔记对话框 -->
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
      <!-- Closes toolbar -->
    </ReadingSessionManager>
  {/if}

  <!-- 悬浮目录 -->
  <HoverTOC
    show={displayMode === 'hover'}
    chapters={(toc || []).map((item, index) => ({
      id: index,
      title: item.title,
      level: item.level || 0,
      subChapters: [],
    }))}
    currentChapterId={currentSection}
    viewMode="chapters"
    virtualPages={[]}
    currentPageNum={currentSection + 1}
    canToggleView={false}
    on:chapterSelect={(e) => {
      goToSection(e.detail.chapter.id);
    }}
  />

  <!-- 键盘导航处理组件 -->
  <KeyboardNavigationHandler
    enabled={isActive}
    readerType="mobi"
    canGoPrev={currentSection > 0}
    canGoNext={currentSection < totalSections - 1}
    on:prevChapter={handlePrevChapter}
    on:nextChapter={handleNextChapter}
    on:toggleTOC={handleToggleTOC}
    on:closePanel={handleClosePanel}
  />

  <!-- 进度管理组件 -->
  <ReaderProgressManager
    {plugin}
    {novel}
    readerType="mobi"
    totalChapters={toc.length}
    bind:currentPosition={progressPosition}
    on:save={(e) => {
      console.log('[MOBI] Progress auto-saved:', e.detail.progress);
    }}
  />
</div>

<style>
  .mobi-reader {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    outline: none;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
  }

  .mobi-content-wrapper {
    flex: 1;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .mobi-content {
    flex: 1;
    overflow: auto;
    position: relative;
    background: var(--background-primary);
    padding: 20px;
  }

  /* 直接 HTML 渲染样式 - 应用统一设计系统 */
  :global(.mobi-html-content) {
    max-width: 800px;
    margin: 0 auto;
    font-size: 16px;
    line-height: 1.8;
    color: var(--text-normal);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(.mobi-html-content p) {
    margin: 1em 0;
  }

  :global(.mobi-html-content h1),
  :global(.mobi-html-content h2),
  :global(.mobi-html-content h3) {
    margin: 1.5em 0 0.5em;
    color: var(--text-normal);
    font-weight: var(--novel-font-weight-semibold);
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
  }

  /* foliate-view 样式 */
  :global(foliate-view) {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* 工具栏样式 */
  .toolbar {
    position: fixed;
    top: var(--novel-spacing-md);
    right: var(--novel-spacing-md);
    z-index: 1000;
  }

  /* 书签面板样式 - 侧边栏模式 */

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
</style>
