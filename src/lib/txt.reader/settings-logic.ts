import {parseChapters} from "./chapter-logic";
import type {Novel} from "../../types";
import type {ChapterProgress} from "../../types/txt/txt-reader";

// export function clearPattern() { }
// export function handleSettingsClick(event: MouseEvent) { }
// export function handleMenuSelect(option: 'settings' | 'history') { }
// export function handleGlobalClick(event: MouseEvent) { }

export function savePattern(
	customPattern: string,
	novel: Novel,
	content: string,
	onParseDone: (chapters: ChapterProgress[]) => void,
	onUpdateNovel: (novel: Novel) => void,
	onClose: () => void,
	onError: (message: string) => void
) {
	if (!customPattern.trim()) return;

	try {
		// 测试正则是否有效
		new RegExp(customPattern);
		console.log('保存新的正则表达式:', customPattern);

		// 更新小说设置
		const updatedNovel = {
			...novel,
			customSettings: {
				...novel.customSettings,
				chapterPattern: customPattern
			}
		};

		// 使用现有方法重新解析章节
		const newChapters = parseChapters(content, updatedNovel);
		console.log('使用新正则解析章节数:', newChapters.length);

		// 如果解析成功，更新章节和视图
		if (newChapters.length > 0) {
			onParseDone(newChapters);
			onUpdateNovel(updatedNovel);

			// 触发章节更新事件
			window.dispatchEvent(new CustomEvent('chaptersUpdated', {
				detail: { chapters: newChapters }
			}));

			onClose();
		} else {
			onError('无法解析出章节');
			return;
		}
	} catch (e) {
		onError('无效的正则表达式');
	}
}
