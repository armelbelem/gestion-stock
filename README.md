# Mining AutoLog - Système de Gestion de Stock

Application ERP moderne pour la gestion de stocks, ventes et finances, optimisée pour le déploiement Cloud.

## 🚀 Technologies
- **Frontend** : Next.js 16 (React 19) avec Vanilla CSS.
- **Backend** : Next.js API Routes.
- **Base de données** : MySQL.
- **Rapports** : PDFKit pour les factures et bilans PDF.

## 📦 Installation (Local)

1. **Prérequis** : Node.js installé sur votre machine.
2. **Dépendances** :
   ```bash
   npm install
   ```
3. **Configuration** : Créez un fichier `.env` avec vos accès MySQL :
   ```env
   DATABASE_URL=mysql://user:password@localhost:3306/gestion_stock_db
   JWT_SECRET=votre_secret_ici
   ```
4. **Lancement** :
   ```bash
   npm run dev
   ```
L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## ☁️ Déploiement
Le projet est prêt pour un déploiement sur **Vercel** ou **Railway**. Assurez-vous de configurer les variables d'environnement dans l'interface de votre hébergeur.

---
*Note : Le système de licence locale a été supprimé pour faciliter l'usage Cloud.*
