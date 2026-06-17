import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Create Game Room",
  description: "Set up and customize a new game room for Cards Against Humanity Online. Choose max players, points to win, and password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
