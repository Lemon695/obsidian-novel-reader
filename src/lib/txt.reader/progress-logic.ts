import type {Novel, ReadingProgress} from "../../types";
import type {ChapterProgress} from "../../types/txt/txt-reader";

// export function startNewSession() { }
// export function endCurrentSession() { }
// export function updateActivity() { }
// export function initializeReadingSession() { }

// 保存阅读进度 - 返回进度对象而不是发送全局事件
export function saveReadingProgress(novel: Novel, currentChapter: ChapterProgress, chapters: ChapterProgress[]): ReadingProgress | null {
	if (!currentChapter || !chapters.length) return null;

	const progress: ReadingProgress = {
		novelId: novel.id,
		chapterIndex: currentChapter.id,
		progress: (currentChapter.id / chapters.length) * 100,
		timestamp: Date.now(),
		totalChapters: chapters.length,
		position: {
			chapterId: currentChapter.id,
			chapterTitle: currentChapter.title,
			cfi: '',  // TXT不使用CFI，设置为空字符串
			percentage: 0  // TXT基于章节，percentage设置为0
		}
	};

	console.log(`saveReadingProgress.保存阅读进度--->${currentChapter.id},${currentChapter.title},${JSON.stringify(progress)}`)

	// 返回进度对象，由组件通过dispatch发送事件，避免全局事件导致多视图互相干扰
	return progress;
}
