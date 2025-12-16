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
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
    border: 2px solid var(--interactive-accent);
    overflow: hidden;
    animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    padding: 20px;
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-on-accent);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    max-width: calc(100% - 40px);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    font-size: 24px;
    cursor: pointer;
    color: var(--text-on-accent);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    backdrop-filter: blur(8px);
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: rotate(90deg) scale(1.1);
  }

  .modal-content {
    padding: 20px;
    flex: 1;
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .add-category-button {
    padding: var(--size-4-3) var(--size-4-5);
    border-radius: var(--radius-m);
    border: 2px solid var(--interactive-accent);
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    color: var(--text-on-accent);
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.2);
    transition: all 0.2s ease;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .add-category-button:hover {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .new-category-form {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--background-secondary);
    border-radius: 8px;
    border-left: 3px solid var(--interactive-accent);
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .new-category-form input[type='text'] {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    transition: all 0.2s ease;
  }

  .new-category-form input[type='text']:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
  }

  .create-button {
    padding: 8px 16px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .create-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .categories-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    border-radius: 8px;
    background: var(--background-secondary);
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
  }

  .category-item:hover {
    background: var(--background-primary-alt);
    border-left-color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .category-item label {
    display: flex;
    align-items: center;
    gap: 12px;
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
    transition: color 0.2s ease;
  }

  .category-item:hover .category-name {
    color: var(--interactive-accent);
  }

  .delete-category {
    background: rgba(var(--text-error-rgb), 0.1);
    border: none;
    color: var(--text-error);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 18px;
    border-radius: 4px;
    transition: all 0.2s ease;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-category:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
    transform: rotate(90deg) scale(1.1);
  }

  .modal-footer {
    padding: 16px 20px;
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .cancel-button,
  .save-button {
    padding: 8px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .cancel-button:hover {
    background: var(--background-primary-alt);
    border-color: var(--text-muted);
    transform: translateY(-1px);
  }

  .save-button {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    border: none;
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .save-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.4);
  }
</style>
