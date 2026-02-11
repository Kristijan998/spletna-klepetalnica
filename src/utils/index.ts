export function createPageUrl(pageName: string) {
    const base = (import.meta as any)?.env?.BASE_URL || '/';
    const cleanedBase = String(base).endsWith('/') ? String(base).slice(0, -1) : String(base);
    return cleanedBase + '/' + pageName.replace(/ /g, '-');
}
