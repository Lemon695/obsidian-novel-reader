<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Novel } from '../../types';
  import type NovelReaderPlugin from '../../main';
  import ChapterHistoryPanel from '../ChapterHistoryPanel.svelte';
  import NoteListPanel from '../NoteListPanel.svelte';
  import type { Note } from '../../types/notes';
  import type { ChapterProgress } from '../../types/txt/txt-reader';
  import type { ChapterHistory } from '../../types/reading-stats';
  import NovelStatsModal from '../NovelStatsModal.svelte';
  import TxtSettings from './TxtSettings.svelte';
  import UnifiedStyleSettings from './UnifiedStyleSettings.svelte';
  import { ReadingStatsService } from '../../services/reading-stats-service';
  import { icons } from '../library/icons';
  import type { ReaderStyleManager } from '../../services/renderer/reader-style-manager';

  const dispatch = createEventDispatcher();

  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let content: string = '';
  export let currentChapterId: number | string = 0;
  export let notes: Note[] = [];
  export let readingStats: unknown = null;
  export let showReadingProgress: boolean = true;
  export let chapterHistory: ChapterHistory[] = []; // 从父组件接收

  let showSettingsDropdown = false;
  let showHistoryPanel = false;
  let showStatsModal = false;
  let showNoteList = false;
  let showSettingsPanel = false;

  export let readerType: 'txt' | 'pdf' | 'epub' | 'mobi';
  export let hasBookmarkAtCurrentPosition: boolean = false; // 当前位置是否有书签
  export let styleManager: ReaderStyleManager | null = null; // 样式管理器

  onMount(() => {
    // 立即执行异步初始化
    const initialize = async () => {
      // 如果父组件没有传递chapterHistory，则自己加载
      if (
        (!chapterHistory || chapterHistory.length === 0) &&
        novel &&
        plugin.chapterHistoryService
      ) {
        try {
          chapterHistory = await plugin.chapterHistoryService.getHistory(novel.id);
        } catch (error) {
          console.error('Failed to load chapter history:', error);
        }
      }

      await loadReadingStats();
    };
    initialize();

    // 添加事件监听器
    document.addEventListener('click', handleGlobalClick);

    // 返回同步的清理函数
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  });

  onDestroy(() => {
    document.removeEventListener('click', handleGlobalClick);
  });

  // 处理设置按钮点击
  function handleSettingsClick(event: MouseEvent) {
    console.log('handleSettingsClick');
    event.stopPropagation();
    showSettingsDropdown = !showSettingsDropdown;
  }

  // 处理下拉菜单选项点击
  function handleMenuSelect(
    option: 'settings' | 'history' | 'stats' | 'notes' | 'bookmarks' | 'addBookmark'
  ) {
    showSettingsDropdown = false;

    // 重置所有面板状态
    showHistoryPanel = false;
    showStatsModal = false;
    showNoteList = false;
    showSettingsPanel = false;

    console.log('设置页面,handleMenuSelect---' + option);

    // 根据选项显示对应面板
    switch (option) {
      case 'settings':
        showSettingsPanel = true;
        break;
      case 'history':
        showHistoryPanel = true;
        break;
      case 'stats':
        showStatsModal = true;
        break;
      case 'notes':
        showNoteList = true;
        break;
      case 'bookmarks':
        // 只通知父组件显示书签面板，不在这里设置状态
        dispatch('showBookmarks');
        break;
      case 'addBookmark':
        dispatch('addBookmark'); // 通知父组件添加书签
        break;
    }
  }

  // 全局点击处理
  function handleGlobalClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const isSettingsButton = target.closest('.settings-button');
    const isDropdown = target.closest('.settings-dropdown');

    if (!isSettingsButton && !isDropdown) {
      showSettingsDropdown = false;
    }
  }

  // 加载阅读统计
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

  // 处理导出报告
  async function handleExportStats() {
    if (!novel) return;

    try {
      const statsService = new ReadingStatsService(plugin.app, plugin);
      const report = await statsService.exportReport(novel.id);
      if (report) {
        const blob = new Blob([report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${novel.title}_阅读报告.md`;
        document.body.appendChild(a);
        a.click();

        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export reading stats:', error);
    }
  }

  // 章节跳转处理
  function onJumpToChapter(event: CustomEvent) {
    dispatch('jumpToChapter', event.detail);
  }

  function onJumpToNote(event: CustomEvent) {
    showNoteList = false;
    dispatch('jumpToNote', event.detail);
  }

  let noteViewerVisible = false; // 控制笔记查看器显示
  let selectedNote: Note | null = null;
  let selectedTextForNote = '';
  let showNoteDialog = false; // 控制笔记对话框显示
  let currentChapter: ChapterProgress | null = null;

  function handleNoteEdit(event: CustomEvent) {
    const { note } = event.detail;
    noteViewerVisible = false; // 关闭查看器
    selectedNote = note; // 保存当前编辑的笔记
    selectedTextForNote = note.selectedText; // 确保显示正确的选中文本
    showNoteDialog = true; // 显示编辑对话框
  }

  async function saveNotes() {
    try {
      const notesData = {
        novelId: novel.id,
        novelName: novel.title,
        notes,
      };

      // 构建notes目录路径
      const notesDir = `${plugin.settings.libraryPath}/notes`;
      const notesPath = `${notesDir}/${novel.id}.json`;

      // 确保notes目录存在
      if (!(await plugin.app.vault.adapter.exists(notesDir))) {
        await plugin.app.vault.adapter.mkdir(notesDir);
      }

      // 写入文件
      await plugin.app.vault.adapter.write(notesPath, JSON.stringify(notesData, null, 2));

      console.log('Notes saved successfully');
    } catch (error) {
      console.error('Failed to save notes:', error);
      throw error;
    }
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

  function handleJumpToChapter(event: CustomEvent) {
    dispatch('jumpToChapter', {
      chapterId: event.detail.chapterId,
    });
  }
</script>

<div class="settings-container">
  <button class="settings-button" on:click={handleSettingsClick} title="设置菜单">
    <span class="settings-icon">{@html icons.settings}</span>
  </button>

  {#if showSettingsDropdown}
    <div class="settings-dropdown" transition:fade={{ duration: 150 }}>
      <button class="dropdown-item" on:click={() => handleMenuSelect('settings')}>
        <span class="icon">{@html icons.settings}</span>
        设置
      </button>
      {#if showReadingProgress}
        <button class="dropdown-item" on:click={() => handleMenuSelect('history')}>
          <span class="icon">{@html icons.bookOpen}</span>
          阅读历史
        </button>
      {/if}
      <button class="dropdown-item" on:click={() => handleMenuSelect('notes')}>
        <span class="icon">{@html icons.note}</span>
        笔记列表
      </button>
      <button class="dropdown-item" on:click={() => handleMenuSelect('stats')}>
        <span class="icon">{@html icons.barChart}</span>
        阅读统计
      </button>
      <button
        class="dropdown-item"
        class:has-bookmark={hasBookmarkAtCurrentPosition}
        on:click={() => handleMenuSelect('addBookmark')}
      >
        <span class="icon">{@html icons.bookmarkFilled}</span>
        添加书签
      </button>
      <button class="dropdown-item" on:click={() => handleMenuSelect('bookmarks')}>
        <span class="icon">{@html icons.bookmark}</span>
        书签管理
      </button>
    </div>
  {/if}
</div>

<!-- 设置面板 -->
{#if showSettingsPanel}
  <div class="settings-panel" transition:fade>
    <div class="settings-header">
      <h3>阅读设置</h3>
      <button class="close-button" on:click={() => (showSettingsPanel = false)}>×</button>
    </div>

    <!-- 统一样式设置 -->
    <UnifiedStyleSettings
      {plugin}
      {novel}
      {styleManager}
      on:styleChange
      on:close={() => (showSettingsPanel = false)}
    />
  </div>
{/if}

<!-- 单独的历史面板 -->
{#if showHistoryPanel && !showSettingsDropdown}
  <!-- 添加条件确保下拉菜单和历史面板不会同时显示 -->
  <ChapterHistoryPanel
    isOpen={true}
    history={chapterHistory}
    on:jumpToChapter
    on:deleteRecord={async (e) => {
      await plugin.chapterHistoryService.deleteRecord(novel.id, e.detail.timestamp);
      chapterHistory = await plugin.chapterHistoryService.getHistory(novel.id);
    }}
    on:clearHistory={async () => {
      await plugin.chapterHistoryService.clearHistory(novel.id);
      chapterHistory = [];
    }}
    on:close={() => (showHistoryPanel = false)}
  />
{/if}

{#if showNoteList}
  <NoteListPanel
    isOpen={showNoteList}
    {notes}
    currentChapterId={typeof currentChapterId === 'string'
      ? parseInt(currentChapterId)
      : currentChapterId}
    on:close={() => (showNoteList = false)}
    on:deleteNote
    on:jumpToNote={onJumpToNote}
    on:editNote
  />
{/if}

<!-- 阅读统计弹窗 -->
{#if showStatsModal}
  <NovelStatsModal
    {novel}
    {plugin}
    isOpen={showStatsModal}
    on:close={() => (showStatsModal = false)}
  />
{/if}

<style>
  .settings-container {
    position: relative;
  }

  .settings-button {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 50%;
    padding: var(--novel-spacing-sm);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 16px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--novel-shadow-sm);
  }

  .settings-button:hover {
    transform: translateY(-2px) rotate(90deg);
    box-shadow: var(--novel-shadow-md);
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .settings-icon :global(svg) {
    width: 20px;
    height: 20px;
    stroke: currentColor;
    transition: all 0.2s ease;
  }

  .settings-button:hover .settings-icon :global(svg) {
    stroke: var(--interactive-accent);
  }

  .settings-dropdown {
    position: absolute;
    top: calc(100% + var(--novel-spacing-sm));
    right: 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--novel-radius-lg);
    box-shadow: var(--novel-shadow-lg);
    min-width: 180px;
    z-index: 1000;
    overflow: hidden;
    animation: dropdownSlide 0.2s ease;
  }

  @keyframes dropdownSlide {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-sm);
    width: 100%;
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border: none;
    background: none;
    color: var(--text-normal);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    font-weight: var(--novel-font-weight-medium);
    border-left: 3px solid transparent;
  }

  .dropdown-item:hover {
    background: var(--background-modifier-hover);
    border-left-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .dropdown-item .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    width: 20px;
    height: 20px;
    transition: all 0.2s ease;
  }

  .dropdown-item:hover .icon {
    transform: scale(1.1);
  }

  .dropdown-item.has-bookmark {
    background: rgba(255, 59, 48, 0.1);
    border-left-color: #ff3b30;
    color: #ff3b30;
  }

  .dropdown-item.has-bookmark .icon {
    color: #ff3b30;
  }

  .dropdown-item.has-bookmark:hover {
    background: rgba(255, 59, 48, 0.2);
  }

  .dropdown-item .icon :global(svg) {
    width: 18px;
    height: 18px;
    stroke: currentColor;
  }

  .settings-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    max-width: 90vw;
    height: 600px;
    max-height: 90vh;
    background: var(--background-primary);
    border-radius: var(--novel-radius-lg);
    box-shadow: var(--novel-shadow-lg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    animation: modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes modalFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .close-button {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    font-size: 24px;
    cursor: pointer;
    padding: var(--novel-spacing-xs);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--background-modifier-active);
    border-color: var(--interactive-accent);
    transform: rotate(90deg) scale(1.1);
  }

  .settings-header {
    padding: var(--novel-spacing-lg) var(--novel-spacing-xl);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .settings-header h3 {
    margin: 0;
    font-size: var(--novel-font-size-xl);
    font-weight: var(--novel-font-weight-semibold);
    color: var(--text-normal);
  }
</style>
