const app = new PIXI.Application(); // En ny PIXI-applikation
await app.init({
    resizeTo: window, //  Gör canvas lika stor som hemsidan
    backgroundAlpha: 0, //Gör backgrunden genomskinlig
    antialias: true, // Gör kanterna mjukare
    resolution: Math.min(window.devicePixelRatio || 1, 2), // Gör canvas skarpare på högupplösta skärmar
    autoDensity: true,
});
document.getElementById("stage").appendChild(app.canvas); // Gör så att canvas syns på hemsidan

const fieldLayer = new PIXI.Graphics(); //Lager
const artLayer = new PIXI.Graphics(); // Lager
app.stage.addChild(fieldLayer, artLayer); // Lägger till lagren på PIXI

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches; // Kollar om användaren vill ha reducerad animation

const colours = {}; // Objekt som håller färgerna

function readColours() { // Funktion som läser färgerna från CSS
    const css = getComputedStyle(document.documentElement);
    for (const name of ["ink", "muted", "accent", "tile"]) { // Loopar igenom färgerna
        colours[name] = new PIXI.Color(css.getPropertyValue(`--${name}`).trim()).toNumber();
    }
}

readColours(); // Läser färgerna när sidan laddas
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColours); // Lyssnar på om användaren byter färgschema

const pointer = { x: -9999, y: -9999 }; // Objekt som håller muspekaren
const ripples = []; // Array som håller alla ringar som sprider sig när man klickar

window.addEventListener("pointermove", (e) => { // Lyssnar på musrörelser
    pointer.x = e.clientX;
    pointer.y = e.clientY;
});

window.addEventListener("pointerdown", (e) => { // Lyssnar på musklick
    ripples.push({ x: e.clientX, y: e.clientY, born: performance.now() });
});

const tiles = [...document.querySelectorAll(".tile")].map((el) => { // Loopar igenom alla element med klassen "tile"
    const tile = {
        box: el.querySelector(".art"),
        motif: el.querySelector(".art").dataset.motif,
        hover: 0,
        target: 0,
    };
    el.addEventListener("pointerenter", () => { tile.target = 1; }); // Lyssnar på när muspekaren går in i elementet
    el.addEventListener("pointerleave", () => { tile.target = 0; }); // Lyssnar på när muspekaren går ut ur elementet
    return tile;
});

const SPACING = 28;
const PUSH_RADIUS = 150;
const RIPPLE_SPEED = 500;
const RIPPLE_LIFE = 2000;

let dots = []; // Array som håller alla punkter i fältet

function buildField() { // Funktion som bygger fältet
    dots = [];
    for (let x = SPACING / 2; x < window.innerWidth; x += SPACING) {
        for (let y = SPACING / 2; y < window.innerHeight; y += SPACING) {
            dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 });
        }
    }
}

function pushAway(dot, fromX, fromY, radius, strength) { // Funktion som pushar bort punkterna från muspekaren eller ringarna
    const dx = dot.x - fromX;
    const dy = dot.y - fromY;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < radius) {
        const force = (1 - distance / radius) * strength;
        dot.vx += (dx / distance) * force;
        dot.vy += (dy / distance) * force;
    }
}

function updateField(now) { // Funktion som uppdaterar fältet
    while (ripples.length && now - ripples[0].born > RIPPLE_LIFE) ripples.shift(); // Tar bort ringar som är för gamla

    for (const dot of dots) {
        pushAway(dot, pointer.x, pointer.y, PUSH_RADIUS, 1.2);

        for (const ripple of ripples) {
            const age = now - ripple.born;
            const ringRadius = (age / 1000) * RIPPLE_SPEED;
            const fromRing = Math.abs(Math.hypot(dot.x - ripple.x, dot.y - ripple.y) - ringRadius);
            if (fromRing < 20) pushAway(dot, ripple.x, ripple.y, ringRadius + 20, 3 * (1 - age / RIPPLE_LIFE));
        }

        dot.vx = (dot.vx + (dot.homeX - dot.x) * 0.06) * 0.82; // Lägger till en kraft som drar punkterna tillbaka till sin ursprungliga position
        dot.vy = (dot.vy + (dot.homeY - dot.y) * 0.06) * 0.82;
        dot.x += dot.vx;
        dot.y += dot.vy;
    }
}

function drawField() { // Funktion som ritar fältet
    fieldLayer.clear();

    const moving = [];
    for (const dot of dots) {
        const offset = Math.abs(dot.x - dot.homeX) + Math.abs(dot.y - dot.homeY);
        if (offset > 3) moving.push(dot);
        else fieldLayer.rect(dot.x - 1, dot.y - 1, 2, 2);
    }
    fieldLayer.fill({ color: colours.muted, alpha: 0.4 });

    for (const dot of moving) fieldLayer.rect(dot.x - 1.5, dot.y - 1.5, 3, 3);
    fieldLayer.fill(0xFF00B3);
}

buildField(); // Bygger fältet när sidan laddas
window.addEventListener("resize", buildField);

function seededRandom(seed) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
}

const random = seededRandom(7); // Skapar en funktion som ger samma slumpmässiga tal varje gång sidan laddas
const scatterPoints = Array.from({ length: 48 }, () => ({ x: random(), y: random(), phase: random() * 6.28 }));

const motifs = { // Objekt som håller alla mönster
    bloom(g, x, y, w, h, t, hover) {
        const cx = x + w / 2, cy = y + h / 2;
        const petals = 14;
        const open = 0.35 + 0.15 * Math.sin(t * 0.8) + hover * 0.5;
        const length = Math.min(w, h) * 0.4 * open;

        for (let i = 0; i < petals; i++) {
            const angle = (i / petals) * Math.PI * 2 + t * 0.1;
            const side = 0.18;
            g.poly([
                cx, cy,
                cx + Math.cos(angle - side) * length * 0.6, cy + Math.sin(angle - side) * length * 0.6,
                cx + Math.cos(angle) * length, cy + Math.sin(angle) * length,
                cx + Math.cos(angle + side) * length * 0.6, cy + Math.sin(angle + side) * length * 0.6,
            ]);
        }
        g.fill({ color: colours.accent, alpha: hover * 0.25 });
        g.stroke({ width: 1.25, color: colours.ink });
    },

    idols(g, x, y, w, h, t, hover) { // Funktion som ritar mönstret "idols"
        const columns = 4, rows = 12;
        const columnWidth = (w * 0.8) / columns;
        const rowHeight = (h * 0.7) / rows;
        const sway = 1 - hover;

        for (let c = 0; c < columns; c++) {
            const centre = x + w * 0.1 + columnWidth * (c + 0.5);
            for (let r = 0; r < rows; r++) {
                const barWidth = columnWidth * (0.25 + 0.5 * Math.abs(Math.sin(r * 0.7 + c * 1.3)));
                const shift = Math.sin(t * 1.2 + r * 0.4 + c) * columnWidth * 0.15 * sway;
                g.rect(centre - barWidth / 2 + shift, y + h * 0.15 + r * rowHeight, barWidth, rowHeight * 0.6);
            }
        }
        g.fill(hover > 0.5 ? colours.accent : colours.ink);
    },

    scatter(g, x, y, w, h, t, hover) { // Funktion som ritar mönstret "scatter"
        const points = scatterPoints.map((p) => ({
            x: x + w * (0.1 + 0.8 * p.x) + Math.sin(t * 0.7 + p.phase) * 10,
            y: y + h * (0.1 + 0.8 * p.y) + Math.cos(t * 0.5 + p.phase) * 10,
        }));

        if (hover > 0.01) {
            for (let i = 0; i < points.length; i++) {
                for (let j = i + 1; j < points.length; j++) {
                    if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < w * 0.16) {
                        g.moveTo(points[i].x, points[i].y).lineTo(points[j].x, points[j].y);
                    }
                }
            }
            g.stroke({ width: 1, color: colours.accent, alpha: hover * 0.8 });
        }

        for (const p of points) g.circle(p.x, p.y, 2.5);
        g.fill(colours.ink);
    },

    grid(g, x, y, w, h, t, hover) { // Funktion som ritar mönstret "grid"
        const columns = 8, rows = 6;
        const cellW = (w * 0.8) / columns, cellH = (h * 0.8) / rows;

        for (let i = 0; i < columns; i++) {
            for (let j = 0; j < rows; j++) {
                const size = 0.5 + 0.5 * Math.sin(t * (1 + hover * 2) + i * 0.6 + j * 0.9);
                const cx = x + w * 0.1 + cellW * (i + 0.5);
                const cy = y + h * 0.1 + cellH * (j + 0.5);
                g.rect(cx - (cellW * size) / 2.4, cy - (cellH * size) / 2.4, (cellW * size) / 1.2, (cellH * size) / 1.2);
            }
        }
        g.fill(hover > 0.5 ? colours.accent : colours.ink);
        g.rect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8).stroke({ width: 1.5, color: colours.ink });
    },

    rings(g, x, y, w, h, t, hover) { // Funktion som ritar mönstret "rings"
        const cx = x + w / 2, cy = y + h / 2;
        const maxRadius = Math.min(w, h) * 0.45;
        const count = 7;

        for (let k = 0; k < count; k++) {
            const radius = (t * (18 + hover * 40) + (k * maxRadius) / count) % maxRadius;
            g.circle(cx, cy, radius).stroke({
                width: 1.5,
                color: hover > 0.5 ? colours.accent : colours.ink,
                alpha: 1 - radius / maxRadius,
            });
        }
        g.circle(cx, cy, 5 + hover * 4).fill(colours.ink);
    },

    links(g, x, y, w, h, t, hover) { // Funktion som ritar mönstret "links"
        const count = 7;
        const cx = x + w / 2, cy = y + h / 2;
        const nodes = [];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + t * 0.15;
            const radius = Math.min(w, h) * (0.28 + 0.08 * Math.sin(t + i * 2));
            nodes.push({ x: cx + Math.cos(angle) * radius * 1.3, y: cy + Math.sin(angle) * radius });
        }

        for (let i = 0; i < count; i++) {
            for (const step of [2, 3]) {
                const other = nodes[(i + step) % count];
                g.moveTo(nodes[i].x, nodes[i].y).lineTo(other.x, other.y);
            }
        }
        g.stroke({ width: 1.25, color: hover > 0.5 ? colours.accent : colours.ink, alpha: 0.6 + hover * 0.4 });

        for (const node of nodes) g.rect(node.x - 5, node.y - 5, 10, 10);
        g.fill(colours.ink);
    },
};

function drawTiles(time) { // Funktion som ritar alla tiles
    artLayer.clear();

    for (const tile of tiles) {
        tile.hover += (tile.target - tile.hover) * 0.1;

        const r = tile.box.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;

        artLayer.rect(r.left, r.top, r.width, r.height).fill(colours.tile);
        motifs[tile.motif](artLayer, r.left, r.top, r.width, r.height, time, tile.hover);
    }
}

let time = 0;

app.ticker.add((ticker) => { // Funktion som körs varje frame
    const anyHover = tiles.some((tile) => tile.target > 0);
    if (!reduceMotion || anyHover) time += ticker.deltaMS / 1000;

    const now = performance.now();
    updateField(now);
    drawField();
    drawTiles(time);
});