import { NextRequest } from "next/server";
import { resolveToSteamId64 } from "@/lib/steamUtils";
import { getHLTBData } from "@/lib/hltb";
import { getSteamSpyTags } from "@/lib/steamspy";
import type { GameResult } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETRY_LIMIT = 3;
const RETRY_INTERVAL_MS = 500;
const ANALYZE_LIMIT = 20;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
  "Referer": "https://store.steampowered.com/",
};

async function fetchWithRetry(
  url: string,
  retries = RETRY_LIMIT,
  headers?: Record<string, string>
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers, next: { revalidate: 0 } });
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      continue;
    }
    return res;
  }
  throw new Error("Max retries exceeded");
}

type WishlistItem = { appid: number; priority: number; date_added: number };
type WishlistResponse = { response?: { items?: WishlistItem[] } };

async function fetchAllWishlistAppIds(steamId: string, apiKey: string): Promise<number[]> {
  const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1?steamid=${steamId}&key=${apiKey}`;
  console.log(`[WishScore] Fetching wishlist: ${url.replace(apiKey, "***")}`);

  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Wishlist fetch error: HTTP ${res.status}`);

  const bodyText = await res.text();
  let data: WishlistResponse;
  try {
    data = JSON.parse(bodyText) as WishlistResponse;
  } catch {
    throw new Error("PRIVATE_WISHLIST");
  }

  const items = data.response?.items ?? [];
  console.log(`[WishScore] Wishlist items count: ${items.length}`);
  return items.map((item) => item.appid);
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
    price_overview?: { final?: number; initial?: number; discount_percent?: number };
  };
};

async function fetchAppDetails(appid: number): Promise<AppDetailsData | null> {
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
  query_summary?: { total_positive?: number; total_negative?: number; total_reviews?: number };
};

async function fetchReviews(appid: number): Promise<{ positive: number; negative: number; total: number }> {
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
  priceJPY: number,
  hltbBonus = 1.0
): number {
  const reviewWeight = Math.log10(reviewTotal + 1);
  const discountBoost = Math.pow(1 + discountPercent / 100, 2);
  return (positiveRate * reviewWeight * discountBoost / priceJPY) * 1000 * hltbBonus;
}

async function processGame(appid: number, favoriteTags: string[]): Promise<GameResult | null> {
  const [details, reviews, tags] = await Promise.all([
    fetchAppDetails(appid),
    fetchReviews(appid),
    getSteamSpyTags(appid),
  ]);

  if (!details?.success || !details.data) return null;

  const d = details.data;
  const isFree = d.is_free ?? false;
  const isUnreleased = d.release_date?.coming_soon ?? false;
  const name = d.name ?? `App ${appid}`;
  const headerImage =
    d.header_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
  const shortDescription = d.short_description ?? "";
  const genres = (d.genres ?? []).map((g) => g.description);

  const priceOverview = d.price_overview;
  const priceJPY = priceOverview ? (priceOverview.final ?? 0) / 100 : 0;
  const originalPriceJPY = priceOverview ? (priceOverview.initial ?? 0) / 100 : 0;
  const discountPercent = priceOverview?.discount_percent ?? 0;

  const { positive, negative, total } = reviews;
  const positiveRate = total > 0 ? positive / (positive + negative) : 0;

  let hltbMainStory: number | null = null;
  let hltbCompletionist: number | null = null;
  let pricePerHour: number | null = null;

  if (!isFree && !isUnreleased && priceJPY > 0) {
    const hltb = await getHLTBData(name);
    if (hltb) {
      hltbMainStory = hltb.mainStory;
      hltbCompletionist = hltb.completionist;
      pricePerHour =
        hltb.mainStory && hltb.mainStory > 0
          ? Math.round(priceJPY / hltb.mainStory)
          : null;
    }
  }

  const hltbBonus = pricePerHour ? Math.max(1.0, 20 / pricePerHour) : 1.0;
  const matchCount = favoriteTags.length > 0
    ? tags.filter((t) => favoriteTags.includes(t)).length
    : 0;
  const tagBonus = Math.min(2.0, 1 + matchCount * 0.2);

  let score = 0;
  if (!isFree && !isUnreleased && priceJPY > 0) {
    score = calculateScore(positiveRate, total, discountPercent, priceJPY, hltbBonus) * tagBonus;
  }

  return {
    appid, name, headerImage, priceJPY, originalPriceJPY, discountPercent,
    positiveRate, reviewTotal: total, score, isFree, isUnreleased,
    shortDescription, genres, hltbMainStory, hltbCompletionist, pricePerHour,
    tags, tagMatchCount: matchCount,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller closed */ }
      };

      try {
        const { searchParams } = new URL(req.url);
        const steamIdParam = searchParams.get("steamid") ?? "";
        const favoriteTagsParam = searchParams.get("favoriteTags") ?? "";
        const favoriteTags = favoriteTagsParam
          ? favoriteTagsParam.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

        if (!steamIdParam.trim()) {
          send({ type: "error", error: "INVALID_STEAMID" });
          controller.close();
          return;
        }

        const apiKey = process.env.STEAM_API_KEY ?? "";
        if (!apiKey) {
          send({ type: "error", error: "INVALID_API_KEY" });
          controller.close();
          return;
        }

        send({ type: "progress", message: "SteamIDを確認中...", current: 0, total: 0 });

        let steamId: string;
        try {
          steamId = await resolveToSteamId64(steamIdParam, apiKey);
        } catch {
          send({ type: "error", error: "INVALID_STEAMID" });
          controller.close();
          return;
        }

        send({ type: "progress", message: "ウィッシュリスト取得中...", current: 0, total: 0 });

        let allAppIds: number[];
        try {
          allAppIds = await fetchAllWishlistAppIds(steamId, apiKey);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "SERVER_ERROR";
          send({ type: "error", error: msg === "PRIVATE_WISHLIST" ? "PRIVATE_WISHLIST" : msg });
          controller.close();
          return;
        }

        if (allAppIds.length === 0) {
          send({ type: "error", error: "EMPTY_WISHLIST" });
          controller.close();
          return;
        }

        const targets = allAppIds.slice(0, ANALYZE_LIMIT);
        send({
          type: "progress",
          message: `${allAppIds.length}本を取得。上位${targets.length}本を分析中...`,
          current: 0,
          total: targets.length,
        });

        const results: GameResult[] = [];

        for (let i = 0; i < targets.length; i++) {
          const appid = targets[i];
          const game = await processGame(appid, favoriteTags);
          if (game) {
            results.push(game);
            send({ type: "game", game, current: i + 1, total: targets.length });
          } else {
            send({ type: "progress", message: `分析中...`, current: i + 1, total: targets.length });
          }
          if (i < targets.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        const paidGames = results
          .filter((g) => !g.isFree && !g.isUnreleased)
          .sort((a, b) => b.score - a.score);
        const freeGames = results
          .filter((g) => g.isFree)
          .sort((a, b) => b.positiveRate - a.positiveRate);
        const unreleasedGames = results.filter((g) => g.isUnreleased);

        send({
          type: "complete",
          games: paidGames,
          freeGames,
          unreleasedGames,
          totalCount: allAppIds.length,
          analyzedCount: targets.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "SERVER_ERROR";
        send({ type: "error", error: `SERVER_ERROR: ${msg}` });
      } finally {
        try { controller.close(); } catch { /* ignore */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
