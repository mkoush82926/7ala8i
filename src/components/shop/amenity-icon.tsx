import React from "react";
import {
  Accessibility,
  Baby,
  Car,
  Check,
  Coffee,
  CreditCard,
  DoorOpen,
  Gamepad2,
  House,
  Smartphone,
  Snowflake,
  VolumeX,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/** Lucide icon names stored in amenities.icon → components. */
const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  car: Car,
  snowflake: Snowflake,
  "credit-card": CreditCard,
  smartphone: Smartphone,
  "door-open": DoorOpen,
  baby: Baby,
  accessibility: Accessibility,
  coffee: Coffee,
  "gamepad-2": Gamepad2,
  "volume-x": VolumeX,
  house: House,
};

export function amenityIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Check;
}

export function AmenityIcon({ name, size = 18, className }: { name: string | null | undefined; size?: number; className?: string }) {
  return React.createElement(amenityIcon(name), { size, "aria-hidden": true, className });
}
