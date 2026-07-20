import { apiBase } from '../lib/api'
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const links = [
  { href: '/about', label: '关于' },
  { href: '/articles', label: '文章' },
  { href: '/projects', label: '作品' },
  { href: '/contact', label: '联系' },
]

export default function Navigation() {
  const [dark, setDark] = useState(false)
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('/')
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('personal-planet-theme')
    setDark(saved === 'dark')
    setCurrent(window.location.pathname)
    setLoggedIn(Boolean(localStorage.getItem('personal-planet-admin-token')))
  }, [])

  useEffect(() => {
    const theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    localStorage.setItem('personal-planet-theme', theme)
  }, [dark])

  async function logout() {
    const token = localStorage.getItem('personal-planet-admin-token')
    if (token) await fetch(apiBase + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    localStorage.removeItem('personal-planet-admin-token')
    setLoggedIn(false)
    if (window.location.pathname === '/admin') window.location.href = '/'
  }

  const navLinks = loggedIn ? [...links, { href: '/admin', label: '更改' }] : links

  return <nav className="nav">
    <a className="brand" href="/">个人<span>星球</span></a>
    <div className={open ? 'links open' : 'links'}>
      {navLinks.map((link) => <a className={current === link.href ? 'active' : ''} aria-current={current === link.href ? 'page' : undefined} href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
    </div>
    <div className="nav-actions">
      {loggedIn && <button aria-label="退出管理员登录" className="icon-button admin-logout" onClick={() => void logout()}><LogOut size={17} /></button>}
      <button aria-label="切换主题" className="icon-button" data-theme-toggle onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      <button aria-label="打开菜单" className="icon-button mobile" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
    </div>
  </nav>
}