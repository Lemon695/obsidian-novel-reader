import type { ChapterProgress} from "../../types/txt/txt-reader";

// 处理历史记录跳转
export function handleJumpToChapter(
	chapterId: number,
	chapters: ChapterProgress[],
	onChapterSelect: (chapter: ChapterProgress) => void
) {
	const chapter = chapters.find(ch => ch.id === chapterId);
	if (chapter) {
		onChapterSelect(chapter);
	}
}
