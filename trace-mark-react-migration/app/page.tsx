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
  return <header className="topbar"><div className="mobile-menu"><Menu size={19} /></div><div className="breadcrumb"><span>Trace-Mark</span><ChevronRight size={14} /><strong>{label}</strong></div><div className="top-actions"><div className="security-chip"><span className="live-dot" />Secure session</div><button className="icon-button" aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button><button className="avatar">RS</button><button className="logout-button" onClick={onLogout}><LogOut size={15} /> <span>Log out</span></button><button className="report-button" onClick={onReport}><FileText size={15} /> Forensic report <ArrowUpRight size={14} /></button></div></header>
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

function DocumentPreview() { return <GlassCard className="document-preview"><div className="preview-toolbar"><div><span className="preview-dot" />Live preview</div><span>NB24-MATH-B · v1.0</span></div><div className="paper-sheet"><div className="paper-header"><div><small>GOVERNMENT OF INDIA</small><strong>NATIONAL BOARD EXAMINATION</strong><span>MATHEMATICS · SET B</span></div><div className="qr-mini" /></div><div className="paper-rule" /><div className="paper-meta"><span>Time: 3 Hours</span><span>Maximum Marks: 100</span></div><div className="paper-lines"><b>General Instructions:</b><span>1. All questions are compulsory.</span><span>2. Read each question carefully before answering.</span><span>3. Use of calculators is not permitted.</span></div><div className="watermark">TRACE-MARK<br /><small>AUTHENTICATED</small></div><div className="page-number">Page 01 of 12</div></div><div className="preview-caption"><div><span className="live-dot" />Marker overlay active</div><span>Preview updates in real time</span></div></GlassCard> }

const pipeline = ['Normalization', 'Dewarp', 'Decode', 'ECC Extraction']
function Inspector() {
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState(-1)
  const [done, setDone] = useState(false)
  const [drag, setDrag] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>[]>([])
  const startScan = () => { timer.current.forEach(clearTimeout); setScanning(true); setDone(false); setStep(0); pipeline.forEach((_, i) => timer.current.push(setTimeout(() => setStep(i), i * 620))); timer.current.push(setTimeout(() => { setDone(true); setScanning(false); setStep(3) }, 2750)) }
  useEffect(() => () => timer.current.forEach(clearTimeout), [])
  return <motion.div className="page" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: .25 }}><PageHeading eyebrow="Forensic analysis" title="Leak inspector" description="Decode embedded markers and verify the provenance of an intercepted document." action={<div className="scan-status"><span className="live-dot" />Scanner ready</div>} /><div className="inspector-layout"><div><motion.div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); startScan() }} whileHover={{ scale: 1.005 }}><div className="drop-icon"><Upload size={21} /></div><h3>{scanning ? 'Analyzing document...' : 'Drop a document to inspect'}</h3><p>or click to browse from your secure workspace</p><span className="file-types">PNG · JPG · TIFF · PDF</span>{scanning && <motion.div className="laser-line" animate={{ top: ['18%', '82%', '18%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />}</motion.div><div className="pipeline-card"><div className="pipeline-heading"><div><h2>Analysis pipeline</h2><p>Four-stage forensic extraction sequence</p></div><span className="pipeline-counter">{done ? 'Complete' : scanning ? `Stage ${step + 1} of 4` : 'Awaiting scan'}</span></div><div className="pipeline"><div className="pipeline-line"><motion.div animate={{ height: `${done ? 100 : Math.max(0, step) / 3 * 100}%` }} transition={{ duration: .45 }} /></div>{pipeline.map((name, i) => <motion.div className={`pipeline-step ${step > i || done ? 'complete' : step === i && scanning ? 'active' : ''}`} key={name}><div className="step-marker">{step > i || done ? <motion.div initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}><Check size={14} /></motion.div> : <span>{String(i + 1).padStart(2, '0')}</span>}</div><div><strong>{name}</strong><small>{step > i || done ? 'Complete' : step === i && scanning ? 'Processing…' : 'Pending'}</small></div>{step === i && scanning && <motion.span className="step-pulse" animate={{ scale: [1, 1.25, 1], opacity: [.5, 1, .5] }} transition={{ duration: 1, repeat: Infinity }} />}</motion.div>)}</div><button className="primary-button full" onClick={startScan} disabled={scanning}>{scanning ? <><Activity size={15} className="spin" /> Scanning document...</> : <><Zap size={15} /> Run forensic scan</>}</button></div></div><ResultsPanel visible={done} /></div></motion.div>
}

function ResultsPanel({ visible }: { visible: boolean }) { return <AnimatePresence>{visible ? <motion.div className="results-panel" initial={{ opacity: 0, scale: .96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: .38 }}><div className="results-glow" /><div className="results-header"><div><div className="eyebrow"><span className="eyebrow-line" />Scan result</div><h2>Document verified as leaked</h2></div><motion.div className="verified-stamp" initial={{ scale: .4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={spring}><Check size={20} /><span>VERIFIED</span></motion.div></div><div className="confidence"><div className="confidence-label"><span>Confidence score</span><strong><CountUp value={98} suffix=".7%" /></strong></div><div className="confidence-track"><motion.div initial={{ width: 0 }} animate={{ width: '98.7%' }} transition={{ delay: .25, duration: .8 }} /></div></div><div className="result-grid"><div><small>Decoded marker</small><strong className="mono-id">TM-NB24-0482-B</strong></div><div><small>Source center</small><strong>North District Center</strong></div><div><small>Press batch</small><strong>PR-0482 · Set B</strong></div><div><small>Scan timestamp</small><strong>18 Jun 2024 · 09:42:18</strong></div></div><button className="outline-button full">Open forensic report <ArrowUpRight size={14} /></button></motion.div> : null}</AnimatePresence> }

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

export default function Page() { const [active, setActive] = useState<PageId>('overview'); const [report, setReport] = useState(false); const [authMode, setAuthMode] = useState<'login' | 'register'>('login'); const [authenticated, setAuthenticated] = useState(false); if (!authenticated) return <AuthScreen mode={authMode} onModeChange={setAuthMode} onSuccess={() => setAuthenticated(true)} />; return <div className="app-shell"><Sidebar active={active} onNavigate={setActive} /><div className="content-shell"><TopBar active={active} onReport={() => setReport(true)} onLogout={() => { setReport(false); setAuthenticated(false); setAuthMode('login') }} /><main className="main-content"><AnimatePresence mode="wait">{active === 'overview' && <Overview key="overview" onReport={() => setReport(true)} />}{active === 'generator' && <Generator key="generator" />}{active === 'inspector' && <Inspector key="inspector" />}{active === 'audit' && <Audit key="audit" />}</AnimatePresence></main></div><AnimatePresence>{report && <ReportModal onClose={() => setReport(false)} />}</AnimatePresence></div> }
