import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProductForm, fromProduct, type ProductFormSubmission } from "@/components/ProductForm";
import { deleteProduct, getProduct, updateProduct, type Product } from "@/lib/supabaseQueries";
import { getErrorMessage } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/products/$productId")({
  component: ProductDetail,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const nav = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProduct(productId).then((p) => {
      setProduct(p);
      setLoading(false);
    });
  }, [productId]);

  async function save(v: ProductFormSubmission) {
    try {
      const p = await updateProduct(productId, {
        name: v.name.trim(),
        brand: v.brand.trim() || null,
        category: v.category,
        calories_per_100g: v.calories_per_100g,
        protein_per_100g: v.protein_per_100g,
        carbs_per_100g: v.carbs_per_100g,
        fat_per_100g: v.fat_per_100g,
        notes: v.notes.trim() || null,
      });
      setProduct(p);
      toast.success("Updated");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    }
  }

  async function remove() {
    if (!confirm("Delete this product? It will be removed from any meal templates and logs."))
      return;
    try {
      await deleteProduct(productId);
      toast.success("Deleted");
      nav({ to: "/products" });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e));
    }
  }

  if (loading)
    return (
      <AppShell title="Product">
        <p className="text-muted-foreground">Loading…</p>
      </AppShell>
    );
  if (!product)
    return (
      <AppShell title="Product">
        <p className="text-muted-foreground">Not found.</p>
      </AppShell>
    );

  return (
    <AppShell
      title="Edit product"
      action={
        <button
          onClick={remove}
          className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      }
    >
      <ProductForm
        initial={fromProduct(product)}
        imagePreviewUrl={product.source_image_url}
        onSubmit={save}
        submitLabel="Save changes"
      />
    </AppShell>
  );
}
