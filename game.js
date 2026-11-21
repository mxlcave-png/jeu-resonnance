const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

// Le personnage
const joueur = {
  x: 380, y: 100, taille: 40,
  vitesse: 4,
  vitesseY: 0,       // vitesse de chute ou de saut
  auSol: false
};

const GRAVITE = 0.6;
const FORCE_SAUT = -12;

// Les plateformes (x, y, largeur, hauteur)
const plateformes = [
  { x: 0, y: 410, largeur: 800, hauteur: 40 },   // le sol
  { x: 250, y: 310, largeur: 150, hauteur: 20 }  // une plateforme
];

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

  // Gravité
  joueur.vitesseY += GRAVITE;
  joueur.y += joueur.vitesseY;

  // Collision avec les plateformes
  joueur.auSol = false;
  for (const p of plateformes) {
    const toucheX = joueur.x + joueur.taille > p.x && joueur.x < p.x + p.largeur;
    const toucheY = joueur.y + joueur.taille > p.y && joueur.y < p.y + p.hauteur;
    // On ne se pose que si l'on tombe sur la plateforme
    if (toucheX && toucheY && joueur.vitesseY >= 0) {
      joueur.y = p.y - joueur.taille;
      joueur.vitesseY = 0;
      joueur.auSol = true;
    }
  }
}

function dessiner() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dessiner les plateformes
  ctx.fillStyle = "#3a4466";
  for (const p of plateformes) {
    ctx.fillRect(p.x, p.y, p.largeur, p.hauteur);
  }

  // Dessiner le personnage
  ctx.fillStyle = "#4da6ff";
  ctx.fillRect(joueur.x, joueur.y, joueur.taille, joueur.taille);
}

function boucle() {
  mettreAJour();
  dessiner();
  requestAnimationFrame(boucle);
}

boucle();