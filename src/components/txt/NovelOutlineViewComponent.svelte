<script lang="ts">
	import {onMount, afterUpdate} from 'svelte';

	export let chapters: Array<{ id: number, title: string }> = [];
	export let currentChapterId: number | null = null;
	export let onChapterSelect: (chapterId: number) => void;

	let searchQuery = '';
	let chaptersListContainer: HTMLElement;
	let chapterElements: Map<number, HTMLElement> = new Map();

	$: filteredChapters = chapters.filter(chapter =>
		chapter.title.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// 当前章节ID改变时滚动
	$: if (currentChapterId !== null) {
		afterUpdate(() => {
			scrollToActiveChapter();
		});
	}

	onMount(() => {
		if (currentChapterId !== null) {
			scrollToActiveChapter();
		}
	});

	function scrollToActiveChapter() {
		if (!chaptersListContainer || currentChapterId === null) return;

		const activeElement = chapterElements.get(currentChapterId);
		if (!activeElement) return;

		const containerHeight = chaptersListContainer.clientHeight;
		const elementOffset = activeElement.offsetTop;
		const elementHeight = activeElement.clientHeight;

		const scrollPosition = elementOffset - (containerHeight / 2) + (elementHeight / 2);

		chaptersListContainer.scrollTo({
			top: scrollPosition,
			behavior: 'smooth'
		});
	}

	function setChapterElement(node: HTMLElement, id: number) {
		chapterElements.set(id, node);
		return {
			destroy() {
				chapterElements.delete(id);
			}
		};
	}
</script>

<div class="outline-container">
	<div class="search-box">
		<input
			type="text"
			placeholder="搜索章节..."
			bind:value={searchQuery}
			class="search-input"
		/>
	</div>

	<div class="chapters-list" bind:this={chaptersListContainer}>
		{#each filteredChapters as chapter (chapter.id)}
			<div
				class="chapter-item"
				class:active={currentChapterId === chapter.id}
				use:setChapterElement={chapter.id}
				on:click={() => onChapterSelect(chapter.id)}
			>
				{chapter.title}
			</div>
		{/each}

		{#if filteredChapters.length === 0}
			<div class="no-results">
				没有找到匹配的章节
			</div>
		{/if}
	</div>
</div>

<style>
	.outline-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--background-primary);
	}

	.search-box {
		padding: 8px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.search-input {
		width: 100%;
		padding: 6px 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--interactive-accent);
	}

	.chapters-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth;
	}

	.chapter-item {
		padding: 6px 8px;
		margin-bottom: 4px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--text-normal);
		transition: background-color 0.2s;
	}

	.chapter-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.chapter-item.active {
		background-color: var(--background-modifier-active);
		color: var(--text-accent);
		font-weight: 500;
	}

	.no-results {
		padding: 16px;
		text-align: center;
		color: var(--text-muted);
	}
</style>
