<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Novel } from '../types';
  import type { Category } from '../types/shelf';

  const dispatch = createEventDispatcher();

  export let novel: Novel;
  export let categories: Category[] = [];
  let selectedCategoryId = novel.categoryId || '';
  let newCategoryName = '';
  let showNewCategoryForm = false;

  // 创建新分类
  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;

    dispatch('createCategory', {
      name: newCategoryName,
    });

    newCategoryName = '';
    showNewCategoryForm = false;
  }

  // 保存更改
  function handleSave() {
    dispatch('save', {
      novelId: novel.id,
      categoryId: selectedCategoryId || null,
    });
  }

  // 删除分类
  function handleDeleteCategory(categoryId: string) {
    if (confirm('确定要删除这个分类吗？')) {
      dispatch('deleteCategory', { categoryId });
      if (selectedCategoryId === categoryId) {
        selectedCategoryId = '';
      }
    }
  }
</script>

<div class="category-manager">
  <header class="modal-header">
    <h3>管理分类 - {novel.title}</h3>
    <button class="close-button" on:click={() => dispatch('close')}>×</button>
  </header>

  <div class="modal-content">
    <div class="categories-section">
      <div class="section-header">
        <h4>选择分类</h4>
        <button
          class="add-category-button"
          on:click={() => (showNewCategoryForm = !showNewCategoryForm)}
        >
          {showNewCategoryForm ? '取消' : '新建分类'}
        </button>
      </div>

      {#if showNewCategoryForm}
        <div class="new-category-form">
          <input type="text" placeholder="分类名称" bind:value={newCategoryName} />
          <button
            class="create-button"
            on:click={handleCreateCategory}
            disabled={!newCategoryName.trim()}
          >
            创建
          </button>
        </div>
      {/if}

      <div class="categories-list">
        <label class="category-item">
          <input type="radio" name="category" value="" bind:group={selectedCategoryId} />
          <span class="category-name">无分类</span>
        </label>

        {#each categories as category}
          <div class="category-item">
            <label>
              <input
                type="radio"
                name="category"
                value={category.id}
                bind:group={selectedCategoryId}
              />
              <span class="category-name">{category.name}</span>
            </label>
            {#if category.id !== 'fiction' && category.id !== 'literature' && category.id !== 'history'}
              <button
                class="delete-category"
                on:click={() => handleDeleteCategory(category.id)}
                title="删除分类"
              >
                ×
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <footer class="modal-footer">
    <button class="cancel-button" on:click={() => dispatch('close')}>取消</button>
    <button class="save-button" on:click={handleSave}>保存</button>
  </footer>
</div>

<style>
  .category-manager {
    background: var(--background-primary);
    border-radius: var(--novel-radius-lg);
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--novel-shadow-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }

  .modal-header {
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--novel-font-size-lg);
    font-weight: 600;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - 40px);
  }

  .close-button {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: var(--novel-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--novel-transition-base);
    flex-shrink: 0;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-content {
    padding: var(--novel-spacing-md);
    flex: 1;
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--novel-spacing-md);
  }

  .section-header h4 {
    margin: 0;
    font-size: var(--novel-font-size-md);
    font-weight: 600;
    color: var(--text-normal);
  }

  .add-category-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-weight: 600;
    transition: all var(--novel-transition-base);
  }

  .add-category-button:hover {
    background: var(--interactive-accent-hover);
  }

  .new-category-form {
    display: flex;
    gap: var(--novel-spacing-sm);
    margin-bottom: var(--novel-spacing-md);
    padding: var(--novel-spacing-sm);
    background: var(--background-secondary);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--background-modifier-border);
  }

  .new-category-form input[type='text'] {
    flex: 1;
    padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    transition: all var(--novel-transition-base);
  }

  .new-category-form input[type='text']:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .create-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all var(--novel-transition-base);
  }

  .create-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .categories-list {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-sm);
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    transition: all var(--novel-transition-base);
  }

  .category-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .category-item label {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-sm);
    flex: 1;
    cursor: pointer;
  }

  .category-item input[type='radio'] {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: var(--interactive-accent);
  }

  .category-name {
    color: var(--text-normal);
    font-weight: 500;
    transition: color var(--novel-transition-base);
  }

  .category-item:hover .category-name {
    color: var(--interactive-accent);
  }

  .delete-category {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--novel-spacing-xs);
    font-size: 18px;
    border-radius: var(--novel-radius-sm);
    transition: all var(--novel-transition-base);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-category:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  .modal-footer {
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--novel-spacing-sm);
  }

  .cancel-button,
  .save-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    cursor: pointer;
    font-weight: 500;
    transition: all var(--novel-transition-base);
  }

  .cancel-button {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .cancel-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-muted);
  }

  .save-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
  }

  .save-button:hover {
    background: var(--interactive-accent-hover);
  }
</style>
