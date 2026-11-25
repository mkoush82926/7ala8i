"use client";

import React, { Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage() {
  // §7: enter = 280ms ease-enter with an 8px rise; opacity only under reduced motion.
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.05, 0.7, 0.1, 1] }}
    >
      {/* CalendarView reads deep-link params via useSearchParams, which needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <CalendarView />
      </Suspense>
    </motion.div>
  );
}
