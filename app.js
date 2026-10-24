"use strict";
// Diario Dieta – versione web. Stessi dati e stesso formato di backup dell'app iOS.

// ───────────── Archivio ─────────────
const CHIAVE = "diarioDieta.v1";
const vuoto = () => ({
  versione: 1, impostazioni: { obiettivoAcqua: 8, obiettivoTipo: "massa" },
  piani: [], vociPiano: [], vociCibo: [], pesate: [], misure: [], acqua: [], noteGiorno: [],
  alimenti: [], allenamenti: [], integratori: [], integratoriPresi: [], noteNutrizionista: [], foto: [],
  spesa: [], allenamenti2: [], questionari: [], scelte: [],
});
let S = carica();
function carica() {
  try { const d = JSON.parse(localStorage.getItem(CHIAVE)); if (d) return { ...vuoto(), ...d }; } catch {}
  return vuoto();
}
function salva() {
  try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch { avviso("Spazio esaurito: esporta un backup."); }
}
const imp = (k, def = 0) => S.impostazioni[k] ?? def;
function setImp(k, v) { S.impostazioni[k] = v; salva(); }
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).toUpperCase();

// ───────────── Utilità ─────────────
const PASTI = ["Colazione", "Spuntino", "Pranzo", "Merenda", "Cena", "Altro"];
const ICONE = ["☕️", "🥕", "🍽️", "🧃", "🌙", "•"];
const GIORNI = ["Tutti i giorni", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n0 = (x) => Math.round(x || 0).toLocaleString("it-IT");
const n1 = (x) => (Math.round((x || 0) * 10) / 10).toLocaleString("it-IT");
const num = (v) => { const x = parseFloat(String(v).replace(",", ".")); return isNaN(x) ? null : x; };
const inizioGiorno = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const giornoDopo = (d) => { const x = inizioGiorno(d); x.setDate(x.getDate() + 1); return x; };
const aggiungiGiorni = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const stessoGiorno = (a, b) => inizioGiorno(a).getTime() === inizioGiorno(b).getTime();
// Le date si salvano in ISO senza millisecondi: è il formato che legge anche l'app iOS.
const iso = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");
const indiceGiorno = (d) => ((new Date(d).getDay() + 6) % 7) + 1; // 1 = lunedì
const fmtData = (d, o = { day: "numeric", month: "short", year: "numeric" }) => new Date(d).toLocaleDateString("it-IT", o);
function avviso(testo) {
  const a = document.getElementById("avviso");
  a.textContent = testo; a.hidden = false;
  clearTimeout(avviso.t); avviso.t = setTimeout(() => (a.hidden = true), 3200);
}

// ───────────── Logica (come nell'app iOS) ─────────────
function pianoPerGiorno(data) {
  const g = inizioGiorno(data);
  const validi = S.piani.filter((p) => inizioGiorno(p.inizio) <= g && (!p.fine || g <= inizioGiorno(p.fine)));
  return validi.find((p) => p.attivo) || validi.sort((a, b) => new Date(b.inizio) - new Date(a.inizio))[0] || S.piani.find((p) => p.attivo);
}
const pianoAttivo = () => S.piani.find((p) => p.attivo);
function vociPianoDelGiorno(data) {
  const p = pianoPerGiorno(data); if (!p) return [];
  const i = indiceGiorno(data);
  return S.vociPiano.filter((v) => v.piano === p.uid && (v.giorno === 0 || v.giorno === i));
}
const vociDelGiorno = (data) => { const a = inizioGiorno(data), b = giornoDopo(data); return S.vociCibo.filter((v) => { const t = new Date(v.data); return t >= a && t < b; }); };
const somma = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);
const OBIETTIVI = {
  dimagrimento: { nome: "Perdere peso", breve: "Dimagrimento", pkg: 2.0 },
  massa: { nome: "Aumentare la massa muscolare", breve: "Massa muscolare", pkg: 1.8 },
  mantenimento: { nome: "Mantenere il peso", breve: "Mantenimento", pkg: 1.6 },
  ricomposizione: { nome: "Ricomposizione corporea", breve: "Ricomposizione", pkg: 2.2 },
};
const tipo = () => imp("obiettivoTipo", "massa");
function esitoCalorie(kcal, ob, t = tipo()) {
  if (!ob) return null;
  const d = kcal - ob;
  if (t === "massa") {
    if (kcal < ob * 0.95) return { c: "var(--arancio)", m: `Mancano ${n0(-d)} kcal` };
    if (kcal <= ob * 1.15) return { c: "var(--verde)", m: "Obiettivo raggiunto" };
    return { c: "var(--arancio)", m: `Surplus alto: +${n0(d)} kcal` };
  }
  if (t === "mantenimento") {
    if (Math.abs(d) <= ob * 0.1) return { c: "var(--verde)", m: d < 0 ? `Restano ${n0(-d)} kcal` : "In equilibrio" };
    return d < 0 ? { c: "var(--arancio)", m: `Mancano ${n0(-d)} kcal` } : { c: "var(--rosso)", m: `Superato di ${n0(d)} kcal` };
  }
  if (d <= 0) return { c: "var(--verde)", m: `Restano ${n0(-d)} kcal` };
  if (kcal <= ob * 1.05) return { c: "var(--arancio)", m: `Al limite: +${n0(d)} kcal` };
  return { c: "var(--rosso)", m: `Superato di ${n0(d)} kcal` };
}
function giornoOk(kcal, ob, t = tipo()) {
  if (t === "massa") return kcal >= ob * 0.95 && kcal <= ob * 1.15;
  if (t === "mantenimento") return Math.abs(kcal - ob) <= ob * 0.1;
  return kcal <= ob * 1.05;
}
const bmi = (peso, h) => (peso > 0 && h > 0 ? peso / (h / 100) ** 2 : null);
function categoriaBmi(b) {
  if (b < 18.5) return ["Sottopeso", "var(--blu)"];
  if (b < 25) return ["Normopeso", "var(--verde)"];
  if (b < 30) return ["Sovrappeso", "var(--arancio)"];
  return ["Obesità", "var(--rosso)"];
}
function calcolaObiettivi() {
  const peso = [...S.pesate].sort((a, b) => new Date(b.data) - new Date(a.data))[0]?.peso;
  const h = imp("altezzaCm"), nascita = imp("dataNascita");
  if (!peso || !h || !nascita) return null;
  // dataNascita è in secondi dal 1970 (come nell'app iOS).
  const eta = Math.floor((Date.now() / 1000 - nascita) / (365.25 * 86400));
  const basale = 10 * peso + 6.25 * h - 5 * eta + (imp("sesso", "maschio") === "maschio" ? 5 : -161);
  const fab = basale * [1.2, 1.375, 1.55, 1.725, 1.9][imp("attivita", 1)];
  const r = imp("obiettivoRitmo", 1), t = tipo();
  let agg = t === "dimagrimento" ? -[0.25, 0.5, 0.75][r] * 1100 : t === "massa" ? [150, 300, 450][r] : t === "ricomposizione" ? -fab * 0.1 : 0;
  let kcal = Math.max(fab + agg, Math.max(imp("sesso", "maschio") === "maschio" ? 1500 : 1200, basale));
  kcal = Math.round(kcal / 10) * 10;
  const prot = Math.round(peso * OBIETTIVI[t].pkg), grassi = Math.max(Math.round((kcal * 0.25) / 9), Math.round(peso * 0.8));
  return { kcal, prot, grassi, carbo: Math.max(0, Math.round((kcal - prot * 4 - grassi * 9) / 4)), acqua: Math.min(20, Math.max(6, Math.round((peso * 35) / 250))), basale, fab };
}
function andamento() {
  const da = aggiungiGiorni(new Date(), -21);
  const p = S.pesate.filter((x) => new Date(x.data) >= da).sort((a, b) => new Date(a.data) - new Date(b.data));
  if (p.length < 2 || new Date(p.at(-1).data) - new Date(p[0].data) < 6 * 864e5) return null;
  const xs = p.map((x) => (new Date(x.data) - new Date(p[0].data)) / (7 * 864e5)), ys = p.map((x) => x.peso);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0); if (!den) return null;
  const k = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
  const r = `${k > 0 ? "+" : ""}${k.toFixed(2).replace(".", ",")} kg/settimana`, t = tipo();
  if (t === "massa") {
    if (k < -0.05) return ["var(--rosso)", `Stai perdendo peso (${r}): aumenta le calorie.`];
    if (k < 0.05) return ["var(--arancio)", `Peso fermo (${r}): prova ad aggiungere 100–200 kcal al giorno.`];
    if (k > 0.6) return ["var(--arancio)", `Aumento rapido (${r}): parte potrebbe essere grasso.`];
    return ["var(--verde)", `In linea con l'obiettivo (${r}).`];
  }
  if (t === "dimagrimento") {
    if (k > 0.05) return ["var(--rosso)", `Il peso sta salendo (${r}).`];
    if (k > -0.1) return ["var(--arancio)", `Peso fermo (${r}).`];
    return ["var(--verde)", `In linea con l'obiettivo (${r}).`];
  }
  return Math.abs(k) <= 0.25 ? ["var(--verde)", `Peso stabile (${r}).`] : ["var(--arancio)", `Il peso si sta spostando (${r}).`];
}

// ───────────── Grafici SVG ─────────────
function grafico(punti, { linee = [], unita = "" } = {}) {
  if (punti.length === 0) return `<div class="vuoto">Nessun dato</div>`;
  const W = 600, H = 200, ml = 8, mr = 40, mt = 12, mb = 22;
  const xs = punti.map((p) => +new Date(p[0])), ys = punti.map((p) => p[1]).concat(linee.map((l) => l.v));
  let y0 = Math.min(...ys), y1 = Math.max(...ys); if (y1 - y0 < 1) { y0 -= 0.5; y1 += 0.5; }
  const pad = (y1 - y0) * 0.12; y0 -= pad; y1 += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 864e5 : Math.max(...xs);
  const X = (x) => ml + ((x - x0) / (x1 - x0)) * (W - ml - mr), Y = (y) => mt + (1 - (y - y0) / (y1 - y0)) * (H - mt - mb);
  const passo = (y1 - y0) / 3;
  let g = "";
  for (let i = 0; i <= 3; i++) { const v = y0 + passo * i; g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--linea)"/><text x="${W - mr + 4}" y="${Y(v) + 3}">${n1(v)}</text>`; }
  for (const l of linee) g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(l.v)}" y2="${Y(l.v)}" stroke="${l.c}" stroke-dasharray="4 4"/><text x="${ml + 2}" y="${Y(l.v) - 4}" style="fill:${l.c}">${esc(l.t)}</text>`;
  const d = punti.map((p, i) => `${i ? "L" : "M"}${X(+new Date(p[0]))},${Y(p[1])}`).join(" ");
  g += `<path d="${d}" fill="none" stroke="var(--verde)" stroke-width="2.5" stroke-linejoin="round"/>`;
  g += punti.map((p) => `<circle cx="${X(+new Date(p[0]))}" cy="${Y(p[1])}" r="3.5" fill="var(--verde)"/>`).join("");
  g += `<text x="${ml}" y="${H - 6}">${fmtData(x0, { day: "numeric", month: "short" })}</text><text x="${W - mr}" y="${H - 6}" text-anchor="end">${fmtData(x1, { day: "numeric", month: "short" })}</text>`;
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafico ${esc(unita)}">${g}</svg>`;
}
function anello(prog, colore, centro) {
  const r = 48, c = 2 * Math.PI * r;
  return `<div class="anello"><svg width="110" height="110" viewBox="0 0 110 110"><circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--linea)" stroke-width="12"/>
  <circle cx="55" cy="55" r="${r}" fill="none" stroke="${colore}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(prog, 1))}"/></svg><div class="centro">${centro}</div></div>`;
}

// ───────────── Navigazione ─────────────
let scheda = location.hash.slice(1) || "oggi", giornoVisto = new Date(), pila = [];
const SCHEDE = { oggi: vistaOggi, piano: vistaPiano, peso: vistaPeso, misure: vistaMisure, profilo: vistaProfilo };
function vai(nome) { scheda = nome; pila = []; history.replaceState(null, "", "#" + nome); disegna(); scrollTo(0, 0); }
function apri(vista) { pila.push(vista); disegna(); scrollTo(0, 0); }
function indietro() { pila.pop(); disegna(); }
function disegna() {
  const v = pila.length ? pila.at(-1)() : SCHEDE[scheda]();
  document.getElementById("testata").innerHTML = (pila.length ? `<button class="btn tondo" data-azione="indietro" aria-label="Indietro">‹</button>` : "") + `<h1>${esc(v.titolo)}</h1>${v.azioni || ""}`;
  document.getElementById("contenuto").innerHTML = v.html;
  document.querySelectorAll("#schede button").forEach((b) => b.classList.toggle("attiva", b.dataset.scheda === scheda));
  document.documentElement.dataset.tema = ["", "chiaro", "scuro"][imp("tema", 0)] || "";
}
function foglio(html) { document.getElementById("foglio-corpo").innerHTML = html; document.getElementById("foglio").hidden = false; }
function chiudiFoglio() { document.getElementById("foglio").hidden = true; disegna(); }
const gruppo = (titolo, righe, nota = "", destra = "") =>
  (titolo ? `<div class="titolo-gruppo"><span>${titolo}</span><span>${destra}</span></div>` : "") + `<div class="gruppo">${righe}</div>` + (nota ? `<div class="nota-gruppo">${nota}</div>` : "");

// ───────────── Oggi ─────────────
function vistaOggi() {
  const g = giornoVisto, oggi = stessoGiorno(g, new Date());
  const voci = vociDelGiorno(g), piano = vociPianoDelGiorno(g);
  const allena = S.allenamenti.some((d) => stessoGiorno(d, g));
  const obK = imp("obiettivoKcal") + (allena && imp("obiettivoKcal") ? 200 : 0);
  const kcal = somma(voci, "kcal"), es = esitoCalorie(kcal, obK);
  const macro = (nome, k, ob, col, minimo) => {
    const v = somma(voci, k), c = minimo ? (v >= ob * 0.9 ? "var(--verde)" : col) : v > ob ? "var(--rosso)" : col;
    return `<div class="riga" style="display:block"><div style="display:flex;justify-content:space-between"><span>${nome}</span><span class="piccolo num">${n0(v)}${ob ? " / " + n0(ob) : ""} g</span></div>${ob ? `<div class="barra"><i style="width:${Math.min(100, (v / ob) * 100)}%;background:${c}"></i></div>` : ""}</div>`;
  };
  let h = gruppo("", `<div class="anello-riga">${anello(obK ? kcal / obK : 0, es?.c || "var(--verde)", `<b class="num">${n0(kcal)}</b><span class="piccolo">kcal</span>`)}
    <div>${es ? `<div class="piccolo">${OBIETTIVI[tipo()].breve}</div><div class="piccolo">Obiettivo: ${n0(obK)} kcal</div><b style="color:${es.c}">${es.m}</b>` : `<span class="piccolo">Imposta l'obiettivo nel Profilo</span>`}</div></div>`
    + macro("Proteine · priorità", "proteine", imp("obiettivoProteine"), "var(--rosso)", true)
    + macro("Carboidrati", "carboidrati", imp("obiettivoCarboidrati") + (allena && imp("obiettivoCarboidrati") ? 50 : 0), "var(--arancio)")
    + macro("Grassi", "grassi", imp("obiettivoGrassi"), "var(--giallo)"));
  h += gruppo("", `<label class="riga tocco"><span>🏋️</span><span class="cresce">Giorno di allenamento</span><input type="checkbox" data-azione="allenamento" ${allena ? "checked" : ""}></label>`,
    allena && imp("obiettivoKcal") ? "Obiettivo aumentato di 200 kcal, da carboidrati." : "");
  const attivi = S.integratori.filter((x) => x.attivo);
  if (attivi.length) h += gruppo("Integratori", attivi.map((x) => { const preso = S.integratoriPresi.some((p) => p.integratore === x.uid && stessoGiorno(p.giorno, g));
    return `<div class="riga tocco" data-azione="integratore-preso" data-uid="${x.uid}"><span class="check ${preso ? "si" : ""}">${preso ? "✓" : ""}</span><span class="cresce">${esc(x.nome)}</span><span class="valore">${esc(x.dose)}</span></div>`; }).join(""));
  const acqua = S.acqua.find((a) => stessoGiorno(a.giorno, g))?.bicchieri || 0;
  h += gruppo("Acqua", `<div class="riga"><span>💧</span><span class="cresce num">${acqua} / ${imp("obiettivoAcqua", 8)} bicchieri</span><button class="btn tondo" data-azione="acqua" data-delta="-1" aria-label="Togli">−</button><button class="btn tondo" data-azione="acqua" data-delta="1" aria-label="Aggiungi">+</button></div>`);
  for (let p = 0; p < 6; p++) {
    const delPiano = piano.filter((v) => v.pasto === p), uids = new Set(delPiano.map((v) => v.uid));
    const extra = voci.filter((v) => v.pasto === p && !(v.pianoID && uids.has(v.pianoID)));
    const tutti = voci.filter((v) => v.pasto === p);
    if (p === 5 && !extra.length) continue;
    let r = delPiano.map((v) => {
      const fatta = voci.some((x) => x.pianoID === v.uid);
      const scelta = S.scelte.find((s) => s.voce === v.uid && stessoGiorno(s.giorno, g))?.opzione;
      return `<div class="riga tocco" data-azione="segna" data-uid="${v.uid}"><span class="check ${fatta ? "si" : ""}">${fatta ? "✓" : ""}</span><div class="cresce"><div>${esc(scelta || v.nome)}</div>
        ${!scelta && v.quantita ? `<div class="sotto">${esc(v.quantita)}</div>` : ""}${v.alternative && v.pasto !== 0 ? `<div class="sotto corsivo">Oppure: ${esc(v.alternative)}</div>` : ""}</div><span class="valore">${v.kcal ? n0(v.kcal) + " kcal" : "libero"}</span></div>`
        + (v.alternative.includes(" / ") && v.pasto === 0 ? `<div class="riga"><select class="campo piccolo" data-azione="scegli" data-uid="${v.uid}"><option value="">Scegli la colazione…</option>${v.alternative.split(" / ").map((o) => `<option ${o === scelta ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>` : "");
    }).join("");
    r += extra.map((v) => `<div class="riga tocco" data-azione="modifica-cibo" data-id="${v.id}"><div class="cresce"><div>${esc(v.nome)}</div>${v.grammi ? `<div class="sotto">${n0(v.grammi)} g</div>` : ""}</div><span class="valore">${n0(v.kcal)} kcal</span></div>`).join("");
    r += `<div class="riga"><button class="btn" data-azione="nuovo-cibo" data-pasto="${p}">＋ ${delPiano.length ? "Aggiungi fuori piano" : "Aggiungi alimento"}</button></div>`;
    const prot = somma(tutti, "proteine");
    h += gruppo(`${ICONE[p]} ${PASTI[p]}`, r, "", tutti.length ? `${n0(somma(tutti, "kcal"))} kcal · <span style="color:${p % 2 === 0 && p < 5 && prot < 20 ? "var(--arancio)" : "inherit"}">P ${n0(prot)} g</span>` : "");
  }
  const nota = S.noteGiorno.find((x) => stessoGiorno(x.giorno, g))?.testo || "";
  h += gruppo("📝 Note del giorno", `<div class="riga"><textarea data-azione="nota" placeholder="Come ti senti? Fame, energia, allenamento, sgarri…">${esc(nota)}</textarea></div>`);
  return {
    titolo: oggi ? "Oggi" : fmtData(g, { weekday: "short", day: "numeric", month: "short" }), html: h,
    azioni: `<button class="btn tondo" data-azione="settimana" aria-label="Settimana">📊</button><button class="btn tondo" data-azione="giorno" data-delta="-1" aria-label="Giorno precedente">‹</button>${oggi ? "" : `<button class="btn" data-azione="oggi">Oggi</button>`}<button class="btn tondo" data-azione="giorno" data-delta="1" aria-label="Giorno successivo">›</button>`,
  };
}
const dataNuoveVoci = (g) => (stessoGiorno(g, new Date()) ? new Date() : new Date(inizioGiorno(g).getTime() + 12 * 36e5));

// ───────────── Aggiungi alimento ─────────────
const FUORI = [["Pizza margherita", 850, 32, 110, 28], ["Pizza capricciosa", 1000, 42, 112, 40], ["Pizza diavola", 1000, 40, 110, 42], ["Pasta alla carbonara", 750, 30, 80, 32], ["Pasta al ragù", 650, 30, 85, 20], ["Pasta al pomodoro", 500, 15, 90, 10], ["Lasagne", 700, 35, 55, 35], ["Risotto ai funghi", 600, 14, 85, 22], ["Hamburger con patatine", 1100, 45, 95, 55], ["Panino kebab", 750, 40, 70, 32], ["Piadina crudo e mozzarella", 650, 30, 55, 32], ["Sushi misto (12 pezzi)", 600, 28, 95, 10], ["Poke bowl salmone", 650, 30, 75, 22], ["Tagliata con rucola", 550, 55, 3, 35], ["Grigliata di pesce", 450, 60, 2, 20], ["Fritto misto di pesce", 750, 40, 45, 45], ["Insalatona con tonno", 450, 28, 20, 28], ["Patatine fritte (porzione)", 400, 5, 50, 20], ["Tiramisù", 450, 8, 40, 28], ["Gelato (2 gusti)", 250, 4, 32, 11], ["Birra media (0,4 l)", 170, 2, 14, 0], ["Calice di vino", 110, 0, 3, 0], ["Spritz", 150, 0, 15, 0]];
let modulo = null;
function apriCibo(pasto, id) {
  const v = id ? S.vociCibo.find((x) => x.id === id) : null;
  modulo = v ? { id, pasto: v.pasto, nome: v.nome, ...(v.grammi ? { per100: true, grammi: v.grammi, kcal: (v.kcal * 100) / v.grammi, p: (v.proteine * 100) / v.grammi, c: (v.carboidrati * 100) / v.grammi, g: (v.grassi * 100) / v.grammi } : { per100: false, kcal: v.kcal, p: v.proteine, c: v.carboidrati, g: v.grassi }) }
    : { pasto, nome: "", per100: true, grammi: null, kcal: null, p: null, c: null, g: null, risultati: null };
  disegnaModulo();
}
function totali(m) { const f = m.per100 ? (m.grammi || 0) / 100 : 1; return { kcal: (m.kcal || 0) * f, p: (m.p || 0) * f, c: (m.c || 0) * f, g: (m.g || 0) * f }; }
function disegnaModulo() {
  const m = modulo, t = totali(m), cerca = m.nome.trim().toLowerCase();
  const campo = (k, titolo, u) => `<div class="riga"><span class="cresce">${titolo}</span><input type="number" inputmode="decimal" step="any" data-campo="${k}" value="${m[k] ?? ""}" placeholder="0"><span class="valore">${u}</span></div>`;
  let h = `<div class="foglio-testa"><button class="btn" data-azione="chiudi">Annulla</button><b>${m.id ? "Modifica" : "Nuovo alimento"}</b><button class="btn" data-azione="salva-cibo" ${m.nome.trim() && m.kcal != null && (!m.per100 || m.grammi) ? "" : "disabled"}><b>Salva</b></button></div>`;
  h += gruppo("", `<div class="riga"><input type="search" class="campo" data-campo="nome" value="${esc(m.nome)}" placeholder="Alimento (es. Yogurt greco)" autocomplete="off"></div>
    <div class="riga"><span class="cresce">Pasto</span><select data-campo="pasto">${PASTI.map((p, i) => `<option value="${i}" ${i === m.pasto ? "selected" : ""}>${p}</option>`).join("")}</select></div>`);
  if (!m.id) {
    const p = pianoPerGiorno(giornoVisto);
    if (p) {
      const pasti = [], visti = new Set();
      for (const v of S.vociPiano.filter((v) => v.piano === p.uid && v.pasto === m.pasto && v.kcal > 0)) if (!visti.has(v.nome) && (!cerca || v.nome.toLowerCase().includes(cerca))) { visti.add(v.nome); pasti.push(v); }
      const ingr = S.alimenti.filter((a) => a.piano === p.uid && (!cerca || a.nome.toLowerCase().includes(cerca))).slice(0, cerca ? 30 : 10);
      if (pasti.length || ingr.length) h += gruppo("Dal tuo piano", pasti.map((v) => `<div class="riga tocco" data-azione="scegli-pasto" data-uid="${v.uid}"><span>🍽️</span><span class="cresce">${esc(v.nome)}<div class="sotto">${GIORNI[v.giorno]} · pasto completo</div></span><span class="valore">${n0(v.kcal)} kcal</span></div>`).join("")
        + ingr.map((a) => `<div class="riga tocco" data-azione="scegli-alimento" data-nome="${esc(a.nome)}" data-piano="1"><span>🌿</span><span class="cresce">${esc(a.nome)}</span><span class="valore">${n0(a.grammi || 100)} g · ${n0((a.kcal * (a.grammi || 100)) / 100)} kcal</span></div>`).join(""), "Tocca per inserire, poi cambia i grammi se serve.");
    }
    const recenti = S.alimenti.filter((a) => (!a.piano || a.usi > 0) && (!cerca || (a.nome.toLowerCase().includes(cerca) && a.nome.toLowerCase() !== cerca)))
      .sort((a, b) => (b.preferito - a.preferito) || new Date(b.ultimoUso) - new Date(a.ultimoUso)).slice(0, 6);
    if (recenti.length) h += gruppo(cerca ? "Suggerimenti" : "Preferiti e recenti", recenti.map((a) => `<div class="riga tocco" data-azione="scegli-alimento" data-nome="${esc(a.nome)}"><span>${a.preferito ? "⭐️" : "🕘"}</span><span class="cresce">${esc(a.nome)}<div class="sotto">${a.ricetta ? "Ricetta · " + n0(a.kcal) + " kcal" : a.perCento ? n0(a.kcal) + " kcal / 100 g" : n0(a.kcal) + " kcal a porzione"}</div></span></div>`).join(""));
    const fuori = FUORI.filter((f) => cerca && f[0].toLowerCase().includes(cerca));
    if (fuori.length) h += gruppo("Fuori casa (stime)", fuori.map((f) => `<div class="riga tocco" data-azione="scegli-fuori" data-nome="${esc(f[0])}"><span>🍕</span><span class="cresce">${esc(f[0])}</span><span class="valore">${n0(f[1])} kcal</span></div>`).join(""));
    h += gruppo("", `<div class="riga"><button class="btn" data-azione="codice">▥ Cerca per codice a barre</button></div>`
      + (m.risultati ? m.risultati.map((r, i) => `<div class="riga tocco" data-azione="scegli-off" data-i="${i}"><span class="cresce">${esc(r.nome)}<div class="sotto">${esc(r.marca)} · ${n0(r.kcal)} kcal / 100 g</div></span></div>`).join("") || `<div class="riga piccolo">Nessun risultato.</div>` : ""),
      cerca ? "" : "Scrivi il nome per vedere anche i piatti fuori casa (pizza, sushi, carbonara…). Il codice a barre sono le cifre sotto le barre.");
  }
  h += gruppo("", (m.per100 ? campo("grammi", "Quantità mangiata", "g") : "") + `<label class="riga tocco"><span class="cresce">Non conosco i grammi</span><input type="checkbox" data-azione="per100" ${m.per100 ? "" : "checked"}></label>`);
  h += gruppo(m.per100 ? "Valori per 100 g (dall'etichetta)" : "Valori totali", campo("kcal", "Calorie", "kcal") + campo("p", "Proteine", "g") + campo("c", "Carboidrati", "g") + campo("g", "Grassi", "g"),
    m.per100 && m.kcal != null ? (m.grammi ? `<b>Totale: ${n0(t.kcal)} kcal · P ${n0(t.p)} g · C ${n0(t.c)} g · G ${n0(t.g)} g</b>` : "Inserisci la quantità mangiata per calcolare il totale.") : "");
  if (m.id) h += `<button class="btn rosso" data-azione="elimina-cibo" style="width:100%;padding:12px">Elimina</button>`;
  const foc = document.activeElement?.dataset?.campo, pos = document.activeElement?.selectionStart;
  foglio(h);
  if (foc) { const el = document.querySelector(`[data-campo="${foc}"]`); el?.focus(); try { if (pos != null && el.type !== "number") el.setSelectionRange(pos, pos); } catch {} }
}
function riempiDaAlimento(a, grammi) {
  Object.assign(modulo, { nome: a.nome, per100: a.perCento, grammi: a.perCento ? grammi ?? a.grammi ?? 100 : null, kcal: a.kcal, p: a.proteine, c: a.carboidrati, g: a.grassi });
}
function salvaCibo() {
  const m = modulo, t = totali(m), nome = m.nome.trim();
  const dati = { pasto: m.pasto, nome, kcal: t.kcal, proteine: t.p, carboidrati: t.c, grassi: t.g, grammi: m.per100 ? m.grammi : null };
  if (m.id) Object.assign(S.vociCibo.find((x) => x.id === m.id), dati);
  else S.vociCibo.push({ id: uuid(), data: iso(dataNuoveVoci(giornoVisto)), pianoID: null, ...dati });
  // Catalogo per i suggerimenti
  let a = S.alimenti.find((x) => x.nome.toLowerCase() === nome.toLowerCase() && !x.piano);
  if (!a) { a = { nome, marca: "", codice: null, preferito: false, usi: 0, piano: null, ricetta: false, ingredienti: "" }; S.alimenti.push(a); }
  Object.assign(a, { perCento: m.per100, kcal: m.kcal || 0, proteine: m.p || 0, carboidrati: m.c || 0, grassi: m.g || 0, grammi: m.per100 ? m.grammi : null, ultimoUso: iso(new Date()), usi: (a.usi || 0) + 1 });
  salva(); chiudiFoglio();
}
async function cercaOnline() {
  const q = modulo.nome.trim(); if (!q) return avviso("Scrivi prima il nome del prodotto.");
  try {
    const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=20&langs=it&fields=code,product_name,product_name_it,brands,nutriments`).then((x) => x.json());
    modulo.risultati = (r.hits || []).map(leggiOFF).filter(Boolean);
  } catch { avviso("Ricerca non riuscita: controlla la connessione."); }
  disegnaModulo();
}
function leggiOFF(d) {
  const nome = (d.product_name_it || d.product_name || "").trim(), n = d.nutriments || {}, k = n["energy-kcal_100g"];
  if (!nome || k == null) return null;
  const marca = (Array.isArray(d.brands) ? d.brands[0] : String(d.brands || "").split(",")[0]) || "";
  return { codice: d.code, nome, marca: marca.trim(), kcal: +k, p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, g: +n.fat_100g || 0 };
}
async function cercaCodice() {
  const codice = prompt("Codice a barre (le cifre sotto le barre):");
  if (!codice) return;
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codice.trim())}.json?fields=code,product_name,product_name_it,brands,nutriments`).then((x) => x.json());
    const p = r.status === 1 && leggiOFF(r.product);
    if (!p) return avviso("Prodotto non trovato o senza valori nutrizionali.");
    Object.assign(modulo, { nome: p.nome, per100: true, grammi: 100, kcal: p.kcal, p: p.p, c: p.c, g: p.g });
    disegnaModulo();
  } catch { avviso("Ricerca non riuscita: controlla la connessione."); }
}

// ───────────── Settimana ─────────────
function vistaSettimana(settimaneFa = 0) {
  return () => {
    const inizio = aggiungiGiorni(inizioGiorno(new Date()), -6 - 7 * settimaneFa);
    const giorni = [...Array(7)].map((_, i) => { const d = aggiungiGiorni(inizio, i), v = vociDelGiorno(d); return { d, kcal: somma(v, "kcal"), p: somma(v, "proteine"), c: somma(v, "carboidrati"), g: somma(v, "grassi"), acqua: S.acqua.find((a) => stessoGiorno(a.giorno, d))?.bicchieri || 0 }; });
    const reg = giorni.filter((x) => x.kcal > 0), ob = imp("obiettivoKcal"), obP = imp("obiettivoProteine");
    const media = (k) => (reg.length ? reg.reduce((s, x) => s + x[k], 0) / reg.length : null);
    const max = Math.max(ob, ...giorni.map((x) => x.kcal), 1);
    const barre = `<svg class="grafico" viewBox="0 0 700 200">${giorni.map((x, i) => {
      const h = (x.kcal / max) * 160, ok = !ob || giornoOk(x.kcal, ob);
      return `<rect x="${i * 100 + 20}" y="${175 - h}" width="60" height="${h}" rx="6" fill="${x.kcal ? (ok ? "var(--verde)" : "var(--arancio)") : "var(--linea)"}"/><text x="${i * 100 + 50}" y="195" text-anchor="middle">${fmtData(x.d, { weekday: "short" })}</text>`;
    }).join("")}${ob ? `<line x1="0" x2="700" y1="${175 - (ob / max) * 160}" y2="${175 - (ob / max) * 160}" stroke="var(--secondario)" stroke-dasharray="4 4"/>` : ""}</svg>`;
    const r = (t, v) => `<div class="riga"><span class="cresce">${t}</span><span class="valore num">${v}</span></div>`;
    const h = gruppo("", `<div class="riga"><button class="btn tondo" data-azione="settimana" data-fa="${settimaneFa + 1}">‹</button><b class="cresce" style="text-align:center">${fmtData(inizio, { day: "numeric", month: "short" })} – ${fmtData(aggiungiGiorni(inizio, 6), { day: "numeric", month: "short" })}</b><button class="btn tondo" data-azione="settimana" data-fa="${Math.max(0, settimaneFa - 1)}" ${settimaneFa ? "" : "disabled"}>›</button></div>`)
      + gruppo(`Calorie · ${OBIETTIVI[tipo()].breve}`, `<div class="riga" style="display:block">${barre}</div>` + r("Media giornaliera", media("kcal") ? n0(media("kcal")) + " kcal" : "—") + r("Giorni registrati", `${reg.length} su 7`)
        + (ob && reg.length ? r("Giorni nell'obiettivo", `${reg.filter((x) => giornoOk(x.kcal, ob)).length} su ${reg.length}`) : ""))
      + gruppo("Macronutrienti (media)", (obP && reg.length ? r("Giorni con proteine sufficienti", `${reg.filter((x) => x.p >= obP * 0.9).length} su ${reg.length}`) : "") + r("Proteine", media("p") ? n0(media("p")) + " g" : "—") + r("Carboidrati", media("c") ? n0(media("c")) + " g" : "—") + r("Grassi", media("g") ? n0(media("g")) + " g" : "—"));
    return { titolo: "Settimana", html: h };
  };
}

// ───────────── Piano ─────────────
let pianoVisto = null;
function vistaPiano() {
  const p = S.piani.find((x) => x.uid === pianoVisto) || pianoAttivo() || S.piani[0];
  if (!p) return { titolo: "Piano", html: `<div class="gruppo vuoto"><b>Nessun piano</b>Importa il backup dell'app iOS dal Profilo per ritrovare i piani del nutrizionista.</div>` };
  const voci = S.vociPiano.filter((v) => v.piano === p.uid);
  const periodo = p.fine ? `${fmtData(p.inizio)} – ${fmtData(p.fine)}` : `dal ${fmtData(p.inizio)}`;
  let h = `<div class="gruppo"><div class="riga"><select class="campo" data-azione="cambia-piano">${S.piani.slice().sort((a, b) => new Date(b.inizio) - new Date(a.inizio)).map((x) => `<option value="${x.uid}" ${x.uid === p.uid ? "selected" : ""}>${esc(x.nome)}${x.attivo ? " (attivo)" : ""}</option>`).join("")}</select></div></div>`;
  h += gruppo("", `<div class="riga"><span class="cresce">Periodo</span><span class="valore">${periodo}</span></div><div class="riga"><span class="cresce">Obiettivo</span><span class="valore">${OBIETTIVI[p.obiettivo]?.nome || ""}</span></div>`
    + (p.kcal ? `<div class="riga"><span class="cresce">Calorie indicate</span><span class="valore">${n0(p.kcal)} kcal</span></div>` : "")
    + (p.nutrizionista ? `<div class="riga"><span class="cresce">Nutrizionista</span><span class="valore">${esc(p.nutrizionista)}</span></div>` : "")
    + `<div class="riga tocco" data-azione="settimana-piano" data-uid="${p.uid}">📅 <span class="cresce">Riepilogo e vista settimana</span>›</div>`
    + `<div class="riga tocco" data-azione="spesa">🛒 <span class="cresce">Lista della spesa</span>›</div>`
    + (p.note ? `<div class="riga tocco" data-azione="regole" data-uid="${p.uid}">📖 <span class="cresce">Regole e sostituzioni</span>›</div>` : "")
    + (p.attivo ? `<div class="riga" style="color:var(--verde)">✓ Piano attivo: lo spunti nella scheda Oggi</div>` : `<div class="riga"><button class="btn" data-azione="attiva-piano" data-uid="${p.uid}">Usa come piano attivo</button></div>`));
  for (let g = 0; g < 8; g++) {
    const vg = voci.filter((v) => v.giorno === g).sort((a, b) => a.pasto - b.pasto);
    if (!vg.length) continue;
    h += gruppo(GIORNI[g], vg.map((v) => `<div class="riga"><span>${ICONE[v.pasto]}</span><div class="cresce"><div>${esc(v.nome)}</div><div class="sotto">${PASTI[v.pasto]}${v.quantita ? " · " + esc(v.quantita) : ""}</div>${v.alternative ? `<div class="sotto corsivo">Oppure: ${esc(v.alternative)}</div>` : ""}</div><span class="valore">${v.kcal ? n0(v.kcal) : "libero"}</span></div>`).join(""), "", `${n0(somma(vg, "kcal"))} kcal`);
  }
  return { titolo: p.nome, html: h };
}
function vistaRegole(uid) {
  return () => {
    const p = S.piani.find((x) => x.uid === uid);
    const md = esc(p.note).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_(.+?)_/g, "<i>$1</i>").split("\n\n")
      .map((b) => (b.trim().startsWith("- ") || b.includes("\n- ") ? b.split("\n").map((l) => (l.startsWith("- ") ? `<li>${l.slice(2)}</li>` : `<p>${l}</p>`)).join("").replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>") : `<p>${b.replace(/\n/g, "<br>")}</p>`)).join("");
    return { titolo: "Regole e sostituzioni", html: `<div class="gruppo regole">${md}</div>` };
  };
}
function vistaSettimanaPiano(uid) {
  return () => {
    const p = S.piani.find((x) => x.uid === uid), voci = S.vociPiano.filter((v) => v.piano === uid);
    const giorni = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ i, v: voci.filter((v) => v.giorno === 0 || v.giorno === i).sort((a, b) => a.pasto - b.pasto) }));
    const media = (k) => giorni.reduce((s, x) => s + somma(x.v, k), 0) / 7;
    const r = (t, v) => `<div class="riga"><span class="cresce">${t}</span><span class="valore num">${v}</span></div>`;
    let h = gruppo(`Riepilogo · ${OBIETTIVI[p.obiettivo]?.nome || ""}`, r("Media giornaliera", n0(media("kcal")) + " kcal") + (p.kcal ? r("Indicate dal nutrizionista", n0(p.kcal) + " kcal") : "") + r("Proteine medie", n0(media("proteine")) + " g") + r("Carboidrati medi", n0(media("carboidrati")) + " g") + r("Grassi medi", n0(media("grassi")) + " g")
      + r("Pasti liberi a settimana", giorni.reduce((s, x) => s + x.v.filter((v) => !v.kcal && v.pasto !== 0).length, 0)), "Valori stimati dai pasti del piano.");
    const oggi = indiceGiorno(new Date());
    for (const g of giorni) h += gruppo(GIORNI[g.i] + (g.i === oggi ? " · oggi" : ""), g.v.map((v) => `<div class="riga"><span>${ICONE[v.pasto]}</span><div class="cresce"><b>${PASTI[v.pasto]}:</b> ${esc(v.nome)}<div class="sotto">${esc(v.quantita)}</div></div><span class="valore">${v.kcal ? n0(v.kcal) : "libero"}</span></div>`).join(""), "", `${n0(somma(g.v, "kcal"))} kcal · P ${n0(somma(g.v, "proteine"))} g`);
    return { titolo: "Settimana del piano", html: h };
  };
}

// ───────────── Lista della spesa ─────────────
const REPARTI = ["Frutta e verdura", "Pane, pasta e cereali", "Carne e pesce", "Uova e latticini", "Legumi e scatolame", "Condimenti e dispensa", "Snack e integratori", "Altro"];
function reparto(nome) {
  const n = nome.toLowerCase();
  if (n.includes("frutta secca")) return "Condimenti e dispensa";
  const regole = [["Frutta e verdura", ["frutta", "verdur", "patate", "banana"]], ["Pane, pasta e cereali", ["riso", "pasta", "farro", "pane", "piadina", "avena", "muesli", "gallette"]], ["Carne e pesce", ["carne", "pollo", "pesce", "bresaola", "salmone"]], ["Uova e latticini", ["uova", "uovo", "feta", "grana", "yogurt", "philadelphia", "mozzarella", "latte"]], ["Legumi e scatolame", ["legumi", "piselli", "tonno", "ceci", "hummus", "mais", "olive"]], ["Condimenti e dispensa", ["olio", "pesto", "marmellata", "miele", "maionese", "burro"]], ["Snack e integratori", ["snack", "proteine", "cioccolato"]]];
  return regole.find(([, ks]) => ks.some((k) => n.includes(k)))?.[0] || "Altro";
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function ingredienti(testo) {
  return testo.split(" · ").map((parte) => {
    const w = parte.trim().split(" "), i = w.findIndex((x) => num(x) != null);
    if (i <= 0) return null;
    const resto = w.slice(i + 1).join(" ");
    return [cap(w.slice(0, i).join(" ")), num(w[i]), resto.startsWith("g") ? "g" : resto.includes("porzion") ? "porzioni" : "pz"];
  }).filter(Boolean);
}
function ingredientiColazione(opzione) {
  return opzione.replace(/\s*\(.*?\)/g, "").split(", ").map((parte) => {
    const w = parte.trim().replace("½", "0.5").split(" "), i = w.findIndex((x) => num(x) != null);
    if (i < 0) return [cap(w.join(" ").replace(" q.b.", "")), 0, "qb"];
    if (i === 0) return w[1]?.startsWith("porzion") ? [cap(w.slice(w.indexOf("di") + 1).join(" ") || "frutta"), num(w[0]), "porzioni"] : [cap(w.slice(1).join(" ")), num(w[0]), "pz"];
    return [cap(w.slice(0, i).join(" ")), num(w[i]), (w[i + 1] || "").startsWith("g") ? "g" : "pz"];
  });
}
function generaSpesa(settimane, porzioni, colazioni) {
  const p = pianoAttivo(); if (!p) return [];
  const tot = new Map();
  const aggiungi = ([nome, q, u], volte) => { const k = nome.toLowerCase().split(" o ")[0] + "|" + u; const x = tot.get(k) || [nome, 0, u]; x[1] += q * volte; tot.set(k, x); };
  for (const [opz, volte] of Object.entries(colazioni)) for (const ing of ingredientiColazione(opz)) aggiungi(ing, volte * settimane * porzioni);
  for (const v of S.vociPiano.filter((v) => v.piano === p.uid && v.kcal > 0 && !(v.pasto === 0 && v.alternative)))
    for (const ing of ingredienti(v.quantita)) aggiungi(ing, (v.giorno === 0 ? 7 : 1) * settimane * porzioni);
  return [...tot.values()].sort((a, b) => a[0].localeCompare(b[0])).map(([nome, q, u]) => {
    const g5 = Math.round(q / 5) * 5;
    const quantita = u === "g" ? (g5 >= 1000 ? `${n1(g5 / 1000)} kg` : `${n0(g5)} g`) : u === "porzioni" ? `${Math.ceil(q)} porzioni` : u === "qb" ? "q.b." : `${Math.ceil(q)}`;
    return { nome, quantita, reparto: reparto(nome), comprato: false };
  });
}
function vistaSpesa() {
  let h = gruppo("", `<div class="riga"><input type="text" class="campo" id="spesa-nome" placeholder="Aggiungi (es. Latte)"><input type="text" id="spesa-q" placeholder="Quantità" style="width:90px;text-align:right"><button class="btn tondo" data-azione="spesa-aggiungi">+</button></div>
    <div class="riga tocco" data-azione="spesa-genera">✨ <span class="cresce" style="color:var(--verde)">Genera dal piano</span></div>`);
  if (!S.spesa.length) h += `<div class="gruppo vuoto"><b>Lista vuota</b>Genera la lista dal piano o aggiungi le voci a mano.</div>`;
  for (const rep of REPARTI) {
    const el = S.spesa.map((v, i) => ({ v, i })).filter((x) => x.v.reparto === rep).sort((a, b) => a.v.comprato - b.v.comprato || a.v.nome.localeCompare(b.v.nome));
    if (!el.length) continue;
    h += gruppo(`${rep} (${el.filter((x) => !x.v.comprato).length})`, el.map(({ v, i }) => `<div class="riga tocco" data-azione="spesa-spunta" data-i="${i}"><span class="check ${v.comprato ? "si" : ""}">${v.comprato ? "✓" : ""}</span><span class="cresce" style="${v.comprato ? "text-decoration:line-through;color:var(--secondario)" : ""}">${esc(v.nome)}</span><span class="valore">${esc(v.quantita)}</span><button class="btn rosso" data-azione="spesa-elimina" data-i="${i}" aria-label="Elimina">✕</button></div>`).join(""));
  }
  if (S.spesa.length) h += gruppo("", `<div class="riga"><button class="btn" data-azione="spesa-condividi">Condividi la lista</button></div><div class="riga"><button class="btn" data-azione="spesa-togli">Togli i comprati</button></div><div class="riga"><button class="btn rosso" data-azione="spesa-svuota">Svuota la lista</button></div>`);
  return { titolo: "Lista della spesa", html: h };
}
let genSpesa = null;
function apriGeneraSpesa() {
  const p = pianoAttivo(); if (!p) return avviso("Nessun piano attivo.");
  const scelte = S.vociPiano.filter((v) => v.piano === p.uid && v.pasto === 0 && v.alternative.includes(" / "));
  const opzioni = scelte[0]?.alternative.split(" / ") || [], giorni = scelte.reduce((s, v) => s + (v.giorno === 0 ? 7 : 1), 0);
  const col = {}; opzioni.forEach((o, i) => (col[o] = Math.floor(giorni / opzioni.length) + (i < giorni % opzioni.length ? 1 : 0)));
  genSpesa = { settimane: 1, sostituisci: true, persone: imp("spesaPersone", []), col, giorni };
  disegnaGenera();
}
const FATTORI = { donna: [0.75, "Donna"], uomo: [1, "Uomo"], ragazzo: [0.6, "Ragazzo/a"], calorie: [1, "In base alle calorie"] };
const fattore = (x) => (x.tipo === "calorie" && x.kcal > 0 ? x.kcal / ((pianoAttivo()?.kcal) || imp("obiettivoKcal") || 2000) : FATTORI[x.tipo][0]);
function disegnaGenera() {
  const g = genSpesa, porz = 1 + g.persone.reduce((s, x) => s + fattore(x), 0);
  let h = `<div class="foglio-testa"><button class="btn" data-azione="chiudi">Annulla</button><b>Genera dal piano</b><button class="btn" data-azione="spesa-conferma"><b>Genera</b></button></div>`;
  h += gruppo("", `<div class="riga"><span class="cresce">Per ${g.settimane} ${g.settimane === 1 ? "settimana" : "settimane"}</span><button class="btn tondo" data-azione="gen-sett" data-d="-1">−</button><button class="btn tondo" data-azione="gen-sett" data-d="1">+</button></div>
    <label class="riga"><span class="cresce">Sostituisci la lista attuale</span><input type="checkbox" data-azione="gen-sost" ${g.sostituisci ? "checked" : ""}></label>`, "I pasti liberi non sono inclusi: aggiungili a mano.");
  h += gruppo("Per chi fai la spesa", `<div class="riga"><span class="cresce">Tu</span><span class="valore">100%</span></div>` + g.persone.map((x, i) => `<div class="riga"><input type="text" class="campo" placeholder="Nome" data-persona="${i}" data-k="nome" value="${esc(x.nome)}"><select data-persona="${i}" data-k="tipo">${Object.entries(FATTORI).map(([k, [, t]]) => `<option value="${k}" ${k === x.tipo ? "selected" : ""}>${t}</option>`).join("")}</select>${x.tipo === "calorie" ? `<input type="number" placeholder="kcal" data-persona="${i}" data-k="kcal" value="${x.kcal || ""}">` : ""}<span class="valore">${n0(fattore(x) * 100)}%</span><button class="btn rosso" data-azione="persona-elimina" data-i="${i}">✕</button></div>`).join("")
    + `<div class="riga"><button class="btn" data-azione="persona-aggiungi">＋ Aggiungi persona</button></div>`, g.persone.length ? `Quantità moltiplicate per ${n1(porz)} porzioni. Donna 75% e ragazzo/a 60% sono medie.` : "");
  const ops = Object.keys(g.col);
  if (ops.length) h += gruppo("Colazioni", ops.map((o, i) => `<div class="riga"><div class="cresce">${esc(o)}<div class="sotto">${g.col[o]} volte a settimana</div></div><button class="btn tondo" data-azione="gen-col" data-i="${i}" data-d="-1">−</button><button class="btn tondo" data-azione="gen-col" data-i="${i}" data-d="1">+</button></div>`).join(""), `${Object.values(g.col).reduce((a, b) => a + b, 0)} colazioni su ${g.giorni} previste a settimana.`);
  foglio(h);
}

// ───────────── Peso ─────────────
let mostraBmi = false;
function vistaPeso() {
  const p = [...S.pesate].sort((a, b) => new Date(b.data) - new Date(a.data)), h0 = imp("altezzaCm"), ob = imp("pesoObiettivo");
  let h = "";
  if (p.length) {
    const u = p[0], b = bmi(u.peso, h0), d = u.peso - p.at(-1).peso, [cat, col] = b ? categoriaBmi(b) : [];
    h += gruppo("", `<div class="riga" style="align-items:flex-start"><div class="cresce"><div class="piccolo">Peso attuale</div><b style="font-size:28px">${n1(u.peso)} kg</b>${p.length > 1 ? `<div style="color:${d <= 0 ? "var(--verde)" : "var(--arancio)"}">${d > 0 ? "+" : ""}${n1(d)} kg dall'inizio</div>` : ""}</div>
      ${b ? `<div style="text-align:right"><div class="piccolo">BMI</div><b style="font-size:28px">${n1(b)}</b><div><span class="pill" style="color:${col};background:color-mix(in srgb, ${col} 18%, transparent)">${cat}</span></div></div>` : ""}</div>`);
    const a = andamento();
    h += gruppo(`Andamento · ${OBIETTIVI[tipo()].breve}`, `<div class="riga"><span style="color:${a ? a[0] : "var(--secondario)"}">${a ? "●" : ""}</span><span class="cresce">${a ? a[1] : "Servono almeno due pesate a distanza di una settimana nelle ultime 3 settimane."}</span></div>`);
    const punti = p.slice().reverse().map((x) => [x.data, mostraBmi ? bmi(x.peso, h0) : x.peso]).filter((x) => x[1]);
    h += gruppo("", `<div class="riga"><div class="segmenti"><button class="${mostraBmi ? "" : "sel"}" data-azione="bmi" data-v="0">Peso</button><button class="${mostraBmi ? "sel" : ""}" data-azione="bmi" data-v="1">BMI</button></div></div><div class="riga" style="display:block">${grafico(punti, { linee: mostraBmi ? [{ v: 18.5, c: "var(--blu)", t: "18,5" }, { v: 25, c: "var(--arancio)", t: "25 sovrappeso" }] : ob ? [{ v: ob, c: "var(--verde)", t: `Obiettivo ${n1(ob)} kg` }] : [], unita: "kg" })}</div>`);
  } else h += `<div class="gruppo vuoto"><b>Nessuna pesata</b>Aggiungi il peso qui sotto.</div>`;
  h += gruppo("Nuova pesata", `<div class="riga"><input type="date" id="peso-data" value="${new Date().toISOString().slice(0, 10)}"><input type="number" inputmode="decimal" step="0.1" id="peso-val" placeholder="kg" class="cresce"><button class="btn" data-azione="peso-salva"><b>Salva</b></button></div>`);
  if (p.length) h += gruppo("Storico", p.map((x) => { const b = bmi(x.peso, h0); return `<div class="riga"><span class="cresce">${fmtData(x.data)}</span><b class="num">${n1(x.peso)} kg</b>${b ? `<span class="piccolo num" style="width:64px;text-align:right">BMI ${n1(b)}</span>` : ""}<button class="btn rosso" data-azione="peso-elimina" data-data="${x.data}" aria-label="Elimina">✕</button></div>`; }).join(""));
  return { titolo: "Peso e BMI", html: h };
}

// ───────────── Misure ─────────────
const MISURE = [["vita", "Vita", "cm"], ["addome", "Addome", "cm"], ["fianchi", "Fianchi", "cm"], ["petto", "Petto", "cm"], ["braccio", "Braccio (contratto)", "cm"], ["coscia", "Coscia (radice)", "cm"], ["pliche", "Somma pliche", "mm"], ["grasso", "Massa grassa", "%"]];
let misuraVista = "vita";
function vistaMisure() {
  const m = [...S.misure].sort((a, b) => new Date(a.data) - new Date(b.data));
  let h = "";
  if (m.length) {
    h += gruppo("", `<div class="riga"><select class="campo" data-azione="misura">${MISURE.map(([k, t]) => `<option value="${k}" ${k === misuraVista ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="riga" style="display:block">${grafico(m.filter((x) => x[misuraVista] != null).map((x) => [x.data, x[misuraVista]]))}</div>`);
    if (m.length > 1) {
      const pesoIl = (d) => S.pesate.find((p) => Math.abs(new Date(p.data) - new Date(d)) < 3 * 864e5)?.peso;
      const riga = (t, valori, meglio) => { const pr = valori.filter((v) => v != null), d = pr.length > 1 ? pr.at(-1) - pr[0] : null;
        return `<tr><td>${t}</td>${valori.map((v) => `<td>${v != null ? n1(v) : "—"}</td>`).join("")}<td style="font-weight:600;color:${d == null || !meglio ? "var(--secondario)" : meglio * d > 0 ? "var(--verde)" : d === 0 ? "var(--secondario)" : "var(--arancio)"}">${d != null ? (d > 0 ? "+" : "") + n1(d) : "—"}</td></tr>`; };
      let t = `<tr><th></th>${m.map((x) => `<th>${fmtData(x.data, { day: "numeric", month: "short" })}</th>`).join("")}<th>Totale</th></tr>` + riga("Peso (kg)", m.map((x) => pesoIl(x.data)), null);
      for (const [k, tt, u] of MISURE) if (m.some((x) => x[k] != null)) t += riga(`${tt.split(" (")[0]} (${u})`, m.map((x) => x[k]), k === "braccio" || k === "petto" ? 1 : -1);
      h += gruppo("Confronto visite", `<div class="tabella"><table>${t}</table></div>`, "Verde = nella direzione buona: braccio in crescita; vita, addome e pliche in calo.");
    }
  } else h += `<div class="gruppo vuoto"><b>Nessuna misura</b>Registra le circonferenze qui sotto.</div>`;
  h += gruppo("Nuove misure", `<div class="riga"><span class="cresce">Data</span><input type="date" id="mis-data" value="${new Date().toISOString().slice(0, 10)}"></div>` + MISURE.map(([k, t, u]) => `<div class="riga"><span class="cresce">${t}</span><input type="number" inputmode="decimal" step="0.1" id="mis-${k}" placeholder="—"><span class="valore">${u}</span></div>`).join("") + `<div class="riga"><button class="btn" data-azione="misure-salva"><b>Salva misure</b></button></div>`);
  if (m.length) h += gruppo("Storico", m.slice().reverse().map((x) => `<div class="riga"><div class="cresce"><b>${fmtData(x.data)}</b><div class="sotto">${MISURE.filter(([k]) => x[k] != null).map(([k, t, u]) => `${t.split(" (")[0]} ${n1(x[k])} ${u}`).join(" · ")}</div></div><button class="btn rosso" data-azione="misura-elimina" data-data="${x.data}">✕</button></div>`).join(""));
  return { titolo: "Misure corporee", html: h };
}

// ───────────── Profilo ─────────────
function vistaProfilo() {
  const c = imp("calcoloAutomatico", false) ? calcolaObiettivi() : null;
  const campo = (k, t, u, step = "any") => `<div class="riga"><span class="cresce">${t}</span><input type="number" inputmode="decimal" step="${step}" data-imp="${k}" value="${imp(k) || ""}" placeholder="0"><span class="valore">${u}</span></div>`;
  let h = gruppo("Dati personali", `<div class="riga"><input type="text" class="campo" data-imp-testo="nome" value="${esc(imp("nome", ""))}" placeholder="Nome"></div>` + campo("altezzaCm", "Altezza", "cm") + campo("pesoObiettivo", "Peso obiettivo", "kg"));
  h += gruppo("Obiettivo", `<div class="riga"><select class="campo" data-imp-testo="obiettivoTipo">${Object.entries(OBIETTIVI).map(([k, v]) => `<option value="${k}" ${k === tipo() ? "selected" : ""}>${v.nome}</option>`).join("")}</select></div>
    <label class="riga"><span class="cresce">Calcola in automatico</span><input type="checkbox" data-azione="auto" ${imp("calcoloAutomatico", false) ? "checked" : ""}></label>`,
    imp("calcoloAutomatico", false) ? (c ? `Fabbisogno ${n0(c.fab)} kcal → obiettivo ${n0(c.kcal)} kcal, proteine ${c.prot} g. È una stima: valgono le indicazioni del nutrizionista.` : "Servono altezza, data di nascita (dal backup iOS) e almeno una pesata.") : "Valori indicati dal nutrizionista.");
  if (!imp("calcoloAutomatico", false)) h += gruppo("Obiettivi giornalieri", campo("obiettivoKcal", "Calorie", "kcal", "10") + campo("obiettivoProteine", "Proteine", "g") + campo("obiettivoCarboidrati", "Carboidrati", "g") + campo("obiettivoGrassi", "Grassi", "g") + campo("obiettivoAcqua", "Acqua", "bicchieri", "1"));
  h += gruppo("Strumenti", `<div class="riga tocco" data-azione="vai-vista" data-v="allenamenti">🏋️ <span class="cresce">Allenamenti</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="ricette">🍳 <span class="cresce">Ricette</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="integratori">💊 <span class="cresce">Integratori</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="traguardi">🏆 <span class="cresce">Traguardi</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="foto">📷 <span class="cresce">Foto dei progressi</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="questionario">📋 <span class="cresce">Questionario prima della visita</span>›</div><div class="riga tocco" data-azione="vai-vista" data-v="digiuno">⏱️ <span class="cresce">Digiuno</span>›</div><div class="riga tocco" data-azione="spesa">🛒 <span class="cresce">Lista della spesa</span>›</div>`);
  h += gruppo("Aspetto", `<div class="riga"><div class="segmenti">${["Automatico", "Chiaro", "Scuro"].map((t, i) => `<button class="${imp("tema", 0) === i ? "sel" : ""}" data-azione="tema" data-v="${i}">${t}</button>`).join("")}</div></div>`);
  h += gruppo("Backup", `<div class="riga tocco" data-azione="esporta">⬇️ <span class="cresce">Scarica backup completo</span></div><label class="riga tocco">⬆️ <span class="cresce">Ripristina da backup (anche dell'app iOS)</span><input type="file" accept=".json,application/json" data-azione="importa" hidden></label><div class="riga tocco" data-azione="stampa">🖨️ <span class="cresce">Stampa o salva report (PDF)</span></div>`,
    "I dati restano solo in questo browser: scarica un backup ogni tanto. Il file è compatibile con l'app iOS.");
  return { titolo: imp("nome", "") || "Profilo", html: h };
}
function vistaReport() {
  const da = aggiungiGiorni(new Date(), -30), p = S.pesate.filter((x) => new Date(x.data) >= da).sort((a, b) => new Date(a.data) - new Date(b.data));
  const gg = [...Array(30)].map((_, i) => vociDelGiorno(aggiungiGiorni(da, i + 1))).filter((v) => v.length);
  const media = (k) => (gg.length ? gg.reduce((s, v) => s + somma(v, k), 0) / gg.length : 0);
  let h = gruppo("Ultimi 30 giorni", `<div class="riga"><span class="cresce">Obiettivo</span><span class="valore">${OBIETTIVI[tipo()].nome}</span></div><div class="riga"><span class="cresce">Giorni registrati</span><span class="valore">${gg.length}</span></div><div class="riga"><span class="cresce">Media calorie</span><span class="valore">${n0(media("kcal"))} kcal</span></div><div class="riga"><span class="cresce">Media proteine</span><span class="valore">${n0(media("proteine"))} g</span></div>`);
  h += gruppo("Peso", `<div class="riga" style="display:block">${grafico(p.map((x) => [x.data, x.peso]))}</div>`);
  const q = S.questionari.slice().sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  if (q) h += gruppo(`Questionario del ${fmtData(q.data)}`, `<div class="riga" style="white-space:pre-line">${esc(riepilogoQ(q))}</div>`);
  h += vistaMisure().html.split('<div class="titolo-gruppo"><span>Nuove misure')[0];
  return { titolo: `Report · ${imp("nome", "")}`, html: h + `<button class="btn pieno" data-azione="stampa-ora">Stampa / Salva come PDF</button>` };
}


// ───────────── Ricette ─────────────
function vistaRicette() {
  const r = S.alimenti.filter((a) => a.ricetta);
  let h = gruppo("", `<div class="riga tocco" data-azione="ricetta-nuova">＋ <span class="cresce" style="color:var(--verde)">Nuova ricetta</span></div>`);
  h += r.length ? gruppo("Le tue ricette", r.map((a) => `<div class="riga"><div class="cresce"><b>${esc(a.nome)}</b><div class="sotto">${esc(a.ingredienti)}</div><div class="sotto">P ${n0(a.proteine)} g · C ${n0(a.carboidrati)} g · G ${n0(a.grassi)} g</div></div><span class="valore">${n0(a.kcal)} kcal</span><button class="btn rosso" data-azione="ricetta-elimina" data-nome="${esc(a.nome)}" aria-label="Elimina">✕</button></div>`).join(""), "Le ricette compaiono tra i preferiti quando aggiungi un alimento.")
    : `<div class="gruppo vuoto"><b>Nessuna ricetta</b>Salva i piatti che prepari spesso (es. il tuo porridge) per inserirli con un tocco.</div>`;
  return { titolo: "Ricette", html: h };
}
let ricetta = null;
function disegnaRicetta() {
  const r = ricetta, cerca = r.cerca.toLowerCase(), pid = pianoAttivo()?.uid, visti = new Set();
  const disp = S.alimenti.filter((a) => a.perCento && !a.ricetta && (!a.piano || a.piano === pid) && (!cerca || a.nome.toLowerCase().includes(cerca)) && !visti.has(a.nome.toLowerCase()) && visti.add(a.nome.toLowerCase())).slice(0, 12);
  const t = (k) => r.righe.reduce((s, x) => s + ((x.a[k] || 0) * (x.g || 0)) / 100, 0);
  let h = `<div class="foglio-testa"><button class="btn" data-azione="chiudi">Annulla</button><b>Nuova ricetta</b><button class="btn" data-azione="ricetta-salva" ${r.nome.trim() && r.righe.length ? "" : "disabled"}><b>Salva</b></button></div>`;
  h += gruppo("", `<div class="riga"><input type="text" class="campo" data-ricetta="nome" value="${esc(r.nome)}" placeholder="Nome (es. Porridge proteico)"></div>`);
  h += gruppo("Ingredienti", r.righe.map((x, i) => `<div class="riga"><span class="cresce">${esc(x.a.nome)}</span><input type="number" inputmode="decimal" data-ricetta="g" data-i="${i}" value="${x.g ?? ""}"><span class="valore">g</span><button class="btn rosso" data-azione="ricetta-togli" data-i="${i}">✕</button></div>`).join("") || `<div class="riga piccolo">Aggiungi gli ingredienti qui sotto.</div>`,
    r.righe.length ? `<b>Totale: ${n0(t("kcal"))} kcal · P ${n0(t("proteine"))} g · C ${n0(t("carboidrati"))} g · G ${n0(t("grassi"))} g</b>` : "");
  h += gruppo("Aggiungi ingrediente", `<div class="riga"><input type="search" class="campo" data-ricetta="cerca" value="${esc(r.cerca)}" placeholder="Cerca tra i tuoi alimenti"></div>` + disp.map((a) => `<div class="riga tocco" data-azione="ricetta-ingrediente" data-nome="${esc(a.nome)}"><span class="cresce">${esc(a.nome)}</span><span class="valore">${n0(a.kcal)} kcal/100 g</span></div>`).join(""));
  const foc = document.activeElement?.dataset?.ricetta;
  foglio(h);
  if (foc === "cerca" || foc === "nome") { const el = document.querySelector(`[data-ricetta="${foc}"]`); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
function salvaRicetta() {
  const t = (k) => ricetta.righe.reduce((s, x) => s + ((x.a[k] || 0) * (x.g || 0)) / 100, 0);
  S.alimenti.push({ nome: ricetta.nome.trim(), marca: "", codice: null, perCento: false, kcal: Math.round(t("kcal")), proteine: +t("proteine").toFixed(1), carboidrati: +t("carboidrati").toFixed(1), grassi: +t("grassi").toFixed(1),
    grammi: null, preferito: true, ultimoUso: iso(new Date()), usi: 0, piano: null, ricetta: true, ingredienti: ricetta.righe.map((x) => `${x.a.nome} ${n0(x.g)} g`).join(" · ") });
  salva(); chiudiFoglio();
}

// ───────────── Integratori ─────────────
function vistaIntegratori() {
  let h = S.integratori.length ? gruppo("I tuoi integratori", S.integratori.map((x) => `<label class="riga"><div class="cresce">${esc(x.nome)}<div class="sotto">${esc(x.dose)}</div></div><input type="checkbox" data-azione="integratore-attivo" data-uid="${x.uid}" ${x.attivo ? "checked" : ""}><button class="btn rosso" data-azione="integratore-elimina" data-uid="${x.uid}" aria-label="Elimina">✕</button></label>`).join(""), "Quelli attivi compaiono ogni giorno nella scheda Oggi da spuntare.")
    : `<div class="gruppo vuoto"><b>Nessun integratore</b>Aggiungi ad esempio creatina o proteine in polvere.</div>`;
  h += gruppo("Aggiungi", `<div class="riga"><input type="text" class="campo" id="int-nome" placeholder="Nome (es. Creatina)"></div><div class="riga"><input type="text" class="campo" id="int-dose" placeholder="Dose (es. 5 g)"></div><div class="riga"><button class="btn" data-azione="integratore-aggiungi"><b>Aggiungi</b></button></div>`);
  return { titolo: "Integratori", html: h };
}

// ───────────── Allenamenti ─────────────
const massimale = (x) => x.kg * (1 + x.ripetizioni / 30);
function esercizi() { const v = new Set(); return S.allenamenti2.slice().sort((a, b) => new Date(b.data) - new Date(a.data)).map((x) => x.esercizio).filter((e) => !v.has(e.toLowerCase()) && v.add(e.toLowerCase())); }
function vistaAllenamenti() {
  const es = esercizi();
  let h = gruppo("", `<div class="riga tocco" data-azione="serie-nuova">＋ <span class="cresce" style="color:var(--verde)">Registra esercizio</span></div>`);
  if (!S.allenamenti2.length) h += `<div class="gruppo vuoto"><b>Nessun allenamento</b>Registra esercizi, serie, ripetizioni e carichi per vedere i progressi di forza.</div>`;
  else {
    h += gruppo("Progressi", es.map((e) => { const rec = Math.max(...S.allenamenti2.filter((x) => x.esercizio.toLowerCase() === e.toLowerCase()).map((x) => x.kg));
      return `<div class="riga tocco" data-azione="esercizio" data-nome="${esc(e)}"><span class="cresce">${esc(e)}</span><span class="valore">max ${n1(rec)} kg ›</span></div>`; }).join(""));
    const perGiorno = new Map();
    for (const x of S.allenamenti2.slice().sort((a, b) => new Date(b.data) - new Date(a.data))) { const k = inizioGiorno(x.data).getTime(); if (!perGiorno.has(k)) perGiorno.set(k, []); perGiorno.get(k).push(x); }
    for (const [k, serie] of perGiorno) h += gruppo(fmtData(k, { weekday: "long", day: "numeric", month: "long" }), serie.map((x) => `<div class="riga"><span class="cresce">${esc(x.esercizio)}</span><span class="valore num">${x.serie}×${x.ripetizioni} · ${n1(x.kg)} kg</span><button class="btn rosso" data-azione="serie-elimina" data-i="${S.allenamenti2.indexOf(x)}" aria-label="Elimina">✕</button></div>`).join(""));
  }
  return { titolo: "Allenamenti", html: h };
}
function vistaEsercizio(nome) {
  return () => {
    const s = S.allenamenti2.filter((x) => x.esercizio.toLowerCase() === nome.toLowerCase()).sort((a, b) => new Date(a.data) - new Date(b.data));
    return { titolo: nome, html: gruppo("Massimale stimato (kg)", `<div class="riga" style="display:block">${grafico(s.map((x) => [x.data, massimale(x)]), { unita: "kg" })}</div>`, "Stima del peso sollevabile per una ripetizione (formula di Epley): confronta serie con ripetizioni diverse.")
      + gruppo("Storico", s.slice().reverse().map((x) => `<div class="riga"><span class="cresce">${fmtData(x.data)}</span><span class="valore num">${x.serie}×${x.ripetizioni} · ${n1(x.kg)} kg</span></div>`).join("")) };
  };
}
let serie = null;
function disegnaSerie() {
  const s = serie, ultima = S.allenamenti2.filter((x) => x.esercizio.toLowerCase() === s.esercizio.trim().toLowerCase()).sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  const step = (k, t, d) => `<div class="riga"><span class="cresce">${t}: <b class="num">${s[k]}</b></span><button class="btn tondo" data-azione="serie-step" data-k="${k}" data-d="-${d}">−</button><button class="btn tondo" data-azione="serie-step" data-k="${k}" data-d="${d}">+</button></div>`;
  let h = `<div class="foglio-testa"><button class="btn" data-azione="chiudi">Annulla</button><b>Nuovo esercizio</b><button class="btn" data-azione="serie-salva" ${s.esercizio.trim() ? "" : "disabled"}><b>Salva</b></button></div>`;
  h += gruppo("", `<div class="riga"><span class="cresce">Data</span><input type="date" data-serie="data" value="${s.data}"></div><div class="riga"><input type="text" class="campo" data-serie="esercizio" value="${esc(s.esercizio)}" placeholder="Esercizio (es. Panca piana)"></div>`
    + (esercizi().length ? `<div class="riga" style="flex-wrap:wrap;gap:8px">${esercizi().map((e) => `<button class="btn" style="border:1px solid var(--linea);border-radius:99px;padding:4px 10px" data-azione="serie-scegli" data-nome="${esc(e)}">${esc(e)}</button>`).join("")}</div>` : ""));
  h += gruppo("", step("serie", "Serie", 1) + step("ripetizioni", "Ripetizioni", 1) + `<div class="riga"><span class="cresce">Carico</span><input type="number" inputmode="decimal" step="0.5" data-serie="kg" value="${s.kg ?? ""}" placeholder="0"><span class="valore">kg</span></div>`,
    ultima ? `L'ultima volta: ${ultima.serie}×${ultima.ripetizioni} con ${n1(ultima.kg)} kg.` : "");
  const foc = document.activeElement?.dataset?.serie;
  foglio(h);
  if (foc === "esercizio") { const el = document.querySelector('[data-serie="esercizio"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
function salvaSerie() {
  const d = new Date(serie.data + "T18:00");
  S.allenamenti2.push({ data: iso(d), esercizio: serie.esercizio.trim(), serie: serie.serie, ripetizioni: serie.ripetizioni, kg: serie.kg || 0 });
  // Un esercizio registrato segna anche il giorno di allenamento.
  if (!S.allenamenti.some((x) => stessoGiorno(x, d))) S.allenamenti.push(iso(inizioGiorno(d)));
  salva(); chiudiFoglio();
}


// ───────────── Traguardi ─────────────
function calcolaTraguardi() {
  const n = 180, inizio = aggiungiGiorni(inizioGiorno(new Date()), -n + 1), ob = imp("obiettivoKcal"), obP = imp("obiettivoProteine");
  const giorni = [...Array(n)].map((_, i) => { const v = vociDelGiorno(aggiungiGiorni(inizio, i)); return { kcal: somma(v, "kcal"), p: somma(v, "proteine") }; });
  const ok = (g) => g.kcal > 0 && ob > 0 && giornoOk(g.kcal, ob), okP = (g) => g.kcal > 0 && obP > 0 && g.p >= obP * 0.9, reg = (g) => g.kcal > 0;
  const serie = (f) => { const el = giorni.slice().reverse(); if (el.length && !f(el[0])) el.shift(); let c = 0; for (const g of el) { if (!f(g)) break; c++; } return c; };
  let rec = 0, cur = 0; for (const g of giorni) { cur = ok(g) ? cur + 1 : 0; rec = Math.max(rec, cur); }
  let settP = 0; for (let i = 0; i + 7 <= n; i += 7) if (giorni.slice(i, i + 7).filter(okP).length >= 5) settP++;
  return { serieOb: serie(ok), serieP: serie(okP), serieReg: serie(reg), rec, registrati: giorni.filter(reg).length, settP };
}
function vistaTraguardi() {
  const t = calcolaTraguardi(), r = (a, b) => `<div class="riga"><span class="cresce">${a}</span><span class="valore num">${b}</span></div>`;
  const badge = [["🚶", "Primo passo", "Registra il primo giorno", t.registrati >= 1], ["7️⃣", "Una settimana", "7 giorni di fila nell'obiettivo", t.rec >= 7], ["🔟", "Due settimane", "14 giorni di fila nell'obiettivo", t.rec >= 14],
    ["📅", "Un mese", "30 giorni di fila nell'obiettivo", t.rec >= 30], ["⚡️", "Proteine top", "Una settimana con almeno 5 giorni di proteine raggiunte", t.settP >= 1], ["⭐️", "Costanza", "50 giorni registrati", t.registrati >= 50]];
  return { titolo: "Traguardi", html: gruppo("Serie in corso", r("Giorni nell'obiettivo", t.serieOb) + r("Giorni con proteine raggiunte", t.serieP) + r("Giorni registrati di fila", t.serieReg) + r("Record nell'obiettivo", `${t.rec} giorni`))
    + gruppo("Badge", badge.map(([ic, ti, de, si]) => `<div class="riga" style="opacity:${si ? 1 : 0.45}"><span style="font-size:26px;filter:${si ? "none" : "grayscale(1)"}">${ic}</span><div class="cresce"><b>${ti}</b><div class="sotto">${de}</div></div>${si ? `<span style="color:var(--verde)">✓</span>` : ""}</div>`).join("")) };
}

// ───────────── Foto dei progressi ─────────────
const srcFoto = (f) => "data:image/jpeg;base64," + f.immagine;
function vistaFoto() {
  const f = S.foto.slice().sort((a, b) => new Date(a.data) - new Date(b.data));
  let h = gruppo("", `<label class="riga tocco">📷 <span class="cresce" style="color:var(--verde)">Aggiungi foto</span><input type="file" accept="image/*" data-azione="foto-aggiungi" hidden></label>`, "Stessa posa, luce e ora ogni volta (es. una volta al mese, al mattino). Le foto restano solo in questo browser e nel backup.");
  if (f.length > 1) h += gruppo("Prima e adesso", `<div class="riga" style="gap:8px">${[f[0], f.at(-1)].map((x) => `<figure style="flex:1;margin:0;text-align:center"><img src="${srcFoto(x)}" alt="Foto del ${fmtData(x.data)}" style="border-radius:8px"><figcaption class="piccolo">${fmtData(x.data)}</figcaption></figure>`).join("")}</div>`);
  if (f.length) h += gruppo("Tutte", `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;padding:12px">${f.slice().reverse().map((x) => `<figure style="margin:0;text-align:center"><img src="${srcFoto(x)}" alt="Foto del ${fmtData(x.data)}" style="border-radius:8px"><figcaption class="piccolo">${fmtData(x.data, { day: "numeric", month: "short" })} <button class="btn rosso" data-azione="foto-elimina" data-data="${x.data}" aria-label="Elimina">✕</button></figcaption></figure>`).join("")}</div>`);
  else h += `<div class="gruppo vuoto"><b>Nessuna foto</b>Aggiungi la prima per confrontare i progressi nel tempo.</div>`;
  return { titolo: "Foto dei progressi", html: h };
}
function aggiungiFoto(file) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    // Ridotta a 1000 px e JPEG per non riempire la memoria del browser.
    const k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    S.foto.push({ data: iso(new Date()), immagine: c.toDataURL("image/jpeg", 0.75).split(",")[1] }); salva(); disegna();
  };
  img.onerror = () => avviso("Immagine non leggibile.");
  img.src = url;
}

// ───────────── Questionario ─────────────
const DOMANDE = [["fame", "Fame tra i pasti", "molta", "nessuna"], ["energia", "Energia durante il giorno", "bassa", "alta"], ["sonno", "Qualità del sonno", "scarsa", "ottima"], ["digestione", "Digestione", "difficile", "ottima"], ["aderenza", "Quanto hai seguito il piano", "poco", "sempre"]];
let questionario = null;
const riepilogoQ = (q) => DOMANDE.map(([k, t]) => `${t.split(" ")[0]} ${q[k]}/5`).join(" · ") + (q.note ? "\n" + q.note : "");
function vistaQuestionario() {
  questionario ??= { fame: 3, energia: 3, sonno: 3, digestione: 3, aderenza: 3, note: "" };
  const q = questionario, ultimo = S.questionari.slice().sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  let h = gruppo("Come è andato il periodo", DOMANDE.map(([k, t, basso, alto]) => `<div class="riga" style="display:block"><div>${t}</div><div class="segmenti" style="margin-top:6px">${[1, 2, 3, 4, 5].map((v) => `<button class="${q[k] === v ? "sel" : ""}" data-azione="q-voto" data-k="${k}" data-v="${v}">${v}</button>`).join("")}</div><div class="piccolo" style="display:flex;justify-content:space-between"><span>${basso}</span><span>${alto}</span></div></div>`).join(""),
    "Da compilare qualche giorno prima della visita: le risposte finiscono nel report.");
  h += gruppo("Note", `<div class="riga"><textarea data-azione="q-note" placeholder="Difficoltà, cambi di allenamento, eventi…">${esc(q.note)}</textarea></div>`);
  h += `<button class="btn pieno" data-azione="q-salva">Salva questionario</button><div style="height:22px"></div>`;
  if (ultimo) h += gruppo(`Ultimo compilato: ${fmtData(ultimo.data)}`, `<div class="riga piccolo" style="white-space:pre-line">${esc(riepilogoQ(ultimo))}</div>`);
  return { titolo: "Questionario", html: h };
}

// ───────────── Digiuno ─────────────
function vistaDigiuno() {
  const ore = imp("oreDigiuno", 12), ultimo = S.vociCibo.filter((v) => new Date(v.data) <= new Date()).sort((a, b) => new Date(b.data) - new Date(a.data))[0];
  let h;
  if (ultimo) {
    const t = (Date.now() - new Date(ultimo.data)) / 36e5, fine = new Date(new Date(ultimo.data).getTime() + ore * 36e5), fatto = fine <= new Date();
    h = gruppo("", `<div style="display:grid;place-items:center;padding:20px;gap:10px">${anello(t / ore, fatto ? "var(--verde)" : "var(--arancio)", `<b class="num">${Math.floor(t)} h ${Math.floor((t % 1) * 60)} min</b><span class="piccolo">dall'ultimo pasto</span>`).replace('class="anello"', 'class="anello" style="width:160px;height:160px"').replace(/width="110" height="110"/, 'width="160" height="160"')}
      <div class="piccolo" style="text-align:center">Ultimo pasto: ${esc(ultimo.nome)}, ${new Date(ultimo.data).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
      <b>${fatto ? `Obiettivo di ${ore} ore raggiunto` : `Obiettivo alle ${fine.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`}</b></div>`);
  } else h = `<div class="gruppo vuoto"><b>Nessun pasto registrato</b>Registra un pasto per iniziare.</div>`;
  h += gruppo("", `<div class="riga"><span class="cresce">Digiuno notturno: <b>${ore} ore</b></span><button class="btn tondo" data-azione="digiuno-ore" data-d="-1">−</button><button class="btn tondo" data-azione="digiuno-ore" data-d="1">+</button></div>`,
    "Conta il tempo dall'ultimo alimento registrato (conta l'ora in cui lo registri). Usalo solo se il nutrizionista ti ha dato indicazioni sugli orari.");
  return { titolo: "Digiuno", html: h };
}

// ───────────── Backup ─────────────
function plistXml(o) {
  const v = (x) => typeof x === "boolean" ? `<${x}/>` : typeof x === "number" ? (Number.isInteger(x) ? `<integer>${x}</integer>` : `<real>${x}</real>`) : `<string>${esc(x)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${Object.entries(o).filter(([, x]) => ["boolean", "number", "string"].includes(typeof x)).map(([k, x]) => `<key>${esc(k)}</key>${v(x)}`).join("")}</dict></plist>`;
}
function esporta() {
  // Le impostazioni viaggiano come plist codificato, come nel backup iOS, così l'app iOS può ripristinarlo.
  const { spesaPersone, ...semplici } = S.impostazioni;
  const file = { ...S, creato: iso(new Date()), impostazioni: btoa(unescape(encodeURIComponent(plistXml(semplici)))), impostazioniWeb: S.impostazioni };
  file.vociCibo = S.vociCibo.map(({ id, ...v }) => v);
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `Diario Dieta backup ${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importa(testo) {
  const d = JSON.parse(testo);
  if (!Array.isArray(d.piani) || !Array.isArray(d.vociCibo)) throw new Error("Il file non è un backup di Diario Dieta.");
  let impostazioni = d.impostazioniWeb || (typeof d.impostazioni === "object" ? d.impostazioni : null);
  if (!impostazioni && typeof d.impostazioni === "string") {
    // Backup iOS: plist binario, non leggibile dal browser. Si tengono le impostazioni attuali.
    try { impostazioni = leggiPlistXml(decodeURIComponent(escape(atob(d.impostazioni))));
    } catch { impostazioni = null; }
  }
  S = { ...vuoto(), ...d, impostazioni: { ...S.impostazioni, ...(impostazioni || {}) } };
  S.vociCibo = S.vociCibo.map((v) => ({ id: v.id || uuid(), ...v }));
  salva();
  return impostazioni ? "Backup ripristinato." : "Backup ripristinato. Le impostazioni dell'app iOS non sono leggibili dal browser: controlla gli obiettivi nel Profilo.";
}
function leggiPlistXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml"), dict = doc.querySelector("dict"), out = {};
  if (!dict) throw new Error("non xml");
  const el = [...dict.children];
  for (let i = 0; i < el.length; i += 2) { const k = el[i].textContent, v = el[i + 1]; out[k] = v.tagName === "true" ? true : v.tagName === "false" ? false : ["real", "integer"].includes(v.tagName) ? +v.textContent : v.textContent; }
  return out;
}

// ───────────── Eventi ─────────────
document.addEventListener("click", async (e) => {
  const s = e.target.closest("[data-scheda]"); if (s) return vai(s.dataset.scheda);
  const t = e.target.closest("[data-azione]"); if (!t) return;
  const a = t.dataset.azione, g = giornoVisto;
  switch (a) {
    case "indietro": return indietro();
    case "chiudi": return chiudiFoglio();
    case "giorno": giornoVisto = aggiungiGiorni(g, +t.dataset.delta); return disegna();
    case "oggi": giornoVisto = new Date(); return disegna();
    case "settimana": if (pila.length) pila.pop(); return apri(vistaSettimana(+(t.dataset.fa || 0)));
    case "acqua": {
      let r = S.acqua.find((x) => stessoGiorno(x.giorno, g));
      if (!r) { r = { giorno: iso(inizioGiorno(g)), bicchieri: 0 }; S.acqua.push(r); }
      r.bicchieri = Math.max(0, r.bicchieri + +t.dataset.delta); salva(); return disegna();
    }
    case "segna": {
      const v = S.vociPiano.find((x) => x.uid === t.dataset.uid), i = vociDelGiorno(g).find((x) => x.pianoID === v.uid);
      if (i) S.vociCibo = S.vociCibo.filter((x) => x !== i);
      else S.vociCibo.push({ id: uuid(), data: iso(dataNuoveVoci(g)), pasto: v.pasto, nome: v.nome, kcal: v.kcal, proteine: v.proteine, carboidrati: v.carboidrati, grassi: v.grassi, grammi: v.grammi ?? null, pianoID: v.uid });
      salva(); return disegna();
    }
    case "nuovo-cibo": return apriCibo(+t.dataset.pasto);
    case "modifica-cibo": return apriCibo(null, t.dataset.id);
    case "salva-cibo": return salvaCibo();
    case "elimina-cibo": S.vociCibo = S.vociCibo.filter((x) => x.id !== modulo.id); salva(); return chiudiFoglio();
    case "scegli-pasto": { const v = S.vociPiano.find((x) => x.uid === t.dataset.uid); Object.assign(modulo, { nome: v.nome, per100: false, grammi: null, kcal: v.kcal, p: v.proteine, c: v.carboidrati, g: v.grassi }); return disegnaModulo(); }
    case "scegli-alimento": { const pid = pianoPerGiorno(g)?.uid, al = S.alimenti.find((x) => x.nome === t.dataset.nome && (t.dataset.piano ? x.piano === pid : true)); riempiDaAlimento(al); return disegnaModulo(); }
    case "scegli-fuori": { const f = FUORI.find((x) => x[0] === t.dataset.nome); Object.assign(modulo, { nome: f[0], per100: false, grammi: null, kcal: f[1], p: f[2], c: f[3], g: f[4] }); return disegnaModulo(); }
    case "scegli-off": { const r = modulo.risultati[+t.dataset.i]; Object.assign(modulo, { nome: r.nome, per100: true, grammi: 100, kcal: r.kcal, p: r.p, c: r.c, g: r.g, risultati: null }); return disegnaModulo(); }
    case "cerca-online": return cercaOnline();
    case "codice": return cercaCodice();
    case "settimana-piano": return apri(vistaSettimanaPiano(t.dataset.uid));
    case "regole": return apri(vistaRegole(t.dataset.uid));
    case "attiva-piano": S.piani.forEach((p) => (p.attivo = p.uid === t.dataset.uid)); salva(); return disegna();
    case "spesa": return apri(vistaSpesa);
    case "spesa-aggiungi": { const n = document.getElementById("spesa-nome").value.trim(); if (!n) return; S.spesa.push({ nome: n, quantita: document.getElementById("spesa-q").value, reparto: reparto(n), comprato: false }); salva(); return disegna(); }
    case "spesa-spunta": if (e.target.closest("[data-azione='spesa-elimina']")) return; S.spesa[+t.dataset.i].comprato ^= true; S.spesa[+t.dataset.i].comprato = !!S.spesa[+t.dataset.i].comprato; salva(); return disegna();
    case "spesa-elimina": S.spesa.splice(+t.dataset.i, 1); salva(); return disegna();
    case "spesa-togli": S.spesa = S.spesa.filter((x) => !x.comprato); salva(); return disegna();
    case "spesa-svuota": S.spesa = []; salva(); return disegna();
    case "spesa-condividi": {
      const testo = REPARTI.map((r) => { const el = S.spesa.filter((x) => x.reparto === r && !x.comprato); return el.length ? r.toUpperCase() + "\n" + el.map((x) => `☐ ${x.nome}${x.quantita ? " – " + x.quantita : ""}`).join("\n") : null; }).filter(Boolean).join("\n\n");
      if (navigator.share) try { await navigator.share({ title: "Lista della spesa", text: testo }); } catch {} else { await navigator.clipboard?.writeText(testo); avviso("Lista copiata."); }
      return;
    }
    case "spesa-genera": return apriGeneraSpesa();
    case "gen-sett": genSpesa.settimane = Math.min(4, Math.max(1, genSpesa.settimane + +t.dataset.d)); return disegnaGenera();
    case "gen-col": { const k = Object.keys(genSpesa.col)[+t.dataset.i]; genSpesa.col[k] = Math.min(7, Math.max(0, genSpesa.col[k] + +t.dataset.d)); return disegnaGenera(); }
    case "persona-aggiungi": genSpesa.persone.push({ nome: "", tipo: "donna", kcal: 0 }); return disegnaGenera();
    case "persona-elimina": genSpesa.persone.splice(+t.dataset.i, 1); return disegnaGenera();
    case "spesa-conferma": {
      const porz = 1 + genSpesa.persone.reduce((s, x) => s + fattore(x), 0);
      setImp("spesaPersone", genSpesa.persone);
      S.spesa = (genSpesa.sostituisci ? [] : S.spesa).concat(generaSpesa(genSpesa.settimane, porz, genSpesa.col)); salva(); return chiudiFoglio();
    }
    case "bmi": mostraBmi = t.dataset.v === "1"; return disegna();
    case "peso-salva": {
      const v = num(document.getElementById("peso-val").value), d = document.getElementById("peso-data").value;
      if (!v || v < 30 || v > 250) return avviso("Inserisci un peso valido.");
      S.pesate.push({ data: iso(new Date(d + "T08:00")), peso: v }); salva(); avviso("Pesata salvata."); return disegna();
    }
    case "peso-elimina": S.pesate = S.pesate.filter((x) => x.data !== t.dataset.data); salva(); return disegna();
    case "misure-salva": {
      const m = { data: iso(new Date(document.getElementById("mis-data").value + "T12:00")) };
      for (const [k] of MISURE) { const v = num(document.getElementById("mis-" + k).value); m[k] = v; }
      if (MISURE.every(([k]) => m[k] == null)) return avviso("Inserisci almeno una misura.");
      S.misure.push(m); salva(); avviso("Misure salvate."); return disegna();
    }
    case "misura-elimina": S.misure = S.misure.filter((x) => x.data !== t.dataset.data); salva(); return disegna();
    case "tema": setImp("tema", +t.dataset.v); return disegna();
    case "vai-vista": return apri({ allenamenti: vistaAllenamenti, ricette: vistaRicette, integratori: vistaIntegratori, traguardi: vistaTraguardi, foto: vistaFoto, questionario: vistaQuestionario, digiuno: vistaDigiuno }[t.dataset.v]);
    case "integratore-preso": {
      const u = t.dataset.uid, preso = S.integratoriPresi.some((p) => p.integratore === u && stessoGiorno(p.giorno, g));
      S.integratoriPresi = preso ? S.integratoriPresi.filter((p) => !(p.integratore === u && stessoGiorno(p.giorno, g))) : S.integratoriPresi.concat({ giorno: iso(inizioGiorno(g)), integratore: u });
      salva(); return disegna();
    }
    case "integratore-aggiungi": { const n = document.getElementById("int-nome").value.trim(); if (!n) return; S.integratori.push({ uid: uuid(), nome: n, dose: document.getElementById("int-dose").value.trim(), attivo: true }); salva(); return disegna(); }
    case "integratore-elimina": e.preventDefault(); S.integratori = S.integratori.filter((x) => x.uid !== t.dataset.uid); salva(); return disegna();
    case "ricetta-nuova": ricetta = { nome: "", righe: [], cerca: "" }; return disegnaRicetta();
    case "ricetta-ingrediente": { const a = S.alimenti.find((x) => x.nome === t.dataset.nome && x.perCento); ricetta.righe.push({ a, g: a.grammi || 100 }); ricetta.cerca = ""; return disegnaRicetta(); }
    case "ricetta-togli": ricetta.righe.splice(+t.dataset.i, 1); return disegnaRicetta();
    case "ricetta-salva": return salvaRicetta();
    case "ricetta-elimina": S.alimenti = S.alimenti.filter((x) => !(x.ricetta && x.nome === t.dataset.nome)); salva(); return disegna();
    case "serie-nuova": serie = { data: new Date().toISOString().slice(0, 10), esercizio: "", serie: 3, ripetizioni: 10, kg: null }; return disegnaSerie();
    case "serie-scegli": { const u = S.allenamenti2.filter((x) => x.esercizio === t.dataset.nome).sort((a, b) => new Date(b.data) - new Date(a.data))[0]; Object.assign(serie, { esercizio: t.dataset.nome, serie: u.serie, ripetizioni: u.ripetizioni, kg: u.kg }); return disegnaSerie(); }
    case "serie-step": { const k = t.dataset.k; serie[k] = Math.min(k === "serie" ? 10 : 50, Math.max(1, serie[k] + +t.dataset.d)); return disegnaSerie(); }
    case "serie-salva": return salvaSerie();
    case "serie-elimina": S.allenamenti2.splice(+t.dataset.i, 1); salva(); return disegna();
    case "esercizio": return apri(vistaEsercizio(t.dataset.nome));
    case "foto-elimina": S.foto = S.foto.filter((x) => x.data !== t.dataset.data); salva(); return disegna();
    case "q-voto": questionario[t.dataset.k] = +t.dataset.v; return disegna();
    case "q-salva": S.questionari.push({ data: iso(new Date()), ...questionario }); questionario = null; salva(); avviso("Questionario salvato."); return disegna();
    case "digiuno-ore": setImp("oreDigiuno", Math.min(20, Math.max(10, imp("oreDigiuno", 12) + +t.dataset.d))); return disegna();
    case "esporta": return esporta();
    case "stampa": return apri(vistaReport);
    case "stampa-ora": return print();
  }
});
document.addEventListener("change", (e) => {
  const t = e.target, a = t.dataset.azione, g = giornoVisto;
  if (a === "allenamento") { S.allenamenti = S.allenamenti.filter((d) => !stessoGiorno(d, g)); if (t.checked) S.allenamenti.push(iso(inizioGiorno(g))); salva(); return disegna(); }
  if (a === "scegli") { S.scelte = S.scelte.filter((s) => !(s.voce === t.dataset.uid && stessoGiorno(s.giorno, g))); if (t.value) S.scelte.push({ giorno: iso(inizioGiorno(g)), voce: t.dataset.uid, opzione: t.value }); salva(); return disegna(); }
  if (a === "nota") { const n = S.noteGiorno.find((x) => stessoGiorno(x.giorno, g)); if (n) n.testo = t.value; else if (t.value) S.noteGiorno.push({ giorno: iso(inizioGiorno(g)), testo: t.value }); return salva(); }
  if (a === "per100") { const m = modulo, era = m.per100; m.per100 = !t.checked;
    if (m.grammi > 0 && era !== m.per100) { const k = m.per100 ? 100 / m.grammi : m.grammi / 100; for (const x of ["kcal", "p", "c", "g"]) if (m[x] != null) m[x] = Math.round(m[x] * k * 10) / 10; }
    return disegnaModulo(); }
  if (a === "cambia-piano") { pianoVisto = t.value; return disegna(); }
  if (a === "misura") { misuraVista = t.value; return disegna(); }
  if (a === "auto") { setImp("calcoloAutomatico", t.checked); applicaCalcolo(); return disegna(); }
  if (t.dataset.ricetta === "g") return disegnaRicetta();
  if (a === "foto-aggiungi" && t.files[0]) return aggiungiFoto(t.files[0]);
  if (a === "q-note") { questionario.note = t.value; return; }
  if (a === "integratore-attivo") { S.integratori.find((x) => x.uid === t.dataset.uid).attivo = t.checked; return salva(); }
  if (t.dataset.serie === "data") { serie.data = t.value; return; }
  if (a === "gen-sost") { genSpesa.sostituisci = t.checked; return; }
  if (a === "importa") {
    const f = t.files[0]; if (!f) return;
    f.text().then((x) => { try { avviso(importa(x)); disegna(); } catch (err) { avviso(err.message || "File non valido."); } });
    return;
  }
  if (t.dataset.campo === "pasto") { modulo.pasto = +t.value; return disegnaModulo(); }
  if (t.dataset.imp) { setImp(t.dataset.imp, num(t.value) || 0); applicaCalcolo(); return disegna(); }
  if (t.dataset.impTesto) { setImp(t.dataset.impTesto, t.value); applicaCalcolo(); return disegna(); }
  if (t.dataset.persona != null) { const p = genSpesa.persone[+t.dataset.persona]; p[t.dataset.k] = t.dataset.k === "kcal" ? num(t.value) || 0 : t.value; return disegnaGenera(); }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.ricetta && ricetta) {
    const k = t.dataset.ricetta;
    if (k === "g") { ricetta.righe[+t.dataset.i].g = num(t.value); return; } // il totale si aggiorna all'uscita dal campo
    ricetta[k] = t.value; clearTimeout(disegnaRicetta.t); disegnaRicetta.t = setTimeout(disegnaRicetta, 250); return;
  }
  if (t.dataset.serie && serie && t.dataset.serie !== "data") {
    const k = t.dataset.serie; serie[k] = k === "kg" ? num(t.value) : t.value;
    if (k === "esercizio") { clearTimeout(disegnaSerie.t); disegnaSerie.t = setTimeout(disegnaSerie, 300); }
    return;
  }
  if (t.dataset.campo && modulo) {
    const k = t.dataset.campo; modulo[k] = k === "nome" ? t.value : num(t.value);
    if (k === "nome") modulo.risultati = null;
    clearTimeout(disegnaModulo.t); disegnaModulo.t = setTimeout(disegnaModulo, k === "nome" ? 250 : 400);
  }
});
document.addEventListener("focusin", (e) => { if (e.target.type === "number") setTimeout(() => e.target.select?.(), 0); });
function applicaCalcolo() {
  if (!imp("calcoloAutomatico", false)) return;
  const c = calcolaObiettivi(); if (!c) return;
  Object.assign(S.impostazioni, { obiettivoKcal: c.kcal, obiettivoProteine: c.prot, obiettivoCarboidrati: c.carbo, obiettivoGrassi: c.grassi, obiettivoAcqua: c.acqua }); salva();
}

// Safari su iPhone a volte ingrandisce comunque con il doppio tocco: si annulla il secondo tocco ravvicinato.
let ultimoTocco = 0;
document.addEventListener("touchend", (e) => {
  const ora = Date.now();
  if (ora - ultimoTocco < 350 && !e.target.closest("input, textarea, select")) e.preventDefault();
  ultimoTocco = ora;
}, { passive: false });
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gesturestart", (e) => e.preventDefault());

// Primo avvio: carica i dati portati dall'app iOS, se presenti accanto alla pagina.
(async function avvio() {
  if (!S.piani.length && !S.vociCibo.length) {
    try { const r = await fetch("dati-iniziali.json", { cache: "no-store" }); if (r.ok) { importa(await r.text()); avviso("Dati dell'app iOS caricati."); } } catch {}
  }
  disegna();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
