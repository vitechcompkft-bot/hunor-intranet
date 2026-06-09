import {
  FolderOpen,
  Bug,
  ClipboardList,
  MessageSquare,
  Camera,
  Video,
  BookOpen,
  MessageCircle,
  Settings,
  type LucideIcon,
} from 'lucide-react';

/** Egységes navigációs kulcsok (a szerepkör-specifikus engedélyek ezekre képződnek le). */
export type NavKey =
  | 'store_folders'
  | 'bug_report'
  | 'demand_form'
  | 'message'
  | 'photo'
  | 'video_conference'
  | 'documentation'
  | 'chat'
  | 'settings';

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Csak staff (admin/kozpont) láthatja */
  staffOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'store_folders', href: '/', label: 'Fájlok', icon: FolderOpen },
  { key: 'bug_report', href: '/hibajegyek', label: 'Hibajegyek', icon: Bug },
  { key: 'demand_form', href: '/igenybekero', label: 'Igénybekérők', icon: ClipboardList },
  { key: 'message', href: '/uzenetek', label: 'Üzenetek', icon: MessageSquare },
  { key: 'photo', href: '/fotok', label: 'Fotók', icon: Camera },
  { key: 'video_conference', href: '/video', label: 'Videó konferencia', icon: Video },
  { key: 'documentation', href: '/dokumentacio', label: 'Dokumentáció', icon: BookOpen },
  { key: 'chat', href: '/chat', label: 'Chat', icon: MessageCircle },
  { key: 'settings', href: '/beallitasok', label: 'Beállítások', icon: Settings, staffOnly: true },
];
