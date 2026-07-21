import { apiBase } from "../lib/api";
import { Shield, X } from "lucide-react";
import { useState } from "react";

export default function AdminPlanetLogin() {
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function login(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      const response = await fetch(apiBase + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("login failed");
      const data = (await response.json()) as { token: string };
      localStorage.setItem("personal-planet-admin-token", data.token);
      window.location.href = "/admin";
    } catch {
      setStatus("账号或密码错误，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="admin-planet-trigger"
        type="button"
        aria-label="管理员登录"
        onClick={() => setShowLogin(true)}
      >
        <span>管理员入口</span>
      </button>
      {showLogin && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowLogin(false)}
        >
          <section
            className="admin-login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-login-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              type="button"
              aria-label="关闭登录窗口"
              onClick={() => setShowLogin(false)}
            >
              <X size={18} />
            </button>
            <span className="admin-login-mark">
              <Shield size={21} />
            </span>
            <p className="eyebrow">ADMIN ACCESS</p>
            <h2 id="admin-login-title">管理这颗星球</h2>
            <p>登录后可编辑文章与作品详情。</p>
            <form onSubmit={login}>
              <label>
                账号
                <input
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="管理员账号"
                />
              </label>
              <label>
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="管理员密码"
                />
              </label>
              <p className="admin-login-status" aria-live="polite">
                {status}
              </p>
              <button
                className="comment-submit"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "验证中…" : "登录管理台"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
