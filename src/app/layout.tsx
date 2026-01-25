import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ClientToaster from "@/components/ClientToaster";
import UniversalProvider from "@/components/UniversalProvider";
import ErrorLogger from "@/components/ErrorLogger";
import { escapeAttr } from "@/lib/shareOgHtml";
import SessionRestore from "@/components/SessionRestore";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personality Architect",
  description: "Track habits, streaks, goals and AI insights in one place. Share your progress, receive personalized nudges, and stay consistent with gamified analytics.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Personality Architect",
  },
  openGraph: {
    title: "Personality Architect",
    description: "Build better habits every day. Track habits, streaks, goals and AI insights in one place.",
    images: [
      {
        url: "/share/image/miniapp-og.png",
        width: 1200,
        height: 630,
        alt: "Personality Architect - Personalized habit analytics",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Personality Architect",
    description: "Build better habits every day. Track habits, streaks, goals and AI insights in one place.",
    images: ["/share/image/miniapp-og.png"],
  },
  keywords: ["habits", "productivity", "personal development", "habit tracker", "streaks", "goals"],
  other: {
    // Используем escapeAttr для безопасного экранирования JSON перед вставкой в HTML атрибут
    // Это предотвращает XSS через двойные кавычки в JSON
    "fc:miniapp": escapeAttr(JSON.stringify({
      version: "1",
      imageUrl: "https://personality-architect-miniapp.vercel.app/share/image/miniapp-og.png",
      button: {
        title: "Personality Architect",
        action: {
          type: "launch_frame",
          name: "Personality Architect",
          url: "https://personality-architect-miniapp.vercel.app",
          splashImageUrl: "https://personality-architect-miniapp.vercel.app/miniapp/splash.png",
          splashBackgroundColor: "#7C5CFC",
        },
      },
    })),
    "base:app_id": "696d0122c0ab25addaaaf448",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0f1a",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect для ускорения загрузки внешних ресурсов */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.neynar.com" />
        <link rel="dns-prefetch" href="https://supabase.co" />
        {/* Material Symbols - оптимизированная загрузка с font-display: swap */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UniversalProvider>
          <ServiceWorkerRegistration />
          <ClientToaster />
          <ErrorLogger />
          <SessionRestore />
          {children}
        </UniversalProvider>
      </body>
    </html>
  );
}
