# Carbon Intensity UK

La propreté de l'électricité britannique, maintenant et sur les 24 prochaines
heures, d'après l'[API Carbon Intensity](https://carbonintensity.org.uk)
officielle de NESO (National Energy System Operator, ex-National Grid ESO). Pour
la Grande-Bretagne entière, une région ou votre code postal. Cette intégration
est sans lien avec NESO.

## Présentation

Pour chaque zone suivie (Grande-Bretagne, région, code postal), l'intégration
ajoute un appareil avec :

- l'**intensité carbone** de l'électricité de la demi-heure en cours, en
  gCO₂/kWh, et l'**indice** de NESO (très faible → très élevé) ;
- le **mix électrique** : part de l'éolien, du solaire, du nucléaire, du gaz,
  des importations, de la biomasse, de l'hydraulique, du charbon et des autres
  sources, plus les parts bas carbone et renouvelable ;
- le **meilleur créneau** des 24 prochaines heures : quand commence la période
  la plus propre de la durée choisie (3 heures par défaut), dans combien de
  minutes, et son intensité moyenne.

En plus : un widget de tableau de bord avec la courbe prévue sur 24 h, deux
déclencheurs de scène (« Indice carbone devenu faible », « Début du meilleur
créneau ») et une action de scène qui trouve le meilleur créneau de n'importe
quelle durée, pour lancer le lave-vaisselle ou recharger la voiture quand le
réseau est le plus propre.

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Gladys doit joindre `api.carbonintensity.org.uk` sur Internet. Ni compte ni
  clé : les données sont ouvertes, sous licence CC BY 4.0.
- Les zones sont en Grande-Bretagne (Angleterre, Écosse, pays de Galles) :
  l'Irlande du Nord n'est pas couverte par l'API.

## Configuration

1. Installez l'intégration (**Intégrations → Installer depuis GitHub**, puis
   l'adresse du dépôt).
2. Dans son onglet **Configuration** :
   - **Langue des noms** : langue des noms d'appareils et de fonctionnalités
     (figés à l'ajout d'un appareil) et des textes envoyés aux scènes ;
   - **Grande-Bretagne entière** : un appareil pour les chiffres nationaux
     (activé par défaut) ;
   - **Régions** : l'une des 14 régions des réseaux de distribution, plus
     l'Angleterre, l'Écosse et le pays de Galles ;
   - **Codes postaux** : jusqu'à cinq codes postaux britanniques, séparés par
     des virgules. Seule la première partie compte (`RG10` pour `RG10 9AB`) :
     l'API en déduit la région. Votre code postal complet n'est jamais envoyé ;
   - **Durée du meilleur créneau** : de 30 minutes à 6 heures.
3. Enregistrez, puis ajoutez les appareils depuis l'onglet **Découverte**.

### Bouton « Tester la connexion »

Lit toutes les zones d'un coup et affiche leur intensité actuelle, ou ce qui
ne va pas (pas de réponse, code postal inconnu de l'API, texte qui n'est pas
un code postal).

## Appareils

### Intensité carbone (un par zone)

| Fonctionnalité                        | Valeur                                                   |
| ------------------------------------- | -------------------------------------------------------- |
| Intensité carbone                     | gCO₂/kWh de la demi-heure en cours                       |
| Indice carbone (1 à 5)                | 1 très faible, 2 faible, 3 modéré, 4 élevé, 5 très élevé |
| Indice carbone                        | le même indice, en toutes lettres                        |
| Part bas carbone, part renouvelable   | %                                                        |
| Part de l'éolien, du solaire, du gaz… | % de chaque source, arrondi                              |
| Début du meilleur créneau             | heure, par exemple `03:00`                               |
| Meilleur créneau dans                 | minutes, arrondi à 5 au-dessus, 0 une fois commencé      |
| Intensité du meilleur créneau         | sa moyenne en gCO₂/kWh                                   |

L'intensité est la **prévision** de NESO pour la demi-heure en cours : l'API n'a
pas de valeur mesurée pour les régions, ni pour la demi-heure en cours. « Bas
carbone » compte l'éolien, le solaire, l'hydraulique, la biomasse et le
nucléaire ; les importations et les « autres » ne comptent ni d'un côté ni de
l'autre.

## Widget

**Prévision carbone** affiche, pour la zone choisie dans ses réglages (la
première par défaut) : l'intensité actuelle et l'indice, le début du meilleur
créneau, la courbe prévue sur 24 h avec le meilleur créneau et l'heure
actuelle marqués, et le mix électrique de la demi-heure en barres. Deux
réglages masquent le meilleur créneau et le mix.

## Scènes

### Indice carbone devenu faible (déclencheur)

Se déclenche quand l'indice d'une zone passe de modéré (ou pire) à faible ou
très faible. Filtres : la zone, l'indice atteint. Variables : `level`
(`very_low`, `low`), `index` (1, 2), `index_label`, `intensity`, `zone`.

### Début du meilleur créneau (déclencheur)

Se déclenche quand la demi-heure en cours ouvre le créneau le plus propre des
24 prochaines heures, pour la durée réglée dans la configuration, une fois par
créneau. Filtre : la zone. Variables : `duration_minutes`,
`average_intensity`, `end_time`, `zone`. Dans une zone qui reste à 0 g/kWh
(souvent le sud de l'Écosse), tous les créneaux se valent : il se déclenche de
nouveau à la fin de chacun. Le créneau est recherché à chaque demi-heure sur un
horizon qui avance : un créneau plus propre qui y entre peut remplacer celui
annoncé sur les appareils avant qu'il ne commence.

### Trouver le meilleur créneau (action)

Choisissez une zone et une durée : l'action renvoie `start_time`, `end_time`,
`minutes_until` et `average_intensity` aux actions suivantes de la scène, par
exemple pour vous envoyer « Lancer la machine à laver à 02:30 » (choisissez-les
dans la liste des variables de l'éditeur de scènes).

## Exemples de scènes

- Chaque soir à 20 h, **Trouver le meilleur créneau** de 2 heures, puis
  envoyer « Meilleur moment pour le lave-vaisselle : » suivi de l'heure de
  début, choisie dans la liste des variables.
- **Début du meilleur créneau** → allumer la prise de la borne de la voiture ;
  une scène programmée l'éteint le matin.
- **Indice carbone devenu faible** → allumer le chauffe-eau, avec une
  condition sur l'heure.

## Limites

- Données à la demi-heure : l'intégration lit chaque zone une fois par
  demi-heure (deux appels pour la Grande-Bretagne, un pour une région ou un
  code postal), seulement si son appareil est ajouté ou son widget affiché.
  L'API ne demande pas de clé et n'annonce pas de quota ; elle est utilisée
  avec cette retenue.
- Si l'API est injoignable, les appareils suivent la dernière prévision sur
  48 h, et l'écran de configuration signale les zones illisibles.
- Les heures sont dans le fuseau horaire de Gladys.

## Dépannage

- **« Lecture impossible : RG10 »** : l'API ne connaît pas ce code postal, ou
  ne répond pas. Le bouton **Tester la connexion** dit lequel.
- **Aucun appareil dans Découverte** : aucune zone n'est suivie ; cochez la
  Grande-Bretagne ou choisissez une région ou un code postal.
- Journaux : l'intégration note son démarrage, les zones suivies et les
  échecs. Pour le détail, réglez la variable d'environnement
  `LOG_LEVEL=debug`.

## Crédits

Données : API Carbon Intensity de NESO, CC BY 4.0 — « Carbon Intensity data
from NESO ». Documentation de l'API :
<https://carbon-intensity.github.io/api-definitions/>. Cette intégration est
sans lien avec NESO.
