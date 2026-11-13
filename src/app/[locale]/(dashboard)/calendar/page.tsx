"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { TimelineView } from "@/components/calendar/timeline-view";

export default function CalendarPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
    >
      {/* TimelineView reads deep-link params via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <TimelineView />
      </Suspense>
    </motion.div>
  );
}
