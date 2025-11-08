<script lang="ts">
	import {onMount} from 'svelte';
	import type {Novel} from '../types';
	import type {Shelf, Category} from '../types/shelf';
	import {icons} from './library/icons';

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
				<span class="refresh-icon">{@html icons.refresh}</span>
				刷新
			</button>
			<button
				class="add-shelf-button"
				on:click={() => showNewShelfForm = !showNewShelfForm}
			>
				<span class="icon">{@html icons.plus}</span>
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
		padding: var(--novel-spacing-md);
		height: 100%;
		overflow-y: auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--novel-spacing-lg);
	}

	.header h2 {
		font-size: var(--novel-font-size-xl);
		font-weight: 600;
		color: var(--text-normal);
		margin: 0;
	}

	.actions {
		display: flex;
		gap: var(--novel-spacing-sm);
	}

	.refresh-button,
	.add-shelf-button {
		display: flex;
		align-items: center;
		gap: var(--novel-spacing-xs);
		padding: var(--novel-spacing-sm) var(--novel-spacing-md);
		border-radius: 20px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		cursor: pointer;
		font-size: var(--novel-font-size-base);
		transition: all 0.2s;
	}

	.refresh-button:hover,
	.add-shelf-button:hover {
		background: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.refresh-button:active .refresh-icon svg {
		animation: spin 0.5s ease-in-out;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.new-shelf-form {
		display: flex;
		gap: var(--novel-spacing-xs);
		margin-bottom: var(--novel-spacing-md);
		padding: var(--novel-spacing-md);
		background: var(--background-secondary);
		border-radius: var(--novel-radius-md);
	}

	.new-shelf-form input {
		flex: 1;
		padding: var(--novel-spacing-sm);
		border-radius: var(--novel-radius-sm);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: var(--novel-font-size-base);
		transition: all 0.2s;
	}

	.new-shelf-form input:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}

	.new-shelf-form button {
		padding: var(--novel-spacing-sm) var(--novel-spacing-md);
		border-radius: var(--novel-radius-sm);
		border: none;
		cursor: pointer;
		font-size: var(--novel-font-size-base);
		transition: all 0.2s;
	}

	.new-shelf-form button:not(.cancel-button) {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.new-shelf-form button:not(.cancel-button):hover {
		background: var(--interactive-accent-hover);
	}

	.new-shelf-form .cancel-button {
		background: var(--background-modifier-error);
		color: white;
	}

	.new-shelf-form .cancel-button:hover {
		opacity: 0.9;
	}

	.new-shelf-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.shelves-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--novel-spacing-md);
	}

	.shelf-card {
		background: var(--background-secondary);
		border-radius: var(--novel-radius-md);
		padding: var(--novel-spacing-md);
		min-height: 200px;
		display: flex;
		flex-direction: column;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.shelf-card:hover {
		border-color: var(--background-modifier-border);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.shelf-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--novel-spacing-md);
	}

	.shelf-header h3 {
		margin: 0;
		font-size: var(--novel-font-size-md);
		font-weight: 500;
	}

	.shelf-actions {
		display: flex;
		align-items: center;
		gap: var(--novel-spacing-xs);
	}

	.book-count {
		font-size: var(--novel-font-size-sm);
		color: var(--text-muted);
		background: var(--background-primary);
		padding: 2px var(--novel-spacing-xs);
		border-radius: var(--novel-radius-sm);
	}

	.delete-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--novel-spacing-xs);
		font-size: 18px;
		line-height: 1;
		transition: all 0.2s;
		border-radius: var(--novel-radius-sm);
	}

	.delete-button:hover {
		color: var(--text-error);
		background: var(--background-modifier-hover);
	}

	.books-list {
		display: flex;
		flex-direction: column;
		gap: var(--novel-spacing-xs);
		flex: 1;
	}

	.book-item {
		padding: var(--novel-spacing-sm);
		background: var(--background-primary);
		border-radius: var(--novel-radius-sm);
		cursor: move;
		transition: all 0.2s ease;
		border: 1px solid transparent;
	}

	.book-item:hover {
		background: var(--background-modifier-hover);
		transform: translateY(-2px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		border-color: var(--background-modifier-border);
	}

	.book-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--novel-spacing-xs);
	}

	.book-title {
		flex: 1;
		font-weight: 500;
		font-size: var(--novel-font-size-base);
		color: var(--text-normal);
	}

	.book-progress {
		font-size: var(--novel-font-size-sm);
		color: white;
		padding: 2px var(--novel-spacing-xs);
		background: var(--interactive-accent);
		border-radius: 10px;
	}

	.book-tags {
		display: flex;
		gap: var(--novel-spacing-xs);
		flex-wrap: wrap;
	}

	.tag {
		font-size: var(--novel-font-size-sm);
		padding: 2px var(--novel-spacing-xs);
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
		padding: var(--novel-spacing-lg);
		border: 2px dashed var(--background-modifier-border);
		border-radius: var(--novel-radius-sm);
		color: var(--text-muted);
		font-size: var(--novel-font-size-base);
	}

	/* SVG图标样式 */
	.refresh-icon svg,
	.icon svg {
		display: inline-block;
		vertical-align: middle;
		width: 16px;
		height: 16px;
		stroke: currentColor;
		fill: none;
	}
</style>
