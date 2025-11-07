import {Modal, App, Setting} from 'obsidian';

export class ConfirmationDialog extends Modal {
	private result: boolean = false;
	private resolvePromise: ((value: boolean) => void) | null = null;

	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText: string = '确认',
		private cancelText: string = '取消'
	) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;

		// 设置标题
		contentEl.createEl('h2', {text: this.title});

		// 设置消息
		contentEl.createEl('p', {text: this.message});

		// 创建按钮
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.cancelText)
				.onClick(() => {
					this.result = false;
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText(this.confirmText)
				.setCta() // 设置为主要按钮
				.onClick(() => {
					this.result = true;
					this.close();
				}));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
		if (this.resolvePromise) {
			this.resolvePromise(this.result);
		}
	}

	async openAndWait(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}
}
