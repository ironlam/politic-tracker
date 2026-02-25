interface SeoIntroProps {
  text: string;
}

export function SeoIntro({ text }: SeoIntroProps) {
  return <p className="text-muted-foreground text-sm mb-6 max-w-3xl">{text}</p>;
}
