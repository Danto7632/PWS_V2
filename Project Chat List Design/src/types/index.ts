export interface Conversation {
  id: string;
  title: string;
  preview: string;
  date: string;
  projectId: string;
}

export interface Project {
  id: string;
  name: string;
  conversations: Conversation[];
  isExpanded?: boolean;
  category?: string;
  files?: ProjectFile[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  size: number;
}