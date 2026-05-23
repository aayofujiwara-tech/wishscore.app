export type GameResult = {
  appid: number;
  name: string;
  headerImage: string;
  priceJPY: number;
  originalPriceJPY: number;
  discountPercent: number;
  positiveRate: number;
  reviewTotal: number;
  score: number;
  isFree: boolean;
  isUnreleased: boolean;
  shortDescription: string;
  genres: string[];
  medianPlaytime: number | null;
  pricePerHour: number | null;
  tags: string[];
  tagMatchCount: number;
};

export type ApiResponse = {
  games: GameResult[];
  totalCount: number;
  analyzedCount: number;
  freeGames: GameResult[];
  unreleasedGames: GameResult[];
  error?: string;
};
