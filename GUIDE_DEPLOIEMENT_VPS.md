# Guide de Déploiement Docker sur Serveur VPS Ubuntu

Ce guide détaille pas à pas les étapes pour déployer votre application **gestion-stock** sur un serveur Ubuntu vierge en utilisant **Docker**. Cette méthode est plus propre, plus rapide et plus sécurisée.

---

## 1. Connexion initiale au serveur

Votre informaticien vous a fourni une adresse IP (ex: `198.51.100.23`) et un mot de passe (ou une clé SSH).
Sur votre ordinateur, ouvrez votre terminal (ou PowerShell/Invite de commandes) :

```bash
ssh root@adresse_ip_du_serveur
```
*(Remplacez `root` par le nom d'utilisateur qu'on vous a donné, si différent).*

---

## 2. Préparation du serveur (Beaucoup plus simple avec Docker !)

Vous n'avez plus besoin d'installer Node.js, PM2 ni MySQL manuellement. Docker s'occupe de tout.
Une fois connecté, tapez :

```bash
# 1. Mise à jour du système
sudo apt update && sudo apt upgrade -y

# 2. Installation de Docker, Nginx et Certbot (pour le HTTPS)
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx

# 3. S'assurer que Docker se lance bien au démarrage du serveur
sudo systemctl enable docker
```

---

## 3. Transfert de l'application sur le serveur

```bash
# 1. Allez dans le dossier des sites web
cd /var/www

# 2. Récupérez votre code (si vous utilisez Git)
git clone https://lien-de-votre-depot-git.com/gestion-stock.git
cd gestion-stock

# (Si vous n'utilisez pas Git, transférez le dossier depuis votre PC vers le serveur via FileZilla ou un logiciel SFTP).
```
*Note : Assurez-vous que les fichiers `Dockerfile`, `docker-compose.yml` et `gestion_stock_db.sql` sont bien présents dans le dossier sur le serveur.*

---

## 4. La Magie de Docker : Lancement de l'application

Une fois dans le dossier `gestion-stock` sur le serveur, vous n'avez qu'**une seule commande** à taper :

```bash
sudo docker-compose up -d --build
```

**Que fait cette commande ?**
1. Elle télécharge l'environnement Node.js et installe vos modules npm.
2. Elle télécharge MySQL et crée votre base de données en lieu sûr (grâce au volume).
3. Elle importe **automatiquement** votre fichier `gestion_stock_db.sql`.
4. Elle lance votre application en arrière-plan (le `-d`) et s'assure qu'elle redémarre si le serveur plante.

---

## 5. Configuration de Nginx (Le pont vers votre Nom de Domaine)

> [!IMPORTANT]
> Avant cette étape, assurez-vous que vous êtes allé sur la plateforme de votre nom de domaine (OVH, GoDaddy, etc.) et que vous avez créé l'**enregistrement de type A** pointant vers l'IP du serveur.

```bash
# Créez le fichier de configuration Nginx
sudo nano /etc/nginx/sites-available/gestion-stock
```

Collez cette configuration (en remplaçant `votredomaine.com` par votre vrai domaine) :

```nginx
server {
    listen 80;
    server_name votredomaine.com www.votredomaine.com;

    location / {
        # L'application Docker tourne sur le port 3000
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
*(Sauvegardez avec `Ctrl+X`, `Y`, `Entrée`).*

```bash
# Activez la configuration et redémarrez Nginx
sudo ln -s /etc/nginx/sites-available/gestion-stock /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6. Activation du HTTPS (Cadenas sécurisé)

C'est la dernière étape ! Elle rendra votre site accessible en `https://`.

```bash
sudo certbot --nginx -d votredomaine.com -d www.votredomaine.com
```

Laissez-vous guider par les questions à l'écran (email, conditions, etc.). S'il vous propose de rediriger le trafic HTTP vers HTTPS, choisissez l'option **"Redirect" (Option 2)**.

**Félicitations, votre application est en ligne grâce à Docker !**
