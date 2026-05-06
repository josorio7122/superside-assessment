import { createFileRoute } from "@tanstack/react-router";
import { BrandDetail } from "../features/brand-detail/BrandDetail";

export const Route = createFileRoute("/brands/$brandId")({
  component: BrandDetailRoute,
});

function BrandDetailRoute() {
  const { brandId } = Route.useParams();
  return <BrandDetail brandId={brandId} />;
}
