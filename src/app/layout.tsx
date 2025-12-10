import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ClientToaster from "@/components/ClientToaster";
import NeynarProvider from "@/components/NeynarProvider";
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
  description: "Track habits, streaks, goals and AI insights in one place. Share progress to Farcaster, receive personalized nudges, and stay consistent with gamified analytics.",
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
  keywords: ["habits", "productivity", "personal development", "habit tracker", "streaks", "goals", "farcaster"],
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NeynarProvider>
          <ServiceWorkerRegistration />
          <ClientToaster />
          <ErrorLogger />
          <SessionRestore />
          {children}
        </NeynarProvider>
      </body>
    </html>
  );
}
