import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { apiBase } from "../lib/api";
import Pagination from "./Pagination";

type Item = {
  id: number;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
};

const statusText: Record<string, string> = {
  unread: "未读",
  read: "已读",
  replied: "已回复",
  archived: "已归档",
};

const format = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminMessagesV2() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const headers = () => ({
    Authorization: "Bearer " + localStorage.getItem("personal-planet-admin-token"),
  });

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const load = () =>
    fetch(apiBase + "/admin/messages" + (filter ? "?status=" + filter : ""), {
      headers: headers(),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: Item[]) => {
        setItems(data);
        setNotice("");
      })
      .catch(() => setNotice("无法读取联系信息，请重新登录。"));

  useEffect(() => {
    load();
    setPage(1);
  }, [filter]);

  async function update(id: number, status: string) {
    const response = await fetch(apiBase + "/admin/messages/" + id, {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok) load();
    else setNotice("状态更新失败。");
  }

  async function remove(id: number) {
    if (!confirm("确定删除这条联系信息吗？")) return;
    const response = await fetch(apiBase + "/admin/messages/" + id, {
      method: "DELETE",
      headers: headers(),
    });
    if (response.ok) load();
    else setNotice("删除失败。");
  }

  return (
    <section className="admin-module">
      <p className="eyebrow">MESSAGES</p>
      <h1>联系信息</h1>
      <div className="admin-toolbar">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">全部状态</option>
          <option value="unread">未读</option>
          <option value="read">已读</option>
          <option value="replied">已回复</option>
          <option value="archived">已归档</option>
        </select>
      </div>
      {notice && <p className="admin-notice">{notice}</p>}
      <div className="admin-list">
        {pagedItems.map((item) => (
          <article key={item.id}>
            <div>
              <strong>
                {item.name} <small>· {item.email}</small>
              </strong>
              <span>{format(item.createdAt)} · {statusText[item.status] ?? item.status}</span>
              <p>{item.message}</p>
            </div>
            <div className="admin-row-actions">
              <select value={item.status} onChange={(event) => update(item.id, event.target.value)}>
                <option value="unread">未读</option>
                <option value="read">已读</option>
                <option value="replied">已回复</option>
                <option value="archived">已归档</option>
              </select>
              <button onClick={() => remove(item.id)} title="删除">
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && <p className="admin-state">暂无联系信息。</p>}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        label="联系信息分页"
        alwaysShow
      />
    </section>
  );
}
