<script lang="ts">
  import { onMount } from 'svelte';
  import type NovelReaderPlugin from '../main';
  import type { Bookmark } from '../types/bookmark';
  import { BOOKMARK_COLORS } from '../types/bookmark';
  import BookmarkButton from './BookmarkButton.svelte';
  import BookmarkPanel from './BookmarkPanel.svelte';

  export let plugin: NovelReaderPlugin;

  const testNovelId = 'test-novel-demo';
  const testNovelTitle = '书签功能测试小说';

  let bookmarks: Bookmark[] = [];
  let testResults: string[] = [];
  let showPanel = false;
  let currentBookmark: Bookmark | null = null;

  onMount(() => {
    loadBookmarks();
  });

  function loadBookmarks() {
    bookmarks = plugin.bookmarkService.getBookmarks(testNovelId);
  }

  async function addTestBookmark(color: string) {
    try {
      await plugin.bookmarkService.addBookmark({
        novelId: testNovelId,
        novelTitle: testNovelTitle,
        chapterId: 1,
        chapterTitle: '第一章 测试章节',
        position: Math.floor(Math.random() * 1000),
        selectedText: `这是一段 ${color} 颜色的测试文字`,
        color: color as any,
        note: `${color} 颜色的测试书签`,
        tags: ['测试', color]
      });
      addResult(`✅ 成功添加 ${color} 书签`);
      loadBookmarks();
    } catch (error) {
      addResult(`❌ 添加失败: ${error.message}`);
    }
  }

  async function addMultipleBookmarks() {
    addResult('🚀 开始批量添加书签...');
    for (const colorConfig of BOOKMARK_COLORS) {
      await addTestBookmark(colorConfig.value);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    addResult(`✅ 批量添加完成，共 ${BOOKMARK_COLORS.length} 个书签`);
  }

  async function testSearch() {
    const query = '测试';
    const results = plugin.bookmarkService.searchBookmarks(testNovelId, query);
    addResult(`🔍 搜索 "${query}": 找到 ${results.length} 个结果`);
  }

  async function testFilter() {
    const color = 'red';
    const results = plugin.bookmarkService.filterByColor(testNovelId, color as any);
    addResult(`🎨 筛选 ${color} 颜色: 找到 ${results.length} 个结果`);
  }

  async function testStats() {
    const stats = plugin.bookmarkService.getStats(testNovelId);
    addResult(`📊 统计信息: 总数 ${stats.total}`);
    addResult(`   - 最近添加: ${stats.recentlyAdded.length} 个`);
    addResult(`   - 最常访问: ${stats.mostAccessed.length} 个`);
  }

  async function testExport() {
    try {
      const markdown = await plugin.bookmarkService.exportToMarkdown(testNovelId);
      const fileName = `书签测试导出-${Date.now()}.md`;
      await plugin.app.vault.create(fileName, markdown);
      addResult(`📤 导出成功: ${fileName}`);
    } catch (error) {
      addResult(`❌ 导出失败: ${error.message}`);
    }
  }

  async function clearAllBookmarks() {
    if (confirm(`确定要删除所有 ${bookmarks.length} 个测试书签吗？`)) {
      for (const bookmark of bookmarks) {
        await plugin.bookmarkService.removeBookmark(testNovelId, bookmark.id);
      }
      addResult(`🗑️ 已删除 ${bookmarks.length} 个书签`);
      loadBookmarks();
    }
  }

  async function runAllTests() {
    testResults = [];
    addResult('🧪 开始运行所有测试...\n');
    
    await addMultipleBookmarks();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testSearch();
    await testFilter();
    await testStats();
    await testExport();
    
    addResult('\n🎉 所有测试完成！');
  }

  function addResult(message: string) {
    testResults = [...testResults, `[${new Date().toLocaleTimeString()}] ${message}`];
  }

  function handleAddBookmark(event: CustomEvent) {
    addTestBookmark(event.detail.color);
  }

  function handleRemoveBookmark() {
    if (currentBookmark) {
      plugin.bookmarkService.removeBookmark(testNovelId, currentBookmark.id);
      addResult(`🗑️ 删除书签: ${currentBookmark.note}`);
      loadBookmarks();
      currentBookmark = null;
    }
  }

  function handleJumpToBookmark(event: CustomEvent) {
    const bookmark = event.detail;
    addResult(`🔗 跳转到书签: ${bookmark.chapterTitle} - ${bookmark.note}`);
  }

  $: currentBookmark = bookmarks.length > 0 ? bookmarks[0] : null;
</script>

<div class="bookmark-test-container">
  <div class="test-header">
    <h1>📑 书签功能测试</h1>
    <p>这是一个用于测试书签功能的演示页面</p>
  </div>

  <div class="test-content">
    <!-- 左侧：测试控制面板 -->
    <div class="test-panel">
      <div class="panel-section">
        <h3>🎯 快速测试</h3>
        <div class="button-group">
          <button class="test-btn primary" on:click={runAllTests}>
            🧪 运行所有测试
          </button>
          <button class="test-btn" on:click={addMultipleBookmarks}>
            ➕ 批量添加书签
          </button>
          <button class="test-btn" on:click={clearAllBookmarks}>
            🗑️ 清空所有书签
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3>🔍 功能测试</h3>
        <div class="button-group">
          <button class="test-btn" on:click={testSearch}>
            🔍 测试搜索
          </button>
          <button class="test-btn" on:click={testFilter}>
            🎨 测试筛选
          </button>
          <button class="test-btn" on:click={testStats}>
            📊 测试统计
          </button>
          <button class="test-btn" on:click={testExport}>
            📤 测试导出
          </button>
        </div>
      </div>

      <div class="panel-section">
        <h3>🎨 添加单个书签</h3>
        <div class="color-buttons">
          {#each BOOKMARK_COLORS as color}
            <button
              class="color-btn"
              style="background: {color.color}"
              on:click={() => addTestBookmark(color.value)}
              title={color.label}
            >
              {color.emoji}
            </button>
          {/each}
        </div>
      </div>

      <div class="panel-section">
        <h3>📊 当前状态</h3>
        <div class="stats-display">
          <div class="stat-item">
            <span class="stat-label">书签总数</span>
            <span class="stat-value">{bookmarks.length}</span>
          </div>
        </div>
      </div>

      <div class="panel-section">
        <h3>🎮 UI 组件测试</h3>
        <div class="ui-test">
          <div class="component-demo">
            <span>BookmarkButton:</span>
            <BookmarkButton
              hasBookmark={!!currentBookmark}
              bookmarkColor={currentBookmark?.color || 'gray'}
              on:add={handleAddBookmark}
              on:remove={handleRemoveBookmark}
            />
          </div>
          <button class="test-btn" on:click={() => showPanel = !showPanel}>
            {showPanel ? '隐藏' : '显示'} BookmarkPanel
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧：测试结果 -->
    <div class="test-results">
      <div class="results-header">
        <h3>📝 测试结果</h3>
        <button class="clear-btn" on:click={() => testResults = []}>
          清空
        </button>
      </div>
      <div class="results-content">
        {#if testResults.length === 0}
          <div class="empty-results">
            <p>暂无测试结果</p>
            <p class="hint">点击上方按钮开始测试</p>
          </div>
        {:else}
          {#each testResults as result}
            <div class="result-item">{result}</div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <!-- 书签面板 -->
  {#if showPanel}
    <div class="panel-overlay">
      <div class="panel-container">
        <BookmarkPanel
          {plugin}
          novelId={testNovelId}
          currentChapterId={1}
          on:jump={handleJumpToBookmark}
          on:close={() => showPanel = false}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .bookmark-test-container {
    padding: var(--size-4-6);
    max-width: 1400px;
    margin: 0 auto;
  }

  .test-header {
    text-align: center;
    margin-bottom: var(--size-4-8);
  }

  .test-header h1 {
    margin: 0 0 var(--size-4-2) 0;
    color: var(--text-normal);
  }

  .test-header p {
    color: var(--text-muted);
    font-size: var(--font-ui-medium);
  }

  .test-content {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: var(--size-4-6);
  }

  .test-panel {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-4);
  }

  .panel-section {
    background: var(--background-secondary);
    padding: var(--size-4-4);
    border-radius: var(--radius-l);
    border: 2px solid var(--background-modifier-border);
  }

  .panel-section h3 {
    margin: 0 0 var(--size-4-3) 0;
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .test-btn {
    padding: var(--size-4-3) var(--size-4-4);
    border: 2px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small);
    font-weight: 500;
    transition: all 0.2s ease;
    text-align: left;
  }

  .test-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .test-btn.primary {
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    color: var(--text-on-accent);
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .test-btn.primary:hover {
    box-shadow: 0 6px 20px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .color-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--size-4-2);
  }

  .color-btn {
    padding: var(--size-4-3);
    border: 2px solid transparent;
    border-radius: var(--radius-m);
    cursor: pointer;
    font-size: 24px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .color-btn:hover {
    transform: scale(1.1);
    border-color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .stats-display {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-2);
    background: var(--background-primary);
    border-radius: var(--radius-s);
  }

  .stat-label {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .stat-value {
    font-weight: 600;
    font-size: var(--font-ui-medium);
    color: var(--interactive-accent);
  }

  .ui-test {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-3);
  }

  .component-demo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--size-4-3);
    background: var(--background-primary);
    border-radius: var(--radius-m);
  }

  .test-results {
    background: var(--background-secondary);
    border-radius: var(--radius-l);
    border: 2px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    height: 600px;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-4);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .results-header h3 {
    margin: 0;
    color: var(--text-normal);
  }

  .clear-btn {
    padding: var(--size-4-2) var(--size-4-3);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    color: var(--text-muted);
    cursor: pointer;
    font-size: var(--font-ui-smaller);
    transition: all 0.2s ease;
  }

  .clear-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .results-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-4-4);
    font-family: monospace;
    font-size: var(--font-ui-smaller);
  }

  .empty-results {
    text-align: center;
    padding: var(--size-4-12);
    color: var(--text-muted);
  }

  .hint {
    font-size: var(--font-ui-smaller);
    margin-top: var(--size-4-2);
  }

  .result-item {
    padding: var(--size-4-2);
    margin-bottom: var(--size-4-1);
    background: var(--background-primary);
    border-radius: var(--radius-s);
    border-left: 3px solid var(--interactive-accent);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .panel-container {
    width: 600px;
    height: 80vh;
    max-width: 90vw;
  }

  /* 移动端适配 */
  @media (max-width: 1024px) {
    .test-content {
      grid-template-columns: 1fr;
    }

    .test-results {
      height: 400px;
    }
  }
</style>
