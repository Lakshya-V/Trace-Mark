'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  ClipboardCheck,
  CloudUpload,
  FileCheck2,
  FileDigit,
  FileText,
  Fingerprint,
  History,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  User as UserIcon,
  X,
  Zap,
} from 'lucide-react'

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'generator', label: 'Paper Generator', icon: FileDigit },
  { id: 'inspector', label: 'Leak Inspector', icon: Fingerprint },
  { id: 'audit', label: 'Audit Trail', icon: History },
] as const

type PageId = (typeof navItems)[number]['id'] | 'profile'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const errorMsg = payload.detail?.error?.message || (typeof payload.detail === 'string' ? payload.detail : 'Request failed')
    throw new Error(errorMsg)
  }
  return payload.data ?? payload
}

type SessionUser = {
  id: number
  full_name?: string
  name: string
  email: string
  organization_name?: string
  press_id?: string
  center_code?: string
  role?: string
}

type Session = { user: SessionUser; access_token: string }
type OverviewStats = { scans_this_month: number; leaks_verified: number; documents_secured: number; avg_confidence: number }
type OverviewAlert = { alert_id: string; detection: string; center: string; status: string; timestamp: string }
type AuditRecord = {
  scan_id: string
  source_file: string
  examination?: string
  center_code?: string
  press_id?: string
  batch_code?: string
  copy_number?: string | number
  analyst: string
  result: string
  confidence: number
  timestamp: string
}

type ScanResponse = {
  success?: boolean
  status: string
  detected?: boolean
  scan_uuid?: string
  confidence?: number
  encoded_info?: {
    press_id?: string
    center_code?: string
    examination?: string
    batch_code?: string
    copy_number?: string | number
  }
  metadata?: {
    press_id?: string
    center_code?: string
    examination?: string
    batch_code?: string
    copy_number?: string | number
  }
  technical_diagnostics?: {
    total_patches_analyzed?: number
    bitstream?: number[]
    detected_shift?: string
    prediction_bit?: number
    shift_direction?: string
    shift_points?: number
  }
  detected_shift?: string
  prediction_bit?: number
  shift_direction?: string
  shift_points?: number
  probabilities?: number[]
  preview_image?: string
  pipeline?: Record<string, string>
  filename?: string
  timestamp?: string
  total_patches_analyzed?: number
  bitstream?: number[]
}

const spring = { type: 'spring', stiffness: 420, damping: 30 } as const

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) { setCurrent(value); return }
    let start = 0
    const startTime = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / 850, 1)
      start = Math.round((1 - Math.pow(1 - progress, 3)) * value)
      setCurrent(start)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value, reduced])
  return <>{current.toLocaleString()}{suffix}</>
}

function GlassCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`glass-card ${className}`} {...props}>{children}</div>
}

function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (id: PageId) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Fingerprint size={21} strokeWidth={2.4} /></div>
        <div><div className="brand-name">Trace<span>-</span>Mark</div><div className="brand-sub">FORENSICS PLATFORM</div></div>
      </div>
      <div className="side-section-label">Workspace</div>
      <nav className="nav-list" aria-label="Workspace navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <motion.button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: .98 }}
              transition={spring}
            >
              {isActive && <motion.span className="nav-pill" layoutId="nav-pill" transition={spring} />}
              <Icon size={17} />
              <span>{item.label}</span>
              {isActive && (
                <motion.div className="nav-chevron" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>
                  <ChevronRight size={14} />
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-status"><span className="live-dot" />All systems operational</div>
        <div className="secure-lock"><LockKeyhole size={13} /> Secure environment · v2.4.1</div>
      </div>
    </aside>
  )
}

function TopBar({
  active,
  user,
  onNavigate,
  onLogout,
}: {
  active: PageId
  user?: SessionUser
  onNavigate: (id: PageId) => void
  onLogout: () => void
}) {
  const label = active === 'profile' ? 'Profile' : navItems.find((item) => item.id === active)?.label || 'Overview'
  const [menu, setMenu] = useState<'notifications' | 'profile' | null>(null)
  const toggleMenu = (next: 'notifications' | 'profile') => setMenu((current) => current === next ? null : next)

  const initials = (user?.full_name || user?.name || 'TM')
    .split(' ')
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TM'

  return (
    <header className="topbar">
      <div className="mobile-menu"><Menu size={19} /></div>
      <div className="breadcrumb">
        <span>Trace-Mark</span>
        <ChevronRight size={14} />
        <strong>{label}</strong>
      </div>
      <div className="top-actions">
        <div className="security-chip"><span className="live-dot" />Secure session</div>
        
        {/* Notifications */}
        <div className="top-menu">
          <button className="icon-button" aria-label="Notifications" aria-expanded={menu === 'notifications'} onClick={() => toggleMenu('notifications')}>
            <Bell size={17} /><span className="notification-dot" />
          </button>
          {menu === 'notifications' && (
            <div className="top-dropdown">
              <strong>Notifications</strong>
              <span>No new alerts. All systems nominal.</span>
            </div>
          )}
        </div>

        {/* Profile Avatar Button */}
        <div className="top-menu" style={{ position: 'relative' }}>
          <button
            className="avatar"
            aria-label="Open profile"
            aria-expanded={menu === 'profile'}
            onClick={() => toggleMenu('profile')}
            title="User Profile"
          >
            {initials}
          </button>
          {menu === 'profile' && (
            <div className="top-dropdown" style={{ minWidth: '220px', padding: '14px' }}>
              <div style={{ borderBottom: '1px solid #dcebec', paddingBottom: '10px', marginBottom: '10px' }}>
                <strong style={{ display: 'block', fontSize: '13px', color: '#10253a' }}>{user?.full_name || user?.name}</strong>
                <span style={{ fontSize: '11px', color: '#6b7e91' }}>{user?.email}</span>
                {user?.organization_name && (
                  <div style={{ fontSize: '10px', color: '#087e65', fontWeight: 600, marginTop: '4px' }}>
                    {user.organization_name}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="outline-button full"
                style={{ fontSize: '11px', padding: '6px 10px', marginBottom: '8px' }}
                onClick={() => {
                  setMenu(null)
                  onNavigate('profile')
                }}
              >
                <UserIcon size={14} /> View Profile
              </button>
              <button
                type="button"
                className="logout-button full"
                style={{ fontSize: '11px', padding: '6px 10px', justifyContent: 'center' }}
                onClick={() => {
                  setMenu(null)
                  onLogout()
                }}
              >
                <LogOut size={13} /> Log out
              </button>
            </div>
          )}
        </div>

        {/* Direct Log Out Button */}
        <button className="logout-button" onClick={onLogout}>
          <LogOut size={15} /> <span>Log out</span>
        </button>
      </div>
    </header>
  )
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function MetricCard({ label, value, suffix, note, icon: Icon, tone }: { label: string; value: number; suffix?: string; note: string; icon: typeof Activity; tone: string }) {
  return (
    <motion.div className="metric-card" whileHover={{ y: -4, rotateX: 2, rotateY: -2 }} transition={spring}>
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div>
      <div className="metric-value"><CountUp value={value} suffix={suffix} /></div>
      <div className="metric-note"><span className="trend">↗</span>{note}</div>
    </motion.div>
  )
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  const isVerified = children === 'Verified' || children === 'Verified leak' || children === 'VERIFIED'
  const isNeutral = children === 'No match' || children === 'NEUTRAL'
  return <span className={`status-badge ${isVerified ? 'verified' : isNeutral ? 'neutral' : 'review'}`}>{children}</span>
}

function DynamicOverview({ token, user }: { token: string; user: SessionUser }) {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [alerts, setAlerts] = useState<OverviewAlert[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiRequest<OverviewStats>('/api/overview/stats', {}, token),
      apiRequest<OverviewAlert[]>('/api/overview/alerts', {}, token),
    ])
      .then(([nextStats, nextAlerts]) => {
        setStats(nextStats)
        setAlerts(nextAlerts)
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load overview.'))
  }, [token])

  const values = stats
    ? [
        { label: 'Scans this month', value: stats.scans_this_month, tone: 'blue' },
        { label: 'Leaks verified', value: stats.leaks_verified, tone: 'red' },
        { label: 'Documents secured', value: stats.documents_secured, tone: 'green' },
        { label: 'Avg. confidence', value: Math.round(stats.avg_confidence * 100), suffix: '%', tone: 'purple' },
      ]
    : []

  return (
    <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
      <PageHeading
        eyebrow="Command overview"
        title={`Hello, ${user.full_name || user.name}`}
        description="Monitor document provenance and investigate suspected leaks across the network."
      />
      {error && <p role="alert">{error}</p>}
      <motion.div className="metrics-grid">
        {values.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} suffix={metric.suffix} note="Live from Trace-Mark" icon={BarChart3} tone={metric.tone} />
        ))}
      </motion.div>
      <GlassCard className="table-card">
        <div className="card-heading">
          <div>
            <h2>Recent alerts</h2>
            <p>Live detections from the forensics scan pipeline</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Detection</th>
                <th>Center</th>
                <th>Status</th>
                <th>Detected</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#748b96' }}>
                    No alerts recorded yet. Perform a scan in Leak Inspector to log live detections.
                  </td>
                </tr>
              ) : (
                alerts.map((row) => (
                  <tr key={row.alert_id}>
                    <td><span className="mono-id">{row.alert_id.slice(0, 8)}...</span></td>
                    <td>{row.detection}</td>
                    <td>{row.center}</td>
                    <td><StatusBadge>{row.status}</StatusBadge></td>
                    <td>{new Date(row.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function DocumentPreview({
  form,
  file,
  previewImage,
  qualityReport,
}: {
  form: { examination: string; press_id: string; batch_code: string; center_code: string }
  file: File | null
  previewImage: string | null
  qualityReport?: any
}) {
  const examination = form.examination.trim() || 'Awaiting examination name'
  const batchCode = form.batch_code.trim() || 'PENDING-BATCH'
  const centerCode = form.center_code.trim() || 'PENDING-CTR'

  return (
    <GlassCard className="document-preview" style={{ minHeight: '480px' }}>
      <div className="preview-toolbar">
        <div><span className="preview-dot" />Paper Preview</div>
        <span>{file ? file.name : 'No Document Selected'}</span>
      </div>

      {previewImage ? (
        <div className="paper-sheet" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: '100%', minHeight: '300px', display: 'grid', placeItems: 'center', background: '#f5f7f8', borderRadius: '6px', overflow: 'hidden' }}>
            <img
              src={previewImage}
              alt="Generated Trace-Mark Encoded Document"
              style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
          </div>
          {qualityReport && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: '14px', borderTop: '1px solid #dcebec', paddingTop: '10px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#087e65', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Check size={14} /> Encoded &amp; Preserved
                </span>
                <span className="security-chip" style={{ fontSize: '10px' }}>SSIM: {qualityReport.visual_quality?.ssim}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                <div style={{ background: '#f6fbfb', padding: '6px 8px', borderRadius: '6px' }}>
                  <small style={{ color: '#748b96', display: 'block' }}>Pages Encoded</small>
                  <strong>{qualityReport.pages_encoded} page(s)</strong>
                </div>
                <div style={{ background: '#f6fbfb', padding: '6px 8px', borderRadius: '6px' }}>
                  <small style={{ color: '#748b96', display: 'block' }}>Payload Bits</small>
                  <strong>{qualityReport.payload_bits} bits (RS-16)</strong>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ) : file ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', color: '#5b7682', textAlign: 'center', padding: '24px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#e1f4ef', display: 'grid', placeItems: 'center', color: '#087e65', marginBottom: '14px' }}>
            <FileText size={28} />
          </div>
          <strong style={{ fontSize: '14px', color: '#163a4e', marginBottom: '4px' }}>{file.name}</strong>
          <small style={{ color: '#6b7e91', marginBottom: '12px' }}>PDF Document · {(file.size / 1024).toFixed(1)} KB</small>
          <p style={{ fontSize: '11px', maxWidth: '300px', margin: 0, color: '#748b96' }}>
            Source document ready. Click <b>Generate PDF</b> to encode cryptographically protected provenance without altering the visual formatting.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', color: '#748b96', textAlign: 'center', padding: '24px' }}>
          <FileText size={44} strokeWidth={1.4} style={{ color: '#97b1bb', marginBottom: '12px' }} />
          <strong style={{ fontSize: '13px', color: '#163a4e', marginBottom: '4px' }}>Awaiting source document</strong>
          <p style={{ fontSize: '11px', maxWidth: '280px', margin: 0 }}>
            Select a PDF document in the generator to preview and embed Trace-Mark forensic marks.
          </p>
        </div>
      )}

      <div className="preview-caption">
        <div><span className="live-dot" />Dynamic Forensics View</div>
        <span>{previewImage ? 'Generated PDF page preview' : file ? 'Document loaded' : 'Awaiting input'}</span>
      </div>
    </GlassCard>
  )
}

function DynamicGenerator({ token }: { token: string }) {
  const [form, setForm] = useState({ examination: '', press_id: '', batch_code: '', center_code: '' })
  const [file, setFile] = useState<File | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<number | null>(null)
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null)
  const [qualityReport, setQualityReport] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return setError('Choose a PDF source document.')
    setBusy(true)
    setError('')
    const body = new FormData()
    Object.entries(form).forEach(([key, value]) => body.append(key, value))
    body.append('file', file)

    try {
      const result = await apiRequest<{ document_id: number; download_url: string; quality_report: any; preview_image?: string }>(
        '/api/generate-paper',
        { method: 'POST', body },
        token
      )
      setGeneratedDocId(result.document_id)
      setQualityReport(result.quality_report)
      if (result.preview_image) {
        setGeneratedPreview(result.preview_image)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!generatedDocId) return
    try {
      setDownloading(true)
      const downloadUrl = `${API_BASE}/api/documents/${generatedDocId}/download?token=${encodeURIComponent(token)}`
      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail?.error?.message || err.detail || 'Failed to download PDF')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tracemark_${form.batch_code || 'generated'}_${generatedDocId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download generated PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  return (
    <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
      <PageHeading
        eyebrow="Secure issuance"
        title="Paper generator"
        description="Create traceable examination papers with embedded forensic markers."
      />
      <div className="generator-layout">
        <GlassCard className="form-card">
          <form onSubmit={submit}>
            <div className="card-heading">
              <div>
                <h2>Paper details</h2>
                <p>Every field is encrypted and logged in the provenance registry.</p>
              </div>
            </div>
            {(['examination', 'press_id', 'batch_code', 'center_code'] as const).map((key) => (
              <label key={key}>
                {key.replace('_', ' ').toUpperCase()}
                <input
                  className="generator-input"
                  placeholder={`Enter ${key.replace('_', ' ')}...`}
                  value={form[key]}
                  onChange={update(key)}
                  required
                />
              </label>
            ))}
            <label>
              SOURCE DOCUMENT (PDF)
              <input
                className="generator-input"
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setGeneratedDocId(null)
                  setGeneratedPreview(null)
                  setQualityReport(null)
                }}
                required
              />
            </label>

            {error && <p role="alert" style={{ color: '#d06868', marginTop: '12px', fontSize: '12px' }}>{error}</p>}

            {/* ACTION BUTTON 1: GENERATE PDF */}
            <button className="primary-button full" style={{ marginTop: '20px' }} disabled={busy}>
              {busy ? <><Activity size={15} className="spin" /> Generating Paper...</> : <>Generate PDF <ArrowUpRight size={15} /></>}
            </button>

            {/* ACTION BUTTON 2: DOWNLOAD GENERATED PDF - WITH EXPLICIT INCREASED SPACING (24px) */}
            {generatedDocId && (
              <button
                type="button"
                className="outline-button full"
                style={{ marginTop: '24px' }}
                onClick={handleDownloadPdf}
                disabled={downloading}
              >
                <FileText size={15} />
                {downloading ? 'Downloading...' : 'Download generated PDF'}
                <ArrowUpRight size={14} />
              </button>
            )}
          </form>
        </GlassCard>
        
        <DocumentPreview form={form} file={file} previewImage={generatedPreview} qualityReport={qualityReport} />
      </div>
    </motion.div>
  )
}


const pipelineStages = [
  'OpenCV Perspective Dewarp & Normalization',
  'Illumination & Contrast Correction',
  'Trace-Mark ResNet-18 DL Model Inference',
  'Micro-spacing Bit & ECC Decoding',
]

function Inspector({ token }: { token?: string }) {
  const [scanning, setScanning] = useState(false)
  const [drag, setDrag] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const timer = useRef<NodeJS.Timeout[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const onFileSelect = (file: File | null) => {
    if (!file) return
    setSelectedFile(file)
    setDone(false)
    setResult(null)
    setError('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const runDetection = async () => {
    if (!selectedFile || scanning) return

    timer.current.forEach(clearTimeout)
    setScanning(true)
    setDone(false)
    setResult(null)
    setError('')
    setStep(0)
    pipelineStages.forEach((_, i) => timer.current.push(setTimeout(() => setStep(i), i * 500)))

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const headers: HeadersInit = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const response = await fetch(`${API_BASE}/api/scan-document`, {
        method: 'POST',
        headers,
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) {
        const detail = typeof payload.detail === 'string' ? payload.detail : payload.detail?.error?.message
        throw new Error(detail || 'The document scan failed.')
      }

      setResult(payload)
      setStep(3)
      setDone(true)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to reach the scan service.')
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    return () => {
      timer.current.forEach(clearTimeout)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
      <PageHeading
        eyebrow="Forensic analysis"
        title="Leak inspector"
        description="Automated Deep Learning pipeline to detect embedded micro-spacing marks and verify provenance."
        action={
          <div className="scan-status">
            <span className="live-dot" />
            {scanning ? 'DL Model Running...' : done ? 'Detection Complete' : 'Scanner Ready'}
          </div>
        }
      />

      <div className="inspector-layout">
        <div>
          {/* Upload Dropzone */}
          <motion.div
            className={`dropzone ${drag ? 'dragging' : ''}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              const dropped = e.dataTransfer.files[0] ?? null
              onFileSelect(dropped)
            }}
            whileHover={{ scale: 1.005 }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click() }}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              hidden
              onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
            />
            <div className="drop-icon"><Upload size={21} /></div>
            <h3>{scanning ? 'Analyzing document with DL model...' : selectedFile ? selectedFile.name : 'Select or drop paper to inspect'}</h3>
            <p>{scanning ? 'Running automated ResNet-18 steganographic classification...' : 'Click to browse image (PNG, JPG, WEBP) or PDF from workspace'}</p>
            <span className="file-types">PNG · JPG · WEBP · PDF</span>
            {scanning && (
              <motion.div
                className="laser-line"
                animate={{ top: ['18%', '82%', '18%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.div>

          {/* Analysis Pipeline Card */}
          <div className="pipeline-card">
            <div className="pipeline-heading">
              <div>
                <h2>Automated Analysis Pipeline</h2>
                <p>Trace-Mark 4-stage forensic extraction & DL detection</p>
              </div>
              <span className="pipeline-counter">
                {done ? 'Complete' : scanning ? `Stage ${step + 1} of 4` : 'Awaiting trigger'}
              </span>
            </div>
            
            <div className="pipeline">
              <div className="pipeline-line">
                <motion.div animate={{ height: `${done ? 100 : Math.max(0, step) / 3 * 100}%` }} transition={{ duration: .45 }} />
              </div>
              {pipelineStages.map((name, i) => (
                <motion.div className={`pipeline-step ${step > i || done ? 'complete' : step === i && scanning ? 'active' : ''}`} key={name}>
                  <div className="step-marker">
                    {step > i || done ? (
                      <motion.div initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}><Check size={14} /></motion.div>
                    ) : (
                      <span>{String(i + 1).padStart(2, '0')}</span>
                    )}
                  </div>
                  <div>
                    <strong>{name}</strong>
                    <small>{step > i || done ? 'Complete' : step === i && scanning ? 'Processing…' : 'Pending'}</small>
                  </div>
                  {step === i && scanning && (
                    <motion.span className="step-pulse" animate={{ scale: [1, 1.25, 1], opacity: [.5, 1, .5] }} transition={{ duration: 1, repeat: Infinity }} />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Clear DL Action Button: Analyze Paper */}
            <button
              className="primary-button full"
              onClick={runDetection}
              disabled={scanning || !selectedFile}
              style={{ marginTop: '16px' }}
            >
              {scanning ? (
                <><Activity size={15} className="spin" /> Analyzing Paper with DL Model...</>
              ) : (
                <><Zap size={15} /> Analyze Paper</>
              )}
            </button>

            {error && <p role="alert" style={{ color: '#d06868', marginTop: '10px', fontSize: '12px' }}>{error}</p>}

            {/* Recovered Metadata Grid from Provenance / ECC */}
            {(result?.encoded_info || result?.metadata) && (() => {
              const info = result.encoded_info || result.metadata || {}
              return (
                <div className="scan-metadata-grid" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  <div style={{ background: '#f6fbfb', padding: '8px', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Examination</small>
                    <strong style={{ fontSize: '12px', color: '#163a4e' }}>{info.examination || 'Review Required'}</strong>
                  </div>
                  <div style={{ background: '#f6fbfb', padding: '8px', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Press ID</small>
                    <strong style={{ fontSize: '12px', color: '#163a4e' }}>{info.press_id || 'Review Required'}</strong>
                  </div>
                  <div style={{ background: '#f6fbfb', padding: '8px', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Center Code</small>
                    <strong style={{ fontSize: '12px', color: '#163a4e' }}>{info.center_code || 'Review Required'}</strong>
                  </div>
                  <div style={{ background: '#f6fbfb', padding: '8px', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Batch Code</small>
                    <strong style={{ fontSize: '12px', color: '#163a4e' }}>{info.batch_code || 'Review Required'}</strong>
                  </div>
                  <div style={{ background: '#f6fbfb', padding: '8px', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Copy Number</small>
                    <strong style={{ fontSize: '12px', color: '#163a4e' }}>#{info.copy_number ?? 1}</strong>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Dynamic Paper Preview & DL Detection Result */}
        <InspectorPaperPreview
          file={selectedFile}
          previewUrl={previewUrl}
          scanning={scanning}
          result={result}
        />
      </div>
    </motion.div>
  )
}

function InspectorPaperPreview({
  file,
  previewUrl,
  scanning,
  result,
}: {
  file: File | null
  previewUrl: string | null
  scanning: boolean
  result: ScanResponse | null
}) {
  return (
    <GlassCard className="document-preview" style={{ minHeight: '480px' }}>
      <div className="preview-toolbar">
        <div>
          <span className="preview-dot" />
          Paper Preview
        </div>
        <span>{file ? file.name : 'No Document Selected'}</span>
      </div>

      {file ? (
        <div className="paper-sheet" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Actual Document Image or Representation */}
          {(result?.preview_image || previewUrl) ? (
            <div style={{ position: 'relative', width: '100%', minHeight: '260px', display: 'grid', placeItems: 'center', background: '#f5f7f8', borderRadius: '6px', overflow: 'hidden' }}>
              {result?.preview_image ? (
                <img
                  src={result.preview_image}
                  alt="Actual paper being inspected"
                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                />
              ) : file.type.startsWith('image/') && previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Actual paper being inspected"
                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                />
              ) : previewUrl ? (
                <object
                  data={previewUrl}
                  type="application/pdf"
                  style={{ width: '100%', height: '300px', border: 'none' }}
                >
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <FileDigit size={36} style={{ color: '#16a074', margin: '0 auto 8px' }} />
                    <strong style={{ display: 'block', fontSize: '13px', color: '#10253a' }}>{file.name}</strong>
                    <small style={{ color: '#6b7e91' }}>PDF Document · {(file.size / 1024).toFixed(1)} KB</small>
                  </div>
                </object>
              ) : null}
              {scanning && (
                <motion.div
                  className="laser-line"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: '20px', background: '#f5f9f9', borderRadius: '6px', border: '1px dashed #bcd9d2', textAlign: 'center' }}>
              <FileDigit size={36} style={{ color: '#16a074', margin: '0 auto 8px' }} />
              <strong style={{ display: 'block', fontSize: '13px', color: '#10253a' }}>{file.name}</strong>
              <small style={{ color: '#6b7e91' }}>PDF Document · {(file.size / 1024).toFixed(1)} KB</small>
            </div>
          )}

          {/* Redesigned Forensic Detection Result: Prioritizes Decoded Metadata over Raw Model Bits */}
          {result && (() => {
            const conf = result.confidence ?? 0
            const pts = result.shift_points ?? 0
            const info = result.encoded_info || result.metadata || {}
            const isDetected = result.detected ?? (result.status === 'complete' || conf >= 0.5)

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ marginTop: '16px', borderTop: '1px solid #dcebec', paddingTop: '14px' }}
              >
                {/* Header: TRACE-MARK DETECTION */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: '2px' }}>
                      <span className="eyebrow-line" /> TRACE-MARK DETECTION
                    </div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#153b4d' }}>
                      {isDetected ? '✓ Encoded information detected' : 'Scan Analysis Complete'}
                    </h3>
                  </div>
                  <div className="verified-stamp" style={{ margin: 0 }}>
                    <Check size={16} /> <span>{conf >= 0.7 && result.status === 'complete' ? 'VERIFIED' : 'DETECTED'}</span>
                  </div>
                </div>

                {/* Model Confidence */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#5b7682', marginBottom: '4px' }}>
                    <span>Model Confidence</span>
                    <span>{(conf * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: '#e3ecef', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round(conf * 100))}%` }}
                      transition={{ duration: 0.7 }}
                      style={{ height: '100%', background: conf >= 0.7 ? '#10a77a' : '#287bc1', borderRadius: '3px' }}
                    />
                  </div>
                </div>

                {/* Prominent Section: ENCODED INFORMATION (ECC-Decoded Provenance) */}
                <div style={{ background: '#f0f8f8', border: '1px solid #cbe5e6', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Fingerprint size={14} /> ENCODED INFORMATION
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Press ID</small>
                      <strong style={{ fontSize: '13px', color: '#10253a' }}>{info.press_id || 'Review Required'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Center Code</small>
                      <strong style={{ fontSize: '13px', color: '#10253a' }}>{info.center_code || 'Review Required'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Examination / Document ID</small>
                      <strong style={{ fontSize: '13px', color: '#10253a' }}>{info.examination || 'Review Required'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Batch Code</small>
                      <strong style={{ fontSize: '13px', color: '#10253a' }}>{info.batch_code || 'Review Required'}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Copy Number</small>
                      <strong style={{ fontSize: '13px', color: '#10253a' }}>#{info.copy_number ?? 1}</strong>
                    </div>
                    <div>
                      <small style={{ color: '#748b96', display: 'block', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Scan UUID</small>
                      <span className="mono-id" style={{ fontSize: '11px', color: '#10253a' }}>{result.scan_uuid || 'Verified'}</span>
                    </div>
                  </div>
                </div>

                {/* Optional Collapsible Technical Details */}
                <details style={{ fontSize: '11px', color: '#5b7682', cursor: 'pointer' }}>
                  <summary style={{ fontWeight: 600, userSelect: 'none', padding: '4px 0' }}>Technical Diagnostics</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginTop: '8px', padding: '8px', background: '#f6fbfb', borderRadius: '6px', border: '1px solid #e1eef0' }}>
                    <div>
                      <span style={{ color: '#748b96', fontSize: '10px', display: 'block' }}>Model Prediction Bit:</span>
                      <strong className="mono-id">{result.prediction_bit ?? 0}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#748b96', fontSize: '10px', display: 'block' }}>Detected Shift:</span>
                      <strong>{result.detected_shift || 'Shift Right'} ({pts > 0 ? `+${pts}` : pts} pt)</strong>
                    </div>
                    <div>
                      <span style={{ color: '#748b96', fontSize: '10px', display: 'block' }}>Patches Analyzed:</span>
                      <strong>{result.total_patches_analyzed ?? 1}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#748b96', fontSize: '10px', display: 'block' }}>ECC Extraction:</span>
                      <strong style={{ color: '#087e65' }}>Complete</strong>
                    </div>
                  </div>
                </details>
              </motion.div>
            )
          })()}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', color: '#748b96', textAlign: 'center', padding: '20px' }}>
          <FileText size={48} strokeWidth={1.4} style={{ color: '#97b1bb', marginBottom: '14px' }} />
          <strong style={{ fontSize: '14px', color: '#163a4e', marginBottom: '6px' }}>Awaiting paper upload</strong>
          <p style={{ fontSize: '12px', maxWidth: '280px', margin: 0 }}>
            Upload or drop an examination paper in the inspector to preview the document and run automated DL mark detection.
          </p>
        </div>
      )}

      <div className="preview-caption">
        <div><span className="live-dot" />Dynamic Forensics View</div>
        <span>{result ? 'Actual DL inference output' : 'Awaiting paper submission'}</span>
      </div>
    </GlassCard>
  )
}

function DynamicAudit({ token }: { token: string }) {
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', search: query })
    apiRequest<{ total: number; records: AuditRecord[] }>(`/api/audit-trail?${params}`, {}, token)
      .then((result) => {
        setTotal(result.total)
        setRecords(result.records)
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load audit trail.'))
  }, [page, query, token])

  const handleExportLog = async () => {
    try {
      setExporting(true)
      const exportUrl = `${API_BASE}/api/audit-trail/export?token=${encodeURIComponent(token)}`
      const res = await fetch(exportUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail?.error?.message || err.detail || 'Export failed.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tracemark_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export audit trail.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
      <PageHeading
        eyebrow="Chain of custody"
        title="Audit trail"
        description="A tamper-evident record of every document scan and forensic action."
        action={
          <button type="button" className="outline-button" onClick={handleExportLog} disabled={exporting}>
            <Archive size={15} /> {exporting ? 'Exporting...' : 'Export log'}
          </button>
        }
      />
      {error && <p role="alert">{error}</p>}
      <GlassCard className="table-card audit-card">
        <div className="audit-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search scans or files..."
              value={query}
              onChange={(event) => { setPage(1); setQuery(event.target.value) }}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scan ID</th>
                <th>Source file</th>
                <th>Examination</th>
                <th>Center / Press</th>
                <th>Analyst</th>
                <th>Result</th>
                <th>Confidence</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#748b96' }}>
                    No audit records match your query.
                  </td>
                </tr>
              ) : (
                records.map((row) => (
                  <tr key={row.scan_id}>
                    <td><span className="mono-id">{row.scan_id.slice(0, 12)}...</span></td>
                    <td>{row.source_file}</td>
                    <td><strong style={{ color: '#163a4e' }}>{row.examination || '—'}</strong></td>
                    <td>
                      <div style={{ fontSize: '11px' }}>
                        <span>{row.center_code || '—'}</span>
                        {row.press_id && row.press_id !== '—' && <span style={{ color: '#748b96', marginLeft: '4px' }}>({row.press_id})</span>}
                      </div>
                    </td>
                    <td>{row.analyst}</td>
                    <td><StatusBadge>{row.result}</StatusBadge></td>
                    <td>{Math.round(row.confidence * 100)}%</td>
                    <td className="muted">{new Date(row.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Showing {records.length} of {total} records
          <span>
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button disabled={records.length === 0 || page * 20 >= total} onClick={() => setPage(page + 1)}>Next</button>
          </span>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function DynamicProfile({ user, token, onLogout }: { user: SessionUser; token: string; onLogout: () => void }) {
  const [profile, setProfile] = useState<SessionUser>(user)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ user: SessionUser }>('/api/auth/me', {}, token)
      .then((res) => setProfile(res.user))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to refresh profile'))
  }, [token])

  const initials = (profile.full_name || profile.name || 'Analyst')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
      <PageHeading
        eyebrow="Identity & Access"
        title="Analyst Profile"
        description="Verified forensic analyst credentials and institutional authorizations."
        action={
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={15} /> Sign out
          </button>
        }
      />
      {error && <p role="alert">{error}</p>}
      <div className="generator-layout">
        <GlassCard className="form-card">
          <div className="card-heading">
            <div>
              <h2>Credential Details</h2>
              <p>Cryptographically verified identity records.</p>
            </div>
            <ShieldCheck size={22} className="heading-icon" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '20px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#0eaa7a,#087d68)', color: 'white', display: 'grid', placeItems: 'center', fontSize: '20px', fontWeight: 700 }}>
              {initials}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#163a4e' }}>{profile.full_name || profile.name}</h3>
              <p style={{ margin: '2px 0 0', color: '#6b7e91', fontSize: '12px' }}>{profile.email}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '12px' }}>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>System Role</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10253a' }}>{profile.role || 'Forensic Analyst'}</div>
            </div>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>User ID</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10253a', fontFamily: 'monospace' }}>#{profile.id}</div>
            </div>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Organization</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10253a' }}>{profile.organization_name || 'Not assigned'}</div>
            </div>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Press ID</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10253a' }}>{profile.press_id || 'Not assigned'}</div>
            </div>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Center Code</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10253a' }}>{profile.center_code || 'Not assigned'}</div>
            </div>
            <div style={{ background: '#f6fbfb', padding: '12px', borderRadius: '8px', border: '1px solid #dcebec' }}>
              <small style={{ color: '#748b96', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Session Type</small>
              <div style={{ fontWeight: 700, marginTop: '4px', color: '#10a77a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="live-dot" /> JWT (HS256)
              </div>
            </div>
          </div>
        </GlassCard>
        
        <GlassCard className="form-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '36px 24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#dff4ef', display: 'grid', placeItems: 'center', color: '#087e65', marginBottom: '16px' }}>
            <LockKeyhole size={28} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: '18px', color: '#163a4e' }}>Cryptographic Verification</h3>
          <p style={{ margin: '0 0 20px', color: '#6b7e91', fontSize: '12px', maxWidth: '320px' }}>
            Your session is actively signed with HMAC-SHA256 and authenticated with the Trace-Mark audit engine.
          </p>
          <div className="security-chip"><span className="live-dot" /> Verified Forensic Session</div>
        </GlassCard>
      </div>
    </motion.div>
  )
}

function DynamicAuth({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [otpStep, setOtpStep] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    identifier: '',
    password: '',
    confirm_password: '',
    otp: '',
  })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'register') {
        if (!form.full_name.trim()) throw new Error('Full Name is required.')
        if (!form.email.trim()) throw new Error('Work Email is required.')
        if (form.password !== form.confirm_password) throw new Error('Passwords do not match.')
        const session = await apiRequest<Session>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            email: form.email.trim(),
            password: form.password,
          }),
        })
        onAuthenticated(session)
      } else if (!otpStep) {
        const result = await apiRequest<{ development_otp?: string }>('/api/auth/login-step1', {
          method: 'POST',
          body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
        })
        setOtpStep(true)
        setMessage(result.development_otp ? `Development OTP: ${result.development_otp}` : 'Enter the 6-digit code sent to your account.')
      } else {
        const session = await apiRequest<Session>('/api/auth/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ identifier: form.identifier.trim(), otp: form.otp }),
        })
        onAuthenticated(session)
      }
    } catch (authError) {
      setMessage(authError instanceof Error ? authError.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="brand-mark"><Fingerprint size={21} strokeWidth={2.4} /></div>
          <div><div className="brand-name">Trace<span>-</span>Mark</div><div className="brand-sub">FORENSICS PLATFORM</div></div>
        </div>
        <div className="auth-copy">
          <div className="eyebrow"><span className="eyebrow-line" />Secure workspace</div>
          <h1>{otpStep ? 'Verify your identity' : mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
          <p>{otpStep ? 'Enter the 6-digit verification code.' : mode === 'login' ? 'Sign in to access document provenance and forensic activity.' : 'Register your secure analyst account with your name, work email, and password.'}</p>
        </div>

        <form className="auth-form" onSubmit={submit} autoComplete={mode === 'login' ? 'on' : 'off'}>
          {otpStep ? (
            <label>
              6-digit OTP
              <input
                className="auth-input"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="Enter 6-digit OTP"
                value={form.otp}
                onChange={update('otp')}
                required
              />
            </label>
          ) : (
            <>
              {mode === 'register' ? (
                <>
                  <label>
                    Full Name
                    <input
                      className="auth-input"
                      placeholder="Enter your full name..."
                      value={form.full_name}
                      onChange={update('full_name')}
                      required
                    />
                  </label>
                  <label>
                    Work Email
                    <input
                      className="auth-input"
                      type="email"
                      placeholder="Enter work email (e.g. analyst@nta.ac.in)..."
                      value={form.email}
                      onChange={update('email')}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="Create a secure password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={update('password')}
                      required
                    />
                  </label>
                  <label>
                    Confirm Password
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      value={form.confirm_password}
                      onChange={update('confirm_password')}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Username or Email
                    <input
                      className="auth-input"
                      placeholder="Enter username or email"
                      autoComplete="username"
                      value={form.identifier}
                      onChange={update('identifier')}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      value={form.password}
                      onChange={update('password')}
                      required
                    />
                  </label>
                </>
              )}
            </>
          )}

          {message && <p role="alert" style={{ color: message.includes('failed') || message.includes('match') ? '#d06868' : '#087e65', fontSize: '12px' }}>{message}</p>}

          <button className="primary-button auth-submit" disabled={busy}>
            {busy ? 'Please wait...' : otpStep ? 'Verify code' : mode === 'login' ? 'Continue to verification' : 'Create secure account'}
            <ArrowUpRight size={15} />
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'New to Trace-Mark?' : 'Already have an account?'}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setOtpStep(false)
              setMessage('')
            }}
          >
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>

      <aside className="auth-visual">
        <div className="auth-visual-inner">
          <div className="visual-kicker">DOCUMENT FORENSICS · 02</div>
          <h2>Trust every<br /><em>document.</em></h2>
          <p>Trace provenance. Detect leaks. Preserve confidence.</p>
        </div>
      </aside>
    </main>
  )
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null)
  const [active, setActive] = useState<PageId>('overview')

  useEffect(() => {
    const saved = localStorage.getItem('trace_mark_session')
    if (saved) {
      try {
        setSession(JSON.parse(saved) as Session)
      } catch {
        localStorage.removeItem('trace_mark_session')
      }
    }
  }, [])

  if (!session) {
    return (
      <DynamicAuth
        onAuthenticated={(nextSession) => {
          localStorage.setItem('trace_mark_session', JSON.stringify(nextSession))
          localStorage.setItem('trace_mark_token', nextSession.access_token)
          setSession(nextSession)
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={setActive} />
      <div className="content-shell">
        <TopBar
          active={active}
          user={session.user}
          onNavigate={setActive}
          onLogout={() => {
            localStorage.removeItem('trace_mark_session')
            localStorage.removeItem('trace_mark_token')
            setSession(null)
          }}
        />
        <main className="main-content">
          <AnimatePresence mode="wait">
            {active === 'overview' && (
              <DynamicOverview key="overview" token={session.access_token} user={session.user} />
            )}
            {active === 'generator' && (
              <DynamicGenerator key="generator" token={session.access_token} />
            )}
            {active === 'inspector' && (
              <Inspector key="inspector" token={session.access_token} />
            )}
            {active === 'audit' && (
              <DynamicAudit key="audit" token={session.access_token} />
            )}
            {active === 'profile' && (
              <DynamicProfile
                key="profile"
                user={session.user}
                token={session.access_token}
                onLogout={() => {
                  localStorage.removeItem('trace_mark_session')
                  localStorage.removeItem('trace_mark_token')
                  setSession(null)
                }}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
