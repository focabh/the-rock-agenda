import { ChunkErrorReloader } from "@/components/shared/chunk-error-reloader";
import { Toaster } from "@/components/ui/sonner";
import { ensureDbInitialized } from "@/db/init";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StageBoss",
  description: "StageBoss — gestão de banda: shows, setlists, repertório e casas",
  icons: {
    icon: "/the-rock-logo.png",
    apple: "/the-rock-logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize database on app startup
  try {
    await ensureDbInitialized();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }

  return (
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Fontes do gerador de flyer/cartaz. Carregadas aqui (posição
            garantida no <head>) em vez de via @import no CSS. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@600;700;800&family=Poppins:wght@600;700;800;900&family=Playfair+Display:ital,wght@1,700;0,800&family=Bebas+Neue&family=Oswald:wght@500;700&family=Archivo+Black&family=Montserrat:wght@700;800;900&family=Abril+Fatface&family=Pacifico&family=Permanent+Marker&family=Righteous&display=swap"
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <ChunkErrorReloader />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
