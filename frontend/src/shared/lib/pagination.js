export const PAGE_SIZE = 10

export function pageParams(page = 1) {
  return {
    page,
    page_size: PAGE_SIZE,
  }
}

export function normalizePaginatedResponse(response) {
  const results = Array.isArray(response)
    ? response
    : Array.isArray(response?.results)
      ? response.results
      : []

  return {
    count: Number.isFinite(Number(response?.count)) ? Number(response.count) : results.length,
    next: response?.next || null,
    previous: response?.previous || null,
    results,
  }
}

export function resetPageOnChange(setPage, update) {
  setPage(1)
  update()
}
