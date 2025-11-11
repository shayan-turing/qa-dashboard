import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

function HealthCard(){
  const { apiBase } = useAuth()
  const [health, setHealth] = useState(null)
  useEffect(()=>{ fetch(`${apiBase}/health`).then(r=>r.json()).then(setHealth).catch(()=>setHealth({status:'unhealthy'})) },[apiBase])
  return (
    <div className='p-4 border rounded-xl dark:border-slate-800'>
      <div className='font-semibold mb-1'>Health</div>
      <pre className='text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 p-2 rounded'>{JSON.stringify(health, null, 2)}</pre>
    </div>
  )
}

export default function Dashboard(){
  return (
    <div className='grid gap-4'>
      <div className='text-xl font-semibold'>Dashboard</div>
      <div className='grid md:grid-cols-3 gap-4'>
        <HealthCard />
        <div className='p-4 border rounded-xl dark:border-slate-800'>
          <div className='font-semibold mb-1'>Quick Links</div>
          <ul className='text-sm list-disc ml-5 space-y-1'>
            <li>Run tool validation</li>
            <li>Create & run tasks</li>
            <li>Generate sanity reports</li>
          </ul>
        </div>
        <div className='p-4 border rounded-xl dark:border-slate-800'>
          <div className='font-semibold mb-1'>Status</div>
          <div className='text-sm text-slate-700 dark:text-slate-300'>All systems nominal.</div>
        </div>
      </div>
    </div>
  )
}
