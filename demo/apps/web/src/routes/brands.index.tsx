import { createFileRoute } from "@tanstack/react-router";
import { BrandsList } from "../features/brands/BrandsList";

export const Route = createFileRoute("/brands/")({
  component: BrandsList,
});
