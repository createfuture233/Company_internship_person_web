type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  label?: string
  alwaysShow?: boolean
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label = '分页',
  alwaysShow = false,
}: PaginationProps) {
  if (!alwaysShow && totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav className="pagination admin-pagination" aria-label={label}>
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(1)}>
        第一页
      </button>
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        上一页
      </button>
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          className={page === currentPage ? 'active' : ''}
          aria-current={page === currentPage ? 'page' : undefined}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        下一页
      </button>
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>
        最后一页
      </button>
    </nav>
  )
}
