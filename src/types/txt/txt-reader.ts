
//TXT章节-阅读进度
export interface ChapterProgress {
	id: number;
	title: string;
	content: string;
	startPos: number;
	endPos: number;
	level?: number; // 章节层级：0=一级标题，1=二级标题
}



