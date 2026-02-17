import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SentenceDetails } from "./SentenceDetails";

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("SentenceDetails", () => {
  it("should render nothing when no sentence data", () => {
    const { container } = renderWithTooltip(<SentenceDetails affair={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render legacy sentence when no detailed fields", () => {
    renderWithTooltip(<SentenceDetails affair={{ sentence: "2 ans avec sursis" }} />);
    expect(screen.getByText("Peine :")).toBeInTheDocument();
    expect(screen.getByText("2 ans avec sursis")).toBeInTheDocument();
  });

  it("should render prison sentence", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          prisonMonths: 24,
          prisonSuspended: false,
        }}
      />
    );
    expect(screen.getByText("Peine prononcée")).toBeInTheDocument();
    expect(screen.getByText("2 ans")).toBeInTheDocument();
    expect(screen.getByText("(ferme)")).toBeInTheDocument();
  });

  it("should render suspended prison sentence", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          prisonMonths: 6,
          prisonSuspended: true,
        }}
      />
    );
    expect(screen.getByText("6 mois")).toBeInTheDocument();
    expect(screen.getByText("(avec sursis)")).toBeInTheDocument();
  });

  it("should render fine amount", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          fineAmount: 50000,
        }}
      />
    );
    expect(screen.getByText(/50.*000/)).toBeInTheDocument();
    expect(screen.getByText("d'amende")).toBeInTheDocument();
  });

  it("should render ineligibility period", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          ineligibilityMonths: 60,
        }}
      />
    );
    expect(screen.getByText("5 ans")).toBeInTheDocument();
    expect(screen.getByText("d'inéligibilité")).toBeInTheDocument();
  });

  it("should render community service hours", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          communityService: 140,
        }}
      />
    );
    expect(screen.getByText("140h")).toBeInTheDocument();
    expect(screen.getByText("de TIG")).toBeInTheDocument();
  });

  it("should render other sentence", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          prisonMonths: 12,
          otherSentence: "interdiction d'exercer",
        }}
      />
    );
    expect(screen.getByText("Autre :")).toBeInTheDocument();
    expect(screen.getByText("interdiction d'exercer")).toBeInTheDocument();
  });

  it("should render multiple penalties together", () => {
    renderWithTooltip(
      <SentenceDetails
        affair={{
          prisonMonths: 24,
          prisonSuspended: true,
          fineAmount: 100000,
          ineligibilityMonths: 120,
        }}
      />
    );
    expect(screen.getByText("2 ans")).toBeInTheDocument();
    expect(screen.getByText("(avec sursis)")).toBeInTheDocument();
    expect(screen.getByText("d'amende")).toBeInTheDocument();
    expect(screen.getByText("10 ans")).toBeInTheDocument();
    expect(screen.getByText("d'inéligibilité")).toBeInTheDocument();
  });

  it("should format months correctly", () => {
    // Less than 12 months
    const { rerender } = renderWithTooltip(<SentenceDetails affair={{ prisonMonths: 8 }} />);
    expect(screen.getByText("8 mois")).toBeInTheDocument();

    // Exactly 1 year
    rerender(
      <TooltipProvider>
        <SentenceDetails affair={{ prisonMonths: 12 }} />
      </TooltipProvider>
    );
    expect(screen.getByText("1 an")).toBeInTheDocument();

    // Multiple years
    rerender(
      <TooltipProvider>
        <SentenceDetails affair={{ prisonMonths: 36 }} />
      </TooltipProvider>
    );
    expect(screen.getByText("3 ans")).toBeInTheDocument();

    // Years and months
    rerender(
      <TooltipProvider>
        <SentenceDetails affair={{ prisonMonths: 18 }} />
      </TooltipProvider>
    );
    expect(screen.getByText("1 an et 6 mois")).toBeInTheDocument();
  });
});
