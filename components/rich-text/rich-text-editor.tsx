"use client";

// Editor rich text (frontend-guide §20): Tiptap dimuat dynamic() supaya tidak ikut bundle halaman lain.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type { RichTextEditorProps } from "./rich-text-editor-inner";

export const RichTextEditor = dynamic(() => import("./rich-text-editor-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-44 w-full rounded-md" />,
});
