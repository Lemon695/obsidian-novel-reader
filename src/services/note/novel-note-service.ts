import { App, TFile, parseYaml, stringifyYaml } from 'obsidian';
import type NovelReaderPlugin from '../../main';
import type { Novel } from '../../types';

export class NovelNoteService {

	constructor(private app: App, private plugin: NovelReaderPlugin) {
	}

	async createOrOpenNote(novel: Novel): Promise<void> {
		const notePath = await this.getNotePath(novel);
		let file = this.app.vault.getAbstractFileByPath(notePath);

		if (!file) {
			// 创建新的笔记文件
			file = await this.createNoteFile(novel, notePath);
		}

		// 在新标签页打开笔记
		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.openFile(file as TFile);
	}

	public async getNotePath(novel: Novel): Promise<string> {
		const today = new Date();
		const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
		const basePath = this.plugin.settings.notePath;

		// 确保目录存在
		const dirPath = `${basePath}/${yearMonth}`;
		if (!(await this.app.vault.adapter.exists(dirPath))) {
			await this.app.vault.createFolder(dirPath);
		}

		// 使用 "书名 (格式)" 命名以区分多格式版本
		const formatStr = novel.format.toUpperCase();
		return `${dirPath}/${novel.title} (${formatStr}).md`;
	}

	private async createNoteFile(novel: Novel, path: string): Promise<TFile> {
		// 创建增强型 YAML 元数据
		const frontmatter = {
			novel_id: novel.id,
			novel_title: novel.title,
			novel_author: novel.author || 'Unknown',
			novel_path: novel.path,
			novel_cover: '',
			status: '📖 正在阅读',
			rating: '⭐⭐⭐⭐⭐',
			tags: ['#novel-reader/reading'],
			created: new Date().toISOString()
		};

		const content = '---\n' +
			stringifyYaml(frontmatter) +
			'---\n\n' +
			`# ${novel.title}\n\n` +
			`> [!abstract] 图书概览\n` +
			`> - **作者**: ${novel.author || 'Unknown'}\n` +
			`> - **格式**: ${novel.format.toUpperCase()}\n` +
			`> - **来源**: ${novel.path}\n` +
			`> - **状态**: #reading\n\n` +
			'---\n\n' +
			'## 📅 阅读记录\n' +
			`- [x] ${new Date().toLocaleDateString()} 开始阅读\n\n` +
			'## ✍️ 读书笔记\n' +
			'> 记录你的思考和感悟...\n\n' +
			'## 🔖 章节摘录\n' +
			'> 复制书中的精彩段落到这里...\n\n' +
			'---\n' +
			'%% 此笔记由 Obsidian Novel Reader 自动生成。 %%\n';

		return await this.app.vault.create(path, content);
	}

	async getNovelCover(novel: Novel): Promise<string | null> {
		if (!novel.notePath) return null;

		const file = this.app.vault.getAbstractFileByPath(novel.notePath);
		if (!(file instanceof TFile)) return null;

		try {
			const content = await this.app.vault.read(file);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) return null;

			const frontmatter = parseYaml(frontmatterMatch[1]);
			const coverPath = frontmatter.novel_cover;

			if (!coverPath) return null;

			return await this.plugin.coverManagerService.getNovelCover(coverPath);
		} catch (error) {
			console.error('Error reading novel cover:', error);
			return null;
		}
	}


	async updateNovelMetadata(novel: Novel): Promise<void> {
		if (!novel.notePath) return;

		const file = this.app.vault.getAbstractFileByPath(novel.notePath);
		if (!(file instanceof TFile)) return;

		try {
			let content = await this.app.vault.read(file);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

			// 更新前置元数据，但保留 novel_cover
			const metadata = {
				novel_id: novel.id,
				novel_title: novel.title,
				novel_author: novel.author,
				novel_path: novel.path,
				last_updated: new Date().toISOString()
			};

			if (frontmatterMatch) {
				// 如果已有前置元数据，保留现有的 novel_cover
				const existingFrontmatter = parseYaml(frontmatterMatch[1]);
				const updatedFrontmatter = {
					...existingFrontmatter,
					...metadata,
					// 如果存在现有的 novel_cover，保留它
					novel_cover: existingFrontmatter.novel_cover || ''
				};

				content = content.replace(
					/^---\n[\s\S]*?\n---/,
					`---\n${stringifyYaml(updatedFrontmatter)}---`
				);
			} else {
				// 如果没有前置元数据，添加新的（但不包含 cover）
				content = `---\n${stringifyYaml(metadata)}---\n\n${content}`;
			}

			await this.app.vault.modify(file, content);
		} catch (error) {
			console.error('Error updating novel metadata:', error);
			throw error;
		}
	}
}
