"use client";

import { useTranslation } from "@/hooks/use-translation";
import type { StepErrors, WizardDraft } from "../_lib/wizard";
import { StepHeader, TextField } from "./ui";

export interface StepProps {
  draft: WizardDraft;
  update: (fn: (d: WizardDraft) => WizardDraft) => void;
  errors: StepErrors;
}

export function StepShop({ draft, update, errors }: StepProps) {
  const { t } = useTranslation();
  const s = t.start;
  const err = (k: string) => (errors[k] ? s.errors[errors[k] as keyof typeof s.errors] : null);
  const set = (key: keyof WizardDraft["shop"]) => (e: React.ChangeEvent<HTMLInputElement>) =>
    update((d) => ({ ...d, shop: { ...d.shop, [key]: e.target.value } }));

  return (
    <div>
      <StepHeader title={s.shop.title} subtitle={s.shop.subtitle} />
      <div className="flex flex-col gap-4">
        <TextField
          label={s.shop.nameArLabel}
          dir="rtl"
          lang="ar"
          autoComplete="organization"
          placeholder={s.shop.nameArPlaceholder}
          value={draft.shop.nameAr}
          onChange={set("nameAr")}
          maxLength={100}
          error={err("nameAr") ?? err("name")}
        />
        <TextField
          label={s.shop.nameEnLabel}
          dir="ltr"
          lang="en"
          placeholder={s.shop.nameEnPlaceholder}
          value={draft.shop.nameEn}
          onChange={set("nameEn")}
          maxLength={100}
          hint={s.shop.nameEnHint}
          error={err("nameEn")}
        />
        <TextField
          label={s.shop.phoneLabel}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder={s.account.phonePlaceholder}
          value={draft.shop.phone}
          onChange={set("phone")}
          hint={s.shop.phoneHint}
          error={err("phone")}
        />
      </div>
    </div>
  );
}
