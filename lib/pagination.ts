export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

export function paginate(total: number, page: number, pageSize: number): {
  page: number;
  pageCount: number;
  start: number;
  end: number;
} {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount === 0) return { page: 1, pageCount: 0, start: 0, end: 0 };
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    page: current,
    pageCount,
    start: (current - 1) * pageSize + 1,
    end: Math.min(current * pageSize, total),
  };
}
