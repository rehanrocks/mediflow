import { Check, Clock } from 'lucide-react'

function DoubleCheck({ className = '' }) {
  return (
    <span className={`relative inline-flex h-3 w-4 ${className}`}>
      <Check aria-hidden="true" className="absolute left-0 top-0 h-3 w-3" />
      <Check aria-hidden="true" className="absolute left-1.5 top-0 h-3 w-3" />
    </span>
  )
}

export function ReadReceipts({ status = 'sent' }) {
  if (status === 'sending') {
    return <Clock aria-hidden="true" className="h-3 w-3 text-white/60" />
  }

  if (status === 'sent') {
    return <Check aria-hidden="true" className="h-3 w-3 text-white/70" />
  }

  if (status === 'read') {
    return <DoubleCheck className="text-brand-light" />
  }

  return <DoubleCheck className="text-white/70" />
}

export default ReadReceipts
