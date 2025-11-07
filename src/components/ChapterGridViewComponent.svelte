<script lang="ts">
	import {onMount} from 'svelte';
	import type {Novel} from '../types';
	import type { ChapterProgress} from "../types/txt/txt-reader";
	import type NovelReaderPlugin from "../main";

	export let novel: Novel | null = null;
	export let plugin: NovelReaderPlugin;
	export let title: string = '目录';
	export let chapters: ChapterProgress[] = [];

	export let onOpenNovel = async (novel: Novel, chapterId: number) => {
		console.log('[Component] Default onOpenNovel called', novel, chapterId);
	};

	function handleChapterSelect(chapter: ChapterProgress) {
		if (!novel) {
			console.error('[Component] Novel is null in handleChapterSelect');
			return;
		}

		console.log('[Component] handleChapterSelect called with:', {
			chapterId: chapter.id,
			chapterTitle: chapter.title,
			novel: novel.title
		});

		onOpenNovel(novel, chapter.id);
	}

	onMount(() => {
		console.log('[Component] Mounted with novel:', novel?.title);
		console.log('[Component] Chapters count:', chapters.length);
	});
</script>

<div class="chapter-grid-container">
	<header class="grid-header">
		<h2>{title}</h2>
	</header>

	<div class="chapter-grid">
		{#each chapters as chapter (chapter.id)}
			<button
				class="chapter-item"
				on:click|preventDefault|stopPropagation={() => handleChapterSelect(chapter)}
			>
				<span class="chapter-number">第{chapter.id}章</span>
				<span class="chapter-title">{chapter.title}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.chapter-grid-container {
		padding: 20px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.grid-header {
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.grid-header h2 {
		margin: 0;
		font-size: 24px;
		color: var(--text-normal);
	}

	.chapter-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr); /* 3列布局 */
		gap: 16px;
		padding: 16px;
	}

	.chapter-item {
		padding: 12px;
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		text-align: left;
		color: var(--text-normal);
		cursor: pointer;
		transition: all 0.2s;
		flex-direction: column;
		gap: 4px;
		min-height: 80px;
		display: block; /* 改变按钮的默认display行为 */
		white-space: nowrap; /* 防止文本换行 */
		overflow: hidden; /* 隐藏溢出的内容 */
		text-overflow: ellipsis; /* 显示省略号 */
	}

	.chapter-item:hover {
		background: var(--background-modifier-hover);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.chapter-number {
		font-size: 14px;
		color: var(--text-muted);
	}

	.chapter-title {
		font-size: 16px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
