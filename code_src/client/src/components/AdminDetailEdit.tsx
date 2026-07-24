import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * 管理员详情编辑入口组件
 * 在文章或项目详情页显示"进入后台编辑"链接
 * 仅当用户已登录（本地存储有管理员令牌）时显示
 */
export default function AdminDetailEdit({
  type,
  id,
}: {
  type: "article" | "project";  // 内容类型
  id: string;                   // 内容ID
}) {
  const [visible, setVisible] = useState(false); // 是否显示编辑入口

  // 根据内容类型生成对应的后台编辑链接
  const adminEditHref =
    type === "article"
      ? `/admin/articles?id=${encodeURIComponent(id)}`
      : `/admin/projects?id=${encodeURIComponent(id)}`;

  /**
   * 组件挂载时检查管理员登录状态
   */
  useEffect(() => {
    setVisible(Boolean(localStorage.getItem("personal-planet-admin-token")));
  }, []);

  // 如果未登录则不渲染
  if (!visible) return null;

  return (
    <a
      className="admin-detail-edit"
      href={adminEditHref}
    >
      <Pencil size={16} /> 进入后台编辑
    </a>
  );
}