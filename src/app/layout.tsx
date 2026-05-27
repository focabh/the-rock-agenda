import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ChunkErrorReloader } from "@/components/shared/chunk-error-reloader";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { ensureDbInitialized } from "@/db/init";
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
  title: "The Rock — Operações",
  description: "Plataforma operacional da banda The Rock",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Rock",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
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
        <ServiceWorkerRegister />
        <ChunkErrorReloader />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
