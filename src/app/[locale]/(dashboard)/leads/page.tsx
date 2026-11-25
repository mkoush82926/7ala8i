"use client";

import React, { Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { KanbanBoard } from "@/components/leads/kanban-board";

export default function LeadsPage() {
  // §7: enter = 280ms ease-enter with an 8px rise; opacity only under reduced motion.
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.05, 0.7, 0.1, 1] }}
    >
      {/* KanbanBoard reads deep-link params via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <KanbanBoard />
      </Suspense>
    </motion.div>
  );
}
