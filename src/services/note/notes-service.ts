import type {App} from 'obsidian';
import type NovelReaderPlugin from '../../main';
import type {Note, NovelNotes} from '../../types/notes';
import {PathsService} from "../utils/paths-service";
import type {Novel} from "../../types";

export class NotesService {
	private app: App;
	private plugin: NovelReaderPlugin;
	private pathsService!: PathsService;

	constructor(app: App, plugin: NovelReaderPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.pathsService = this.plugin.pathsService;
	}

	async saveNotes(novelId: string, novelTitle: string, notes: Note[]): Promise<void> {
		try {
			const notesData = {
				novelId,
				novelName: novelTitle,
				notes
			};

			const notesDir = this.pathsService.getNotesDir();
			const notesPath = this.pathsService.getNotesPath(novelId);

			if (!(await this.app.vault.adapter.exists(notesDir))) {
				await this.app.vault.adapter.mkdir(notesDir);
			}

			await this.app.vault.adapter.write(
				notesPath,
				JSON.stringify(notesData, null, 2)
			);

			console.log('Notes saved successfully');
		} catch (error) {
			console.error('Failed to save notes:', error);
			throw error;
		}
	}

	// 加载笔记数据
	async loadNotes(novelId: string): Promise<Note[]> {
		try {
			const notesPath = this.pathsService.getNotesPath(novelId);

			if (await this.app.vault.adapter.exists(notesPath)) {
				const data = await this.app.vault.adapter.read(notesPath);
				const notesData = JSON.parse(data);
				return notesData.notes;
			}
			return [];
		} catch (error) {
			console.error('Failed to load notes:', error);
			return [];
		}
	}

	async loadNovelNotes(novels: Novel[]): Promise<NovelNotes[]> {
		const novelNotes: NovelNotes[] = [];
		for (const novel of novels) {
			const notesPath = this.plugin.pathsService.getNotePath(novel);
			if (await this.plugin.app.vault.adapter.exists(notesPath)) {
				const data = await this.plugin.app.vault.adapter.read(notesPath);
				novelNotes.push(JSON.parse(data));
			}
		}
		return novelNotes;
	}
}
