import './globals.css';
import { AuthProvider } from './providers';

export const metadata = {
  title: 'StockFlow - Gestion de Stock',
  description: 'Système de gestion de stock professionnel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
