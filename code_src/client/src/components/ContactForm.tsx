import { useState } from "react";
import type { FormEvent } from "react";
import { apiBase } from "../lib/api";

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };

    setState("sending");
    setMessage("正在发送，请稍候…");
    try {
      const response = await fetch(`${apiBase}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) throw new Error(result?.message ?? "提交失败");
      form.reset();
      setState("success");
      setMessage("消息已收到，我会尽快回复你。");
    } catch {
      setState("error");
      setMessage("发送失败，请确认后端服务已启动后重试。");
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <label>
        你的称呼
        <input
          required
          name="name"
          maxLength={60}
          autoComplete="name"
          placeholder="怎么称呼你？"
        />
      </label>
      <label>
        联系邮箱
        <input
          required
          type="email"
          name="email"
          maxLength={254}
          autoComplete="email"
          placeholder="name@example.com"
        />
      </label>
      <label>
        想说的话
        <textarea
          required
          name="message"
          maxLength={2000}
          rows={5}
          placeholder="写下你的想法吧…"
        />
      </label>
      <button
        className="primary-button"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "正在发送…" : "发送消息 ↗"}
      </button>
      {message && (
        <p className={`contact-feedback ${state}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
