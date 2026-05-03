import { createFileRoute } from "@tanstack/react-router";
import { HistoryTable } from "../features/history/HistoryTable";

export const Route = createFileRoute("/generations/")({
  component: HistoryTable,
});
