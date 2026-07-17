import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const links = [{ href: '/about', label: '关于' }, { href: '/articles', label: '文章' }, { href: '/projects', label: '作品' }, { href: '/contact', label: '联系' }]

export default function Navigation() {
  const [dark, setDark] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => { const saved = localStorage.getItem('personal-planet-theme'); setDark(saved === 'dark') }, [])
  useEffect(() => { const theme = dark ? 'dark' : 'light'; document.documentElement.dataset.theme = theme; localStorage.setItem('personal-planet-theme', theme) }, [dark])
  const current = typeof window === 'undefined' ? '' : window.location.pathname
  return <nav className="nav"><a className="brand" href="/">个人<span>星球</span></a><div className={open ? 'links open' : 'links'}>{links.map((link) => <a className={current === link.href ? 'active' : ''} href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}</div><div className="nav-actions"><button aria-label="切换主题" className="icon-button" data-theme-toggle onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><button aria-label="打开菜单" className="icon-button mobile" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button></div></nav>
}
