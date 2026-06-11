// Words checked as substrings — no innocent word contains these
const SUBSTR_BLOCKED = [
  // English
  "fuck", "shit", "cunt", "bitch", "nigger", "nigga", "retard",
  // Bosnian / Croatian / Serbian
  "kurva", "pička", "picka", "pizda",
  "jebem", "jebo", "jebati", "jebiga", "jebeni", "zajebati",
  "šupak", "supak", "šupčina",
];

// Words checked as whole tokens (split on non-letters) to avoid false positives
const TOKEN_BLOCKED = new Set([
  // English
  "ass", "arse", "dick", "cock", "prick", "pussy", "bastard", "slut", "whore",
  // Bosnian / Croatian / Serbian
  "kurac", "govno", "seronja", "peder", "suka", "budala",
]);

export function containsProfanity(name: string): boolean {
  const lower = name.toLowerCase();
  if (SUBSTR_BLOCKED.some(w => lower.includes(w))) return true;
  const tokens = lower.split(/[^a-zšđžćč]+/).filter(Boolean);
  return tokens.some(t => TOKEN_BLOCKED.has(t));
}
