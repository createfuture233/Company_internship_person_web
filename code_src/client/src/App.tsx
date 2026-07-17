import { FormEvent, useEffect, useState } from 'react'
import { ArrowDown, ArrowUpRight, Github, Mail, Menu, Moon, Search, Sun, X } from 'lucide-react'

type Article = { id: number; title: string; excerpt: string; tag: string; date: string; minutes: number }
const articles: Article[] = [
  { id: 1, title: '从灵感到上线：我的个人网站规划', excerpt: '把模糊的想法拆成可执行的页面、内容和技术选择。', tag: '随笔', date: '2026.07.17', minutes: 5 },
  { id: 2, title: '为网页加入有呼吸感的动态背景', excerpt: '记录手绘风动效与性能之间的平衡方法。', tag: '前端', date: '2026.07.12', minutes: 8 },
  { id: 3, title: '用需求文档让创意落地', excerpt: '从用户场景、交互到验收标准的一次实践。', tag: '产品', date: '2026.07.06', minutes: 6 },
]
const projects = [
  { title: '个人星球', type: '个人网站', desc: '一座记录作品、思考与成长的数字花园。', stack: 'React · Vite · NestJS' },
  { title: '数据漫游图鉴', type: '可视化实验', desc: '将日常数据转化为可探索的叙事地图。', stack: 'TypeScript · Canvas' },
]

function App() {
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNotice('已收到你的消息，我会尽快回复。'); event.currentTarget.reset() }
  const visibleArticles = articles.filter((article) => article.title.includes(query) || article.tag.includes(query))

  return <main>
    <nav className="nav"><a className="brand" href="#home">个人<span>星球</span></a><div className={menuOpen ? 'links open' : 'links'}>
      {['关于', '文章', '作品', '联系'].map((item) => <a key={item} href={`#${item === '关于' ? 'about' : item === '文章' ? 'articles' : item === '作品' ? 'projects' : 'contact'}`} onClick={() => setMenuOpen(false)}>{item}</a>)}
    </div><div className="nav-actions"><button aria-label="切换主题" className="icon-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button aria-label="打开菜单" className="icon-button mobile" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div></nav>

    <section className="hero" id="home"><div className="orb orb-one" /><div className="orb orb-two" /><div className="hero-copy"><p className="eyebrow">WELCOME TO MY LITTLE PLANET</p><h1>把生活的灵感<br />画进<span>数字宇宙</span>。</h1><p className="lead">你好，我是一名持续探索设计、代码与表达的人。这里收集我的作品、文章，以及尚未完成的想法。</p><a className="primary-button" href="#articles">开始漫游 <ArrowDown size={17} /></a></div><div className="hero-art" aria-hidden="true"><div className="planet"><i /><i /><i /></div><div className="orbit"><b>✦</b></div><p>2026<br />PERSONAL<br />PLANET</p></div></section>

    <section className="section about" id="about"><p className="eyebrow">ABOUT ME</p><div className="two-column"><h2>我相信好的体验，<br />应该有一点<span>温度</span>。</h2><div><p>我喜欢把复杂的问题整理成清晰的路径，也喜欢为页面加入一点像手绘笔触般的意外感。</p><div className="skill-list"><span>React / Vite</span><span>TypeScript</span><span>产品设计</span><span>动态交互</span></div></div></div></section>

    <section className="section article-section" id="articles"><div className="section-heading"><div><p className="eyebrow">WRITING</p><h2>最近的<span>记录</span></h2></div><label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索文章" /></label></div><div className="article-grid">{visibleArticles.map((article, index) => <article className="article-card" key={article.id}><div className={`article-illustration illustration-${index + 1}`}><span>{article.tag}</span></div><p className="meta">{article.date} · {article.minutes} 分钟阅读</p><h3>{article.title}</h3><p>{article.excerpt}</p><button className="text-button">阅读文章 <ArrowUpRight size={16} /></button></article>)}</div>{visibleArticles.length === 0 && <p className="empty">没有找到相关的文章。</p>}</section>

    <section className="section projects" id="projects"><p className="eyebrow">SELECTED WORK</p><div className="section-heading"><h2>正在生长的<span>作品</span></h2><a className="text-button" href="#contact">一起合作 <ArrowUpRight size={16} /></a></div><div className="project-grid">{projects.map((project, index) => <article className={`project-card project-${index + 1}`} key={project.title}><p>{project.type}</p><h3>{project.title}</h3><p>{project.desc}</p><span>{project.stack}</span></article>)}</div></section>

    <section className="contact" id="contact"><div><p className="eyebrow">SAY HELLO</p><h2>有一个有趣的想法？<br /><span>来信聊聊。</span></h2><div className="contact-links"><a href="mailto:hello@example.com"><Mail size={18} /> hello@example.com</a><a href="https://github.com" target="_blank"><Github size={18} /> GitHub</a></div></div><form onSubmit={submit}><label>你的称呼<input required name="name" placeholder="怎么称呼你？" /></label><label>联系邮箱<input required type="email" name="email" placeholder="name@example.com" /></label><label>想说的话<textarea required name="message" rows={4} placeholder="写下你的想法吧…" /></label><button className="primary-button" type="submit">发送消息 <ArrowUpRight size={17} /></button>{notice && <p className="notice">{notice}</p>}</form></section>
    <footer><span>© 2026 个人星球</span><span>在代码与想象之间缓慢生长</span></footer>
  </main>
}
export default App
