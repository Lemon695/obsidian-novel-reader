import type {TFile} from 'obsidian';
import type NovelReaderPlugin from '../main';
import type {Novel} from '../types';
import {parseChapters} from "./txt.reader/chapter-logic";

export async function getOrLoadFile(
	file: TFile,
	plugin: NovelReaderPlugin
): Promise<string | ArrayBuffer> {
	const cachedContent = await plugin.obsidianCacheService.getFileContent(file);
	if (cachedContent) {
		return cachedContent;
	}

	const content = file.extension === 'txt'
		? await plugin.app.vault.read(file)
		: await plugin.app.vault.readBinary(file);

	await plugin.obsidianCacheService.setFileContent(file, content);
	return content;
}

export async function getOrParseChapters(
	file: TFile,
	novel: Novel,
	content: string,
	plugin: NovelReaderPlugin
): Promise<any[]> {
	const cachedChapters = await plugin.obsidianCacheService.getChaptersCache(file);
	if (cachedChapters) {
		return cachedChapters;
	}

	const chapters = parseChapters(content, novel);

	await plugin.obsidianCacheService.setChaptersCache(file, chapters);
	return chapters;
}

export async function invalidateCache(
	file: TFile,
	plugin: NovelReaderPlugin
): Promise<void> {
	await plugin.obsidianCacheService.clearFileCache(file.path);
}
