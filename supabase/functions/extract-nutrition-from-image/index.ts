type ExtractedNutrition = {
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const model = "gemini-2.5-flash-lite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return json({ error: "Missing GEMINI_API_KEY" }, 500);
  }

  try {
    const { imageUrl } = (await req.json()) as { imageUrl?: unknown };

    if (typeof imageUrl !== "string" || !isHttpUrl(imageUrl)) {
      return json({ error: "imageUrl must be an http(s) URL" }, 400);
    }

    const image = await fetchImageAsBase64(imageUrl);
    const nutrition = await extractWithGemini(apiKey, image);

    return json(nutrition);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nutrition extraction failed";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function fetchImageAsBase64(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Could not fetch label image");
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 10 * 1024 * 1024) {
    throw new Error("Image is too large to analyze");
  }

  return {
    mimeType,
    data: encodeBase64(bytes),
  };
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractWithGemini(
  apiKey: string,
  image: { mimeType: string; data: string },
): Promise<ExtractedNutrition | null> {
  const prompt = [
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
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

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vision provider failed: ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text)
    .filter(Boolean)
    .join("");

  if (!text) {
    return null;
  }

  return normalizeNutrition(parseJson(text));
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Vision response did not contain JSON");
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
