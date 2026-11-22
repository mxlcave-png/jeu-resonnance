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
  auSol: false,
  direction: 1          // 1 = regarde à droite, -1 = regarde à gauche
};

const GRAVITE = 0.6;
const FORCE_SAUT = -12;

// Armes et pouvoirs
const modes = ["epee", "arc"];
let indexMode = 0;
let resonanceActive = false;

// Attaques en cours (lames et flèches)
const attaques = [];

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

  // E : afficher l'arme suivante dans la main
  if (e.key === "e" || e.key === "E") {
    indexMode = (indexMode + 1) % modes.length;
  }

  // T : activer ou désactiver la résonance
  if (e.key === "t" || e.key === "T") {
    resonanceActive = !resonanceActive;
  }

  // Saut
  if ((e.key === "ArrowUp" || e.key === " ") && joueur.auSol) {
    joueur.vitesseY = FORCE_SAUT;
    joueur.auSol = false;
  }
});
document.addEventListener("keyup", (e) => touches[e.key] = false);

// Souris : clic gauche = attaque, clic droit = attaque spéciale
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) attaquer(false);
  if (e.button === 2) attaquer(true);
});

function attaquer(speciale) {
  const arme = modes[indexMode];
  const cy = joueur.y + joueur.taille / 2;
  const resonance = resonanceActive || speciale;

  if (arme === "epee") {
    // Une lame apparaît devant le personnage pendant un court instant
    const largeur = 50;
    const x = joueur.direction === 1 ? joueur.x + joueur.taille : joueur.x - largeur;
    attaques.push({
      type: "lame",
      x: x,
      y: joueur.y,
      largeur: largeur,
      hauteur: joueur.taille,
      duree: 15,
      resonance: resonance
    });
  } else {
    // Une flèche part dans la direction du personnage
    attaques.push({
      type: "fleche",
      x: joueur.x + joueur.taille / 2,
      y: cy,
      vx: joueur.direction * 10,
      duree: 120,
      resonance: resonance
    });
  }
}

function toucheUnePlateforme(x, y) {
  for (const p of plateformes) {
    if (x > p.x && x < p.x + p.largeur && y > p.y && y < p.y + p.hauteur) {
      return true;
    }
  }
  return false;
}

function mettreAJour() {
  // Déplacement horizontal et direction du regard
  if (touches["ArrowLeft"]) {
    joueur.x -= joueur.vitesse;
    joueur.direction = -1;
  }
  if (touches["ArrowRight"]) {
    joueur.x += joueur.vitesse;
    joueur.direction = 1;
  }

  // Limites du monde
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

  // Mise à jour des attaques
  for (let i = attaques.length - 1; i >= 0; i--) {
    const a = attaques[i];
    a.duree--;

    if (a.type === "fleche") {
      a.x += a.vx;
      // La flèche disparaît si elle touche une plateforme ou sort du monde
      if (toucheUnePlateforme(a.x, a.y) || a.x < 0 || a.x > LARGEUR_MONDE) {
        attaques.splice(i, 1);
        continue;
      }
    }

    if (a.duree <= 0) {
      attaques.splice(i, 1);
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

  // Monde (décalé par la caméra)
  ctx.save();
  ctx.translate(-camera.x, 0);

  // Plateformes
  ctx.fillStyle = "#3a4466";
  for (const p of plateformes) {
    ctx.fillRect(p.x, p.y, p.largeur, p.hauteur);
  }

  // Attaques
  for (const a of attaques) {
    if (a.type === "lame") {
      ctx.fillStyle = a.resonance ? "rgba(155, 231, 255, 0.7)" : "rgba(255, 255, 255, 0.7)";
      ctx.fillRect(a.x, a.y, a.largeur, a.hauteur);
    } else {
      ctx.fillStyle = a.resonance ? "#9be7ff" : "#ffffff";
      ctx.fillRect(a.x - 8, a.y - 1, 16, 3);
    }
  }

  // Personnage
  ctx.fillStyle = "#4da6ff";
  ctx.fillRect(joueur.x, joueur.y, joueur.taille, joueur.taille);

  // Arme tenue dans la main
  const arme = modes[indexMode];
  if (arme === "epee") {
    const x = joueur.direction === 1 ? joueur.x + joueur.taille - 4 : joueur.x - 26;
    ctx.fillStyle = resonanceActive ? "#9be7ff" : "#cfd8e3";
    ctx.fillRect(x, joueur.y + 15, 30, 5);
  } else {
    const cx = joueur.direction === 1 ? joueur.x + joueur.taille + 6 : joueur.x - 6;
    const cy = joueur.y + joueur.taille / 2;
    ctx.strokeStyle = resonanceActive ? "#9be7ff" : "#c9a66b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (joueur.direction === 1) {
      ctx.arc(cx, cy, 14, -Math.PI / 2, Math.PI / 2);
    } else {
      ctx.arc(cx, cy, 14, Math.PI / 2, Math.PI * 1.5);
    }
    ctx.stroke();
  }

  ctx.restore();

  // Affichage de l'arme et de la résonance (fixe à l'écran)
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  ctx.fillText("Arme : " + (arme === "epee" ? "Épée" : "Arc"), 10, 25);
  ctx.fillText("Résonance : " + (resonanceActive ? "ON" : "OFF"), 10, 47);
  ctx.fillText("Clic gauche : attaque   Clic droit : attaque spéciale", 10, canvas.height - 12);
}

function boucle() {
  mettreAJour();
  dessiner();
  requestAnimationFrame(boucle);
}

boucle();