import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

export default function Sanity(){
  const { apiFetch } = useAuth()
  const [title, setTitle] = useState('Quick Sanity')
  const [enumsYaml, setEnumsYaml] = useState("enums:\n  funds:\n    status: ['active','closed']\n")
  const [tablesJson, setTablesJson] = useState(`{
  "funds": {"1": {"fund_id": "1", "status": "active"}},
  "investors": {"101": {"investor_id": "101", "status": "closed"}}
}`)
  const [resp, setResp] = useState(null)
  const [reports, setReports] = useState([])

  const run = async (e)=>{
    e.preventDefault()
    const data_json_dict = JSON.parse(tablesJson)
    const res = await apiFetch('/sanity/run', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ title, enum_yaml_str: enumsYaml, data_json_dict }) })
    const data = await res.json(); setResp(data)
  }

  const loadReports = async ()=>{
    const res = await apiFetch('/sanity/reports')
    const data = await res.json(); setReports(data)
  }

  useEffect(()=>{ loadReports() },[])

  return (
    <div className='space-y-3'>
      <div className='text-xl font-semibold'>DB Sanity</div>
      <form onSubmit={run} className='grid gap-3 md:grid-cols-2'>
        <input className='border p-2 rounded bg-white dark:bg-slate-900 dark:border-slate-700' value={title} onChange={e=>setTitle(e.target.value)} />
        <button className='bg-black text-white rounded-lg py-2'>Run</button>
        <textarea className='border p-2 rounded h-40 text-xs bg-white dark:bg-slate-900 dark:border-slate-700' value={enumsYaml} onChange={e=>setEnumsYaml(e.target.value)} />
        <textarea className='border p-2 rounded h-40 text-xs bg-white dark:bg-slate-900 dark:border-slate-700' value={tablesJson} onChange={e=>setTablesJson(e.target.value)} />
      </form>
      {resp && <pre className='text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl overflow-auto'>{JSON.stringify(resp, null, 2)}</pre>}
      <div>
        <div className='font-semibold mb-2'>Recent Reports</div>
        <div className='grid gap-3'>
          {reports.map(r=> (
            <div key={r._id} className='border rounded-xl p-3 dark:border-slate-800'>
              <div className='font-medium'>{r.title}</div>
              <div className='text-sm text-slate-600 dark:text-slate-300'>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
