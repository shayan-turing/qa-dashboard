import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { storage } from '../lib/storage'

const ThemeCtx = createContext(null)
export const useTheme = () => useContext(ThemeCtx)

export function ThemeProvider({ children }){
  const [theme, setTheme] = useState(()=> storage.get('theme') || 'light')

  useEffect(()=>{
    storage.set('theme', theme)
    const root = document.documentElement
    if(theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  },[theme])

  const toggle = ()=> setTheme(t => t === 'dark' ? 'light' : 'dark')

  const value = useMemo(()=>({ theme, setTheme, toggle }),[theme])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function ThemeToggle(){
  const { theme, toggle } = useTheme()
  return (
    <button onClick={toggle} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 dark:text-slate-100">
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
