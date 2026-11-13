"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { SettingsPage } from "@/components/settings/settings-page";
import { ListSkeleton } from "@/components/ui/skeleton";

export default function SettingsRoute() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
    >
      {/* SettingsPage reads ?tab= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <SettingsPage />
      </Suspense>
    </motion.div>
  );
}
