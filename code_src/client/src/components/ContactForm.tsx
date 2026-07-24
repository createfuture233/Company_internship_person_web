import { useState } from "react";
import type { FormEvent } from "react";
import { apiBase } from "../lib/api";

/**
 * 表单状态类型
 */
type FormState = "idle" | "sending" | "success" | "error";

/**
 * 联系表单组件
 * 用于收集访客的留言信息并发送到后端
 */
export default function ContactForm() {
  const [state, setState] = useState<FormState>("idle"); // 表单状态
  const [message, setMessage] = useState(""); // 反馈消息

  /**
   * 提交表单
   * @param event - 表单提交事件
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    
    // 构建请求体
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };

    // 设置发送状态
    setState("sending");
    setMessage("正在发送，请稍候…");

    try {
      // 发送请求到后端
      const response = await fetch(`${apiBase}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      // 处理响应
      if (!response.ok) throw new Error(result?.message ?? "提交失败");
      
      // 重置表单并显示成功消息
      form.reset();
      setState("success");
      setMessage("消息已收到，我会尽快回复你。");
    } catch {
      // 显示错误消息
      setState("error");
      setMessage("发送失败，请确认后端服务已启动后重试。");
    }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      {/* 姓名输入 */}
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

      {/* 邮箱输入 */}
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

      {/* 消息内容 */}
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

      {/* 提交按钮 */}
      <button
        className="primary-button"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "正在发送…" : "发送消息 ↗"}
      </button>

      {/* 反馈消息 */}
      {message && (
        <p className={`contact-feedback ${state}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}