import { useState, useEffect } from 'react'
import { callAIAgent } from '@/utils/aiAgent'
import type { NormalizedAgentResponse } from '@/utils/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  User,
  ChevronRight,
  Send,
  Loader2,
  Download,
  XCircle,
  CreditCard,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Agent IDs
const AGENT_IDS = {
  DISPUTE_INTAKE: '696017115dbd567753c07c2e',
  DISPUTE_ANALYSIS_MANAGER: '6960171f5e0239738a836819',
  TRANSACTION_DATA: '696017125e0239738a836817',
  SOP_COMPLIANCE: '69601712566bcffb7aebac5f',
  DECISION_PRESENTER: '696017125e0239738a836818',
}

// Types
interface DisputeCase {
  id: string
  caseNumber: string
  status: 'pending' | 'analyzing' | 'approved' | 'denied' | 'manual_review'
  date: string
  amount: number
  merchant: string
  description: string
}

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
  timestamp: string
}

interface CaseDetails {
  caseNumber?: string
  merchant?: string
  amount?: number
  date?: string
  reason?: string
  cardLast4?: string
}

interface AnalysisResult {
  transactions?: any[]
  compliance?: any
  preliminaryDecision?: string
  confidence?: string
  rawResponse?: string
}

type Screen = 'dashboard' | 'chat' | 'analysis' | 'decision'

// Mock data for dashboard
const mockCases: DisputeCase[] = [
  {
    id: '1',
    caseNumber: 'DSP-2026-001',
    status: 'approved',
    date: '2026-01-05',
    amount: 299.99,
    merchant: 'Amazon',
    description: 'Unauthorized purchase of electronics',
  },
  {
    id: '2',
    caseNumber: 'DSP-2026-002',
    status: 'manual_review',
    date: '2026-01-06',
    amount: 1250.00,
    merchant: 'Best Buy',
    description: 'Product not received',
  },
  {
    id: '3',
    caseNumber: 'DSP-2026-003',
    status: 'denied',
    date: '2026-01-07',
    amount: 49.99,
    merchant: 'Netflix',
    description: 'Duplicate charge',
  },
]

// Main App Component
export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const [activeSidebar, setActiveSidebar] = useState<string>('new-dispute')
  const [cases, setCases] = useState<DisputeCase[]>(mockCases)
  const [currentCase, setCurrentCase] = useState<DisputeCase | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [caseDetails, setCaseDetails] = useState<CaseDetails>({})
  const [canAnalyze, setCanAnalyze] = useState(false)

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Decision state
  const [decisionData, setDecisionData] = useState<NormalizedAgentResponse | null>(null)
  const [isLoadingDecision, setIsLoadingDecision] = useState(false)

  const startNewDispute = () => {
    setChatMessages([])
    setCaseDetails({})
    setCanAnalyze(false)
    setAnalysisResult(null)
    setDecisionData(null)
    setCurrentCase(null)
    setCurrentScreen('chat')
    setActiveSidebar('new-dispute')

    // Send initial greeting from agent
    setTimeout(() => {
      setChatMessages([{
        role: 'agent',
        content: "Hello! I'm here to help you with your credit card dispute. Please tell me about the transaction you'd like to dispute, including the merchant name, amount, date, and reason for the dispute.",
        timestamp: new Date().toISOString(),
      }])
    }, 300)
  }

  const sendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
    }

    setChatMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsTyping(true)

    try {
      const result = await callAIAgent(inputMessage, AGENT_IDS.DISPUTE_INTAKE)

      if (result.success && result.response) {
        // Extract text from agent response
        let responseText = 'I understand. Let me help you with that.'
        if (result.response.result?.response) {
          responseText = typeof result.response.result.response === 'string'
            ? result.response.result.response
            : result.response.result.response?.text || JSON.stringify(result.response.result.response)
        } else if (result.response.result) {
          responseText = typeof result.response.result === 'string'
            ? result.response.result
            : result.response.result?.text || JSON.stringify(result.response.result)
        }

        const agentMessage: ChatMessage = {
          role: 'agent',
          content: responseText,
          timestamp: new Date().toISOString(),
        }

        setChatMessages(prev => [...prev, agentMessage])

        // Extract case details if present in response data
        if (result.response.result?.data) {
          const data = result.response.result.data
          const newDetails: CaseDetails = {
            ...caseDetails,
            merchant: data.merchant || caseDetails.merchant,
            amount: data.amount || caseDetails.amount,
            date: data.date || caseDetails.date,
            reason: data.reason || caseDetails.reason,
            cardLast4: data.cardLast4 || caseDetails.cardLast4,
            caseNumber: data.caseNumber || caseDetails.caseNumber || `DSP-${new Date().getFullYear()}-${String(cases.length + 1).padStart(3, '0')}`,
          }
          setCaseDetails(newDetails)

          // Enable analyze button if we have sufficient details
          if (newDetails.merchant && newDetails.amount) {
            setCanAnalyze(true)
          }
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'agent',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const analyzeDispute = async () => {
    setIsAnalyzing(true)

    try {
      const analysisRequest = `Analyze dispute case:
Case Number: ${caseDetails.caseNumber}
Merchant: ${caseDetails.merchant}
Amount: $${caseDetails.amount}
Date: ${caseDetails.date}
Reason: ${caseDetails.reason}
Please coordinate transaction data review and compliance assessment.`

      const result = await callAIAgent(analysisRequest, AGENT_IDS.DISPUTE_ANALYSIS_MANAGER)

      if (result.success && result.response) {
        // Extract text from analysis response
        let analysisText = 'Analysis complete'
        if (result.response.result?.response) {
          analysisText = typeof result.response.result.response === 'string'
            ? result.response.result.response
            : result.response.result.response?.text || JSON.stringify(result.response.result.response)
        } else if (result.response.result) {
          analysisText = typeof result.response.result === 'string'
            ? result.response.result
            : result.response.result?.text || JSON.stringify(result.response.result)
        }

        setAnalysisResult({
          rawResponse: analysisText,
          preliminaryDecision: extractDecision(analysisText),
          confidence: extractConfidence(analysisText),
          transactions: generateMockTransactions(),
          compliance: generateMockCompliance(),
        })
        setCurrentScreen('analysis')
      }
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getDecision = async () => {
    setIsLoadingDecision(true)

    try {
      const decisionRequest = `Present final decision for dispute case:
Case Number: ${caseDetails.caseNumber}
Merchant: ${caseDetails.merchant}
Amount: $${caseDetails.amount}
Analysis: ${analysisResult?.rawResponse}
Preliminary Decision: ${analysisResult?.preliminaryDecision}
Please provide a customer-friendly decision explanation.`

      const result = await callAIAgent(decisionRequest, AGENT_IDS.DECISION_PRESENTER)

      if (result.success && result.response) {
        setDecisionData(result.response)
        setCurrentScreen('decision')
      }
    } catch (error) {
      console.error('Decision error:', error)
    } finally {
      setIsLoadingDecision(false)
    }
  }

  const extractDecision = (text: string): string => {
    const lowerText = text.toLowerCase()
    if (lowerText.includes('approved') || lowerText.includes('approve')) return 'approved'
    if (lowerText.includes('denied') || lowerText.includes('deny')) return 'denied'
    if (lowerText.includes('manual review') || lowerText.includes('manual_review')) return 'manual_review'
    return 'pending'
  }

  const extractConfidence = (text: string): string => {
    const lowerText = text.toLowerCase()
    if (lowerText.includes('high confidence')) return 'High'
    if (lowerText.includes('medium confidence')) return 'Medium'
    if (lowerText.includes('low confidence')) return 'Low'
    return 'Medium'
  }

  const generateMockTransactions = () => [
    {
      id: 'TXN-001',
      date: caseDetails.date || '2026-01-08',
      merchant: caseDetails.merchant || 'Unknown Merchant',
      amount: caseDetails.amount || 0,
      status: 'Posted',
      category: 'Retail',
    },
    {
      id: 'TXN-002',
      date: '2026-01-05',
      merchant: caseDetails.merchant || 'Unknown Merchant',
      amount: 149.99,
      status: 'Posted',
      category: 'Retail',
    },
    {
      id: 'TXN-003',
      date: '2025-12-28',
      merchant: caseDetails.merchant || 'Unknown Merchant',
      amount: 89.99,
      status: 'Posted',
      category: 'Retail',
    },
  ]

  const generateMockCompliance = () => ({
    filedWithinTimeframe: true,
    validDisputeReason: true,
    documentationComplete: true,
    accountGoodStanding: true,
    fraudIndicators: false,
    riskLevel: 'Low',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#1a365d] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[#0d9488]" />
            <h1 className="text-2xl font-bold">CreditGuard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">Dispute Management System</span>
            <div className="w-10 h-10 rounded-full bg-[#0d9488] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-[calc(100vh-72px)] p-4">
          <nav className="space-y-2">
            <button
              onClick={() => {
                setCurrentScreen('dashboard')
                setActiveSidebar('new-dispute')
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                activeSidebar === 'new-dispute' ? "bg-[#1a365d] text-white" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <MessageSquare className="w-5 h-5" />
              <span>New Dispute</span>
            </button>
            <button
              onClick={() => {
                setCurrentScreen('dashboard')
                setActiveSidebar('active-cases')
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                activeSidebar === 'active-cases' ? "bg-[#1a365d] text-white" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <Clock className="w-5 h-5" />
              <span>Active Cases</span>
            </button>
            <button
              onClick={() => {
                setCurrentScreen('dashboard')
                setActiveSidebar('history')
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                activeSidebar === 'history' ? "bg-[#1a365d] text-white" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <FileText className="w-5 h-5" />
              <span>History</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              cases={cases}
              onStartNewDispute={startNewDispute}
              activeSidebar={activeSidebar}
            />
          )}
          {currentScreen === 'chat' && (
            <ChatScreen
              messages={chatMessages}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              onSendMessage={sendMessage}
              isTyping={isTyping}
              caseDetails={caseDetails}
              canAnalyze={canAnalyze}
              onAnalyze={analyzeDispute}
              isAnalyzing={isAnalyzing}
            />
          )}
          {currentScreen === 'analysis' && (
            <AnalysisScreen
              caseDetails={caseDetails}
              analysisResult={analysisResult}
              onGetDecision={getDecision}
              isLoadingDecision={isLoadingDecision}
              onBack={() => setCurrentScreen('chat')}
            />
          )}
          {currentScreen === 'decision' && (
            <DecisionScreen
              decisionData={decisionData}
              caseDetails={caseDetails}
              onStartNew={startNewDispute}
              onBackToDashboard={() => setCurrentScreen('dashboard')}
            />
          )}
        </main>
      </div>
    </div>
  )
}

// Dashboard Screen Component
function DashboardScreen({
  cases,
  onStartNewDispute,
  activeSidebar,
}: {
  cases: DisputeCase[]
  onStartNewDispute: () => void
  activeSidebar: string
}) {
  const getStatusBadge = (status: string) => {
    const config = {
      approved: { label: 'Approved', className: 'bg-green-100 text-green-800 border-green-200' },
      denied: { label: 'Denied', className: 'bg-red-100 text-red-800 border-red-200' },
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      analyzing: { label: 'Analyzing', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      manual_review: { label: 'Manual Review', className: 'bg-orange-100 text-orange-800 border-orange-200' },
    }
    const { label, className } = config[status as keyof typeof config] || config.pending
    return <Badge className={cn("border", className)}>{label}</Badge>
  }

  const filterCases = () => {
    if (activeSidebar === 'active-cases') {
      return cases.filter(c => ['pending', 'analyzing', 'manual_review'].includes(c.status))
    }
    if (activeSidebar === 'history') {
      return cases.filter(c => ['approved', 'denied'].includes(c.status))
    }
    return cases
  }

  const filteredCases = filterCases()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {activeSidebar === 'new-dispute' && 'Dispute Dashboard'}
            {activeSidebar === 'active-cases' && 'Active Cases'}
            {activeSidebar === 'history' && 'Case History'}
          </h2>
          <p className="text-gray-600 mt-1">Manage and track credit card disputes</p>
        </div>
      </div>

      {/* Primary CTA */}
      <Card className="border-2 border-[#0d9488] bg-gradient-to-br from-[#1a365d] to-[#2d4a7c]">
        <CardContent className="p-8 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Start a New Dispute</h3>
            <p className="text-gray-300">File a dispute in minutes with our guided process</p>
          </div>
          <Button
            onClick={onStartNewDispute}
            size="lg"
            className="bg-[#0d9488] hover:bg-[#0f766e] text-white"
          >
            Start New Dispute
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases.map(disputeCase => (
          <Card key={disputeCase.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{disputeCase.caseNumber}</CardTitle>
                  <CardDescription className="mt-1">{disputeCase.merchant}</CardDescription>
                </div>
                {getStatusBadge(disputeCase.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">${disputeCase.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date:</span>
                  <span className="text-gray-900">{new Date(disputeCase.date).toLocaleDateString()}</span>
                </div>
                <Separator className="my-2" />
                <p className="text-sm text-gray-600 line-clamp-2">{disputeCase.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCases.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No cases found</h3>
          <p className="text-gray-600">
            {activeSidebar === 'active-cases' && 'You have no active disputes at the moment.'}
            {activeSidebar === 'history' && 'No completed cases in your history.'}
          </p>
        </Card>
      )}
    </div>
  )
}

// Chat Screen Component
function ChatScreen({
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  isTyping,
  caseDetails,
  canAnalyze,
  onAnalyze,
  isAnalyzing,
}: {
  messages: ChatMessage[]
  inputMessage: string
  setInputMessage: (value: string) => void
  onSendMessage: () => void
  isTyping: boolean
  caseDetails: CaseDetails
  canAnalyze: boolean
  onAnalyze: () => void
  isAnalyzing: boolean
}) {
  return (
    <div className="h-[calc(100vh-120px)] flex gap-4">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow">
        {/* Chat Header */}
        <div className="p-4 border-b bg-[#1a365d] text-white rounded-t-lg">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Dispute Intake Assistant
          </h3>
          <p className="text-sm text-gray-300 mt-1">Powered by AI - Collecting dispute information</p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === 'agent' && (
                  <div className="w-8 h-8 rounded-full bg-[#0d9488] flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg px-4 py-3",
                    msg.role === 'user'
                      ? "bg-[#1a365d] text-white"
                      : "bg-gray-100 text-gray-900"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-xs opacity-70 mt-2 block">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#1a365d] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-[#0d9488] flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSendMessage()
                }
              }}
              placeholder="Describe your dispute (merchant, amount, date, reason)..."
              className="resize-none"
              rows={3}
            />
            <Button
              onClick={onSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-[#0d9488] hover:bg-[#0f766e]"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Case Details Panel */}
      <Card className="w-80 h-fit">
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-lg">Case Details</CardTitle>
          <CardDescription>Information extracted from conversation</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <DetailRow label="Case Number" value={caseDetails.caseNumber} />
          <DetailRow label="Merchant" value={caseDetails.merchant} />
          <DetailRow label="Amount" value={caseDetails.amount ? `$${caseDetails.amount}` : undefined} />
          <DetailRow label="Date" value={caseDetails.date} />
          <DetailRow label="Card" value={caseDetails.cardLast4 ? `**** ${caseDetails.cardLast4}` : undefined} />
          <DetailRow label="Reason" value={caseDetails.reason} />

          {canAnalyze && (
            <>
              <Separator className="my-4" />
              <Button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-[#0d9488] hover:bg-[#0f766e]"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Analyze Dispute
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Analysis Screen Component
function AnalysisScreen({
  caseDetails,
  analysisResult,
  onGetDecision,
  isLoadingDecision,
  onBack,
}: {
  caseDetails: CaseDetails
  analysisResult: AnalysisResult | null
  onGetDecision: () => void
  isLoadingDecision: boolean
  onBack: () => void
}) {
  const getPreliminaryBadge = (decision?: string) => {
    if (!decision) return null

    const config = {
      approved: { icon: CheckCircle, label: 'Likely Approved', className: 'bg-green-100 text-green-800 border-green-200' },
      denied: { icon: XCircle, label: 'Likely Denied', className: 'bg-red-100 text-red-800 border-red-200' },
      manual_review: { icon: AlertTriangle, label: 'Manual Review Required', className: 'bg-orange-100 text-orange-800 border-orange-200' },
      pending: { icon: Clock, label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    }

    const { icon: Icon, label, className } = config[decision as keyof typeof config] || config.pending

    return (
      <Badge className={cn("border text-sm py-2 px-4", className)}>
        <Icon className="w-4 h-4 mr-2" />
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Analysis Results</h2>
            <p className="text-gray-600 mt-1">Case {caseDetails.caseNumber}</p>
          </div>
        </div>
        {getPreliminaryBadge(analysisResult?.preliminaryDecision)}
      </div>

      {/* Progress Stepper */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <StepItem label="Intake" status="completed" />
            <div className="flex-1 h-1 bg-[#0d9488] mx-2" />
            <StepItem label="Analysis" status="completed" />
            <div className="flex-1 h-1 bg-gray-300 mx-2" />
            <StepItem label="Decision" status="pending" />
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Transaction Data */}
        <Card>
          <CardHeader className="bg-[#1a365d] text-white">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Transaction History
            </CardTitle>
            <CardDescription className="text-gray-300">
              Recent transactions with {caseDetails.merchant}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisResult?.transactions?.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">{txn.date}</TableCell>
                    <TableCell className="text-sm font-mono">{txn.id}</TableCell>
                    <TableCell className="text-sm font-semibold">${txn.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{txn.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right: Compliance Assessment */}
        <Card>
          <CardHeader className="bg-[#0d9488] text-white">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Compliance Assessment
            </CardTitle>
            <CardDescription className="text-gray-100">
              SOP and policy evaluation
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <ComplianceItem
              label="Filed within timeframe"
              status={analysisResult?.compliance?.filedWithinTimeframe}
            />
            <ComplianceItem
              label="Valid dispute reason"
              status={analysisResult?.compliance?.validDisputeReason}
            />
            <ComplianceItem
              label="Documentation complete"
              status={analysisResult?.compliance?.documentationComplete}
            />
            <ComplianceItem
              label="Account in good standing"
              status={analysisResult?.compliance?.accountGoodStanding}
            />
            <Separator className="my-4" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Fraud Indicators:</span>
              <Badge variant={analysisResult?.compliance?.fraudIndicators ? "destructive" : "outline"}>
                {analysisResult?.compliance?.fraudIndicators ? 'Detected' : 'None'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Risk Level:</span>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                {analysisResult?.compliance?.riskLevel || 'Low'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Confidence:</span>
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {analysisResult?.confidence || 'Medium'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Summary */}
      {analysisResult?.rawResponse && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysisResult.rawResponse}</p>
          </CardContent>
        </Card>
      )}

      {/* Get Decision Button */}
      <Card className="border-2 border-[#0d9488]">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Ready for Final Decision</h3>
            <p className="text-gray-600 mt-1">Generate customer-facing decision presentation</p>
          </div>
          <Button
            onClick={onGetDecision}
            disabled={isLoadingDecision}
            size="lg"
            className="bg-[#0d9488] hover:bg-[#0f766e]"
          >
            {isLoadingDecision ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Get Decision
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// Decision Screen Component
function DecisionScreen({
  decisionData,
  caseDetails,
  onStartNew,
  onBackToDashboard,
}: {
  decisionData: NormalizedAgentResponse | null
  caseDetails: CaseDetails
  onStartNew: () => void
  onBackToDashboard: () => void
}) {
  // Extract text from decision response
  const getDecisionText = (): string => {
    if (!decisionData?.result) return 'Decision details are being processed.'

    const resultData = decisionData.result
    if (resultData.response) {
      if (typeof resultData.response === 'string') return resultData.response
      if (resultData.response?.text) return resultData.response.text
      return JSON.stringify(resultData.response)
    }

    if (typeof resultData === 'string') return resultData
    if (resultData?.text) return resultData.text
    return JSON.stringify(resultData)
  }

  const decisionText = getDecisionText()
  const decision = extractDecisionFromText(decisionText)

  const downloadSummary = () => {
    const content = `
DISPUTE DECISION SUMMARY
========================

Case Number: ${caseDetails.caseNumber}
Merchant: ${caseDetails.merchant}
Amount: $${caseDetails.amount}
Date: ${caseDetails.date}

DECISION: ${decision.toUpperCase()}

${decisionText}

Generated: ${new Date().toLocaleString()}
    `

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dispute-${caseDetails.caseNumber}-decision.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Progress Stepper */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <StepItem label="Intake" status="completed" />
            <div className="flex-1 h-1 bg-[#0d9488] mx-2" />
            <StepItem label="Analysis" status="completed" />
            <div className="flex-1 h-1 bg-[#0d9488] mx-2" />
            <StepItem label="Decision" status="completed" />
          </div>
        </CardContent>
      </Card>

      {/* Decision Hero Section */}
      <Card className={cn(
        "border-4",
        decision === 'approved' ? "border-green-500 bg-green-50" :
        decision === 'denied' ? "border-red-500 bg-red-50" :
        "border-orange-500 bg-orange-50"
      )}>
        <CardContent className="p-12 text-center">
          <div className="mb-6">
            {decision === 'approved' && <CheckCircle className="w-24 h-24 mx-auto text-green-600" />}
            {decision === 'denied' && <XCircle className="w-24 h-24 mx-auto text-red-600" />}
            {decision === 'manual_review' && <AlertTriangle className="w-24 h-24 mx-auto text-orange-600" />}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            {decision === 'approved' && 'Dispute Approved'}
            {decision === 'denied' && 'Dispute Denied'}
            {decision === 'manual_review' && 'Manual Review Required'}
          </h2>
          <p className="text-lg text-gray-600">Case {caseDetails.caseNumber}</p>
        </CardContent>
      </Card>

      {/* Reasoning Panel */}
      <Card>
        <CardHeader className="bg-[#1a365d] text-white">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Decision Explanation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="prose max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">
              {decisionText}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader className="bg-[#0d9488] text-white">
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <TimelineItem
              number="1"
              title={decision === 'approved' ? 'Credit Processing' : 'Review Notification'}
              description={
                decision === 'approved'
                  ? `A credit of $${caseDetails.amount} will be processed to your account`
                  : 'You will receive detailed notification of this decision'
              }
              time="Within 24 hours"
            />
            <TimelineItem
              number="2"
              title={decision === 'approved' ? 'Account Credit' : 'Additional Steps'}
              description={
                decision === 'approved'
                  ? 'The credit will appear in your account'
                  : 'Follow any additional instructions provided in the notification'
              }
              time={decision === 'approved' ? '3-5 business days' : 'As needed'}
            />
            <TimelineItem
              number="3"
              title="Confirmation"
              description="You will receive a confirmation email with all details"
              time="Within 48 hours"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          onClick={downloadSummary}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          <Download className="w-5 h-5 mr-2" />
          Download Summary
        </Button>
        <Button
          onClick={onStartNew}
          size="lg"
          className="flex-1 bg-[#0d9488] hover:bg-[#0f766e]"
        >
          Start New Dispute
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      <div className="text-center">
        <Button variant="link" onClick={onBackToDashboard}>
          Return to Dashboard
        </Button>
      </div>
    </div>
  )
}

// Helper Components
function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}:</span>
      <span className="text-sm font-medium text-gray-900">
        {value || <span className="text-gray-400">Not provided</span>}
      </span>
    </div>
  )
}

function StepItem({ label, status }: { label: string; status: 'completed' | 'pending' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          status === 'completed' ? "bg-[#0d9488] text-white" : "bg-gray-300 text-gray-600"
        )}
      >
        {status === 'completed' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  )
}

function ComplianceItem({ label, status }: { label: string; status?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {status ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
      )}
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  )
}

function TimelineItem({
  number,
  title,
  description,
  time,
}: {
  number: string
  title: string
  description: string
  time: string
}) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-[#0d9488] text-white flex items-center justify-center flex-shrink-0 font-bold">
        {number}
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {time}
        </p>
      </div>
    </div>
  )
}

function extractDecisionFromText(text: string): string {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('approved') || lowerText.includes('approve')) return 'approved'
  if (lowerText.includes('denied') || lowerText.includes('deny')) return 'denied'
  if (lowerText.includes('manual review') || lowerText.includes('manual_review')) return 'manual_review'
  return 'pending'
}
