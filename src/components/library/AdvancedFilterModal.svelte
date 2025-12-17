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
    localFilters = {
      ...currentFilters,
      categoryIds: currentFilters.categoryIds || [],
      categoryMode: currentFilters.categoryMode || 'OR',
      tagMode: currentFilters.tagMode || 'AND',
      excludeTagIds: currentFilters.excludeTagIds || [],
    };
  }

  // 切换分类选择
  function toggleCategory(categoryId: string) {
    if (!localFilters.categoryIds) localFilters.categoryIds = [];
    if (localFilters.categoryIds.includes(categoryId)) {
      localFilters.categoryIds = localFilters.categoryIds.filter((id) => id !== categoryId);
    } else {
      localFilters.categoryIds = [...localFilters.categoryIds, categoryId];
    }
  }

  // 切换标签选择
  function toggleTag(tagId: string) {
    if (localFilters.tagIds.includes(tagId)) {
      localFilters.tagIds = localFilters.tagIds.filter((id) => id !== tagId);
    } else {
      localFilters.tagIds = [...localFilters.tagIds, tagId];
    }
  }

  // 切换排除标签
  function toggleExcludeTag(tagId: string) {
    if (!localFilters.excludeTagIds) localFilters.excludeTagIds = [];
    if (localFilters.excludeTagIds.includes(tagId)) {
      localFilters.excludeTagIds = localFilters.excludeTagIds.filter((id) => id !== tagId);
    } else {
      localFilters.excludeTagIds = [...localFilters.excludeTagIds, tagId];
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
      categoryIds: [],
      categoryMode: 'OR',
      tagIds: [],
      tagMode: 'AND',
      excludeTagIds: [],
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
    class="novel-modal-overlay"
    on:click={handleOverlayClick}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    transition:fade={{ duration: 200 }}
    role="presentation"
    aria-modal="true"
    aria-labelledby="filter-modal-title"
  >
    <div class="novel-modal filter-modal" transition:scale={{ duration: 200, start: 0.95 }}>
      <!-- 标题栏 -->
      <div class="novel-modal-header">
        <h3 id="filter-modal-title" class="novel-modal-title">高级筛选</h3>
        <button class="novel-modal-close" on:click={handleClose} aria-label="关闭">
          {@html icons.close || '×'}
        </button>
      </div>

      <!-- 筛选内容 -->
      <div class="novel-modal-content filter-modal-body">
        <!-- 书架筛选 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📚</span>
            <span>书架筛选</span>
          </div>
          <div class="filter-options">
            <button
              class="filter-option"
              class:active={localFilters.shelfId === 'all'}
              on:click={() => (localFilters.shelfId = 'all')}
            >
              全部
            </button>
            {#each shelves as shelf}
              <button
                class="filter-option"
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

        <!-- 分类筛选（多选） -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📂</span>
            <span>分类筛选</span>
            {#if localFilters.categoryIds && localFilters.categoryIds.length > 0}
              <span class="selected-count">已选 {localFilters.categoryIds.length}</span>
            {/if}
          </div>

          <!-- 组合模式切换 -->
          {#if localFilters.categoryIds && localFilters.categoryIds.length > 1}
            <div class="mode-toggle">
              <button
                class="mode-btn"
                class:active={localFilters.categoryMode === 'OR'}
                on:click={() => (localFilters.categoryMode = 'OR')}
              >
                OR（任一）
              </button>
              <button
                class="mode-btn"
                class:active={localFilters.categoryMode === 'AND'}
                on:click={() => (localFilters.categoryMode = 'AND')}
              >
                AND（全部）
              </button>
            </div>
          {/if}

          {#if categories.length > 0}
            <div class="filter-options">
              {#each categories as category}
                <button
                  class="filter-option"
                  class:active={localFilters.categoryIds?.includes(category.id)}
                  on:click={() => toggleCategory(category.id)}
                >
                  {category.name}
                </button>
              {/each}
            </div>
          {:else}
            <div class="empty-state">暂无分类</div>
          {/if}
        </div>

        <!-- 标签筛选（多选+排除） -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">🏷️</span>
            <span>标签筛选</span>
            {#if localFilters.tagIds.length > 0}
              <span class="selected-count">包含 {localFilters.tagIds.length}</span>
            {/if}
            {#if localFilters.excludeTagIds && localFilters.excludeTagIds.length > 0}
              <span class="excluded-count">排除 {localFilters.excludeTagIds.length}</span>
            {/if}
          </div>

          <!-- 组合模式切换 -->
          {#if localFilters.tagIds.length > 1}
            <div class="mode-toggle">
              <button
                class="mode-btn"
                class:active={localFilters.tagMode === 'OR'}
                on:click={() => (localFilters.tagMode = 'OR')}
              >
                OR（任一）
              </button>
              <button
                class="mode-btn"
                class:active={localFilters.tagMode === 'AND'}
                on:click={() => (localFilters.tagMode = 'AND')}
              >
                AND（全部）
              </button>
            </div>
          {/if}

          {#if tags.length > 0}
            <div class="filter-tags">
              {#each tags as tag}
                <div class="tag-item">
                  <button
                    class="filter-tag"
                    class:active={localFilters.tagIds.includes(tag.id)}
                    class:excluded={localFilters.excludeTagIds?.includes(tag.id)}
                    style="background-color: {tag.color}"
                    on:click={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                  <button
                    class="exclude-btn"
                    class:active={localFilters.excludeTagIds?.includes(tag.id)}
                    on:click={() => toggleExcludeTag(tag.id)}
                    title="排除此标签"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state">暂无标签</div>
          {/if}
        </div>

        <!-- 阅读进度 -->
        <div class="filter-section">
          <div class="filter-section-title">
            <span class="icon">📊</span>
            <span>阅读进度</span>
          </div>
          <div class="filter-options">
            <button
              class="filter-option"
              class:active={localFilters.progressStatus === 'all'}
              on:click={() => (localFilters.progressStatus = 'all')}
            >
              全部
            </button>
            <button
              class="filter-option"
              class:active={localFilters.progressStatus === 'new'}
              on:click={() => (localFilters.progressStatus = 'new')}
            >
              未开始
            </button>
            <button
              class="filter-option"
              class:active={localFilters.progressStatus === 'reading'}
              on:click={() => (localFilters.progressStatus = 'reading')}
            >
              阅读中
            </button>
            <button
              class="filter-option"
              class:active={localFilters.progressStatus === 'finished'}
              on:click={() => (localFilters.progressStatus = 'finished')}
            >
              已完成
            </button>
          </div>

          <!-- 进度范围筛选 -->
          <div class="progress-range">
            <label class="range-label">
              <input
                type="checkbox"
                checked={!!localFilters.progressRange}
                on:change={(e) => {
                  if (e.currentTarget.checked) {
                    localFilters.progressRange = { min: 0, max: 100 };
                  } else {
                    localFilters.progressRange = undefined;
                  }
                }}
              />
              <span>自定义进度范围</span>
            </label>
            {#if localFilters.progressRange}
              <div class="range-inputs">
                <input
                  type="number"
                  min="0"
                  max="100"
                  bind:value={localFilters.progressRange.min}
                  placeholder="最小"
                />
                <span>-</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  bind:value={localFilters.progressRange.max}
                  placeholder="最大"
                />
                <span>%</span>
              </div>
            {/if}
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
              class="filter-option"
              class:active={(!localFilters.addTimePreset || localFilters.addTimePreset === 'all') &&
                localFilters.addTimeRange === 'all'}
              on:click={() => {
                localFilters.addTimeRange = 'all';
                localFilters.addTimePreset = 'all';
                localFilters.addTimeCustom = undefined;
              }}
            >
              全部时间
            </button>
            <button
              class="filter-option"
              class:active={localFilters.addTimePreset === 'today'}
              on:click={() => (localFilters.addTimePreset = 'today')}
            >
              今天
            </button>
            <button
              class="filter-option"
              class:active={localFilters.addTimePreset === 'week' ||
                localFilters.addTimeRange === 'week'}
              on:click={() => (localFilters.addTimePreset = 'week')}
            >
              最近7天
            </button>
            <button
              class="filter-option"
              class:active={localFilters.addTimePreset === 'month' ||
                localFilters.addTimeRange === 'month'}
              on:click={() => (localFilters.addTimePreset = 'month')}
            >
              最近30天
            </button>
            <button
              class="filter-option"
              class:active={localFilters.addTimePreset === 'quarter'}
              on:click={() => (localFilters.addTimePreset = 'quarter')}
            >
              最近3个月
            </button>
            <button
              class="filter-option"
              class:active={localFilters.addTimePreset === 'year'}
              on:click={() => (localFilters.addTimePreset = 'year')}
            >
              最近1年
            </button>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="novel-modal-footer">
        <button class="novel-btn novel-btn-secondary" on:click={handleReset}>重置</button>
        <button class="novel-btn novel-btn-primary" on:click={handleApply}>应用筛选</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .novel-modal-overlay {
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
    width: 600px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-l);
  }

  .novel-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .novel-modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .novel-modal-close {
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

  .novel-modal-close:hover {
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
    margin-left: auto;
  }

  .excluded-count {
    color: var(--text-error);
    font-size: 12px;
  }

  /* 模式切换按钮 */
  .mode-toggle {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .mode-btn {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--text-muted);
    transition: all 0.2s;
  }

  .mode-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .mode-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-option {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
    transition: all 0.2s;
  }

  .filter-option:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-accent);
  }

  .filter-option.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .filter-option .count {
    color: var(--text-muted);
    font-size: 11px;
  }

  .filter-option.active .count {
    color: var(--text-on-accent);
    opacity: 0.8;
  }

  .filter-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tag-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .filter-tag {
    padding: 6px 12px;
    border: 2px solid transparent;
    opacity: 0.6;
    border-radius: 12px;
    cursor: pointer;
    font-size: 12px;
    color: white;
    transition: all 0.2s;
  }

  .filter-tag:hover {
    opacity: 0.8;
  }

  .filter-tag.active {
    opacity: 1;
    border-color: rgba(255, 255, 255, 0.5);
  }

  .filter-tag.excluded {
    opacity: 0.3;
    text-decoration: line-through;
  }

  .exclude-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 50%;
    cursor: pointer;
    font-size: 10px;
    color: var(--text-muted);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .exclude-btn:hover {
    background: var(--background-modifier-error);
    color: white;
    border-color: var(--background-modifier-error);
  }

  .exclude-btn.active {
    background: var(--background-modifier-error);
    color: white;
    border-color: var(--background-modifier-error);
  }

  /* 进度范围 */
  .progress-range {
    margin-top: 12px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 4px;
  }

  .range-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-normal);
  }

  .range-inputs {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .range-inputs input {
    width: 80px;
    padding: 6px 8px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-normal);
  }

  .range-inputs input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .empty-state {
    color: var(--text-muted);
    font-size: 13px;
    font-style: italic;
  }

  .novel-modal-footer {
    display: flex;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .novel-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .novel-btn-secondary {
    background: var(--background-secondary);
    color: var(--text-normal);
  }

  .novel-btn-secondary:hover {
    background: var(--background-modifier-hover);
  }

  .novel-btn-primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .novel-btn-primary:hover {
    background: var(--interactive-accent-hover);
  }
</style>
