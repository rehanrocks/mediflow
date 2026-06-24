import { BarChart2 } from 'lucide-react'

export function Reports() {
  return (
    <section className="rounded-card bg-canvas p-10 text-center shadow-card">
      <BarChart2 aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-brand/20" />
      <h2 className="text-[20px] font-bold text-ink">Reports</h2>
      <p className="mt-1 text-[14px] font-normal text-slate">
        Reporting features are coming soon.
      </p>
    </section>
  )
}

export default Reports
