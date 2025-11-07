<script lang="ts">
	import type {Novel} from '../../types';
	import type {Tag} from '../../types/shelf';
	import {createEventDispatcher} from 'svelte';

	const dispatch = createEventDispatcher();

	export let novel: Novel;
	export let tags: Tag[] = [];

	let showMenu = false;
	let menuPosition: { top: number; left: number; } | null = null;

	function handleTagClick(tagId: string, event: MouseEvent) {
		event.stopPropagation();
		dispatch('tagClick', {tagId});
	}

	function handleMenuClick(event: MouseEvent) {
		event.stopPropagation();
		const button = event.currentTarget as HTMLElement;
		const rect = button.getBoundingClientRect();

		menuPosition = {
			top: rect.bottom + window.scrollY,
			left: rect.left + window.scrollX
		};

		showMenu = !showMenu;
	}

	// 获取标签颜色
	function getTagStyle(tagId: string): string {
		const tag = tags.find(t => t.id === tagId);
		return tag?.color ? `background-color: ${tag.color};` : '';
	}

	// 移动到书架
	function moveToShelf(shelfId: string) {
		dispatch('moveToShelf', {novelId: novel.id, shelfId});
		showMenu = false;
	}

	// 管理标签
	function manageTags() {
		dispatch('manageTags', {novelId: novel.id});
		showMenu = false;
	}
</script>

<div class="book-card">
	<!-- 现有的封面和标题部分 -->
	<div class="book-cover">
		{#if novel.cover}
			<img src={novel.cover} alt={novel.title}/>
		{:else}
			<div class="default-cover">📚</div>
		{/if}
	</div>

	<div class="book-info">
		<h3 class="book-title">{novel.title}</h3>

		<!-- 标签显示区域 -->
		{#if novel.tags && novel.tags?.length > 0}
			<div class="book-tags">
				{#each novel.tags as tagId}
					{#if tags.find(t => t.id === tagId)}
                        <span
							class="tag"
							style={getTagStyle(tagId)}
							on:click={(e) => handleTagClick(tagId, e)}
						>
                            {tags.find(t => t.id === tagId)?.name}
                        </span>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- 菜单按钮 -->
		<button class="menu-button" on:click={handleMenuClick}>
			•••
		</button>

		<!-- 菜单面板 -->
		{#if showMenu && menuPosition}
			<div
				class="menu-panel"
				style="top: {menuPosition.top}px; left: {menuPosition.left}px;"
			>
				<div class="menu-item" on:click={() => manageTags()}>
					管理标签
				</div>
				<div class="menu-section">
					移动到书架
					<div class="shelf-submenu">
						<div class="menu-item" on:click={() => moveToShelf('reading')}>
							在读
						</div>
						<div class="menu-item" on:click={() => moveToShelf('toread')}>
							待读
						</div>
						<div class="menu-item" on:click={() => moveToShelf('finished')}>
							已读
						</div>
						<div class="menu-item" on:click={() => moveToShelf('archived')}>
							归档
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.book-card {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		background: var(--background-secondary);
		transition: transform 0.2s;
	}

	.book-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 4px;
	}

	.tag {
		font-size: 12px;
		padding: 2px 6px;
		border-radius: 12px;
		background: var(--background-modifier-accent);
		color: var(--text-muted);
		cursor: pointer;
		transition: transform 0.1s;
	}

	.tag:hover {
		transform: scale(1.05);
	}

	.menu-button {
		position: absolute;
		top: 8px;
		right: 8px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.menu-panel {
		position: fixed;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		min-width: 150px;
	}

	.menu-item {
		padding: 8px 12px;
		cursor: pointer;
	}

	.menu-item:hover {
		background: var(--background-modifier-hover);
	}

	.menu-section {
		padding: 8px 12px;
		border-top: 1px solid var(--background-modifier-border);
	}

	.shelf-submenu {
		margin-top: 4px;
		border-left: 2px solid var(--background-modifier-border);
		margin-left: 4px;
	}

	.shelf-submenu .menu-item {
		padding-left: 16px;
	}

	.book-cover {
		aspect-ratio: 3/4;
		position: relative;
		overflow: hidden;
	}

	.book-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.default-cover {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background-modifier-form-field);
		font-size: 2em;
	}

	.book-info {
		padding: 12px;
		position: relative;
	}

	.book-title {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.4;
		margin-right: 24px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-section {
		padding: 8px 12px;
		border-top: 1px solid var(--background-modifier-border);
	}

	.shelf-submenu {
		margin-top: 4px;
		border-left: 2px solid var(--background-modifier-border);
		margin-left: 4px;
	}

	.shelf-submenu .menu-item {
		padding-left: 16px;
	}

	.menu-panel {
		position: absolute;
		top: 100%;
		right: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		min-width: 150px;
		margin-top: 4px;
	}

	.menu-item {
		padding: 8px 12px;
		cursor: pointer;
		color: var(--text-normal);
		transition: background-color 0.2s;
	}

	.menu-item:hover {
		background-color: var(--background-modifier-hover);
	}
</style>
