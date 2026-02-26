import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InfoTooltip } from "./info-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("InfoTooltip", () => {
  it("should render info button with aria-label", () => {
    renderWithTooltip(<InfoTooltip text="Some help text" />);
    expect(screen.getByRole("button", { name: /aide/i })).toBeInTheDocument();
  });

  it("should render nothing when no text or term", () => {
    const { container } = renderWithTooltip(<InfoTooltip />);
    expect(container.innerHTML).toBe("");
  });

  it("should render with glossary term", () => {
    renderWithTooltip(<InfoTooltip term="sursis" />);
    expect(screen.getByRole("button", { name: /aide : sursis/i })).toBeInTheDocument();
  });
});
