import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "User Profile",
  description: "View and edit your profile settings, check your custom card packs, history, and achievements in Cards Against Humanity Online.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
