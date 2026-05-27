type ITADLookupResponse = { game?: { id?: string } };
type ITADDeal = { shop: { id: number }; expiry?: string | null };
type ITADPricesItem = { deals?: ITADDeal[] };
type ITADLow = { shop: { id: number }; price?: { amount?: number }; cut?: number };
type ITADLowItem = { lows?: ITADLow[] };

const STEAM_SHOP_ID = 61;

export async function getITADData(appid: number): Promise<{
  saleExpiry: string | null;
  historicalLow: number | null;
  historicalLowCut: number | null;
} | null> {
  try {
    const apiKey = process.env.ITAD_API_KEY;
    if (!apiKey) return null;

    const lookupRes = await fetch(
      `https://api.isthereanydeal.com/games/lookup/v1?key=${apiKey}&appid=${appid}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!lookupRes.ok) return null;
    const lookupData = (await lookupRes.json()) as ITADLookupResponse;
    const gameId = lookupData?.game?.id;
    if (!gameId) return null;

    const [pricesRes, lowRes] = await Promise.all([
      fetch(`https://api.isthereanydeal.com/games/prices/v3?key=${apiKey}&country=JP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([gameId]),
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://api.isthereanydeal.com/games/storelow/v2?key=${apiKey}&country=JP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([gameId]),
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    let saleExpiry: string | null = null;
    if (pricesRes.ok) {
      const pricesData = (await pricesRes.json()) as ITADPricesItem[];
      const steamDeal = pricesData?.[0]?.deals?.find((d) => d.shop.id === STEAM_SHOP_ID);
      saleExpiry = steamDeal?.expiry ?? null;
    }

    let historicalLow: number | null = null;
    let historicalLowCut: number | null = null;
    if (lowRes.ok) {
      const lowData = (await lowRes.json()) as ITADLowItem[];
      const steamLow = lowData?.[0]?.lows?.find((l) => l.shop.id === STEAM_SHOP_ID);
      historicalLow = steamLow?.price?.amount != null ? Math.round(steamLow.price.amount) : null;
      historicalLowCut = steamLow?.cut ?? null;
    }

    console.log(`[WishScore] ITAD: ${appid} → expiry:${saleExpiry} low:¥${historicalLow}`);

    return { saleExpiry, historicalLow, historicalLowCut };
  } catch (e) {
    console.log(`[WishScore] ITAD error: ${appid} → ${e}`);
    return null;
  }
}
