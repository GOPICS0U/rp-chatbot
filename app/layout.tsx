import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RP Chatbot',
  description: 'Local RP chatbot with Ollama'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
