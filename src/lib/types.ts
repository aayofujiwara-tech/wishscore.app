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
};

export type ApiResponse = {
  games: GameResult[];
  totalCount: number;
  freeGames: GameResult[];
  unreleasedGames: GameResult[];
  error?: string;
};
