import type { UIConcept } from "../types";

const DEFAULTS: UIConcept = {
  concept_name: "Untitled Concept",
  rationale: "No rationale provided",
  target_audience: "Not specified",
  key_message: "Not specified",
};

const FIELDS = Object.keys(DEFAULTS) as (keyof UIConcept)[];

/**
 * Normalize raw AI concept objects into UI-safe UIConcept[].
 *
 * Handles: missing fields, empty strings, non-string values,
 * nulls, and completely malformed items (silently dropped).
 */
export function normalizeConcepts(raw: unknown[]): UIConcept[] {
  const results: UIConcept[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;

    // Drop items that have zero usable fields
    const hasAny = FIELDS.some(
      (k) => typeof record[k] === "string" && record[k] !== ""
    );
    if (!hasAny) continue;

    const concept: UIConcept = { ...DEFAULTS };
    for (const key of FIELDS) {
      const val = record[key];
      if (typeof val === "string" && val.trim() !== "") {
        concept[key] = val.trim();
      }
    }

    results.push(concept);
  }

  return results;
}
