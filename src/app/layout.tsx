import "./globals.css";
import { GameProvider } from "@/context/GameContext";
import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-schibsted',
});

import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://cah-game.vercel.app'),
  title: {
    default: "Cards Against Humanity Online | Play Free with Friends",
    template: "%s | Cards Against Humanity Online"
  },
  description: "Play Cards Against Humanity online for free! The ultimate fill-in-the-blank party game for people with questionable friends. No downloads required, join or create a game lobby instantly.",
  keywords: ["Cards Against Humanity", "CAH online", "play CAH free", "party game online", "cards game with friends", "questionable friends", "fill in the blank game"],
  authors: [{ name: "Antigravity Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://cah-game.vercel.app",
    title: "Cards Against Humanity Online | Play Free with Friends",
    description: "Play Cards Against Humanity online for free! The ultimate fill-in-the-blank party game for people with questionable friends.",
    siteName: "Cards Against Humanity Online",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Cards Against Humanity Online",
      }
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cards Against Humanity Online | Play Free with Friends",
    description: "Play Cards Against Humanity online for free! The ultimate fill-in-the-blank party game.",
    images: ["/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${schibsted.variable}`}>
      <body>
        <GameProvider>
          <div className="cah-app">
            {children}
          </div>
        </GameProvider>
      </body>
    </html>
  );
}

