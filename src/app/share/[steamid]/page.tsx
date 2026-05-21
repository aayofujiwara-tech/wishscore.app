import type { Metadata } from "next";
import { headers } from "next/headers";
import ShareRedirect from "./ShareRedirect";

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
  }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { steamid } = await params;
  const sp = await searchParams;
  const rank = sp.rank ?? "1";
  const name = decodeURIComponent(sp.name ?? "ゲーム");
  const score = sp.score ?? "0";

  const headersList = await headers();
  const host = headersList.get("host") ?? "wishscore.app";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const ogParams = new URLSearchParams({ steamid, ...sp });
  const ogUrl = `${baseUrl}/api/og?${ogParams.toString()}`;

  const title = `「${name}」がWishScoreで${rank}位！`;
  const description = `コスパスコア ${score} 🔥 | WishScoreでSteamウィッシュリストのコスパを自動ランキング`;

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

export default async function SharePage({ params }: Props) {
  const { steamid } = await params;
  return <ShareRedirect steamid={steamid} />;
}
