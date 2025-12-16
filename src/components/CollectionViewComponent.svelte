<script lang="ts">
  import { onMount } from 'svelte';
  import type { Novel } from '../types';
  import type { Shelf, Category } from '../types/shelf';
  import { icons } from './library/icons';

  export let novels: Novel[] = [];
  export let shelves: Shelf[] = [];
  export let categories: Category[] = [];
  export let onCreateShelf: (name: string) => Promise<void>;
  export let onUpdateShelf: (shelfId: string, updates: unknown) => Promise<void>;
  export let onDeleteShelf: (shelfId: string) => Promise<void>;
  export let onMoveBook: (novelId: string, shelfId: string) => Promise<void>;
  export let onRefresh: () => Promise<void>;

  let showNewShelfForm = false;
  let newShelfName = '';
  let selectedShelf: Shelf | null = null;
  let draggedNovel: Novel | null = null;

  // 获取书架中的图书数量
  function getBooksInShelf(shelfId: string): Novel[] {
    return novels.filter((novel) => novel.shelfId === shelfId);
  }

  // 处理拖拽开始
  function handleDragStart(novel: Novel) {
    draggedNovel = novel;
  }

  // 处理拖拽结束
  function handleDrop(shelfId: string) {
    if (draggedNovel) {
      onMoveBook(draggedNovel.id, shelfId);
      draggedNovel = null;
    }
  }

  // 创建新书架
  async function handleCreateShelf() {
    if (newShelfName.trim()) {
      await onCreateShelf(newShelfName);
      newShelfName = '';
      showNewShelfForm = false;
    }
  }

  // 删除书架
  async function handleDeleteShelf(shelf: Shelf) {
    if (confirm(`确定要删除书架"${shelf.name}"吗？`)) {
      await onDeleteShelf(shelf.id);
    }
  }
</script>

<div class="collection-view">
  <div class="header">
    <h2>藏书管理</h2>
    <div class="actions">
      <button class="refresh-button" on:click={onRefresh}>
        <span class="refresh-icon">{@html icons.refresh}</span>
        刷新
      </button>
      <button class="add-shelf-button" on:click={() => (showNewShelfForm = !showNewShelfForm)}>
        <span class="icon">{@html icons.plus}</span>
        新建书架
      </button>
    </div>
  </div>

  {#if showNewShelfForm}
    <div class="new-shelf-form">
      <input type="text" bind:value={newShelfName} placeholder="输入书架名称" />
      <button on:click={handleCreateShelf} disabled={!newShelfName.trim()}> 创建 </button>
      <button
        class="cancel-button"
        on:click={() => {
          showNewShelfForm = false;
          newShelfName = '';
        }}
      >
        取消
      </button>
    </div>
  {/if}

  <div class="shelves-grid">
    {#each shelves as shelf}
      <div
        class="shelf-card"
        on:dragover|preventDefault
        on:drop|preventDefault={() => handleDrop(shelf.id)}
      >
        <div class="shelf-header">
          <h3>{shelf.name}</h3>
          <div class="shelf-actions">
            <span class="book-count">
              {getBooksInShelf(shelf.id).length} 本
            </span>
            {#if !shelf.isDefault}
              <button class="delete-button" on:click={() => handleDeleteShelf(shelf)}> × </button>
            {/if}
          </div>
        </div>

        <div class="books-list">
          {#each getBooksInShelf(shelf.id) as novel}
            <div class="book-item" draggable="true" on:dragstart={() => handleDragStart(novel)}>
              <div class="book-info">
                <span class="book-title">{novel.title}</span>
                {#if novel.progress !== undefined}
                  <span class="book-progress">{novel.progress}%</span>
                {/if}
              </div>
              {#if novel.tags?.length}
                <div class="book-tags">
                  {#each novel.tags as tagId}
                    <span class="tag">{tagId}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}

          {#if getBooksInShelf(shelf.id).length === 0}
            <div class="empty-shelf">拖拽图书到此处</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .collection-view {
    padding: var(--novel-spacing-md);
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--novel-spacing-lg);
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-left: 4px solid var(--interactive-accent);
  }

  .header h2 {
    font-size: var(--novel-font-size-xl);
    font-weight: 600;
    color: var(--text-normal);
    margin: 0;
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .actions {
    display: flex;
    gap: var(--novel-spacing-sm);
  }

  .refresh-button,
  .add-shelf-button {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-xs);
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border-radius: 20px;
    border: 2px solid var(--interactive-accent);
    background: linear-gradient(135deg, transparent 0%, rgba(var(--interactive-accent-rgb), 0.1) 100%);
    cursor: pointer;
    font-size: var(--novel-font-size-base);
    font-weight: 500;
    color: var(--interactive-accent);
    transition: all 0.2s ease;
  }

  .refresh-button:hover,
  .add-shelf-button:hover {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .refresh-button:active .refresh-icon svg {
    animation: spin 0.5s ease-in-out;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .new-shelf-form {
    display: flex;
    gap: var(--novel-spacing-xs);
    margin-bottom: var(--novel-spacing-md);
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    border-radius: 12px;
    border-left: 4px solid var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    animation: slideIn 0.2s ease;
  }

  .new-shelf-form input {
    flex: 1;
    padding: var(--novel-spacing-sm);
    border-radius: 8px;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    font-size: var(--novel-font-size-base);
    transition: all 0.2s ease;
  }

  .new-shelf-form input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }

  .new-shelf-form button {
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: var(--novel-font-size-base);
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .new-shelf-form button:not(.cancel-button) {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .new-shelf-form button:not(.cancel-button):hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .new-shelf-form .cancel-button {
    background: var(--background-modifier-error);
    color: white;
    box-shadow: 0 2px 8px rgba(255, 0, 0, 0.2);
  }

  .new-shelf-form .cancel-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
  }

  .new-shelf-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shelves-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--novel-spacing-md);
  }

  .shelf-card {
    background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%);
    border-radius: 12px;
    padding: var(--novel-spacing-md);
    min-height: 200px;
    display: flex;
    flex-direction: column;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    border-top: 3px solid var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .shelf-card:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    transform: translateY(-4px);
  }

  .shelf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--novel-spacing-md);
    padding-bottom: var(--novel-spacing-sm);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .shelf-header h3 {
    margin: 0;
    font-size: var(--novel-font-size-md);
    font-weight: 600;
    color: var(--text-normal);
  }

  .shelf-actions {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-xs);
  }

  .book-count {
    font-size: var(--novel-font-size-sm);
    font-weight: 600;
    color: var(--text-on-accent);
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    padding: 4px var(--novel-spacing-sm);
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .delete-button {
    background: rgba(var(--text-error-rgb), 0.1);
    border: none;
    color: var(--text-error);
    cursor: pointer;
    padding: var(--novel-spacing-xs);
    font-size: 18px;
    line-height: 1;
    transition: all 0.2s ease;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
    transform: rotate(90deg) scale(1.1);
  }

  .books-list {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-xs);
    flex: 1;
  }

  .book-item {
    padding: var(--novel-spacing-sm);
    background: var(--background-primary);
    border-radius: 8px;
    cursor: move;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    border-left: 3px solid var(--interactive-accent);
  }

  .book-item:hover {
    background: var(--background-modifier-hover);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border-color: var(--interactive-accent);
  }

  .book-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--novel-spacing-xs);
  }

  .book-title {
    flex: 1;
    font-weight: 500;
    font-size: var(--novel-font-size-base);
    color: var(--text-normal);
    transition: color 0.2s ease;
  }

  .book-item:hover .book-title {
    color: var(--interactive-accent);
  }

  .book-progress {
    font-size: var(--novel-font-size-sm);
    font-weight: 600;
    color: var(--text-on-accent);
    padding: 4px var(--novel-spacing-sm);
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .book-tags {
    display: flex;
    gap: var(--novel-spacing-xs);
    flex-wrap: wrap;
  }

  .tag {
    font-size: var(--novel-font-size-sm);
    font-weight: 500;
    padding: 4px var(--novel-spacing-sm);
    background: var(--background-modifier-success);
    color: var(--text-on-accent);
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 128, 0, 0.2);
    transition: all 0.2s ease;
  }

  .tag:hover {
    transform: scale(1.05);
    box-shadow: 0 3px 6px rgba(0, 128, 0, 0.3);
  }

  .empty-shelf {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--novel-spacing-lg);
    border: 2px dashed var(--interactive-accent);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: var(--novel-font-size-base);
    background: rgba(var(--interactive-accent-rgb), 0.05);
    transition: all 0.2s ease;
  }

  .empty-shelf:hover {
    background: rgba(var(--interactive-accent-rgb), 0.1);
    border-color: var(--interactive-accent-hover);
  }

  /* SVG图标样式 */
  .refresh-icon svg,
  .icon svg {
    display: inline-block;
    vertical-align: middle;
    width: 16px;
    height: 16px;
    stroke: currentColor;
    fill: none;
  }
</style>
