import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import ClientToaster from "@/components/ClientToaster";

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
        <ServiceWorkerRegistration />
        <ClientToaster />
        {children}
      </body>
    </html>
  );
}
