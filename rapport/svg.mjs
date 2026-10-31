// Lager ukerapporten som SVG (ren tekst, liten fil) i appens design.
// Bruk: node rapport/svg.mjs data.json ut.svg
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [dataPath, outPath = "ukerapport.svg"] = process.argv.slice(2);
const d = JSON.parse(readFileSync(dataPath, "utf8"));
const logo = readFileSync(join(here, "logo.png")).toString("base64");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const C = { navy: "#284659", sage: "#A4BFA8", cream: "#F2F2EB", gold: "#BF913B", ink: "#1F3747", muted: "#5B6B75", line: "#E3E4DC", soft: "#E4ECE5" };

const W = 760, P = 32, CW = W - 2 * P, IP = 20; // bredde, marg, kortbredde, innvendig marg
const out = [];
let y = P;
out.push(`<image x="${P}" y="${y}" width="147" height="54" href="data:image/png;base64,${logo}"/>`);
out.push(`<text x="${W - P}" y="${y + 32}" text-anchor="end" font-size="13" font-weight="600" letter-spacing="1.5" fill="${C.gold}">UKERAPPORT</text>`);
y += 54 + 46;
out.push(`<text x="${P}" y="${y}" font-size="30" font-weight="600" fill="${C.navy}">${esc(d.title)}</text>`);
if (d.subtitle) { y += 26; out.push(`<text x="${P}" y="${y}" font-size="15" fill="${C.muted}">${esc(d.subtitle)}</text>`); }
y += 22;

for (const s of d.sections || []) {
  const n = s.columns.length, rowH = 38, headH = 30;
  const cardH = IP + 26 + headH + s.rows.length * rowH + (s.note ? 30 : 6) + 8;
  const top = y;
  out.push(`<rect x="${P}" y="${top}" width="${CW}" height="${cardH}" rx="16" fill="#fff" stroke="${C.line}"/>`);
  let cy = top + IP;
  out.push(`<rect x="${P + IP}" y="${cy + 2}" width="6" height="18" rx="3" fill="${C.sage}"/>`);
  out.push(`<text x="${P + IP + 16}" y="${cy + 17}" font-size="17" font-weight="600" fill="${C.navy}">${esc(s.title)}</text>`);
  cy += 26;
  const tx = P + IP, tw = CW - 2 * IP, first = tw * 0.34, other = (tw - first) / Math.max(1, n - 1);
  const colRight = (i) => tx + first + other * i - 8; // høyrekant for kolonne i (1..n-1)
  out.push(...s.columns.map((c, i) => i === 0
    ? `<text x="${tx + 8}" y="${cy + 20}" font-size="12" font-weight="600" letter-spacing="0.7" fill="${C.muted}">${esc(String(c).toUpperCase())}</text>`
    : `<text x="${colRight(i)}" y="${cy + 20}" text-anchor="end" font-size="12" font-weight="600" letter-spacing="0.7" fill="${C.muted}">${esc(String(c).toUpperCase())}</text>`));
  cy += headH;
  out.push(`<rect x="${tx}" y="${cy - 2}" width="${tw}" height="2" fill="${C.line}"/>`);
  if (n > 2) out.push(`<rect x="${tx + first}" y="${cy}" width="${other}" height="${s.rows.length * rowH}" fill="${C.soft}"/>`);
  s.rows.forEach((r, k) => {
    const ry = cy + k * rowH;
    if (k) out.push(`<rect x="${tx}" y="${ry}" width="${tw}" height="1" fill="${C.line}"/>`);
    r.forEach((v, i) => out.push(i === 0
      ? `<text x="${tx + 8}" y="${ry + 25}" font-size="15" font-weight="500" fill="${C.ink}">${esc(v)}</text>`
      : `<text x="${colRight(i)}" y="${ry + 25}" text-anchor="end" font-size="15" ${i === 1 && n > 2 ? `font-weight="700" fill="${C.navy}"` : `fill="${C.ink}"`}>${esc(v)}</text>`));
  });
  cy += s.rows.length * rowH;
  if (s.note) out.push(`<text x="${tx}" y="${cy + 22}" font-size="13" fill="${C.muted}">${esc(s.note)}</text>`);
  y = top + cardH + 18;
}

if (d.notes?.length) {
  const h = IP + 30 + d.notes.length * 24 + 12;
  out.push(`<rect x="${P}" y="${y}" width="${CW}" height="${h}" rx="16" fill="${C.navy}"/>`);
  out.push(`<rect x="${P + IP}" y="${y + IP + 2}" width="6" height="18" rx="3" fill="${C.gold}"/>`);
  out.push(`<text x="${P + IP + 16}" y="${y + IP + 17}" font-size="17" font-weight="600" fill="#fff">Verdt å merke seg</text>`);
  d.notes.forEach((t, k) => out.push(`<text x="${P + IP + 4}" y="${y + IP + 50 + k * 24}" font-size="15" fill="#fff">•  ${esc(t)}</text>`));
  y += h + 18;
}
if (d.missing) { out.push(`<text x="${P}" y="${y + 6}" font-size="12" font-style="italic" fill="${C.muted}">${esc(d.missing)}</text>`); y += 22; }
y += 8;
out.push(`<text x="${P}" y="${y + 6}" font-size="12" fill="${C.muted}">Alvøen Innegolf AS</text>`);
out.push(`<text x="${W - P}" y="${y + 6}" text-anchor="end" font-size="12" fill="${C.muted}">Kilde: Alba · Trackman · Albaplay</text>`);
const H = y + 6 + P;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Poppins, 'Segoe UI', Helvetica, Arial, sans-serif">
<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&amp;display=swap');</style>
<rect width="100%" height="100%" fill="${C.cream}"/>
${out.join("\n")}
</svg>
`;
writeFileSync(outPath, svg);
console.log(outPath, Buffer.byteLength(svg));
