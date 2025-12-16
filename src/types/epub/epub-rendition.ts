import type { Chapter } from '../index';

export interface EpubThemes {
  register: (name: string, styles: Record<string, string | number>) => void;
  select: (name: string) => void;
  default: (styles: Record<string, string | number>) => void;
  fontSize: (size: string) => void;
}

interface EpubLocation {
  start: {
    index: number;
    href: string;
    cfi: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
  end: {
    index: number;
    href: string;
    cfi: string;
    displayed: {
      page: number;
      total: number;
    };
    location: number;
    percentage: number;
  };
}

export interface EpubRendition {
  display: (target?: string | number) => Promise<void>;
  on: (event: string, callback: Function) => void;
  themes: EpubThemes;
  flow: (flow: string) => void;
  width: (width: number | string) => void;
  height: (height: number | string) => void;
  spread: (spread: string) => void;
  location: EpubLocation;
  hooks: EpubHooks;

  manager?: EpubManager;
  off?: (event: string, callback?: Function) => void;
  destroy: () => void;
  getContents: () => Array<{
    content: Document;
  }>;
}

export interface EpubHooks {
  content: EpubHook;
  layout: EpubHook;
  render: EpubHook;
  serialize: EpubHook;

  [key: string]: EpubHook;
}

export interface EpubHook {
  register: (callback: (contents: EpubContents) => void) => void;
  deregister: (callback: (contents: EpubContents) => void) => void;
  trigger: (contents: EpubContents) => void;
}

// 内容相关的类型定义
export interface EpubContents {
  document: Document;
  window: Window;
  content: string;
  scrollWidth: () => number;
  scrollHeight: () => number;
  documentElement: HTMLElement;
  getContents: () => Array<{ content: Document }>;

  [key: string]: unknown;
}

// 添加 Manager 接口定义
export interface EpubManager {
  container: HTMLElement;
}

export interface EpubLocations {
  generate: () => Promise<void>;
  save: (locations: string[]) => void;
  load: () => string[];
  cfiFromLocation: (location: number) => string;
  locationFromCfi: (cfi: string) => number;
  percentageFromCfi: (cfi: string) => number;
  percentage: (cfi: string) => number;
}

interface EpubMetadata {
  title: string;
  creator?: string;
  language?: string;
  identifier?: string;
  properties?: string[];
  modified?: string;
  description?: string;
  direction?: string;
  layout?: string;
  orientation?: string;
  flow?: string;
}

interface EpubPackage {
  version: string;
  metadata: EpubMetadata;
}

export interface EpubRenderOptions {
  width?: string | number;
  height?: string | number;
  flow?: 'paginated' | 'scrolled' | 'scrolled-doc';
  spread?: 'none' | 'always';
  minSpreadWidth?: number;
}

export interface EpubBook {
  loaded: {
    navigation: Promise<EpubNavigationItem[]>;
    spine: Promise<EpubSpineItem[]>;
    metadata: Promise<EpubMetadata>;
    cover: Promise<string>;
  };
  navigation: {
    toc: EpubNavigationItem[];
  };
  spine: {
    items: EpubSpineItem[];
    length: number;
    get: (target: number | string) => EpubSpineItem;
    each: (fn: (item: EpubSpineItem) => void) => void;
    find: (fn: (item: EpubSpineItem) => boolean) => EpubSpineItem | undefined;
  };
  package: EpubPackage;
  renderTo: (element: HTMLElement | null, options?: EpubRenderOptions) => EpubRendition;
  rendition: EpubRendition;
  locations: EpubLocations;
  ready: Promise<void>;
  open: (content: ArrayBuffer) => Promise<void>;
  destroy: () => void;
  archive: {
    getBlob: (path: string, options?: { base64: boolean }) => Promise<string>;
  };
}

export interface EpubSpineItem {
  href: string;
  cfi: string;
  index: number;
  load: () => Promise<Document>; // 添加 load 方法
  url: string; // 添加 url 属性
  linear: string | null; // 添加 linear 属性
  properties: string[]; // 添加 properties 属性
  next: () => EpubSpineItem | null; // 添加下一项方法
  prev: () => EpubSpineItem | null; // 添加上一项方法
}

export interface EpubChapter extends Chapter {
  href?: string;
  cfi?: string;
  spinePos?: number;
  level?: number; // 添加层级属性
  parent?: string; // 添加父章节属性
  children?: EpubChapter[]; // 添加子章节属性
}

export interface EpubNavigationItem {
  id: string;
  href: string;
  label: string;
  subitems?: EpubNavigationItem[];
}

export interface ProcessedChapter extends EpubChapter {
  level: number;
  parent?: string;
  children?: ProcessedChapter[];
}

interface DisplayedContent {
  document: Document;
  contents: {
    document: Document;
    content: string;
    window: Window;
  }[];
}
