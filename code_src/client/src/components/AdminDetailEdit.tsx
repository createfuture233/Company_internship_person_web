import { Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function AdminDetailEdit({ type, id }: { type: 'article' | 'project'; id: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(Boolean(localStorage.getItem('personal-planet-admin-token')))
  }, [])

  if (!visible) return null

  return <a className="admin-detail-edit" href={'/admin?type=' + type + '&id=' + encodeURIComponent(id)}>
    <Pencil size={16} /> 修改内容
  </a>
}