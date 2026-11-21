const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

// Le personnage
const joueur = { x: 380, y: 200, taille: 40, vitesse: 4 };

// Touches appuyées
const touches = {};
document.addEventListener("keydown", (e) => touches[e.key] = true);
document.addEventListener("keyup", (e) => touches[e.key] = false);

function mettreAJour() {
  if (touches["ArrowLeft"]) joueur.x -= joueur.vitesse;
  if (touches["ArrowRight"]) joueur.x += joueur.vitesse;
  if (touches["ArrowUp"]) joueur.y -= joueur.vitesse;
  if (touches["ArrowDown"]) joueur.y += joueur.vitesse;
}

function dessiner() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#4da6ff";
  ctx.fillRect(joueur.x, joueur.y, joueur.taille, joueur.taille);
}

function boucle() {
  mettreAJour();
  dessiner();
  requestAnimationFrame(boucle);
}

boucle();