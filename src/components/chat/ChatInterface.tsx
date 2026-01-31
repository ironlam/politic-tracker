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
  "Qui est le Premier ministre actuel ?",
  "Combien de députés à l'Assemblée nationale ?",
  "Quels sont les principaux partis politiques ?",
  "Comment fonctionne le vote d'une loi ?",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-left h-auto py-3 px-4 justify-start"
                  onClick={() => handleSuggestedQuestion(question)}
                >
                  <span className="line-clamp-2 text-sm">{question}</span>
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            disabled={isLoading || isRateLimited}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-lg border bg-background px-4 py-3",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[48px] max-h-[120px]"
            )}
            style={{
              height: "auto",
              minHeight: "48px",
            }}
          />
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

        // Handle source links (→)
        if (line.startsWith("→ ")) {
          return (
            <div key={index} className="text-sm">
              <a
                href={extractUrl(line)}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                → {line.slice(2).replace(/https?:\/\/[^\s]+/, "").trim() || "Voir la source"}
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
  // Handle bold text (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Handle links in the remaining text
    const linkParts = part.split(/(\/politiques\/[^\s,.)]+|\/partis\/[^\s,.)]+|https?:\/\/[^\s,.)]+)/g);

    return linkParts.map((linkPart, linkIndex) => {
      if (
        linkPart.startsWith("/politiques/") ||
        linkPart.startsWith("/partis/") ||
        linkPart.startsWith("http")
      ) {
        return (
          <a
            key={`${index}-${linkIndex}`}
            href={linkPart}
            className="text-primary hover:underline"
            target={linkPart.startsWith("http") ? "_blank" : undefined}
            rel={linkPart.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {linkPart.startsWith("http") ? "Source" : linkPart}
          </a>
        );
      }
      return linkPart;
    });
  });
}

// Helper to extract URL from text
function extractUrl(text: string): string {
  const match = text.match(/(\/[^\s]+|https?:\/\/[^\s]+)/);
  return match ? match[1] : "#";
}
