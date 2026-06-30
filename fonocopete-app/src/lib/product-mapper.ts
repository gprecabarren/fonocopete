import type { Product } from "./types";

type ProductRow = {
  id: string;
  name: string;
  category_id: Product["category"];
  secondary_category_id?: Product["secondaryCategory"];
  price: number;
  original_price: number | null;
  beer_format: Product["beerFormat"];
  image_url: string | null;
  volume: string | null;
  stock: Product["stock"];
  featured: boolean | null;
};

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category_id,
    secondaryCategory: row.secondary_category_id || null,
    price: row.price,
    originalPrice: row.original_price,
    beerFormat: row.beer_format,
    imageUrl: row.image_url || "",
    volume: row.volume || "",
    stock: row.stock,
    featured: Boolean(row.featured),
  };
}

export function mapProductToRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category_id: product.category,
    secondary_category_id: product.secondaryCategory || null,
    price: product.price,
    original_price: product.originalPrice || null,
    beer_format: product.category === "cervezas" || product.secondaryCategory === "cervezas" ? product.beerFormat || null : null,
    image_url: product.imageUrl,
    volume: product.volume,
    stock: product.stock,
    featured: Boolean(product.featured),
  };
}
