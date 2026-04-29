# 📦 Guide d'Installation et d'Utilisation - Gestion-Stock

Bienvenue dans votre nouveau logiciel de gestion de stock. Ce guide vous accompagnera pour la mise en route rapide de l'application sur votre ordinateur.

---

## 🚀 1. Premier Lancement
L'application est "portable", ce qui signifie qu'elle ne nécessite aucune installation complexe.

1.  **Copie** : Copiez le dossier complet `gestion-stock` sur votre disque dur (exemple : dans `C:\Gestion-Stock`).
2.  **Lancement** : Double-cliquez sur le fichier **`start.bat`**.
3.  **Alerte Windows** : Si Windows affiche "Protection de votre ordinateur", cliquez sur **"Informations complémentaires"** puis sur **"Exécuter quand même"**.

---

## 🔑 2. Activation de la Licence
Au premier démarrage, l'application identifiera votre ordinateur.

1.  Une fenêtre noire (console) s'ouvrira et affichera votre **ID Machine**.
2.  Veuillez la communiquer à votre fournisseur pour obtenir votre **Clé d'Activation**.
3.  Copiez la clé et appuyez sur **Entrée**. Si l'activation réussit, le logiciel s'ouvrira dans votre navigateur.

> **Note :** La licence est liée à cet ordinateur. Si vous changez de PC, une nouvelle activation sera nécessaire.

---

## 🖥 3. Utilisation Quotidienne
*   **Accès** : L'application s'ouvre sur l'adresse `http://localhost:3001`.
*   **Identifiants par défaut** : 
    *   Utilisateur : `admin`
    *   Mot de passe : `admin`
*   **Arrêt** : Pour fermer proprement le serveur, fermez la fenêtre de la console ou lancez le fichier `stop.bat`.

---

## 📂 4. Reçus et Documents
Tous vos reçus de vente et de règlement sont automatiquement générés en format PDF aux emplacements suivants :
*   📦 **Ventes** : `C:\GestionStock_Recus`
*   💳 **Règlements** : `C:\GestionStock_Reglements`

---

## ⚠️ 5. Sécurité et Sauvegarde
Le logiciel utilise une base de données locale située dans le dossier `server/database.sqlite`. 
**Conseil** : Pensez à copier régulièrement le dossier de l'application sur un support externe (Clé USB, Disque externe) pour ne jamais perdre vos données.

---
*Support technique : [Votre Contact ICI]*
