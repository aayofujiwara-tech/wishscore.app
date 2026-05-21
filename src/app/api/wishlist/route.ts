import { NextRequest, NextResponse } from "next/server";
import { resolveToSteamId64 } from "@/lib/steamUtils";
import type { GameResult, ApiResponse } from "@/lib/types";

export type { GameResult, ApiResponse };

const RETRY_LIMIT = 3;
const RETRY_INTERVAL_MS = 500;

async function fetchWithRetry(
  url: string,
  retries = RETRY_LIMIT
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

async function fetchAllWishlistAppIds(steamId: string): Promise<number[]> {
  const allAppIds: number[] = [];
  let page = 0;

  while (true) {
    const url = `https://store.steampowered.com/wishlist/profiles/${steamId}/wishlistdata/?p=${page}`;
    const res = await fetchWithRetry(url);

    if (!res.ok) {
      throw new Error(`Wishlist fetch error: HTTP ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Empty object means no more pages (or private wishlist signalled differently)
    if (!data || Object.keys(data).length === 0) {
      break;
    }

    // Private wishlist returns { success: 2 } or similar
    if ("success" in data && data.success === 2) {
      throw new Error("PRIVATE_WISHLIST");
    }

    const ids = Object.keys(data)
      .filter((k) => /^\d+$/.test(k))
      .map(Number);

    if (ids.length === 0) {
      break;
    }

    allAppIds.push(...ids);
    page++;
  }

  return allAppIds;
}

type AppDetailsData = {
  success: boolean;
  data?: {
    name?: string;
    header_image?: string;
    short_description?: string;
    genres?: { id: string; description: string }[];
    is_free?: boolean;
    release_date?: { coming_soon?: boolean };
    price_overview?: {
      final?: number;
      initial?: number;
      discount_percent?: number;
    };
  };
};

async function fetchAppDetails(
  appid: number
): Promise<AppDetailsData | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=jp&l=japanese`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, AppDetailsData>;
    return json[String(appid)] ?? null;
  } catch {
    return null;
  }
}

type ReviewData = {
  success: number;
  query_summary?: {
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
  };
};

async function fetchReviews(
  appid: number
): Promise<{ positive: number; negative: number; total: number }> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all`;
  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return { positive: 0, negative: 0, total: 0 };
    const json = (await res.json()) as ReviewData;
    const qs = json.query_summary;
    return {
      positive: qs?.total_positive ?? 0,
      negative: qs?.total_negative ?? 0,
      total: qs?.total_reviews ?? 0,
    };
  } catch {
    return { positive: 0, negative: 0, total: 0 };
  }
}

function calculateScore(
  positiveRate: number,
  reviewTotal: number,
  discountPercent: number,
  priceJPY: number
): number {
  const reviewWeight = Math.log10(reviewTotal + 1);
  const discountBoost = Math.pow(1 + discountPercent / 100, 2);
  return (positiveRate * reviewWeight * discountBoost / priceJPY) * 1000;
}

async function processAppIdBatch(appids: number[]): Promise<GameResult[]> {
  const results: GameResult[] = [];

  // Fetch details and reviews in parallel per batch
  const detailsPromises = appids.map((id) => fetchAppDetails(id));
  const reviewsPromises = appids.map((id) => fetchReviews(id));

  const [detailsArr, reviewsArr] = await Promise.all([
    Promise.all(detailsPromises),
    Promise.all(reviewsPromises),
  ]);

  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    const details = detailsArr[i];
    const reviews = reviewsArr[i];

    if (!details || !details.success || !details.data) continue;

    const d = details.data;
    const isFree = d.is_free ?? false;
    const isUnreleased = d.release_date?.coming_soon ?? false;
    const name = d.name ?? `App ${appid}`;
    const headerImage =
      d.header_image ??
      `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
    const shortDescription = d.short_description ?? "";
    const genres = (d.genres ?? []).map((g) => g.description);

    const priceOverview = d.price_overview;
    const priceJPY = priceOverview
      ? (priceOverview.final ?? 0) / 100
      : isFree
      ? 0
      : 0;
    const originalPriceJPY = priceOverview
      ? (priceOverview.initial ?? 0) / 100
      : 0;
    const discountPercent = priceOverview?.discount_percent ?? 0;

    const positive = reviews.positive;
    const negative = reviews.negative;
    const total = reviews.total;
    const positiveRate =
      total > 0 ? positive / (positive + negative) : 0;

    let score = 0;
    if (!isFree && !isUnreleased && priceJPY > 0) {
      score = calculateScore(positiveRate, total, discountPercent, priceJPY);
    }

    results.push({
      appid,
      name,
      headerImage,
      priceJPY,
      originalPriceJPY,
      discountPercent,
      positiveRate,
      reviewTotal: total,
      score,
      isFree,
      isUnreleased,
      shortDescription,
      genres,
    });
  }

  return results;
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const { searchParams } = new URL(req.url);
  const steamIdParam = searchParams.get("steamid");

  if (!steamIdParam || steamIdParam.trim() === "") {
    return NextResponse.json(
      {
        games: [],
        totalCount: 0,
        freeGames: [],
        unreleasedGames: [],
        error: "INVALID_STEAMID",
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.STEAM_API_KEY ?? "";

  let steamId: string;
  try {
    steamId = await resolveToSteamId64(steamIdParam, apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        games: [],
        totalCount: 0,
        freeGames: [],
        unreleasedGames: [],
        error: message.includes("resolve") ? "INVALID_STEAMID" : message,
      },
      { status: 400 }
    );
  }

  let allAppIds: number[];
  try {
    allAppIds = await fetchAllWishlistAppIds(steamId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PRIVATE_WISHLIST") {
      return NextResponse.json(
        {
          games: [],
          totalCount: 0,
          freeGames: [],
          unreleasedGames: [],
          error: "PRIVATE_WISHLIST",
        },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        games: [],
        totalCount: 0,
        freeGames: [],
        unreleasedGames: [],
        error: message,
      },
      { status: 500 }
    );
  }

  if (allAppIds.length === 0) {
    return NextResponse.json({
      games: [],
      totalCount: 0,
      freeGames: [],
      unreleasedGames: [],
    });
  }

  // Process in batches of 5
  const BATCH_SIZE = 5;
  const allResults: GameResult[] = [];

  for (let i = 0; i < allAppIds.length; i += BATCH_SIZE) {
    const batch = allAppIds.slice(i, i + BATCH_SIZE);
    const batchResults = await processAppIdBatch(batch);
    allResults.push(...batchResults);
  }

  const paidGames = allResults.filter((g) => !g.isFree && !g.isUnreleased);
  const freeGames = allResults.filter((g) => g.isFree);
  const unreleasedGames = allResults.filter((g) => g.isUnreleased);

  // Sort paid games by score descending
  paidGames.sort((a, b) => b.score - a.score);
  // Sort free games by positive rate descending
  freeGames.sort((a, b) => b.positiveRate - a.positiveRate);

  return NextResponse.json({
    games: paidGames,
    totalCount: allResults.length,
    freeGames,
    unreleasedGames,
  });
}
