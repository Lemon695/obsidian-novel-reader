<script lang="ts">
	import {createEventDispatcher} from 'svelte';
	import type {Novel} from '../types';
	import type {Category} from '../types/shelf';

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
			name: newCategoryName
		});

		newCategoryName = '';
		showNewCategoryForm = false;
	}

	// 保存更改
	function handleSave() {
		dispatch('save', {
			novelId: novel.id,
			categoryId: selectedCategoryId || null
		});
	}

	// 删除分类
	function handleDeleteCategory(categoryId: string) {
		if (confirm('确定要删除这个分类吗？')) {
			dispatch('deleteCategory', {categoryId});
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
					on:click={() => showNewCategoryForm = !showNewCategoryForm}
				>
					{showNewCategoryForm ? '取消' : '新建分类'}
				</button>
			</div>

			{#if showNewCategoryForm}
				<div class="new-category-form">
					<input
						type="text"
						placeholder="分类名称"
						bind:value={newCategoryName}
					/>
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
					<input
						type="radio"
						name="category"
						value=""
						bind:group={selectedCategoryId}
					/>
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

	.add-category-button {
		padding: 4px 12px;
		border-radius: 16px;
		border: 1px solid var(--interactive-accent);
		background: none;
		color: var(--interactive-accent);
		cursor: pointer;
	}

	.new-category-form {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		padding: 8px;
		background: var(--background-secondary);
		border-radius: 4px;
	}

	.new-category-form input[type="text"] {
		flex: 1;
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
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

	.categories-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.category-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px;
		border-radius: 4px;
		background: var(--background-secondary);
	}

	.category-item label {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		cursor: pointer;
	}

	.category-name {
		color: var(--text-normal);
	}

	.delete-category {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0 4px;
		font-size: 16px;
	}

	.delete-category:hover {
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
