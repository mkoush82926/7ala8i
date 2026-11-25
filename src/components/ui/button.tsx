import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonClasses, spinnerClasses, type ButtonSize, type ButtonVariant } from "./recipes";

/**
 * v2 Button (§5.1): fully-rounded pill, teal primary, one primary per surface.
 * Server-safe (no hooks). Destructive actions must go through <ConfirmDialog/>.
 *
 *   <Button onClick={save}>Save</Button>
 *   <Button variant="secondary" size="sm" icon={<Plus aria-hidden />}>Add</Button>
 *   <Button variant="ghost" size="icon" aria-label={t.common.close}><X aria-hidden /></Button>
 *   <Button loading={pending}>Confirm</Button>           // keeps width, aria-busy
 *   <ButtonLink href={href("/explore")} variant="ink" size="lg">Search</ButtonLink>
 */
export type { ButtonVariant, ButtonSize } from "./recipes";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon (decorative; mark it aria-hidden). */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. a chevron (add rtl:rotate-180 for direction). */
  iconEnd?: React.ReactNode;
  /** Show a spinner and set aria-busy; the button is disabled meanwhile. */
  loading?: boolean;
  fullWidth?: boolean;
}

export interface ButtonProps extends ButtonOwnProps, React.ButtonHTMLAttributes<HTMLButtonElement> {}

function Content({
  icon,
  iconEnd,
  loading,
  children,
}: Pick<ButtonOwnProps, "icon" | "iconEnd" | "loading"> & { children?: React.ReactNode }) {
  return (
    <>
      {loading ? <span aria-hidden="true" className={spinnerClasses} /> : icon}
      {children}
      {iconEnd}
    </>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconEnd, loading = false, fullWidth = false, className, disabled, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      <Content icon={icon} iconEnd={iconEnd} loading={loading}>
        {children}
      </Content>
    </button>
  );
});

export interface ButtonLinkProps
  extends Omit<ButtonOwnProps, "loading">,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  /** next/link prefetch (default: Next's default). */
  prefetch?: boolean;
  /** Render a plain <a> (external links, downloads). */
  external?: boolean;
}

/** A link that looks like a button (navigation, not actions). */
export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = "primary", size = "md", icon, iconEnd, fullWidth = false, className, href, prefetch, external = false, children, ...rest },
  ref,
) {
  const classes = cn(buttonClasses({ variant, size, fullWidth }), className);
  const content = (
    <Content icon={icon} iconEnd={iconEnd}>
      {children}
    </Content>
  );
  if (external) {
    return (
      <a ref={ref} href={href} data-variant={variant} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} prefetch={prefetch} data-variant={variant} className={classes} {...rest}>
      {content}
    </Link>
  );
});

export default Button;
