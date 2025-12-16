<script lang="ts">
	import {createEventDispatcher, onMount} from 'svelte';
	import type NovelReaderPlugin from '../../main';
	import type { Novel } from '../../types';
	import type { ChapterProgress} from "../../types/txt/txt-reader";
	import {parseChapters} from "../../lib/txt.reader/chapter-logic";
	import { icons } from '../library/icons';

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let content: string = '';

	let customPattern = '';
	let activeSettingTab = 'pattern';
	let currentChapter: ChapterProgress | null = null;
	let showSettings = false;

	onMount(() => {
		if (novel.customSettings?.chapterPattern) {
			customPattern = novel.customSettings.chapterPattern;
			console.log('Loading saved pattern:', customPattern);
		}
	})

	$: {
		if (novel.customSettings?.chapterPattern) {
			customPattern = novel.customSettings.chapterPattern;
		}
	}

	function handleSavePattern() {
		if (!customPattern.trim()) return;

		try {
			// 测试正则是否有效
			new RegExp(customPattern);

			// 正确构建更新对象
			const updatedNovel: Novel = {
				...novel,
				customSettings: {
					...novel.customSettings,
					chapterPattern: customPattern.trim()  // 确保去除空格
				}
			};

			// 使用新正则解析章节
			const newChapters = parseChapters(content, updatedNovel);

			if (newChapters.length > 0) {
				// 向父组件派发事件，传递完整的更新对象
				dispatch('savePattern', {
					novel: updatedNovel,  // 确保传递完整的updatedNovel
					chapters: newChapters
				});

				console.log('Dispatching updated novel with pattern:', updatedNovel.customSettings?.chapterPattern);
			} else {
				throw new Error('无法解析出章节');
			}
		} catch (error) {
			console.error('Error saving pattern:', error);
			throw error;
		}
	}

	function clearPattern() {
		customPattern = '';
		novel.customSettings = {
			...novel.customSettings,
			chapterPattern: undefined
		};

		// 使用默认正则重新解析
		const newChapters = parseChapters(content, novel);
		currentChapter = newChapters[0];

		// 触发保存事件
		dispatch('savePattern', {novel});

		// 触发章节更新事件
		window.dispatchEvent(new CustomEvent('chaptersUpdated', {
			detail: {chapters: newChapters}
		}));

		showSettings = false;
	}
</script>

<div class="txt-settings">
	<div class="settings-nav">
		<button
			class="nav-item"
			class:active={activeSettingTab === 'pattern'}
			on:click={() => activeSettingTab = 'pattern'}
		>
			<span class="nav-icon">{@html icons.note}</span>
			章节解析
		</button>
	</div>

	<div class="settings-main">
		{#if activeSettingTab === 'pattern'}
			<div class="settings-section">
				<div class="section-header">
					<h4>章节解析设置</h4>
					<p class="section-desc">设置自定义的章节解析规则</p>
				</div>

				<div class="form-group">
					<label for="pattern">正则表达式</label>
					<div class="pattern-input">
						<input
							id="pattern"
							type="text"
							bind:value={customPattern}
							placeholder="输入自定义章节解析正则表达式"
						/>
						<div class="button-group">
							<button class="save-button" on:click={handleSavePattern}>
								<span class="button-icon">✓</span>
								保存
							</button>
							{#if customPattern}
								<button class="delete-button" on:click={clearPattern}>
									<span class="button-icon">✕</span>
									删除
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.txt-settings {
		display: flex;
		flex: 1;
		min-height: 0;
		background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
	}

	.settings-section {
		max-width: 600px;
		margin: 0 auto;
		background: var(--background-secondary);
		padding: 24px;
		border-radius: 12px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
		border-left: 4px solid var(--interactive-accent);
	}

	.section-header {
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 2px solid var(--background-modifier-border);
	}

	.section-header h4 {
		margin: 0 0 8px 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-normal);
		background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.section-desc {
		margin: 0;
		color: var(--text-muted);
		font-size: 14px;
		font-weight: 500;
	}

	.form-group {
		margin-bottom: 24px;
	}

	.form-group label {
		display: block;
		margin-bottom: 12px;
		font-weight: 600;
		color: var(--text-normal);
		font-size: 15px;
	}

	.pattern-input {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.pattern-input input {
		padding: 12px 16px;
		border-radius: 8px;
		border: 2px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: 14px;
		font-family: 'Courier New', monospace;
		transition: all 0.2s ease;
	}

	.pattern-input input:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
	}

	.button-group {
		display: flex;
		gap: 12px;
	}

	.save-button,
	.delete-button {
		padding: 10px 20px;
		border-radius: 8px;
		border: none;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		transition: all 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.save-button {
		background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
		color: var(--text-on-accent);
	}

	.save-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.4);
	}

	.delete-button {
		background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
		color: white;
	}

	.delete-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
	}

	.button-icon {
		font-size: 16px;
		font-weight: bold;
	}

	.settings-nav {
		width: 220px;
		padding: 20px 0;
		border-right: 2px solid var(--background-modifier-border);
		background: var(--background-secondary);
	}

	.nav-item {
		width: 100%;
		padding: 14px 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--text-muted);
		font-size: 15px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
	}

	.nav-item:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
		border-left-color: var(--interactive-accent);
		transform: translateX(4px);
	}

	.nav-item.active {
		background: linear-gradient(90deg, rgba(var(--interactive-accent-rgb), 0.15) 0%, transparent 100%);
		color: var(--interactive-accent);
		border-left-color: var(--interactive-accent);
		font-weight: 600;
	}

	.nav-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
	}

	.nav-item:hover .nav-icon,
	.nav-item.active .nav-icon {
		transform: scale(1.1);
	}

	.nav-icon :global(svg) {
		width: 18px;
		height: 18px;
		stroke: currentColor;
	}

	.settings-main {
		flex: 1;
		padding: 32px;
		overflow-y: auto;
	}
</style>
