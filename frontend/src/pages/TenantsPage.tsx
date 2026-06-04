import { useQuery } from '@tanstack/react-query'
import { Building2, Crown, Users, CheckCircle, XCircle } from 'lucide-react'
import { getTenants } from '../api'
import { Spinner } from '../components/ui/Spinner'

const typeLabels: Record<string, string> = {
  platform: 'منصة',
  family_fund: 'صندوق أسرة',
  company: 'شركة',
  other: 'أخرى',
}

export function TenantsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: getTenants,
  })

  const tenants = data?.data.results || []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المستأجرون</h1>
        <p className="text-white/50 text-sm mt-1">{tenants.length} مستأجر مسجّل</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Building2 size={40} className="mx-auto mb-3 opacity-20" />
          لا يوجد مستأجرون.
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <div key={t.id} className="glass-card p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <Building2 size={22} className="text-blue-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    {t.plan === 'enterprise' && (
                      <Crown size={14} className="text-yellow-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                    <span className="bg-white/10 px-2 py-0.5 rounded-full">{typeLabels[t.tenant_type]}</span>
                    <span>{t.slug}</span>
                    <span>{t.plan}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {t.status === 'active' ? (
                  <span className="flex items-center gap-1.5 text-green-400 text-sm">
                    <CheckCircle size={15} /> نشط
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-red-400 text-sm">
                    <XCircle size={15} /> معلق
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
