
export * from 'real-print-utils';
export const printGroupedHtml = (pages: string[]) => { (globalThis as any).__capturedPages = pages; };
export const printCombinedHtml = (pages: string[]) => { (globalThis as any).__capturedPages = pages; };
