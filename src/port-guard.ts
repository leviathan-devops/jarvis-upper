// port-guard.ts — nothing connects to the judge ports, and a mock bind uses
// port 0. The forbidden numbers are built arithmetically so this file's
// source does not contain the decimal literals.

const FORBIDDEN_PORTS = [8_000 + 90, 18_000 + 90] as const;

export function forbiddenPortHits(text: string): string[] {
  const hits: string[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const where = String(i + 1);
    for (const port of FORBIDDEN_PORTS) {
      const re = new RegExp(`(^|[^0-9])${port}([^0-9]|$)`);
      if (re.test(line)) hits.push(`${where}:forbidden-port`);
    }
    if (/\.listen\s*\(/.test(line) && !/\.listen\s*\(\s*0\s*\)/.test(line)) {
      hits.push(`${where}:listen-not-0`);
    }
    if (/\bport\s*:\s*[1-9][0-9]*/.test(line)) hits.push(`${where}:bind-not-0`);
  }
  return hits;
}
