const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function file(merchantId) {
  return path.join(DATA_DIR, `leads_${merchantId}.json`);
}

function loadLeads(merchantId) {
  if (!merchantId) return [];
  const f = file(merchantId);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, "utf8")) || []; } catch { return []; }
}

function addLead(merchantId, lead) {
  if (!merchantId || !lead || !lead.email) return null;
  ensureDir();
  const list = loadLeads(merchantId);
  // De-dupe by email + source — same person from same source isn't duplicated
  const exists = list.find(
    (x) => x.email.toLowerCase() === lead.email.toLowerCase() && x.source === lead.source
  );
  if (exists) {
    // Update the existing entry's timestamp + prize if newer
    exists.timestamp = new Date().toISOString();
    if (lead.prize) exists.prize = lead.prize;
  } else {
    list.unshift({
      email: lead.email,
      source: lead.source || "unknown",
      prize: lead.prize || null,
      timestamp: new Date().toISOString(),
      userAgent: lead.userAgent || null,
    });
  }
  // Cap at 5000 to prevent runaway growth
  fs.writeFileSync(file(merchantId), JSON.stringify(list.slice(0, 5000), null, 2));
  return list[0];
}

function toCSV(leads) {
  const headers = ["email", "source", "prize", "timestamp"];
  const rows = leads.map((l) =>
    headers.map((h) => `"${String(l[h] ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

module.exports = { loadLeads, addLead, toCSV };
