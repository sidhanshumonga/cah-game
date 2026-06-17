import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Game Lobby",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
