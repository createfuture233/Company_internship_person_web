import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Save } from "lucide-react";
import { apiBase } from "../lib/api";

/** 设置项数据结构 */
type Item = { key: string; value: string };

/** 默认设置项列表 */
const defaults = [
    "site_name",
    "home_intro",
    "contact_email",
    "github_url",
    "seo_title",
    "seo_description",
];

/**
 * 网站设置管理组件
 * 用于管理站点的各种配置项
 */
export default function AdminSettings() {
    const [items, setItems] = useState<Item[]>([]); // 设置项列表
    const [notice, setNotice] = useState("");       // 操作提示

    /**
     * 获取请求头（包含认证令牌）
     */
    const headers = () => ({
        Authorization:
            "Bearer " + localStorage.getItem("personal-planet-admin-token"),
    });

    /**
     * 组件挂载时加载设置项
     */
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

    /**
     * 更新指定索引的设置项字段
     * @param i - 索引
     * @param field - 字段名（key 或 value）
     * @param value - 新值
     */
    function set(i: number, field: keyof Item, value: string) {
        setItems((old) =>
            old.map((x, index) => (index === i ? { ...x, [field]: value } : x)),
        );
    }

    /**
     * 添加新的设置项
     */
    function add() {
        setItems((old) => [...old, { key: "", value: "" }]);
    }

    /**
     * 保存设置
     * @param e - 表单提交事件
     */
    async function save(e: FormEvent) {
        e.preventDefault();
        // 过滤掉键为空的设置项
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