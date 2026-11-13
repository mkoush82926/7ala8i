import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "en" }) }));

import { Dialog, Drawer } from "./dialog";

function Harness({ onClose, drawer = false }: { onClose?: () => void; drawer?: boolean }) {
  const [open, setOpen] = useState(false);
  const Comp = drawer ? Drawer : Dialog;
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <Comp
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Edit profile"
        description="Update your details"
      >
        <input aria-label="name" data-autofocus />
        <button>save</button>
      </Comp>
    </>
  );
}

describe("Dialog", () => {
  it("renders an accessible modal dialog when open", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("Edit profile");
    expect(dialog).toHaveAccessibleDescription("Update your details");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("moves focus inside, closes on Escape and restores focus", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByText("open");
    trigger.focus();
    await userEvent.click(trigger);
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByLabelText("name")).toHaveFocus());

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("traps Tab inside the dialog", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByLabelText("name")).toHaveFocus());
    // name -> save -> close -> wraps to name
    await userEvent.tab();
    expect(screen.getByText("save")).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText("name")).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("locks body scroll while open", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByText("open"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the drawer variant with dialog semantics", async () => {
    render(<Harness drawer />);
    await userEvent.click(screen.getByText("open"));
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Edit profile");
  });
});
