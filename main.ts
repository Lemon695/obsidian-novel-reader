import {App, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter} from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';

interface NovelSplitterSettings {
	chapterPattern: string;
	outputFolder: string;
}

const DEFAULT_SETTINGS: NovelSplitterSettings = {
	chapterPattern: '第(\\d+)章',
	outputFolder: '小说章节'
}

export default class NovelSplitterPlugin extends Plugin {
	settings: NovelSplitterSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'split-novel',
			name: '拆分小说文件',
			callback: () => this.splitNovelFile()
		});

		this.addSettingTab(new NovelSplitterSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async splitNovelFile() {
		// 使用文件系统适配器选择文件
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice('仅支持桌面版Obsidian');
			return;
		}

		// 使用Node.js的文件对话框
		const {dialog} = require('electron').remote;
		const filePaths = dialog.showOpenDialogSync({
			properties: ['openFile'],
			filters: [{name: 'Text Files', extensions: ['txt']}]
		});

		if (!filePaths || filePaths.length === 0) return;

		try {
			// 读取文件内容
			const filePath = filePaths[0];
			const content = fs.readFileSync(filePath, 'utf-8');

			// 获取小说文件名（不包含扩展名）
			const novelName = path.basename(filePath, '.txt');

			// 使用正则表达式匹配章节
			const chapterRegex = new RegExp(this.settings.chapterPattern, 'g');
			const chapters = this.parseChapters(content, chapterRegex);

			// 创建输出文件夹（包括小说名称子文件夹）
			const outputPath = path.join(
				adapter.getBasePath(),
				this.app.vault.getName(),
				this.settings.outputFolder,
				novelName
			);

			if (!fs.existsSync(outputPath)) {
				fs.mkdirSync(outputPath, {recursive: true});
			}

			// 保存每个章节
			chapters.forEach((chapter, index) => {
				const fileName = `第${index + 1}章.md`;
				const fullPath = path.join(outputPath, fileName);
				fs.writeFileSync(fullPath, chapter.content);
			});

			new Notice(`成功拆分 ${chapters.length} 个章节到 ${novelName} 文件夹`);
		} catch (error) {
			console.error('小说拆分错误:', error);
			new Notice(`拆分失败: ${error.message}`);
		}
	}

	parseChapters(content: string, regex: RegExp) {
		const chapters: Array<{ title: string, content: string, startIndex: number }> = [];
		let match;

		while ((match = regex.exec(content)) !== null) {
			// 如果不是第一章，更新前一章的内容
			if (chapters.length > 0) {
				const previousChapter = chapters[chapters.length - 1];
				previousChapter.content = content.slice(previousChapter.startIndex, match.index).trim();
			}

			// 添加新章节
			chapters.push({
				title: match[0],
				content: '',
				startIndex: match.index
			});
		}

		// 处理最后一章
		if (chapters.length > 0) {
			const lastChapter = chapters[chapters.length - 1];
			lastChapter.content = content.slice(lastChapter.startIndex).trim();
		}

		return chapters;
	}
}

class NovelSplitterSettingTab extends PluginSettingTab {
	plugin: NovelSplitterPlugin;

	constructor(app: App, plugin: NovelSplitterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('章节匹配模式')
			.setDesc('用于识别章节的正则表达式')
			.addText(text => text
				.setPlaceholder('默认: 第(\\d+)章')
				.setValue(this.plugin.settings.chapterPattern)
				.onChange(async (value) => {
					this.plugin.settings.chapterPattern = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('输出文件夹')
			.setDesc('拆分后的章节保存位置')
			.addText(text => text
				.setPlaceholder('小说章节')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));
	}
}
