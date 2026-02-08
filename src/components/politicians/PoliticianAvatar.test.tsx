import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoliticianAvatar } from "./PoliticianAvatar";

describe("PoliticianAvatar", () => {
  it("should render initials when no photo URL", () => {
    render(<PoliticianAvatar photoUrl={null} firstName="Jean" lastName="Dupont" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("should render initials from fullName", () => {
    render(<PoliticianAvatar photoUrl={null} fullName="Marine Le Pen" />);
    expect(screen.getByText("ML")).toBeInTheDocument();
  });

  it("should render image when photo URL provided", () => {
    render(
      <PoliticianAvatar
        photoUrl="https://example.com/photo.jpg"
        firstName="Jean"
        lastName="Dupont"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
    expect(img).toHaveAttribute("alt", "Jean Dupont");
  });

  it("should fallback to initials on image error", () => {
    render(
      <PoliticianAvatar
        photoUrl="https://example.com/broken.jpg"
        firstName="Jean"
        lastName="Dupont"
      />
    );

    const img = screen.getByRole("img");
    fireEvent.error(img);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("should apply correct size classes", () => {
    const { container, rerender } = render(
      <PoliticianAvatar photoUrl={null} firstName="A" lastName="B" size="sm" />
    );
    expect(container.firstChild).toHaveClass("w-10", "h-10");

    rerender(<PoliticianAvatar photoUrl={null} firstName="A" lastName="B" size="lg" />);
    expect(container.firstChild).toHaveClass("w-24", "h-24");
  });

  it("should handle missing first name gracefully", () => {
    render(<PoliticianAvatar photoUrl={null} lastName="Dupont" />);
    // Should show "?D" for missing first initial
    expect(screen.getByText("?D")).toBeInTheDocument();
  });

  it("should apply custom className", () => {
    const { container } = render(
      <PoliticianAvatar photoUrl={null} firstName="A" lastName="B" className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
