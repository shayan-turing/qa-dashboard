import React, { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'

const STATUS_META = {
  healthy: {
    headline: 'All systems nominal',
    label: 'Healthy',
    description: 'Core services are online and responding quickly.',
    badgeClasses:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
    dotClasses: 'bg-emerald-500',
    panelGradient: 'from-emerald-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/40',
  },
  unhealthy: {
    headline: 'Degraded performance',
    label: 'Attention needed',
    description: 'At least one dependency failed the latest check.',
    badgeClasses:
      'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200',
    dotClasses: 'bg-red-500',
    panelGradient: 'from-red-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/40',
  },
  loading: {
    headline: 'Gathering signals',
    label: 'Checking',
    description: 'Fetching the most recent health snapshot.',
    badgeClasses:
      'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
    dotClasses: 'bg-sky-500',
    panelGradient: 'from-sky-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/40',
  },
  unknown: {
    headline: 'No data yet',
    label: 'Unknown',
    description: 'Waiting for the first response from the API.',
    badgeClasses:
      'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    dotClasses: 'bg-slate-400',
    panelGradient: 'from-slate-50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/40',
  },
}

function HealthCard(){
  const { apiBase } = useAuth()
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)

  useEffect(()=>{
    let active = true

    const fetchHealth = () => {
      setLoading(true)
      fetch(`${apiBase}/health`)
        .then(r => r.json())
        .then(data => {
          if(!active) return
          setHealth(data)
          setUpdatedAt(new Date())
        })
        .catch(() => {
          if(!active) return
          setHealth({ status: 'unhealthy' })
          setUpdatedAt(new Date())
        })
        .finally(() => {
          if(!active) return
          setLoading(false)
        })
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 60000)

    return () => {
      active = false
      clearInterval(interval)
    }
  },[apiBase])

  const statusKey = (health?.status || (loading ? 'loading' : 'unknown')).toLowerCase()
  const statusMeta = STATUS_META[statusKey] || STATUS_META.unknown
  const metrics = Object.entries(health || {}).filter(([key]) => key !== 'status' && key !== 'error')

  const formatLabel = (label) =>
    label
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const updatedCopy = loading
    ? 'Checking...'
    : updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString()}`
    : 'Awaiting data'

  return (
    <div className={`p-5 rounded-2xl border shadow-sm dark:border-slate-800 bg-gradient-to-br ${statusMeta.panelGradient}`}>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <p className='text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400'>Platform health</p>
          <div className='mt-2 flex flex-wrap items-center gap-3 text-slate-900 dark:text-white'>
            <span className='text-2xl font-semibold'>{statusMeta.headline}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.badgeClasses}`}>
              <span className={`h-2 w-2 rounded-full ${statusMeta.dotClasses}`} />
              {statusMeta.label}
            </span>
          </div>
        </div>
        <p className='text-xs text-slate-500 dark:text-slate-400'>{updatedCopy}</p>
      </div>
      <p className='mt-3 text-sm text-slate-600 dark:text-slate-300'>{statusMeta.description}</p>

      <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {metrics.map(([key, value]) => (
          <div
            key={key}
            className='rounded-xl border border-slate-200 bg-white/70 p-3 text-slate-800 backdrop-blur dark:border-slate-700 dark:bg-white/5 dark:text-slate-200'
          >
            <p className='text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'>{formatLabel(key)}</p>
            <p className='mt-1 text-lg font-semibold'>{String(value)}</p>
          </div>
        ))}
      </div>

      {!metrics.length && !loading && (
        <p className='mt-2 text-sm text-slate-500 dark:text-slate-400'>No component details were returned.</p>
      )}

      {health?.error && (
        <div className='mt-4 rounded-2xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100'>
          <p className='text-xs font-semibold uppercase tracking-wide'>Error</p>
          <p className='mt-1'>{health.error}</p>
        </div>
      )}
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
