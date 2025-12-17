<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { icons } from './icons';

  export let show = false;
  export let buttonRef: HTMLElement | null = null;

  const dispatch = createEventDispatcher();

  // 字段可见性配置
  let fieldVisibility = {
    cover: true,
    title: true,
    author: true,
    format: true,
    progress: true,
    lastRead: true,
    addTime: true,
  };

  // 视图模式
  let viewMode: 'grid' | 'list' = 'grid';

  let dropdownRef: HTMLDivElement;
  let dropdownPosition = { top: 0, left: 0 };

  // 从本地存储加载配置
  onMount(() => {
    const saved = localStorage.getItem('novel-library-field-visibility');
    if (saved) {
      try {
        fieldVisibility = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load field visibility:', e);
      }
    } else {
      // 默认显示：封面、标题、格式、进度
      fieldVisibility = {
        cover: true,
        title: true,
        author: false,
        format: true,
        progress: true,
        lastRead: false,
        addTime: false,
      };
      saveConfig();
    }

    const savedViewMode = localStorage.getItem('novel-library-view-mode');
    if (savedViewMode === 'list' || savedViewMode === 'grid') {
      viewMode = savedViewMode;
    }

    // 初始触发一次事件，让父组件知道当前配置
    dispatch('fieldChange', { fieldVisibility });

    // 初始位置计算
    if (show && buttonRef) {
      updatePosition();
    }
  });

  // 计算下拉菜单位置
  function updatePosition() {
    if (buttonRef && typeof window !== 'undefined') {
      const rect = buttonRef.getBoundingClientRect();
      dropdownPosition = {
        top: rect.bottom + 4,
        left: rect.left,
      };
    }
  }

  // 当显示状态改变时更新位置
  $: if (show && buttonRef) {
    // 使用 setTimeout 确保 DOM 已更新
    setTimeout(() => {
      updatePosition();
    }, 10);
  }

  // 切换字段可见性
  function toggleField(field: keyof typeof fieldVisibility) {
    fieldVisibility[field] = !fieldVisibility[field];
    saveConfig();
    dispatch('fieldChange', { fieldVisibility });
  }

  // 切换视图模式
  function changeViewMode(mode: 'grid' | 'list') {
    viewMode = mode;
    localStorage.setItem('novel-library-view-mode', mode);
    dispatch('viewModeChange', { viewMode: mode });
  }

  // 重置为默认
  function resetToDefault() {
    fieldVisibility = {
      cover: true,
      title: true,
      author: false,
      format: true,
      progress: true,
      lastRead: false,
      addTime: false,
    };
    viewMode = 'grid';
    saveConfig();
    localStorage.setItem('novel-library-view-mode', 'grid');
    dispatch('fieldChange', { fieldVisibility });
    dispatch('viewModeChange', { viewMode: 'grid' });
  }

  // 保存配置
  function saveConfig() {
    localStorage.setItem('novel-library-field-visibility', JSON.stringify(fieldVisibility));
  }

  // 点击外部关闭
  function handleClickOutside(event: MouseEvent) {
    if (
      show &&
      dropdownRef &&
      !dropdownRef.contains(event.target as Node) &&
      buttonRef &&
      !buttonRef.contains(event.target as Node)
    ) {
      dispatch('close');
    }
  }

  $: if (show) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
</script>

{#if show}
  <div
    bind:this={dropdownRef}
    class="properties-dropdown"
    style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
  >
    <!-- 显示字段 -->
    <div class="properties-section">
      <div class="properties-section-title">显示字段</div>
      <div class="properties-fields">
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.cover}
            on:change={() => toggleField('cover')}
          />
          <span>封面</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.title}
            on:change={() => toggleField('title')}
          />
          <span>标题</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.author}
            on:change={() => toggleField('author')}
          />
          <span>作者</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.format}
            on:change={() => toggleField('format')}
          />
          <span>格式</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.progress}
            on:change={() => toggleField('progress')}
          />
          <span>进度</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.lastRead}
            on:change={() => toggleField('lastRead')}
          />
          <span>最后阅读</span>
        </label>
        <label class="properties-field-item">
          <input
            type="checkbox"
            checked={fieldVisibility.addTime}
            on:change={() => toggleField('addTime')}
          />
          <span>添加时间</span>
        </label>
      </div>
    </div>

    <div class="properties-divider"></div>

    <!-- 视图模式 -->
    <div class="properties-section">
      <div class="properties-section-title">视图模式</div>
      <div class="properties-view-modes">
        <label class="properties-view-item">
          <input
            type="radio"
            name="viewMode"
            checked={viewMode === 'grid'}
            on:change={() => changeViewMode('grid')}
          />
          <span>网格视图</span>
        </label>
        <label class="properties-view-item">
          <input
            type="radio"
            name="viewMode"
            checked={viewMode === 'list'}
            on:change={() => changeViewMode('list')}
            disabled
          />
          <span>列表视图（即将推出）</span>
        </label>
      </div>
    </div>

    <div class="properties-divider"></div>

    <!-- 重置按钮 -->
    <button type="button" class="properties-reset-btn" on:click={resetToDefault}>
      重置为默认
    </button>
  </div>
{/if}

<style>
  .properties-dropdown {
    position: fixed;
    z-index: 1000;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-s);
    padding: var(--size-4-2);
    min-width: 200px;
    max-width: 280px;
  }

  .properties-section {
    padding: var(--size-4-1) 0;
  }

  .properties-section-title {
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: var(--size-4-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .properties-fields,
  .properties-view-modes {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-1);
  }

  .properties-field-item,
  .properties-view-item {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-1) var(--size-4-2);
    border-radius: var(--radius-s);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .properties-field-item:hover,
  .properties-view-item:hover {
    background: var(--background-modifier-hover);
  }

  .properties-field-item input[type='checkbox'],
  .properties-view-item input[type='radio'] {
    cursor: pointer;
    accent-color: var(--interactive-accent);
  }

  .properties-field-item input:disabled,
  .properties-view-item input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .properties-field-item span,
  .properties-view-item span {
    font-size: var(--font-ui-small);
    color: var(--text-normal);
  }

  .properties-view-item input:disabled + span {
    color: var(--text-muted);
  }

  .properties-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: var(--size-4-2) 0;
  }

  .properties-reset-btn {
    width: 100%;
    padding: var(--size-4-2);
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .properties-reset-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }
</style>
