import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminDetailEdit({
  type,
  id,
}: {
  type: "article" | "project";
  id: string;
}) {
  const [visible, setVisible] = useState(false);
  const adminEditHref =
    type === "article"
      ? `/admin/articles?id=${encodeURIComponent(id)}`
      : `/admin/projects?id=${encodeURIComponent(id)}`;

  useEffect(() => {
    setVisible(Boolean(localStorage.getItem("personal-planet-admin-token")));
  }, []);

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
