import { useState, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  Send, Users, CheckCircle, XCircle, Loader2,
  FileSpreadsheet, Clock, StopCircle, PauseCircle,
  PlayCircle, AlertTriangle, Search, X, CheckSquare, Square,
  Calendar, ImagePlus,
} from 'lucide-react'
import api from '../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Recipient  { name: string; phone: string }
interface SendResult { name: string; phone: string; status: 'sent' | 'failed' | 'skipped'; reason?: string }
type Step = 'upload' | 'select' | 'compose' | 'sending' | 'results'
type CountdownType = 'batch' | 'day' | null

// ── Text variation — inserts invisible Unicode chars throughout message ────────
const INVISIBLE = ['​','‌','‍','⁠','﻿','‎','‏']

function injectVariation(line: string): string {
  if (line.length < 4) return line
  let r = line
  const n = Math.floor(Math.random() * 2) + 1
  for (let k = 0; k < n; k++) {
    const pos  = Math.floor(Math.random() * (r.length - 1)) + 1
    const char = INVISIBLE[Math.floor(Math.random() * INVISIBLE.length)]
    r = r.slice(0, pos) + char + r.slice(pos)
  }
  return r
}

function personalise(template: string, name: string): string {
  let msg = template
  msg = msg.replace(/\[الاسم\]/g, name || 'الأستاذ')
  msg = msg.replace(/\{name\}/g,  name || 'الأستاذ')
  // Inject variation into each non-empty line for unique fingerprint per message
  return msg.split('\n').map(line => line.trim().length > 5 ? injectVariation(line) : line).join('\n')
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms))
const rand  = (min: number, max: number) => min + Math.random() * (max - min)
const fmt2  = (n: number) => String(n).padStart(2, '0')
const fmtHM = (totalMins: number) => `${fmt2(Math.floor(totalMins / 60) % 24)}:${fmt2(totalMins % 60)}`

function msUntilTime(hh: number, mm: number, alwaysTomorrow = false): number {
  const now    = new Date()
  const target = new Date()
  target.setHours(hh, mm, 0, 0)
  if (alwaysTomorrow || target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return Math.max(0, target.getTime() - Date.now())
}

// ── Default message ───────────────────────────────────────────────────────────
const DEFAULT_MSG =
`السلام عليكم ورحمة الله وبركاته

السادة صندوق [الاسم]

إدارة الصندوق العائلي اليوم لم تعد مجرد متابعة أعمال يومية، بل أصبحت مسؤولية تحتاج إلى حوكمة واضحة، وتنظيم احترافي، وأدوات تقنية تختصر الوقت وترفع جودة العمل.

ومن هنا أطلقنا شركة وزن لتطوير الصناديق والمنظمات
شركة متخصصة في تطوير وتمكين الصناديق والمنظمات، من خلال نخبة من المستشارين والخبراء في الإدارة والحوكمة والتقنية، بقيادة المستشار عيسى بن محمد العيسى

في وزن، هدفنا أن نكون شريكاً عملياً للصناديق العائلية في تطوير أعمالها، وتنظيم برامجها، وتحسين كفاءة فرقها.

ولأن أكثر ما يستهلك وقت الصناديق هو إدارة الفعاليات، والمناسبات، والبرامج، واللجان، والمتابعة…

كان أول منتجاتنا التقنية المخصصة لكم:

✨ منصة حدث
منصة احترافية متكاملة لإدارة الفعاليات والمناسبات والبرامج ، تساعدكم على تنظيم العمل من البداية إلى النهاية في إدارة الحدث الواحد كاملاً، وتشمل:

▪️ شاشة دخول خاصة بكم
▪️ تسجيل المشاركين والحضور
▪️ إدارة اللجان والمهام
▪️ التواصل مع المستفيدين والداعمين
▪️ تنظيم الدعوات والمشاركات
▪️ متابعة الإنجاز والتقارير
▪️ قياس الأثر بعد انتهاء الفعالية

🎁 عرض الإطلاق الخاص
لفترة محدودة ولأول 20 صندوقاُ فقط:

✅ خصم 50٪ على الاشتراك ليصبح 300 ريال فقط
✅ شركة وزن تتحمل كامل ضريبة القيمة المضافة
✅ دعم فني في التهيئة والتشغيل حتى الإطلاق

يسعدنا أن نتيح لكم تجربة توضيحية قصيرة لتروا كيف يمكن للمنصة أن تختصر الجهد وترفع احترافية العمل.

🌐 تجربة المنصة:
https://hdth.wzn.sa

ولمتابعة جديد وزن ومنتجاتها:
📲 https://whatsapp.com/channel/0029Vb83lNCHwXb6yXUuNj2d

شركة وزن لتطوير الصناديق والمنظمات
نطوّر العمل… ونقيس الأثر 🌟`

// ── Component ─────────────────────────────────────────────────────────────────
export function BroadcastPage() {
  const [step, setStep]               = useState<Step>('upload')
  const [allRecipients, setAllRecipients] = useState<Recipient[]>([])
  const [selected, setSelected]       = useState<Set<number>>(new Set())
  const [searchQ, setSearchQ]         = useState('')
  const [template, setTemplate]       = useState(DEFAULT_MSG)
  const [fileError, setFileError]     = useState('')
  const [dragging, setDragging]       = useState(false)

  // Upload step: file + manual sources
  const [fileRecipients, setFileRecipients] = useState<Recipient[]>([])
  const [fileName, setFileName]             = useState('')
  const [manualList, setManualList]         = useState<Recipient[]>([])
  const [manualName, setManualName]         = useState('')
  const [manualPhone, setManualPhone]       = useState('')
  const combinedCount = fileRecipients.length + manualList.length

  // Compose step: attached image
  const [imageFile,   setImageFile]   = useState<File | null>(null)
  const [imageBase64, setImageBase64] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const imageRef = useRef<HTMLInputElement>(null)

  // Sending settings (safer defaults for 500 numbers)
  const [batchSize,  setBatchSize]  = useState(20)
  const [batchPause, setBatchPause] = useState(12)
  const [minDelay,   setMinDelay]   = useState(12)
  const [maxDelay,   setMaxDelay]   = useState(25)

  // Schedule settings
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleTime,    setScheduleTime]    = useState('09:00')
  const [dailyLimit,      setDailyLimit]      = useState(150)

  // Sending state
  const [results,          setResults]          = useState<SendResult[]>([])
  const [sentCount,        setSentCount]        = useState(0)
  const [failCount,        setFailCount]        = useState(0)
  const [currentIdx,       setCurrentIdx]       = useState(0)
  const [currentBatch,     setCurrentBatch]     = useState(1)
  const [scheduledDay,     setScheduledDay]     = useState(1)
  const [totalDays,        setTotalDays]        = useState(1)
  const [pauseCountdown,   setPauseCountdown]   = useState<number | null>(null)
  const [countdownType,    setCountdownType]    = useState<CountdownType>(null)
  const [isPaused,         setIsPaused]         = useState(false)

  const stopRef    = useRef(false)
  const pauseRef   = useRef(false)
  const resultsRef = useRef<SendResult[]>([])
  const fileRef    = useRef<HTMLInputElement>(null)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredRecipients = useMemo(() => {
    if (!searchQ.trim()) return allRecipients
    const q = searchQ.toLowerCase()
    return allRecipients.filter(r => r.name.toLowerCase().includes(q) || r.phone.includes(q))
  }, [allRecipients, searchQ])

  const selectedRecipients = useMemo(
    () => allRecipients.filter((_, i) => selected.has(i)),
    [allRecipients, selected]
  )

  const avgDelay     = (minDelay + maxDelay) / 2
  const totalBatches = Math.ceil(selectedRecipients.length / batchSize)
  const estMins      = Math.round((selectedRecipients.length * avgDelay) / 60 + (totalBatches - 1) * batchPause)
  const pct          = selectedRecipients.length ? Math.round((currentIdx / selectedRecipients.length) * 100) : 0

  // Schedule preview
  const schedulePreview = useMemo(() => {
    if (!scheduleEnabled || !selectedRecipients.length) return []
    const [hh, mm] = scheduleTime.split(':').map(Number)
    const startMin = hh * 60 + mm
    const rows = []
    let remaining = selectedRecipients.length
    let day = 1
    while (remaining > 0 && day <= 30) {
      const count   = Math.min(remaining, dailyLimit)
      const batches = Math.ceil(count / batchSize)
      const mins    = Math.round((count * avgDelay) / 60 + Math.max(0, batches - 1) * batchPause)
      rows.push({ day, count, start: fmtHM(startMin), end: fmtHM(startMin + mins), batches })
      remaining -= count
      day++
    }
    return rows
  }, [scheduleEnabled, scheduleTime, dailyLimit, selectedRecipients.length, batchSize, avgDelay, batchPause])

  // ── File parsing ──────────────────────────────────────────────────────────────
  function parseFile(file: File) {
    setFileError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const parsed: Recipient[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          if (!row?.length) continue
          const name  = String(row[0] ?? '').trim()
          const phone = String(row[1] ?? '').trim()
          if (phone) parsed.push({ name, phone })
        }
        if (!parsed.length) { setFileError('لم يُعثر على أرقام — تأكد أن العمود A للاسم والعمود B للرقم.'); return }
        setFileRecipients(parsed)
        setFileName(file.name)
      } catch { setFileError('تعذّر قراءة الملف.') }
    }
    reader.readAsArrayBuffer(file)
  }

  function addManual() {
    const phone = manualPhone.trim()
    if (!phone) return
    setManualList(prev => [...prev, { name: manualName.trim(), phone }])
    setManualName('')
    setManualPhone('')
  }

  function removeManual(idx: number) {
    setManualList(prev => prev.filter((_, i) => i !== idx))
  }

  function handleImageUpload(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target!.result as string
      setImagePreview(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setImageFile(file)
    }
    reader.readAsDataURL(file)
  }

  function removeImage() { setImageFile(null); setImageBase64(''); setImagePreview('') }

  function proceedToSelect() {
    const combined = [...fileRecipients, ...manualList]
    if (!combined.length) return
    setAllRecipients(combined)
    setSelected(new Set(combined.map((_, i) => i)))
    setSearchQ('')
    setStep('select')
  }

  // ── Selection ─────────────────────────────────────────────────────────────────
  function toggleOne(idx: number) {
    setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function selectAll()   { setSelected(new Set(allRecipients.map((_, i) => i))) }
  function deselectAll() { setSelected(new Set()) }
  function selectFiltered() {
    setSelected(prev => {
      const n = new Set(prev)
      filteredRecipients.forEach(r => { const idx = allRecipients.indexOf(r); if (idx !== -1) n.add(idx) })
      return n
    })
  }

  // ── Countdown ─────────────────────────────────────────────────────────────────
  const runCountdown = useCallback((seconds: number): Promise<void> =>
    new Promise(resolve => {
      let rem = seconds
      setPauseCountdown(rem)
      const tick = setInterval(() => {
        rem--
        setPauseCountdown(rem)
        if (rem <= 0) { clearInterval(tick); setPauseCountdown(null); resolve() }
      }, 1000)
    }), [])

  // ── Main sending loop ─────────────────────────────────────────────────────────
  async function startSending() {
    const toSend = allRecipients.filter((_, i) => selected.has(i))
    if (!toSend.length) return

    stopRef.current = false; pauseRef.current = false
    resultsRef.current = []
    setResults([]); setSentCount(0); setFailCount(0)
    setCurrentIdx(0); setCurrentBatch(1); setPauseCountdown(null)
    setIsPaused(false); setCountdownType(null)

    const days = scheduleEnabled ? Math.ceil(toSend.length / dailyLimit) : 1
    setScheduledDay(1); setTotalDays(days)
    setStep('sending')

    // Wait for scheduled start time if enabled
    if (scheduleEnabled) {
      const [hh, mm] = scheduleTime.split(':').map(Number)
      const waitMs = msUntilTime(hh, mm)
      if (waitMs > 5000) {
        setCountdownType('day')
        await runCountdown(Math.ceil(waitMs / 1000))
        setCountdownType(null)
      }
    }

    let sent = 0, failed = 0, dayBatch = 1, todayCount = 0

    for (let i = 0; i < toSend.length; i++) {
      if (stopRef.current) break

      // Daily limit: wait until next scheduled time
      if (scheduleEnabled && todayCount >= dailyLimit) {
        const [hh, mm] = scheduleTime.split(':').map(Number)
        const waitMs = msUntilTime(hh, mm, true)
        setScheduledDay(d => d + 1)
        setCountdownType('day')
        await runCountdown(Math.ceil(waitMs / 1000))
        setCountdownType(null)
        todayCount = 0; dayBatch = 1; setCurrentBatch(1)
      }

      while (pauseRef.current && !stopRef.current) await sleep(300)
      if (stopRef.current) break

      const r       = toSend[i]
      const message = personalise(template, r.name)
      setCurrentIdx(i + 1)
      todayCount++

      try {
        const payload: Record<string, string> = { phone: r.phone, message, name: r.name }
        if (imageBase64) {
          payload.image    = imageBase64
          payload.filename = imageFile?.name ?? 'image.jpg'
          payload.mimetype = imageFile?.type ?? 'image/jpeg'
        }
        const { data } = await api.post('/broadcast/send-one/', payload)
        const res: SendResult = { name: r.name, phone: r.phone, status: data.status, reason: data.reason }
        resultsRef.current = [...resultsRef.current, res]
        setResults([...resultsRef.current])
        if (data.status === 'sent') { sent++; setSentCount(sent) } else { failed++; setFailCount(failed) }
      } catch {
        const res: SendResult = { name: r.name, phone: r.phone, status: 'failed', reason: 'خطأ في الاتصال' }
        resultsRef.current = [...resultsRef.current, res]
        setResults([...resultsRef.current])
        failed++; setFailCount(failed)
      }

      const isLast          = i === toSend.length - 1
      const nextIsNewDay    = scheduleEnabled && todayCount >= dailyLimit
      const isEndOfDayBatch = todayCount % batchSize === 0

      if (!isLast && !nextIsNewDay) {
        if (isEndOfDayBatch) {
          dayBatch++; setCurrentBatch(dayBatch)
          setCountdownType('batch')
          await runCountdown(batchPause * 60)
          setCountdownType(null)
        } else {
          const delayMs = rand(minDelay, maxDelay) * 1000
          let elapsed = 0
          while (elapsed < delayMs) {
            if (stopRef.current) break
            while (pauseRef.current && !stopRef.current) await sleep(300)
            await sleep(250); elapsed += 250
          }
        }
      }
    }

    setStep('results')
  }

  function togglePause() { pauseRef.current = !pauseRef.current; setIsPaused(pauseRef.current) }
  function requestStop()  { stopRef.current = true; pauseRef.current = false; setIsPaused(false) }

  function reset() {
    setStep('upload'); setAllRecipients([]); setSelected(new Set()); setResults([])
    setSentCount(0); setFailCount(0); setCurrentIdx(0); setCurrentBatch(1)
    setPauseCountdown(null); setIsPaused(false); setSearchQ(''); setScheduledDay(1)
    setFileRecipients([]); setFileName(''); setManualList([]); setManualName(''); setManualPhone('')
    setImageFile(null); setImageBase64(''); setImagePreview('')
    stopRef.current = false; pauseRef.current = false; resultsRef.current = []
  }

  const STEPS = [
    { key: 'upload'  as Step, label: 'رفع الملف',    num: 1 },
    { key: 'select'  as Step, label: 'اختيار الأرقام', num: 2 },
    { key: 'compose' as Step, label: 'الرسالة',      num: 3 },
    { key: 'results' as Step, label: 'النتائج',      num: 4 },
  ]
  const stepOrder: Record<Step, number> = { upload: 0, select: 1, compose: 2, sending: 2, results: 3 }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl space-y-5" dir="rtl">

      {/* Header */}
      <div className="hero-banner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <Send size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">الإرسال الجماعي الذكي</h1>
              <p className="text-white/55 text-xs mt-0.5">دفعات عشوائية — آمن ومخصص لكل مستلم</p>
            </div>
          </div>
          {step !== 'upload' && step !== 'sending' && (
            <button onClick={reset}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-all">
              <X size={14} /> إلغاء والبدء من جديد
            </button>
          )}
        </div>
      </div>

      {/* Steps bar */}
      {step !== 'sending' && (
        <div className="card p-4 flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done   = stepOrder[s.key] < stepOrder[step]
            const active = s.key === (step as string) || (s.key === 'compose' && (step as string) === 'sending')
            return (
              <div key={s.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-100 text-neutral-400'
                }`}>{done ? '✓' : s.num}</div>
                <span className={`text-xs font-medium truncate ${active ? 'text-neutral-800' : done ? 'text-green-600' : 'text-neutral-400'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-neutral-200 mx-1 min-w-2" />}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════ STEP 1: UPLOAD ═══════════ */}
      {step === 'upload' && (
        <div className="space-y-4">

          {/* ─── File upload ─── */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} className="text-blue-500" />
              <p className="font-semibold text-neutral-800 text-sm">رفع ملف Excel / CSV</p>
              <span className="text-xs text-neutral-400">(اختياري)</span>
            </div>

            {fileRecipients.length > 0 ? (
              /* File loaded — show summary */
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-green-700 font-semibold text-sm">{fileName}</p>
                    <p className="text-green-500 text-xs">{fileRecipients.length} جهة اتصال</p>
                  </div>
                </div>
                <button
                  onClick={() => { setFileRecipients([]); setFileName(''); setFileError('') }}
                  className="text-neutral-400 hover:text-red-500 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-neutral-200 hover:border-blue-400 hover:bg-blue-50/40'
                }`}
                onDrop={e => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && parseFile(e.dataTransfer.files[0]) }}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet size={32} className={`mx-auto mb-2 ${dragging ? 'text-blue-500' : 'text-neutral-300'}`} />
                <p className="text-neutral-600 text-sm font-medium">اسحب الملف هنا أو اضغط للاختيار</p>
                <p className="text-neutral-300 text-xs mt-1">.xlsx / .xls / .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])} />
              </div>
            )}

            {fileError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs flex gap-2">
                <XCircle size={14} className="flex-shrink-0 mt-0.5" />{fileError}
              </div>
            )}

            {/* Format hint (collapsed) */}
            {fileRecipients.length === 0 && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-blue-600 text-xs font-semibold mb-2">📋 التنسيق المطلوب: عمود A = الاسم ، عمود B = رقم الواتساب</p>
                <p className="text-blue-400 text-xs">مثال: محمد العمري | 966501234567</p>
              </div>
            )}
          </div>

          {/* ─── Manual entry ─── */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-green-500" />
              <p className="font-semibold text-neutral-800 text-sm">إضافة أرقام يدوياً</p>
              <span className="text-xs text-neutral-400">(اختياري)</span>
            </div>

            {/* Input row */}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="الاسم (اختياري)"
                className="input-field text-sm flex-1"
              />
              <input
                type="text"
                value={manualPhone}
                onChange={e => setManualPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManual()}
                placeholder="رقم الجوال"
                className="input-field text-sm flex-1"
                dir="ltr"
              />
              <button
                onClick={addManual}
                disabled={!manualPhone.trim()}
                className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40">
                إضافة
              </button>
            </div>

            {/* Manual list */}
            {manualList.length > 0 && (
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="bg-neutral-50 px-3 py-2 text-xs text-neutral-500 font-semibold border-b border-neutral-100">
                  {manualList.length} رقم مضاف يدوياً
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-neutral-50">
                  {manualList.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {r.name?.[0] || '#'}
                        </div>
                        <div>
                          <p className="text-neutral-700 text-sm">{r.name || '—'}</p>
                          <p className="text-neutral-400 text-xs font-mono" dir="ltr">{r.phone}</p>
                        </div>
                      </div>
                      <button onClick={() => removeManual(i)}
                        className="text-neutral-300 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── Proceed button ─── */}
          <button
            onClick={proceedToSelect}
            disabled={combinedCount === 0}
            className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-40">
            <Users size={18} />
            {combinedCount > 0
              ? `التالي — ${combinedCount} جهة اتصال`
              : 'أضف أرقاماً أو ارفع ملفاً للمتابعة'}
          </button>
        </div>
      )}

      {/* ═══════════ STEP 2: SELECT ═══════════ */}
      {step === 'select' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <span className="font-semibold text-neutral-800 text-sm">{allRecipients.length} اسم في الملف</span>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{selected.size} مُحدد</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={selectAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all">
                  <CheckSquare size={13} />تحديد الكل
                </button>
                <button onClick={deselectAll}
                  className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-700 bg-neutral-100 hover:bg-neutral-200 px-3 py-1.5 rounded-lg transition-all">
                  <Square size={13} />إلغاء الكل
                </button>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="بحث بالاسم أو الرقم..."
                className="input-field pr-9 text-sm" />
              {searchQ && (
                <button onClick={() => setSearchQ('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchQ && filteredRecipients.length > 0 && (
              <button onClick={selectFiltered} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                + تحديد نتائج البحث ({filteredRecipients.length})
              </button>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
              {filteredRecipients.length === 0
                ? <div className="p-8 text-center text-neutral-400 text-sm">لا توجد نتائج</div>
                : filteredRecipients.map(r => {
                  const realIdx   = allRecipients.indexOf(r)
                  const isChecked = selected.has(realIdx)
                  return (
                    <label key={realIdx}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-neutral-50'
                      }`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(realIdx)}
                        className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isChecked ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-500'
                      }`}>{r.name?.[0] || '#'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-neutral-800 text-sm font-medium truncate">{r.name || '—'}</p>
                        <p className="text-neutral-400 text-xs font-mono">{r.phone}</p>
                      </div>
                      {isChecked && <CheckCircle size={14} className="text-blue-500 flex-shrink-0" />}
                    </label>
                  )
                })
              }
            </div>
            <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
              <p className="text-xs text-neutral-400">
                {selected.size === 0 ? 'لم يتم تحديد أي رقم' : `${selected.size} رقم مُحدد للإرسال`}
              </p>
              <button onClick={() => { if (selected.size > 0) setStep('compose') }}
                disabled={selected.size === 0}
                className="btn-primary text-xs py-2 px-4 disabled:opacity-40">
                التالي — كتابة الرسالة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ STEP 3: COMPOSE ═══════════ */}
      {step === 'compose' && (
        <div className="space-y-4">
          {/* Recipient count */}
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-neutral-800">{selected.size} مستلم مُحدد</p>
                <p className="text-neutral-400 text-xs">من إجمالي {allRecipients.length}</p>
              </div>
            </div>
            <button onClick={() => setStep('select')} className="btn-ghost text-xs py-1.5 px-3">← تعديل الاختيار</button>
          </div>

          {/* Message */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-neutral-800 text-sm">نص الرسالة</p>
              <span className="text-xs bg-blue-100 text-blue-600 px-2.5 py-1 rounded-full font-medium">[الاسم] = اسم المستلم</span>
            </div>
            <textarea value={template} onChange={e => setTemplate(e.target.value)}
              rows={14} className="input-field resize-none leading-relaxed text-sm" />
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-600 text-xs font-semibold mb-2">
                👁 معاينة لـ "{selectedRecipients[0]?.name || 'محمد'}":
              </p>
              <p className="text-neutral-700 text-sm whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-3 border border-green-100 max-h-36 overflow-y-auto">
                {template.replace(/\[الاسم\]/g, selectedRecipients[0]?.name || 'محمد').replace(/\{name\}/g, selectedRecipients[0]?.name || 'محمد')}
              </p>
            </div>
          </div>

          {/* Image attachment */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ImagePlus size={15} className="text-pink-500" />
              <p className="font-semibold text-neutral-800 text-sm">صورة مرفقة</p>
              <span className="text-xs text-neutral-400">(اختياري — تُرسل مع الرسالة)</span>
            </div>

            {imagePreview ? (
              <div className="flex items-center gap-4 bg-neutral-50 rounded-xl p-3 border border-neutral-200">
                <img src={imagePreview} alt="preview"
                  className="w-20 h-20 object-cover rounded-xl flex-shrink-0 border border-neutral-200" />
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-700 text-sm font-medium truncate">{imageFile?.name}</p>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : ''}
                  </p>
                  <p className="text-green-600 text-xs mt-1 font-medium">✓ سيتم إرسالها مع كل رسالة</p>
                </div>
                <button onClick={removeImage}
                  className="text-neutral-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => imageRef.current?.click()}
                className="border-2 border-dashed border-neutral-200 rounded-xl p-6 text-center cursor-pointer hover:border-pink-300 hover:bg-pink-50/40 transition-all"
              >
                <ImagePlus size={28} className="mx-auto mb-2 text-neutral-300" />
                <p className="text-neutral-500 text-sm font-medium">اضغط لإضافة صورة</p>
                <p className="text-neutral-300 text-xs mt-1">JPG / PNG / WEBP — حتى 10 MB</p>
                <input ref={imageRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
              </div>
            )}
          </div>

          {/* Sending settings */}
          <div className="card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <p className="font-semibold text-neutral-800 text-sm">إعدادات الإرسال الذكي</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-neutral-600 text-sm">حجم الدفعة</p>
                <span className="bg-blue-100 text-blue-700 font-bold text-sm px-3 py-1 rounded-lg">{batchSize} رسالة</span>
              </div>
              <input type="range" min={10} max={50} step={5} value={batchSize}
                onChange={e => setBatchSize(+e.target.value)} className="w-full accent-blue-600" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-neutral-600 text-sm">استراحة بين الدفعات</p>
                <span className="bg-amber-100 text-amber-700 font-bold text-sm px-3 py-1 rounded-lg">{batchPause} دقيقة</span>
              </div>
              <input type="range" min={5} max={30} value={batchPause}
                onChange={e => setBatchPause(+e.target.value)} className="w-full accent-amber-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <p className="text-neutral-600 text-sm">تأخير أدنى</p>
                  <span className="text-green-600 font-bold text-sm">{minDelay}ث</span>
                </div>
                <input type="range" min={5} max={20} value={minDelay}
                  onChange={e => setMinDelay(Math.min(+e.target.value, maxDelay - 3))} className="w-full accent-green-500" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <p className="text-neutral-600 text-sm">تأخير أقصى</p>
                  <span className="text-blue-600 font-bold text-sm">{maxDelay}ث</span>
                </div>
                <input type="range" min={15} max={60} value={maxDelay}
                  onChange={e => setMaxDelay(Math.max(+e.target.value, minDelay + 3))} className="w-full accent-blue-600" />
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-blue-600">{totalBatches}</p>
                <p className="text-neutral-400 text-xs mt-0.5">دفعة</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-500">{batchPause * Math.max(0, totalBatches - 1)}</p>
                <p className="text-neutral-400 text-xs mt-0.5">دق استراحات</p>
              </div>
              <div>
                <p className="text-xl font-bold text-neutral-700">
                  {estMins >= 60 ? `${(estMins/60).toFixed(1)}س` : `${estMins}د`}
                </p>
                <p className="text-neutral-400 text-xs mt-0.5">إجمالي الوقت</p>
              </div>
            </div>
          </div>

          {/* ─── Schedule ─── */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-purple-500" />
                <p className="font-semibold text-neutral-800 text-sm">جدولة الإرسال على أيام</p>
              </div>
              {/* Toggle */}
              <button
                onClick={() => setScheduleEnabled(v => !v)}
                dir="ltr"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  scheduleEnabled ? 'bg-purple-500' : 'bg-neutral-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  scheduleEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {scheduleEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-neutral-600 text-sm block">وقت البدء يومياً</label>
                    <input type="time" value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="input-field" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-neutral-600 text-sm block">الحد اليومي (رسالة)</label>
                    <input type="number" min={20} max={300} value={dailyLimit}
                      onChange={e => setDailyLimit(Math.max(20, Math.min(300, +e.target.value)))}
                      className="input-field" />
                  </div>
                </div>

                {/* Schedule preview */}
                {schedulePreview.length > 0 && (
                  <div className="rounded-xl overflow-hidden border border-purple-200">
                    <div className="bg-purple-50 px-4 py-2.5 flex items-center gap-2">
                      <Calendar size={13} className="text-purple-500" />
                      <p className="text-purple-700 text-xs font-semibold">
                        خطة الإرسال — {schedulePreview.length} {schedulePreview.length === 1 ? 'يوم' : 'أيام'}
                      </p>
                    </div>
                    <table className="w-full text-sm bg-white">
                      <thead className="bg-neutral-50 border-b border-neutral-100">
                        <tr>
                          <th className="text-right py-2 px-4 text-xs text-neutral-500 font-semibold">اليوم</th>
                          <th className="text-right py-2 px-4 text-xs text-neutral-500 font-semibold">رسائل</th>
                          <th className="text-right py-2 px-4 text-xs text-neutral-500 font-semibold">من</th>
                          <th className="text-right py-2 px-4 text-xs text-neutral-500 font-semibold">حتى</th>
                          <th className="text-right py-2 px-4 text-xs text-neutral-500 font-semibold">دفعات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {schedulePreview.map(row => (
                          <tr key={row.day} className="hover:bg-purple-50/40 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded">يوم {row.day}</span>
                            </td>
                            <td className="py-2.5 px-4 text-neutral-700 font-semibold">{row.count}</td>
                            <td className="py-2.5 px-4 text-neutral-500 font-mono text-xs" dir="ltr">{row.start}</td>
                            <td className="py-2.5 px-4 text-neutral-500 font-mono text-xs" dir="ltr">~{row.end}</td>
                            <td className="py-2.5 px-4 text-neutral-500 text-xs">{row.batches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700 space-y-1">
                  <p>• سيبدأ الإرسال الساعة {scheduleTime} في كل يوم تلقائياً</p>
                  <p>• أبقِ المتصفح والجهاز يعملان طوال فترة الإرسال</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={startSending}
            disabled={!template.trim() || selected.size === 0}
            className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2">
            <Send size={18} />
            {scheduleEnabled
              ? `جدولة الإرسال لـ ${selected.size} مستلم — ${schedulePreview.length} أيام`
              : `بدء الإرسال لـ ${selected.size} مستلم`}
          </button>
        </div>
      )}

      {/* ═══════════ STEP 4: SENDING ═══════════ */}
      {step === 'sending' && (
        <div className="space-y-4">
          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-800 font-bold text-lg">
                  {countdownType === 'day'
                    ? 'انتظار موعد الجلسة التالية...'
                    : countdownType === 'batch'
                    ? 'استراحة بين الدفعات'
                    : isPaused
                    ? 'متوقف مؤقتاً...'
                    : 'جارٍ الإرسال...'}
                </p>
                <p className="text-neutral-400 text-sm mt-0.5">
                  {scheduleEnabled
                    ? `اليوم ${scheduledDay} من ${totalDays} — الدفعة ${currentBatch}`
                    : `الدفعة ${currentBatch} من ${totalBatches}`}
                </p>
              </div>
              <Loader2 size={26} className={`text-blue-500 ${(pauseCountdown !== null || isPaused) ? 'opacity-30' : 'animate-spin'}`} />
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-neutral-500">{currentIdx} / {selectedRecipients.length}</span>
                <span className="font-bold text-blue-600">{pct}%</span>
              </div>
              <div className="w-full bg-neutral-100 rounded-full h-3">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-neutral-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-neutral-700">{currentIdx}</p>
                <p className="text-xs text-neutral-400 mt-0.5">معالج</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{sentCount}</p>
                <p className="text-xs text-neutral-400 mt-0.5">تم الإرسال ✓</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{failCount}</p>
                <p className="text-xs text-neutral-400 mt-0.5">فشل ✗</p>
              </div>
            </div>

            {/* Countdown */}
            {pauseCountdown !== null && (
              <div className={`border rounded-xl p-5 text-center ${
                countdownType === 'day'
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                {countdownType === 'day'
                  ? <Calendar size={20} className="text-purple-500 mx-auto mb-2" />
                  : <Clock    size={20} className="text-amber-500 mx-auto mb-2" />}
                <p className={`font-semibold text-sm ${countdownType === 'day' ? 'text-purple-700' : 'text-amber-700'}`}>
                  {countdownType === 'day'
                    ? `جلسة اليوم ${scheduledDay + 1} ستبدأ الساعة ${scheduleTime}`
                    : 'استراحة تلقائية — ستستأنف قريباً'}
                </p>
                <p className={`text-5xl font-bold mt-3 font-mono tabular-nums ${
                  countdownType === 'day' ? 'text-purple-600' : 'text-amber-600'
                }`}>
                  {pauseCountdown >= 3600
                    ? `${fmt2(Math.floor(pauseCountdown/3600))}:${fmt2(Math.floor((pauseCountdown%3600)/60))}:${fmt2(pauseCountdown%60)}`
                    : `${fmt2(Math.floor(pauseCountdown/60))}:${fmt2(pauseCountdown%60)}`}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-3">
              <button onClick={togglePause}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  isPaused ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}>
                {isPaused ? <><PlayCircle size={16}/>استئناف</> : <><PauseCircle size={16}/>إيقاف مؤقت</>}
              </button>
              <button onClick={requestStop}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-red-100 text-red-600 hover:bg-red-200 transition-all">
                <StopCircle size={16}/>إيقاف نهائي
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
                <p className="text-sm font-semibold text-neutral-600">آخر الرسائل</p>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-neutral-50">
                {[...results].reverse().slice(0, 25).map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {r.status === 'sent'
                        ? <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                        : <XCircle    size={14} className="text-red-400 flex-shrink-0"/>}
                      <span className="text-neutral-700 text-sm">{r.name || r.phone}</span>
                    </div>
                    <span className={`text-xs ${r.status === 'sent' ? 'text-green-500' : 'text-red-400'}`}>
                      {r.status === 'sent' ? 'تم ✓' : r.reason || 'فشل'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ STEP 5: RESULTS ═══════════ */}
      {step === 'results' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'إجمالي',     value: results.length, color: 'text-neutral-800', bg: 'card' },
              { label: 'تم الإرسال', value: sentCount,      color: 'text-green-600',  bg: 'card-teal' },
              { label: 'فشل',        value: failCount,      color: 'text-red-500',    bg: 'card-amber' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} p-5 text-center rounded-2xl`}>
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-neutral-500 text-sm mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-neutral-600">تفاصيل الإرسال</p>
              <button onClick={reset} className="btn-primary text-xs py-1.5 px-4">إرسال جديد</button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-neutral-50">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                  <div className="flex items-center gap-3">
                    {r.status === 'sent'
                      ? <CheckCircle size={16} className="text-green-500 flex-shrink-0"/>
                      : <XCircle    size={16} className="text-red-400 flex-shrink-0"/>}
                    <div>
                      <p className="text-neutral-800 text-sm font-medium">{r.name || '—'}</p>
                      <p className="text-neutral-400 text-xs font-mono">{r.phone}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    r.status === 'sent' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                  }`}>
                    {r.status === 'sent' ? 'تم الإرسال' : (r.reason || 'فشل')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
