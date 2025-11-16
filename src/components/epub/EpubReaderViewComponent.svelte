<script lang="ts">
	import {createEventDispatcher, onDestroy, onMount} from 'svelte';
	import {fade} from 'svelte/transition';
	import {v4 as uuidv4} from 'uuid';
	import type NovelReaderPlugin from "../../main";
	import type {Novel, ReadingProgress} from "../../types";
	import type {EpubNote} from "../../types/epub/epub-reader";
	import NoteDialog from "../NoteDialog.svelte";
	import type {EpubBook, EpubChapter, EpubNavigationItem, EpubRendition} from "../../types/epub/epub-rendition";
	import ReaderSettingsMenu from "../setting/ReaderSettingsMenu.svelte";
	import {handleChapterChangeEPUB, parseChapters, switchChapter} from "../../lib/txt.reader/chapter-logic";
	import type {ChapterHistory} from "../../types/reading-stats";
	import {saveReadingProgress} from "../../lib/txt.reader/progress-logic";
	import type{ChapterProgress} from "../../types/txt/txt-reader";
	import type {Note} from "../../types/notes";
	import LoadingSpinner from '../LoadingSpinner.svelte';
	import { debounce } from '../../utils/debounce';

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
	export let initialCfi: string | null = null;
	export let savedProgress: ReadingProgress | null = null;
	export let book: EpubBook | null = null;
	export let toc: any[] = [];
	export let chapters: EpubChapter[] = [];

	let rendition: EpubRendition;
	let isLoading = true;
	let showNoteDialog = false;
	let selectedTextForNote = '';
	let notes: EpubNote[] = [];
	let readerContainer: HTMLElement | null = null;
	let readerElement: HTMLElement; // 阅读器主元素引用
	let currentChapter: EpubChapter | null = null;
	export let currentChapterId: number | null = null;
	const viewInstanceId = `epub-view-${novel.id}-${Date.now()}`;
	// 添加漫画检测逻辑
	let isManga = false;
	let readingStats: any = null;
	export let chapterHistory: ChapterHistory[] = []; // 章节历史记录（export让view层可以更新）
	let isActive = false;
	let contentLoaded = false;
	export let initialChapterId: number | null = null; //初始章节（从父组件传入）

	let chapterProgressDatas: ChapterProgress[] = []; //当前阅读进度
	let chapterProcessCurrentChapter: ChapterProgress | null = null; //阅读进度格式-章节集合

	let selectedNote: Note | null = null; //笔记
	let noteViewerPosition = {x: 0, y: 0};
	let noteViewerVisible = false;   // 控制笔记查看器显示

	let isReadingActive = false;
	let sessionStartTime: number | null = null;
	let lastActivityTime = Date.now();

	// 唯一实例ID用于调试
	const instanceId = `EPUB-${novel.id.substring(0, 8)}-${Date.now()}`;
	console.log(`[${instanceId}] Component created for novel: ${novel.title}`);

	// hover模式相关状态
	let isMenuVisible = false;

	// 目录面板显示状态
	let showOutlinePanel = false;

	// 章节元素容器引用（用于自动滚动到当前章节）
	let hoverChaptersContainer: HTMLElement;
	let fullscreenChaptersContainer: HTMLElement;
	let chapterElements: Map<number, HTMLElement> = new Map();

	// 防抖函数：用于优化滚动性能
	const debouncedScrollToChapter = debounce((container: HTMLElement) => {
		scrollToActiveChapter(container);
	}, 300);

	// EPUB 悬浮目录：目录/页码切换功能
	let viewMode: 'chapters' | 'pages' = 'chapters';
	let virtualPages: Array<{
		pageNum: number,
		chapterId: number,
		chapterTitle: string,
		subPage?: number,
		totalSubPages?: number
	}> = [];
	let currentPageNum = 1;
	let currentVirtualPage: typeof virtualPages[0] | null = null;

	// 计算虚拟页码（EPUB基于章节，章节数少时细分）
	function calculateVirtualPages() {
		virtualPages = [];
		let pageNum = 1;

		// 如果章节数少于5，每个章节细分为10个虚拟页
		const CHAPTER_THRESHOLD = 5;
		const SUBPAGES_PER_CHAPTER = 10;
		const needsSubdivision = chapters.length < CHAPTER_THRESHOLD;

		chapters.forEach((chapter, index) => {
			if (needsSubdivision) {
				// 章节数少，细分每个章节
				for (let i = 0; i < SUBPAGES_PER_CHAPTER; i++) {
					virtualPages.push({
						pageNum: pageNum++,
						chapterId: chapter.id,
						chapterTitle: chapter.title,
						subPage: i + 1,
						totalSubPages: SUBPAGES_PER_CHAPTER
					});
				}
			} else {
				// 章节数足够，每章节=一页
				virtualPages.push({
					pageNum: pageNum++,
					chapterId: chapter.id,
					chapterTitle: chapter.title
				});
			}
		});

		// 初始化第一页
		if (virtualPages.length > 0) {
			currentVirtualPage = virtualPages[0];
			currentPageNum = 1;
		}
	}

	// 根据当前章节计算当前页码
	function updateCurrentPage() {
		if (viewMode === 'chapters') {
			// 章节模式：基于当前章节
			if (!currentChapter || virtualPages.length === 0) return;

			// 提取局部变量解决TypeScript控制流分析问题
			const chapter = currentChapter;
			const page = virtualPages.find(p => p.chapterId === chapter.id);
			if (page) {
				currentPageNum = page.pageNum;
			}
		} else {
			// 页码模式：基于当前虚拟页
			if (currentVirtualPage) {
				currentPageNum = currentVirtualPage.pageNum;
			}
		}
	}

	// 跳转到指定页码
	async function jumpToPage(pageNum: number) {
		const page = virtualPages.find(p => p.pageNum === pageNum);
		if (!page) return;

		currentVirtualPage = page;
		currentPageNum = pageNum;

		const targetChapter = chapters.find(ch => ch.id === page.chapterId);
		if (targetChapter) {
			const success = await displayChapter(targetChapter);
			if (success) {
				currentChapter = targetChapter;
				currentChapterId = targetChapter.id;
				saveProgress();

				// 触发章节切换事件以记录历史
				dispatch('chapterChanged', {
					chapterId: targetChapter.id,
					chapterTitle: targetChapter.title
				});

				// 重新激活键盘导航
				isActive = true;
			}
		}
	}

	// 切换到上一页/下一页
	function switchEpubPage(direction: 'prev' | 'next') {
		const currentIndex = virtualPages.findIndex(p => p.pageNum === currentPageNum);
		if (currentIndex === -1) return;

		let nextIndex: number;
		if (direction === 'prev') {
			nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
		} else {
			nextIndex = currentIndex < virtualPages.length - 1 ? currentIndex + 1 : currentIndex;
		}

		if (nextIndex !== currentIndex) {
			jumpToPage(virtualPages[nextIndex].pageNum);
		}
	}

	// 从 novel.customSettings 读取用户偏好
	$: {
		if (novel?.customSettings?.epubViewMode) {
			viewMode = novel.customSettings.epubViewMode;
		} else {
			// 优先显示目录，如果没有目录则显示页码
			viewMode = chapters.length > 0 ? 'chapters' : 'pages';
		}
	}

	// 当章节变化时更新页码
	$: if (currentChapter && virtualPages.length > 0) {
		updateCurrentPage();
	}

	// 切换目录/页码显示模式
	async function toggleViewMode() {
		viewMode = viewMode === 'chapters' ? 'pages' : 'chapters';

		// 保存用户选择到 novel.customSettings
		if (!novel.customSettings) {
			novel.customSettings = {};
		}
		novel.customSettings.epubViewMode = viewMode;

		// 更新到数据库
		await plugin.libraryService.updateNovel(novel);
	}

	//添加笔记、右键菜单
	let selectedText = '';
	let currentCfi = '';
	let showMenu = false;

	let menuPosition = {x: 0, y: 0};

	$: {
		// 使用块作用域+局部变量检查，让TypeScript正确推断类型
		const chapter = currentChapter;
		if (chapter) {
			console.log('EpubReaderViewComponent--->', JSON.stringify(chapter))

			// 注释掉响应式历史保存，避免重复记录（已由view层的chapterChanged事件统一处理）
			/*
			handleChapterChangeEPUB(
				chapter,
				novel,
				plugin.chapterHistoryService,
				(newHistory) => {
					chapterHistory = newHistory;
				}
			);
			*/

			chapterProcessCurrentChapter = {
				id: chapter.id!,  // 非空断言：chapter在if块内不为null，id必然存在
				title: chapter.title!,
				content: '',
				startPos: 0,
				endPos: 0,
			};

			currentChapterId = chapter.id!;  // 非空断言：告诉IDE此时id必然存在

			chapters.forEach(c => {
				const chapterProgress: ChapterProgress = {
					id: c.id,
					title: c.title,
					content: '',
					startPos: 0,
					endPos: 0,
				};
				chapterProgressDatas.push(chapterProgress);
			})

			console.log('EPUB,1---', JSON.stringify(chapterProgressDatas))

			// 根据显示模式滚动到对应位置（使用防抖优化）
			if (displayMode === 'hover' && hoverChaptersContainer) {
				debouncedScrollToChapter(hoverChaptersContainer);
			}

			if (currentChapterId !== null && chapters.length > 0) {
				const foundChapter = chapters.find(c => c.id === currentChapterId);
				if (foundChapter) {
					console.log('EPUB,准备保存进度.')
					const chapterProgress: ChapterProgress = {
						id: foundChapter.id,
						title: foundChapter.title,
						content: '',
						startPos: 0,
						endPos: 0,
					};
					// 无论是通过大纲还是切换章节，只要章节ID变化就保存进度
					saveReadingProgress(novel, chapterProgress, chapterProgressDatas);
				}
			}
		}
}

	onMount(async () => {
		console.log("Component mounting...");

		// 添加全局错误处理器，捕获非标准EPUB DOM错误
		const errorHandler = (event: ErrorEvent) => {
			const error = event.error;
			if (error && error.message) {
				// 检查是否是非标准DOM相关的错误
				if (
					error.message.includes('getElementsByTagName is not a function') ||
					error.message.includes('createElement is not a function') ||
					error.message.includes('getElementById is not a function') ||
					error.message.includes('getElementsByClassName is not a function')
				) {
					console.warn('Suppressed non-standard EPUB DOM error:', error.message);
					event.preventDefault(); // 阻止错误传播到控制台
					return true;
				}
			}
		};

		window.addEventListener('error', errorHandler);

		// 创建并使用特定实例的内容区域
		const contentArea = document.getElementById(`content-area-${viewInstanceId}`);
		if (!contentArea) {
			console.error('Content area not found');
			return;
		}

		console.log("Content area found, initializing reader...");

		readerContainer = document.createElement('div');
		readerContainer.id = `epub-container-${viewInstanceId}`;
		readerContainer.classList.add('epub-viewer-container');

		contentArea.appendChild(readerContainer);

		await initializeReader();

		// 清理：组件卸载时移除错误处理器
		return () => {
			window.removeEventListener('error', errorHandler);
		};
	});

	onMount(async () => {
		if (chapters) {
			//parseAndSetChapters();
			contentLoaded = true;

			// 计算虚拟页码
			calculateVirtualPages();

			// 章节历史现在由view层传入，不需要在这里加载

			console.log(`[${instanceId}] 📚 章节初始化参数:`, {
				savedProgressChapterId: savedProgress?.position?.chapterId,
				initialChapterId: initialChapterId,
				totalChapters: chapters.length
			});

			// 恢复上次阅读进度
			// 优先使用传入的initialChapterId（从setNovelData传来），如果没有则使用savedProgress
			if (initialChapterId !== null) {
				// 使用传入的初始章节ID（最高优先级）
				const savedChapter = chapters.find(ch => ch.id === initialChapterId);
				console.log(`[${instanceId}] ✅ 使用传入的initialChapterId: ${initialChapterId}`, savedChapter);
				if (savedChapter) {
					currentChapter = savedChapter;
					currentChapterId = savedChapter.id;
				// initializeReader已经会直接显示该章节，无需延迟调用
				console.log(`[${instanceId}] 📖 章节状态已设置，等待initializeReader显示`);
			}
			} else if (savedProgress?.position?.chapterId) {
				// 使用savedProgress中的章节ID
				currentChapterId = savedProgress.position.chapterId;
				const savedChapter = chapters.find(ch => ch.id === currentChapterId);
				console.log(`[${instanceId}] 📖 使用savedProgress中的章节ID: ${currentChapterId}`, savedChapter);
				if (savedChapter) {
					currentChapter = savedChapter;
				// initializeReader已经会直接显示该章节，无需延迟调用
				console.log(`[${instanceId}] 📖 章节状态已设置，等待initializeReader显示`);
				}
			} else if (chapters.length > 0) {
				// 否则加载第一章
				console.log(`[${instanceId}] 📄 没有保存的进度，加载第一章`);
				currentChapter = chapters[0];
				currentChapterId = chapters[0].id;
			}
		}

	});

	onMount(() => {
		console.log("Adding event listeners");
		// 键盘事件已改为主div的on:keydown，不再使用全局window监听
		window.addEventListener('noteIconClick', handleNoteIconClick as EventListener);

		const visibilityHandler = () => {
			isActive = !document.hidden;
		};

		// 监听页面焦点
		document.addEventListener('visibilitychange', visibilityHandler);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		document.addEventListener('click', handleClickOutside);

		// 返回清理函数，移除所有事件监听器
		return () => {
			window.removeEventListener('noteIconClick', handleNoteIconClick as EventListener);

			document.removeEventListener('visibilitychange', visibilityHandler);
			document.removeEventListener('visibilitychange', handleVisibilityChange);

			document.removeEventListener('click', handleClickOutside);
		};
	});

	// 辅助函数：查找章节对应的spine索引
	function findSpineIndex(chapter: EpubChapter): number | null {
		if (!book || !chapter.href) return null;

		// 清理href
		const cleanHref = chapter.href.split('#')[0].split('?')[0];

		// 在spine中查找匹配的项
		for (let i = 0; i < book.spine.items.length; i++) {
			const spineItem = book.spine.items[i];
			const spineHref = spineItem.href?.split('#')[0].split('?')[0] || '';

			// 比较清理后的href，支持相对路径和绝对路径
			if (spineHref === cleanHref || spineHref.endsWith('/' + cleanHref) || cleanHref.endsWith('/' + spineHref)) {
				return i;
			}
		}

		return null;
	}

	// 辅助函数：显示章节内容（带回退机制）
	async function displayChapter(chapter: EpubChapter): Promise<boolean> {
		if (!rendition || !book || !chapter.href) return false;

		try {
			// 方法1：尝试使用清理后的href
			const cleanHref = chapter.href.split('#')[0].split('?')[0];
			await rendition.display(cleanHref);

			// 切换章节后重新获取焦点，确保键盘事件能继续响应
			const readerElement = document.querySelector('.epub-reader') as HTMLElement;
			if (readerElement) {
				setTimeout(() => readerElement.focus(), 100);
			}

			return true;
		} catch (error) {
			console.warn('Failed to display by href, trying spine index:', error);

			try {
				// 方法2：尝试使用spine索引
				const spineIndex = findSpineIndex(chapter);
				if (spineIndex !== null) {
					await rendition.display(spineIndex);

					// 切换章节后重新获取焦点
					const readerElement = document.querySelector('.epub-reader') as HTMLElement;
					if (readerElement) {
						setTimeout(() => readerElement.focus(), 100);
					}

					return true;
				}
			} catch (spineError) {
				console.error('Failed to display by spine index:', spineError);
			}

			// 方法3：尝试使用原始href（最后的尝试）
			try {
				await rendition.display(chapter.href);

				// 切换章节后重新获取焦点
				const readerElement = document.querySelector('.epub-reader') as HTMLElement;
				if (readerElement) {
					setTimeout(() => readerElement.focus(), 100);
				}

				return true;
			} catch (originalError) {
				console.error('Failed to display chapter by any method:', originalError);
				return false;
			}
		}
	}

	async function initializeReader() {
		if (!readerContainer) {
			console.error('Reader container still not available');
			return;
		}

		try {
			if (!book) {
				return;
			}

			isManga = await isMangaEpub(book, novel, chapters);
			console.log('isManga---' + isManga)

			const container = document.getElementById(`epub-container-${viewInstanceId}`);
			if (!container) {
				throw new Error('Container not found');
			}

			rendition = book.renderTo(container, {
				width: "100%",
				height: "100%",
				flow: "scrolled-doc",         // 漫画模式使用分页
				manager: isManga ? "continuous" : "default",
				orientation: "vertical",
				spread: "none",               // 禁用双页显示
				keyBindings: false  // 禁用默认键盘绑定
			});

			// 修复非标准DOM：在epub.js使用之前为document添加缺失的方法
			rendition.hooks.content.register((contents: any) => {
				try {
					if (contents && contents.document) {
						const doc = contents.document;

						// Polyfill getElementsByTagName if missing
						if (typeof doc.getElementsByTagName !== 'function') {
							doc.getElementsByTagName = function(tagName: string) {
								console.warn('Using polyfilled getElementsByTagName for non-standard EPUB DOM');
								try {
									// 尝试使用querySelectorAll作为替代
									if (typeof doc.querySelectorAll === 'function') {
										return doc.querySelectorAll(tagName);
									}
									// 返回空的HTMLCollection-like对象
									return [];
								} catch (e) {
									return [];
								}
							};
						}

						// Polyfill createElement if missing
						if (typeof doc.createElement !== 'function') {
							doc.createElement = function(tagName: string) {
								console.warn('Using polyfilled createElement for non-standard EPUB DOM');
								// 返回一个模拟的元素对象
								return {
									tagName: tagName.toUpperCase(),
									setAttribute: function() {},
									getAttribute: function() { return null; },
									appendChild: function() {},
									removeChild: function() {},
									classList: {
										add: function() {},
										remove: function() {},
										contains: function() { return false; }
									}
								};
							};
						}

						// Polyfill getElementById if missing
						if (typeof doc.getElementById !== 'function') {
							doc.getElementById = function(id: string) {
								console.warn('Using polyfilled getElementById for non-standard EPUB DOM');
								try {
									if (typeof doc.querySelector === 'function') {
										return doc.querySelector(`#${id}`);
									}
									return null;
								} catch (e) {
									return null;
								}
							};
						}
					}
				} catch (error) {
					console.warn('Error polyfilling EPUB document methods:', error);
				}
			});

			// 添加基本类名到 EPUB 文档
			rendition.hooks.content.register((contents: any) => {
				try {
					// 安全检查：确保document和body存在且有效
					if (!contents || !contents.document || !contents.document.body) {
						console.warn('EPUB content structure is invalid, skipping hooks');
						return;
					}

					// 检查是否有getElementsByTagName方法（标准DOM检查）
					if (typeof contents.document.getElementsByTagName !== 'function') {
						console.warn('EPUB document is not a standard DOM, skipping hooks');
						return;
					}

					const body = contents.document.body;

					// 安全地添加类名
					if (body.classList && typeof body.classList.add === 'function') {
						body.classList.add('epub-doc');
					}

					// 为 iframe 内的文档添加点击事件监听
					if (typeof contents.document.addEventListener === 'function') {
						contents.document.addEventListener('click', (event: MouseEvent) => {
							try {
								// 检查点击是否在选中文本区域外
								const selection = contents.window?.getSelection?.();
								if (!selection || selection.toString().trim() === '') {
									showMenu = false;
									selectedText = '';
								}
							} catch (err) {
								console.warn('Error handling click event:', err);
							}
						});
					}
				} catch (error) {
					console.warn('Error registering EPUB content hooks:', error);
				}
			});

			// 加载初始位置 - 优先使用要恢复的章节，避免闪烁
			let displayTarget = null;

			// 优先级1: 使用initialCfi
			if (initialCfi) {
				displayTarget = initialCfi;
				console.log(`[${instanceId}] 🎯 使用initialCfi初始化显示`);
			}
			// 优先级2: 检查是否有要恢复的章节ID
			else if (initialChapterId !== null && chapters.length > 0) {
				const targetChapter = chapters.find(ch => ch.id === initialChapterId);
				if (targetChapter && targetChapter.href) {
					displayTarget = targetChapter.href.split('#')[0].split('?')[0];
					console.log(`[${instanceId}] 🎯 使用initialChapterId初始化显示:`, targetChapter.title);
				}
			}
			// 优先级3: 检查savedProgress中的章节ID
			else if (savedProgress?.position?.chapterId && chapters.length > 0) {
				// 显式提取以避免TypeScript控制流分析问题
			const position = savedProgress.position;
			const targetChapter = position ? chapters.find(ch => ch.id === position.chapterId) : null;
				if (targetChapter && targetChapter.href) {
					displayTarget = targetChapter.href.split('#')[0].split('?')[0];
					console.log(`[${instanceId}] 🎯 使用savedProgress初始化显示:`, targetChapter.title);
				}
			}

			// 执行显示
			if (displayTarget) {
				await rendition.display(displayTarget);
			} else {
				await rendition.display();
			}

			// 设置手势和触摸事件
			rendition.on('touchstart', (event: TouchEvent) => {
				event.preventDefault();
			});
			rendition.on('touchend', (event: TouchEvent) => {
				event.preventDefault();
			});
			// 处理键盘事件（来自iframe内部）- 方法1: rendition.on
			rendition.on('keyup', (event: KeyboardEvent) => {
				console.log(`[${instanceId}] 📥 rendition.on('keyup') triggered:`, event.key);
				// 标记事件来自rendition（iframe内部），跳过严格的焦点检查
				handleKeyDown(event, true);
			});

			// 方法2: 直接在iframe的contentDocument上监听（备用方案）
			// 等待iframe加载完成后添加监听
			setTimeout(() => {
				const iframe = document.querySelector(`#epub-container-${viewInstanceId} iframe`) as HTMLIFrameElement;
				if (iframe && iframe.contentWindow && iframe.contentWindow.document) {
					console.log(`[${instanceId}] 🔧 Adding keyboard listener to iframe contentDocument`);

					const iframeDoc = iframe.contentWindow.document;

					// 在iframe document上添加键盘监听
					iframeDoc.addEventListener('keyup', (event: KeyboardEvent) => {
						console.log(`[${instanceId}] 📥 iframe contentDocument keyup triggered:`, event.key);
						handleKeyDown(event, true);
					});

					// 禁用右键菜单
					iframeDoc.addEventListener('contextmenu', (event: MouseEvent) => {
						event.preventDefault();
						console.log(`[${instanceId}] Right-click disabled inside iframe`);
						showMenu = true;
					});
				} else {
					console.warn(`[${instanceId}] ⚠️ Failed to find iframe for keyboard listener`);
				}
			}, 1000);

			// 处理文本选择
			rendition.on('selected', handleTextSelection);

			isLoading = false;

			// 开始阅读会话
			startReadingSession();
		} catch (error) {
			console.error('Error initializing EPUB:', error);
			isLoading = false;
		}
	}

	onDestroy(() => {
		if (rendition) {
			rendition.destroy();
		}
		if (book) {
			book.destroy();
		}

		// 只移除当前实例的容器
		const container = document.getElementById(`epub-container-${viewInstanceId}`);
		if (container) {
			container.remove();
		}

		endReadingSession();
	});

	async function handleKeyEvents(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			// await rendition.prev();
			saveProgress();
		} else if (event.key === 'ArrowRight') {
			// await rendition.next();
			saveProgress();
		}
	}

	function handleTextSelection(cfiRange: string, contents: any) {
		try {
			console.log(`[${instanceId}] 📝 Text selected, cfiRange:`, cfiRange);

			// 安全检查：确保contents和window存在
			if (!contents || !contents.window || typeof contents.window.getSelection !== 'function') {
				console.warn('Invalid contents object in text selection');
				return;
			}

			const selection = contents.window.getSelection();
			if (!selection) {
				return;
			}

			selectedText = selection.toString().trim();

			if (selectedText) {
				currentCfi = cfiRange;

				// 获取EPubJS的iframe元素
				const iframe = document.querySelector(`#epub-container-${viewInstanceId} iframe`);
				if (iframe && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const rect = range.getBoundingClientRect();

					// 获取iframe的位置
					const iframeRect = iframe.getBoundingClientRect();

					// 计算绝对位置：iframe的偏移量 + 选择区域在iframe中的相对位置
					const absoluteX = iframeRect.left + rect.left + (rect.width / 2);
					// 计算Y轴位置，确保菜单在选中文本下方
					const absoluteY = iframeRect.top + rect.bottom + 5;

					menuPosition = {
						x: absoluteX,
						y: absoluteY
					};
				}

				// 重要：选择文字后恢复焦点到主元素，确保键盘事件继续工作
				// 使用短延迟确保选择操作完成
				setTimeout(() => {
					if (readerElement) {
						console.log(`[${instanceId}] 🔵 Refocusing reader element after text selection`);
						readerElement.focus();
					}
				}, 100);
			}
		} catch (error) {
			console.warn('Error handling text selection:', error);
		}
	}

	// 添加右键菜单事件处理
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();

		if (selectedText) {
			// 使用已经计算好的menuPosition，不需要重新计算
			showMenu = true;
		}
	}

	function handleNoteEdit(event: CustomEvent) {
		const {note} = event.detail;
		selectedNote = note;
		// 确保设置正确的选中文本
		selectedTextForNote = note.selectedText;
		showNoteDialog = true;

		// 重置当前选中的文本，避免影响新增笔记
		selectedText = '';
		currentCfi = '';
	}

	async function handleNoteSave(event: CustomEvent) {
		try {
			if (selectedNote) {
				// 编辑已有笔记
				notes = notes.map(note =>
					note.id === selectedNote?.id
						? {
							...note,
							content: event.detail.content,
							timestamp: Date.now(),
							// 保持原有的选中文本
							selectedText: note.selectedText
						}
						: note
				);
			} else {
				// 添加新笔记
				const note: EpubNote = {
					id: uuidv4(),
					chapterId: currentChapter?.id || 0,
					chapterName: currentChapter?.title || '',
					selectedText: selectedTextForNote, // 使用临时存储的选中文本
					content: event.detail.content,
					timestamp: Date.now(),
					cfi: currentCfi,
					textIndex: 0,
					textLength: selectedText.length,
					lineNumber: 0
				};
				notes = [...notes, note];
			}

			await saveNotes();

			// 清理所有状态
			clearNoteState();
		} catch (error) {
			console.error('Error saving note:', error);
		}
	}

	// 添加状态清理函数
	function clearNoteState() {
		selectedNote = null;
		selectedText = '';
		selectedTextForNote = '';
		currentCfi = '';
		showNoteDialog = false;
		showMenu = false;
	}

	// 修改关闭对话框的处理函数
	function handleNoteDialogClose() {
		clearNoteState();
	}

	async function saveNotes() {
		try {
			const notesData = {
				novelId: novel.id,
				novelName: novel.title,
				notes
			};

			const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
			await plugin.app.vault.adapter.write(
				notesPath,
				JSON.stringify(notesData, null, 2)
			);
		} catch (error) {
			console.error('Failed to save notes:', error);
		}
	}

	async function loadNotes() {
		try {
			const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
			if (await plugin.app.vault.adapter.exists(notesPath)) {
				const data = await plugin.app.vault.adapter.read(notesPath);
				const notesData = JSON.parse(data);
				notes = notesData.notes;
			}
		} catch (error) {
			console.error('Failed to load notes:', error);
			notes = [];
		}
	}

	function saveProgress() {
		if (!rendition || !book || !currentChapter) return;

		// 计算进度百分比
		const cfi = rendition.location?.start?.cfi || '';
		const percentage = book.locations.percentageFromCfi(cfi) || 0;
		const progressPercent = (currentChapter.id / chapters.length) * 100;

		const progress: ReadingProgress = {
			novelId: novel.id,
			chapterIndex: currentChapter.id - 1,  // 章节索引（从0开始，用于计算进度百分比）
			progress: progressPercent,
			timestamp: Date.now(),
			totalChapters: chapters.length,
			position: {
				chapterId: currentChapter.id,  // 章节ID（从1开始，用于恢复阅读位置）
				chapterTitle: currentChapter.title,
				cfi: cfi,  // 确保不是undefined
				percentage: percentage
			}
		};

		console.log(`[${instanceId}] 💾 saveProgress called`, progress);
		dispatch('saveProgress', {progress});
	}

	function startReadingSession() {
		dispatch('startReading', {
			chapterId: currentChapter?.id || 0,
			chapterTitle: currentChapter?.title || ''
		});
	}

	function endReadingSession() {
		dispatch('endReading');
	}

	async function isMangaEpub(book: EpubBook, novel: Novel, chapters: EpubChapter[]): Promise<boolean> {
		// 1. 检查文件名中的关键词
		const pathHasMangaKeyword = novel.path.toLowerCase().includes('manga') ||
			novel.path.toLowerCase().includes('comic') ||
			novel.path.toLowerCase().includes('卷');

		// 2. 检查 spine 数量与章节数的比例
		const spineItemCount = book.spine.length;
		const chapterCount = chapters.length;
		const spineChapterRatio = spineItemCount / (chapterCount || 1);
		const hasHighSpineRatio = spineChapterRatio > 5; // 如果每章平均超过5个文件，可能是漫画

		console.log('Manga.V1 detection results:', {
			spineItemCount,
			chapterCount,
			spineChapterRatio,
			hasHighSpineRatio
		});

		// 3. 检查文件内容特征
		let hasImageDominance = false;
		try {
			// 采样检查前几个章节的内容
			const sampleSize = Math.min(3, book.spine.length);
			let totalImages = 0;
			let totalText = 0;

			for (let i = 0; i < sampleSize; i++) {
				const spineItem = book.spine.get(i);
				const content = await spineItem.load();
				const images = content.querySelectorAll('img');
				const text = content.body.textContent || '';

				totalImages += images.length;
				totalText += text.replace(/\s+/g, '').length;
			}

			// 如果图片数量多且文本较少，很可能是漫画
			hasImageDominance = totalImages > 3 && (totalText / totalImages) < 100;
		} catch (error) {
			console.warn('Error checking content characteristics:', error);
		}

		// 4. 检查元数据中的标题关键词
		const titleHasMangaKeyword = !!(book.package?.metadata?.title?.toLowerCase().includes('卷') ||
			book.package?.metadata?.title?.toLowerCase().includes('vol'));

		// 综合判断
		console.log('Manga detection results:', {
			pathHasMangaKeyword,
			hasHighSpineRatio,
			hasImageDominance,
			titleHasMangaKeyword,
			spineChapterRatio
		});

		return !!(pathHasMangaKeyword || hasHighSpineRatio || hasImageDominance || titleHasMangaKeyword);
	}

	function handleFocus() {
		console.log("EPUB,Reader view focused");
		isActive = true;
		// 鼠标进入时自动聚焦，确保键盘事件能够响应
		if (readerElement && document.activeElement !== readerElement) {
			readerElement.focus();
		}
	}

	function handleBlur() {
		console.log("EPUB,Reader view blurred");
		isActive = false;
	}

	function handleKeyDown(event: KeyboardEvent, fromRendition: boolean = false) {
		console.log(`[${instanceId}] 🎯 handleKeyDown TRIGGERED`, {
			key: event.key,
			fromRendition: fromRendition,
			isActive: isActive,
			readerElement: !!readerElement,
			activeElement: document.activeElement?.tagName,
			activeElementClass: document.activeElement?.className
		});

		// 检查事件是否已被处理
		if (event.defaultPrevented) {
			console.log(`[${instanceId}] ❌ Event already handled`);
			return;
		}

		// 焦点检查：区分两种情况
		// 1. 如果事件来自rendition（iframe内部），跳过isActive检查，因为iframe内的键盘事件总是有效的
		// 2. 如果事件来自主div，需要检查isActive
		if (!fromRendition) {
			// 只有来自主div的事件才需要检查isActive
			if (!isActive) {
				console.log(`[${instanceId}] ❌ REJECTED: not active`);
				return;
			}

			// 额外检查：确保事件目标是当前阅读器元素或其子元素
			if (readerElement) {
				const activeEl = document.activeElement;
				const isIframe = activeEl?.tagName === 'IFRAME';
				const iframeInReader = isIframe && readerElement.contains(activeEl);
				const activeInReader = readerElement.contains(activeEl);

				console.log(`[${instanceId}] Focus check:`, {
					isIframe: isIframe,
					iframeInReader: iframeInReader,
					activeInReader: activeInReader
				});

				// 如果焦点不在reader内，且也不是reader内的iframe，则拒绝
				if (!activeInReader && !iframeInReader) {
					console.log(`[${instanceId}] ❌ REJECTED: focus not within reader`);
					return;
				}
			}
		} else {
			// 来自rendition的事件，跳过所有焦点检查
			console.log(`[${instanceId}] ⚡ Event from rendition, skipping focus checks`);
		}

		console.log(`[${instanceId}] ✅ PROCESSING keyboard event: ${event.key}`);

		if (event.key === 'ArrowLeft') {
			if (viewMode === 'pages') {
				// 页码模式：切换到上一页
				switchEpubPage('prev');
			} else {
				// 章节模式：切换到上一章
				handleSwitchChapter('prev');
			}
			event.preventDefault();
			event.stopPropagation(); // 防止事件冒泡到其他视图
		} else if (event.key === 'ArrowRight') {
			if (viewMode === 'pages') {
				// 页码模式：切换到下一页
				switchEpubPage('next');
			} else {
				// 章节模式：切换到下一章
				handleSwitchChapter('next');
			}
			event.preventDefault();
			event.stopPropagation(); // 防止事件冒泡到其他视图
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			// 处理页面滚动
			const container = document.querySelector(`#epub-container-${viewInstanceId}`);
			if (container) {
				const scrollAmount = 230; // 滚动距离
				const direction = event.key === 'ArrowUp' ? -1 : 1;
				container.scrollBy({
					top: scrollAmount * direction,
					behavior: 'smooth'
				});
			}
			event.preventDefault();
			event.stopPropagation();
		}
	}

	// 处理章节切换
	async function handleSwitchChapter(direction: 'prev' | 'next') {
		console.log('handleSwitchChapter-1--', direction, currentChapter, chapters)
		if (!currentChapter || !chapters.length) return;

		const currentIndex = chapters.findIndex(ch => ch.id === currentChapter?.id);
		let nextIndex: number;

		if (direction === 'prev') {
			nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
		} else {
			nextIndex = currentIndex < chapters.length - 1 ? currentIndex + 1 : currentIndex;
		}

		console.log('handleSwitchChapter-2--', nextIndex, currentIndex)
		if (nextIndex !== currentIndex) {
			const nextChapter = chapters[nextIndex];
			// 更新当前章节并显示
			currentChapter = nextChapter;
			currentChapterId = nextChapter.id;

			// 使用辅助函数显示章节
			await displayChapter(nextChapter);

			// 等待rendition.location更新后再保存进度
			await waitForRelocated();

			// 触发章节更改事件
			dispatch('chapterChanged', {
				chapterId: nextChapter.id,
				chapterTitle: nextChapter.title
			});

			// 保存阅读进度（左右键切换时也需要保存）
			saveProgress();
		}
	}

	// 添加笔记图标点击事件监听
	const handleNoteIconClick = (event: CustomEvent) => {
		const noteId = event.detail.noteId;
		const note = notes.find(n => n.id === noteId);
		if (note) {
			selectedNote = note;
			const noteMarker = document.querySelector(`[data-note-id="${noteId}"]`);
			if (noteMarker) {
				const rect = noteMarker.getBoundingClientRect();
				noteViewerPosition = {
					x: rect.left + (rect.width / 2),
					y: rect.top
				};
				noteViewerVisible = true;
			}
		}
	};

	// 处理焦点变化
	function handleVisibilityChange() {
		if (document.hidden) {
			if (isReadingActive) {
				endCurrentSession();
			}
		} else {
			updateActivity();
		}
	}

	// 更新用户活动时间
	function updateActivity() {
		lastActivityTime = Date.now();

		// 如果之前不活跃，重新开始会话
		if (!isReadingActive) {
			startNewSession();
		}
	}

	// 开始新会话
	function startNewSession() {
		if (!currentChapter) return;

		sessionStartTime = Date.now();
		isReadingActive = true;
		lastActivityTime = Date.now();

		dispatch('startReading', {
			chapterId: currentChapter.id,
			chapterTitle: currentChapter.title,
			startTime: sessionStartTime
		});
	}

	// 结束当前会话
	function endCurrentSession() {
		if (!isReadingActive || !sessionStartTime) return;

		const sessionEndTime = Date.now();
		const sessionDuration = sessionEndTime - sessionStartTime;

		dispatch('endReading', {
			endTime: sessionEndTime,
			duration: sessionDuration
		});

		isReadingActive = false;
		sessionStartTime = null;
	}

	function toggleOutlinePanel() {
		showOutlinePanel = !showOutlinePanel;
	}

	// 等待rendition.location更新的辅助函数
	// 确保在保存进度前，rendition.location已经更新为新章节的位置
	async function waitForRelocated(): Promise<void> {
		return new Promise<void>((resolve) => {
			if (!rendition) {
				resolve();
				return;
			}

			const timeout = setTimeout(() => {
				console.warn(`[${instanceId}] ⚠️ relocated event timeout, continuing anyway`);
				resolve();
			}, 2000); // 最多等待2秒

			const relocatedHandler = () => {
				console.log(`[${instanceId}] ✅ relocated event fired, location updated`);
				clearTimeout(timeout);
				if (rendition && rendition.off) {
				rendition.off('relocated', relocatedHandler);
			}
				resolve();
			};

			rendition.on('relocated', relocatedHandler);
		});
	}

	async function jumpToChapter(chapterId: number) {
		const chapter = chapters.find(ch => ch.id === chapterId);
		if (chapter) {
			// 更新当前章节
			currentChapter = chapter;
			currentChapterId = chapter.id;

			// 使用辅助函数显示章节
			await displayChapter(chapter);

			// 等待rendition.location更新后再保存进度
			await waitForRelocated();

			// 触发章节切换事件
			dispatch('chapterChanged', {
				chapterId: chapter.id,
				chapterTitle: chapter.title
			});

			// 保存阅读进度（此时rendition.location已更新）
			saveProgress();
		}
	}

	// 处理添加笔记
	async function handleAddNote(event: CustomEvent) {
		// 重置编辑状态
		selectedNote = null;
		if (selectedText) {
			// 确保在打开笔记对话框时选中文本仍然存在
			selectedTextForNote = selectedText;
			showNoteDialog = true;
			showMenu = false; // 关闭菜单
		}
	}

	async function handleCopy() {
		if (selectedText) {
			try {
				await navigator.clipboard.writeText(selectedText);
				showMenu = false; // 关闭菜单
			} catch (err) {
				console.error('Failed to copy text:', err);
			}
		}
	}

	function handleClickOutside(event: MouseEvent) {
		// 检查点击是否在菜单外部
		const target = event.target as HTMLElement;
		const menuElement = document.querySelector('.selection-menu');

		if (menuElement && !menuElement.contains(target)) {
			// 如果点击不在菜单内，并且不是正在选择文本，则隐藏菜单
			const selection = window.getSelection();
			if (!selection || selection.toString().trim() === '') {
				showMenu = false;
				selectedText = '';
			}
		}
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

	// 章节元素追踪（用于自动滚动）
	function setChapterElement(node: HTMLElement, id: number) {
		chapterElements.set(id, node);
		return {
			destroy() {
				chapterElements.delete(id);
			}
		};
	}

	// 滚动到当前激活章节
	function scrollToActiveChapter(container: HTMLElement) {
		if (!container || currentChapter === null) return;

		const activeElement = chapterElements.get(currentChapter.id);
		if (!activeElement) return;

		const containerHeight = container.clientHeight;
		const elementOffset = activeElement.offsetTop;
		const elementHeight = activeElement.clientHeight;

		// 计算滚动位置，将当前章节居中显示
		const scrollPosition = elementOffset - (containerHeight / 2) + (elementHeight / 2);

		container.scrollTo({
			top: scrollPosition,
			behavior: 'smooth'
		});
	}

	// 当打开全屏目录时，自动滚动到当前章节
	$: if (showOutlinePanel && fullscreenChaptersContainer && currentChapter) {
		setTimeout(() => scrollToActiveChapter(fullscreenChaptersContainer), 150);
	}

</script>

<div
	class="epub-reader"
	class:outline-mode={displayMode === 'outline'}
	bind:this={readerElement}
	on:mouseenter={handleFocus}
	on:mouseleave={handleBlur}
	on:focus={() => {
    	console.log("EPUB reader focused");
    	isActive = true;
  	}}
	on:blur={() => {
    	console.log("EPUB reader blurred");
    	isActive = false;
  	}}
	on:keydown={handleKeyDown}
	tabindex="0"
>

	<!-- 满屏目录面板 -->
	{#if showOutlinePanel}
		<div class="fullscreen-outline-panel" transition:fade on:click={toggleOutlinePanel}>
			<div class="outline-modal" on:click|stopPropagation>
				<div class="outline-modal-header">
					<h2>目录</h2>
					<button class="close-button" on:click={toggleOutlinePanel}>✕</button>
				</div>
				<div class="outline-modal-content"
					 bind:this={fullscreenChaptersContainer}>
					{#each chapters as chapter}
						<button
							class="chapter-item"
							class:active={currentChapter?.id === chapter.id}
							use:setChapterElement={chapter.id}
							on:click={async () => {
								await jumpToChapter(chapter.id);
								showOutlinePanel = false;
							}}
						>
							<span class="chapter-title">{chapter.title}</span>
							<span class="chapter-number">第 {chapter.id} 章</span>
						</button>
						{#if chapter.subChapters && chapter.subChapters.length > 0}
							<div class="sub-chapters">
								{#each chapter.subChapters as subChapter}
									<button
										class="sub-chapter-item"
										class:active={currentChapter?.id === subChapter.id}
										use:setChapterElement={subChapter.id}
										on:click={async () => {
											await jumpToChapter(subChapter.id);
											showOutlinePanel = false;
										}}
									>
										<span class="sub-chapter-title">{subChapter.title}</span>
										<span class="chapter-number">第 {subChapter.id} 章</span>
									</button>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}

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
				<div class="chapters-scroll"
					 bind:this={hoverChaptersContainer}>
					{#if viewMode === 'chapters'}
						<!-- 目录视图 -->
						{#each chapters as chapter}
							<button
								class="chapter-item"
								class:active={currentChapter?.id === chapter.id}
								class:level-0={chapter.level === 0}
								class:level-1={chapter.level === 1}
								use:setChapterElement={chapter.id}
								style="margin-left: {chapter.level === 1 ? '20px' : '0'}"
								on:click={async () => {
									// 使用统一的jumpToChapter函数，确保逻辑一致
									await jumpToChapter(chapter.id);
									// 重新激活键盘导航
									isActive = true;
								}}
							>
								<span class="chapter-indent">
									{#if chapter.level === 1}
										<span class="chapter-bullet">•</span>
									{/if}
									{chapter.title}
								</span>
							</button>
						{/each}
					{:else}
						<!-- 页码视图 -->
						{#each virtualPages as page}
							<button
								class="page-item"
								class:active={page.pageNum === currentPageNum}
								on:click={() => jumpToPage(page.pageNum)}
							>
								<span class="page-title">
									第 {page.pageNum} 页
									{#if page.subPage}
										<span class="sub-page-info">({page.subPage}/{page.totalSubPages})</span>
									{/if}
								</span>
								<span class="page-chapter">{page.chapterTitle}</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if displayMode === 'outline' || displayMode === 'sidebar'}
		<div class="outline-panel" transition:fade>
			<div class="outline-header">
				<h3>目录</h3>
			</div>
			<div class="outline-content">
				{#each chapters as chapter}
					<button
						class="chapter-item"
						class:active={currentChapter?.id === chapter.id}
						class:level-0={chapter.level === 0}
						class:level-1={chapter.level === 1}
						style="margin-left: {chapter.level === 1 ? '20px' : '0'}"
						on:click={async () => {
							// 使用辅助函数显示章节
							const success = await displayChapter(chapter);
							if (success) {
								currentChapter = chapter;
								currentChapterId = chapter.id;
								saveProgress();

								// 触发事件以记录历史
								dispatch('chapterChanged', {
									chapterId: chapter.id,
									chapterTitle: chapter.title
								});

								// 重新激活键盘导航
								isActive = true;
							}
    					}}
					>
    					<span class="chapter-indent">
        					{#if chapter.level === 1}
            					<span class="chapter-bullet">•</span>
        					{/if}
							{chapter.title}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="content-area" id={`content-area-${viewInstanceId}`}>
		{#if isLoading}
			<LoadingSpinner message="正在加载EPUB电子书..." />
		{/if}

		<!-- 添加文本选择菜单 -->
		{#if showMenu}
			<div
				class="selection-menu"
				style="left: {menuPosition.x}px; top: {menuPosition.y}px"
				on:click|stopPropagation
			>
				<button class="menu-item" on:click={handleCopy}>
					复制
				</button>
				<button class="menu-item" on:click={handleAddNote}>
					添加笔记
				</button>
			</div>
		{/if}

		{#if showNoteDialog}
			<NoteDialog
				isOpen={showNoteDialog}
				selectedText={selectedTextForNote}
				existingNote={selectedNote}
				on:save={handleNoteSave}
				on:close={handleNoteDialogClose}
			/>
		{/if}

		<!-- 章节导航栏 -->
		<div class="chapter-navigation">
			<button
				class="nav-button prev-chapter"
				disabled={!currentChapter || chapters.findIndex(ch => ch.id === currentChapter?.id) === 0}
				on:click={() => handleSwitchChapter('prev')}
				title="上一章"
			>
				← 上一章
			</button>
			<button
				class="nav-button toggle-outline"
				on:click={toggleOutlinePanel}
				title="目录"
			>
				目录
			</button>
			<button
				class="nav-button next-chapter"
				disabled={!currentChapter || chapters.findIndex(ch => ch.id === currentChapter?.id) === chapters.length - 1}
				on:click={() => handleSwitchChapter('next')}
				title="下一章"
			>
				下一章 →
			</button>
		</div>
	</div>


</div>

<div class="toolbar">
	<ReaderSettingsMenu
		plugin={plugin}
		novel={novel}
		readerType="epub"
		currentChapterId={currentChapter?.id}
		notes={notes}
		readingStats={readingStats}
		chapterHistory={chapterHistory}
		on:jumpToChapter={async (event) => {
    		await jumpToChapter(event.detail.chapterId);
  		}}
		on:editNote={handleNoteEdit}
	/>
</div>

<style>
	/* 设置 */
	.toolbar {
		position: fixed;
		top: 30px;
		right: 10px;
		z-index: 1000;
	}

	.epub-reader {
		height: 100%;
		display: flex;
		flex-direction: row; /* 确保水平布局 */
		position: relative;
		overflow: hidden;
	}

	.epub-reader.outline-mode {
		flex-direction: row;
	}

	/* 悬浮模式样式 */
	.chapter-trigger {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 50px;
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
		flex-shrink: 0; /* 防止收缩 */
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		background: var(--background-primary);
		z-index: 10;
	}

	.outline-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.outline-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.chapter-item {
		width: calc(100% - 20px); /* 减去可能的缩进空间 */
		margin-bottom: 4px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		white-space: nowrap; /* 防止文本换行 */
		overflow: hidden; /* 隐藏溢出的内容 */
		text-overflow: ellipsis; /* 显示省略号 */
		/* 给省略号留出空间 */
		display: block; /* 改变按钮的默认display行为 */
		padding: 8px 16px 8px 8px;
		color: var(--text-normal);
		transition: background-color 0.2s;
		position: relative; /* 添加相对定位以支持滚动定位 */
		font-size: 14px;
	}

	.chapter-item:hover {
		background: var(--background-modifier-hover);
	}

	.chapter-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
		font-weight: 500;
	}

	.chapter-indent {
		display: flex;
		align-items: center;
		width: 100%;
		padding-left: 28px; /* 调整缩进距离 */
	}

	.chapter-bullet {
		font-size: 12px;
		margin-right: 6px;
		color: var(--text-muted);
		margin-left: -14px; /* 调整圆点的位置 */
	}

	/* 大章节保持原样 */
	.chapter-item.level-0 {
		font-weight: 500;
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		margin-top: 8px;
	}

	/* 修改小章节的样式 */
	.chapter-item.level-1 {
		font-size: 13px;
		color: var(--text-muted);
		padding-top: 4px;
		padding-bottom: 4px;
		padding-left: 0; /* 移除左内边距 */
		margin-left: -8px; /* 向左移动以对齐 • 符号 */
	}

	.chapter-item.level-1:hover {
		color: var(--text-normal);
	}

	/* 确保active状态的蓝色优先级最高，覆盖level-0和level-1的默认颜色 */
	.chapter-item.level-0.active,
	.chapter-item.level-1.active {
		color: var(--text-accent);
		font-weight: 500;
	}

	.page-item {
		width: 100%;
		margin-bottom: 4px;
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--text-normal);
		transition: background-color 0.2s;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.page-item:hover {
		background: var(--background-modifier-hover);
	}

	.page-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.page-title {
		font-weight: 500;
	}

	.sub-page-info {
		font-size: 0.85em;
		color: var(--text-muted);
		margin-left: 4px;
	}

	.page-chapter {
		font-size: 0.85em;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content-area {
		flex: 1;
		overflow: hidden;
		position: relative;
		padding-bottom: 56px; /* 为底部导航栏留出空间 */
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 1.2em;
	}

	.toolbar {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 1000;
	}

	:global(.epub-viewer-container) {
		width: 100%;
		height: 100%;
		overflow-y: auto !important;
	}

	/* EPUB iframe 内部样式 */
	:global(.epub-viewer-container iframe) {
		width: 100% !important;
		height: 100% !important;
	}

	/* EPUB 文档样式 */
	:global(.epub-doc) {
		padding: 20px 40px !important;
		line-height: 1.6 !important;
		font-size: 16px !important;
	}

	:global(.epub-doc p) {
		margin: 1em 0 !important;
	}

	/* 漫画阅读器相关样式 */
	:global(.epub-viewer-container.manga-mode) {
		width: 100%;
		height: 100%;
		overflow-y: auto !important;
		scroll-behavior: smooth;
	}

	:global(.epub-viewer-container.manga-mode iframe) {
		width: 100% !important;
		min-height: 100% !important;
		border: none !important;
	}

	:global(.manga-content) {
		margin: 0 !important;
		padding: 0 !important;
		line-height: 0 !important;
	}

	:global(.manga-content img) {
		max-width: 100% !important;
		height: auto !important;
		display: block !important;
		margin: 0 auto !important;
	}

	/* 优化滚动条样式 */
	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-track) {
		background: var(--background-primary);
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb) {
		background: var(--background-modifier-border);
		border-radius: 4px;
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb:hover) {
		background: var(--background-modifier-hover);
	}

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

	/* 添加显示隐藏的动画效果 */
	.selection-menu.entering {
		opacity: 0;
		transform: translate(-50%, 10px);
	}

	.selection-menu.visible {
		opacity: 1;
		transform: translate(-50%, 0);
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

	/* 章节导航栏样式 */
	.chapter-navigation {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		padding: 10px 20px 10px 20px;
		background: var(--background-primary);
		border-top: 1px solid var(--background-modifier-border);
		z-index: 100;
	}

	.nav-button {
		padding: 4px 16px;
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		color: var(--text-normal);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.nav-button:hover:not(:disabled) {
		background: var(--interactive-hover);
		border-color: var(--interactive-accent);
	}

	.nav-button:active:not(:disabled) {
		background: var(--interactive-active);
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.nav-button.toggle-outline {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		font-weight: 500;
	}

	.nav-button.toggle-outline:hover {
		background: var(--interactive-accent-hover);
	}

	/* 满屏目录面板样式 */
	.fullscreen-outline-panel {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.outline-modal {
		background: var(--background-primary);
		border-radius: 8px;
		width: 90%;
		max-width: 800px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.outline-modal-header {
		padding: 16px 20px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.outline-modal-header h2 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-normal);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-button:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.outline-modal-content {
		overflow-y: auto;
		padding: 12px;
		flex: 1;
	}

	.outline-modal-content .chapter-item {
		width: 100%;
		padding: 12px 16px;
		margin-bottom: 4px;
		background: var(--background-secondary);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		text-align: left;
		transition: all 0.2s;
	}

	.outline-modal-content .chapter-item:hover {
		background: var(--background-modifier-hover);
		transform: translateX(4px);
	}

	.outline-modal-content .chapter-item.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.outline-modal-content .chapter-title {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
	}

	.outline-modal-content .chapter-number {
		font-size: 12px;
		color: var(--text-muted);
		margin-left: 12px;
	}

	.outline-modal-content .chapter-item.active .chapter-number {
		color: var(--text-on-accent);
	}

	.outline-modal-content .sub-chapters {
		margin-left: 20px;
	}

	.outline-modal-content .sub-chapter-item {
		width: 100%;
		padding: 8px 12px;
		margin-bottom: 2px;
		background: var(--background-primary);
		border: none;
		border-left: 2px solid var(--background-modifier-border);
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
		text-align: left;
		transition: all 0.2s;
	}

	.outline-modal-content .sub-chapter-item:hover {
		background: var(--background-modifier-hover);
		border-left-color: var(--interactive-accent);
	}

	.outline-modal-content .sub-chapter-item.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-left-color: var(--interactive-accent);
	}

	.outline-modal-content .sub-chapter-title {
		flex: 1;
		font-size: 13px;
	}

	.outline-modal-content .sub-chapter-item .chapter-number {
		font-size: 11px;
	}

</style>
