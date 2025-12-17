<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Novel } from '../types';
  import type { Tag } from '../types/shelf';

  export let novel: Novel;
  export let tags: Tag[] = [];
  export let selectedTags: string[] = [];

  const dispatch = createEventDispatcher();

  // 新标签的临时状态
  let newTagName = '';
  let newTagColor = '#757575';
  let showNewTagForm = false;

  // 处理选择标签
  function toggleTag(tagId: string) {
    if (selectedTags.includes(tagId)) {
      selectedTags = selectedTags.filter((id) => id !== tagId);
    } else {
      selectedTags = [...selectedTags, tagId];
    }
  }

  // 创建新标签
  function handleCreateTag() {
    if (!newTagName.trim()) return;

    dispatch('createTag', {
      name: newTagName,
      color: newTagColor,
    });

    newTagName = '';
    showNewTagForm = false;
  }

  // 保存更改
  function handleSave() {
    dispatch('save', {
      novelId: novel.id,
      tagIds: selectedTags,
    });
  }

  // 删除标签
  function handleDeleteTag(tagId: string) {
    dispatch('deleteTag', { tagId });
    // 从选中的标签中移除
    selectedTags = selectedTags.filter((id) => id !== tagId);
  }
</script>

<div class="tag-manager">
  <header class="modal-header">
    <h3>管理标签 - {novel.title}</h3>
    <button class="close-button" on:click={() => dispatch('close')}>×</button>
  </header>

  <div class="modal-content">
    <div class="tags-section">
      <div class="section-header">
        <h4>可用标签</h4>
        <button class="add-tag-button" on:click={() => (showNewTagForm = !showNewTagForm)}>
          {showNewTagForm ? '取消' : '新建标签'}
        </button>
      </div>

      {#if showNewTagForm}
        <div class="new-tag-form">
          <input type="text" placeholder="标签名称" bind:value={newTagName} />
          <input type="color" bind:value={newTagColor} />
          <button class="create-button" on:click={handleCreateTag} disabled={!newTagName.trim()}>
            创建
          </button>
        </div>
      {/if}

      <div class="tags-list">
        {#each tags as tag}
          <div class="tag-item">
            <label class="tag-checkbox">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.id)}
                on:change={() => toggleTag(tag.id)}
              />
              <span class="tag-label" style="background-color: {tag.color}">
                {tag.name}
              </span>
            </label>
            <button class="delete-tag" on:click={() => handleDeleteTag(tag.id)} title="删除标签">
              ×
            </button>
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
  .tag-manager {
    background: var(--background-primary);
    border-radius: var(--novel-radius-lg);
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--novel-shadow-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }

  .modal-header {
    padding: var(--novel-spacing-md);
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--background-secondary);
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
    padding: var(--novel-spacing-xs);
    border-radius: var(--novel-radius-sm);
    transition: all var(--novel-transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-content {
    padding: var(--novel-spacing-md);
    flex: 1;
    min-height: 200px;
    max-height: 500px;
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

  .add-tag-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: var(--novel-font-size-sm);
    font-weight: 600;
    transition: all var(--novel-transition-base);
  }

  .add-tag-button:hover {
    background: var(--interactive-accent-hover);
  }

  .new-tag-form {
    display: flex;
    gap: var(--novel-spacing-sm);
    margin-bottom: var(--novel-spacing-md);
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--background-modifier-border);
  }

  .new-tag-form input[type='text'] {
    flex: 1;
    padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    border: 1px solid var(--background-modifier-border);
    background-color: var(--background-primary);
    color: var(--text-normal);
    font-size: var(--novel-font-size-sm);
    transition: all var(--novel-transition-base);
  }

  .new-tag-form input[type='text']:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .new-tag-form input[type='color'] {
    width: 48px;
    height: 36px;
    padding: 4px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--novel-radius-sm);
    background: var(--background-primary);
    cursor: pointer;
    transition: all var(--novel-transition-base);
  }

  .new-tag-form input[type='color']:hover {
    border-color: var(--interactive-accent);
  }

  .create-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-size: var(--novel-font-size-sm);
    font-weight: 600;
    transition: all var(--novel-transition-base);
  }

  .create-button:hover:not(:disabled) {
    background: var(--interactive-accent-hover);
  }

  .create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tags-list {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-sm);
  }

  .tag-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    transition: all var(--novel-transition-base);
  }

  .tag-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .tag-checkbox {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-sm);
    cursor: pointer;
    flex: 1;
  }

  .tag-checkbox input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--interactive-accent);
  }

  .tag-label {
    padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    color: white;
    font-size: var(--novel-font-size-sm);
    font-weight: 500;
    transition: all var(--novel-transition-base);
  }

  .delete-tag {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--novel-spacing-xs);
    font-size: 18px;
    border-radius: var(--novel-radius-sm);
    transition: all var(--novel-transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
  }

  .delete-tag:hover {
    background-color: var(--background-modifier-error);
    color: var(--text-error);
  }

  .modal-footer {
    padding: var(--novel-spacing-md);
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--novel-spacing-sm);
    background: var(--background-secondary);
  }

  .cancel-button,
  .save-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    cursor: pointer;
    font-size: var(--novel-font-size-sm);
    font-weight: 600;
    transition: all var(--novel-transition-base);
  }

  .cancel-button {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .cancel-button:hover {
    background-color: var(--background-modifier-hover);
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
