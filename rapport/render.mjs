// Lager ukerapporten som PNG og PDF i appens design.
// Bruk: node rapport/render.mjs data.json utmappe
// data.json: { title, subtitle, sections:[{title, columns:[...], rows:[[...]], note?}], notes:[...], missing? }
import { readFileSync, mkdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // forhåndsinstallert globalt

const here = dirname(fileURLToPath(import.meta.url));
const [dataPath, outDir = "."] = process.argv.slice(2);
const d = JSON.parse(readFileSync(dataPath, "utf8"));
const logo = readFileSync(join(here, "logo.png")).toString("base64");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const section = (s) => `
  <section class="card">
    <h2>${esc(s.title)}</h2>
    <table>
      <thead><tr>${s.columns.map((c, i) => `<th class="${i ? "num" : ""}">${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${s.rows.map((r) => `<tr>${r.map((v, i) => `<td class="${i ? "num" : "lbl"}${i === 1 && s.columns.length > 2 ? " now" : ""}">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
  </section>`;

const html = `<!doctype html><html lang="no"><head><meta charset="utf-8">
<style>
  :root { --navy:#284659; --sage:#A4BFA8; --cream:#F2F2EB; --forest:#19261C; --gold:#BF913B; --ink:#1F3747; --muted:#5B6B75; --line:#E3E4DC; --soft:#E4ECE5; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--cream); color:var(--ink); font-family:Poppins, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .wrap { width:760px; padding:32px 32px 28px; display:flex; flex-direction:column; gap:18px; }
  header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
  header img { height:54px; }
  .kicker { font-size:13px; font-weight:600; letter-spacing:.12em; text-transform:uppercase; color:var(--gold); text-align:right; }
  h1 { margin:2px 0 0; font-size:30px; font-weight:600; color:var(--navy); line-height:1.1; letter-spacing:-.01em; }
  .sub { color:var(--muted); font-size:15px; margin-top:4px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 20px 14px; }
  h2 { margin:0 0 10px; font-size:17px; font-weight:600; color:var(--navy); display:flex; align-items:center; gap:10px; }
  h2::before { content:""; width:6px; height:18px; border-radius:3px; background:var(--sage); }
  table { width:100%; border-collapse:collapse; font-size:15px; table-layout:fixed; }
  th:first-child, td:first-child { width:34%; }
  th { text-align:left; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); padding:6px 8px; border-bottom:2px solid var(--line); }
  td { padding:9px 8px; border-bottom:1px solid var(--line); }
  tr:last-child td { border-bottom:0; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  td.lbl { font-weight:500; }
  td.now { font-weight:700; color:var(--navy); background:var(--soft); }
  .note { margin:8px 0 0; font-size:13px; color:var(--muted); }
  .notes { background:var(--navy); color:#fff; border-radius:16px; padding:16px 20px; }
  .notes h2 { color:#fff; } .notes h2::before { background:var(--gold); }
  .notes ul { margin:0; padding-left:20px; font-size:15px; line-height:1.5; }
  .missing { font-size:12px; color:var(--muted); font-style:italic; }
  footer { font-size:12px; color:var(--muted); display:flex; justify-content:space-between; }
</style></head><body><div class="wrap">
  <header><img src="data:image/png;base64,${logo}" alt=""><div><div class="kicker">Ukerapport</div></div></header>
  <div><h1>${esc(d.title)}</h1>${d.subtitle ? `<div class="sub">${esc(d.subtitle)}</div>` : ""}</div>
  ${(d.sections || []).map(section).join("")}
  ${d.notes?.length ? `<section class="notes"><h2>Verdt å merke seg</h2><ul>${d.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
  ${d.missing ? `<p class="missing">${esc(d.missing)}</p>` : ""}
  <footer><span>Alvøen Innegolf AS</span><span>Kilde: Alba · Trackman · Albaplay</span></footer>
</div></body></html>`;

mkdirSync(outDir, { recursive: true });
const base = d.file || "ukerapport";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 400 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
const el = await page.$(".wrap");
await el.screenshot({ path: join(outDir, `${base}.png`) });
const h = await page.evaluate(() => document.querySelector(".wrap").getBoundingClientRect().height);
await page.pdf({ path: join(outDir, `${base}.pdf`), width: "760px", height: `${Math.ceil(h) + 2}px`, printBackground: true, pageRanges: "1" });
await browser.close();
// Krymp PNG-en (få farger holder for dette designet) så den er rask å laste opp.
try { execFileSync("convert", [join(outDir, `${base}.png`), "-colors", "48", "-strip", join(outDir, `${base}.png`)]); } catch { /* ImageMagick mangler – beholder originalen */ }
for (const f of [`${base}.png`, `${base}.pdf`]) console.log(join(outDir, f), statSync(join(outDir, f)).size);
