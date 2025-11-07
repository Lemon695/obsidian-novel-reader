<script lang="ts">
	import {onMount, onDestroy, createEventDispatcher} from 'svelte';

	const dispatch = createEventDispatcher();

	export let novelId: string = '';
	export let chapterId: number = 0;

	let menuPosition = {x: 0, y: 0};
	let showMenu = false;
	let selectedText = '';
	let textIndex = 0;
	let currentLineNumber = 0; // 添加行号记录

	let isActive = false; // 添加活跃状态标志

	function handleMouseUp(event: MouseEvent) {
		// 只在组件激活时处理事件
		if (!isActive) return;

		const selection = window.getSelection();
		let text = selection?.toString() || '';
		console.log('handleMouseUp---', text)
		if (!selection || selection.toString().length === 0) {
			if (!(event.target instanceof HTMLElement) || !event.target.closest('.selection-menu')) {
				showMenu = false;
			}
			return;
		}

		selectedText = selection.toString();

		// 获取选中文本的容器
		const container = selection.anchorNode?.parentElement;
		if (!container) return;

		// 计算行号
		const paragraphs = document.querySelectorAll('.content-text p');
		currentLineNumber = Array.from(paragraphs).findIndex(p => p.contains(container));
		console.log('Selected text at line:', currentLineNumber); // 调试日志

		// 计算在当前行中的文本偏移
		const range = selection.getRangeAt(0);
		const textBeforeSelection = range.startContainer.textContent?.substring(0, range.startOffset) || '';
		textIndex = textBeforeSelection.length;

		menuPosition = {
			x: event.pageX,
			y: event.pageY
		};
		showMenu = true;
	}

	function handleContextMenu(event: MouseEvent) {
		if (!selectedText) return;
		event.preventDefault();

		menuPosition = {
			x: event.pageX,
			y: event.pageY
		};
		showMenu = true;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.selection-menu')) {
			showMenu = false;
		}
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(selectedText);
			showMenu = false;
			selectedText = '';
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	}

	function handleAddNote() {
		if (!selectedText) return;  // 确保有选中的文本

		dispatch('addNote', {
			selectedText,
			textIndex,
			lineNumber: currentLineNumber,
			chapterId
		});

		// 重置状态
		selectedText = '';
		showMenu = false;
	}

	onMount(() => {
		// 获取父级阅读器容器 (指定激活页面-激活监控)
		const readerContainer = document.querySelector('.novel-reader');
		if (readerContainer) {
			// 监听焦点事件
			readerContainer.addEventListener('mouseenter', () => {
				isActive = true;
			});
			readerContainer.addEventListener('mouseleave', () => {
				isActive = false;
			});
		}

		document.addEventListener('mouseup', handleMouseUp);
		document.addEventListener('contextmenu', handleContextMenu);
		document.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		//指定激活页面-激活监控
		const readerContainer = document.querySelector('.novel-reader');
		if (readerContainer) {
			readerContainer.removeEventListener('mouseenter', () => {
				isActive = true;
			});
			readerContainer.removeEventListener('mouseleave', () => {
				isActive = false;
			});
		}

		document.removeEventListener('mouseup', handleMouseUp);
		document.removeEventListener('contextmenu', handleContextMenu);
		document.removeEventListener('click', handleClickOutside);
	});
</script>

{#if showMenu}
	<div
		class="selection-menu"
		style="left: {menuPosition.x}px; top: {menuPosition.y}px"
	>
		<button class="menu-item" on:click={handleCopy}>
			复制
		</button>
		<button class="menu-item" on:click={handleAddNote}>
			添加笔记
		</button>
	</div>
{/if}

<style>
	.selection-menu {
		position: fixed;
		z-index: 1000;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 4px;
		transform: translate(-50%, -50%);
	}

	.menu-item {
		display: block;
		padding: 6px 12px;
		min-width: 100px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-normal);
		font-size: 14px;
		border-radius: 4px;
		text-align: left;
		width: 100%;
		transition: background-color 0.2s;
	}

	.menu-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.menu-item + .menu-item {
		margin-top: 2px;
	}
</style>
