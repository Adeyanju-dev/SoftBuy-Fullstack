import { resolveMediaUrl } from "./media";

function getGalleryImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return "";
  }

  const primaryImage = images.find(
    (image) => image?.is_primary || image?.primary || image?.isPrimary
  );

  return (
    resolveMediaUrl(primaryImage?.image_url) ||
    resolveMediaUrl(primaryImage?.image) ||
    resolveMediaUrl(images[0]?.image_url) ||
    resolveMediaUrl(images[0]?.image)
  );
}

export function getProductImage(product) {
  return (
    getGalleryImageUrl(product?.images) ||
    resolveMediaUrl(product?.primary_image) ||
    resolveMediaUrl(product?.primary_image_url) ||
    resolveMediaUrl(product?.image_url) ||
    resolveMediaUrl(product?.image) ||
    resolveMediaUrl(product?.product_image)
  );
}
