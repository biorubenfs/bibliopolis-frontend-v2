/**
 * Statistics of a regular user (see GET /users/:id/stats in docs/api/users.md of the backend).
 * Only figures: the backend never sends library names or book data, for privacy.
 */
export interface UserStats {
  libraries: {
    count: number;
    /** Not rounded. A book in two libraries counts in both. 0 without libraries. */
    averageBooks: number;
    /** Books in the largest library, or null without libraries. */
    largestBooks: number | null;
  };
  books: {
    total: number;
    rated: number;
    unrated: number;
    withoutLibrary: number;
  };
  ratings: {
    /** Not rounded; null if no book is rated. */
    average: number | null;
    /** Always the ten keys, from "1" to "10". */
    distribution: Record<string, number>;
  };
}
