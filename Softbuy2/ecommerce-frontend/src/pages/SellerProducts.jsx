import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, ImagePlus, PencilLine, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import SellerWorkspaceNav from "../components/SellerWorkspaceNav";
import KeyValueEditor from "../components/KeyValueEditor";
import { useAuth } from "../context/AuthContext";
import { capitalizeWords, formatCurrency, formatDateTime } from "../lib/formatters";
import { resolveMediaUrl } from "../lib/media";
import { getProductImage } from "../lib/productMedia";
import { cleanObject, entriesToObject, objectToEntries, readObject } from "../lib/objectFields";
import softbuyApi from "../lib/softbuyApi";

const attributeKeys = ["color", "size", "brand", "material", "model"];
const dimensionKeys = ["length", "width", "height", "unit"];

const initialForm = {
  title: "",
  description: "",
  category: "",
  price: "",
  compare_price: "",
  currency: "NGN",
  sku: "",
  stock: "0",
  status: "published",
  color: "",
  size: "",
  brand: "",
  material: "",
  model: "",
  attribute_rows: [],
  length: "",
  width: "",
  height: "",
  dimension_unit: "cm",
  dimension_rows: [],
  weight: "",
  weight_unit: "kg",
  seo_title: "",
  seo_description: "",
  tag_ids: [],
  image_alt_text: "",
};

function getProductId(product) {
  const productId = Number(product?.id || product?.product_id || product?.pk || 0);
  return productId || null;
}

function getProductCategoryValue(product, categories) {
  const directCategoryId = Number(
    product?.category_id || product?.category?.id || product?.category || 0
  );

  if (directCategoryId) {
    return String(directCategoryId);
  }

  const categoryLookup = [
    product?.category_name,
    product?.category?.name,
    typeof product?.category === "string" ? product.category : "",
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!categoryLookup.length) {
    return "";
  }

  const matchedCategory = categories.find((category) => {
    const candidateValues = [category?.name, category?.slug]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    return candidateValues.some((value) => categoryLookup.includes(value));
  });

  return matchedCategory?.id ? String(matchedCategory.id) : "";
}

function getProductTagIds(product, tags) {
  const directTagIds = [
    ...(Array.isArray(product?.tag_ids) ? product.tag_ids : []),
    ...(Array.isArray(product?.tags)
      ? product.tags.map((tag) => (tag && typeof tag === "object" ? tag.id : tag))
      : []),
  ]
    .map((value) => Number(value))
    .filter((value) => value > 0);

  if (directTagIds.length) {
    return [...new Set(directTagIds)];
  }

  const tagNames = [
    ...(Array.isArray(product?.tag_names) ? product.tag_names : []),
    ...(Array.isArray(product?.tags)
      ? product.tags.map((tag) => (tag && typeof tag === "object" ? tag.name || tag.slug : tag))
      : []),
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  if (!tagNames.length) {
    return [];
  }

  return tags
    .filter((tag) => {
      const candidateValues = [tag?.name, tag?.slug]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);

      return candidateValues.some((value) => tagNames.includes(value));
    })
    .map((tag) => Number(tag.id))
    .filter((value) => value > 0);
}

function normalizeImageList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return softbuyApi.extractResults(payload);
}

function getApiErrorMessage(error, fallbackMessage) {
  const details = error?.response?.data;

  if (typeof details === "string" && details.trim()) {
    return details;
  }

  if (typeof details?.detail === "string" && details.detail.trim()) {
    return details.detail;
  }

  if (typeof details?.error === "string" && details.error.trim()) {
    return details.error;
  }

  if (typeof details?.message === "string" && details.message.trim()) {
    return details.message;
  }

  if (Array.isArray(details)) {
    const firstMessage = details.find(
      (value) => typeof value === "string" && value.trim()
    );
    if (firstMessage) {
      return firstMessage;
    }
  }

  if (details && typeof details === "object") {
    const firstFieldValue = Object.values(details)[0];

    if (Array.isArray(firstFieldValue) && firstFieldValue[0]) {
      return String(firstFieldValue[0]);
    }

    if (typeof firstFieldValue === "string" && firstFieldValue.trim()) {
      return firstFieldValue;
    }
  }

  return error?.message || fallbackMessage;
}

function mapProductToForm(product, tags, categories) {
  const attributes = readObject(product?.attributes);
  const dimensions = readObject(product?.dimensions);

  return {
    title: product?.title || "",
    description: product?.description || "",
    category: getProductCategoryValue(product, categories),
    price: product?.price || "",
    compare_price: product?.compare_price || "",
    currency: product?.currency || "NGN",
    sku: product?.sku || "",
    stock: String(product?.stock ?? 0),
    status: product?.status || initialForm.status,
    color: attributes.color || "",
    size: attributes.size || "",
    brand: attributes.brand || "",
    material: attributes.material || "",
    model: attributes.model || "",
    attribute_rows: objectToEntries(attributes, attributeKeys),
    length: dimensions.length || "",
    width: dimensions.width || "",
    height: dimensions.height || "",
    dimension_unit: dimensions.unit || "cm",
    dimension_rows: objectToEntries(dimensions, dimensionKeys),
    weight: product?.weight || "",
    weight_unit: product?.weight_unit || "kg",
    seo_title: product?.seo_title || "",
    seo_description: product?.seo_description || "",
    tag_ids: getProductTagIds(product, tags),
    image_alt_text:
      product?.images?.find((image) => image.is_primary)?.alt_text ||
      product?.images?.[0]?.alt_text ||
      "",
  };
}

function isOwnedProduct(product, sellerProfile, user) {
  if (!product) {
    return false;
  }

  if (sellerProfile?.id && Number(product.seller) === Number(sellerProfile.id)) {
    return true;
  }

  if (sellerProfile?.user && Number(product.seller_id) === Number(sellerProfile.user)) {
    return true;
  }

  if (
    sellerProfile?.business_name &&
    product.seller_business_name === sellerProfile.business_name
  ) {
    return true;
  }

  if (user?.seller_profile?.business_name) {
    return product.seller_business_name === user.seller_profile.business_name;
  }

  return false;
}

export default function SellerProducts() {
  const { user } = useAuth();
  const formRef = useRef(null);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [products, setProducts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingSlug, setEditingSlug] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [formOpen, setFormOpen] = useState(true);
  const [form, setForm] = useState(initialForm);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [productImages, setProductImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      softbuyApi.getSellerProfile(),
      softbuyApi.listAllCategories(),
      softbuyApi.listAllTags(),
      softbuyApi.listAllSellerProducts(),
    ]);

    const nextWarnings = [];

    if (results[0].status === "rejected") {
      nextWarnings.push("Seller profile could not be loaded.");
    }

    if (results[1].status === "rejected") {
      nextWarnings.push("Categories are unavailable right now.");
    }

    if (results[2].status === "rejected") {
      nextWarnings.push("Tags are unavailable right now.");
    }

    if (results[3].status === "rejected") {
      nextWarnings.push("Product catalog could not be loaded.");
    }

    setSellerProfile(results[0].status === "fulfilled" ? results[0].value.data : null);
    setCategories(
      results[1].status === "fulfilled" ? softbuyApi.extractResults(results[1].value.data) : []
    );
    setTags(results[2].status === "fulfilled" ? softbuyApi.extractResults(results[2].value.data) : []);
    setProducts(
      results[3].status === "fulfilled" ? softbuyApi.extractResults(results[3].value.data) : []
    );
    setWarnings(nextWarnings);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const sellerProducts = useMemo(
    () => products.filter((product) => isOwnedProduct(product, sellerProfile, user)),
    [products, sellerProfile, user]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleTagToggle = (tagId) => {
    setForm((current) => ({
      ...current,
      tag_ids: current.tag_ids.includes(tagId)
        ? current.tag_ids.filter((value) => value !== tagId)
        : [...current.tag_ids, tagId],
    }));
  };

  const focusForm = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingSlug("");
    setEditingProductId(null);
    setError("");
    setSelectedImageFile(null);
    setImagePreview("");
    setProductImages([]);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewTagName("");
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
    focusForm();
  };

  const loadProductIntoEditor = useCallback(
    async (productOrSlug) => {
      const providedProduct =
        productOrSlug && typeof productOrSlug === "object" ? productOrSlug : null;
      const fallbackSlug = typeof productOrSlug === "string" ? productOrSlug : productOrSlug?.slug;

      if (!providedProduct && !fallbackSlug) {
        throw new Error("This product could not be prepared for editing.");
      }

      let nextProduct = providedProduct;

      if (!nextProduct) {
        const productResponse = await softbuyApi.getProduct(fallbackSlug, { auth: true });
        nextProduct = productResponse.data;
      }

      const nextSlug = nextProduct?.slug || fallbackSlug || "";
      const nextProductId = getProductId(nextProduct);
      let nextImages = Array.isArray(nextProduct?.images) ? nextProduct.images : [];

      if (nextProductId) {
        try {
          const imagesResponse = await softbuyApi.listProductImages(nextProductId);
          const listedImages = normalizeImageList(imagesResponse.data);

          if (listedImages.length || !nextImages.length) {
            nextImages = listedImages;
          }
        } catch (imageError) {
          console.warn("Failed to refresh product images:", imageError);
        }
      }

      const productWithImages = {
        ...nextProduct,
        images: nextImages,
      };

      setEditingSlug(nextSlug);
      setEditingProductId(nextProductId);
      setForm(mapProductToForm(productWithImages, tags, categories));
      setProductImages(nextImages);
      setSelectedImageFile(null);
      setImagePreview("");
      setFormOpen(true);

      return {
        product: productWithImages,
        slug: nextSlug,
        productId: nextProductId,
      };
    },
    [categories, tags]
  );

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedImageFile(null);
      setImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImageFile(file);
    setImagePreview(previewUrl);
  };

  const uploadSelectedImage = useCallback(
    async (productId, existingImages) => {
      if (!selectedImageFile) {
        return;
      }

      if (!productId) {
        throw new Error("Save the product first so the backend can assign it an ID.");
      }

      const imageFormData = new FormData();
      imageFormData.append("image", selectedImageFile);
      imageFormData.append("alt_text", form.image_alt_text.trim() || form.title.trim());
      imageFormData.append("order", String(existingImages.length));
      imageFormData.append(
        "is_primary",
        existingImages.some((image) => image.is_primary) ? "false" : "true"
      );

      await softbuyApi.uploadProductImage(productId, imageFormData);
    },
    [form.image_alt_text, form.title, selectedImageFile]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    let savedProduct = null;
    let nextSlug = editingSlug;
    let nextProductId = editingProductId;

    try {
      if (!form.category) {
        throw new Error("Please select a category before saving this product.");
      }

      const payload = {
        category: Number(form.category),
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.price,
        compare_price: form.compare_price || null,
        currency: form.currency,
        sku: form.sku.trim(),
        stock: Number(form.stock || 0),
        status: form.status,
        attributes: cleanObject({
          color: form.color.trim(),
          size: form.size.trim(),
          brand: form.brand.trim(),
          material: form.material.trim(),
          model: form.model.trim(),
          ...entriesToObject(form.attribute_rows),
        }),
        dimensions: cleanObject({
          length: form.length.trim(),
          width: form.width.trim(),
          height: form.height.trim(),
          unit: form.dimension_unit.trim(),
          ...entriesToObject(form.dimension_rows),
        }),
        weight: form.weight || null,
        weight_unit: form.weight_unit,
        seo_title: form.seo_title.trim(),
        seo_description: form.seo_description.trim(),
        tag_ids: form.tag_ids.map((value) => Number(value)),
      };

      const response = editingSlug
        ? await softbuyApi.updateProduct(editingSlug, payload)
        : await softbuyApi.createProduct(payload);

      savedProduct = response.data;
      nextSlug = savedProduct?.slug || editingSlug;
      nextProductId = getProductId(savedProduct) || editingProductId;

      if ((selectedImageFile || !nextProductId || !nextSlug) && nextSlug) {
        const refreshedProductResponse = await softbuyApi.getProduct(nextSlug, { auth: true });
        savedProduct = refreshedProductResponse.data;
        nextSlug = savedProduct?.slug || nextSlug;
        nextProductId = getProductId(savedProduct) || nextProductId;
      }

      if (selectedImageFile) {
        await uploadSelectedImage(nextProductId, productImages);
      }

      if (savedProduct || nextSlug) {
        await loadProductIntoEditor(savedProduct || nextSlug);
      } else {
        resetForm();
        setFormOpen(true);
      }

      await loadPageData();
      toast.success(
        selectedImageFile
          ? editingSlug
            ? "Product updated and image uploaded"
            : "Product created and image uploaded"
          : editingSlug
          ? "Product updated"
          : "Product created"
      );
    } catch (saveError) {
      setError(
        savedProduct
          ? `Product saved, but ${saveError.message || "the image upload could not finish."}`
          : saveError.message || "Could not save product."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (slug) => {
    setError("");

    try {
      await loadProductIntoEditor(slug);
      focusForm();
    } catch (loadError) {
      setError(loadError.message || "Could not load this product for editing.");
    }
  };

  const handleDelete = async (slug) => {
    const confirmed = window.confirm(
      "Delete this product from the catalog? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await softbuyApi.deleteProduct(slug);
      toast.success("Product deleted");

      if (editingSlug === slug) {
        resetForm();
      }

      await loadPageData();
    } catch (deleteError) {
      setError(deleteError.response?.data?.error || "Could not delete this product.");
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!editingProductId) {
      return;
    }

    try {
      await softbuyApi.deleteProductImage(editingProductId, imageId);
      setProductImages((current) => current.filter((image) => Number(image.id) !== Number(imageId)));
      toast.success("Product image removed");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this image.");
    }
  };

  const handleUploadSelectedImage = async () => {
    if (!editingProductId || !selectedImageFile) {
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      await uploadSelectedImage(editingProductId, productImages);
      await loadProductIntoEditor(editingSlug);
      await loadPageData();
      toast.success("Product image uploaded");
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload this image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();

    if (!name) {
      setError("Enter a category name before creating one.");
      return;
    }

    setCreatingCategory(true);
    setError("");

    try {
      const response = await softbuyApi.createCategory({
        name,
        description: newCategoryDescription.trim(),
        is_active: true,
      });
      const createdCategory = response.data;

      setCategories((current) =>
        [...current, createdCategory].sort((left, right) =>
          String(left?.name || "").localeCompare(String(right?.name || ""))
        )
      );
      setForm((current) => ({
        ...current,
        category: createdCategory?.id ? String(createdCategory.id) : current.category,
      }));
      setNewCategoryName("");
      setNewCategoryDescription("");
      toast.success("Category created");
    } catch (categoryError) {
      setError(getApiErrorMessage(categoryError, "Could not create this category."));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();

    if (!name) {
      setError("Enter a tag name before creating one.");
      return;
    }

    setCreatingTag(true);
    setError("");

    try {
      const response = await softbuyApi.createTag({ name });
      const createdTag = response.data;
      const nextTagId = Number(createdTag?.id || 0);

      setTags((current) =>
        [...current, createdTag].sort((left, right) =>
          String(left?.name || "").localeCompare(String(right?.name || ""))
        )
      );
      if (nextTagId) {
        setForm((current) => ({
          ...current,
          tag_ids: current.tag_ids.includes(nextTagId)
            ? current.tag_ids
            : [...current.tag_ids, nextTagId],
        }));
      }
      setNewTagName("");
      toast.success("Tag created");
    } catch (tagError) {
      setError(getApiErrorMessage(tagError, "Could not create this tag."));
    } finally {
      setCreatingTag(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <SellerWorkspaceNav
          title="Products"
          description="Create listings, upload images, and keep your catalog organized."
          action={
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus className="h-4 w-4" />
              New product
            </button>
          }
        />

        {warnings.length ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-100">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="h-96 animate-pulse rounded-[2rem] border border-white/10 bg-white/5" />
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div ref={formRef}>
              {formOpen ? (
                <form
                  onSubmit={handleSubmit}
                  className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
                    <div>
                      <h2 className="text-2xl font-semibold text-white">
                        {editingSlug ? "Edit product" : "Create product"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Fill in your product details and add an image shoppers can recognize fast.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editingSlug ? (
                        <button
                          type="button"
                          onClick={openCreateForm}
                          className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                        >
                          Start new product
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setFormOpen(false)}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm text-slate-300">Product title</span>
                      <input
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <div className="space-y-3">
                      <label className="space-y-2">
                        <span className="text-sm text-slate-300">Category</span>
                        <select
                          name="category"
                          value={form.category}
                          onChange={handleChange}
                          className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                        >
                          <option value="">Select category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">Need a new category?</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Create it here and we will select it for this product automatically.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={creatingCategory}
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Plus className="h-4 w-4" />
                            {creatingCategory ? "Creating..." : "Create category"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            placeholder="Category name"
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                          />
                          <input
                            type="text"
                            value={newCategoryDescription}
                            onChange={(event) => setNewCategoryDescription(event.target.value)}
                            placeholder="Short description"
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Status</span>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm text-slate-300">Description</span>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={5}
                        className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Price</span>
                      <input
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                        placeholder="24999.99"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Compare price</span>
                      <input
                        name="compare_price"
                        value={form.compare_price}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                        placeholder="29999.99"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Currency</span>
                      <select
                        name="currency"
                        value={form.currency}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      >
                        <option value="NGN">NGN</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">SKU</span>
                      <input
                        name="sku"
                        value={form.sku}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Stock</span>
                      <input
                        name="stock"
                        type="number"
                        min="0"
                        value={form.stock}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Weight</span>
                      <input
                        name="weight"
                        value={form.weight}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                        placeholder="1.2"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm text-slate-300">Weight unit</span>
                      <select
                        name="weight_unit"
                        value={form.weight_unit}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm text-slate-300">SEO title</span>
                      <input
                        name="seo_title"
                        value={form.seo_title}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>

                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm text-slate-300">SEO description</span>
                      <textarea
                        name="seo_description"
                        value={form.seo_description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-3xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </label>
                  </div>

                  <div className="mt-8 grid gap-6 xl:grid-cols-2">
                    <div className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-900/40 p-5">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Product details</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Add the details customers usually look for first.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Color</span>
                          <input
                            name="color"
                            value={form.color}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Size</span>
                          <input
                            name="size"
                            value={form.size}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Brand</span>
                          <input
                            name="brand"
                            value={form.brand}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Material</span>
                          <input
                            name="material"
                            value={form.material}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2 md:col-span-2">
                          <span className="text-sm text-slate-300">Model</span>
                          <input
                            name="model"
                            value={form.model}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                      </div>

                      <KeyValueEditor
                        label="Additional details"
                        helperText="Add any other product attributes you want shoppers to see."
                        entries={form.attribute_rows}
                        onChange={(entries) => setForm((current) => ({ ...current, attribute_rows: entries }))}
                        keyPlaceholder="Field name"
                        valuePlaceholder="Field value"
                      />
                    </div>

                    <div className="space-y-5 rounded-[2rem] border border-white/10 bg-slate-900/40 p-5">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Dimensions and media</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Keep sizing clear and upload a strong first image for the listing.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Length</span>
                          <input
                            name="length"
                            value={form.length}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Width</span>
                          <input
                            name="width"
                            value={form.width}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Height</span>
                          <input
                            name="height"
                            value={form.height}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-slate-300">Dimension unit</span>
                          <select
                            name="dimension_unit"
                            value={form.dimension_unit}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none"
                          >
                            <option value="cm">cm</option>
                            <option value="mm">mm</option>
                            <option value="m">m</option>
                            <option value="in">in</option>
                          </select>
                        </label>
                      </div>

                      <KeyValueEditor
                        label="Extra dimensions"
                        helperText="Add any extra size or fit notes you want to save."
                        entries={form.dimension_rows}
                        onChange={(entries) => setForm((current) => ({ ...current, dimension_rows: entries }))}
                        keyPlaceholder="Field name"
                        valuePlaceholder="Field value"
                      />

                      <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">Product image</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Choose an image now, then save the product. Once the product exists you can upload extra images straight from this editor.
                            </p>
                          </div>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5">
                            <UploadCloud className="h-4 w-4" />
                            Choose image
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileChange}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <label className="mt-4 block space-y-2">
                          <span className="text-sm text-slate-300">Image alt text</span>
                          <input
                            name="image_alt_text"
                            value={form.image_alt_text}
                            onChange={handleChange}
                            className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                            placeholder="Describe the image briefly"
                          />
                        </label>

                        {imagePreview ? (
                          <div className="mt-4 space-y-3">
                            <img
                              src={imagePreview}
                              alt={form.image_alt_text || "Selected product preview"}
                              className="h-48 w-full rounded-3xl object-cover"
                            />
                            <div className="flex flex-wrap gap-3">
                              {editingProductId ? (
                                <button
                                  type="button"
                                  onClick={handleUploadSelectedImage}
                                  disabled={uploadingImage}
                                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <UploadCloud className="h-4 w-4" />
                                  {uploadingImage ? "Uploading image..." : "Upload selected image"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedImageFile(null);
                                  setImagePreview("");
                                }}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200"
                              >
                                <X className="h-4 w-4" />
                                Remove selected image
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                    <p className="font-semibold text-white">Tags</p>
                    <div className="mt-4 rounded-3xl border border-dashed border-white/10 bg-slate-950/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Create a tag for this product</p>
                          <p className="mt-1 text-xs text-slate-500">
                            New tags are added to the selector and attached to this product right away.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={creatingTag}
                          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus className="h-4 w-4" />
                          {creatingTag ? "Creating..." : "Create tag"}
                        </button>
                      </div>

                      <input
                        type="text"
                        value={newTagName}
                        onChange={(event) => setNewTagName(event.target.value)}
                        placeholder="Tag name"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const active = form.tag_ids.includes(Number(tag.id));

                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleTagToggle(Number(tag.id))}
                            className={`rounded-full px-4 py-2 text-sm transition ${
                              active
                                ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
                                : "border border-white/10 bg-white/5 text-slate-300"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                      {!tags.length ? (
                        <p className="text-sm text-slate-400">No tags available right now.</p>
                      ) : null}
                    </div>
                  </div>

                  {editingProductId && productImages.length ? (
                    <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/50 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">Current images</p>
                        <span className="text-xs text-slate-500">{productImages.length} uploaded</span>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {productImages.map((image) => {
                          const imageUrl = resolveMediaUrl(image.image_url || image.image);
                          return (
                            <div key={image.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-3">
                              <img
                                src={imageUrl}
                                alt={image.alt_text || form.title || "Product image"}
                                className="h-40 w-full rounded-2xl object-cover"
                              />
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm text-white">{image.alt_text || "Product image"}</p>
                                  <p className="text-xs text-slate-500">
                                    {image.is_primary ? "Primary image" : "Gallery image"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(image.id)}
                                  className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving
                      ? "Saving..."
                      : selectedImageFile && editingSlug
                      ? "Save changes and upload image"
                      : selectedImageFile
                      ? "Create product and upload image"
                      : editingSlug
                      ? "Save product changes"
                      : "Create product"}
                  </button>
                </form>
              ) : (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-10 text-center backdrop-blur-xl">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-200">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-white">Ready to add a new product?</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Open the listing form to create a new product or switch into edit mode from your catalog.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-6 py-3 font-semibold text-slate-950"
                  >
                    <Plus className="h-4 w-4" />
                    Open product form
                  </button>
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-2xl font-semibold text-white">Your products</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {sellerProducts.length} product{sellerProducts.length === 1 ? "" : "s"} in your catalog.
                </p>
              </div>

              <div className="space-y-4">
                {sellerProducts.map((product) => (
                  <article
                    key={product.slug}
                    className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
                  >
                    <div className="flex gap-4">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-slate-900/70">
                        {getProductImage(product) ? (
                          <img
                            src={getProductImage(product)}
                            alt={product.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            No image
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{product.title}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {formatCurrency(product.price, product.currency || "NGN")}
                            </p>
                            <p className="mt-2 text-xs text-slate-500">
                              {capitalizeWords(product.status)} | Stock {product.stock} | Updated{" "}
                              {formatDateTime(product.updated_at)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                            {product.slug}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/products/${product.slug}`}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200"
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleEdit(product.slug)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs text-slate-200"
                      >
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.slug)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-200"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}

                {!sellerProducts.length ? (
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-sm text-slate-400">
                    No products found for this seller account yet. Create your first listing to get started.
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
