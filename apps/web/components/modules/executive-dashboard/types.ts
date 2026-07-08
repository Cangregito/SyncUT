export type StatusTone = "completed" | "in-progress" | "blocked" | "delayed";

export interface KpiItem {
  label: string;
  value: string;
  trend: string;
  tone: "success" | "warning" | "info";
  icon: string;
  micro: string;
}

export interface ActivityItem {
  user: string;
  action: string;
  description: string;
  module: string;
  squad: string;
  sprint: string;
  date: string;
  time: string;
  status: string;
  impact: string;
}

export interface ModuleOperationalMetric {
  name: string;
  description: string;
  href: string;
  total: number;
  totalLabel: string;
  attention: number;
  statusLabel: string;
  tone: "success" | "warning" | "info";
}

export interface LiveExecutiveData {
  activity: ActivityItem[];
  profileCount: number;
  auditCount: number;
  operationalProgress: number;
  openWorkCount: number;
  attentionCount: number;
  unreadNotifications: number;
  overdueIncidents: number;
  upcomingAppointments: number;
  pendingJustifications: number;
  activeConversations: number;
  openHandoffs: number;
  pendingEmails: number;
  moduleMetrics: ModuleOperationalMetric[];
  hasLiveSource: boolean;
}
