import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Card Packs Marketplace | Store",
  description: "Expand your deck in the Cards Against Humanity Online store. Browse custom card expansion packs, upgrades, and theme decks using coins.",
  openGraph: {
    title: "Card Packs & Upgrades Store | Cards Against Humanity Online",
    description: "Expand your deck in the Cards Against Humanity Online store. Browse custom card expansion packs, upgrades, and theme decks.",
  },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
