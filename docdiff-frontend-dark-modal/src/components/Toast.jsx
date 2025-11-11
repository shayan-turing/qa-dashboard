import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id)=> setToasts(ts => ts.filter(t=>t.id !== id)), [])
  const show = useCallback((message, variant='info', timeout=3000)=>{
    const id = Math.random().toString(36).slice(2)
    setToasts(ts => [...ts, { id, message, variant }])
    if(timeout){
      setTimeout(()=> dismiss(id), timeout)
    }
    return id
  },[dismiss])

  const value = useMemo(()=>({ show, dismiss }),[show, dismiss])

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map(t=> (
          <div key={t.id} className={
            'px-4 py-2 rounded-lg shadow text-white ' + 
            (t.variant==='success'?'bg-green-600': t.variant==='error'?'bg-red-600':'bg-slate-800')
          }>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export default ToastProvider;
