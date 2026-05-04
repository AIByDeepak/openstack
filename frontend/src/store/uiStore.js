import { create } from "zustand";

// Global UI store — mock-mode flag + per-endpoint stale tracking.
export const useUiStore = create((set) => ({
    isMockMode: false,
    lastEndpointError: null,
    setMockMode: (v) => set({ isMockMode: v }),
    setEndpointError: (err) => set({ lastEndpointError: err }),
}));
