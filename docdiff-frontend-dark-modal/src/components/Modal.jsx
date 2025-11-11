import React, { createContext, useContext, useState, useCallback } from 'react'

const ModalCtx = createContext(null)
export const useModal = () => useContext(ModalCtx)

export function ModalProvider({ children }){
  const [modal, setModal] = useState(null)

  const confirm = useCallback((opts)=> new Promise((resolve)=>{
    setModal({ ...opts, resolve })
  }), [])

  const close = ()=> setModal(null)

  return (
    <ModalCtx.Provider value={{ confirm }}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl p-5 bg-white dark:bg-slate-800 dark:text-slate-100 shadow-xl">
            <div className="text-lg font-semibold mb-2">{modal.title || 'Confirm'}</div>
            {modal.message && <div className="text-sm mb-4 opacity-80">{modal.message}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={()=>{ modal.resolve(false); close() }}
                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-700"
              >Cancel</button>
              <button
                onClick={()=>{ modal.resolve(true); close() }}
                className="px-3 py-1.5 rounded bg-red-600 text-white"
              >{modal.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </ModalCtx.Provider>
  )
}


export default ModalProvider;
