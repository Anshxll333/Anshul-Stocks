import React from 'react';
import { Plus, MessageSquare, Trash2, ChevronLeft, Sparkles, Image as ImageIcon } from 'lucide-react';

export interface ConversationItem {
  id: number;
  title: string;
  updatedAt: string;
  isScreenshot?: boolean;
}

interface SidebarProps {
  conversations: ConversationItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNewChat: () => void;
  onDelete?: (id: number) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  isOpen,
  onToggle,
}) => {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-[var(--bg-surface)]/90 border-r border-[var(--border)] flex flex-col transition-all duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Header / New Chat */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
        <button
          onClick={onNewChat}
          className="btn-primary flex-1 py-2.5 px-4 text-xs font-semibold"
        >
          <Plus className="w-4 h-4" />
          <span>New AI Conversation</span>
        </button>

        <button
          onClick={onToggle}
          className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-subtle)]"
          title="Close Sidebar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
        <div className="px-2 py-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
          <span>Recent Threads</span>
          <span className="text-[10px] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] font-mono border border-[var(--border)]">
            {conversations.length}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div className="p-4 text-center text-xs text-[var(--text-muted)] rounded-xl border border-dashed border-[var(--border)] my-2">
            No active conversations yet. Start a new session above!
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[var(--bg-subtle)] text-[var(--accent)] border border-[var(--border-strong)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {conv.isScreenshot ? (
                    <ImageIcon className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
                  ) : (
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                  )}
                  <span className="truncate">{conv.title}</span>
                </div>

                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--danger)] rounded transition-opacity"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-base)] text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[var(--accent)]" />
        <div className="truncate">
          <p className="font-semibold text-[var(--text-secondary)] text-[11px]">AI Investment Mentor</p>
          <p className="text-[10px] text-[var(--text-muted)]">Live Exchange Data & Scoring Engine</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
