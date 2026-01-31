import { cn } from "@/lib/utils";

interface MarkdownTextProps {
  children: string;
  className?: string;
}

/**
 * Simple markdown renderer for basic formatting
 * Supports: **bold**, *italic*, bullet points (• or -)
 */
export function MarkdownText({ children, className }: MarkdownTextProps) {
  // Parse markdown to HTML
  const html = parseMarkdown(children);

  return (
    <div
      className={cn("prose prose-sm dark:prose-invert max-w-none", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Parse basic markdown to HTML
 */
function parseMarkdown(text: string): string {
  let html = text;

  // Escape HTML entities first (security)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Convert line breaks to paragraphs
  const paragraphs = html.split(/\n\n+/);

  html = paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";

      // Check if it's a list (starts with bullet or dash)
      const lines = trimmed.split("\n");
      const isList = lines.every(
        (line) =>
          line.trim().startsWith("•") ||
          line.trim().startsWith("-") ||
          line.trim().startsWith("*") ||
          line.trim() === ""
      );

      if (isList && lines.some((l) => l.trim())) {
        const items = lines
          .filter((line) => line.trim())
          .map((line) => {
            // Remove bullet/dash prefix
            const content = line.trim().replace(/^[•\-*]\s*/, "");
            return `<li>${content}</li>`;
          })
          .join("");
        return `<ul class="list-disc pl-4 space-y-1">${items}</ul>`;
      }

      // Regular paragraph - preserve single line breaks
      const withBreaks = trimmed.replace(/\n/g, "<br />");
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");

  return html;
}
