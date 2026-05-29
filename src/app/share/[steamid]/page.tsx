import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

type Props = {
  params: Promise<{ steamid: string }>;
  searchParams: Promise<{
    rank?: string;
    name?: string;
    score?: string;
    price?: string;
    discount?: string;
    positive?: string;
    image?: string;
    hltb?: string;
    pph?: string;
    expiry?: string;
    low?: string;
    atlow?: string;
    tags?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { steamid } = await params;
  const sp = await searchParams;

  const rank     = sp.rank     ?? "1";
  const name     = sp.name     ?? "ゲーム";
  const score    = sp.score    ?? "0";
  const price    = sp.price    ?? "";
  const discount = sp.discount ?? "0";
  const positive = sp.positive ?? "0";
  const image    = sp.image    ?? "";

  const headersList = await headers();
  const host = headersList.get("host") ?? "wishscore.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const ogParams = new URLSearchParams({ rank, name, score, price, discount, positive, image });
  if (sp.hltb)  ogParams.set("hltb",  sp.hltb);
  if (sp.pph)   ogParams.set("pph",   sp.pph);
  if (sp.expiry) ogParams.set("expiry", sp.expiry);
  if (sp.low)   ogParams.set("low",   sp.low);
  if (sp.atlow) ogParams.set("atlow", sp.atlow);
  if (sp.tags)  ogParams.set("tags",  sp.tags);
  const ogUrl = `${baseUrl}/api/og?${ogParams.toString()}`;

  const title = `「${name}」がWishScoreで${rank}位！`;
  const description = `コスパスコア ${score} 🔥 ${price ? `${price} · ` : ""}好評率${positive}%`;

  // Suppress unused variable warning — steamid is used for the canonical URL
  void steamid;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

function scoreColor(score: number): string {
  if (score >= 8) return "#4ade80";
  if (score >= 5) return "#fb923c";
  return "#94a3b8";
}

export default async function SharePage({ params, searchParams }: Props) {
  const { steamid } = await params;
  const sp = await searchParams;

  const rank     = sp.rank     ?? "1";
  const name     = sp.name     ?? "ゲーム";
  const score    = sp.score    ?? "0";
  const scoreNum = parseFloat(score);
  const price    = sp.price    ?? "";
  const discount = parseInt(sp.discount ?? "0");
  const positive = sp.positive ?? "";
  const image    = sp.image    ?? "";
  const hltb     = sp.hltb    ? parseFloat(sp.hltb)  : null;
  const pph      = sp.pph     ? parseInt(sp.pph)     : null;
  const low      = sp.low     ? parseInt(sp.low)     : null;
  const atlow    = sp.atlow   === "1";
  const tags     = sp.tags    ? sp.tags.split(",").filter(Boolean) : [];

  let daysLeft: number | null = null;
  if (sp.expiry) {
    const d = Math.ceil((new Date(sp.expiry).getTime() - Date.now()) / 86400000);
    if (d >= 0) daysLeft = d;
  }

  const color = scoreColor(scoreNum);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f1923] px-4 py-10">
      <div className="max-w-sm w-full rounded-xl border border-[#2a475e] bg-[#16202d] overflow-hidden shadow-xl">
        {/* Thumbnail */}
        {image && (
          <div className="w-full h-44 bg-[#0f1923] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6">
          {/* Logo */}
          <p className="text-[#1b9aff] text-xs font-bold tracking-widest mb-4">WishScore</p>

          {/* Rank badge */}
          <div className="inline-flex items-center bg-[#1b9aff]/10 border border-[#1b9aff]/30 rounded px-3 py-1 mb-3">
            <span className="text-[#1b9aff] text-sm font-bold">#{rank} コスパランキング</span>
          </div>

          {/* Game name */}
          <h1 className="text-lg font-bold text-[#c7d5e0] mb-3 leading-snug">{name}</h1>

          {/* Score */}
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-bold text-4xl" style={{ color }}>
              {score}
            </span>
            {scoreNum >= 8 && <span className="text-2xl">🔥</span>}
          </div>

          {/* Price / review */}
          <div className="flex flex-wrap items-center gap-2 text-sm mb-3">
            {price && <span className="text-[#c7d5e0] font-bold">{price}</span>}
            {discount > 0 && (
              <span className="bg-[#1b9aff] text-white px-2 py-0.5 rounded text-xs font-bold">
                -{discount}%
              </span>
            )}
            {positive && (
              <span className="text-[#8ba3b5]">⭐ {positive}% 好評</span>
            )}
          </div>

          {/* HLTB + pph */}
          {hltb != null && (
            <div className="text-xs text-[#94a3b8] mb-2">
              🕐 約{Math.round(hltb)}時間
              {pph != null && <span className="ml-1">· ¥{pph.toLocaleString()}/時間</span>}
            </div>
          )}

          {/* Sale expiry */}
          {daysLeft != null && (
            <div className={`text-xs mb-2 ${daysLeft <= 3 ? "text-red-400" : daysLeft <= 7 ? "text-orange-400" : "text-slate-400"}`}>
              ⏰ セール終了まであと{daysLeft}日
            </div>
          )}

          {/* Historical low */}
          {low != null && (
            <div className="text-xs mb-2">
              {atlow
                ? <span className="text-green-400">🏆 過去最安値！（¥{low.toLocaleString()}）</span>
                : <span className="text-slate-400">📉 過去最安値: ¥{low.toLocaleString()}</span>
              }
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="text-xs text-[#4a6b7c] mb-4">
              {tags.join(" / ")}
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/?steamid=${encodeURIComponent(steamid)}`}
            className="block w-full text-center bg-[#1b9aff] hover:bg-[#1580d9] text-white font-bold py-3 rounded-lg transition-colors text-sm"
          >
            WishScoreで自分のウィッシュリストを分析する
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-[#4a6b7c] text-center">
        Not affiliated with Valve Corporation.
      </p>
    </div>
  );
}
