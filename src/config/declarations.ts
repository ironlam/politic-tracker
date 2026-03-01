// ─── FAQ content (reused in component + JSON-LD) ──────────────

export const FAQ_ITEMS = [
  {
    question: "Qu'est-ce qu'une déclaration d'intérêts (DIA) ?",
    answer:
      "La déclaration d'intérêts et d'activités (DIA) est un document officiel dans lequel un élu déclare ses participations financières, activités professionnelles, mandats et fonctions de direction. Elle est publiée par la Haute Autorité pour la Transparence de la Vie Publique (HATVP) et consultable librement en ligne.",
  },
  {
    question: "Quelle différence entre déclaration d'intérêts et déclaration de patrimoine ?",
    answer:
      "La déclaration d'intérêts (DIA) liste les activités, revenus et participations de l'élu. La déclaration de patrimoine (DSP) détaille l'ensemble des biens (immobilier, valeurs mobilières, comptes bancaires). Pour les parlementaires, seules les DIA sont consultables en ligne — les déclarations de patrimoine ne sont consultables qu'en préfecture.",
  },
  {
    question: "D'où viennent les données affichées sur cette page ?",
    answer:
      "Toutes les données proviennent des fichiers open data de la HATVP (CSV et XML). Poligraph récupère et parse ces fichiers pour les rendre lisibles, comparables et explorables. Aucune donnée n'est inventée ou estimée.",
  },
  {
    question: "À quelle fréquence les données sont-elles mises à jour ?",
    answer:
      "Poligraph synchronise les données HATVP quotidiennement. Les déclarations sont publiées par la HATVP elle-même, avec un délai variable : les DIA des députés et sénateurs sont publiées lors de chaque renouvellement, celles du gouvernement à la nomination.",
  },
];
