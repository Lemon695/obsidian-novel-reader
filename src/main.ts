import { App, Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } from 'obsidian';
import * as path from 'path';
import * as fs from 'fs';

interface NovelSplitterSettings {
	chapterPattern: string;
	outputFolder: string;
	readmeTemplate: string;
}

const DEFAULT_SETTINGS: NovelSplitterSettings = {
	chapterPattern: '第(\\d+)章',
	outputFolder: '小说章节',
	readmeTemplate: `# 《{novelName}》阅读目录

## 章节列表

{chapterLinks}

## 阅读说明

使用本文档可以快速导航到各个章节。点击下方链接即可阅读对应章节。

## 关于本书

- **书名**：{novelName}
- **总章节数**：{totalChapters}
`
}

export default class NovelSplitterPlugin extends Plugin {
	settings: NovelSplitterSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'split-novel',
			name: '拆分小说并创建阅读索引',
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
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice('仅支持桌面版Obsidian');
			return;
		}

		const { dialog } = require('electron').remote;
		const filePaths = dialog.showOpenDialogSync({
			properties: ['openFile'],
			filters: [{ name: 'Text Files', extensions: ['txt'] }]
		});

		if (!filePaths || filePaths.length === 0) return;

		try {
			const filePath = filePaths[0];
			const content = fs.readFileSync(filePath, 'utf-8');
			const novelName = path.basename(filePath, '.txt');

			// 使用正则表达式匹配章节
			const chapterRegex = new RegExp(this.settings.chapterPattern, 'g');
			const chapters = this.parseChapters(content, chapterRegex);

			// 创建输出文件夹
			const basePath = path.join(
				adapter.getBasePath(),
				this.app.vault.getName(),
				this.settings.outputFolder,
				novelName
			);

			if (!fs.existsSync(basePath)) {
				fs.mkdirSync(basePath, { recursive: true });
			}

			// 保存原始TXT文件
			const originalTxtPath = path.join(basePath, `${novelName}.txt`);
			fs.writeFileSync(originalTxtPath, content);

			// 保存章节TXT文件
			const chapterLinks: string[] = [];
			chapters.forEach((chapter, index) => {
				const chapterNumber = index + 1;
				const chapterFileName = `第${chapterNumber.toString().padStart(3, '0')}章.txt`;
				const chapterPath = path.join(basePath, chapterFileName);
				fs.writeFileSync(chapterPath, chapter.content);

				// 创建对应的阅读MD文件
				const readMdFileName = `第${chapterNumber.toString().padStart(3, '0')}章-阅读.md`;
				const readMdPath = path.join(basePath, readMdFileName);
				const mdContent = this.generateChapterMdContent(chapter.content);
				fs.writeFileSync(readMdPath, mdContent);

				// 记录章节链接
				chapterLinks.push(`- [第${chapterNumber}章](/小说章节/${novelName}/${readMdFileName})`);
			});

			// 创建小说阅读索引文件
			const readmeContent = this.settings.readmeTemplate
				.replace('{novelName}', novelName)
				.replace('{totalChapters}', chapters.length.toString())
				.replace('{chapterLinks}', chapterLinks.join('\n'));

			const readmePath = path.join(basePath, `${novelName}-阅读.md`);
			fs.writeFileSync(readmePath, readmeContent);

			new Notice(`成功拆分 ${chapters.length} 个章节到 ${novelName} 文件夹`);
		} catch (error) {
			console.error('小说拆分错误:', error);
			new Notice(`拆分失败: ${error.message}`);
		}
	}

	generateChapterMdContent(chapterContent: string): string {
		return `
## 章节内容

<div class="novel-reader">
${chapterContent.split('\n').map(line => `<p>${line}</p>`).join('\n')}
</div>

<style>
.novel-reader {
    max-width: 700px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.8;
    font-family: 'Georgia', serif;
    background-color: #f9f5f0;
    color: #333;
}

.novel-reader p {
    text-indent: 2em;
    margin-bottom: 1em;
}
</style>
        `.trim();
	}

	parseChapters(content: string, regex: RegExp) {
		const chapters: Array<{title: string, content: string, startIndex: number}> = [];
		let match;

		while ((match = regex.exec(content)) !== null) {
			if (chapters.length > 0) {
				const previousChapter = chapters[chapters.length - 1];
				previousChapter.content = content.slice(previousChapter.startIndex, match.index).trim();
			}

			chapters.push({
				title: match[0],
				content: '',
				startIndex: match.index
			});
		}

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
