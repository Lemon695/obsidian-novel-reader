import {App, PluginSettingTab, Setting, TextAreaComponent} from 'obsidian';
import NovelReaderPlugin from '../main';

export class NovelReaderSettingTab extends PluginSettingTab {
	plugin: NovelReaderPlugin;

	constructor(app: App, plugin: NovelReaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('章节显示模式')
			.setDesc('选择章节目录的显示方式')
			.addDropdown(dropdown => dropdown
				.addOption('hover', '悬浮章节')
				.addOption('outline', '大纲章节')
				.addOption('sidebar', '侧边栏')
				.setValue(this.plugin.settings.chapterDisplayMode)
				.onChange(async (value) => {
					this.plugin.settings.chapterDisplayMode = value as 'hover' | 'outline' | 'sidebar';
					await this.plugin.saveSettings();
				})
			);

		containerEl.createEl('h3', {text: '屏蔽设置'});

		new Setting(containerEl)
			.setName('屏蔽具体路径')
			.setDesc('每行一个路径，将屏蔽与路径完全匹配的小说')
			.addTextArea(text => {
				text
					.setPlaceholder('示例：\nfolder1/book1.txt\nfolder2/book2.txt')
					.setValue(this.plugin.settings.blockConfig.specificPaths.join('\n'))
					.onChange(async (value) => {
						// 将输入文本按行分割,过滤空行
						this.plugin.settings.blockConfig.specificPaths = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						await this.plugin.saveSettings();
					});

				this.setTextAreaStyle(text);
			});

		new Setting(containerEl)
			.setName('屏蔽正则表达式')
			.setDesc('每行一个正则表达式，将屏蔽所有匹配的小说路径')
			.addTextArea(text => {
				text
					.setPlaceholder('示例：\n.*测试.*\\.txt\n.*临时.*\\.txt')
					.setValue(this.plugin.settings.blockConfig.patterns.join('\n'))
					.onChange(async (value) => {
						// 将输入文本按行分割,过滤空行
						this.plugin.settings.blockConfig.patterns = value.split('\n')
							.map(line => line.trim())
							.filter(line => line.length > 0);
						await this.plugin.saveSettings();
					});

				this.setTextAreaStyle(text);
			});

		new Setting(containerEl)
			.setName('小说笔记路径')
			.setDesc('设置小说笔记文档存储的路径')
			.addText(text => text
				.setPlaceholder('例如: novels')
				.setValue(this.plugin.settings.notePath)
				.onChange(async (value) => {
					this.plugin.settings.notePath = value;
					await this.plugin.saveSettings();
				}));
	}

	// 设置文本框样式
	private setTextAreaStyle(textArea: TextAreaComponent) {
		textArea.inputEl.rows = 4;
		textArea.inputEl.cols = 50;
		textArea.inputEl.style.width = '100%';
	}
}
