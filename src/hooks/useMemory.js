// useMemory.js
// Fetches and assembles the user's memory brief from Supabase.
// Pulls: profile, memory doc (program_changes, decisions, signals),
//        recent sessions (last 4 weeks full, older compressed).
// Returns the pre-built brief string ready for prompt injection.
// Caches in component state — refetch on session complete or program change.
// Returns: { brief, isLoading, refresh }

export function useMemory(userId) {
  return {
    brief: '',
    isLoading: false,
    refresh: async () => {},
  }
}
