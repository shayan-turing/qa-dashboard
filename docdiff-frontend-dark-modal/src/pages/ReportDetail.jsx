import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import { useModal } from '../components/Modal'

export default function ReportDetail(){
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const modal = useModal()
  const { apiFetch } = useAuth()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      const res = await apiFetch(`/reports/${id}`)
      const data = await res.json()
      if(mounted){ setReport(data); setLoading(false) }
    })()
    return ()=>{ mounted = false }
  },[id, apiFetch])

  const remove = async ()=>{
    const ok = await modal.confirm({ title: 'Delete report?', message: 'This action cannot be undone.' })
    if(!ok) return
    const res = await apiFetch(`/reports/${id}`, { method:'DELETE' })
    const data = await res.json()
    if(res.ok){ toast.show('Report deleted','success'); nav('/reports', { replace: true }) }
    else toast.show(data.error || 'Delete failed','error')
  }

  if(loading) return <div>Loading...</div>
  if(!report || report.error) return <div className='text-red-600'>Not found</div>

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div>
          <div className='text-xl font-semibold'>{report.title || 'Report'}</div>
          <div className='text-sm text-slate-600 dark:text-slate-300'>{report.type || report.report_type} · {report.created_at? new Date(report.created_at).toLocaleString(): ''}</div>
        </div>
        <button onClick={remove} className='px-3 py-1.5 rounded bg-red-600 text-white'>Delete</button>
      </div>
      <pre className='text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl overflow-auto'>{JSON.stringify(report, null, 2)}</pre>
    </div>
  )
}
