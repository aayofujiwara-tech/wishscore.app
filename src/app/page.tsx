"use client";

import { useMemo, useState } from "react";
import type { GameResult, ApiResponse } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 100) return "#22c55e";
  if (score >= 50) return "#86efac";
  if (score >= 20) return "#facc15";
  if (score >= 5) return "#f97316";
  return "#ef4444";
}

function rankBadge(rank: number) {
  if (rank === 1) return { icon: "🥇", label: "1st" };
  if (rank === 2) return { icon: "🥈", label: "2nd" };
  if (rank === 3) return { icon: "🥉", label: "3rd" };
  return null;
}

function recomputeScore(
  g: GameResult,
  weights: { discount: number; review: number; price: number }
): number {
  if (g.isFree || g.isUnreleased || g.priceJPY <= 0) return 0;
  const reviewWeight = Math.log10(g.reviewTotal + 1);
  const discountBoost = Math.pow(1 + g.discountPercent / 100, weights.discount);
  const priceFactor = Math.pow(g.priceJPY, weights.price);
  return (g.positiveRate * reviewWeight * discountBoost * weights.review / priceFactor) * 1000;
}

function GameCard({
  game,
  rank,
  weights,
  style,
}: {
  game: GameResult;
  rank: number;
  weights: { discount: number; review: number; price: number };
  style?: React.CSSProperties;
}) {
  const score = recomputeScore(game, weights);
  const badge = rankBadge(rank);
  const color = scoreColor(score);

  return (
    <a
      href={`https://store.steampowered.com/app/${game.appid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#1b9aff] hover:bg-[#1a2535] transition-all duration-200 cursor-pointer animate-fade-in-down"
      style={style}
    >
      {/* Score color bar */}
      <div className="w-1 flex-shrink-0" style={{ background: color }} />

      {/* Thumbnail */}
      <div className="w-24 h-16 flex-shrink-0 overflow-hidden my-3 rounded">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.headerImage}
          alt={game.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {badge && (
              <span className="text-lg flex-shrink-0">{badge.icon}</span>
            )}
            {!badge && (
              <span className="font-rajdhani text-[#8ba3b5] text-sm w-6 flex-shrink-0">
                #{rank}
              </span>
            )}
            <span className="text-sm font-medium text-[#c7d5e0] truncate">
              {game.name}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {game.discountPercent > 0 && (
              <span className="text-xs">🔥</span>
            )}
            <span
              className="font-rajdhani font-bold text-sm"
              style={{ color }}
            >
              {score.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 text-xs">
            {game.discountPercent > 0 ? (
              <>
                <span className="bg-[#1b9aff] text-white px-1.5 py-0.5 rounded font-bold">
                  -{game.discountPercent}%
                </span>
                <span className="text-[#c7d5e0] font-medium">
                  ¥{game.priceJPY.toLocaleString()}
                </span>
                <span className="text-[#8ba3b5] line-through">
                  ¥{game.originalPriceJPY.toLocaleString()}
                </span>
              </>
            ) : (
              <span className="text-[#c7d5e0]">
                ¥{game.priceJPY.toLocaleString()}
              </span>
            )}
          </div>

          {game.reviewTotal > 0 && (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="flex-1 bg-[#2a475e] rounded-full h-1.5 min-w-0 max-w-[80px]">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(game.positiveRate * 100).toFixed(0)}%`,
                    background: game.positiveRate >= 0.8 ? "#22c55e" : game.positiveRate >= 0.6 ? "#facc15" : "#ef4444",
                  }}
                />
              </div>
              <span className="text-xs text-[#8ba3b5] whitespace-nowrap">
                {(game.positiveRate * 100).toFixed(0)}% ({game.reviewTotal.toLocaleString()})
              </span>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

function WeightSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#8ba3b5] w-40 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-[#1b9aff]"
      />
      <span className="font-rajdhani text-[#1b9aff] w-10 text-right text-sm">
        {value.toFixed(1)}x
      </span>
    </div>
  );
}

export default function Home() {
  const [steamId, setSteamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState({
    discount: 2.0,
    review: 1.0,
    price: 1.0,
  });
  const [showWeights, setShowWeights] = useState(false);

  const rankedGames = useMemo(() => {
    if (!results) return [];
    return [...results.games]
      .map((g) => ({ ...g, score: recomputeScore(g, weights) }))
      .sort((a, b) => b.score - a.score);
  }, [results, weights]);

  async function handleAnalyze() {
    if (!steamId.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(
        `/api/wishlist?steamid=${encodeURIComponent(steamId.trim())}`
      );
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiResponse;

      if (data.error) {
        setError(data.error);
      } else {
        setResults(data);
      }
    } catch {
      setError("FETCH_ERROR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="text-center py-10 px-4">
        <h1 className="font-rajdhani font-bold text-5xl text-[#1b9aff] tracking-widest">
          WishScore
        </h1>
        <p className="text-[#8ba3b5] mt-2 text-sm tracking-wide">
          Find your best deal from wishlist
        </p>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-12">
        {/* Input area */}
        <div className="rounded-xl border border-[#2a475e] bg-[#16202d] p-5 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="SteamID64 or Profile URL"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              className="flex-1 bg-[#1b2838] border border-[#2a475e] rounded-lg px-4 py-2.5 text-sm text-[#c7d5e0] placeholder-[#4a6b7c] focus:outline-none focus:border-[#1b9aff] transition-colors"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !steamId.trim()}
              className="bg-[#1b9aff] hover:bg-[#1580d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-rajdhani font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? "..." : "分析"}
            </button>
          </div>
          <p className="text-xs text-[#4a6b7c] mt-2">
            SteamIDの調べ方は{" "}
            <a
              href="https://steamid.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1b9aff] hover:underline"
            >
              steamid.io
            </a>{" "}
            で確認できます
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 border-2 border-[#1b9aff] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-[#8ba3b5] text-sm">Analyzing your wishlist...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm">
            {error === "PRIVATE_WISHLIST" && (
              <>
                <p className="text-red-400 font-medium mb-1">
                  ウィッシュリストが非公開です
                </p>
                <p className="text-[#8ba3b5]">
                  Steamのプロフィール設定 → 公開設定 → ゲームの詳細を「公開」にしてください。{" "}
                  <a
                    href="https://steamcommunity.com/my/edit/settings"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1b9aff] hover:underline"
                  >
                    設定ページを開く
                  </a>
                </p>
              </>
            )}
            {error === "EMPTY_WISHLIST" && (
              <p className="text-red-400">
                ウィッシュリストにゲームが見つかりませんでした。
              </p>
            )}
            {error === "INVALID_STEAMID" && (
              <p className="text-red-400">
                SteamIDが見つかりません。SteamID64（17桁の数字）またはプロフィールURLを入力してください。
              </p>
            )}
            {error === "INVALID_API_KEY" && (
              <p className="text-red-400">
                サーバー設定エラーが発生しました。管理者にお問い合わせください。
              </p>
            )}
            {error === "FETCH_ERROR" && (
              <p className="text-red-400">
                エラーが発生しました。しばらく時間をおいて再試行してください。
              </p>
            )}
            {!["PRIVATE_WISHLIST", "EMPTY_WISHLIST", "INVALID_STEAMID", "INVALID_API_KEY", "FETCH_ERROR"].includes(error) && (
              <p className="text-red-400">
                エラーが発生しました。しばらく時間をおいて再試行してください。
              </p>
            )}
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[#8ba3b5] text-xs">
                {results.totalCount}本のゲームを取得 ·{" "}
                スコア対象: {results.games.length}本
              </p>
              <button
                onClick={() => setShowWeights((v) => !v)}
                className="text-xs text-[#1b9aff] hover:underline"
              >
                {showWeights ? "▲ 重み調整を閉じる" : "▼ スコアの重みを調整"}
              </button>
            </div>

            {/* Weight panel */}
            {showWeights && (
              <div className="rounded-xl border border-[#2a475e] bg-[#16202d] p-5 mb-4 space-y-3">
                <p className="text-xs text-[#8ba3b5] mb-2">
                  スライダーを動かすとリアルタイムに順位が変わります
                </p>
                <WeightSlider
                  label="割引率の重み"
                  value={weights.discount}
                  min={1.0}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => setWeights((w) => ({ ...w, discount: v }))}
                />
                <WeightSlider
                  label="レビュー件数の重み"
                  value={weights.review}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => setWeights((w) => ({ ...w, review: v }))}
                />
                <WeightSlider
                  label="価格の重み"
                  value={weights.price}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => setWeights((w) => ({ ...w, price: v }))}
                />
              </div>
            )}

            {/* Ranked games */}
            {rankedGames.length > 0 && (
              <div className="space-y-2 mb-6">
                <h2 className="font-rajdhani font-semibold text-[#1b9aff] text-lg tracking-wide mb-3">
                  コスパランキング
                </h2>
                {rankedGames.map((game, i) => (
                  <GameCard
                    key={game.appid}
                    game={game}
                    rank={i + 1}
                    weights={weights}
                    style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}
                  />
                ))}
              </div>
            )}

            {/* Free games */}
            {results.freeGames.length > 0 && (
              <div className="mb-6">
                <h2 className="font-rajdhani font-semibold text-[#22c55e] text-lg tracking-wide mb-3">
                  無料ゲーム（好評率順）
                </h2>
                <div className="space-y-2">
                  {results.freeGames.map((game) => (
                    <a
                      key={game.appid}
                      href={`https://store.steampowered.com/app/${game.appid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#22c55e] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-1 bg-[#22c55e] flex-shrink-0" />
                      <div className="w-24 h-16 flex-shrink-0 overflow-hidden my-3 rounded">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.headerImage} alt={game.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <p className="text-sm text-[#c7d5e0] font-medium truncate">{game.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs text-[#22c55e] font-bold">FREE</span>
                          {game.reviewTotal > 0 && (
                            <span className="text-xs text-[#8ba3b5]">
                              · {(game.positiveRate * 100).toFixed(0)}% 好評 ({game.reviewTotal.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Unreleased games */}
            {results.unreleasedGames.length > 0 && (
              <div className="mb-6">
                <h2 className="font-rajdhani font-semibold text-[#8ba3b5] text-lg tracking-wide mb-3">
                  未発売ゲーム
                </h2>
                <div className="space-y-2">
                  {results.unreleasedGames.map((game) => (
                    <a
                      key={game.appid}
                      href={`https://store.steampowered.com/app/${game.appid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3 rounded-lg overflow-hidden border border-[#2a475e] bg-[#16202d] hover:border-[#8ba3b5] transition-all duration-200 cursor-pointer"
                    >
                      <div className="w-1 bg-[#4a6b7c] flex-shrink-0" />
                      <div className="w-24 h-16 flex-shrink-0 overflow-hidden my-3 rounded">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={game.headerImage} alt={game.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <p className="text-sm text-[#c7d5e0] font-medium truncate">{game.name}</p>
                        <span className="text-xs text-[#4a6b7c]">Coming Soon</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-[#2a475e] text-xs text-[#4a6b7c]">
        Not affiliated with Valve Corporation. Steam and the Steam logo are trademarks of Valve Corporation.
      </footer>
    </div>
  );
}
