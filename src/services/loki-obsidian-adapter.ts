import type {App} from "obsidian";
import type NovelReaderPlugin from "../main";

export class LokiObsidianAdapter implements LokiPersistenceAdapter {
	private app: App;
	private plugin: NovelReaderPlugin;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * 加载数据库
	 */
	async loadDatabase(dbname: string): Promise<string> {
		try {
			const exists = await this.app.vault.adapter.exists(dbname);
			if (!exists) {
				return '';
			}
			const content = await this.app.vault.adapter.read(dbname);
			return content;
		} catch (err) {
			console.error('Error loading database:', err);
			throw err;
		}
	}

	/**
	 * 保存数据库
	 */
	async saveDatabase(dbname: string, dbstring: string): Promise<void> {
		try {
			// 检查目标目录是否存在
			const dirPath = dbname.substring(0, dbname.lastIndexOf('/'));
			const dirExists = await this.app.vault.adapter.exists(dirPath);

			if (!dirExists) {
				await this.app.vault.adapter.mkdir(dirPath);
			}

			await this.app.vault.adapter.write(dbname, dbstring);
		} catch (err) {
			console.error('Error saving database:', err);
			throw err;
		}
	}

	/**
	 * 删除数据库
	 */
	async deleteDatabase(dbname: string): Promise<boolean> {
		try {
			const exists = await this.app.vault.adapter.exists(dbname);
			if (exists) {
				await this.app.vault.adapter.remove(dbname);
				return true;
			}
			return false;
		} catch (err) {
			console.error('Error deleting database:', err);
			throw err;
		}
	}
}
