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
      <body className="min-h-full bg-background text-foreground">
        {children}
        <ChunkErrorReloader />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
