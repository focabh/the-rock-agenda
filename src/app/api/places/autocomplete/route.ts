import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const BH = { latitude: -19.9191, longitude: -43.9386 };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.authed) {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!key || q.length < 3) return NextResponse.json({ suggestions: [] });

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const center =
    Number.isFinite(lat) && Number.isFinite(lon)
      ? { latitude: lat, longitude: lon }
      : BH;

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ["br"],
        languageCode: "pt-BR",
        locationBias: { circle: { center, radius: 30000 } },
      }),
    });
    const d = await r.json();
    const suggestions = (d.suggestions ?? [])
      .filter((s: { placePrediction?: unknown }) => s.placePrediction)
      .map((s: { placePrediction: { placeId: string; text?: { text?: string } } }) => ({
        placeId: s.placePrediction.placeId,
        text: s.placePrediction.text?.text ?? "",
      }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
