export const SUGGESTED_QUESTIONS = [
  "Qui est le Premier ministre actuel ?",
  "Quels sont les derniers votes à l'Assemblée ?",
  "Comment fonctionne le vote d'une loi ?",
  "Quels ministres ont des affaires en cours ?",
];

// Ghost text autocomplete - single suggestion that completes what user is typing
export const AUTOCOMPLETE_COMPLETIONS: Record<string, string> = {
  // Questions citoyennes
  comment: "Comment fonctionne l'Assemblée nationale ?",
  "comment fonctionne": "Comment fonctionne le vote d'une loi en France ?",
  "c'est quoi": "C'est quoi la présomption d'innocence ?",
  "c'est quoi l": "C'est quoi l'Assemblée nationale ?",
  pourquoi: "Pourquoi mon député a voté contre ?",
  "mon député": "Mon député : qui me représente ?",
  "mon dépu": "Mon député : qui me représente ?",
  // Questions sur les personnes
  "qui est": "Qui est le Premier ministre ?",
  "qui est le p": "Qui est le Premier ministre ?",
  "qui est le prem": "Qui est le Premier ministre ?",
  "qui est mar": "Qui est Marine Le Pen ?",
  parle: "Parle-moi du gouvernement actuel",
  "parle-moi": "Parle-moi du gouvernement actuel",
  "parle-moi de": "Parle-moi de Marine Le Pen",
  // Questions sur les affaires
  quelle: "Quelles affaires judiciaires touchent des élus ?",
  "quelles aff": "Quelles affaires judiciaires touchent des élus ?",
  "quelles affaires": "Quelles affaires judiciaires touchent des élus ?",
  affaire: "Affaires judiciaires en cours",
  condamn: "Quels élus ont été condamnés ?",
  // Patrimoine
  patrimoine: "Patrimoine déclaré des élus",
  "patrimoine de": "Patrimoine déclaré des élus",
  déclaration: "Déclarations HATVP des élus",
  // Signalement
  signaler: "Signaler une information manquante",
  corriger: "Corriger une information sur un élu",
  // Comparaison
  comparer: "Comparer deux élus",
  compar: "Comparer deux élus",
  // Questions sur les votes/lois
  vote: "Votes récents à l'Assemblée",
  "derniers v": "Derniers votes à l'Assemblée",
  loi: "Comment fonctionne le vote d'une loi ?",
  lois: "Lois en discussion à l'Assemblée",
  dossier: "Dossiers législatifs en cours",
  "quels dossiers": "Quels dossiers sont discutés à l'Assemblée ?",
  // Questions thématiques
  agricul: "Lois sur l'agriculture",
  écolog: "Dossiers sur l'environnement",
  santé: "Dossiers sur la santé",
  retraite: "Réforme des retraites",
  immigration: "Lois sur l'immigration",
  // Questions sur les institutions
  assemblée: "C'est quoi l'Assemblée nationale ?",
  sénat: "C'est quoi le Sénat ?",
  gouvernement: "Composition du gouvernement actuel",
  député: "Qui sont les députés ?",
  sénateur: "Qui sont les sénateurs ?",
  institution: "Comment fonctionnent les institutions françaises ?",
  // Questions sur les partis
  parti: "Quels sont les partis politiques ?",
  rn: "Membres du Rassemblement National",
  lfi: "Membres de La France Insoumise",
  républicain: "Membres des Républicains",
  macron: "Parle-moi d'Emmanuel Macron",
  "le pen": "Parle-moi de Marine Le Pen",
  mélenchon: "Parle-moi de Jean-Luc Mélenchon",
  // Questions sur la presse
  presse: "Derniers articles de presse politique",
  actualité: "Actualités politiques récentes",
  // Questions générales
  combien: "Combien de députés et sénateurs ?",
  "combien de": "Combien de députés et sénateurs ?",
  statistique: "Statistiques de Poligraph",
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}
