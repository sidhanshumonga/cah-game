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

export const metadata = {
  title: "Cards Against Humanity",
  description: "The fill-in-the-blank party game for people with questionable friends.",
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

