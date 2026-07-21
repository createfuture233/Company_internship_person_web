import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { apiBase } from "../lib/api";
type Item = {
    id: number;
    name: string;
    email: string;
    message: string;
    status: string;
    createdAt: string;
};
const format = (v: string) =>
    new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(v));
export default function AdminMessages() {
    const [items, setItems] = useState<Item[]>([]);
    const [filter, setFilter] = useState("");
    const [notice, setNotice] = useState("");
    const headers = () => ({
        Authorization:
            "Bearer " + localStorage.getItem("personal-planet-admin-token"),
    });
    const load = () =>
        fetch(apiBase + "/admin/messages" + (filter ? "?status=" + filter : ""), {
            headers: headers(),
        })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then(setItems)
            .catch(() => setNotice("无法读取联系信息，请重新登录。"));
    useEffect(() => {
        load();
    }, [filter]);
    async function update(id: number, status: string) {
        const r = await fetch(apiBase + "/admin/messages/" + id, {
            method: "PATCH",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        if (r.ok) load();
        else setNotice("状态更新失败。");
    }
    async function remove(id: number) {
        if (!confirm("确定删除这条联系信息吗？")) return;
        const r = await fetch(apiBase + "/admin/messages/" + id, {
            method: "DELETE",
            headers: headers(),
        });
        if (r.ok) load();
        else setNotice("删除失败。");
    }
    return (
        <section className="admin-module">
            <p className="eyebrow">MESSAGES</p>
            <h1>联系信息</h1>
            <div className="admin-toolbar">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="">全部状态</option>
                    <option value="unread">未读</option>
                    <option value="read">已读</option>
                    <option value="replied">已回复</option>
                    <option value="archived">已归档</option>
                </select>
            </div>
            {notice && <p className="admin-notice">{notice}</p>}
            <div className="admin-list">
                {items.map((i) => (
                    <article key={i.id}>
                        <div>
                            <strong>
                                {i.name} <small>· {i.email}</small>
                            </strong>
                            <span>{format(i.createdAt)}</span>
                            <p>{i.message}</p>
                        </div>
                        <div className="admin-row-actions">
                            <select
                                value={i.status}
                                onChange={(e) => update(i.id, e.target.value)}
                            >
                                <option value="unread">未读</option>
                                <option value="read">已读</option>
                                <option value="replied">已回复</option>
                                <option value="archived">已归档</option>
                            </select>
                            <button onClick={() => remove(i.id)} title="删除">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </article>
                ))}
            </div>
            {!items.length && <p className="admin-state">暂无联系信息。</p>}
        </section>
    );
}
