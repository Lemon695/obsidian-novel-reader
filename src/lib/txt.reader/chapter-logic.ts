import type {ChapterProgress} from "../../types/txt/txt-reader";
import type {Novel} from "../../types";
import type {EpubChapter} from "../../types/epub/epub-rendition";
import {ChapterHistoryService} from "../../services/chapter-history-service";

export function parseChapters(text: string, novel: Novel): ChapterProgress[] {
	let chapterPatterns = [
		/^[=\-]{2,}[\s]*第[0-9零一二三四五六七八九十百千]+章[^=\-\n]*(?:[=\-]{2,})?$/g,
		/^第[0-9零一二三四五六七八九十百千]+章[^\n]*$/g,
		/第[0-9零一二三四五六七八九十百千]+章[^\n]*$/g,
		/第[0-9零一二三四五六七八九十百千]+章/g,
		/第[0-9零一二三四五六七八九十百千]+回/g,
		/^第[0-9]+章[^\n]*$/g,
		/^Chapter\s+[0-9]+[^\n]*$/g,
		/^正文\s*[0-9]+[^\n]*$/g,
		/^序章[^\n]*$/g,
		/^楔子[^\n]*$/g,
		/^尾声[^，。,\n]*$/g,
		/^后记[^\n]*$/g
	];

	// 如果有自定义正则，添加到数组开头
	if (novel?.customSettings?.chapterPattern) {
		try {
			const customPattern = new RegExp(novel.customSettings.chapterPattern, 'g');
			chapterPatterns.unshift(customPattern);
			console.log('使用自定义正则解析章节:', novel.customSettings.chapterPattern);
		} catch (e) {
			console.error('自定义正则表达式无效:', e);
		}
	}

	const allMatches: { index: number, text: string }[] = [];

	chapterPatterns.forEach(pattern => {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			if (match.index !== undefined) {
				allMatches.push({
					index: match.index,
					text: match[0]
				});
			}
		}
	});

	allMatches.sort((a, b) => a.index - b.index);

	return allMatches.map((match, index) => {
		const startPos = match.index;
		const endPos = index < allMatches.length - 1 ? allMatches[index + 1].index : text.length;
		const lineEndIndex = text.indexOf('\n', startPos);
		const title = text.slice(startPos, lineEndIndex > -1 ? lineEndIndex : startPos + 50).trim();
		let chapterContent = text.slice(startPos, endPos).trim();
		chapterContent = chapterContent.replace(/\n{3,}/g, '\n\n');

		return {
			id: index + 1,
			title,
			content: chapterContent,
			startPos,
			endPos
		};
	});
}

// 处理章节切换时记录历史
export function handleChapterChange(
	chapter: ChapterProgress,
	novel: Novel,
	historyService: ChapterHistoryService,
	onHistoryUpdate: (history: any[]) => void,
) {
	if (chapter && novel) {
		historyService.addHistory(novel.id, chapter.id, chapter.title)
			.then(() => historyService.getHistory(novel.id))
			.then((history: any[]) => onHistoryUpdate(history));
	}
}

export function handleChapterChangeEPUB(
	chapter: EpubChapter,
	novel: Novel,
	historyService: ChapterHistoryService,
	onHistoryUpdate: (history: any[]) => void,
	pageIndex?: number
) {
	if (chapter && novel) {
		historyService.addHistory(novel.id, chapter.id, chapter.title)
			.then(() => historyService.getHistory(novel.id))
			.then((history: any[]) => onHistoryUpdate(history));
	}

}

export function switchChapter(
	direction: 'prev' | 'next',
	currentChapter: ChapterProgress | null,
	chapters: ChapterProgress[],
	onChapterChange: (chapter: ChapterProgress) => void,
	onScrollToTop?: () => void // 可选参数，允许外部传递滚动逻辑
) {
	if (!currentChapter || chapters.length === 0) return;

	const currentIndex = chapters.findIndex(ch => ch.id === currentChapter.id);
	if (currentIndex === -1) return;

	let nextIndex: number;
	if (direction === 'prev') {
		nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
	} else {
		nextIndex = currentIndex < chapters.length - 1 ? currentIndex + 1 : currentIndex;
	}

	if (nextIndex !== currentIndex) {
		onChapterChange(chapters[nextIndex]);

		// 调用滚动逻辑，如果外部未提供滚动回调，则使用默认逻辑
		if (onScrollToTop) {
			onScrollToTop();
		} else {
			// 默认滚动逻辑
			setTimeout(() => {
				// 首先尝试滚动内容区域
				const contentElement = document.querySelector('.content-area');
				if (contentElement) {
					contentElement.scrollTo({
						top: 0,
						behavior: 'smooth'
					});
				}

				// 同时也重置整个窗口的滚动位置
				window.scrollTo({
					top: 0,
					behavior: 'smooth'
				});
			}, 100); // 短暂延迟,确保新章节内容已渲染
		}
	}
}


