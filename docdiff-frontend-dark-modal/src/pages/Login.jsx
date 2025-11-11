import React, { useState } from 'react'
import { useAuth } from '../lib/auth'
import { Navigate } from 'react-router-dom'

export default function Login(){
  const { user, login, register, apiBase, setApiBase } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [err, setErr] = useState('')

  if(user) return <Navigate to='/' replace />

  const submit = async (e)=>{
    e.preventDefault(); setErr('')
    try{
      if(mode==='login'){ await login(email, password) }
      else { await register(email, password); setMode('login') }
    }catch(ex){ setErr(ex.message) }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6'>
      <div className='w-full max-w-md bg-white dark:bg-slate-800 dark:text-slate-100 shadow-xl rounded-2xl p-6 space-y-4'>
        <h1 className='text-2xl font-bold'>QA Tools- Amazon Agentic</h1>
        <label className='block text-sm'>API Base URL</label>
        <input className='w-full border rounded-lg p-2 bg-white dark:bg-slate-900 dark:border-slate-700' value={apiBase} onChange={e=>setApiBase(e.target.value)} />
        <form onSubmit={submit} className='space-y-3'>
          <input className='w-full border rounded-lg p-2 bg-white dark:bg-slate-900 dark:border-slate-700' placeholder='email' value={email} onChange={e=>setEmail(e.target.value)} />
          <input type='password' className='w-full border rounded-lg p-2 bg-white dark:bg-slate-900 dark:border-slate-700' placeholder='password' value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <div className='text-red-400 text-sm'>{err}</div>}
          <button className='w-full bg-black text-white rounded-lg py-2'>{mode==='login'?'Login':'Register'}</button>
        </form>
        <div className='text-sm text-slate-600 dark:text-slate-300'>
          {mode==='login' ? (
            <>No account? <button className='underline' onClick={()=>setMode('register')}>Register</button></>
          ) : (
            <>Have an account? <button className='underline' onClick={()=>setMode('login')}>Login</button></>
          )}
        </div>
      </div>
    </div>
  )
}
