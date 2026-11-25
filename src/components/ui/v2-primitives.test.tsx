import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, ButtonLink } from "./button";
import { FilterChip, Pill } from "./pill";
import { RatingInput, RatingStars } from "./rating-stars";
import { SegmentedControl } from "./segmented-control";
import { StickyBar } from "./sticky-bar";
import { PhotoFrame, placeholderFill, placeholderInitials, PLACEHOLDER_FILLS } from "./photo-frame";
import { ShopCardShell } from "./shop-card-shell";
import { SearchPill } from "./search-bar-shell";
import { StatCard } from "./card";
import { cn } from "@/lib/utils";

describe("cn (design-system aware merge)", () => {
  it("keeps typography helpers next to colours and merges elevation", () => {
    expect(cn("text-h2", "text-ink")).toBe("text-h2 text-ink");
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("text-meta", "text-sm")).toBe("text-sm");
  });
});

describe("Button", () => {
  it("shows a spinner, sets aria-busy and disables while loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveAttribute("data-variant", "primary");
  });

  it("renders a link that looks like a button", () => {
    render(
      <ButtonLink href="/en/explore" variant="ink">
        Search
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/en/explore");
  });
});

describe("Pill / FilterChip", () => {
  it("keeps brass as an alias of brand", () => {
    render(<Pill tone="brass">Verified</Pill>);
    expect(screen.getByText("Verified").parentElement).toHaveAttribute("data-tone", "brass");
  });

  it("exposes the pressed state", () => {
    render(<FilterChip pressed>Open now</FilterChip>);
    expect(screen.getByRole("button", { name: "Open now" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("RatingStars", () => {
  it("exposes one image label and hides the visible number from AT", () => {
    render(<RatingStars rating={4.5} value="4.5" count="(12)" label="Rated 4.5 out of 5" />);
    const img = screen.getByRole("img", { name: "Rated 4.5 out of 5" });
    expect(img.textContent).toContain("4.5");
  });

  it("supports keyboard input", async () => {
    function Harness() {
      const [v, setV] = useState(2);
      return <RatingInput value={v} onChange={setV} label="Your rating" getStarLabel={(n) => `${n} stars`} />;
    }
    render(<Harness />);
    const two = screen.getByRole("button", { name: "2 stars" });
    expect(two).toHaveAttribute("aria-pressed", "true");
    two.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "3 stars" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "3 stars" })).toHaveFocus();
  });
});

describe("SegmentedControl", () => {
  it("uses radio semantics with roving focus and arrow keys", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="View"
        value="day"
        onChange={onChange}
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
        ]}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "View" });
    expect(group).toBeInTheDocument();
    const day = screen.getByRole("radio", { name: "Day" });
    expect(day).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("tabindex", "-1");
    day.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("week");
  });

  it("wires tab ids for tabs semantics", () => {
    render(
      <SegmentedControl
        semantics="tabs"
        idPrefix="ex"
        ariaLabel="Results"
        value="shops"
        onChange={() => {}}
        variant="pill"
        options={[
          { value: "shops", label: "Shops" },
          { value: "barbers", label: "Barbers" },
        ]}
      />,
    );
    const tab = screen.getByRole("tab", { name: "Shops" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveAttribute("aria-controls", "ex-panel-shops");
  });
});

describe("StickyBar", () => {
  it("is a labelled region marked for toast offset", () => {
    render(<StickyBar label="Booking summary" title="45 JD" subtitle="2 services" action={<button>Continue</button>} />);
    const region = screen.getByRole("region", { name: "Booking summary" });
    expect(region).toHaveAttribute("data-sticky-bar");
    expect(region.textContent).toContain("45 JD");
  });
});

describe("PhotoFrame", () => {
  it("renders a branded placeholder with initials when there is no photo", () => {
    const { container } = render(<PhotoFrame src={null} alt="Fade Lab" fallbackName="Fade Lab" seed="shop-1" />);
    expect(screen.getByRole("img", { name: "Fade Lab" })).toBeInTheDocument();
    expect(container.textContent).toContain("FL");
    expect(container.querySelector("[data-placeholder]")).toHaveAttribute("data-placeholder", placeholderFill("shop-1").key);
  });

  it("picks fills deterministically and handles Arabic names", () => {
    expect(placeholderFill("abc")).toBe(placeholderFill("abc"));
    expect(PLACEHOLDER_FILLS).toHaveLength(4);
    expect(placeholderInitials("صالون الأمير")).toBe("صا");
    expect(placeholderInitials("")).toBe("·");
  });
});

describe("ShopCardShell", () => {
  it("links the whole card through the name", () => {
    render(<ShopCardShell href="/en/shop/x" name="Fade Lab" meta={<p>4.9</p>} active />);
    expect(screen.getByRole("link", { name: "Fade Lab" })).toHaveAttribute("href", "/en/shop/x");
    expect(screen.getByRole("article")).toHaveAttribute("data-active", "true");
  });
});

describe("SearchPill", () => {
  it("includes the summary in its accessible name", () => {
    render(<SearchPill ariaLabel="Search" summary={["All services", null, "Amman"]} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/Search:\s*All services,\s*Amman/);
  });
});

describe("StatCard", () => {
  it("colours only the delta row", () => {
    render(<StatCard label="Bookings" value="18" delta={{ value: "+12%", direction: "up", caption: "vs last week" }} />);
    expect(screen.getByText("+12%").parentElement?.className).toContain("text-success-text");
  });
});
