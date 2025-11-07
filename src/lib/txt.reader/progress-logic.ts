import type {Novel} from "../../types";
import type {ChapterProgress} from "../../types/txt/txt-reader";

// export function startNewSession() { }
// export function endCurrentSession() { }
// export function updateActivity() { }
// export function initializeReadingSession() { }

// 保存阅读进度
export function saveReadingProgress(novel: Novel, currentChapter: ChapterProgress, chapters: ChapterProgress[]) {
	if (!currentChapter || !chapters.length) return;

	const progress = {
		novelId: novel.id,
		chapterIndex: currentChapter.id,
		progress: (currentChapter.id / chapters.length) * 100,
		timestamp: Date.now(),
		totalChapters: chapters.length,
		position: {
			chapterId: currentChapter.id,
			chapterTitle: currentChapter.title,
		}
	};

	console.log(`saveReadingProgress.保存阅读进度--->${currentChapter.id},${currentChapter.title},${JSON.stringify(progress)}`)

	// 发送自定义事件通知父组件保存进度
	const event = new CustomEvent('saveProgress', {
		detail: {progress}
	});
	window.dispatchEvent(event);
}
