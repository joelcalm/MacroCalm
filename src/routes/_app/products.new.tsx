import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { ProductForm, emptyForm, type ProductFormSubmission } from "@/components/ProductForm";
import { createProduct } from "@/lib/supabaseQueries";
import { getErrorMessage } from "@/lib/utils";
import { extractNutritionFromImage } from "@/lib/vision/extractNutrition.functions";
import { Camera, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products/new")({
  component: NewProductPage,
});

type Step = "choose" | "manual" | "photo";

function NewProductPage() {
  const [step, setStep] = useState<Step>("choose");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState(emptyForm());
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const extractFn = useServerFn(extractNutritionFromImage);

  useEffect(() => {
    return () => {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image is too large to analyze");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImageUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return previewUrl;
    });
    setStep("photo");
    setAnalyzing(true);

    try {
      const image = await fileToBase64Image(file);
      const extracted = await extractFn({ data: { image } });
      if (extracted) {
        setInitial({
          ...emptyForm(),
          name: extracted.name ?? "",
          brand: extracted.brand ?? "",
          calories_per_100g: extracted.calories_per_100g ?? 0,
          protein_per_100g: extracted.protein_per_100g ?? 0,
          carbs_per_100g: extracted.carbs_per_100g ?? 0,
          fat_per_100g: extracted.fat_per_100g ?? 0,
          category: "other",
          notes: extracted.notes ?? "",
        });
        toast.success("Nutrition extracted - review and save");
      } else {
        toast.message("Couldn't read the label - fill in manually");
      }
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Vision analysis failed"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function save(values: ProductFormSubmission, sourceType: "manual" | "photo") {
    try {
      await createProduct({
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        category: values.category,
        calories_per_100g: values.calories_per_100g,
        protein_per_100g: values.protein_per_100g,
        carbs_per_100g: values.carbs_per_100g,
        fat_per_100g: values.fat_per_100g,
        source_type: sourceType,
        source_image_url: null,
        notes: values.notes.trim() || null,
      });
      toast.success("Product saved");
      nav({ to: "/products" });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Save failed"));
    }
  }

  return (
    <AppShell title="Add product">
      {step === "choose" && (
        <div className="space-y-3">
          <button
            onClick={() => setStep("manual")}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left flex gap-4 items-center hover:border-primary/50"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Pencil className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold">Enter manually</p>
              <p className="text-xs text-muted-foreground">Type the nutrition values yourself.</p>
            </div>
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={analyzing}
            className="w-full rounded-2xl border border-border bg-card p-5 text-left flex gap-4 items-center hover:border-primary/50 disabled:opacity-60"
          >
            <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Camera className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold">{analyzing ? "Analyzing..." : "Take or upload photo"}</p>
              <p className="text-xs text-muted-foreground">Use the label image to fill values.</p>
            </div>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {step === "manual" && (
        <ProductForm onSubmit={(v) => save(v, "manual")} submitLabel="Save product" />
      )}

      {step === "photo" && (
        <div className="space-y-4">
          {analyzing && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm">Reading nutrition label…</p>
            </div>
          )}
          <ProductForm
            key={analyzing ? "analyzing" : "ready"}
            initial={initial}
            imagePreviewUrl={imageUrl}
            onSubmit={(v) => save(v, "photo")}
            submitLabel="Save product"
          />
        </div>
      )}
    </AppShell>
  );
}

async function fileToBase64Image(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });

  const [, data = ""] = dataUrl.split(",");
  return {
    mimeType: file.type || "image/jpeg",
    data,
  };
}
