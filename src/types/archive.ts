export type Category = '식단' | '오운완' | '술자리' | '일상';

export interface ArchiveEntry {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  category: Category;
  photos: string[];    // S3 URL or local URI
  intake: number;
  burn: number;
  memo: string;
  userId: string;
  createdAt: number;   // timestamp
}
