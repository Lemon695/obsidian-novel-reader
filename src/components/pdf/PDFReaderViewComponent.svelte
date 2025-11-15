<script lang="ts">
	import {onMount, createEventDispatcher, onDestroy} from 'svelte';
	import {fade} from 'svelte/transition';
	import * as pdfjs from 'pdfjs-dist';
	import type {PDFDocumentProxy, PDFPageProxy} from 'pdfjs-dist';
	import type NovelReaderPlugin from "../../main";
	import type {Novel} from "../../types";
	import {TFile} from "obsidian";
	import ReaderSettingsMenu from '../setting/ReaderSettingsMenu.svelte';
	import type {ChapterHistory} from "../../types/reading-stats";
	import {handleChapterChange} from "../../lib/txt.reader/chapter-logic";
	import { icons } from '../library/icons';
	import LoadingSpinner from '../LoadingSpinner.svelte';

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
	export let initialPage: number;

	let pdfDoc: PDFDocumentProxy | null = null;
	let zoomLevel = 1.5;
	let isLoading = true;
	let numPages = 1; //总页数
	let currentPage: number; //当前页
	let readerContainer: HTMLElement | null = null;
	let showingCoverPage = true;
	let pageInputValue = '1';
	let showPageInput = false;
	let outlines: any[] = []; //PDF大纲数据
	let isActive = false;
	let chapterHistory: ChapterHistory[] = []; //章节历史记录
	let currentChapter: any = null;
	let pendingRender = false;
	let containerInitialized = false;

	// hover模式相关状态
	let isMenuVisible = false;

	// PDF 悬浮目录：目录/页码切换功能
	// 'chapters' = 显示目录，'pages' = 显示页码列表
	let viewMode: 'chapters' | 'pages' = 'chapters';

	// 从 novel.customSettings 读取用户偏好
	$: {
		if (novel?.customSettings?.pdfViewMode) {
			viewMode = novel.customSettings.pdfViewMode;
		} else {
			// 优先显示目录，如果没有目录则显示页码
			viewMode = chapters.length > 0 ? 'chapters' : 'pages';
		}
	}

	$: currentPage = showingCoverPage ? 1 : currentPage;

	let pageState = {
		currentPage,
		showingCoverPage
	};

	// 创建响应式声明
	$: pageState = {
		currentPage,
		showingCoverPage
	};

	$: currentChapterIndex = getCurrentChapter(currentPage);

	// 为每个章节创建一个活动状态的映射
	$: chapterActiveStates = chapters.map((chapter, index) => {
		console.log('3. Computing active state for chapter:', chapter.title);
		return index === currentChapterIndex;
	});

	// 章节大纲数据
	let chapters: Array<{
		title: string;
		startPage: number;
		endPage: number | null;
		subChapters?: Array<{
			title: string;
			startPage: number;
			endPage: number | null;
		}>;
	}> = [];

	let notes: any[] = []; // 笔记
	let readingStats: any = null; // 阅读状态

	async function initializePDF() {
		pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

		try {
			if (!plugin || !novel) {
				throw new Error('Plugin or novel not initialized');
			}

			const file = plugin.app.vault.getAbstractFileByPath(novel.path);
			if (!(file instanceof TFile)) {
				throw new Error('PDF file not found');
			}

			const arrayBuffer = await plugin.contentLoaderService.loadPdfContent(file);
			pdfDoc = await pdfjs.getDocument(arrayBuffer).promise;

			numPages = pdfDoc.numPages;
			// 如果有初始页码，使用它，否则使用第1页
			currentPage = initialPage || 1;
			console.log("Setting initial page to:", currentPage);

			// 确保页码在有效范围内
			if (currentPage < 1) currentPage = 1;
			if (currentPage > numPages) currentPage = numPages;

			// 获取大纲
			outlines = await pdfDoc.getOutline() || [];
			await processOutlines(outlines);
			console.log('processOutlines---' + JSON.stringify(chapters))

			// 获取保存的阅读进度
			const progress = await plugin.libraryService.getProgress(novel.id);
			if (progress?.position?.page) {
				currentPage = progress.position.page;
				showingCoverPage = false;
			}

			// 如果容器已经准备好，直接渲染
			if (readerContainer) {
				await renderPage('initializePDF');
			} else {
				pendingRender = true;  // 标记需要渲染
			}

			isLoading = false;
		} catch (error) {
			console.error('Error loading PDF:', error);
			isLoading = false;
		}
	}

	async function processOutlines(outlines: any[], level: number = 0): Promise<void> {
		if (outlines && pdfDoc) {
			// 检查第一个章节是否从第1页开始
			let firstChapterStartPage = -1;
			if (outlines.length > 0 && outlines[0].dest) {
				firstChapterStartPage = await pdfDoc.getPageIndex(outlines[0].dest[0]) + 1;
			}

			// 如果第一个章节不是从第1页开始，添加"首页"章节
			if (firstChapterStartPage > 1) {
				chapters.push({
					title: '首页',
					startPage: 1,
					endPage: firstChapterStartPage - 1,
					subChapters: []
				});
			}

			for (const item of outlines) {
				const startPageIndex = item.dest ? await pdfDoc.getPageIndex(item.dest[0]) : null;

				if (startPageIndex !== null) {
					const chapter = {
						title: item.title || `章节`,
						startPage: startPageIndex + 1,
						endPage: null,
						subChapters: [] as Array<{ title: string, startPage: number, endPage: number | null }>
					};

					if (item.items) {
						for (const subItem of item.items) {
							const subStartPageIndex = subItem.dest ? await pdfDoc.getPageIndex(subItem.dest[0]) : null;
							if (subStartPageIndex !== null) {
								chapter.subChapters?.push({
									title: subItem.title || `子章节`,
									startPage: subStartPageIndex + 1,
									endPage: null
								});
							}
						}
					}

					chapters.push(chapter);
				}
			}

			// 更新章节结束页
			for (let i = 0; i < chapters.length - 1; i++) {
				chapters[i].endPage = chapters[i + 1].startPage - 1;

				// 更新子章节结束页
				if (chapters[i].subChapters) {
					for (let j = 0; j < chapters[i].subChapters!.length - 1; j++) {
						chapters[i].subChapters![j].endPage = chapters[i].subChapters![j + 1].startPage - 1;
					}
					// 最后一个子章节的结束页是下一个主章节的起始页减1
					const lastSubChapter = chapters[i].subChapters![chapters[i].subChapters!.length - 1];
					if (lastSubChapter) {
						lastSubChapter.endPage = chapters[i + 1].startPage - 1;
					}
				}
			}

			// 处理最后一章（如果存在章节）
			if (chapters.length > 0) {
				const lastChapter = chapters[chapters.length - 1];
				lastChapter.endPage = pdfDoc.numPages;
				if (lastChapter.subChapters && lastChapter.subChapters.length > 0) {
					for (let j = 0; j < lastChapter.subChapters.length - 1; j++) {
						lastChapter.subChapters[j].endPage = lastChapter.subChapters[j + 1].startPage - 1;
					}
					const lastSubChapter = lastChapter.subChapters[lastChapter.subChapters.length - 1];
					if (lastSubChapter) {
						lastSubChapter.endPage = pdfDoc.numPages;
					}
				}
			}
		}
	}

	async function renderPage(logType:string) {
		console.log('renderPage---',logType);
		if (!pdfDoc) {
			console.log("PDF doc or container not available");
			return;
		}

		if (!readerContainer) {
			console.log("Container not available, waiting...");
			pendingRender = true;
			await waitForContainer();
		}

		const pageNum = showingCoverPage ? 1 : currentPage;
		console.log('renderPage---',currentPage,showingCoverPage,pageNum)
		const page = await pdfDoc.getPage(pageNum);
		const viewport = page.getViewport({scale: zoomLevel});

		if (!readerContainer) {
			throw new Error("Reader container still not available after waiting");
		}

		// 清空容器
		readerContainer.innerHTML = '';

		// 创建新的 canvas
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.height = viewport.height;
		canvas.width = viewport.width;

		readerContainer.appendChild(canvas);

		if (context) {
			// 渲染页面
			await page.render({
				canvasContext: context,
				viewport: viewport
			}).promise;
		}

		// 保存阅读进度
		saveReadingProgress();
	}

	//保存阅读进度
	function saveReadingProgress() {
		if (showingCoverPage) return;

		const progress = {
			novelId: novel.id,
			position: {
				page: currentPage,
				percentage: Math.round((currentPage / numPages) * 100)
			},
			timestamp: Date.now(),
			chapterTitle: `Page ${currentPage}`
		};

		// 触发进度保存事件
		const event = new CustomEvent('saveProgress', {
			detail: {progress}
		});
		window.dispatchEvent(event);
	}

	function handleZoom(action: 'in' | 'out') {
		if (action === 'in') {
			zoomLevel = Math.min(zoomLevel * 1.2, 3.0);
		} else {
			zoomLevel = Math.max(zoomLevel / 1.2, 0.5);
		}
		renderPage('handleZoom');
	}

	function handlePageInput() {
		const pageNum = parseInt(pageInputValue);
		if (pageNum && pageNum >= 1 && pageNum <= numPages) {
			currentPage = pageNum;
			showingCoverPage = false;
			showPageInput = false;
			renderPage('handlePageInput');
		}
	}

	function handleOutlineClick(pageNumber: number) {
		if (pageNumber !== currentPage) {
			console.log('1. handleOutlineClick: changing page to', pageNumber);
			currentPage = pageNumber;
			showingCoverPage = false;
			renderPage('handleOutlineClick');
		}
	}

	onMount(async () => {
		console.log("Component mounting with initial page:", initialPage);

		// 获取或创建容器元素
		const container = document.getElementById('pdf-container');
		if (container) {
			readerContainer = container;
			containerInitialized = true;
			console.log("Container initialized");

			// 如果PDF已加载且有待渲染的页面
			if (pdfDoc && pendingRender) {
				console.log("Processing pending render");
				await renderPage("init");
				pendingRender = false;
			}
		} else {
			console.error("Container element not found");
		}

		await initializePDF();

		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		// 清理工作
		if (readerContainer) {
			readerContainer.innerHTML = '';
		}
		pdfDoc = null;
		readerContainer = null;
	});

	function handleKeyDown(event: KeyboardEvent) {
		// 只有当页面激活时才处理键盘事件
		if (!isActive) return;

		if (event.key === 'ArrowLeft') {
			handleSwitchChapter('prev');
			event.preventDefault();
		} else if (event.key === 'ArrowRight') {
			handleSwitchChapter('next');
			event.preventDefault();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			//handleScroll('up');
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			//handleScroll('down');
		}
	}

	// 处理章节切换
	function handleSwitchChapter(direction: 'prev' | 'next') {
		let nextIndex: number;

		if (direction === 'prev') {
			nextIndex = currentPage > 0 ? currentPage - 1 : currentPage;
		} else {
			nextIndex = currentPage < numPages - 1 ? currentPage + 1 : currentPage;
		}

		if (nextIndex !== currentPage) {
			handleOutlineClick(nextIndex);
		}
	}

	function handleFocus() {
		isActive = true;
	}

	function handleBlur() {
		isActive = false;
	}

	// hover模式事件处理
	function handleMouseEnter() {
		if (displayMode === 'hover') {
			isMenuVisible = true;
		}
	}

	function handleMouseLeave() {
		if (displayMode === 'hover') {
			isMenuVisible = false;
		}
	}

	// 获取当前页面所在的章节
	function getCurrentChapter(page: number): number {
		for (let i = 0; i < chapters.length; i++) {
			const chapter = chapters[i];
			if (page >= chapter.startPage && page <= (chapter.endPage || numPages)) {
				return i;
			}
		}
		return -1;
	}

	// 判断子章节是否为当前章节
	function isCurrentSubChapter(subChapter: any): boolean {
		return currentPage >= subChapter.startPage &&
			currentPage <= (subChapter.endPage || numPages);
	}

	// 处理章节跳转
	function handleJumpToChapter(event: CustomEvent) {
		const {chapterId} = event.detail;
		// 实现页面跳转逻辑
		const pageNumber = chapters[chapterId]?.startPage || 1;
		handleOutlineClick(pageNumber);
	}

	// 等待容器初始化
	function waitForContainer(): Promise<void> {
		return new Promise((resolve) => {
			const checkContainer = () => {
				if (readerContainer) {
					resolve();
				} else {
					setTimeout(checkContainer, 50);  // 每50ms检查一次
				}
			};
			checkContainer();
		});
	}

	// 切换目录/页码显示模式
	async function toggleViewMode() {
		viewMode = viewMode === 'chapters' ? 'pages' : 'chapters';

		// 保存用户选择到 novel.customSettings
		if (!novel.customSettings) {
			novel.customSettings = {};
		}
		novel.customSettings.pdfViewMode = viewMode;

		// 更新到数据库
		await plugin.libraryService.updateNovel(novel);
	}

</script>

<div class="pdf-reader"
	 on:mouseenter={handleFocus}
	 on:mouseleave={handleBlur}>

	<!-- 悬浮章节模式 -->
	{#if displayMode === 'hover'}
		<div class="chapter-trigger"
			 on:mouseenter={handleMouseEnter}
			 on:mouseleave={handleMouseLeave}>
			<div class="chapters-panel"
				 class:visible={isMenuVisible}>
				<div class="chapters-header">
					<div class="header-content">
						<h3>{viewMode === 'chapters' ? '目录' : '页码'}</h3>
						{#if chapters.length > 0}
							<button
								class="view-mode-toggle"
								on:click={toggleViewMode}
								title={viewMode === 'chapters' ? '切换到页码视图' : '切换到目录视图'}
							>
								{viewMode === 'chapters' ? '页码' : '目录'}
							</button>
						{/if}
					</div>
				</div>
				<div class="chapters-scroll">
					{#if viewMode === 'chapters'}
						<!-- 目录视图 -->
						{#each chapters as chapter, index}
							<button
								class="chapter-item"
								class:active={chapterActiveStates[index]}
								on:click={() => handleOutlineClick(chapter.startPage)}
							>
								<span class="chapter-title">{chapter.title}</span>
								<span class="page-number">{chapter.startPage}</span>
							</button>

							{#if chapter.subChapters && chapter.subChapters.length > 0}
								<div class="sub-chapters">
									{#each chapter.subChapters as subChapter}
										{@const isSubActive = currentPage >= subChapter.startPage &&
										currentPage <= (subChapter.endPage || numPages)}
										<button
											class="sub-chapter-item"
											class:active={isSubActive}
											on:click={() => handleOutlineClick(subChapter.startPage)}
										>
											{subChapter.title} ({subChapter.startPage})
										</button>
									{/each}
								</div>
							{/if}
						{/each}
					{:else}
						<!-- 页码视图 -->
						{#each Array(numPages) as _, index}
							{@const pageNum = index + 1}
							<button
								class="page-item"
								class:active={pageNum === currentPage}
								on:click={() => handleOutlineClick(pageNum)}
							>
								<span class="page-title">第 {pageNum} 页</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- 大纲面板 -->
	{#if displayMode === 'outline' || displayMode === 'sidebar'}
		<div class="outline-panel" transition:fade>
			<div class="outline-header">
				<h3>目录</h3>
			</div>
			<div class="outline-content">
				{#each chapters as chapter, index}
					<button
						class="chapter-item"
						class:active={chapterActiveStates[index]}
						on:click={() => handleOutlineClick(chapter.startPage)}
					>
						<span class="chapter-title">{chapter.title}</span>
						<span class="page-number">{chapter.startPage}</span>
					</button>

					{#if chapter.subChapters && chapter.subChapters.length > 0}
						<div class="sub-chapters">
							{#each chapter.subChapters as subChapter}
								{@const isSubActive = currentPage >= subChapter.startPage &&
								currentPage <= (subChapter.endPage || numPages)}
								<button
									class="sub-chapter-item"
									class:active={isSubActive}
									on:click={() => handleOutlineClick(subChapter.startPage)}
								>
									{subChapter.title} ({subChapter.startPage})
								</button>
							{/each}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- 内容区域 -->
	<div class="content-area">
		<div class="toolbar">
			<div class="toolbar-left">
				<button
					class="tool-button"
					on:click={() => handleZoom('out')}
					title="缩小"
				>
					<span class="zoom-icon">{@html icons.zoomOut}</span>
				</button>
				<button
					class="tool-button"
					on:click={() => handleZoom('in')}
					title="放大"
				>
					<span class="zoom-icon">{@html icons.zoomIn}</span>
				</button>
				<span class="zoom-level">{Math.round(zoomLevel * 100)}%</span>
			</div>

			<div class="page-navigation">
				{#if showPageInput}
					<input
						type="text"
						bind:value={pageInputValue}
						on:keydown={(e) => e.key === 'Enter' && handlePageInput()}
						class="page-input"
						on:blur={() => showPageInput = false}
					/>
				{:else}
                    <span
						class="page-display"
						on:click={() => {
                            showPageInput = true;
                            pageInputValue = currentPage.toString();
                            setTimeout(() => {
    							const input = document.querySelector<HTMLInputElement>('.page-input');
    							if (input) {
        							input.focus();
    							}
							}, 0);
                        }}
					>
                        {currentPage}
                    </span>
				{/if}
				<span class="page-separator">/</span>
				<span class="total-pages">{numPages}</span>
			</div>

			<!-- 设置菜单组件 -->
			<ReaderSettingsMenu
				plugin={plugin}
				novel={novel}
				readerType="pdf"
				currentChapterId={currentPage}
				notes={notes}
				readingStats={readingStats}
			/>
		</div>

		<div id="pdf-container" class="pdf-container">
			{#if isLoading}
				<LoadingSpinner message="正在加载PDF文档..." />
			{/if}
		</div>
	</div>
</div>

<style>
	.pdf-reader {
		height: 100%;
		display: flex;
		position: relative;
		overflow: hidden;
	}

	/* 悬浮模式样式 */
	.chapter-trigger {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 60px;
		z-index: 100;
	}

	.chapters-panel {
		position: absolute;
		left: -240px;
		top: 0;
		bottom: 0;
		width: 240px;
		background: var(--background-primary);
		border-right: 1px solid var(--background-modifier-border);
		transition: transform 0.3s ease-in-out;
		display: flex;
		flex-direction: column;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
		z-index: 101;
	}

	.chapters-panel.visible {
		transform: translateX(240px);
	}

	.chapters-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.chapters-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 500;
	}

	.view-mode-toggle {
		padding: 4px 12px;
		border: none;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.view-mode-toggle:hover {
		background: var(--interactive-accent-hover);
	}

	.chapters-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth;
	}

	/* 大纲和侧边栏模式样式 */
	.outline-panel {
		width: 240px;
		min-width: 240px;
		flex-shrink: 0;
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		background: var(--background-primary);
	}

	.outline-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.outline-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 500;
	}

	.outline-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.chapter-item {
		width: 100%;
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--text-normal);
		transition: background-color 0.2s;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.chapter-item:hover {
		background: var(--background-modifier-hover);
	}

	.chapter-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.sub-chapter-item {
		width: 100%;
		margin-left: 20PX;
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--text-normal);
		transition: background-color 0.2s;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sub-chapter-item:hover {
		background: var(--background-modifier-hover);
	}

	.sub-chapter-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.chapter-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-right: 8px;
	}

	.page-number {
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.page-item {
		width: 100%;
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--text-normal);
		transition: background-color 0.2s;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.page-item:hover {
		background: var(--background-modifier-hover);
	}

	.page-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.page-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.toolbar {
		padding: 8px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: var(--background-primary);
		z-index: 10;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.tool-button {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		background: var(--background-modifier-border);
		color: var(--text-normal);
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tool-button:hover {
		background: var(--background-modifier-hover);
	}

	.zoom-icon :global(svg) {
		width: 16px;
		height: 16px;
		stroke: currentColor;
	}

	.zoom-level {
		font-size: 14px;
		color: var(--text-muted);
		min-width: 48px;
		text-align: center;
	}

	.page-navigation {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--background-secondary);
		padding: 4px 8px;
		border-radius: 4px;
	}

	.page-input {
		width: 40px;
		padding: 2px 4px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 2px;
		text-align: center;
	}

	.page-display {
		cursor: pointer;
		padding: 2px 4px;
		min-width: 30px;
		text-align: center;
	}

	.page-display:hover {
		background: var(--background-modifier-hover);
		border-radius: 2px;
	}

	.page-separator {
		color: var(--text-muted);
	}

	.total-pages {
		color: var(--text-muted);
	}

	.pdf-container {
		width: 100%;
		height: 100%;
		overflow: auto;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 20px;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 1.2em;
	}
</style>
