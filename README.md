# Doodle Faces

Générateur procédural de visages au stylo, dans l'esprit du post de
[@mannay](https://x.com/mannay/status/2087522034351796728) — encre tremblée sur
papier vieilli, une planche de têtes toutes différentes.

**En ligne : <https://flocautank.github.io/doodle-faces/>**

Une graine → toujours le même visage. Sur n'importe quelle machine, pour
toujours. **Tu stockes la graine, pas l'image.**

- Zéro dépendance, zéro build. Du Canvas 2D standard et des modules ES.
- Site statique : n'importe quel hébergeur de fichiers fait l'affaire.
- Réutilisable ailleurs : génome JSON, export atlas + manifeste, chargeur Godot.
- Presque tout à l'encre, avec de temps en temps une touche de couleur mate.
- 12 espèces : humains, enfants, anciens, elfes, nains, gnomes, orcs, trolls,
  gobelins, morts-vivants, démons (avec cornes), hommes-bêtes.
- 17 archétypes (finance bro, punk à chien, hippie, goth, mage, noble, soldat,
  clown, détective…) qui biaisent le style.
- Des têtes tournées de trois quarts, orientables en direct à la souris.
- 8 comportements de plume, de la plume fine au crayon de cire.

---

## Lancer en local

Les modules ES exigent un serveur HTTP (`file://` est bloqué par le navigateur) :

```bash
npx http-server . -p 5180 -c-1
```

Puis <http://localhost:5180>.

## Héberger

Déjà fait : le dépôt est publié par **GitHub Pages** depuis `main`, à la racine.
Un `git push` suffit à redéployer — la reconstruction prend une petite minute.

```bash
git push origin main
gh api repos/flocautank/doodle-faces/pages/builds/latest --jq .status   # built ?
```

GitHub Pages met les fichiers en cache une dizaine de minutes ; un visiteur déjà
venu peut donc voir l'ancienne CSS un moment après un déploiement.

### Ailleurs

Le site est entièrement statique — aucune étape de build, rien à compiler.
Pousse le dossier tel quel :

- **GitHub Pages** : push sur une branche, Settings → Pages → *Deploy from a branch*.
- **Netlify / Cloudflare Pages / Vercel** : glisser-déposer le dossier, ou brancher
  le dépôt sans commande de build (*publish directory* = la racine).
- **Un simple hébergeur FTP** : copier les fichiers. C'est tout.

Le seul point d'attention : servir les `.js` avec le type MIME
`text/javascript`, ce que fait tout serveur correct par défaut.

### En un seul fichier

Les modules ES sont agréables à travailler mais exigent un serveur. Pour un
hébergeur qui ne prend qu'un fichier — ou pour ouvrir la page directement depuis
le disque :

```bash
node tools/build-single.mjs
```

Produit `dist/doodle-single.html` (page complète, ~220 kB, s'ouvre en
`file://`) et `dist/artifact.html` (contenu du `body` seul, pour les hôtes qui
fournissent l'enveloppe). esbuild aplatit le graphe de modules — c'est aussi lui
qui renomme les quelques `clamp` privés qui entreraient en collision une fois
concaténés. C'est un outil de développement : le site produit, lui, n'a toujours
aucune dépendance.

---

## L'interface

Deux modes sur le même générateur, barre latérale à gauche :

- **Contact sheet** — la planche, pour dégrossir une population. Clique sur un
  visage pour l'ouvrir.
- **Focus** — un seul portrait en grand, modifiable en direct. Glisse le
  portrait pour tourner la tête (horizontal = rotation, vertical = inclinaison),
  `←` `→` pour passer au suivant, `f` pour basculer de mode, `r` pour une
  nouvelle graine.

Le panneau **Traits** épingle un trait pour tout le monde ; le dé à côté de
chaque menu ne relance *que* ce trait sur le portrait affiché, en laissant les
autres et la pose intacts. Le panneau **Proportions** expose les nombres du
génome en curseurs, et **Genome** le JSON complet, éditable.

Les libellés de l'interface sont en anglais, comme le code. Cette documentation
reste en français — dis-le si tu la veux en anglais aussi.

### Garder, partager, comparer, croiser

- **Kept** — le bandeau du bas garde les visages retenus dans `localStorage`
  (`k` en mode focus, ou l'étoile). Tout accès au stockage est protégé : une
  fenêtre privée ou un navigateur qui bloque les données de site ne casse rien,
  la sélection vit juste le temps de la session.
- **Copy share link** — un lien vers exactement ce qui est à l'écran. Un visage
  intact est entièrement décrit par sa graine et les réglages, donc le lien
  reste court ; dès qu'un génome a été retouché à la main il n'y a plus rien
  pour le dériver, alors il part en entier dans le fragment (~2,5 ko en
  base64url). Le panneau *Genome* affiche exactement ce que le lien encode, à
  l'arrondi près — vérifié : aller-retour identique au caractère.
- **Compare** — deux portraits côte à côte, chacun avec son propre pas dans la
  planche, plus *Swap* et *Breed A × B* qui envoie l'enfant en mode focus.

### L'expression

Un seul curseur, de −1 (aigre) à +1 (ravi). Ce n'est **pas un trait** : c'est
une lentille que le renderer applique par-dessus les sourcils, les yeux et la
bouche déjà tirés au sort, pour qu'un personnage puisse changer d'humeur sans
devenir quelqu'un d'autre. `mood` fait la même chose pour toute une population.

Au-delà d'un seuil le style de bouche est **substitué** — on ne sourit pas avec
une moue — mais tout le reste est continu : les sourcils montent et pivotent,
les paupières se plissent, une paupière lourde tombe sur les yeux d'un visage
qui en a assez.

Un détail sans lequel ça ne se lisait pas : la plupart des bouches n'ont aucune
courbe à fléchir, et beaucoup de visages n'ont pas de sourcils du tout. D'où un
signal universel — **deux petits traits aux coins de la bouche**, qui la
retroussent ou l'abaissent quel que soit son style.

### Les performances

Trois choses rendaient les réglages poussifs, dans cet ordre d'importance :

1. **Aucun niveau de détail.** Un visage est décrit en unités de dessin, donc
   une vignette de 64 px coûtait exactement autant qu'un portrait de 512 px :
   même ré-échantillonnage, même nombre de traits, puis réduction jusqu'à ce que
   rien ne soit visible. `lod` (0..1) allonge les segments, réduit le nombre de
   traits et écarte les hachures là où ça ne se voit pas. C'est aussi ce qui
   rend le glisser fluide : détail grossier pendant le déplacement, redessin net
   au relâchement.
2. **Un tampon de rendu surdimensionné.** Sur un écran haute densité, les
   vignettes étaient rendues à `devicePixelRatio` jusqu'à 3, soit 9× les pixels
   pour un gain nul. Plafonné à 1,5 en dessous de 200 px.
3. **La reconstruction du DOM.** Reconstruire 160 boutons et allouer 160 canvas
   neufs à chaque cran de curseur coûtait 100 à 230 ms dans une seule frame
   bloquante — le démontage du DOM, pas le dessin. Les cellules sont maintenant
   recyclées et chaque redessin ne touche que des pixels.

S'ajoute un rendu **par tranches** : la planche se dessine sur plusieurs frames
avec un budget de 10 ms chacune, et s'annule si les réglages rebougent. Mesuré
sur une planche de 160 visages pendant un balayage de curseur :
**aucune tâche longue (>50 ms)**. En mode focus, un portrait de 560 px se
redessine en ~3 ms, soit largement de quoi tourner la tête au doigt.

---

## Architecture

```
src/faces/
  rng.js          PRNG déterministe (mulberry32) + bruit lissé
  genome.js       traits d'un visage → objet JSON. Aucune notion de dessin.
  kin.js          les espèces : proportions de crâne, échelle des traits
  looks.js        les archétypes : biais de style, accessoires, palette
  presets.js      les populations : carnet, humains, foule, enfants, joueurs, taverne, carnaval
  recipes.js      les portraits épinglés : un personnage précis, pas une population
  breed.js        croisement de deux génomes : des frères et sœurs, une famille
tools/
  build-single.mjs  tout aplatir en un fichier HTML autonome
  anatomy.js      le génome → géométrie concrète dans une boîte de 100 unités
  ink.js          les primitives "stylo à main levée" + la texture papier
  color.js        la couche couleur : lavis mats, hors repérage
  features.js     oreilles, yeux, sourcils, nez, bouche, taches
  hair.js         cheveux et pilosité faciale
  accessories.js  lunettes et chapeaux
  face.js         l'API publique
  atlas.js        export atlas + manifeste pour un moteur de jeu
godot/
  doodle_faces.gd chargeur d'atlas pour Godot 4
index.html app.js style.css   le studio (barre latérale + planche + focus)
```

Deux couches nettement séparées, et c'est tout l'intérêt :

- le **génome** est de la donnée pure (`{ head: { shape: 'pear', … }, … }`) ;
- le **renderer** est une fonction du génome vers des pixels.

Tu peux donc générer, sauvegarder, éditer et rejouer des visages sans jamais
toucher au dessin — et inversement changer le style de trait sans changer un
seul visage.

### Comment on obtient le "fait main"

C'est là que tout se joue, et ça tient en quatre idées :

1. **Le tracé tremble lentement.** Chaque chemin est ré-échantillonné puis
   déplacé le long de ses normales par un bruit fractal — une dérive douce, pas
   du grésillement. Du bruit blanc donnerait une ligne floue, pas une ligne
   dessinée.
2. **Chaque trait est repassé.** Deux ou trois passes légèrement décalées : les
   angles se doublent, l'encre s'accumule aux croisements. C'est ce qui distingue
   un trait de stylo d'un trait vectoriel.
3. **L'épaisseur varie et s'amincit aux extrémités**, avec de petits sauts
   secs — le stylo qui décroche.
4. **Les cheveux sont des traits courts orientés**, pas une hachure parallèle.
   Un remplissage hachuré uniforme se lit comme un code-barres ; des traits
   courts qui rayonnent depuis le crâne se lisent comme des cheveux. Même
   principe pour les barbes, qui rayonnent depuis un point sous le nez.

Le fond papier est procédural : teinte chaude, taches diffuses, grain fin
(une tuile de bruit mise en cache), quelques fibres, vignettage léger.

### La couleur

Environ un visage sur cinq reçoit une touche de couleur, rarement deux. Le
principe qui fait tout marcher : **le lavis ne se superpose jamais exactement à
l'encre**. Il est décalé de quelques unités, légèrement redimensionné et pivoté,
avec un bord irrégulier — comme une impression dont la plaque de couleur a
glissé. Posé pile sur la forme, ça se lirait comme un remplissage ; décalé, ça se
lit comme une couleur passée à la main.

La palette est volontairement mate et désaturée (terracotta, rose poudré, sauge,
sarcelle, moutarde, ardoise, prune, brique, olive) — aucune couleur saturée.
Les cibles possibles : la masse de cheveux, un chapeau, une barbe, les joues, un
verre de lunettes, une pastille pleine à côté de la tête, ou un bloc rectangulaire
posé de travers sur une partie du visage.

Deux garde-fous : la couche couleur est peinte **sous** l'encre, pour que le
trait reste lisible ; et les éléments dessinés en aplat noir (cheveux, chapeau ou
barbe de teinte `dark`) ne sont jamais choisis comme cible — un lavis sous du
noir plein est un lavis qu'on ne voit pas.

Le curseur *Couleur* du site, et l'option `color` de l'API, pilotent la
fréquence : `0` pour du pur noir et blanc, `1` par défaut, `2`–`3` pour insister.

### Qui décide quoi

C'est la question qui revient, alors autant l'écrire noir sur blanc. Quatre
couches se superposent, **de la plus générale à la plus précise**, et chacune
n'écrase que ce dont elle parle :

```
DEFAULT_WEIGHTS   les proportions de base d'une foule quelconque
  ↓
population        qui se présente : quelles espèces, quels archétypes,
(preset)          et éventuellement des goûts communs (une foule discrète
                  porte peu de chapeaux)
  ↓
espèce (kin)      ce qu'est la créature : crâne, échelle des traits,
                  et ce qu'elle porte volontiers
  ↓
archétype (look)  ce que le personnage joue : coiffure, accessoires, palette
  ↓
force             ce que tu imposes toi-même — gagne sur tout
```

Autrement dit : **la population est une distribution, l'espèce et l'archétype
sont des propriétés d'un individu.** Sur le site, la population est un menu à
part ; les autres menus imposent un trait à tout le monde et l'emportent sur
elle. Choisir population `taverne` + espèce `orc` donne 100 % d'orcs, pas la
répartition de la taverne.

> L'ordre a été inversé pendant un temps — la population était appliquée en
> dernier et écrasait l'archétype. Résultat : sur la population « foule »,
> choisir « punk à chien » ne changeait strictement rien, parce que la table de
> coiffures de la foule repassait par-dessus celle du punk. C'est corrigé ; si
> tu ajoutes une couche, garde ce sens-là.

### Les espèces

`kin.js` décrit ce qu'est la créature, en quatre blocs de données :

- `metrics` — les proportions du crâne, appliquées **par-dessus** la forme de tête ;
- `scale` — la taille relative de chaque trait (le nez d'un gnome fait 1,7× celui d'un humain) ;
- `lines` — la hauteur des lignes yeux / nez / bouche sur le visage (un enfant les a très basses) ;
- `traits` — les interrupteurs durs : défenses, oreilles pointues, arcade sourcilière, barbe obligatoire ;
- `weights` — ce que l'espèce porte volontiers (un orc a rarement un carré bien coiffé).

Douze espèces : humain, enfant, ancien, elfe, nain, gnome, orc, troll, gobelin,
mort-vivant, démon, homme-bête. Rien n'est codé en dur dans le renderer :
ajouter une espèce, c'est ajouter une entrée dans la table.

Les cornes (`traits.horns`, styles `curved` / `straight` / `ram`) viennent de
l'espèce, mais 1,5 % des autres visages en poussent aussi. Elles s'enracinent au
**bord** du crâne près du sommet et sont dessinées **en dernier** — plantées plus
à l'intérieur et plus courtes, elles finissaient noyées dans les cheveux et se
lisaient comme des traits de stylo égarés.

Un piège rencontré en route : les multiplicateurs de l'espèce et ceux de la
forme de crâne se **multiplient**. Un orc (large) sur un crâne « wide » donnait
un paillasson. `headSize()` borne donc la taille absolue *puis* le rapport
largeur/hauteur, ce qui garde toutes les combinaisons utilisables.

### Les archétypes

`looks.js` décide du style plutôt que de l'anatomie : ce que font les cheveux,
les piercings, le maquillage, quelles couleurs sortent. Dix-sept archétypes —
`finance`, `punk`, `hippie`, `bobo`, `goth`, `metal`, `sailor`, `scholar`,
`raver`, `farmer`, `artist`, `wizard`, `noble`, `soldier`, `clown`, `detective`,
plus `plain` qui ne biaise rien et reste majoritaire.

Un archétype est un **biais, pas un costume** : un punk garde un nez tiré au
hasard. `LOOK_BLOCKLIST` interdit les combinaisons absurdes (pas d'enfant punk
à chien, pas de troll universitaire).

Le signal le plus lisible d'un archétype, c'est la coiffure — d'où une règle
qui compte : un couvre-chef ne fait plus disparaître les cheveux
systématiquement. Seuls ceux qui couvrent le crâne (bonnet, casquette, capuche,
haut-de-forme, béret, casquette plate) masquent ce qu'il y a dessous, et encore :
les coupes assez longues pour dépasser (`long`, `dreads`, `ponytail`, `bob`,
`curly`, `pigtails`, `mop`) restent visibles. Un bandana ou un serre-tête ne
cachent rien.

Les accessoires disponibles : boucle d'oreille (anneau ou clou), piercing au
nez, eye-liner, rouge à lèvres, tatouage, cicatrice, cigarette avec sa volute,
cache-œil avec sa sangle, monosourcil.

### L'orientation

Le visage est traité comme s'il était peint sur un cylindre : un point à la
position horizontale `u = x/w` se trouve à l'angle `asin(u)`, et tourner la tête
de `yaw` l'amène à `sin(asin(u) + yaw)`. On divise par `cos(yaw)` pour
renormaliser, sinon toute la tête rétrécirait — exact pour un cylindre, faux
pour un dessin.

Résultat : la ligne médiane glisse du côté regardé, les traits se tassent de ce
côté et s'écartent de l'autre, et la silhouette ne bouge pas. Tout ce qui sort
du crâne (volume des cheveux, chapeaux, oreilles) passe sans transformation,
donc rien n'est cisaillé.

Le cylindre seul ne suffit pas : sans autre chose, on obtient un visage de face
dont les traits ont glissé. `profileX()` ajoute les deux indices qui manquent —
le nez et les lèvres qui débordent du bord avant, et le crâne qui ressort à
l'arrière.

Et deux détails qui se trompent facilement : sur une tête tournée vers la
droite, l'oreille visible est celle de **gauche** de l'image (l'autre passe
derrière le crâne), et l'œil raccourci est celui du côté regardé, pas l'autre.

### Les plumes

Huit comportements de trait, tirés au sort : `fine`, `ballpoint`, `pencil`,
`quill`, `marker`, `charcoal`, `brush`, `wax`. Chacun donne une épaisseur, un nombre de passes,
une noirceur, un taux de décrochage et un tremblé. Les appelants passent des
opacités explicites partout, donc plutôt que de les écraser, la plume les
**multiplie** : un crayon éclaircit tout dans le même rapport, un feutre
assombrit tout.

### La variété à l'intérieur d'un même style

Deux têtes qui partagent une coiffure ne doivent pas se ressembler. Chaque
entrée de la table de styles n'est donc qu'un point de départ, retravaillé par
`hairPlan()` avec les paramètres propres au visage :

- `puff` — le volume général, de 0,6 à 1,6× ;
- `hairTShift` / `sideShift` — la ligne de front plus haute ou plus basse, la
  masse plus ou moins descendante sur les côtés ;
- `asym` — une tempe plus fournie que l'autre, avec sa ligne de front décalée :
  la coque est construite côté droit et côté gauche séparément ;
- `hairline` — un tiers des têtes emprunte une autre ligne de front que celle
  que suggère leur style ;
- `strokeLen`, `spread`, `curl`, `swirl`, `turns` — la longueur, l'évasement, la
  courbure et l'enroulement des traits de stylo, plus l'inclinaison générale du
  « peignage ».

Les barbes suivent la même logique (`extent`, `gap`, `strokeLen`) : plus ou moins
haut sur les joues, plus ou moins de place laissée autour de la bouche.

---

## API

```js
import { renderFace, drawFace, makeGenome, makeGenomes, renderSheet } from './src/faces/face.js';
```

### Un visage dans le DOM

```js
document.body.append(renderFace('pnj-42', { size: 256 }));
```

### Dans ton propre canvas

```js
const ctx = myCanvas.getContext('2d');
drawFace(ctx, 'pnj-42', { size: 256, x: 0, y: 0 });
```

`drawFace(ctx, seedOuGénome, opts)` retourne le génome utilisé.

| option    | défaut       | effet |
|-----------|--------------|-------|
| `size`    | côté du canvas | côté du carré à dessiner, en px |
| `x`, `y`  | `0`          | coin haut-gauche de ce carré |
| `paper`   | `true`       | `false` = fond transparent ; ou `{ tone, grain, vignette }` |
| `blend`   | `'multiply'` | `'source-over'` sur fond transparent, pour une encre opaque |
| `ink`     | celle du génome | couleur d'encre, ex. `'rgb(236,229,214)'` sur fond sombre |
| `weight`  | `1`          | multiplicateur d'épaisseur |
| `shake`   | `1`          | multiplicateur de tremblé |
| `weights` | défauts      | preset de population |
| `force`   | `{}`         | traits imposés, ex. `{ hat: 'beanie', beard: 'none' }` |
| `color`   | `1`          | fréquence des touches de couleur ; `0` = encre seule |
| `turn`    | `1`          | fréquence des têtes tournées ; `0` = toutes de face |
| `mood`    | `0`          | −1..1, humeur moyenne de la population |
| `kin`     | défauts      | pondération des espèces, ex. `{ orc: 50, human: 50 }` |
| `look`    | défauts      | pondération des archétypes |
| `accents` | `true`       | `false` pour ne pas peindre la couche couleur d'un génome |
| `lod`     | selon la taille | niveau de détail 0..1 ; bas pour un glisser, `1` pour un export |
| `dpr`     | auto         | plafonné à 1,5 sous 200 px et 2 au-delà |

### Le génome

```js
const g = makeGenome('pnj-42');
g.hat.style = 'beanie';       // on retouche
g.pen.shake = 2;              // main plus tremblante
g.hair.asym = 0.4;            // une tempe bien plus fournie que l'autre
g.accents = [];               // ou on retire la couleur
drawFace(ctx, g, { size: 256 });

// du noir et blanc strict
makeGenome('pnj-42', { color: 0 });

const foule = makeGenomes('village', 40);   // 40 génomes stables
```

Traits disponibles : `HEAD_SHAPES` (14), `EYE_STYLES` (22), `BROW_STYLES` (10),
`NOSE_STYLES` (14), `MOUTH_STYLES` (18), `HAIR_STYLES` (27), `BEARD_STYLES` (15),
`GLASSES_STYLES` (10), `HAT_STYLES` (15), `EAR_STYLES` (7), `KIN_NAMES` (12),
`LOOK_NAMES` (17), `PEN_NAMES` (8) — tous exportés par `face.js`.

`force` accepte n'importe laquelle de ces clés, y compris `kin`, `look` et
`pen` :

```js
makeGenome('boss', { force: { kin: 'orc', look: 'metal', pen: 'charcoal' } });
```

### Populations

```js
import { PRESETS } from './src/faces/presets.js';
makeGenome('pnj-42', PRESETS.tavern);
```

Un preset **est** un objet d'options : il porte trois cadrans — `kin` (quelles
créatures), `look` (quels archétypes), `weights` (les traits individuels) — et
ne change jamais la façon dont quoi que ce soit est dessiné. Ajoute les tiens
dans `presets.js` plutôt que de toucher aux valeurs par défaut.

Fournis : `notebook` (le carnet de référence), `humains`, `crowd` (lisible en
vignette), `kids`, `gamblers` (pour HoH2), `tavern` (tout le bestiaire),
`carnival` (tout à fond, pour inspecter les styles).

### Planches

```js
const sheet = renderSheet(makeGenomes('village', 48), { cell: 200, cols: 8 });
document.body.append(sheet);        // ou sheet.toDataURL('image/png')
```

---

## Chasser un visage précis

Les presets font venir *un genre de foule*. Quand tu veux **ce visage-là** — vu
sur une planche, dans une référence, dans une planche générée qui t'a plu — la
méthode est en quatre temps.

**1. Épingler ce qui saute aux yeux.** Les menus déroulants du site imposent
n'importe quel trait. Pour un bonnet tricoté + lunettes noires + moustache :
espèce `humain`, archétype `quelconque`, crâne `round`, chapeau `beanie`,
lunettes `sunglasses`, barbe `mustache`, nez `long`, bouche `line`, plume
`fusain`. Mets *Orientation* et *Couleur* à `0`.

**2. Relancer jusqu'à approcher.** Il reste des dizaines de tirages libres —
proportions, teintes, taches. Quelques « Nouvelle planche » suffisent à tomber
sur un candidat.

**3. Régler à la main.** Clique sur le visage : le panneau de droite affiche son
**génome, éditable**. Change des valeurs, clique **Appliquer**, le portrait se
redessine. C'est là que se joue le plus gros de la ressemblance, parce que les
menus ne touchent qu'aux traits énumérés — pas aux nombres :

| ce qui manquait | le champ |
|---|---|
| bonnet en aplat noir au lieu de laine hachurée | `hat.tone: "mid"` (`dark` remplit) |
| moustache réduite à un filet | `beard.tone: "dark"`, `beard.gap: 1.5` |
| verres trop petits | `glasses.size: 1.3` |
| crâne trop rond, mâchoire trop fine | `head.jaw: 1.2`, `head.brow: 0.86`, `head.exp: 2.3` |
| joues nues | `marks.freckles: 26` |

Rien n'empêche de sortir des plages du générateur : `mouth.w: 1.75` déborde de
l'intervalle tiré au sort, et c'est très bien — un génome n'est que de la
donnée.

**4. Figer en recette.** Une fois les valeurs trouvées, `Copier le génome` puis
range-les dans `recipes.js` :

```js
import { makeRecipe, renderFace } from './src/faces/face.js';

// le même personnage, autant de fois que tu veux
document.body.append(renderFace(makeRecipe('beanieShades', 'pnj-7'), { size: 256 }));
```

Une recette a deux moitiés, parce que `force` ne sait épingler que les traits
énumérés : `opts` (ce qu'on impose avant la génération) et `tune` (les nombres
qu'on écrase après). La graine continue de faire varier tout ce que la recette
n'a pas fixé — le tremblé du trait, les taches de rousseur exactes, les plis du
bonnet. `makeRecipe('beanieShades', i)` donne donc des **frères et sœurs**, pas
des clones.

---

## Croiser deux visages

Le vrai bénéfice du génome-donnée. Les traits énumérés s'héritent **en entier**
d'un parent ou de l'autre (la moitié d'une coiffure n'est pas une coiffure), les
nombres se **mélangent** avec un peu de dérive — un enfant n'est donc jamais
exactement la moyenne de ses parents.

```js
import { breed, brood, makeGenome } from './src/faces/face.js';

const mum = makeGenome('mum');
const dad = makeGenome('dad');

breed(mum, dad, 'kid-1');        // un enfant
brood(mum, dad, 'kid', 6);       // six frères et sœurs
```

Sur le site : panneau **Lineage** en mode focus. Pratique pour une ressemblance
familiale dans un jeu — mêmes parents, graines d'enfants différentes.

---

## Réutiliser dans un jeu

### Voie 1 — atlas pré-cuit (recommandée)

Sur le site : choisis une population, une graine, puis **Atlas + manifeste**.
Tu récupères un PNG transparent et un JSON qui décrit les cases.

```js
import { buildAtlas, atlasSeeds } from './src/faces/atlas.js';
const { canvas, manifest } = buildAtlas(atlasSeeds('hoh2', 256), {
  cell: 192,
  ink: 'rgb(236,229,214)',   // encre claire, fond sombre
});
```

Côté Godot 4, `godot/doodle_faces.gd` fait le reste :

```gdscript
# autoload nommé DoodleFaces
var tex := DoodleFaces.texture_for("dealer_3")
$Portrait.texture = tex
```

`texture_for()` hache l'identifiant avec **exactement** le même FNV-1a que le
générateur JS, donc `"dealer_3"` tombe sur la même tête dans l'éditeur, dans le
jeu, et dans la prévisualisation web. Vérifié : `hashSeed("dealer_3")` vaut
`3056619830` des deux côtés.

Avec 256 visages dans un atlas de 192 px, tu es à ~3 Mo et le coût à l'exécution
est nul. Pour un roguelite, 256 têtes distinctes, c'est déjà l'infini.

### Voie 2 — génération à l'exécution

Il faut alors porter le renderer dans le moteur. C'est faisable — le code est
écrit exprès en style portable, et `godot/doodle_faces.gd` contient déjà le
`hash_seed` et l'`imul32` 32 bits qui garantissent des graines identiques — mais
ça veut dire maintenir deux renderers en parallèle : chaque nouvelle coiffure
s'écrit deux fois. À ne faire que si tu as vraiment besoin d'un nombre non borné
de visages, ou de laisser le joueur personnaliser le sien.

Note pour un portage : Godot n'a pas de découpe de tracé sur `CanvasItem`, mais
`Geometry2D.intersect_polyline_with_polygon()` remplace exactement le `clip`
utilisé par `ink.hatch()` et `ink.flow()`.

---

## Déterminisme, en pratique

Les choix structurels (forme de crâne, style d'œil, coiffure, chapeau…) passent
uniquement par des tirages entiers sur le PRNG : ils sont identiques au bit près
partout. Les paramètres continus tirés par `rng.gauss()` utilisent `log` et `cos`
et peuvent différer sur les derniers chiffres significatifs d'un moteur à
l'autre — invisible à l'œil, mais à savoir si tu compares des rendus au pixel.

Ajouter un trait au milieu de `makeGenome()` décale la suite des tirages et
change donc tous les visages existants. Si tu dois garder un pool stable dans
un jeu déjà publié : dérive le nouveau trait d'un flux séparé (`rng.fork('tag')`)
ou fige l'atlas.
