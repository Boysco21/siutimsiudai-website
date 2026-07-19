import { create } from "zustand";
import { ScannedIngredient } from "@/types";

// A tiny, in-memory hand-off between the camera screen and the review screen. NOT persisted: a
// half-reviewed scan is throwaway draft state, so it must never survive a reload or leak into the
// next scan. The camera writes the AI's guesses here, the review screen reads + edits them, and
// Confirm/cancel clears them. Keeping this out of pantryStore keeps the persisted pantry clean of
// unconfirmed AI output.
interface PantryScanState {
  draft: ScannedIngredient[];
  setDraft: (items: ScannedIngredient[]) => void;
  clearDraft: () => void;
}

export const usePantryScanStore = create<PantryScanState>((set) => ({
  draft: [],
  setDraft: (items) => set({ draft: items }),
  clearDraft: () => set({ draft: [] }),
}));
