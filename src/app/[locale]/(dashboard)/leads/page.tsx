"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { KanbanBoard } from "@/components/leads/kanban-board";

export default function LeadsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
    >
      {/* KanbanBoard reads deep-link params via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <KanbanBoard />
      </Suspense>
    </motion.div>
  );
}
