export interface Note {
	id: string;             // 笔记唯一ID
	chapterId: number;      // 章节ID
	chapterName: string;    // 章节名称
	selectedText: string;   // 选中的文本
	content: string;        // 笔记内容
	timestamp: number;      // 创建时间
	updatedAt?: number;     // 更新时间
	textIndex: number;      // 文本在章节中的位置索引
	textLength: number;     // 选中文本的长度
	lineNumber: number;     // 添加行号
	pdfLocation?: {
		page: number;
		xPct: number;
		yPct: number;
		wPct: number;
		hPct: number;
		rects?: Array<{
			xPct: number;
			yPct: number;
			wPct: number;
			hPct: number;
		}>;
	};
}

export interface NovelNotes {
	novelId: string;
	novelName: string;     //小说名称
	notes: Note[];
}
