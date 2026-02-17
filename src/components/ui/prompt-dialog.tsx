"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

export function PromptDialog({
  open,
  onOpenChange,
  onSubmit,
  title,
  description,
  placeholder,
  submitLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
}: PromptDialogProps) {
  const [value, setValue] = useState("");

  function handleSubmit() {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setValue("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={!value.trim()} variant={variant}>
            {submitLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
