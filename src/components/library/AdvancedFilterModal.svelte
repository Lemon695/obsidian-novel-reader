<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import type { Shelf, Category, Tag } from '../../types/shelf';
  import type { FilterConfig } from '../../types/filter-config';
  import { icons } from './icons';

  const dispatch = createEventDispatcher();

  // Props
  export let show = false;
  export let shelves: Shelf[] = [];
  export let categories: Category[] = [];
  export let tags: Tag[] = [];
  export let currentFilters: FilterConfig;

  // 本地筛选状态
  let localFilters: FilterConfig = { ...currentFilters };

  // 监听外部筛选变化
  $: if (show) {
    localFilters = { ...currentFilters };
  }

  // 切换标签选择
  function toggleTag(tagId: string) {
    if (localFilters.tagIds.includes(tagId)) {
      localFilters.tagIds = localFilters.tagIds.filter((id) => id !== tagId);
    } else {
      localFilters.tagIds = [...localFilters.tagIds, tagId];
    }
  }

  // 应用筛选
  function handleApply() {
    dispatch('apply', { filters: localFilters });
    show = false;
  }

  // 重置筛选
  function handleReset() {
    localFilters = {
      shelfId: 'all',
      categoryId: '',
      tagIds: [],
      progressStatus: 'all',
      addTimeRange: 'all',
    };
    dispatch('reset');
  }

  // 关闭弹窗
  function handleClose() {
    dispatch('close');
  }

  // 点击遮罩关闭
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <div
    class="filter-modal-overlay"
    on:click={handleOverlayClick}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    transition:fade={{ duration: 200 }}
    role="presentation"
    aria-modal="true"
    aria-labelledby="filter-modal-title"
  >
    <div class="filter-modal" transition:scale={{ duration: 200, start: 0.95 }}>
      <!-- 标题栏 -->
      <div class="filter-modal-header">
        <h3 id="filter-modal-title">高级筛选</h3>
        <button class="close-button" on:click={handleClose} aria-label="关闭">
          {@html icons.close || '×'}
        </button>
      </div>

      <!-- 筛选内容 -->
      <div class="filter-modal-body">
        <!-- 书架筛选 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📚</span>
            <span>书架筛选</span>
          </div>
          <div class="filter-options">
            <button
              class="filter-option-button"
              class:active={localFilters.shelfId === 'all'}
              on:click={() => (localFilters.shelfId = 'all')}
            >
              全部
            </button>
            {#each shelves as shelf}
              <button
                class="filter-option-button"
                class:active={localFilters.shelfId === shelf.id}
                on:click={() => (localFilters.shelfId = shelf.id)}
              >
                {shelf.name}
                {#if shelf.count !== undefined}
                  <span class="count">({shelf.count})</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- 分类筛选 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📂</span>
            <span>分类筛选</span>
          </div>
          <select bind:value={localFilters.categoryId} class="filter-select">
            <option value="">全部分类</option>
            {#each categories as category}
              <option value={category.id}>{category.name}</option>
            {/each}
          </select>
        </div>

        <!-- 标签筛选 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">🏷️</span>
            <span>标签筛选</span>
            {#if localFilters.tagIds.length > 0}
              <span class="selected-count">({localFilters.tagIds.length})</span>
            {/if}
          </div>
          <div class="filter-tags">
            {#if tags.length === 0}
              <div class="empty-state">暂无标签</div>
            {:else}
              {#each tags as tag}
                <button
                  class="filter-tag-button"
                  class:selected={localFilters.tagIds.includes(tag.id)}
                  style="--tag-color: {tag.color || 'var(--interactive-accent)'}"
                  on:click={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              {/each}
            {/if}
          </div>
        </div>

        <!-- 阅读进度 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📊</span>
            <span>阅读进度</span>
          </div>
          <div class="filter-options">
            <button
              class="filter-option-button"
              class:active={localFilters.progressStatus === 'all'}
              on:click={() => (localFilters.progressStatus = 'all')}
            >
              全部
            </button>
            <button
              class="filter-option-button"
              class:active={localFilters.progressStatus === 'new'}
              on:click={() => (localFilters.progressStatus = 'new')}
            >
              未开始
            </button>
            <button
              class="filter-option-button"
              class:active={localFilters.progressStatus === 'reading'}
              on:click={() => (localFilters.progressStatus = 'reading')}
            >
              阅读中
            </button>
            <button
              class="filter-option-button"
              class:active={localFilters.progressStatus === 'finished'}
              on:click={() => (localFilters.progressStatus = 'finished')}
            >
              已完成
            </button>
          </div>
        </div>

        <!-- 添加时间 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📅</span>
            <span>添加时间</span>
          </div>
          <div class="filter-options">
            <button
              class="filter-option-button"
              class:active={localFilters.addTimeRange === 'all'}
              on:click={() => (localFilters.addTimeRange = 'all')}
            >
              全部
            </button>
            <button
              class="filter-option-button"
              class:active={localFilters.addTimeRange === 'week'}
              on:click={() => (localFilters.addTimeRange = 'week')}
            >
              最近7天
            </button>
            <button
              class="filter-option-button"
              class:active={localFilters.addTimeRange === 'month'}
              on:click={() => (localFilters.addTimeRange = 'month')}
            >
              最近30天
            </button>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="filter-modal-footer">
        <button class="reset-button" on:click={handleReset}>重置</button>
        <button class="apply-button" on:click={handleApply}>应用筛选</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .filter-modal-overlay {
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
  }

  .filter-modal {
    background: var(--background-primary);
    border-radius: 8px;
    width: 500px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-l);
  }

  .filter-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .filter-modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .close-button {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 20px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .filter-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .filter-section {
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .filter-section:last-child {
    border-bottom: none;
  }

  .filter-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-normal);
    font-size: 14px;
  }

  .filter-section-title .icon {
    font-size: 16px;
  }

  .selected-count {
    color: var(--text-accent);
    font-size: 12px;
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-option-button {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: all 0.2s;
  }

  .filter-option-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-accent);
  }

  .filter-option-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-option-button .count {
    color: var(--text-muted);
    font-size: 11px;
  }

  .filter-option-button.active .count {
    color: var(--text-on-accent);
    opacity: 0.8;
  }

  .filter-select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-normal);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .filter-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-tag-button {
    padding: 6px 12px;
    border: 1px solid transparent;
    background: var(--tag-color);
    opacity: 0.6;
    border-radius: 12px;
    cursor: pointer;
    font-size: 12px;
    color: white;
    transition: all 0.2s;
  }

  .filter-tag-button:hover {
    opacity: 0.8;
  }

  .filter-tag-button.selected {
    opacity: 1;
    box-shadow:
      0 0 0 2px var(--background-primary),
      0 0 0 4px var(--tag-color);
  }

  .empty-state {
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }

  .filter-modal-footer {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .reset-button,
  .apply-button {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .reset-button {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .reset-button:hover {
    background: var(--background-modifier-hover);
  }

  .apply-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .apply-button:hover {
    background: var(--interactive-accent-hover);
  }
</style>
