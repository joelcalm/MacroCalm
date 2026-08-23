import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExtractedNutrition = {
  name?: string | null;
  brand?: string | null;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  serving_size_g?: number | null;
  serving_basis?: "per_100g" | "per_serving" | "unknown" | null;
  confidence?: "low" | "medium" | "high" | null;
  notes?: string | null;
};

const InputSchema = z
  .object({
    imageUrl: z.string().url().max(2048).optional(),
    image: z
      .object({
        mimeType: z.string().min(1).max(100),
        data: z.string().min(1),
      })
      .optional(),
  })
  .refine((value) => value.imageUrl || value.image, {
    message: "Provide either imageUrl or image data",
  });

const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

const PROMPT = [
  "Read this food product label and return nutrition data as JSON only.",
  "All macro values must be normalized per 100g.",
  "Prefer values explicitly shown per 100g.",
  "If only per-serving values are visible, convert to per 100g only when serving size in grams is visible.",
  "If a value cannot be read or safely converted, return null for that field.",
  "Support English, Spanish, and Catalan labels.",
  "Do not invent name, brand, calories, protein, carbs, or fat.",
  "Use kcal for calories and grams for protein/carbs/fat.",
  'Return exactly this shape: {"name": string|null, "brand": string|null, "calories_per_100g": number|null, "protein_per_100g": number|null, "carbs_per_100g": number|null, "fat_per_100g": number|null, "serving_size_g": number|null, "serving_basis": "per_100g"|"per_serving"|"unknown", "confidence": "low"|"medium"|"high", "notes": string|null}',
].join("\n");

export const extractNutritionFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<ExtractedNutrition | null> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const image = data.image ?? (await fetchImageAsBase64(data.imageUrl!));
    validateImage(image);
    const json = await generateWithGemini(apiKey, image);
    const text = extractText(json);

    if (!text) return null;
    return normalizeNutrition(parseJson(text));
  });

async function fetchImageAsBase64(imageUrl: string) {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image (${imgRes.status})`);
  const mimeType = imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const buf = Buffer.from(await imgRes.arrayBuffer());

  return {
    mimeType,
    data: buf.toString("base64"),
  };
}

function validateImage(image: { mimeType: string; data: string }) {
  if (!image.mimeType.startsWith("image/")) throw new Error("Uploaded file is not an image");

  const sizeBytes = Math.ceil((image.data.length * 3) / 4);
  if (sizeBytes > 10 * 1024 * 1024) throw new Error("Image is too large to analyze");
}

async function generateWithGemini(apiKey: string, image: { mimeType: string; data: string }) {
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: PROMPT },
                  {
                    inline_data: {
                      mime_type: image.mimeType,
                      data: image.data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              response_mime_type: "application/json",
            },
          }),
        },
      );

      if (res.ok) return res.json();

      const text = await res.text();
      console.error("Gemini vision error", res.status, text);

      if (res.status === 429) throw new Error("Gemini rate limit reached. Try again shortly.");

      if (res.status === 503) {
        if (attempt === 0) await delay(800);
        continue;
      }

      throw new Error(`Gemini request failed (${res.status})`);
    }
  }

  throw new Error("Gemini is temporarily overloaded. Please try the photo again in a minute.");
}

function extractText(json: unknown) {
  const payload = json as {
    candidates?: {
      content?: {
        parts?: { text?: string }[];
      };
    }[];
  };

  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join("");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini response did not contain JSON");
    return JSON.parse(match[0]);
  }
}

function normalizeNutrition(value: unknown): ExtractedNutrition | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const nutrition: ExtractedNutrition = {
    name: stringOrNull(raw.name),
    brand: stringOrNull(raw.brand),
    calories_per_100g: numberOrNull(raw.calories_per_100g),
    protein_per_100g: numberOrNull(raw.protein_per_100g),
    carbs_per_100g: numberOrNull(raw.carbs_per_100g),
    fat_per_100g: numberOrNull(raw.fat_per_100g),
    serving_size_g: numberOrNull(raw.serving_size_g),
    serving_basis: servingBasisOrUnknown(raw.serving_basis),
    confidence: confidenceOrLow(raw.confidence),
    notes: stringOrNull(raw.notes),
  };

  const hasUsefulData = [
    nutrition.name,
    nutrition.brand,
    nutrition.calories_per_100g,
    nutrition.protein_per_100g,
    nutrition.carbs_per_100g,
    nutrition.fat_per_100g,
  ].some((item) => item !== null && item !== undefined);

  return hasUsefulData ? nutrition : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) && numberValue >= 0 ? round(numberValue) : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function servingBasisOrUnknown(value: unknown): ExtractedNutrition["serving_basis"] {
  return value === "per_100g" || value === "per_serving" || value === "unknown" ? value : "unknown";
}

function confidenceOrLow(value: unknown): ExtractedNutrition["confidence"] {
  return value === "low" || value === "medium" || value === "high" ? value : "low";
}
