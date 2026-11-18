import { useState } from 'react';
import {
  Network,
  Bot,
  ShieldAlert,
  Terminal,
  Play,
  CheckCircle2,
  Loader2,
  Webhook,
  Copy,
  Download,
  Cpu,
  Layers,
  AlertTriangle
} from 'lucide-react';
import {
  SAMPLE_LOGS,
  runMultiAgentPipeline,
  type AgentStepResult,
  type OrchestrationReport
} from './services/orchestratorEngine';

export function App() {
  const [selectedSampleId, setSelectedSampleId] = useState(SAMPLE_LOGS[0].id);
  const [rawLog, setRawLog] = useState(SAMPLE_LOGS[0].rawLog);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [agentStages, setAgentStages] = useState<Record<string, AgentStepResult>>({});
  const [report, setReport] = useState<OrchestrationReport | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleSelectSample = (id: string) => {
    setSelectedSampleId(id);
    const found = SAMPLE_LOGS.find(s => s.id === id);
    if (found) {
      setRawLog(found.rawLog);
      setReport(null);
      setAgentStages({});
    }
  };

  const handleRunOrchestration = async () => {
    if (!rawLog.trim() || isRunning) return;
    setIsRunning(true);
    setReport(null);
    setAgentStages({});

    const finalReport = await runMultiAgentPipeline(rawLog, webhookUrl, stage => {
      setAgentStages(prev => ({
        ...prev,
        [stage.agentId]: stage
      }));
    });

    setReport(finalReport);
    setIsRunning(false);
  };

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const md = [
      `# Relatório Técnico de Diagnóstico Multi-Agente — ${report.incidentId}`,
      `**Data/Hora:** ${report.timestamp} | **Severidade:** ${report.severity}`,
      `\n## 1. Resumo Executivo\n${report.executiveSummary}`,
      `\n## 2. Causa Raiz Identificada\n${report.rootCause}`,
      `\n## 3. Pipeline de Agentes Executados`,
      ...report.agents.map(
        a => `- **${a.agentName}** (${a.modelBadge} - ${a.durationMs}ms): ${a.summary}`
      ),
      `\n## 4. Comandos de Contenção & Remediação`,
      ...report.remediationCommands.map(
        r => `### ${r.platform}\n\`\`\`bash\n${r.command}\n\`\`\``
      )
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.incidentId}-diagnostico-redes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const orderedAgents: AgentStepResult[] = [
    agentStages['parser'] || {
      agentId: 'parser',
      agentName: 'Agente 01 · Log Parser & Normalizer',
      role: 'Extração Estruturada (Regex + Schema JSON)',
      modelBadge: 'Gemini 2.5 Flash · JSON Mode',
      durationMs: 0,
      status: 'idle',
      summary: 'Aguardando ingestão de logs brutos para normalização.',
      structuredOutput: {}
    },
    agentStages['network'] || {
      agentId: 'network',
      agentName: 'Agente 02 · NetOps & OSI Diagnostic',
      role: 'Análise de Roteamento, Topologia e Camadas OSI',
      modelBadge: 'Claude 3.7 Sonnet · NetEng',
      durationMs: 0,
      status: 'idle',
      summary: 'Aguardando payload normalizado do Agente 01.',
      structuredOutput: {}
    },
    agentStages['secops'] || {
      agentId: 'secops',
      agentName: 'Agente 03 · SecOps & Remediation Architect',
      role: 'Classificação MITRE ATT&CK & Playbook de Contenção',
      modelBadge: 'GPT-4o · Security Reasoning',
      durationMs: 0,
      status: 'idle',
      summary: 'Aguardando diagnóstico de rede para gerar plano de resposta.',
      structuredOutput: {}
    }
  ];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0d1320]/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-100 tracking-tight">
                  NetPulse AI <span className="text-cyan-400">Orchestrator</span>
                </h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Multi-Agent Pipeline v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Orquestração de Agentes para Diagnóstico de Redes, Syslog & Resposta SecOps
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Arquiteto: Rafael Trajano
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Input & Webhook Config Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Log Input Panel */}
          <div className="lg:col-span-2 bg-[#0f1624] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Ingestão de Logs Brutos (Syslog / Firewall / Linux / Router)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_LOGS.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample.id)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition ${
                      selectedSampleId === sample.id
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-medium'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sample.source.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={rawLog}
              onChange={e => setRawLog(e.target.value)}
              rows={7}
              placeholder="Cole aqui logs de firewall, roteador Cisco/MikroTik, auth.log ou saída de diagnóstico..."
              className="w-full bg-[#080b12] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-cyan-100/90 focus:outline-none focus:border-cyan-500/60 leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-400">
                {rawLog.split('\n').filter(Boolean).length} linhas prontas para triagem
              </span>
              <button
                onClick={handleRunOrchestration}
                disabled={isRunning || !rawLog.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition cursor-pointer shadow-lg shadow-cyan-500/10"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Orquestrando Agentes...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Executar Pipeline Multi-Agente
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Automation / Webhook Integration Card */}
          <div className="bg-[#0f1624] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Webhook className="w-4 h-4 text-violet-400" />
                Integração Externa (n8n / Make)
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Conecte um Webhook do <strong>n8n</strong> ou <strong>Make</strong> para disparar automaticamente o JSON estruturado dos 3 agentes para Slack, Jira ou SIEM.
              </p>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hook.us1.make.com/... (Opcional)"
                className="w-full bg-[#080b12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500/60"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/90 space-y-2">
              <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Topologia de Execução
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                1. <strong>Parser</strong> limpa e tipa eventos → 2. <strong>NetOps</strong> diagnostica camadas OSI/rotas → 3. <strong>SecOps</strong> gera contenção e laudo.
              </p>
            </div>
          </div>
        </section>

        {/* 3-Agent Orchestration Pipeline */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Bot className="w-4 h-4 text-cyan-400" />
            Cadeia de Raciocínio Multi-Agente
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {orderedAgents.map(agent => (
              <div
                key={agent.agentId}
                className={`rounded-xl border p-5 transition-all ${
                  agent.status === 'running'
                    ? 'bg-cyan-950/20 border-cyan-500/60 shadow-lg shadow-cyan-500/5'
                    : agent.status === 'completed'
                    ? 'bg-[#0f1624] border-emerald-500/40'
                    : 'bg-[#0f1624]/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {agent.modelBadge}
                    </span>
                    <h3 className="font-semibold text-slate-100 text-sm mt-2">
                      {agent.agentName}
                    </h3>
                    <p className="text-xs text-slate-400">{agent.role}</p>
                  </div>

                  {agent.status === 'running' && (
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
                  )}
                  {agent.status === 'completed' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                  {agent.summary}
                </p>

                {agent.status === 'completed' && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Saída Estruturada (JSON)</span>
                      <span className="text-emerald-400 font-mono">{agent.durationMs}ms</span>
                    </div>
                    <pre className="bg-[#080b12] p-2.5 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(agent.structuredOutput, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Consolidated Diagnostic & Remediation Report */}
        {report && (
          <section className="bg-[#0f1624] border border-cyan-500/30 rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-slate-100">
                      Laudo Consolidado · {report.incidentId}
                    </h2>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      SEVERIDADE {report.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Gerado em {report.timestamp}</p>
                </div>
              </div>

              <button
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                Exportar Laudo (.md)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  Diagnóstico Executivo
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-[#080b12] p-4 rounded-lg border border-slate-800">
                  {report.executiveSummary}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Causa Raiz (Root Cause Analysis)
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-[#080b12] p-4 rounded-lg border border-slate-800">
                  {report.rootCause}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Playbook de Contenção & Comandos Recomendados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.remediationCommands.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#080b12] border border-slate-800 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        {item.platform}
                      </span>
                      <button
                        onClick={() => handleCopyCommand(item.command)}
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedCmd === item.command ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap">
                      {item.command}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;