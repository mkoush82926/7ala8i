import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("is an alertdialog with translated default labels", async () => {
    render(<ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Delete lead?" />);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Delete lead?");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("focuses Cancel first for destructive confirmations", async () => {
    render(
      <ConfirmDialog open destructive onClose={() => {}} onConfirm={() => {}} title="Delete?" confirmLabel="Delete" />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("closes only after onConfirm succeeds", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Go?" />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("stays open and shows an error when onConfirm throws", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error("Network down"));
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Go?" />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables both buttons while loading", async () => {
    render(<ConfirmDialog open loading onClose={() => {}} onConfirm={() => {}} title="Go?" />);
    await screen.findByRole("alertdialog");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Processing/ })).toBeDisabled();
  });
});
