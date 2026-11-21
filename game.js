const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

// Taille du monde (plus large que l'écran)
const LARGEUR_MONDE = 2000;
const HAUTEUR_MONDE = 450;

// Le personnage
const joueur = {
  x: 380, y: 100, taille: 40,
  vitesse: 4,
  vitesseY: 0,
  auSol: false
};

const GRAVITE = 0.6;
const FORCE_SAUT = -12;

// Les plateformes (x, y, largeur, hauteur)
const plateformes = [
  { x: 0, y: 410, largeur: 2000, hauteur: 40 },   // le sol
  { x: 250, y: 310, largeur: 150, hauteur: 20 },
  { x: 500, y: 250, largeur: 150, hauteur: 20 },
  { x: 800, y: 340, largeur: 200, hauteur: 20 },
  { x: 1200, y: 280, largeur: 150, hauteur: 20 },
  { x: 1550, y: 220, largeur: 200, hauteur: 20 }
];

// Caméra
const camera = { x: 0 };

// Touches appuyées
const touches = {};
document.addEventListener("keydown", (e) => {
  touches[e.key] = true;
  if ((e.key === "ArrowUp" || e.key === " ") && joueur.auSol) {
    joueur.vitesseY = FORCE_SAUT;
    joueur.auSol = false;
  }
});
document.addEventListener("keyup", (e) => touches[e.key] = false);

function mettreAJour() {
  // Déplacement horizontal
  if (touches["ArrowLeft"]) joueur.x -= joueur.vitesse;
  if (touches["ArrowRight"]) joueur.x += joueur.vitesse;

  // Limites du monde (le personnage ne sort plus)
  if (joueur.x < 0) joueur.x = 0;
  if (joueur.x + joueur.taille > LARGEUR_MONDE) {
    joueur.x = LARGEUR_MONDE - joueur.taille;
  }

  // Gravité
  joueur.vitesseY += GRAVITE;
  joueur.y += joueur.vitesseY;

  // Collision avec les plateformes
  joueur.auSol = false;
  for (const p of plateformes) {
    const toucheX = joueur.x + joueur.taille > p.x && joueur.x < p.x + p.largeur;
    const toucheY = joueur.y + joueur.taille > p.y && joueur.y < p.y + p.hauteur;
    if (toucheX && toucheY && joueur.vitesseY >= 0) {
      joueur.y = p.y - joueur.taille;
      joueur.vitesseY = 0;
      joueur.auSol = true;
    }
  }

  // La caméra suit le personnage, en restant dans le monde
  camera.x = joueur.x + joueur.taille / 2 - canvas.width / 2;
  if (camera.x < 0) camera.x = 0;
  if (camera.x > LARGEUR_MONDE - canvas.width) {
    camera.x = LARGEUR_MONDE - canvas.width;
  }
}

function dessiner() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Tout ce qui suit est décalé par la caméra
  ctx.save();
  ctx.translate(-camera.x, 0);

  // Plateformes
  ctx.fillStyle = "#3a4466";
  for (const p of plateformes) {
    ctx.fillRect(p.x, p.y, p.largeur, p.hauteur);
  }

  // Personnage
  ctx.fillStyle = "#4da6ff";
  ctx.fillRect(joueur.x, joueur.y, joueur.taille, joueur.taille);

  ctx.restore();
}

function boucle() {
  mettreAJour();
  dessiner();
  requestAnimationFrame(boucle);
}

boucle();