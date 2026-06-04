import { useQuery } from '@tanstack/react-query'
import { Phone, Wifi, WifiOff, Clock } from 'lucide-react'
import { getWhatsAppNumbers } from '../api'
import { Spinner } from '../components/ui/Spinner'

export function WhatsAppNumbersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-numbers'],
    queryFn: getWhatsAppNumbers,
  })

  const numbers = data?.data.results || []

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">أرقام واتساب</h1>
        <p className="text-white/50 text-sm mt-1">إدارة أرقام واتساب المرتبطة بالمستأجرين</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Phone size={40} className="mx-auto mb-3 opacity-20" />
          لا توجد أرقام مضافة.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {numbers.map((n) => (
            <div key={n.id} className="glass-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <Phone size={20} className="text-green-400" />
                </div>
                <div className="flex items-center gap-1.5">
                  {n.status === 'active' ? (
                    <><Wifi size={14} className="text-green-400" /><span className="text-green-400 text-xs">نشط</span></>
                  ) : n.status === 'pending' ? (
                    <><Clock size={14} className="text-yellow-400" /><span className="text-yellow-400 text-xs">معلق</span></>
                  ) : (
                    <><WifiOff size={14} className="text-white/40" /><span className="text-white/40 text-xs">غير نشط</span></>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mb-1">{n.display_name}</h3>
              <p className="text-white/50 text-sm font-mono mb-3">{n.phone_number}</p>
              <div className="flex items-center justify-between text-xs text-white/40">
                <span className="bg-white/10 px-2 py-0.5 rounded-full">{n.provider}</span>
                <span>{n.tenant_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
