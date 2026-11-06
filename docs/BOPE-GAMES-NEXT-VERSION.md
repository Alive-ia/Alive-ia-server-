# BOPE GAMES — Préparation de la prochaine version

Dernière vérification : 6 novembre 2026  
Branche de travail : `correction-actualites`

## 1. État du code vérifié

Fichiers consultés : `public/index.html`, `server.js` et `package.json`.

- **BOPE DAMES** possède déjà le damier 10×10, le mode local, l’adversaire BOPE, les sons/voix, les profils locaux et le mode en ligne Socket.IO.
- **Statistiques actuelles :** `localStorage` conserve des compteurs sur un seul appareil. Il n’existe pas encore de classement partagé entre joueurs. Le mode local ne comptabilise pas actuellement les résultats dans ces compteurs.
- **Revanche :** le bouton frontend et l’événement Socket.IO `draughts:rematch` existent déjà. Il faut encore tester le cycle complet sur deux téléphones et durcir les contrôles/accusés de réception avant de le considérer comme terminé.
- **Multijoueur :** les salons sont conservés dans une `Map` en mémoire du processus Node.js. Si l’hôte se déconnecte, le salon est supprimé ; si l’invité se déconnecte, sa place est libérée. Il n’y a ni délai de grâce ni jeton de reconnexion.
- **Sécurité des résultats :** le serveur vérifie la forme du plateau reçu, le tour annoncé et certaines limites, mais le client lui transmet encore l’état complet du plateau. Le serveur ne recalcule pas lui-même la légalité de chaque déplacement. Un classement public basé directement sur ces résultats serait donc falsifiable.
- **Discussion et tournois :** aucun événement de discussion en partie ni système de tournoi n’a été trouvé dans les fichiers vérifiés.
- **Persistance :** `package.json` ne contient pas de client PostgreSQL et aucun stockage de parties/joueurs en base n’est configuré dans le code consulté.

## 2. Prochaine amélioration recommandée : statistiques et classement fiables

Ne pas afficher tout de suite un classement mondial alimenté uniquement par les téléphones. Pour qu’il soit crédible, procéder dans cet ordre :

1. **Rendre les coups vérifiables côté serveur.** Le client envoie un coup (départ, chemin et prises), puis le serveur vérifie le joueur au trait, la prise obligatoire, la prise maximale, les déplacements des pions/dames et la fin de partie. Le serveur devient la source officielle de l’état.
2. **Ajouter une identité de joueur stable.** Le pseudonyme et l’avatar actuels restent disponibles ; on leur associe un identifiant technique durable. Sans compte vérifié, le classement devra être présenté comme un classement de profils anonymes et rester exposé aux créations de comptes multiples.
3. **Persister les résultats dans Render Postgres.** Ajouter le paquet `pg` et utiliser `DATABASE_URL`. Tables minimales proposées :
   - `players` : identifiant, pseudonyme, avatar, dates de création/activité ;
   - `matches` : mode, statut, dates, durée, vainqueur et motif de fin ;
   - `match_players` : joueur, couleur, résultat et partie associée.
4. **Ajouter une lecture du classement** (par exemple `GET /games/leaderboard?period=all`) et enregistrer chaque résultat une seule fois côté serveur. Commencer par victoires, défaites, nulles et parties jouées ; ajouter un classement Elo seulement après validation des résultats.

Ne pas réutiliser `localStorage` ou `visits.json` comme base du classement. Render indique que le système de fichiers d’un service est éphémère par défaut ; une base gérée est plus adaptée à des données de joueurs durables.

## 3. Ordre de finition après cette étape

1. **Revanche :** confirmer que les deux appareils reçoivent le même nouvel état, avec remise à zéro des horloges et des sélections, puis empêcher les doubles demandes ou les demandes hors partie terminée.
2. **Reconnexion :** garder une place réservée pendant un délai de grâce (par exemple 60 secondes), avec un jeton de reprise distinct du code public du salon. Restaurer le plateau, le tour et les horloges ; définir clairement ce qui arrive après expiration.
3. **Discussion :** événement Socket.IO séparé, texte brut uniquement, longueur limitée et limitation de fréquence.
4. **Tournois :** inscriptions, tableau de rencontres et résultats seulement après stabilisation des identités, statistiques et reconnexions.

## 4. Prérequis avant l’implémentation du classement

Créer une base **Render Postgres** dans la même région que le service BOPE, puis ajouter sa chaîne de connexion dans l’environnement du service sous le nom `DATABASE_URL`. Une base gratuite convient à un prototype, mais Render précise qu’elle expire après 30 jours : ne pas y conserver le classement de production.

## 5. Plan de test de non-régression

- Vérifier que BOPE IA répond toujours dans le chat, et que BOPE Santé, les actualités RSS, les profils, les sons/voix et les autres jeux restent inchangés.
- Sur deux téléphones : créer/rejoindre un salon, jouer des coups légaux, tenter un coup illégal et vérifier que le serveur le refuse.
- Terminer une partie : vérifier qu’un seul résultat est enregistré, puis que les statistiques et le classement sont identiques sur les deux appareils après actualisation.
- Tester ensuite la revanche, la coupure Internet et la reprise dans le délai prévu.
- Vérifier que les messages de discussion ne modifient jamais l’état du jeu et qu’un joueur extérieur ne peut pas rejoindre un tournoi déjà commencé.

## 6. Limite de cette préparation

Ce document prépare l’architecture et les tests. Aucun code applicatif n’a été modifié ni déployé pendant cette vérification. L’implémentation du stockage partagé dépend de la création de la base Render et de la disponibilité de `DATABASE_URL`.
