"use client";

import React, { Suspense } from "react";
import { motion } from "framer-motion";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
    >
      {/* CalendarView reads deep-link params via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <CalendarView />
      </Suspense>
    </motion.div>
  );
}
