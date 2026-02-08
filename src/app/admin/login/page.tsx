"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || "Mot de passe incorrect");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Administration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="sr-only">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Mot de passe admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? "password-error" : undefined}
                autoFocus
              />
            </div>
            {error && (
              <p
                id="password-error"
                role="alert"
                aria-live="assertive"
                className="text-sm text-red-600"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
