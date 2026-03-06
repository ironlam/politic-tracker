"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
});

export function SwaggerUIWrapper() {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <SwaggerUI url="/api/docs" />
    </div>
  );
}
