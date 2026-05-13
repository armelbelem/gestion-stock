import './globals.css';
import { AuthProvider } from './providers';

export const metadata = {
  title: 'NS Global Manager - Business Suite',
  description: 'Système complet de gestion d\'entreprise (ERP)',
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
