import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { apiBase } from "../lib/api";
type Item = { key: string; value: string };
const defaults = [
    "site_name",
    "home_intro",
    "contact_email",
    "github_url",
    "seo_title",
    "seo_description",
];
export default function AdminSettings() {
    const [items, setItems] = useState<Item[]>([]);
    const [notice, setNotice] = useState("");
    const headers = () => ({
        Authorization:
            "Bearer " + localStorage.getItem("personal-planet-admin-token"),
    });
    useEffect(() => {
        fetch(apiBase + "/admin/settings", { headers: headers() })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data: Item[]) =>
                setItems(
                    data.length ? data : defaults.map((key) => ({ key, value: "" })),
                ),
            )
            .catch(() => setNotice("无法读取网站设置，请重新登录。"));
    }, []);
    function set(i: number, field: keyof Item, value: string) {
        setItems((old) =>
            old.map((x, index) => (index === i ? { ...x, [field]: value } : x)),
        );
    }
    function add() {
        setItems((old) => [...old, { key: "", value: "" }]);
    }
    async function save(e: FormEvent) {
        e.preventDefault();
        const valid = items.filter((i) => i.key.trim());
        const r = await fetch(apiBase + "/admin/settings", {
            method: "PATCH",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ settings: valid }),
        });
        setNotice(r.ok ? "设置已保存。" : "保存失败，请检查字段。");
    }
    return (
        <section className="admin-module">
            <p className="eyebrow">SETTINGS</p>
            <h1>网站设置</h1>
            <form className="admin-settings" onSubmit={save}>
                {items.map((i, index) => (
                    <div key={index}>
                        <input
                            value={i.key}
                            placeholder="设置键，例如 site_name"
                            onChange={(e) => set(index, "key", e.target.value)}
                        />
                        <textarea
                            value={i.value}
                            placeholder="设置值"
                            rows={2}
                            onChange={(e) => set(index, "value", e.target.value)}
                        />
                    </div>
                ))}
                <div className="admin-save-row">
                    <button className="admin-add-setting-button" type="button" onClick={add}>
                        <Plus size={17} />
                        新增设置项
                    </button>
                    <button className="comment-submit" type="submit">
                        <Save size={16} />
                        保存设置
                    </button>
                </div>
                {notice && <p className="admin-notice">{notice}</p>}
            </form>
        </section>
    );
}
