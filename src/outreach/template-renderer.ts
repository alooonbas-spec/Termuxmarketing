const ALLOWED = new Set(["firstName", "displayName", "username", "platform", "profileUrl"]);

export function validateTemplate(template: string): string[] {
  const variables = [...template.matchAll(/{{\s*([a-zA-Z][a-zA-Z0-9]*)\s*}}/g)].map((match) => match[1]!);
  const unknown = [...new Set(variables.filter((variable) => !ALLOWED.has(variable)))];
  if (unknown.length) throw new Error(`Unknown template variables: ${unknown.join(", ")}`);
  if (template.length > 4000) throw new Error("Template exceeds 4000 characters");
  return [...new Set(variables)];
}

export function renderTemplate(template: string, data: Record<string, string | undefined>): string {
  validateTemplate(template);
  return template.replace(/{{\s*([a-zA-Z][a-zA-Z0-9]*)\s*}}/g, (_match, variable: string) => data[variable] ?? "");
}

export function chooseVariant(variants: string[], stableKey: string): number {
  if (!variants.length) throw new Error("At least one variant is required");
  let hash = 0;
  for (const char of stableKey) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % variants.length;
}
