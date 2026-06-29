import { ChevronLeft, ChevronRight } from 'lucide-react'

import { PAGE_SIZE } from '@shared/lib/pagination'

function getPageNumbers(totalPages) {
  if (totalPages > 7) {
    return []
  }

  return Array.from({ length: totalPages }, (_, index) => index + 1)
}

export function Pagination({
  currentPage,
  onPageChange,
  pageSize = PAGE_SIZE,
  totalCount,
}) {
  const totalPages = Math.ceil(Number(totalCount || 0) / pageSize)

  if (totalPages <= 1) {
    return null
  }

  const safePage = Math.min(Math.max(Number(currentPage || 1), 1), totalPages)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalCount)
  const pageNumbers = getPageNumbers(totalPages)

  function goToPage(nextPage) {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages)

    if (boundedPage !== safePage) {
      onPageChange(boundedPage)
    }
  }

  return (
    <div className="border-t border-hairline px-5 pb-2 pt-4">
      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-[12px] text-slate">
          Showing {start}-{end} of {totalCount} results
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-8 items-center rounded-lg border border-hairline bg-canvas px-3 text-[12px] font-semibold text-slate transition hover:bg-mist hover:text-ink disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
            disabled={safePage <= 1}
            onClick={() => goToPage(safePage - 1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            Prev
          </button>

          {pageNumbers.length > 0 ? (
            <div className="flex items-center gap-1">
              {pageNumbers.map((pageNumber) => (
                <button
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-lg text-[12px] transition',
                    pageNumber === safePage
                      ? 'bg-brand font-semibold text-white'
                      : 'text-slate hover:bg-mist hover:text-ink',
                  ].join(' ')}
                  key={pageNumber}
                  onClick={() => goToPage(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          ) : (
            <span className="px-2 text-[13px] font-medium text-ink">
              Page {safePage} of {totalPages}
            </span>
          )}

          <button
            className="inline-flex h-8 items-center rounded-lg border border-hairline bg-canvas px-3 text-[12px] font-semibold text-slate transition hover:bg-mist hover:text-ink disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40"
            disabled={safePage >= totalPages}
            onClick={() => goToPage(safePage + 1)}
            type="button"
          >
            Next
            <ChevronRight aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Pagination
