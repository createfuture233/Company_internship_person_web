/**
 * 分页组件属性类型
 */
type PaginationProps = {
  currentPage: number              // 当前页码
  totalPages: number               // 总页数
  onPageChange: (page: number) => void // 页码变更回调
  label?: string                   // aria-label 标签
  alwaysShow?: boolean             // 是否始终显示（即使只有一页）
}

/**
 * 分页导航组件
 * 提供第一页、上一页、页码列表、下一页、最后一页的导航按钮
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  label = '分页',
  alwaysShow = false,
}: PaginationProps) {
  // 如果只有一页且不需要始终显示，则不渲染
  if (!alwaysShow && totalPages <= 1) return null

  // 生成页码数组
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav className="pagination admin-pagination" aria-label={label}>
      {/* 第一页按钮 */}
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(1)}>
        第一页
      </button>
      
      {/* 上一页按钮 */}
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        上一页
      </button>
      
      {/* 页码按钮列表 */}
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
      
      {/* 下一页按钮 */}
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        下一页
      </button>
      
      {/* 最后一页按钮 */}
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>
        最后一页
      </button>
    </nav>
  )
}