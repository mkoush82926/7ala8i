"use client";

import { useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useSupabaseQuery } from "@/hooks/use-supabase-query";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  getClients,
  createClientRecord,
  updateClientRecord,
  softDeleteClient,
  restoreClient,
  type ClientInput,
  type ClientRow,
} from "@/lib/queries/clients";

/** Stable, UI-mappable reasons a client mutation failed. */
export type ClientMutationErrorCode =
  | "DUPLICATE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NO_SHOP"
  | "UNKNOWN";

export class ClientMutationError extends Error {
  code: ClientMutationErrorCode;
  constructor(code: ClientMutationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ClientMutationError";
    this.code = code;
  }
}

/** Maps a PostgREST / Postgres error to a ClientMutationErrorCode. */
export function toClientMutationError(err: unknown): ClientMutationError {
  if (err instanceof ClientMutationError) return err;
  const e = (err ?? {}) as { code?: string; message?: string };
  switch (e.code) {
    case "23505":
      return new ClientMutationError("DUPLICATE", e.message);
    case "42501":
      return new ClientMutationError("FORBIDDEN", e.message);
    case "PGRST116":
      // .single() found no row: RLS hid it or it was already removed.
      return new ClientMutationError("NOT_FOUND", e.message);
    default:
      return new ClientMutationError("UNKNOWN", e.message);
  }
}

export interface ClientsPage {
  rows: ClientRow[];
  count: number;
}

/**
 * Paginated, searchable client list for the current shop, plus mutations.
 * Mutations throw a ClientMutationError on failure and refetch on success.
 * Soft-deleted clients are excluded everywhere.
 */
export function useClients({ page = 1, search = "" }: { page?: number; search?: string } = {}) {
  const shopId = useWorkspaceStore((s) => s.shopId);
  const supabase = useSupabase();

  const query = useSupabaseQuery<ClientsPage>(
    async () => {
      const { data, error, count } = await getClients(supabase, shopId, page, search);
      return {
        data: { rows: (data ?? []) as ClientRow[], count: count ?? 0 },
        error,
      };
    },
    [supabase, shopId, page, search],
    { enabled: !!shopId },
  );

  const { refetch } = query;

  const requireShop = useCallback(() => {
    if (!shopId) throw new ClientMutationError("NO_SHOP");
    return shopId;
  }, [shopId]);

  const addClient = useCallback(
    async (input: ClientInput): Promise<ClientRow> => {
      const sid = requireShop();
      const { data, error } = await createClientRecord(supabase, sid, input);
      if (error || !data) throw toClientMutationError(error);
      refetch();
      return data as ClientRow;
    },
    [supabase, requireShop, refetch],
  );

  const updateClient = useCallback(
    async (id: string, input: ClientInput): Promise<ClientRow> => {
      const sid = requireShop();
      const { data, error } = await updateClientRecord(supabase, sid, id, input);
      if (error || !data) throw toClientMutationError(error);
      refetch();
      return data as ClientRow;
    },
    [supabase, requireShop, refetch],
  );

  const deleteClient = useCallback(
    async (id: string): Promise<void> => {
      const sid = requireShop();
      const { error } = await softDeleteClient(supabase, sid, id);
      if (error) throw toClientMutationError(error);
      refetch();
    },
    [supabase, requireShop, refetch],
  );

  const restore = useCallback(
    async (id: string): Promise<void> => {
      const sid = requireShop();
      const { error } = await restoreClient(supabase, sid, id);
      if (error) throw toClientMutationError(error);
      refetch();
    },
    [supabase, requireShop, refetch],
  );

  return {
    clients: query.data?.rows ?? [],
    totalCount: query.data?.count ?? 0,
    loading: query.loading,
    initialLoading: query.initialLoading,
    refreshing: query.refreshing,
    error: query.error,
    refetch,
    addClient,
    updateClient,
    deleteClient,
    restoreClient: restore,
  };
}
