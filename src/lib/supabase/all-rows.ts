/**
 * Supabase's API returns at most 1000 rows per request and says nothing when
 * it cuts a longer table off. A query that must see every row — the door
 * scanner's ticket list, the voter list — has to ask page by page, or a table
 * that grows past 1000 silently loses its tail and real students are turned
 * away. 783 tickets were approved the night before the event, so this is not
 * hypothetical.
 *
 * `fetchPage` gets an inclusive row range. Give the query a stable
 * `.order(...)` so pages don't overlap or skip. Throws the first database
 * error: half a ticket list is worse than a failed load, which callers
 * already handle.
 */
const PAGE_SIZE = 1000;

export async function allRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}
