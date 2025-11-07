<script lang="ts">
	import {onMount} from 'svelte';
	import type {Novel} from '../types';
	import type {Shelf, Category} from '../types/shelf';

	export let novels: Novel[] = [];
	export let shelves: Shelf[] = [];
	export let categories: Category[] = [];
	export let onCreateShelf: (name: string) => Promise<void>;
	export let onUpdateShelf: (shelfId: string, updates: any) => Promise<void>;
	export let onDeleteShelf: (shelfId: string) => Promise<void>;
	export let onMoveBook: (novelId: string, shelfId: string) => Promise<void>;
	export let onRefresh: () => Promise<void>;

	let showNewShelfForm = false;
	let newShelfName = '';
	let selectedShelf: Shelf | null = null;
	let draggedNovel: Novel | null = null;

	// 获取书架中的图书数量
	function getBooksInShelf(shelfId: string): Novel[] {
		return novels.filter(novel => novel.shelfId === shelfId);
	}

	// 处理拖拽开始
	function handleDragStart(novel: Novel) {
		draggedNovel = novel;
	}

	// 处理拖拽结束
	function handleDrop(shelfId: string) {
		if (draggedNovel) {
			onMoveBook(draggedNovel.id, shelfId);
			draggedNovel = null;
		}
	}

	// 创建新书架
	async function handleCreateShelf() {
		if (newShelfName.trim()) {
			await onCreateShelf(newShelfName);
			newShelfName = '';
			showNewShelfForm = false;
		}
	}

	// 删除书架
	async function handleDeleteShelf(shelf: Shelf) {
		if (confirm(`确定要删除书架"${shelf.name}"吗？`)) {
			await onDeleteShelf(shelf.id);
		}
	}
</script>

<div class="collection-view">
	<div class="header">
		<h2>藏书管理</h2>
		<div class="actions">
			<button class="refresh-button" on:click={onRefresh}>
				<span class="refresh-icon">🔄</span>
				刷新
			</button>
			<button
				class="add-shelf-button"
				on:click={() => showNewShelfForm = !showNewShelfForm}
			>
				新建书架
			</button>
		</div>
	</div>

	{#if showNewShelfForm}
		<div class="new-shelf-form">
			<input
				type="text"
				bind:value={newShelfName}
				placeholder="输入书架名称"
			/>
			<button
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
	{/if}

	<div class="shelves-grid">
		{#each shelves as shelf}
			<div
				class="shelf-card"
				on:dragover|preventDefault
				on:drop|preventDefault={() => handleDrop(shelf.id)}
			>
				<div class="shelf-header">
					<h3>{shelf.name}</h3>
					<div class="shelf-actions">
                        <span class="book-count">
                            {getBooksInShelf(shelf.id).length} 本
                        </span>
						{#if !shelf.isDefault}
							<button
								class="delete-button"
								on:click={() => handleDeleteShelf(shelf)}
							>
								×
							</button>
						{/if}
					</div>
				</div>

				<div class="books-list">
					{#each getBooksInShelf(shelf.id) as novel}
						<div
							class="book-item"
							draggable="true"
							on:dragstart={() => handleDragStart(novel)}
						>
							<div class="book-info">
								<span class="book-title">{novel.title}</span>
								{#if novel.progress !== undefined}
									<span class="book-progress">{novel.progress}%</span>
								{/if}
							</div>
							{#if novel.tags?.length}
								<div class="book-tags">
									{#each novel.tags as tagId}
										<span class="tag">{tagId}</span>
									{/each}
								</div>
							{/if}
						</div>
					{/each}

					{#if getBooksInShelf(shelf.id).length === 0}
						<div class="empty-shelf">
							拖拽图书到此处
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.collection-view {
		padding: 20px;
		height: 100%;
		overflow-y: auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.actions {
		display: flex;
		gap: 12px;
	}

	.refresh-button,
	.add-shelf-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.refresh-button:hover,
	.add-shelf-button:hover {
		background: var(--background-modifier-hover);
	}

	.new-shelf-form {
		display: flex;
		gap: 8px;
		margin-bottom: 20px;
		padding: 16px;
		background: var(--background-secondary);
		border-radius: 8px;
	}

	.new-shelf-form input {
		flex: 1;
		padding: 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
	}

	.new-shelf-form button {
		padding: 8px 16px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
	}

	.new-shelf-form button:not(.cancel-button) {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.new-shelf-form .cancel-button {
		background: var(--background-modifier-error);
		color: white;
	}

	.new-shelf-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.shelves-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}

	.shelf-card {
		background: var(--background-secondary);
		border-radius: 8px;
		padding: 16px;
		min-height: 200px;
		display: flex;
		flex-direction: column;
	}

	.shelf-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.shelf-header h3 {
		margin: 0;
	}

	.shelf-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.book-count {
		font-size: 12px;
		color: var(--text-muted);
	}

	.delete-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		font-size: 16px;
	}

	.delete-button:hover {
		color: var(--text-error);
	}

	.books-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex: 1;
	}

	.book-item {
		padding: 8px;
		background: var(--background-primary);
		border-radius: 4px;
		cursor: move;
		transition: all 0.2s ease;
	}

	.book-item:hover {
		background: var(--background-modifier-hover);
		transform: translateY(-2px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.book-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.book-title {
		flex: 1;
		font-weight: 500;
	}

	.book-progress {
		font-size: 12px;
		color: var(--text-muted);
		padding: 2px 6px;
		background: var(--background-modifier-success);
		border-radius: 10px;
		color: white;
	}

	.book-tags {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 11px;
		padding: 2px 6px;
		background: var(--background-modifier-success);
		color: var(--text-on-accent);
		border-radius: 10px;
		opacity: 0.8;
	}

	.empty-shelf {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		border: 2px dashed var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
