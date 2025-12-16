<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import type { CustomShelf } from '../../types/shelf';
  import { icons } from './icons';

  const dispatch = createEventDispatcher();

  // Props
  export let customShelves: CustomShelf[] = [];
  export let currentView: string = 'library';

  // 状态
  let showMenu = false;
  let showNewShelfForm = false;
  let newShelfName = '';

  // 切换菜单
  function toggleMenu() {
    showMenu = !showMenu;
  }

  // 关闭菜单
  function closeMenu() {
    showMenu = false;
    showNewShelfForm = false;
    newShelfName = '';
  }

  // 切换视图
  function switchView(view: string) {
    dispatch('viewChange', { view });
    closeMenu();
  }

  // 选择书架
  function selectShelf(shelfId: string) {
    dispatch('selectShelf', { shelfId });
    closeMenu();
  }

  // 创建书架
  function handleCreateShelf() {
    if (newShelfName.trim()) {
      dispatch('createShelf', { name: newShelfName });
      newShelfName = '';
      showNewShelfForm = false;
    }
  }

  // 点击外部关闭
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.view-dropdown')) {
      closeMenu();
    }
  }

  // 监听点击外部
  $: if (showMenu) {
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  } else {
    document.removeEventListener('click', handleClickOutside);
  }
</script>

<div class="view-dropdown">
  <button class="view-dropdown-button" on:click={toggleMenu} class:active={showMenu}>
    <span class="icon">{@html icons.library}</span>
    <span class="label">
      {#if currentView === 'favorites'}
        我的喜爱
      {:else if currentView.startsWith('shelf:')}
        {customShelves.find((s) => s.id === currentView.split(':')[1])?.name || '书架'}
      {:else}
        图书库
      {/if}
    </span>
    <span class="arrow">{showMenu ? '▲' : '▼'}</span>
  </button>

  {#if showMenu}
    <div class="view-dropdown-menu" transition:scale={{ duration: 150, start: 0.95 }}>
      <!-- 基础视图 -->
      <div class="menu-section">
        <button
          class="menu-item"
          class:active={currentView === 'library'}
          on:click={() => switchView('library')}
        >
          <span class="icon">{@html icons.library}</span>
          <span>全部图书</span>
        </button>

        <button
          class="menu-item"
          class:active={currentView === 'favorites'}
          on:click={() => switchView('favorites')}
        >
          <span class="icon"
            >{@html currentView === 'favorites' ? icons.heartFilled : icons.heart}</span
          >
          <span>我的喜爱</span>
        </button>
      </div>

      <!-- 自定义书架 -->
      {#if customShelves.length > 0 || showNewShelfForm}
        <div class="menu-divider"></div>
        <div class="menu-section">
          <div class="section-header">
            <span>收藏书架</span>
            <button
              class="add-button"
              on:click|stopPropagation={() => (showNewShelfForm = !showNewShelfForm)}
            >
              {showNewShelfForm ? '−' : '+'}
            </button>
          </div>

          {#if showNewShelfForm}
            <div class="new-shelf-form" on:click|stopPropagation>
              <input
                type="text"
                bind:value={newShelfName}
                placeholder="输入书架名称"
                on:keydown={(e) => e.key === 'Enter' && handleCreateShelf()}
              />
              <div class="form-buttons">
                <button
                  class="create-button"
                  on:click={handleCreateShelf}
                  disabled={!newShelfName.trim()}
                >
                  创建
                </button>
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
            </div>
          {/if}

          {#each customShelves as shelf}
            <button
              class="menu-item"
              class:active={currentView === `shelf:${shelf.id}`}
              on:click={() => selectShelf(shelf.id)}
            >
              <span class="icon">{@html icons.shelf}</span>
              <span>{shelf.name}</span>
              <span class="count">({shelf.novels.length})</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .view-dropdown {
    position: relative;
  }

  .view-dropdown-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .view-dropdown-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .view-dropdown-button.active {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .view-dropdown-button .icon {
    display: flex;
    align-items: center;
  }

  .view-dropdown-button .arrow {
    font-size: 10px;
    opacity: 0.7;
  }

  .view-dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 200px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    box-shadow: var(--shadow-l);
    z-index: 100;
    overflow: hidden;
  }

  .menu-section {
    padding: 4px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-normal);
    cursor: pointer;
    border-radius: 4px;
    font-size: 13px;
    text-align: left;
    transition: all 0.2s;
  }

  .menu-item:hover {
    background: var(--background-modifier-hover);
  }

  .menu-item.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .menu-item .icon {
    display: flex;
    align-items: center;
    font-size: 16px;
  }

  .menu-item .count {
    margin-left: auto;
    font-size: 11px;
    opacity: 0.7;
  }

  .menu-divider {
    height: 1px;
    background: var(--background-modifier-border);
    margin: 4px 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .add-button {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    transition: all 0.2s;
  }

  .add-button:hover {
    background: var(--interactive-accent-hover);
    transform: scale(1.1);
  }

  .new-shelf-form {
    padding: 8px 12px;
    background: var(--background-secondary);
    border-radius: 4px;
    margin: 4px;
  }

  .new-shelf-form input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    color: var(--text-normal);
    font-size: 13px;
    margin-bottom: 8px;
  }

  .new-shelf-form input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .form-buttons {
    display: flex;
    gap: 6px;
  }

  .form-buttons button {
    flex: 1;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .create-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .create-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel-button {
    background: var(--background-modifier-error);
    color: white;
  }

  .cancel-button:hover {
    background: var(--background-modifier-error-hover);
  }
</style>
