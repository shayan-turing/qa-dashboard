import React, { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'

export default function RuleValidate(){
  const { apiUpload } = useAuth()
  const toast = useToast()
  const [doc, setDoc] = useState(null)
  const [ruleKey, setRuleKey] = useState('default')
  const [resp, setResp] = useState(null)
  const [progress, setProgress] = useState(0)

  const submit = async (e)=>{
    e.preventDefault()
    setResp(null); setProgress(0)
    const fd = new FormData()
    fd.append('doc_file', doc)
    fd.append('rule_key', ruleKey)
    try{
      const res = await apiUpload('/rule-validate', fd, { onProgress: setProgress })
      setResp(res.json)
      if(res.ok) toast.show('Rule validation completed','success')
      else toast.show(res.json.error || 'Validation failed','error')
    }catch(err){
      toast.show(err.json?.error || 'Upload error','error')
    }
  }

  return (
    <div className='space-y-3'>
      <div className='text-xl font-semibold'>Rule Validation</div>
      <form onSubmit={submit} className='grid gap-3 max-w-xl'>
        <input type='file' accept='.txt,.md,.docx,.pdf' onChange={e=>setDoc(e.target.files?.[0]||null)} className='border p-2 rounded bg-white dark:bg-slate-900 dark:border-slate-700' />
        <input className='border p-2 rounded bg-white dark:bg-slate-900 dark:border-slate-700' value={ruleKey} onChange={e=>setRuleKey(e.target.value)} placeholder='rule_key (default)' />
        <button className='bg-black text-white rounded-lg py-2'>Run</button>
      </form>
      {progress > 0 && progress < 100 && (
        <div className='w-full max-w-xl h-2 bg-slate-200 rounded'>
          <div className='h-2 bg-black rounded' style={{ width: `${progress}%` }}></div>
        </div>
      )}
      {resp && <pre className='text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-xl overflow-auto'>{JSON.stringify(resp, null, 2)}</pre>}
    </div>
  )
}
