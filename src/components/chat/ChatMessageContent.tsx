"use client";

import React from "react";

// Helper to extract URL from text
function extractUrl(text: string): string {
  // Match internal paths (/xxx) or external URLs (https://...)
  const match = text.match(/(\/[a-z][a-z0-9-/]*|https?:\/\/[^\s]+)/i);
  if (match) {
    // Clean trailing punctuation
    return match[1]!.replace(/[.,;:!?]+$/, "");
  }
  return "#";
}

// Helper to render inline formatting (bold, links)
function renderInlineFormatting(text: string): React.ReactNode {
  // First, handle markdown links [text](url)
  const withLinks = text.split(/(\[[^\]]+\]\([^)]+\))/g);

  return withLinks.map((segment, segIndex) => {
    // Check if this is a markdown link
    const linkMatch = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, linkText, url] = linkMatch;
      // Fix malformed URLs (http:/www -> https://www)
      let fixedUrl = url;
      if (url!.startsWith("http:/www") || url!.startsWith("http:/assemblee")) {
        fixedUrl = url!.replace("http:/", "https://");
      } else if (url!.startsWith("www.") || url!.startsWith("assemblee-nationale")) {
        fixedUrl = `https://${url}`;
      }
      const isExternal = fixedUrl!.startsWith("http");
      return (
        <a
          key={segIndex}
          href={fixedUrl}
          className="text-primary hover:underline break-all"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {linkText}
        </a>
      );
    }

    // Handle bold text (**text**)
    const parts = segment.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${segIndex}-${index}`} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Handle raw links in the remaining text (including partial paths like /politiques/)
      const linkParts = part.split(
        /(\/politiques(?:\/[^\s,.)]*)?|\/partis(?:\/[^\s,.)]*)?|\/affaires(?:\/[^\s,.)]*)?|\/assemblee(?:\/[^\s,.)]*)?|\/votes(?:\/[^\s,.)]*)?|\/statistiques|\/institutions|https?:\/\/[^\s,.)]+)/g
      );

      return linkParts.map((linkPart, linkIndex) => {
        const isInternalLink =
          linkPart.startsWith("/politiques") ||
          linkPart.startsWith("/partis") ||
          linkPart.startsWith("/affaires") ||
          linkPart.startsWith("/assemblee") ||
          linkPart.startsWith("/votes") ||
          linkPart.startsWith("/statistiques") ||
          linkPart.startsWith("/institutions");
        const isExternalLink = linkPart.startsWith("http");

        if (isInternalLink || isExternalLink) {
          // Generate friendly label for internal links
          let label = linkPart;
          if (linkPart === "/politiques" || linkPart === "/politiques/")
            label = "Voir tous les élus";
          else if (linkPart === "/affaires" || linkPart === "/affaires/")
            label = "Voir toutes les affaires";
          else if (linkPart === "/assemblee" || linkPart === "/assemblee/")
            label = "Voir les dossiers législatifs";
          else if (linkPart === "/votes" || linkPart === "/votes/") label = "Voir les votes";
          else if (linkPart === "/statistiques") label = "Voir les statistiques";
          else if (linkPart === "/institutions") label = "Voir les institutions";
          else if (linkPart.startsWith("/politiques/"))
            label = linkPart.split("/").pop() || linkPart;
          else if (linkPart.startsWith("/partis/")) label = linkPart.split("/").pop() || linkPart;
          else if (linkPart.startsWith("/votes/")) label = "Voir ce vote";
          else if (linkPart.startsWith("/assemblee/")) label = "Voir ce dossier";
          else if (isExternalLink) label = "Source officielle";

          // Clean trailing slash for href
          const href = linkPart.endsWith("/") ? linkPart.slice(0, -1) : linkPart;

          return (
            <a
              key={`${segIndex}-${index}-${linkIndex}`}
              href={href}
              className="text-primary hover:underline font-medium break-all"
              target={isExternalLink ? "_blank" : undefined}
              rel={isExternalLink ? "noopener noreferrer" : undefined}
            >
              {label}
            </a>
          );
        }
        return linkPart;
      });
    });
  });
}

// Component to render message content with markdown-like formatting
export function ChatMessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");

  return (
    <div className="space-y-2 break-words [overflow-wrap:anywhere]">
      {lines.map((line, index) => {
        // Handle bullet points
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={index} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{renderInlineFormatting(line.slice(2))}</span>
            </div>
          );
        }

        // Handle headers (##, ###)
        if (line.startsWith("## ")) {
          return (
            <h3 key={index} className="font-semibold text-base mt-3">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={index} className="font-medium text-sm mt-2">
              {line.slice(4)}
            </h4>
          );
        }

        // Handle source links (-> /path or -> https://...)
        if (line.startsWith("→ ")) {
          const linkContent = line.slice(2).trim();
          const url = extractUrl(line);

          // Generate friendly label based on path
          let label = linkContent;
          if (url === "/affaires") label = "Voir toutes les affaires";
          else if (url === "/assemblee") label = "Voir tous les dossiers législatifs";
          else if (url === "/politiques") label = "Voir tous les élus";
          else if (url === "/statistiques") label = "Voir les statistiques";
          else if (url === "/institutions") label = "Comprendre les institutions";
          else if (url.startsWith("/politiques/")) {
            const name = url.split("/").pop()?.replace(/-/g, " ") || "";
            label = `Voir la fiche de ${name}`;
          } else if (url.startsWith("http")) label = "Voir la source officielle";

          const isExternal = url.startsWith("http");

          return (
            <div key={index} className="mt-2">
              <a
                href={url}
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium bg-primary/5 px-3 py-1.5 rounded-md break-all"
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                → {label}
              </a>
            </div>
          );
        }

        // Handle warnings
        if (line.includes("⚠️")) {
          return (
            <div
              key={index}
              className="text-sm bg-orange-500/10 text-orange-700 dark:text-orange-300 px-3 py-2 rounded-md"
            >
              {line}
            </div>
          );
        }

        // Regular paragraph
        if (line.trim()) {
          return (
            <p key={index} className="m-0">
              {renderInlineFormatting(line)}
            </p>
          );
        }

        // Empty line
        return <div key={index} className="h-2" />;
      })}
    </div>
  );
}
