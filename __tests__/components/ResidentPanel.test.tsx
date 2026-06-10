/**
 * Resident panel tests (plan U8) — the panel rendered over fabricated
 * snapshot sections. The streaming-number hook is mocked to its base amount
 * so no animation timers run; everything else renders for real.
 *
 * The contract under test: the panel always renders (never collapses),
 * halted is a visible state (banner + journal, never silent absence), all
 * six journal states are distinct, journal text renders inert, and USD
 * values degrade to "price unavailable" rather than $NaN/$0.00 claims.
 */

import { describe, expect, it } from "@jest/globals";
// Matcher type augmentation for the @jest/globals `expect` used here
// (jest.setup.js loads the matchers themselves at runtime).
import "@testing-library/jest-dom/jest-globals";
import { render, screen } from "@testing-library/react";
import React from "react";

jest.mock("@/src/hooks/useStreamingNumber", () => ({
  useStreamingNumber: ({ baseAmount }: { baseAmount: number }) => baseAmount,
}));

import ResidentPanel from "@/src/components/floor/ResidentPanel";
import type { ResidentSection } from "@/src/components/floor/types";
import type {
  ResidentJournalEntry,
  ResidentJournalState,
} from "@/src/lib/resident/journal";

const ADDRESS = "0xaaaa0000000000000000000000000000000000aa";

let entryCounter = 0;

function makeEntry(
  overrides: Partial<ResidentJournalEntry> = {}
): ResidentJournalEntry {
  entryCounter += 1;
  return {
    id: `entry-${entryCounter}`,
    at: Date.now() - 60_000,
    state: "confirmed",
    reasoning: "Bought a small position on pulse momentum.",
    ...overrides,
  };
}

function makeResident(
  overrides: Partial<ResidentSection> = {}
): ResidentSection {
  return {
    address: ADDRESS,
    halted: false,
    journal: [makeEntry()],
    yield: { totalUsdPerDay: 3.5, activeStreams: 2 },
    ethBalance: "0.05",
    spentTodayEth: 0.02,
    verifiedEvents: [],
    ...overrides,
  };
}

describe("ResidentPanel — placeholder state", () => {
  it("renders the coming-online placeholder when resident is null", () => {
    render(<ResidentPanel resident={null} />);
    expect(screen.getByText("The Resident")).toBeInTheDocument();
    expect(screen.getByText("Streme-operated")).toBeInTheDocument();
    expect(screen.getByText("coming online")).toBeInTheDocument();
  });
});

describe("ResidentPanel — halted state (origin R14 visibility)", () => {
  it("shows the warning banner AND the journal — never silent absence", () => {
    render(
      <ResidentPanel
        resident={makeResident({
          halted: true,
          journal: [makeEntry({ reasoning: "still visible while halted" })],
        })}
      />
    );

    expect(
      screen.getByText("The Resident is halted — a human is looking at it.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("still visible while halted")
    ).toBeInTheDocument();
    // The full panel structure stays: identity strip and journal heading.
    expect(screen.getByText("The Resident")).toBeInTheDocument();
    expect(screen.getByText("Decision journal")).toBeInTheDocument();
  });
});

describe("ResidentPanel — decision journal", () => {
  it("renders all six states with distinct labels", () => {
    const states: ResidentJournalState[] = [
      "intended",
      "broadcast",
      "confirmed",
      "failed",
      "skipped",
      "halted",
    ];
    render(
      <ResidentPanel
        resident={makeResident({
          journal: states.map((state) =>
            makeEntry({ state, reasoning: `reasoning for ${state}` })
          ),
        })}
      />
    );

    for (const state of states) {
      expect(screen.getByText(state)).toBeInTheDocument();
      expect(screen.getByText(`reasoning for ${state}`)).toBeInTheDocument();
    }
  });

  it("renders markup-shaped reasoning as inert text, never a script element", () => {
    const hostile = "<script>alert(1)</script>";
    const { container } = render(
      <ResidentPanel
        resident={makeResident({
          journal: [makeEntry({ reasoning: hostile })],
        })}
      />
    );

    expect(container.querySelector("script")).toBeNull();
    // The literal characters appear as text content.
    expect(screen.getByText(hostile)).toBeInTheDocument();
  });

  it("labels dry-run entries", () => {
    render(
      <ResidentPanel
        resident={makeResident({ journal: [makeEntry({ dryRun: true })] })}
      />
    );
    expect(screen.getByText("dry run")).toBeInTheDocument();
  });

  it("links txHash to Basescan", () => {
    const txHash = `0x${"a".repeat(64)}`;
    render(
      <ResidentPanel
        resident={makeResident({ journal: [makeEntry({ txHash })] })}
      />
    );
    const link = screen.getByRole("link", { name: /^tx 0xaaaa/ });
    expect(link).toHaveAttribute("href", `https://basescan.org/tx/${txHash}`);
  });

  it("shows an honest empty state when the journal has no entries", () => {
    render(<ResidentPanel resident={makeResident({ journal: [] })} />);
    expect(
      screen.getByText("No decisions yet — first run pending.")
    ).toBeInTheDocument();
  });
});

describe("ResidentPanel — yield display degradation (stale-marketData quirk)", () => {
  it.each([
    ["zero", { totalUsdPerDay: 0, activeStreams: 1 }],
    ["NaN", { totalUsdPerDay: NaN, activeStreams: 1 }],
    ["missing yield", null],
  ])("shows 'price unavailable' for %s, never $NaN or $0.00", (_label, y) => {
    render(<ResidentPanel resident={makeResident({ yield: y })} />);
    expect(screen.getByText("price unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/\$NaN/)).toBeNull();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it("shows the daily rate and the since-load accumulator for a finite positive rate", () => {
    render(
      <ResidentPanel
        resident={makeResident({
          yield: { totalUsdPerDay: 3.5, activeStreams: 2 },
        })}
      />
    );
    expect(screen.getByText("$3.50/day")).toBeInTheDocument();
    expect(
      screen.getByText(/earned since you opened this page/)
    ).toBeInTheDocument();
  });
});

describe("ResidentPanel — identity and position", () => {
  it("links the truncated address to Basescan and shows position numbers", () => {
    render(<ResidentPanel resident={makeResident()} />);

    const link = screen.getByRole("link", { name: "0xaaaa…00aa" });
    expect(link).toHaveAttribute(
      "href",
      `https://basescan.org/address/${ADDRESS}`
    );
    expect(screen.getByText("0.05 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.02 ETH")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
  });

  it("degrades nulled position fields without collapsing the panel", () => {
    render(
      <ResidentPanel
        resident={makeResident({
          ethBalance: null,
          spentTodayEth: null,
          journal: null,
        })}
      />
    );
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Journal temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByText("The Resident")).toBeInTheDocument();
  });
});
