// The rotation planner is entirely localStorage-backed and user-specific.
// SSR is disabled to prevent hydration mismatches between the server's blank
// initial state and the client's real localStorage data.
export const ssr = false;
