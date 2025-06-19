import type { Metadata } from 'next';
import { Oxanium } from 'next/font/google'; // Import the Inter font
import './globals.css';

// Configure the Inter font
const inter = Oxanium({
  subsets: ['latin'], // Specify character subsets
  display: 'swap',    // Use 'swap' for good performance (prevents FOIT)
});

export const metadata: Metadata = {
  title: 'ClashBet',
  description: 'Compete in fast-paced 1v1 online games.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Apply the font class to the html or body tag
    <html lang="en" className={inter.className}>
      <body>
        {children}
      </body>
    </html>
  );
}