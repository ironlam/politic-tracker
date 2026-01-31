"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "Quelles affaires judiciaires concernent des élus ?",
  "Quels dossiers sont discutés à l'Assemblée ?",
  "Qui est le Premier ministre ?",
  "Combien de députés et sénateurs ?",
];

// Generate contextual follow-up suggestions based on the conversation
function generateFollowUpSuggestions(lastAssistantMessage: string, lastUserMessage: string): string[] {
  const suggestions: string[] = [];
  const content = lastAssistantMessage.toLowerCase();
  const question = lastUserMessage.toLowerCase();

  // Detect themes in the response
  const themes = {
    agriculture: content.includes("agricol") || content.includes("paysan") || content.includes("ferme"),
    environnement: content.includes("environnement") || content.includes("écolog") || content.includes("climat"),
    santé: content.includes("santé") || content.includes("hôpital") || content.includes("médic"),
    éducation: content.includes("éducation") || content.includes("école") || content.includes("étudiant"),
    retraite: content.includes("retraite") || content.includes("pension"),
    immigration: content.includes("immigration") || content.includes("migrant") || content.includes("asile"),
    sécurité: content.includes("sécurité") || content.includes("police") || content.includes("délinquance"),
    économie: content.includes("économi") || content.includes("entreprise") || content.includes("emploi"),
    logement: content.includes("logement") || content.includes("loyer") || content.includes("hlm"),
  };

  // Detect content types
  const hasAffaires = content.includes("affaire") || content.includes("condamn") || content.includes("judiciaire");
  const hasDossiers = content.includes("dossier") || content.includes("projet de loi") || content.includes("proposition de loi");
  const hasVotes = content.includes("vote") || content.includes("scrutin") || content.includes("adopté") || content.includes("rejeté");
  const hasPolitician = content.includes("/politiques/") || content.includes("député") || content.includes("sénateur") || content.includes("ministre");
  const hasParty = content.includes("parti") || content.includes("groupe politique") || content.includes("/partis/");

  // Find the active theme
  const activeTheme = Object.entries(themes).find(([, active]) => active)?.[0];

  // Citizen-oriented suggestions based on context
  if (hasDossiers || hasDossiers) {
    if (activeTheme) {
      suggestions.push(`Quels partis défendent ${activeTheme === "environnement" ? "l'" : "la "}${activeTheme} ?`);
      suggestions.push(`Autres lois sur ${activeTheme === "environnement" ? "l'" : "la "}${activeTheme} ?`);
    }
    suggestions.push("Quels députés ont voté pour ?");
    suggestions.push("Ce texte a-t-il été adopté ?");
  }

  if (hasAffaires) {
    suggestions.push("Quels partis ont le plus d'élus concernés ?");
    suggestions.push("Y a-t-il des condamnations définitives ?");
    suggestions.push("Affaires les plus récentes ?");
  }

  if (hasPolitician && !hasAffaires) {
    suggestions.push("Quels sont ses votes récents ?");
    suggestions.push("A-t-il des affaires judiciaires ?");
    suggestions.push("Qui sont les autres élus de son parti ?");
  }

  if (hasParty) {
    suggestions.push("Combien de députés dans ce parti ?");
    suggestions.push("Quelles sont leurs positions principales ?");
    suggestions.push("Des affaires concernent-elles ce parti ?");
  }

  if (hasVotes) {
    suggestions.push("Comment ont voté les différents partis ?");
    suggestions.push("Qui a voté contre ?");
  }

  // Theme-specific citizen questions
  if (activeTheme && suggestions.length < 3) {
    const themeQuestions: Record<string, string[]> = {
      agriculture: ["Quels députés sont agriculteurs ?", "Aides aux agriculteurs votées ?"],
      environnement: ["Lois climat récentes ?", "Quels partis sont écologistes ?"],
      santé: ["Réformes santé en cours ?", "Budget hôpitaux voté ?"],
      éducation: ["Réformes éducation récentes ?", "Budget éducation ?"],
      retraite: ["Où en est la réforme des retraites ?", "Qui a voté la réforme ?"],
      immigration: ["Lois immigration récentes ?", "Positions des partis sur l'immigration ?"],
      sécurité: ["Lois sécurité votées ?", "Budget police et justice ?"],
      économie: ["Mesures pour l'emploi ?", "Aides aux entreprises votées ?"],
      logement: ["Lois sur le logement ?", "Encadrement des loyers ?"],
    };
    suggestions.push(...(themeQuestions[activeTheme] || []));
  }

  // Default suggestions if nothing specific detected
  if (suggestions.length === 0) {
    suggestions.push("Quels sont les dossiers prioritaires actuellement ?");
    suggestions.push("Quels partis sont représentés à l'Assemblée ?");
    suggestions.push("Y a-t-il des affaires judiciaires en cours ?");
  }

  // Return unique suggestions, max 3
  return [...new Set(suggestions)].slice(0, 3);
}

// Ghost text autocomplete - single suggestion that completes what user is typing
const AUTOCOMPLETE_COMPLETIONS: Record<string, string> = {
  // Questions sur les personnes
  "qui est": "Qui est le Premier ministre ?",
  "qui est le p": "Qui est le Premier ministre ?",
  "qui est le prem": "Qui est le Premier ministre ?",
  "qui est mar": "Qui est Marine Le Pen ?",
  "parle": "Parle-moi du gouvernement actuel",
  "parle-moi": "Parle-moi du gouvernement actuel",
  "parle-moi de": "Parle-moi de Marine Le Pen",
  // Questions sur les affaires
  "quelle": "Quelles affaires judiciaires concernent des élus ?",
  "quelles aff": "Quelles affaires judiciaires concernent des élus ?",
  "quelles affaires": "Quelles affaires judiciaires concernent des élus ?",
  "affaire": "Affaires judiciaires en cours",
  "condamn": "Quels élus ont été condamnés ?",
  // Questions sur les votes/lois
  "vote": "Votes récents à l'Assemblée",
  "derniers v": "Derniers votes à l'Assemblée",
  "loi": "Lois en discussion à l'Assemblée",
  "lois": "Lois en discussion à l'Assemblée",
  "dossier": "Dossiers législatifs en cours",
  "quels dossiers": "Quels dossiers sont discutés à l'Assemblée ?",
  // Questions thématiques
  "agricul": "Lois sur l'agriculture",
  "écolog": "Dossiers sur l'environnement",
  "santé": "Dossiers sur la santé",
  "retraite": "Réforme des retraites",
  "immigration": "Lois sur l'immigration",
  // Questions sur les institutions
  "assemblée": "Dossiers en cours à l'Assemblée",
  "sénat": "Qui sont les sénateurs ?",
  "gouvernement": "Composition du gouvernement actuel",
  "député": "Qui sont les députés ?",
  "sénateur": "Qui sont les sénateurs ?",
  // Questions sur les partis
  "parti": "Quels sont les partis politiques ?",
  "rn": "Députés du Rassemblement National",
  "lfi": "Députés de La France Insoumise",
  "républicain": "Députés des Républicains",
  "macron": "Parle-moi d'Emmanuel Macron",
  "le pen": "Parle-moi de Marine Le Pen",
  "mélenchon": "Parle-moi de Jean-Luc Mélenchon",
  // Questions générales
  "combien": "Combien de députés et sénateurs ?",
  "combien de": "Combien de députés et sénateurs ?",
  "statistique": "Statistiques des affaires judiciaires",
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  // Scroll within chat container only (not page)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  // Scroll to bottom only when user sends a new message
  const scrollOnNewUserMessage = useRef(false);

  useEffect(() => {
    if (scrollOnNewUserMessage.current) {
      scrollToBottom();
      scrollOnNewUserMessage.current = false;
    }
  }, [messages, scrollToBottom]);

  // Rate limit countdown
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setTimeout(() => {
        setRetryAfter((r) => r - 1);
        if (retryAfter === 1) {
          setIsRateLimited(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryAfter]);

  // Clear follow-up suggestions when user starts typing
  useEffect(() => {
    if (input.length > 0 && followUpSuggestions.length > 0) {
      setFollowUpSuggestions([]);
    }
  }, [input, followUpSuggestions.length]);

  // Ghost text autocomplete - find completion that starts with user input
  useEffect(() => {
    if (input.length < 3) {
      setGhostText(null);
      return;
    }

    const lowerInput = input.toLowerCase().trim();

    // Find the best matching completion
    let bestMatch: string | null = null;

    // First, try exact prefix match in completions
    for (const [trigger, completion] of Object.entries(AUTOCOMPLETE_COMPLETIONS)) {
      if (lowerInput === trigger || lowerInput.startsWith(trigger + " ")) {
        // Check if completion starts with what user typed (case insensitive)
        if (completion.toLowerCase().startsWith(lowerInput)) {
          bestMatch = completion;
          break;
        }
        // Otherwise use the completion as suggestion
        bestMatch = completion;
        break;
      }
      // Partial trigger match
      if (trigger.startsWith(lowerInput) && !bestMatch) {
        bestMatch = completion;
      }
    }

    // Only show ghost if it's different and extends the input
    if (bestMatch && bestMatch.toLowerCase() !== lowerInput && bestMatch.toLowerCase().startsWith(lowerInput)) {
      setGhostText(bestMatch);
    } else {
      setGhostText(null);
    }
  }, [input]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    scrollOnNewUserMessage.current = true;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    // Prepare assistant message placeholder
    const assistantId = `assistant-${Date.now()}`;
    setMessages([...newMessages, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.status === 429) {
        setIsRateLimited(true);
        const data = await response.json();
        setRetryAfter(data.retryAfter || 60);
        setMessages(newMessages); // Remove assistant placeholder
        throw new Error("Trop de requêtes");
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Une erreur s'est produite");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Streaming non supporté");
      }

      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantContent += chunk;

        // Update message content
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      }

      // Generate follow-up suggestions based on the response
      const suggestions = generateFollowUpSuggestions(assistantContent, messageContent);
      setFollowUpSuggestions(suggestions);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Erreur inconnue"));
      // Remove the empty assistant message on error
      setMessages(newMessages);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab to accept ghost text completion
    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      setInput(ghostText);
      setGhostText(null);
      return;
    }

    // Escape to dismiss ghost text
    if (e.key === "Escape" && ghostText) {
      setGhostText(null);
      return;
    }

    // Send message on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    setGhostText(null);
    inputRef.current?.focus();
  };

  // Retry last message
  const handleRetry = () => {
    if (messages.length === 0) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      // Remove all messages after the last user message
      const lastUserIndex = messages.lastIndexOf(lastUserMessage);
      setMessages(messages.slice(0, lastUserIndex));
      sendMessage(lastUserMessage.content);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-h-[80vh]">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">
                Assistant Transparence Politique
              </h2>
              <p className="text-muted-foreground max-w-md">
                Posez vos questions sur les représentants politiques français,
                leurs mandats, les votes parlementaires ou les dossiers législatifs.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {SUGGESTED_QUESTIONS.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-left h-auto py-2.5 px-4 justify-start whitespace-normal"
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  <span className="text-sm">{question}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <Card
                  className={cn(
                    "max-w-[80%] py-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <CardContent className="p-0 px-4">
                    <div
                      className={cn(
                        "prose prose-sm max-w-none",
                        message.role === "user" && "prose-invert"
                      )}
                    >
                      {message.role === "assistant" ? (
                        message.content ? (
                          <ChatMessageContent content={message.content} />
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Recherche en cours...</span>
                          </div>
                        )
                      ) : (
                        <p className="m-0 whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Follow-up suggestions */}
            {!isLoading && followUpSuggestions.length > 0 && messages.length > 0 && (
              <div className="flex flex-col gap-2 ml-11 mt-2">
                <p className="text-xs text-muted-foreground">Questions suggérées :</p>
                <div className="flex flex-wrap gap-2">
                  {followUpSuggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setFollowUpSuggestions([]);
                        sendMessage(suggestion);
                      }}
                      className="text-left text-sm px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {error && !isRateLimited && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <Card className="bg-destructive/10 border-destructive/20 py-3">
                  <CardContent className="p-0 px-4">
                    <p className="text-sm text-destructive mb-2">
                      {error.message || "Une erreur s'est produite. Veuillez réessayer."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="gap-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Réessayer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Rate limit warning */}
            {isRateLimited && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                </div>
                <Card className="bg-orange-500/10 border-orange-500/20 py-3">
                  <CardContent className="p-0 px-4">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Trop de requêtes. Veuillez patienter{" "}
                      {retryAfter > 0 ? `${retryAfter}s` : "quelques instants"}.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4 bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            {/* Ghost text overlay */}
            {ghostText && (
              <div
                className="absolute inset-0 px-4 py-3 pointer-events-none overflow-hidden"
                aria-hidden="true"
              >
                <span className="invisible">{input}</span>
                <span className="text-muted-foreground/50">
                  {ghostText.slice(input.length)}
                </span>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              disabled={isLoading || isRateLimited}
              rows={1}
              className={cn(
                "w-full resize-none rounded-lg border bg-transparent px-4 py-3",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "min-h-[48px] max-h-[120px]"
              )}
              style={{
                height: "auto",
                minHeight: "48px",
              }}
            />
            {/* Tab hint */}
            {ghostText && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Tab ↹
              </div>
            )}
          </div>
          <Button
            type="submit"
            disabled={isLoading || !input.trim() || isRateLimited}
            size="icon"
            className="h-12 w-12 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="sr-only">Envoyer</span>
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Les réponses sont basées sur notre base de données.{" "}
          <a href="/sources" className="underline hover:text-foreground">
            En savoir plus sur nos sources
          </a>
        </p>
      </div>
    </div>
  );
}

// Component to render message content with markdown-like formatting
function ChatMessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
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

        // Handle source links (→ /path or → https://...)
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
          }
          else if (url.startsWith("http")) label = "Voir la source officielle";

          const isExternal = url.startsWith("http");

          return (
            <div key={index} className="mt-2">
              <a
                href={url}
                className="inline-flex items-center gap-2 text-primary hover:underline font-medium bg-primary/5 px-3 py-1.5 rounded-md"
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                → {label}
              </a>
            </div>
          );
        }

        // Handle warnings (⚠️)
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
      if (url.startsWith("http:/www") || url.startsWith("http:/assemblee")) {
        fixedUrl = url.replace("http:/", "https://");
      } else if (url.startsWith("www.") || url.startsWith("assemblee-nationale")) {
        fixedUrl = `https://${url}`;
      }
      const isExternal = fixedUrl.startsWith("http");
      return (
        <a
          key={segIndex}
          href={fixedUrl}
          className="text-primary hover:underline"
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
      const linkParts = part.split(/(\/politiques(?:\/[^\s,.)]*)?|\/partis(?:\/[^\s,.)]*)?|\/affaires(?:\/[^\s,.)]*)?|\/assemblee(?:\/[^\s,.)]*)?|\/statistiques|\/institutions|https?:\/\/[^\s,.)]+)/g);

      return linkParts.map((linkPart, linkIndex) => {
        const isInternalLink =
          linkPart.startsWith("/politiques") ||
          linkPart.startsWith("/partis") ||
          linkPart.startsWith("/affaires") ||
          linkPart.startsWith("/assemblee") ||
          linkPart.startsWith("/statistiques") ||
          linkPart.startsWith("/institutions");
        const isExternalLink = linkPart.startsWith("http");

        if (isInternalLink || isExternalLink) {
          // Generate friendly label for internal links
          let label = linkPart;
          if (linkPart === "/politiques" || linkPart === "/politiques/") label = "Voir tous les élus";
          else if (linkPart === "/affaires" || linkPart === "/affaires/") label = "Voir toutes les affaires";
          else if (linkPart === "/assemblee" || linkPart === "/assemblee/") label = "Voir les dossiers législatifs";
          else if (linkPart === "/statistiques") label = "Voir les statistiques";
          else if (linkPart === "/institutions") label = "Voir les institutions";
          else if (linkPart.startsWith("/politiques/")) label = linkPart.split("/").pop() || linkPart;
          else if (linkPart.startsWith("/partis/")) label = linkPart.split("/").pop() || linkPart;
          else if (isExternalLink) label = "Source officielle";

          // Clean trailing slash for href
          const href = linkPart.endsWith("/") ? linkPart.slice(0, -1) : linkPart;

          return (
            <a
              key={`${segIndex}-${index}-${linkIndex}`}
              href={href}
              className="text-primary hover:underline font-medium"
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

// Helper to extract URL from text
function extractUrl(text: string): string {
  // Match internal paths (/xxx) or external URLs (https://...)
  const match = text.match(/(\/[a-z][a-z0-9-/]*|https?:\/\/[^\s]+)/i);
  if (match) {
    // Clean trailing punctuation
    return match[1].replace(/[.,;:!?]+$/, "");
  }
  return "#";
}
