"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { tourForPath } from "@/lib/tours";
import { TourOverlay } from "./tour-overlay";

/**
 * Starts a page's tour the first time a new account opens that page, once
 * the intro has finished and the page has had a moment to render.
 */
export function TourController({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const tours = useStore((s) => s.settings.tours);
  const active = useUI((s) => s.tour);
  const anyDialogOpen = useUI(
    (s) => s.taskForm.open || !!s.detailId || s.blockerFor !== null || s.progressFor.open || s.sprintForm.open,
  );
  const startTour = useUI((s) => s.startTour);

  useEffect(() => {
    const id = tourForPath(pathname);
    if (!ready || !id || active || anyDialogOpen || !tours?.auto || tours.seen.includes(id)) return;
    const t = window.setTimeout(() => startTour(id), 700);
    return () => window.clearTimeout(t);
  }, [ready, pathname, tours, active, anyDialogOpen, startTour]);

  // Leaving the page ends its tour (it will offer again next visit if unfinished).
  useEffect(() => {
    const { tour, endTour } = useUI.getState();
    if (tour && tour.id !== tourForPath(pathname)) endTour();
  }, [pathname]);

  return <TourOverlay />;
}
