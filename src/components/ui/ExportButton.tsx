"use client";

import { Download } from "lucide-react";
import { Button } from "./button";
import { useState } from "react";

interface ExportButtonProps {
  endpoint: string;
  filename?: string;
  label?: string;
  params?: Record<string, string | undefined>;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ExportButton({
  endpoint,
  filename,
  label = "Export CSV",
  params = {},
  variant = "outline",
  size = "sm",
  className,
}: ExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    try {
      setIsLoading(true);

      // Build URL with params
      const url = new URL(endpoint, window.location.origin);
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }

      // Fetch the CSV
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get the blob and create download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      // Use provided filename or extract from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      link.download = filename || filenameMatch?.[1] || "export.csv";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export error:", error);
      alert("Erreur lors de l'export. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isLoading}
      className={className}
    >
      <Download className="h-4 w-4 mr-2" />
      {isLoading ? "Export..." : label}
    </Button>
  );
}
