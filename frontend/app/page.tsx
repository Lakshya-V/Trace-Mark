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
  X,
  Zap,
} from 'lucide-react'

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'generator', label: 'Paper Generator', icon: FileDigit },
  { id: 'inspector', label: 'Leak Inspector', icon: Fingerprint },
  { id: 'audit', label: 'Audit Trail', icon: History },
] as const

type PageId = (typeof navItems)[number]['id']

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail?.error?.message || payload.detail || 'Request failed')
  return payload.data ?? payload
}

const alerts = [
  { id: 'AL-9821', type: 'Watermark match', detail: 'Mathematics · Set B', center: 'North District Center', status: 'Verified', time: '2 min ago' },
  { id: 'AL-9818', type: 'Pattern anomaly', detail: 'Physics · Set A', center: 'Central Examination Board', status: 'Review', time: '18 min ago' },
  { id: 'AL-9814', type: 'Watermark match', detail: 'Chemistry · Set C', center: 'East Regional Hub', status: 'Verified', time: '44 min ago' },
  { id: 'AL-9812', type: 'Batch mismatch', detail: 'English · Set A', center: 'South District Center', status: 'Review', time: '1 hr ago' },
]

const auditRows = [
  { scan: 'SC-2024-0842', file: 'math_set_b_scan.png', analyst: 'R. Sharma', result: 'Verified leak', confidence: '98.7%', date: 'Today, 09:42' },
  { scan: 'SC-2024-0841', file: 'physics_set_a.jpg', analyst: 'A. Patel', result: 'Under review', confidence: '76.2%', date: 'Today, 09:18' },
  { scan: 'SC-2024-0840', file: 'chemistry_batch_c.tiff', analyst: 'R. Sharma', result: 'Verified leak', confidence: '94.1%', date: 'Today, 08:55' },
  { scan: 'SC-2024-0839', file: 'english_set_a.png', analyst: 'M. Khan', result: 'No match', confidence: '21.4%', date: 'Yesterday, 17:26' },
  { scan: 'SC-2024-0838', file: 'history_set_d.jpg', analyst: 'A. Patel', result: 'Verified leak', confidence: '91.8%', date: 'Yesterday, 16:02' },
]

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
          return <motion.button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)} whileHover={{ x: 3 }} whileTap={{ scale: .98 }} transition={spring}>
            {active === item.id && <motion.span className="nav-pill" layoutId="nav-pill" transition={spring} />}
            <Icon size={17} /><span>{item.label}</span>{active === item.id && <motion.div className="nav-chevron" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}><ChevronRight size={14} /></motion.div>}
          </motion.button>
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="system-status"><span className="live-dot" />All systems operational</div>
        <div className="secure-lock"><LockKeyhole size={13} /> Secure environment · v2.4.1</div>
      </div>
    </aside>
  )
}

function TopBar({ active, onReport, onLogout }: { active: PageId; onReport: () => void; onLogout: () => void }) {
  const label = navItems.find((item) => item.id === active)?.label
  const [menu, setMenu] = useState<'notifications' | 'profile' | null>(null)
  const toggleMenu = (next: 'notifications' | 'profile') => setMenu((current) => current === next ? null : next)
  return <header className="topbar"><div className="mobile-menu"><Menu size={19} /></div><div className="breadcrumb"><span>Trace-Mark</span><ChevronRight size={14} /><strong>{label}</strong></div><div className="top-actions"><div className="security-chip"><span className="live-dot" />Secure session</div><div className="top-menu"><button className="icon-button" aria-label="Notifications" aria-expanded={menu === 'notifications'} onClick={() => toggleMenu('notifications')}><Bell size={17} /><span className="notification-dot" /></button>{menu === 'notifications' && <div className="top-dropdown"><strong>Notifications</strong><span>No new alerts.</span></div>}</div><div className="top-menu"><button className="avatar" aria-label="Open profile" aria-expanded={menu === 'profile'} onClick={() => toggleMenu('profile')}>TM</button>{menu === 'profile' && <div className="top-dropdown"><strong>Profile</strong><span>Account settings are coming soon.</span></div>}</div><button className="logout-button" onClick={onLogout}><LogOut size={15} /> <span>Log out</span></button><button className="report-button" onClick={onReport}><FileText size={15} /> Forensic report <ArrowUpRight size={14} /></button></div></header>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function MetricCard({ label, value, suffix, note, icon: Icon, tone }: { label: string; value: number; suffix?: string; note: string; icon: typeof Activity; tone: string }) {
  return <motion.div className="metric-card" whileHover={{ y: -4, rotateX: 2, rotateY: -2 }} transition={spring}>
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div>
    <div className="metric-value"><CountUp value={value} suffix={suffix} /></div>
    <div className="metric-note"><span className="trend">↗</span>{note}</div>
  </motion.div>
}

function StatusBadge({ children }: { children: React.ReactNode }) { return <span className={`status-badge ${children === 'Verified' || children === 'Verified leak' ? 'verified' : children === 'No match' ? 'neutral' : 'review'}`}>{children}</span> }

function Overview({ onReport }: { onReport: () => void }) {
  return <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}>
    <PageHeading eyebrow="Command overview" title="Hello, Rohan" description="Monitor document provenance and investigate suspected leaks across the network." action={<button className="outline-button" onClick={onReport}><ClipboardCheck size={16} /> View latest report</button>} />
    <motion.div className="metrics-grid" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: .07 } } }}>
      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><MetricCard label="Scans this month" value={12847} note="12.4% vs last month" icon={BarChart3} tone="blue" /></motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><MetricCard label="Leaks verified" value={38} note="5 detected this week" icon={AlertTriangle} tone="red" /></motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><MetricCard label="Documents secured" value={9821} note="98.2% coverage" icon={ShieldCheck} tone="green" /></motion.div>
      <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}><MetricCard label="Avg. confidence" value={96} suffix="%" note="2.1% vs last month" icon={Sparkles} tone="purple" /></motion.div>
    </motion.div>
    <GlassCard className="table-card"><div className="card-heading"><div><h2>Recent alerts</h2><p>Live detections from the last 24 hours</p></div><button className="text-button">View all <ArrowUpRight size={14} /></button></div><div className="table-wrap"><table><thead><tr><th>Alert ID</th><th>Detection</th><th>Center</th><th>Status</th><th>Detected</th><th /></tr></thead><tbody>{alerts.map((row, i) => <motion.tr key={row.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 + i * .06 }}><td><span className="mono-id">{row.id}</span></td><td><div className="detection"><span className="alert-icon"><Zap size={13} /></span><div><strong>{row.type}</strong><small>{row.detail}</small></div></div></td><td>{row.center}</td><td><StatusBadge>{row.status}</StatusBadge></td><td className="muted">{row.time}</td><td><button className="row-more" aria-label={`Open ${row.id}`}><ArrowUpRight size={15} /></button></td></motion.tr>)}</tbody></table></div></GlassCard>
  </motion.div>
}

function Generator() {
  return <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}><PageHeading eyebrow="Secure issuance" title="Paper generator" description="Create traceable examination papers with embedded forensic markers." action={<button className="primary-button"><CloudUpload size={16} /> Generate paper</button>} /><div className="generator-layout"><GlassCard className="form-card"><div className="card-heading"><div><h2>Paper details</h2><p>Every field is encrypted and logged.</p></div><FileCheck2 size={19} className="heading-icon" /></div><label>Examination<input defaultValue="National Board Examination · 2024" /></label><label>Press ID<div className="input-with-icon"><input defaultValue="PR-0482 / Government Press" /><Check size={15} /></div></label><div className="form-row"><label>Batch code<input defaultValue="NB24-MATH-B" /></label><label>Center code<input defaultValue="NDC-0041" /></label></div><label>Source document<div className="upload-small"><Upload size={17} /><span>Drop source file or <b>browse</b><small>PDF, DOCX up to 20 MB</small></span></div></label><button className="primary-button full">Generate PDF <ArrowUpRight size={15} /></button></GlassCard><DocumentPreview /></div></motion.div>
}

function DocumentPreview({ form }: { form?: { examination: string; press_id: string; batch_code: string; center_code: string } }) { const examination = form?.examination || 'National Board Examination · 2024'; const pressId = form?.press_id || 'PR-0482 / Government Press'; const batchCode = form?.batch_code || 'NB24-MATH-B'; const centerCode = form?.center_code || 'NDC-0041'; return <GlassCard className="document-preview"><div className="preview-toolbar"><div><span className="preview-dot" />Live preview</div><span>{batchCode} · v1.0</span></div><div className="paper-sheet"><div className="paper-header"><div><small>{centerCode}</small><strong>{examination}</strong><span>{pressId}</span></div><div className="qr-mini" /></div><div className="paper-rule" /><div className="paper-meta"><span>Batch: {batchCode}</span><span>Center: {centerCode}</span></div><div className="paper-lines"><b>Traceable source document</b><span>Press ID: {pressId}</span><span>Embedded provenance markers will be applied to every page.</span></div><div className="watermark">TRACE-MARK<br /><small>AUTHENTICATED</small></div><div className="page-number">Live preview</div></div><div className="preview-caption"><div><span className="live-dot" />Marker overlay active</div><span>Preview updates in real time</span></div></GlassCard> }

const pipeline = ['Normalization', 'Dewarp', 'Decode', 'ECC Extraction']

type ScanResponse = {
  status: 'complete' | 'Review Required' | string
  total_patches_analyzed?: number
  bitstream?: number[]
  detected_shift?: string
  prediction_bit?: number
  confidence?: number
  metadata?: { press_id?: string; center_code?: string; examination?: string }
  pipeline?: Record<string, string>
  detail?: { error?: { message?: string } } | string
}

function Inspector() {
  const [scanning, setScanning] = useState(false)
  const [drag, setDrag] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const selectFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Select a PNG, JPEG, or WebP image.')
      return
    }
    setSelectedFile(file)
    setResult(null)
    setError('')
  }

  const startScan = async () => {
    if (!selectedFile || scanning) return

    setScanning(true)
    setResult(null)
    setError('')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/scan-document`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json() as ScanResponse
      if (!response.ok) {
        const detail = typeof payload.detail === 'string' ? payload.detail : payload.detail?.error?.message
        throw new Error(detail || 'The document scan failed.')
      }

      setResult(payload)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to reach the scan service.')
    } finally { setScanning(false) }
  }

  const reviewRequired = result?.status === 'Review Required' || result?.metadata?.press_id === 'Review Required'
  const pipelineStatus = (key: string) => result?.pipeline?.[key] === 'Complete'
  return <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}><PageHeading eyebrow="Forensic analysis" title="Leak inspector" description="Decode embedded markers and verify the provenance of an intercepted document." action={<div className="scan-status"><span className="live-dot" />{scanning ? 'Processing scan' : 'Scanner ready'}</div>} /><div className="inspector-layout"><div><motion.div className={`dropzone ${drag ? 'dragging' : ''}`} onClick={() => fileInput.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); selectFile(e.dataTransfer.files[0] ?? null) }} whileHover={{ scale: 1.005 }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click() }}><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => selectFile(e.target.files?.[0] ?? null)} /><div className="drop-icon"><Upload size={21} /></div><h3>{selectedFile ? selectedFile.name : 'Drop a document to inspect'}</h3><p>{scanning ? 'Waiting for the GPU to finish...' : 'Select an image, then run the forensic scan'}</p><span className="file-types">PNG · JPG · WEBP</span>{scanning && <motion.div className="laser-line" animate={{ top: ['18%', '82%', '18%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />}</motion.div><div className="pipeline-card"><div className="pipeline-heading"><div><h2>Analysis pipeline</h2><p>Four-stage forensic extraction sequence</p></div><span className="pipeline-counter">{result ? (reviewRequired ? 'Review required' : 'Complete') : scanning ? 'Scanning 600+ patches...' : 'Awaiting scan'}</span></div><div className="pipeline">{pipeline.map((name, index) => { const key = ['normalization', 'dewarp', 'decode', 'ecc_extraction'][index]; const complete = pipelineStatus(key); return <motion.div className={`pipeline-step ${complete ? 'complete' : scanning && index === 2 ? 'active' : ''}`} key={name}><div className="step-marker">{complete ? <Check size={14} /> : <span>{String(index + 1).padStart(2, '0')}</span>}</div><div><strong>{name}</strong><small>{complete ? 'Complete' : scanning ? 'Processing...' : 'Pending'}</small></div></motion.div> })}</div><button className="primary-button full" onClick={startScan} disabled={scanning || !selectedFile}>{scanning ? <><Activity size={15} className="spin" /> Scanning 600+ patches...</> : <><Zap size={15} /> Run forensic scan</>}</button>{error && <p role="alert">{error}</p>}{result && <div className="scan-metadata-grid"><div><small>Press ID</small><strong>{result.metadata?.press_id || 'Review Required'}</strong></div><div><small>Center Code</small><strong>{result.metadata?.center_code || 'Review Required'}</strong></div><div><small>Examination</small><strong>{result.metadata?.examination || 'Review Required'}</strong></div></div>}</div></div><ResultsPanel result={result} /></div></motion.div>
}

function ResultsPanel({ result }: { result: ScanResponse | null }) { const reviewRequired = result?.status === 'Review Required' || result?.metadata?.press_id === 'Review Required'; return <AnimatePresence>{result ? <motion.div className={`results-panel ${reviewRequired ? 'warning' : ''}`} initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .38 }}><div className="results-glow" /><div className="results-header"><div><div className="eyebrow"><span className="eyebrow-line" />Scan result</div><h2>{reviewRequired ? 'No valid Trace-Mark payload detected.' : result.detected_shift || 'Shift detected'}</h2><p>{reviewRequired ? 'Manual review required.' : `${result.total_patches_analyzed ?? 0} patches analyzed`}</p></div><motion.div className="verified-stamp"><Check size={20} /><span>{reviewRequired ? 'REVIEW' : 'DETECTED'}</span></motion.div></div>{!reviewRequired && <div className="result-grid"><div><small>Confidence</small><strong>{Math.round((result.confidence ?? 0) * 100)}%</strong></div><div><small>Detected shift</small><strong>{result.detected_shift}</strong></div></div>}</motion.div> : null}</AnimatePresence> }

function Audit() { const [query, setQuery] = useState(''); const rows = useMemo(() => auditRows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())), [query]); return <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}><PageHeading eyebrow="Chain of custody" title="Audit trail" description="A tamper-evident record of every document scan and forensic action." action={<button className="outline-button"><Archive size={15} /> Export log</button>} /><GlassCard className="table-card audit-card"><div className="audit-toolbar"><div className="search-box"><Search size={16} /><input placeholder="Search scans, files, analysts..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filters <span>2</span></button></div><div className="table-wrap"><table><thead><tr><th>Scan ID</th><th>Source file</th><th>Analyst</th><th>Result</th><th>Confidence</th><th>Timestamp</th><th /></tr></thead><tbody>{rows.map((row, i) => <motion.tr key={row.scan} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .04 }}><td><span className="mono-id">{row.scan}</span></td><td><div className="file-cell"><FileText size={15} />{row.file}</div></td><td>{row.analyst}</td><td><StatusBadge>{row.result}</StatusBadge></td><td><strong>{row.confidence}</strong></td><td className="muted">{row.date}</td><td><button className="row-more"><ArrowUpRight size={15} /></button></td></motion.tr>)}</tbody></table></div><div className="table-footer">Showing {rows.length} of 2,842 records <span>Page 1 of 285 <ChevronRight size={14} /></span></div></GlassCard></motion.div> }

function ReportModal({ onClose }: { onClose: () => void }) { const lines = ['TRACE-MARK FORENSIC REPORT', '─────────────────────────', 'REPORT ID   FR-2024-0618-0842', 'GENERATED   18 Jun 2024 · 09:47:02', '', 'SUBJECT', 'Document provenance verification', '', 'FINDING', 'The submitted document contains a valid', 'Trace-Mark watermark associated with:', '', '  Press batch    PR-0482', '  Examination    Mathematics · Set B', '  Distribution   North District Center', '', 'CONFIDENCE     98.7%', 'CLASSIFICATION  VERIFIED LEAK', '', 'This report is cryptographically signed and', 'recorded in the immutable audit trail.']; return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.div className="report-modal" initial={{ opacity: 0, scale: .92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, y: 8 }} transition={spring} onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow"><span className="eyebrow-line" />Secure document</div><h2>Forensic report</h2></div><button className="close-button" onClick={onClose}><X size={18} /></button></div><div className="report-readout">{lines.map((line, i) => <motion.div key={`${line}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .035 }}>{line || ' '}</motion.div>)}</div><div className="modal-foot"><span><LockKeyhole size={13} /> Cryptographically signed</span><button className="primary-button">Download PDF <ArrowUpRight size={14} /></button></div></motion.div></motion.div> }

function AuthScreen({ mode, onModeChange, onSuccess }: { mode: 'login' | 'register'; onModeChange: (mode: 'login' | 'register') => void; onSuccess: () => void }) {
  const isLogin = mode === 'login'
  const [email, setEmail] = useState('')
  const [resetRequested, setResetRequested] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  return <main className="auth-shell"><section className="auth-panel"><div className="auth-brand"><div className="brand-mark"><Fingerprint size={21} strokeWidth={2.4} /></div><div><div className="brand-name">Trace<span>-</span>Mark</div><div className="brand-sub">FORENSICS PLATFORM</div></div></div><div className="auth-copy"><div className="eyebrow"><span className="eyebrow-line" />Secure workspace</div><h1>{isLogin ? 'Welcome back' : 'Create your workspace'}</h1><p>{isLogin ? 'Sign in to continue monitoring document provenance and forensic activity.' : 'Register your secure account to start protecting examination documents.'}</p></div>{resetRequested && isLogin && <div className="otp-card"><div className="otp-icon"><LockKeyhole size={16} /></div><div><strong>{otpVerified ? 'Code verified' : 'Check your email'}</strong><p>{otpVerified ? 'You can now continue with password recovery.' : `We sent a one-time code to ${email || 'your account email'}.`}</p></div>{!otpVerified && <div className="otp-entry"><label htmlFor="reset-otp">One-time passcode</label><input id="reset-otp" inputMode="numeric" maxLength={6} placeholder="Enter 6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\\D/g, ''))} /><button type="button" className="primary-button" disabled={otp.length !== 6} onClick={() => setOtpVerified(true)}>Verify code</button></div>}<button type="button" className="otp-cancel" onClick={() => { setResetRequested(false); setOtp(''); setOtpVerified(false) }}>Back to sign in</button></div>}<form className="auth-form" onSubmit={(event) => { event.preventDefault(); onSuccess() }}><label>Work email<input type="email" placeholder="you@organization.gov" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" placeholder="Enter your password" required /></label>{!isLogin && <label>Confirm password<input type="password" placeholder="Re-enter your password" required /></label>}<div className="auth-options">{isLogin ? <label className="remember"><input type="checkbox" /> Remember me</label> : <span className="auth-note">By registering, you agree to the secure workspace terms.</span>}{isLogin && <button type="button" className="forgot" onClick={() => setResetRequested(true)}>Forgot password?</button>}</div><button className="primary-button auth-submit" type="submit">{isLogin ? 'Sign in to Trace-Mark' : 'Create secure account'}<ArrowUpRight size={15} /></button></form><p className="auth-switch">{isLogin ? 'New to Trace-Mark?' : 'Already have an account?'} <button type="button" onClick={() => onModeChange(isLogin ? 'register' : 'login')}>{isLogin ? 'Create an account' : 'Sign in'}</button></p><div className="auth-footer"><LockKeyhole size={13} /> End-to-end encrypted workspace</div></section><aside className="auth-visual"><div className="auth-visual-inner"><div className="visual-kicker">DOCUMENT FORENSICS · 02</div><h2>Trust every<br /><em>document.</em></h2><p>Trace provenance. Detect leaks. Preserve confidence.</p><div className="visual-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Fingerprint size={36} /></div></div><div className="visual-stat"><strong>98.7%</strong><span>average verification confidence</span></div></div></aside></main>
}

function LegacyPage() { const [active, setActive] = useState<PageId>('overview'); const [report, setReport] = useState(false); const [authMode, setAuthMode] = useState<'login' | 'register'>('login'); const [authenticated, setAuthenticated] = useState(false); if (!authenticated) return <AuthScreen mode={authMode} onModeChange={setAuthMode} onSuccess={() => setAuthenticated(true)} />; return <div className="app-shell"><Sidebar active={active} onNavigate={setActive} /><div className="content-shell"><TopBar active={active} onReport={() => setReport(true)} onLogout={() => { setReport(false); setAuthenticated(false); setAuthMode('login') }} /><main className="main-content"><AnimatePresence mode="wait">{active === 'overview' && <Overview key="overview" onReport={() => setReport(true)} />}{active === 'generator' && <Generator key="generator" />}{active === 'inspector' && <Inspector key="inspector" />}{active === 'audit' && <Audit key="audit" />}</AnimatePresence></main></div><AnimatePresence>{report && <ReportModal onClose={() => setReport(false)} />}</AnimatePresence></div> }

type SessionUser = { id: number; full_name?: string; name: string; email: string; organization_name?: string; role?: string }
type Session = { user: SessionUser; access_token: string }
type OverviewStats = { scans_this_month: number; leaks_verified: number; documents_secured: number; avg_confidence: number }
type OverviewAlert = { alert_id: string; detection: string; center: string; status: string; timestamp: string }
type AuditRecord = { scan_id: string; source_file: string; analyst: string; result: string; confidence: number; timestamp: string }

function DynamicAuth({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [otpStep, setOtpStep] = useState(false)
  const [form, setForm] = useState({ full_name: '', organization_name: '', press_id: '', center_code: '', email: '', password: '', confirm_password: '', otp: '' })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      if (mode === 'register') {
        if (form.password !== form.confirm_password) throw new Error('Passwords do not match.')
        const session = await apiRequest<Session>('/api/auth/register', { method: 'POST', body: JSON.stringify({ full_name: form.full_name, organization_name: form.organization_name, press_id: form.press_id, center_code: form.center_code, email: form.email, password: form.password }) })
        onAuthenticated(session)
      } else if (!otpStep) {
        const result = await apiRequest<{ development_otp?: string }>('/api/auth/login-step1', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) })
        setOtpStep(true)
        setMessage(result.development_otp ? `Development OTP: ${result.development_otp}` : 'Enter the 6-digit code sent to your email.')
      } else {
        const session = await apiRequest<Session>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: form.email, otp: form.otp }) })
        onAuthenticated(session)
      }
    } catch (authError) { setMessage(authError instanceof Error ? authError.message : 'Authentication failed.') } finally { setBusy(false) }
  }

  const fields = mode === 'register' ? [['full_name', 'Full Name'], ['organization_name', 'Organization Name'], ['press_id', 'Press ID'], ['center_code', 'Center Code']] as const : []
  return <main className="auth-shell"><section className="auth-panel"><div className="auth-brand"><div className="brand-mark"><Fingerprint size={21} strokeWidth={2.4} /></div><div><div className="brand-name">Trace<span>-</span>Mark</div><div className="brand-sub">FORENSICS PLATFORM</div></div></div><div className="auth-copy"><div className="eyebrow"><span className="eyebrow-line" />Secure workspace</div><h1>{otpStep ? 'Verify your identity' : mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1><p>{otpStep ? 'Enter the 6-digit code sent to your email.' : 'Connect to your document provenance workspace.'}</p></div><form className="auth-form" onSubmit={submit} autoComplete={mode === 'login' ? 'on' : 'off'}>{otpStep ? <label>6-digit OTP<input className="auth-input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={form.otp} onChange={update('otp')} required /></label> : <>{fields.map(([key, label]) => <label key={key}>{label}<input className="auth-input" autoComplete="name" value={form[key]} onChange={update(key)} required /></label>)}<label>Work Email<input className="auth-input" type="email" autoComplete="email" value={form.email} onChange={update('email')} required /></label><label>Password<input className="auth-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={update('password')} required /></label>{mode === 'register' && <label>Confirm Password<input className="auth-input" type="password" autoComplete="new-password" value={form.confirm_password} onChange={update('confirm_password')} required /></label>}</>}{message && <p role="alert">{message}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait...' : otpStep ? 'Verify code' : mode === 'login' ? 'Continue to verification' : 'Create secure account'}<ArrowUpRight size={15} /></button></form><p className="auth-switch">{mode === 'login' ? 'New to Trace-Mark?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setOtpStep(false); setMessage('') }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p></section><aside className="auth-visual"><div className="auth-visual-inner"><div className="visual-kicker">DOCUMENT FORENSICS · 02</div><h2>Trust every<br /><em>document.</em></h2><p>Trace provenance. Detect leaks. Preserve confidence.</p></div></aside></main>
}

function DynamicOverview({ token, user }: { token: string; user: SessionUser }) {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [alerts, setAlerts] = useState<OverviewAlert[]>([])
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([apiRequest<OverviewStats>('/api/overview/stats', {}, token), apiRequest<OverviewAlert[]>('/api/overview/alerts', {}, token)]).then(([nextStats, nextAlerts]) => { setStats(nextStats); setAlerts(nextAlerts) }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load overview.')) }, [token])
  const values = stats ? [{ label: 'Scans this month', value: stats.scans_this_month, tone: 'blue' }, { label: 'Leaks verified', value: stats.leaks_verified, tone: 'red' }, { label: 'Documents secured', value: stats.documents_secured, tone: 'green' }, { label: 'Avg. confidence', value: Math.round(stats.avg_confidence * 100), suffix: '%', tone: 'purple' }] : []
  return <motion.div className="page"><PageHeading eyebrow="Command overview" title={`Hello, ${user.full_name || user.name}`} description="Monitor document provenance and investigate suspected leaks across the network." />{error && <p role="alert">{error}</p>}<motion.div className="metrics-grid">{values.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} suffix={metric.suffix} note="Live from Trace-Mark" icon={BarChart3} tone={metric.tone} />)}</motion.div><GlassCard className="table-card"><div className="card-heading"><div><h2>Recent alerts</h2><p>Live detections from the last 24 hours</p></div></div><div className="table-wrap"><table><thead><tr><th>Alert ID</th><th>Detection</th><th>Center</th><th>Status</th><th>Detected</th></tr></thead><tbody>{alerts.map((row) => <tr key={row.alert_id}><td><span className="mono-id">{row.alert_id}</span></td><td>{row.detection}</td><td>{row.center}</td><td><StatusBadge>{row.status}</StatusBadge></td><td className="muted">{new Date(row.timestamp).toLocaleString()}</td></tr>)}</tbody></table></div></GlassCard></motion.div>
}

function DynamicGenerator({ token }: { token: string }) {
  const [form, setForm] = useState({ examination: '', press_id: '', batch_code: '', center_code: '' })
  const [file, setFile] = useState<File | null>(null)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!file) return setError('Choose a PDF source document.'); setBusy(true); setError(''); const body = new FormData(); Object.entries(form).forEach(([key, value]) => body.append(key, value)); body.append('file', file); try { const result = await apiRequest<{ download_url: string }>('/api/generate-paper', { method: 'POST', body }, token); setDownloadUrl(`${API_BASE}${result.download_url}`) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Generation failed.') } finally { setBusy(false) } }
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }))
  return <motion.div className="page"><PageHeading eyebrow="Secure issuance" title="Paper generator" description="Create traceable examination papers with embedded forensic markers." /> <div className="generator-layout"><GlassCard className="form-card"><form onSubmit={submit}><div className="card-heading"><div><h2>Paper details</h2><p>Every field is encrypted and logged.</p></div></div>{(['examination', 'press_id', 'batch_code', 'center_code'] as const).map((key) => <label key={key}>{key.replace('_', ' ')}<input className="generator-input" value={form[key]} onChange={update(key)} required /></label>)}<label>Source document<input className="generator-input" type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>{error && <p role="alert">{error}</p>}<button className="primary-button full" disabled={busy}>{busy ? 'Generating...' : 'Generate PDF'}<ArrowUpRight size={15} /></button>{downloadUrl && <a className="outline-button full" href={downloadUrl} target="_blank" rel="noreferrer">Download generated PDF</a>}</form></GlassCard><DocumentPreview form={form} /></div></motion.div>
}

function DynamicAudit({ token }: { token: string }) {
  const [records, setRecords] = useState<AuditRecord[]>([]); const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [error, setError] = useState('')
  useEffect(() => { const params = new URLSearchParams({ page: String(page), limit: '20', search: query }); apiRequest<{ total: number; records: AuditRecord[] }>(`/api/audit-trail?${params}`, {}, token).then((result) => { setTotal(result.total); setRecords(result.records) }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load audit trail.')) }, [page, query, token])
  return <motion.div className="page"><PageHeading eyebrow="Chain of custody" title="Audit trail" description="A tamper-evident record of every document scan and forensic action." action={<a className="outline-button" href={`${API_BASE}/api/audit-trail/export`} target="_blank" rel="noreferrer"><Archive size={15} /> Export log</a>} />{error && <p role="alert">{error}</p>}<GlassCard className="table-card audit-card"><div className="audit-toolbar"><div className="search-box"><Search size={16} /><input placeholder="Search scans or files..." value={query} onChange={(event) => { setPage(1); setQuery(event.target.value) }} /></div></div><div className="table-wrap"><table><thead><tr><th>Scan ID</th><th>Source file</th><th>Analyst</th><th>Result</th><th>Confidence</th><th>Timestamp</th></tr></thead><tbody>{records.map((row) => <tr key={row.scan_id}><td><span className="mono-id">{row.scan_id}</span></td><td>{row.source_file}</td><td>{row.analyst}</td><td><StatusBadge>{row.result}</StatusBadge></td><td>{Math.round(row.confidence * 100)}%</td><td className="muted">{new Date(row.timestamp).toLocaleString()}</td></tr>)}</tbody></table></div><div className="table-footer">Showing {records.length} of {total} records <span><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button> <button disabled={records.length === 0 || page * 20 >= total} onClick={() => setPage(page + 1)}>Next</button></span></div></GlassCard></motion.div>
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null)
  const [active, setActive] = useState<PageId>('overview')
  useEffect(() => {
    const saved = localStorage.getItem('trace_mark_session')
    if (saved) {
      try { setSession(JSON.parse(saved) as Session) } catch { localStorage.removeItem('trace_mark_session') }
    }
  }, [])
  if (!session) return <DynamicAuth onAuthenticated={(nextSession) => { localStorage.setItem('trace_mark_session', JSON.stringify(nextSession)); localStorage.setItem('trace_mark_token', nextSession.access_token); setSession(nextSession) }} />
  return <div className="app-shell"><Sidebar active={active} onNavigate={setActive} /><div className="content-shell"><TopBar active={active} onReport={() => undefined} onLogout={() => { localStorage.removeItem('trace_mark_session'); localStorage.removeItem('trace_mark_token'); setSession(null) }} /><main className="main-content"><AnimatePresence mode="wait">{active === 'overview' && <DynamicOverview key="overview" token={session.access_token} user={session.user} />}{active === 'generator' && <DynamicGenerator key="generator" token={session.access_token} />}{active === 'inspector' && <Inspector key="inspector" />}{active === 'audit' && <DynamicAudit key="audit" token={session.access_token} />}</AnimatePresence></main></div></div>
}
