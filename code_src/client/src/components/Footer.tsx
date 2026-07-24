import { Github, Instagram, Linkedin, Rss } from "lucide-react";
import { motion } from "motion/react";

/**
 * 页脚链接分组配置
 * 每组包含：标题 + 多个链接项[标签, URL]
 */
const groups = [
    [
        "探索",
        ["关于我", "/about"],
        ["文章记录", "/articles"],
        ["作品集", "/projects"],
        ["联系我", "/contact"],
    ],
    [
        "星球计划",
        ["设计实验", "/projects"],
        ["开发日志", "/articles"],
        ["未来清单", "/about"],
    ],
    [
        "保持联系",
        ["GitHub", "https://github.com"],
        ["邮箱联系", "mailto:hello@example.com"],
        ["订阅更新", "/contact"],
    ],
];

/**
 * 页脚组件
 * 包含品牌信息、导航链接分组、社交媒体图标和版权信息
 * 使用 Framer Motion 实现滚动入场动画
 */
export default function Footer() {
    return (
        <motion.footer
            className="liquid-footer"
            initial={false}                          // 不使用初始状态
            whileInView={{ opacity: [0.18, 1], y: [32, 0] }} // 进入视口时的动画效果
            viewport={{ once: false, amount: 0.15 }}         // 视口检测配置
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} // 动画过渡配置
        >
            <div className="footer-grid">
                {/* 品牌信息区域 */}
                <div className="footer-brand">
                    <div className="footer-mark">✦</div>
                    <strong>B-612星球</strong>
                    <p>
                        记录思考、作品与成长。在代码和想象之间，缓慢构建属于自己的数字宇宙。
                    </p>
                </div>

                {/* 导航链接分组 */}
                <div className="footer-links">
                    {groups.map(([title, ...items]) => (
                        <div key={title as string}>
                            <h3>{title as string}</h3>
                            {items.map(([label, href]) => (
                                <a key={label as string} href={href as string}>
                                    {label as string}
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* 底部信息区域 */}
            <div className="footer-bottom">
                {/* 版权信息 */}
                <p>© 2026 B-612 PLANET · ALL SIGNALS OPEN</p>
                
                {/* 社交媒体链接 */}
                <div>
                    <span>保持连接</span>
                    <a href="https://github.com" aria-label="GitHub">
                        <Github size={16} />
                    </a>
                    <a href="#" aria-label="LinkedIn">
                        <Linkedin size={16} />
                    </a>
                    <a href="#" aria-label="Instagram">
                        <Instagram size={16} />
                    </a>
                    <a href="#" aria-label="RSS">
                        <Rss size={16} />
                    </a>
                </div>
            </div>
        </motion.footer>
    );
}