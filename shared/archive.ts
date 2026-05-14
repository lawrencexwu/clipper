export const ARCHIVE_MIN_WORD_COUNT = 200;

export function archivePhUrl(originalUrl: string): string {
  return `https://archive.ph/newest/${originalUrl}`;
}

export function shouldOfferArchive(wordCount: number): boolean {
  return wordCount < ARCHIVE_MIN_WORD_COUNT;
}
