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
			selectedTags = selectedTags.filter(id => id !== tagId);
		} else {
			selectedTags = [...selectedTags, tagId];
		}
	}

	// 创建新标签
	function handleCreateTag() {
		if (!newTagName.trim()) return;

		dispatch('createTag', {
			name: newTagName,
			color: newTagColor
		});

		newTagName = '';
		showNewTagForm = false;
	}

	// 保存更改
	function handleSave() {
		dispatch('save', {
			novelId: novel.id,
			tagIds: selectedTags
		});
	}

	// 删除标签
	function handleDeleteTag(tagId: string) {
		dispatch('deleteTag', { tagId });
		// 从选中的标签中移除
		selectedTags = selectedTags.filter(id => id !== tagId);
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
				<button
					class="add-tag-button"
					on:click={() => showNewTagForm = !showNewTagForm}
				>
					{showNewTagForm ? '取消' : '新建标签'}
				</button>
			</div>

			{#if showNewTagForm}
				<div class="new-tag-form">
					<input
						type="text"
						placeholder="标签名称"
						bind:value={newTagName}
					/>
					<input
						type="color"
						bind:value={newTagColor}
					/>
					<button
						class="create-button"
						on:click={handleCreateTag}
						disabled={!newTagName.trim()}
					>
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
							<span
								class="tag-label"
								style="background-color: {tag.color}"
							>
                                {tag.name}
                            </span>
						</label>
						<button
							class="delete-tag"
							on:click={() => handleDeleteTag(tag.id)}
							title="删除标签"
						>
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
		border-radius: 8px;
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 18px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: calc(100% - 40px);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: var(--text-muted);
	}

	.modal-content {
		padding: 16px;
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
	}

	.add-tag-button {
		padding: 4px 12px;
		border-radius: 16px;
		border: 1px solid var(--interactive-accent);
		background: none;
		color: var(--interactive-accent);
		cursor: pointer;
	}

	.new-tag-form {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		padding: 8px;
		background: var(--background-secondary);
		border-radius: 4px;
	}

	.new-tag-form input[type="text"] {
		flex: 1;
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
	}

	.new-tag-form input[type="color"] {
		width: 40px;
		padding: 0;
		border: none;
		background: none;
	}

	.create-button {
		padding: 4px 12px;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		cursor: pointer;
	}

	.create-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tags-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.tag-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px;
		border-radius: 4px;
		background: var(--background-secondary);
	}

	.tag-checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.tag-label {
		padding: 2px 8px;
		border-radius: 12px;
		color: white;
		font-size: 12px;
	}

	.delete-tag {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0 4px;
		font-size: 16px;
	}

	.delete-tag:hover {
		color: var(--text-error);
	}

	.modal-footer {
		padding: 16px;
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.cancel-button,
	.save-button {
		padding: 6px 16px;
		border-radius: 4px;
		cursor: pointer;
	}

	.cancel-button {
		background: none;
		border: 1px solid var(--background-modifier-border);
	}

	.save-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
	}
</style>
