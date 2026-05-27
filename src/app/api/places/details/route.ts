import { NextRequest, NextResponse } from "next/server";

type Component = { longText?: string; shortText?: string; types?: string[] };

function pick(components: Component[], ...types: string[]): Component | undefined {
  for (const t of types) {
    const c = components.find((x) => x.types?.includes(t));
    if (c) return c;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = req.nextUrl.searchParams.get("id");
  if (!key || !id) return NextResponse.json({});

  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "formattedAddress,location,addressComponents",
        },
      }
    );
    const d = await r.json();
    const ac: Component[] = d.addressComponents ?? [];
    return NextResponse.json({
      endereco: d.formattedAddress ?? "",
      cidade:
        pick(ac, "locality", "administrative_area_level_2")?.longText ?? "",
      estado: pick(ac, "administrative_area_level_1")?.shortText ?? "",
      bairro:
        pick(ac, "sublocality_level_1", "sublocality", "neighborhood")
          ?.longText ?? "",
      lat: d.location?.latitude != null ? String(d.location.latitude) : "",
      lon: d.location?.longitude != null ? String(d.location.longitude) : "",
    });
  } catch {
    return NextResponse.json({});
  }
}
