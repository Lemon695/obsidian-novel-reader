/**
 * 书签功能测试视图
 * 用于快速测试书签功能
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type NovelReaderPlugin from '../main';
import BookmarkTestComponent from '../components/BookmarkTestComponent.svelte';

export const VIEW_TYPE_BOOKMARK_TEST = 'bookmark-test-view';

export class BookmarkTestView extends ItemView {
  private component: BookmarkTestComponent | null = null;
  private plugin: NovelReaderPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: NovelReaderPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_BOOKMARK_TEST;
  }

  getDisplayText(): string {
    return '书签功能测试';
  }

  getIcon(): string {
    return 'bookmark';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();

    this.component = new BookmarkTestComponent({
      target: container,
      props: {
        plugin: this.plugin
      }
    });
  }

  async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }
}
