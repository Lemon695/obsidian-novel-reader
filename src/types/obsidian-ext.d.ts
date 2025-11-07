import "obsidian";

declare module "obsidian" {
	interface FileSystemAdapter {
		basePath: string;
	}
}
