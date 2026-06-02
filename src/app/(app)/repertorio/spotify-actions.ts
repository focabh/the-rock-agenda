"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSuperuser } from "@/lib/auth";
import {
  buildAuthorizeUrl,
  disconnectSpotify,
  SpotifyConfigError,
} from "@/lib/spotify";

const STATE_COOKIE = "spotify_oauth_state";

export async function connectSpotifyAction() {
  await requireSuperuser();
  let url: string;
  try {
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10,
      path: "/",
    });
    url = buildAuthorizeUrl(state);
  } catch (err) {
    if (err instanceof SpotifyConfigError) {
      redirect(`/repertorio?spotify=naoconfig`);
    }
    throw err;
  }
  redirect(url);
}

export async function disconnectSpotifyAction() {
  await requireSuperuser();
  await disconnectSpotify();
  revalidatePath("/repertorio");
}
