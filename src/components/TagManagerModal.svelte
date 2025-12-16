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
		background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
		border-radius: var(--radius-xl);
		width: 100%;
		max-width: 520px;
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
		padding: var(--size-4-6) var(--size-4-8);
		border-bottom: 2px solid rgba(255, 255, 255, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
		position: relative;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.modal-header::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 0;
		background: none;
	}

	.modal-header h3 {
		margin: 0;
		font-size: var(--font-ui-larger);
		font-weight: 600;
		color: var(--text-on-accent);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: calc(100% - 40px);
	}

	.close-button {
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		font-size: 24px;
		cursor: pointer;
		color: var(--text-on-accent);
		padding: var(--size-4-2);
		border-radius: 50%;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		backdrop-filter: blur(8px);
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.4);
		transform: rotate(90deg) scale(1.1);
	}

	.modal-content {
		padding: var(--size-4-6);
		flex: 1;
		min-height: 200px;
		max-height: 500px;
		overflow-y: auto;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-4);
	}

	.section-header h4 {
		margin: 0;
		font-size: var(--font-ui-medium);
		font-weight: 600;
		color: var(--text-normal);
	}

	.add-tag-button {
		padding: var(--size-4-3) var(--size-4-5);
		border-radius: var(--radius-m);
		border: 2px solid var(--interactive-accent);
		background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: var(--font-ui-small);
		font-weight: 600;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.add-tag-button:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 6px 20px rgba(var(--interactive-accent-rgb), 0.4);
		border-color: transparent;
	}

	.new-tag-form {
		display: flex;
		gap: var(--size-4-3);
		margin-bottom: var(--size-4-4);
		padding: var(--size-4-5);
		background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%);
		border-radius: var(--radius-l);
		border: 2px solid var(--interactive-accent);
		box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.15);
		animation: slideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.new-tag-form input[type="text"] {
		flex: 1;
		padding: var(--size-4-2) var(--size-4-3);
		border-radius: var(--radius-s);
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		transition: all 0.2s;
	}

	.new-tag-form input[type="text"]:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
	}

	.new-tag-form input[type="color"] {
		width: 48px;
		height: 36px;
		padding: 4px;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		background: var(--background-primary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.new-tag-form input[type="color"]:hover {
		border-color: var(--interactive-accent);
		transform: scale(1.05);
	}

	.create-button {
		padding: var(--size-4-2) var(--size-4-4);
		border-radius: var(--radius-s);
		background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
		color: var(--text-on-accent);
		border: none;
		cursor: pointer;
		font-size: var(--font-ui-small);
		font-weight: 600;
		transition: all 0.2s;
		box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.create-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.3);
	}

	.create-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.create-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.tags-list {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.tag-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--size-4-3);
		border-radius: var(--radius-m);
		background: linear-gradient(135deg, var(--background-secondary), var(--background-primary));
		border: 1px solid var(--background-modifier-border);
		transition: all 0.2s;
		position: relative;
	}

	.tag-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--interactive-accent);
		opacity: 0;
		transition: opacity 0.2s;
		border-radius: var(--radius-m) 0 0 var(--radius-m);
	}

	.tag-item:hover {
		transform: translateX(4px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.tag-item:hover::before {
		opacity: 1;
	}

	.tag-checkbox {
		display: flex;
		align-items: center;
		gap: var(--size-4-3);
		cursor: pointer;
		flex: 1;
	}

	.tag-checkbox input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: var(--interactive-accent);
	}

	.tag-label {
		padding: var(--size-4-1) var(--size-4-3);
		border-radius: var(--radius-s);
		color: white;
		font-size: var(--font-ui-small);
		font-weight: 500;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: all 0.2s;
	}

	.tag-checkbox:hover .tag-label {
		transform: scale(1.05);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.delete-tag {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--size-4-2);
		font-size: 18px;
		border-radius: var(--radius-s);
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.delete-tag:hover {
		background-color: var(--background-modifier-error);
		color: var(--text-error);
		transform: scale(1.1) rotate(90deg);
	}

	.modal-footer {
		padding: var(--size-4-6);
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: flex-end;
		gap: var(--size-4-3);
		background: linear-gradient(135deg, var(--background-secondary), var(--background-primary));
	}

	.cancel-button,
	.save-button {
		padding: var(--size-4-2) var(--size-4-5);
		border-radius: var(--radius-s);
		cursor: pointer;
		font-size: var(--font-ui-small);
		font-weight: 600;
		transition: all 0.2s;
	}

	.cancel-button {
		background: none;
		border: 1px solid var(--background-modifier-border);
		color: var(--text-normal);
	}

	.cancel-button:hover {
		background-color: var(--background-modifier-hover);
		border-color: var(--text-muted);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.save-button {
		background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
		color: var(--text-on-accent);
		border: none;
		box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.2);
	}

	.save-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.3);
	}

	.save-button:active,
	.cancel-button:active {
		transform: translateY(0);
	}
</style>
