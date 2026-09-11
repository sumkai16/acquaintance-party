export type RegistrationSortColumn = "name" | "amount" | "submitted";

export const SORT_COLUMNS: readonly RegistrationSortColumn[] = [
  "name",
  "amount",
  "submitted",
];

/**
 * What each sortable header actually orders by in Postgres.
 *
 * Sorting used to happen in JS over the fetched rows. That stopped being
 * correct when the Dashboard started fetching one page at a time: sorting
 * there would reorder only the rows on screen, so "Amount, highest first"
 * would show the highest of *this page* while presenting itself as the
 * highest overall. Ordering belongs next to the pagination, in the query.
 *
 * Name ordering is now Postgres collation rather than `toLowerCase()`. On
 * the default en_US.UTF-8 collation that reads the same to a human — case
 * is not a primary sort key — and it is the only version that can order
 * rows the page has not fetched.
 */
export const REGISTRATION_SORT_COLUMNS: Record<RegistrationSortColumn, string> = {
  name: "full_name",
  amount: "amount",
  submitted: "created_at",
};
