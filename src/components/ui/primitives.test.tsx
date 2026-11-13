import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// The `primitives` i18n namespace lands with this release; stub the hook so the
// tests do not depend on the dictionary merge.
const primitives = {
  book: "Book",
  bookNow: "Book now",
  fromPrice: "from {price}",
  free: "Free",
  priceWas: "Was {price}",
  bookingSummaryLabel: "Booking summary",
  servicesCount: {
    zero: "{count} services",
    one: "{count} service",
    two: "{count} services",
    few: "{count} services",
    many: "{count} services",
    other: "{count} services",
  },
};
const primitivesAr = {
  ...primitives,
  bookNow: "احجز الآن",
  fromPrice: "من {price}",
  servicesCount: {
    zero: "لا خدمات",
    one: "خدمة واحدة",
    two: "خدمتان",
    few: "{count} خدمات",
    many: "{count} خدمة",
    other: "{count} خدمة",
  },
};
let mockLocale: "en" | "ar" = "en";
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => ({
    t: { primitives: mockLocale === "ar" ? primitivesAr : primitives },
    locale: mockLocale,
    isRTL: mockLocale === "ar",
  }),
}));

import { MetaLine } from "./meta-line";
import { Pill } from "./pill";
import { Price } from "./price";
import { BookingCta, buildBookingHref, servicesCountLabel } from "./booking-cta";

describe("MetaLine", () => {
  it("joins facts with hidden separators and drops empty items", () => {
    const { container } = render(<MetaLine items={["4.9 (312)", null, "", false, "Khalda, Amman"]} />);
    expect(container.querySelectorAll("bdi")).toHaveLength(2);
    const seps = container.querySelectorAll('[aria-hidden="true"]');
    expect(seps).toHaveLength(1);
    expect(seps[0].textContent).toBe("·");
    expect(container.textContent).toContain("4.9 (312)");
  });

  it("localises digits for Arabic", () => {
    const { container } = render(<MetaLine locale="ar" items={["4.9 (312)", 45]} />);
    expect(container.textContent).toContain("٤.٩ (٣١٢)");
    expect(container.textContent).toContain("٤٥");
  });

  it("keeps Latin digits when the user prefers them", () => {
    const { container } = render(<MetaLine locale="ar" digits="latn" items={["312"]} />);
    expect(container.textContent).toBe("312");
  });

  it("renders nothing when every item is empty", () => {
    const { container } = render(<MetaLine items={[null, ""]} />);
    expect(container.firstChild).toBeNull();
  });

  it("supports object items with icons", () => {
    render(<MetaLine items={[{ key: "r", label: "Top", icon: <svg data-testid="icon" /> }]} />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});

describe("Pill", () => {
  it("renders a label with a tone and decorative icon", () => {
    render(
      <Pill tone="danger" icon={<svg data-testid="i" />}>
        Cancelled
      </Pill>,
    );
    const pill = screen.getByText("Cancelled").parentElement!;
    expect(pill).toHaveAttribute("data-tone", "danger");
    expect(screen.getByTestId("i").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Price", () => {
  it("formats JOD and the from-prefix", () => {
    mockLocale = "en";
    const { rerender, container } = render(<Price amount={7.5} />);
    expect(container.textContent).toBe("7.500 JD");
    rerender(<Price amount={5} from trimZeros />);
    expect(container.textContent).toBe("from 5 JD");
    rerender(<Price amount={5} max={8} trimZeros />);
    expect(container.textContent).toBe("5–8 JD");
    rerender(<Price amount={0} />);
    expect(container.textContent).toBe("Free");
  });

  it("shows a struck previous price with a screen-reader label", () => {
    mockLocale = "en";
    render(<Price amount={6} was={8} />);
    expect(screen.getByText("Was 8.000 JD")).toHaveClass("sr-only");
  });

  it("uses Arabic-Indic digits in Arabic", () => {
    mockLocale = "ar";
    const { container } = render(<Price amount={7.5} />);
    expect(container.textContent).toBe("٧٫٥٠٠ د.أ");
    mockLocale = "en";
  });
});

describe("BookingCta", () => {
  it("builds attributed booking links", () => {
    expect(buildBookingHref({ locale: "ar", shop: "abc", entry: "service_row", services: ["s1"], src: "instagram" })).toBe(
      "/ar/book/abc?service=s1&entry=service_row&src=instagram",
    );
    expect(buildBookingHref({ locale: "en", shop: "abc", entry: "profile_card", services: ["a", "b"], staff: "p1" })).toBe(
      "/en/book/abc?services=a%2Cb&staff=p1&entry=profile_card",
    );
  });

  it("drops unsafe tokens", () => {
    const href = buildBookingHref({ locale: "en", shop: "a/b", entry: "map", src: "<script>", services: ["ok", "bad id"] });
    expect(href).toBe("/en/book/a%2Fb?service=ok&entry=map");
  });

  it("renders the inline variant as a secondary link", () => {
    mockLocale = "en";
    render(<BookingCta shop="abc" entry="service_row" services={["s1"]} variant="inline" ariaLabel="Book Skin fade" />);
    const link = screen.getByRole("link", { name: "Book Skin fade" });
    expect(link).toHaveAttribute("href", "/en/book/abc?service=s1&entry=service_row");
    expect(link).toHaveAttribute("data-entry", "service_row");
  });

  it("renders the sticky bar with a services summary", () => {
    mockLocale = "en";
    render(<BookingCta shop="abc" entry="profile_sticky" variant="bar" summary={{ count: 3, fromPrice: 5 }} />);
    const region = screen.getByRole("region", { name: "Booking summary" });
    expect(region.textContent).toContain("3 services");
    expect(region.textContent).toContain("from 5 JD");
    expect(screen.getByRole("link", { name: "Book now" })).toHaveAttribute("href", "/en/book/abc?entry=profile_sticky");
  });

  it("pluralises service counts in Arabic", () => {
    expect(servicesCountLabel(primitivesAr.servicesCount, 1, "ar", "١")).toBe("خدمة واحدة");
    expect(servicesCountLabel(primitivesAr.servicesCount, 2, "ar", "٢")).toBe("خدمتان");
    expect(servicesCountLabel(primitivesAr.servicesCount, 3, "ar", "٣")).toBe("٣ خدمات");
    expect(servicesCountLabel(primitivesAr.servicesCount, 11, "ar", "١١")).toBe("١١ خدمة");
  });
});
