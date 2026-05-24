import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, saveSpotifyTokens } from "@/lib/spotify";

const STATE_COOKIE = "spotify_oauth_state";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(
      new URL(`/repertorio?spotify=erro&motivo=${encodeURIComponent(error)}`, req.url)
    );
  }

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/repertorio?spotify=erro&motivo=state", req.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveSpotifyTokens(tokens);
    return NextResponse.redirect(new URL("/repertorio?spotify=conectado", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "desconhecido";
    return NextResponse.redirect(
      new URL(`/repertorio?spotify=erro&motivo=${encodeURIComponent(message)}`, req.url)
    );
  }
}
