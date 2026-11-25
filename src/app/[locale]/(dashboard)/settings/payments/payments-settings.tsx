"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Banknote,
  CreditCard,
  Globe,
  Landmark,
  Loader2,
  Package,
  Pencil,
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { useTranslation, interpolate } from "@/hooks/use-translation";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { toast } from "@/components/ui/toast";
import { formatJOD } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "@/components/team/shifts";
import { mapPaymentMethodRow, parseMoneyInput, type PosPaymentMethod } from "@/hooks/use-pos";
import {
  METHOD_KINDS,
  methodCodeFor,
  swapSort,
  validateMethod,
  validateProduct,
  type MethodDraft,
  type MethodKind,
  type ProductDraft,
} from "./payments-logic";

const card = "flex flex-col gap-5 rounded-xl border border-line bg-card p-4 sm:p-6";
const h2 = "text-h3 m-0 text-ink";
const iconBtn =
  "focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30";

const KIND_ICON: Record<MethodKind, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  cliq: Smartphone,
  wallet: Wallet,
  bank_transfer: Landmark,
  online: Globe,
  other: Wallet,
};

interface ProductRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  price: number;
  sku: string | null;
  is_active: boolean;
  sort: number;
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-ring relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-block h-6 w-11 rounded-full transition-colors duration-150 motion-reduce:transition-none",
          checked ? "bg-brand" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-[inset-inline-start] duration-150 motion-reduce:transition-none",
            checked ? "start-[22px]" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

/** Payment methods (Cash, Card POS, CliQ, wallets, custom) and retail products. */
export function PaymentsSettings() {
  const { t, locale } = useTranslation();
  const tp = t.paymentSettings;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ── Methods ──
  const methods = useSupabaseQuery<PosPaymentMethod[]>(
    async () => {
      const res = await supabase.from("payment_methods").select("*").eq("shop_id", shopId).order("sort").order("created_at");
      return {
        data: ((res.data ?? []) as Record<string, unknown>[]).map(mapPaymentMethodRow),
        error: res.error ? { message: res.error.message } : null,
      };
    },
    [supabase, shopId],
    { enabled: !!shopId, retryCount: 0 },
  );
  const [editing, setEditing] = useState<PosPaymentMethod | "new" | null>(null);
  const [deleting, setDeleting] = useState<PosPaymentMethod | null>(null);

  const methodName = (m: PosPaymentMethod) => (locale === "ar" ? m.nameAr || m.nameEn : m.nameEn || m.nameAr) || m.code;

  async function patchMethod(m: PosPaymentMethod, patch: Record<string, unknown>, okMsg: string) {
    setBusyId(m.id);
    try {
      const { error } = await supabase.from("payment_methods").update(patch).eq("id", m.id);
      if (error) throw error;
      toast.success(okMsg);
      methods.refetch();
    } catch (err) {
      toast.error(dbErrorMessage(t, err, tp.saveFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function move(rows: { id: string; sort: number }[], index: number, dir: -1 | 1, table: "payment_methods" | "products", refetch: () => void) {
    const updates = swapSort(rows, index, dir);
    if (!updates.length) return;
    setBusyId(rows[index].id);
    try {
      for (const u of updates) {
        const { error } = await supabase.from(table).update({ sort: u.sort }).eq("id", u.id);
        if (error) throw error;
      }
      refetch();
    } catch (err) {
      toast.error(dbErrorMessage(t, err, tp.saveFailed));
    } finally {
      setBusyId(null);
    }
  }

  // ── Products ──
  const products = useSupabaseQuery<ProductRow[]>(
    async () => {
      const res = await supabase
        .from("products")
        .select("id, name_en, name_ar, price, sku, is_active, sort")
        .eq("shop_id", shopId)
        .order("sort")
        .order("name_en");
      return { data: (res.data ?? []) as ProductRow[], error: res.error ? { message: res.error.message } : null };
    },
    [supabase, shopId],
    { enabled: !!shopId, retryCount: 0 },
  );
  const [editingProduct, setEditingProduct] = useState<ProductRow | "new" | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);

  async function toggleProduct(p: ProductRow, active: boolean) {
    setBusyId(p.id);
    try {
      const { error } = await supabase.from("products").update({ is_active: active }).eq("id", p.id);
      if (error) throw error;
      toast.success(active ? tp.productShown : tp.productHidden);
      products.refetch();
    } catch (err) {
      toast.error(dbErrorMessage(t, err, tp.saveFailed));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Payment methods ── */}
      <section aria-labelledby="pm-title" className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pm-title" className={h2}>
              {tp.methodsTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{tp.methodsHelp}</p>
          </div>
          <button type="button" className="btn btn-secondary min-h-11 shrink-0" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{tp.addMethod}</span>
            <span className="sr-only sm:hidden">{tp.addMethod}</span>
          </button>
        </div>

        {methods.initialLoading ? (
          <ListSkeleton rows={4} />
        ) : methods.error ? (
          <EmptyState size="sm" tone="error" icon={AlertCircle} title={tp.loadFailed} action={{ label: t.common.retry, onClick: methods.refetch }} />
        ) : !methods.data?.length ? (
          <EmptyState size="sm" icon={Wallet} title={tp.noMethods} description={tp.noMethodsHint} action={{ label: tp.addMethod, onClick: () => setEditing("new") }} />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
            {methods.data.map((m, i, all) => {
              const Icon = KIND_ICON[m.kind] ?? Wallet;
              const name = methodName(m);
              return (
                <li key={m.id} className="flex items-center gap-2 rounded-xl border border-line py-1 pe-1 ps-3">
                  <Icon size={18} aria-hidden="true" className={m.isActive ? "text-ink" : "text-ink-muted"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("truncate text-sm font-semibold", m.isActive ? "text-ink" : "text-ink-muted")}>{name}</span>
                      <Pill tone="neutral" size="sm">
                        {(tp.kinds as Record<string, string>)[m.kind] ?? m.kind}
                      </Pill>
                    </div>
                    {m.kind === "cliq" && (
                      <span className="block truncate text-[12px] text-ink-soft">
                        {m.cliqAlias ? (
                          <>
                            {tp.cliqAlias}: <span dir="ltr">{m.cliqAlias}</span>
                          </>
                        ) : (
                          tp.cliqAliasMissing
                        )}
                        {m.qrUrl && <QrCode size={12} aria-label={tp.hasQr} className="ms-1 inline" />}
                      </span>
                    )}
                  </div>
                  <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} disabled={i === 0 || !!busyId} onClick={() => void move(all, i, -1, "payment_methods", methods.refetch)} aria-label={interpolate(tp.moveUp, { name })}>
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} disabled={i === all.length - 1 || !!busyId} onClick={() => void move(all, i, 1, "payment_methods", methods.refetch)} aria-label={interpolate(tp.moveDown, { name })}>
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => setEditing(m)} aria-label={interpolate(tp.editMethod, { name })}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  {!m.isSystem && (
                    <button type="button" className={cn(iconBtn, "hover:text-danger-text")} onClick={() => setDeleting(m)} aria-label={interpolate(tp.deleteMethod, { name })}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                  <Switch
                    checked={m.isActive}
                    disabled={busyId === m.id || (m.kind === "cliq" && !m.cliqAlias && !m.isActive)}
                    label={interpolate(tp.toggleMethod, { name })}
                    onChange={(v) => void patchMethod(m, { is_active: v }, v ? interpolate(tp.methodOn, { name }) : interpolate(tp.methodOff, { name }))}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="m-0 text-[12px] text-ink-muted">{tp.methodsFootnote}</p>
      </section>

      {/* ── Products ── */}
      <section aria-labelledby="pr-title" className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pr-title" className={h2}>
              {tp.productsTitle}
            </h2>
            <p className="m-0 mt-1 text-sm text-ink-soft">{tp.productsHelp}</p>
          </div>
          <button type="button" className="btn btn-secondary min-h-11 shrink-0" onClick={() => setEditingProduct("new")}>
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{tp.addProduct}</span>
            <span className="sr-only sm:hidden">{tp.addProduct}</span>
          </button>
        </div>
        {products.initialLoading ? (
          <ListSkeleton rows={2} />
        ) : products.error ? (
          <EmptyState size="sm" tone="error" icon={AlertCircle} title={tp.loadFailed} action={{ label: t.common.retry, onClick: products.refetch }} />
        ) : !products.data?.length ? (
          <EmptyState
            size="sm"
            icon={Package}
            title={tp.noProducts}
            description={tp.noProductsHint}
            action={{ label: tp.addProduct, onClick: () => setEditingProduct("new") }}
          />
        ) : (
          <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
            {products.data.map((p, i, all) => {
              const name = (locale === "ar" && p.name_ar) || p.name_en;
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line py-1 pe-1 ps-3">
                  <Package size={18} aria-hidden="true" className={p.is_active ? "text-ink" : "text-ink-muted"} />
                  <div className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", p.is_active ? "text-ink" : "text-ink-muted")}>{name}</span>
                    <span className="block text-[12px] text-ink-soft">
                      {formatJOD(Number(p.price), locale)}
                      {p.sku ? (
                        <>
                          {" · "}
                          <span dir="ltr">{p.sku}</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} disabled={i === 0 || !!busyId} onClick={() => void move(all, i, -1, "products", products.refetch)} aria-label={interpolate(tp.moveUp, { name })}>
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={cn(iconBtn, "hidden sm:inline-flex")} disabled={i === all.length - 1 || !!busyId} onClick={() => void move(all, i, 1, "products", products.refetch)} aria-label={interpolate(tp.moveDown, { name })}>
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={iconBtn} onClick={() => setEditingProduct(p)} aria-label={interpolate(tp.editProduct, { name })}>
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={cn(iconBtn, "hover:text-danger-text")} onClick={() => setDeletingProduct(p)} aria-label={interpolate(tp.deleteProduct, { name })}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                  <Switch checked={p.is_active} disabled={busyId === p.id} label={interpolate(tp.toggleProduct, { name })} onChange={(v) => void toggleProduct(p, v)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <MethodDialog
        target={editing}
        existingCodes={(methods.data ?? []).map((m) => m.code)}
        nextSort={Math.min(1000, Math.max(0, ...(methods.data ?? []).map((m) => m.sort)) + 10)}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          methods.refetch();
        }}
      />
      <ProductDialog
        target={editingProduct}
        nextSort={Math.min(10000, Math.max(0, ...(products.data ?? []).map((p) => p.sort)) + 10)}
        onClose={() => setEditingProduct(null)}
        onSaved={() => {
          setEditingProduct(null);
          products.refetch();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const { error } = await supabase.from("payment_methods").delete().eq("id", deleting.id);
          if (error) throw new Error(error.code === "23503" ? tp.methodInUse : dbErrorMessage(t, error, tp.deleteFailed));
          toast.success(tp.methodDeleted);
          methods.refetch();
        }}
        title={tp.deleteMethodTitle}
        description={deleting ? `${methodName(deleting)} · ${tp.deleteMethodHint}` : undefined}
        confirmLabel={t.common.delete}
        destructive
      />
      <ConfirmDialog
        open={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={async () => {
          if (!deletingProduct) return;
          const { error } = await supabase.from("products").delete().eq("id", deletingProduct.id);
          if (error) throw new Error(dbErrorMessage(t, error, tp.deleteFailed));
          toast.success(tp.productDeleted);
          products.refetch();
        }}
        title={tp.deleteProductTitle}
        description={deletingProduct ? `${(locale === "ar" && deletingProduct.name_ar) || deletingProduct.name_en} · ${tp.deleteProductHint}` : undefined}
        confirmLabel={t.common.delete}
        destructive
      />
    </div>
  );
}

// ─── Method add/edit ─────────────────────────────────────────────────────────

function MethodDialog({
  target,
  existingCodes,
  nextSort,
  onClose,
  onSaved,
}: {
  target: PosPaymentMethod | "new" | null;
  existingCodes: string[];
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const tp = t.paymentSettings;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const isNew = target === "new";
  const m = target && target !== "new" ? target : null;
  const blank: MethodDraft = { nameEn: "", nameAr: "", kind: "other", cliqAlias: "", qrUrl: "" };
  const [draft, setDraft] = useState<MethodDraft>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prev, setPrev] = useState<typeof target>(null);
  if (target !== prev) {
    setPrev(target);
    setError(null);
    setDraft(m ? { nameEn: m.nameEn, nameAr: m.nameAr, kind: m.kind, cliqAlias: m.cliqAlias ?? "", qrUrl: m.qrUrl ?? "" } : blank);
  }

  async function save() {
    const issue = validateMethod(draft);
    if (issue) {
      setError(issue === "NAME_EN" ? tp.nameEnRequired : issue === "NAME_AR" ? tp.nameArRequired : issue === "QR_URL" ? tp.qrInvalid : tp.aliasInvalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name_en: draft.nameEn.trim(),
        name_ar: draft.nameAr.trim(),
        cliq_alias: draft.cliqAlias.trim() || null,
        qr_url: draft.qrUrl.trim() || null,
      };
      const res = m
        ? await supabase.from("payment_methods").update(m.isSystem ? fields : { ...fields, kind: draft.kind }).eq("id", m.id)
        : await supabase.from("payment_methods").insert({
            ...fields,
            shop_id: shopId,
            kind: draft.kind,
            code: methodCodeFor(draft.nameEn, existingCodes),
            is_active: true,
            is_system: false,
            sort: nextSort,
          });
      if (res.error) throw res.error;
      toast.success(isNew ? tp.methodAdded : tp.methodSaved);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, tp.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  const kindLocked = !!m?.isSystem;
  const showCliq = draft.kind === "cliq" || draft.kind === "wallet";

  return (
    <Dialog
      open={!!target}
      onClose={() => !saving && onClose()}
      closeOnBackdrop={!saving}
      size="md"
      title={isNew ? tp.addMethod : tp.editMethodTitle}
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? t.common.processing : t.common.save}
          </button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pm-name-ar" className="field-label">
              {tp.nameAr}
            </label>
            <input id="pm-name-ar" dir="rtl" lang="ar" maxLength={60} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className="field-input" data-autofocus="" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pm-name-en" className="field-label">
              {tp.nameEn}
            </label>
            <input id="pm-name-en" dir="ltr" lang="en" maxLength={60} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className="field-input" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-kind" className="field-label">
            {tp.kind}
          </label>
          <select
            id="pm-kind"
            value={draft.kind}
            disabled={kindLocked}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as MethodKind })}
            className="field-input"
            aria-describedby={kindLocked ? "pm-kind-hint" : undefined}
          >
            {METHOD_KINDS.map((k) => (
              <option key={k} value={k}>
                {(tp.kinds as Record<string, string>)[k] ?? k}
              </option>
            ))}
          </select>
          {kindLocked && (
            <span id="pm-kind-hint" className="text-[12px] text-ink-muted">
              {tp.kindLocked}
            </span>
          )}
        </div>
        {showCliq && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="pm-alias" className="field-label">
                {draft.kind === "cliq" ? tp.cliqAlias : tp.walletNumber}
              </label>
              <input id="pm-alias" dir="ltr" maxLength={64} value={draft.cliqAlias} onChange={(e) => setDraft({ ...draft, cliqAlias: e.target.value })} className="field-input" aria-describedby="pm-alias-hint" />
              <span id="pm-alias-hint" className="text-[12px] text-ink-muted">
                {tp.aliasHint}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pm-qr" className="field-label">
                {tp.qrUrl}
              </label>
              <input id="pm-qr" dir="ltr" type="url" inputMode="url" maxLength={1000} placeholder="https://" value={draft.qrUrl} onChange={(e) => setDraft({ ...draft, qrUrl: e.target.value })} className="field-input" />
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="field-error m-0">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

// ─── Product add/edit ────────────────────────────────────────────────────────

function ProductDialog({
  target,
  nextSort,
  onClose,
  onSaved,
}: {
  target: ProductRow | "new" | null;
  nextSort: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const tp = t.paymentSettings;
  const supabase = useSupabase();
  const shopId = useWorkspaceStore((s) => s.shopId);
  const p = target && target !== "new" ? target : null;
  const blank: ProductDraft = { nameEn: "", nameAr: "", price: "", sku: "" };
  const [draft, setDraft] = useState<ProductDraft>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prev, setPrev] = useState<typeof target>(null);
  if (target !== prev) {
    setPrev(target);
    setError(null);
    setDraft(p ? { nameEn: p.name_en, nameAr: p.name_ar ?? "", price: String(Number(p.price)), sku: p.sku ?? "" } : blank);
  }

  async function save() {
    const issue = validateProduct(draft, parseMoneyInput);
    if (issue) {
      setError(issue === "NAME_EN" ? tp.nameEnRequired : issue === "PRICE" ? tp.priceInvalid : issue === "SKU" ? tp.skuInvalid : tp.nameArRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fields = {
        name_en: draft.nameEn.trim(),
        name_ar: draft.nameAr.trim() || null,
        price: parseMoneyInput(draft.price) ?? 0,
        sku: draft.sku.trim() || null,
      };
      const res = p
        ? await supabase.from("products").update(fields).eq("id", p.id)
        : await supabase.from("products").insert({ ...fields, shop_id: shopId, sort: nextSort });
      if (res.error) throw res.error;
      toast.success(p ? tp.productSaved : tp.productAdded);
      onSaved();
    } catch (err) {
      setError(dbErrorMessage(t, err, tp.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!target}
      onClose={() => !saving && onClose()}
      closeOnBackdrop={!saving}
      size="md"
      title={p ? tp.editProductTitle : tp.addProduct}
      footer={
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t.common.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? t.common.processing : t.common.save}
          </button>
        </DialogFooter>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pr-name-ar" className="field-label">
              {tp.nameArOptional}
            </label>
            <input id="pr-name-ar" dir="rtl" lang="ar" maxLength={80} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} className="field-input" data-autofocus="" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pr-name-en" className="field-label">
              {tp.nameEn}
            </label>
            <input id="pr-name-en" dir="ltr" lang="en" maxLength={80} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} className="field-input" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pr-price" className="field-label">
              {tp.priceInclTax}
            </label>
            <input id="pr-price" dir="ltr" inputMode="decimal" placeholder="0.000" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="field-input tabular-nums" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pr-sku" className="field-label">
              {tp.skuOptional}
            </label>
            <input id="pr-sku" dir="ltr" maxLength={64} value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} className="field-input" />
          </div>
        </div>
        <p className="m-0 text-[12px] text-ink-muted">{tp.noStockNote}</p>
        {error && (
          <p role="alert" className="field-error m-0">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
