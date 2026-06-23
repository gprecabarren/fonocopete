import type { Product } from "./types";

type ProductRow = {
  id: string;
  name: string;
  category_id: Product["category"];
  price: number;
  image_url: string | null;
  volume: string | null;
  description: string | null;
  stock: Product["stock"];
  featured: boolean | null;
};

export function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category_id,
    price: row.price,
    imageUrl: row.image_url || "",
    volume: row.volume || "",
    description: row.description || "",
    stock: row.stock,
    featured: Boolean(row.featured),
  };
}

export function mapProductToRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category_id: product.category,
    price: product.price,
    image_url: product.imageUrl,
    volume: product.volume,
    description: product.description,
    stock: product.stock,
    featured: Boolean(product.featured),
  };
}
