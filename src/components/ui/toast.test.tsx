import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

import { ToastContainer, toast, clearToasts, getToasts } from "./toast";

describe("toast", () => {
  beforeEach(() => {
    act(() => clearToasts());
  });

  it("announces success politely and errors assertively", async () => {
    render(<ToastContainer />);
    act(() => {
      toast("success", "Saved");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => {
      toast.error("Failed to save");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to save");
  });

  it("renders a labelled region and a translated dismiss button", async () => {
    render(<ToastContainer />);
    act(() => {
      toast.info("Heads up");
    });
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await waitFor(() => expect(getToasts()).toHaveLength(0));
  });

  it("runs an action and dismisses", async () => {
    const undo = vi.fn();
    render(<ToastContainer />);
    act(() => {
      toast.success("Deleted", { action: { label: "Undo", onClick: undo } });
    });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalled();
    expect(getToasts()).toHaveLength(0);
  });

  it("auto-dismisses after the duration", () => {
    vi.useFakeTimers();
    render(<ToastContainer />);
    act(() => {
      toast.success("Quick", { duration: 1000 });
    });
    expect(getToasts()).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(getToasts()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("replaces a toast with the same id and caps the stack", () => {
    render(<ToastContainer />);
    act(() => {
      toast.info("one", { id: "x" });
      toast.info("two", { id: "x" });
    });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].message).toBe("two");
    act(() => {
      for (let i = 0; i < 10; i++) toast.info(`m${i}`);
    });
    expect(getToasts().length).toBeLessThanOrEqual(4);
  });

  it("renders only one container when several are mounted", () => {
    render(
      <>
        <ToastContainer />
        <ToastContainer />
      </>,
    );
    act(() => {
      toast.info("once");
    });
    expect(screen.getAllByRole("region", { name: "Notifications" })).toHaveLength(1);
  });
});
