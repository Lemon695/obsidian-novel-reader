// Type definitions for foliate-js
declare module 'foliate-js/mobi.js' {
    export interface MobiBook {
        metadata?: {
            title?: string;
            creator?: string;
            author?: string;
            language?: string;
            encoding?: string;
        };
        version?: string;
        hasKF8?: boolean;
        sections?: Array<{
            title?: string;
            content?: string;
            id?: string;
        }>;
        toc?: any[];
        nav?: any[];
        pageList?: any[];
        rendition?: { layout?: string };
        splitTOCHref?: (href: string) => any;
        getTOCFragment?: (href: string) => any;
    }

    export class MOBI {
        constructor(options?: { unzlib?: (data: Uint8Array) => Promise<Uint8Array> });
        open(blob: Blob): Promise<MobiBook>;
    }
}

declare module 'foliate-js/view.js' {
    export class FoliateView extends HTMLElement {
        open(book: any): Promise<void>;
        goTo(target: { index: number } | string): Promise<void>;
        next(): Promise<void>;
        prev(): Promise<void>;
        addEventListener(event: 'relocate', handler: (e: CustomEvent) => void): void;
        removeEventListener(event: 'relocate', handler: (e: CustomEvent) => void): void;
    }
}
