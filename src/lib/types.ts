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
  hltbMainStory: number | null;
  hltbCompletionist: number | null;
  pricePerHour: number | null;
  tags: string[];
  tagMatchCount: number;
  saleExpiry: string | null;
  historicalLow: number | null;
  historicalLowCut: number | null;
};

export type ApiResponse = {
  games: GameResult[];
  totalCount: number;
  analyzedCount: number;
  freeGames: GameResult[];
  unreleasedGames: GameResult[];
  error?: string;
};
