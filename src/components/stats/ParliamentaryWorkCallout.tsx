"use client";

import { useState } from "react";

export function ParliamentaryWorkCallout() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-8">
      <div className="flex items-start gap-3">
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center mt-0.5"
          aria-hidden="true"
        >
          i
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
            Comprendre la participation parlementaire
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
            Le travail d&apos;un parlementaire ne se résume pas aux votes en séance plénière.
            L&apos;activité parlementaire comprend notamment :
          </p>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>
              <strong>Commissions</strong> — travail de fond sur les textes de loi
            </li>
            <li>
              <strong>Hémicycle</strong> — débats et votes en séance publique
            </li>
            <li>
              <strong>Circonscription</strong> — permanences et travail de terrain
            </li>
            <li>
              <strong>Questions au gouvernement</strong> — contrôle de l&apos;exécutif
            </li>
            <li>
              <strong>Missions et rapports</strong> — commissions d&apos;enquête, rapports
              thématiques
            </li>
          </ul>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                Le taux de participation mesure uniquement la présence lors des scrutins solennels
                en séance publique. Un taux bas ne signifie pas nécessairement un parlementaire
                inactif : certains élus sont très investis en commission ou dans leur
                circonscription.
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed mt-2">
                De plus, certaines fonctions (présidents de commission, questeurs, membres du
                Bureau) impliquent des responsabilités qui peuvent éloigner de l&apos;hémicycle. Les
                votes par délégation ne sont pas toujours comptabilisés individuellement.
              </p>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            aria-expanded={expanded}
          >
            {expanded ? "Réduire" : "En savoir plus"}
          </button>
        </div>
      </div>
    </div>
  );
}
