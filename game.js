const canvas = document.getElementById("jeu");
const ctx = canvas.getContext("2d");

// ----- Réglages repris du projet Godot « fracture » -----
const TAILLE_TUILE = 16;               // taille par défaut d'une tuile Godot
const GRAVITE = 980;                   // gravité par défaut de Godot en 2D
const VITESSE = 200;
const FORCE_SAUT = -300;
const SAUTS_MAX = 2;                   // double saut
const VITESSE_DASH = 500;
const DUREE_DASH = 0.2;                // en secondes
const ZONE_MORT_Y = 1253 - 1568 / 2;   // haut de la zone de mort (469)
const DEPART_X = -16;
const DEPART_Y = -42;

// ----- Niveau : chaque ligne de tuiles est [numéro de ligne, [[début, fin], ...]] -----
const LIGNES = [
  [8,  [[44, 58], [63, 72], [74, 78]]],
  [9,  [[-12, 2], [7, 21], [28, 37], [44, 58], [63, 72], [74, 78]]],
  [10, [[-12, 2], [7, 21], [28, 38], [44, 58], [63, 72], [74, 78]]],
  [11, [[-12, 2], [7, 21], [28, 38], [44, 58], [63, 72], [74, 78]]],
  [12, [[-12, 2], [7, 21], [28, 38], [45, 57], [63, 72], [74, 78]]],
  [13, [[-12, 2], [7, 21], [29, 37], [45, 50], [52, 52], [54, 56], [63, 72], [74, 78]]],
  [14, [[-11, 2], [8, 21], [29, 37], [45, 48], [54, 54]]],
  [15, [[-11, -8], [-4, 1], [8, 11], [15, 20], [29, 36]]],
  [16, [[31, 36]]],
  [18, [[37, 37]]],
  [20, [[-9, -9], [-1, -1], [15, 15]]],
  [42, [[171, 171]]]
];

// Transforme les lignes en rectangles de collision (x, y, largeur, hauteur en pixels)
const SOLS = [];
for (const [ligne, segments] of LIGNES) {
  for (const [debut, fin] of segments) {
    SOLS.push({
      x: debut * TAILLE_TUILE,
      y: ligne * TAILLE_TUILE,
      w: (fin - debut + 1) * TAILLE_TUILE,
      h: TAILLE_TUILE
    });
  }
}
// Mur vertical très bas à gauche
SOLS.push({ x: -88 * TAILLE_TUILE, y: 363 * TAILLE_TUILE, w: 4 * TAILLE_TUILE, h: 10 * TAILLE_TUILE });

// ----- Le personnage -----
const joueur = {
  x: DEPART_X, y: DEPART_Y, w: 32, h: 95,
  vx: 0, vy: 0,
  auSol: false,
  sautsRestants: SAUTS_MAX,
  enDash: false,
  dashTimer: 0,
  direction: 1          // 1 = droite, -1 = gauche
};

// ----- Armes et pouvoirs -----
const modes = ["epee", "arc"];
let indexMode = 0;
let resonanceActive = false;
const attaques = [];

// ----- Caméra -----
const camera = { x: 0, y: 0 };

// ----- Contrôles -----
const touches = {};
let demandeSaut = false;
let demandeDash = false;

document.addEventListener("keydown", (e) => {
  touches[e.code] = true;

  if (!e.repeat && (e.code === "Space" || e.code === "ArrowUp")) demandeSaut = true;
  if (!e.repeat && (e.code === "ShiftLeft" || e.code === "ShiftRight")) demandeDash = true;
  if (e.code === "Space") e.preventDefault();

  // E : changer d'arme
  if (e.key === "e" || e.key === "E") {
    indexMode = (indexMode + 1) % modes.length;
  }
  // T : activer ou désactiver la résonance
  if (e.key === "t" || e.key === "T") {
    resonanceActive = !resonanceActive;
  }
});
document.addEventListener("keyup", (e) => touches[e.code] = false);

// Souris : clic gauche = attaque, clic droit = attaque spéciale
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) attaquer(false);
  if (e.button === 2) attaquer(true);
});

// ----- Collisions -----
function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function estAuSol() {
  const bas = joueur.y + joueur.h;
  for (const s of SOLS) {
    if (joueur.x < s.x + s.w && joueur.x + joueur.w > s.x && Math.abs(bas - s.y) < 0.5) {
      return true;
    }
  }
  return false;
}

function deplacer(dt) {
  // Axe horizontal
  joueur.x += joueur.vx * dt;
  for (const s of SOLS) {
    if (chevauche(joueur, s)) {
      if (joueur.vx > 0) joueur.x = s.x - joueur.w;
      else if (joueur.vx < 0) joueur.x = s.x + s.w;
      joueur.vx = 0;
    }
  }

  // Axe vertical
  joueur.y += joueur.vy * dt;
  for (const s of SOLS) {
    if (chevauche(joueur, s)) {
      if (joueur.vy > 0) joueur.y = s.y - joueur.h;
      else if (joueur.vy < 0) joueur.y = s.y + s.h;
      joueur.vy = 0;
    }
  }

  joueur.auSol = estAuSol();
}

function reinitialiser() {
  Object.assign(joueur, {
    x: DEPART_X, y: DEPART_Y, vx: 0, vy: 0,
    auSol: false, sautsRestants: SAUTS_MAX,
    enDash: false, dashTimer: 0
  });
  attaques.length = 0;
}

// ----- Attaques -----
function attaquer(speciale) {
  const arme = modes[indexMode];
  const resonance = resonanceActive || speciale;
  const cx = joueur.x + joueur.w / 2;
  const cy = joueur.y + joueur.h / 2;

  if (arme === "epee") {
    const largeur = 50;
    const x = joueur.direction === 1 ? joueur.x + joueur.w : joueur.x - largeur;
    attaques.push({ type: "lame", x: x, y: cy - 20, largeur: largeur, hauteur: 40, duree: 0.2, resonance: resonance });
  } else {
    attaques.push({ type: "fleche", x: cx, y: cy - 10, vx: joueur.direction * 600, duree: 2, resonance: resonance });
  }
}

function toucheUnSol(x, y) {
  for (const s of SOLS) {
    if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
  }
  return false;
}

function mettreAJourAttaques(dt) {
  for (let i = attaques.length - 1; i >= 0; i--) {
    const a = attaques[i];
    a.duree -= dt;
    if (a.type === "fleche") {
      a.x += a.vx * dt;
      if (toucheUnSol(a.x, a.y)) {
        attaques.splice(i, 1);
        continue;
      }
    }
    if (a.duree <= 0) attaques.splice(i, 1);
  }
}

// ----- Mise à jour -----
function mettreAJour(dt) {
  // Dash
  if (demandeDash && !joueur.enDash) {
    joueur.enDash = true;
    joueur.dashTimer = DUREE_DASH;
    joueur.vx = joueur.direction * VITESSE_DASH;
    joueur.vy = 0;
  }
  demandeDash = false;

  if (joueur.enDash) {
    // Pendant le dash : pas de gravité
    joueur.dashTimer -= dt;
    deplacer(dt);
    if (joueur.dashTimer <= 0) {
      joueur.enDash = false;
      joueur.vx = 0;
    }
  } else {
    // Déplacement horizontal
    let dir = 0;
    if (touches["ArrowLeft"] || touches["KeyA"]) dir -= 1;
    if (touches["ArrowRight"] || touches["KeyD"]) dir += 1;
    joueur.vx = dir * VITESSE;
    if (dir !== 0) joueur.direction = dir;

    // Gravité, et réinitialisation des sauts au sol
    if (!joueur.auSol) {
      joueur.vy += GRAVITE * dt;
    } else {
      joueur.sautsRestants = SAUTS_MAX;
    }

    // Saut (sol puis double saut)
    if (demandeSaut && joueur.sautsRestants > 0) {
      joueur.vy = FORCE_SAUT;
      joueur.sautsRestants--;
      joueur.auSol = false;
    }

    deplacer(dt);
  }
  demandeSaut = false;

  // Zone de mort : on recommence au départ
  if (joueur.y + joueur.h > ZONE_MORT_Y) reinitialiser();

  mettreAJourAttaques(dt);

  // Caméra qui suit le personnage
  camera.x = joueur.x + joueur.w / 2 - canvas.width / 2;
  camera.y = joueur.y + joueur.h / 2 - canvas.height / 2;
}

// ----- Dessin -----
function dessiner() {
  ctx.fillStyle = "#0d1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  // Tuiles du niveau
  ctx.fillStyle = "#3a3142";
  for (const s of SOLS) {
    ctx.fillRect(s.x, s.y, s.w, s.h);
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
  ctx.fillRect(joueur.x, joueur.y, joueur.w, joueur.h);

  // Arme dans la main
  const arme = modes[indexMode];
  const droite = joueur.direction === 1;
  if (arme === "epee") {
    const x = droite ? joueur.x + joueur.w - 4 : joueur.x - 26;
    ctx.fillStyle = resonanceActive ? "#9be7ff" : "#cfd8e3";
    ctx.fillRect(x, joueur.y + 40, 30, 5);
  } else {
    const cx = droite ? joueur.x + joueur.w + 6 : joueur.x - 6;
    const cy = joueur.y + 45;
    ctx.strokeStyle = resonanceActive ? "#9be7ff" : "#c9a66b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (droite) {
      ctx.arc(cx, cy, 14, -Math.PI / 2, Math.PI / 2);
    } else {
      ctx.arc(cx, cy, 14, Math.PI / 2, Math.PI * 1.5);
    }
    ctx.stroke();
  }

  ctx.restore();

  // Affichage fixe à l'écran
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Arial";
  ctx.fillText("Arme : " + (arme === "epee" ? "Épée" : "Arc"), 10, 25);
  ctx.fillText("Résonance : " + (resonanceActive ? "ON" : "OFF"), 10, 47);
  ctx.fillText("Clic gauche : attaque   Clic droit : attaque spéciale", 10, canvas.height - 12);
}

// ----- Boucle de jeu -----
let dernier = performance.now();
function boucle(t) {
  const dt = Math.min((t - dernier) / 1000, 1 / 30);
  dernier = t;
  mettreAJour(dt);
  dessiner();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);