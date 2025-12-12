import { useState, useRef, useEffect } from 'react';
import { 
  PanelLeft, 
  Share2, 
  MoreHorizontal, 
  Plus,
  Mic,
  Volume2,
  Send,
  FolderOpen
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ModelSelector } from './ModelSelector';
import { ProjectMenu } from './ProjectMenu';
import { ApiKeySettings } from './ApiKeySettings';
import { AddFileDialog } from './AddFileDialog';
import { GuidelineDialog } from './GuidelineDialog';
import { Message, Conversation, ProjectFile } from '../types';

interface ChatAreaProps {
  conversationTitle?: string;
  projectTitle?: string;
  projectConversations?: Conversation[];
  projectFiles?: ProjectFile[];
  messages: Message[];
  onSendMessage: (content: string) => void;
  onToggleSidebar: () => void;
  onSelectConversation?: (id: string) => void;
  onAddFiles?: (files: ProjectFile[]) => void;
  apiKeys: { gpt: string; gemini: string };
  onSaveApiKeys: (keys: { gpt: string; gemini: string }) => void;
  isApiKeySettingsOpen?: boolean;
  onApiKeySettingsOpenChange?: (open: boolean) => void;
}

export function ChatArea({ 
  conversationTitle,
  projectTitle,
  projectConversations,
  projectFiles = [],
  messages, 
  onSendMessage,
  onToggleSidebar,
  onSelectConversation,
  onAddFiles,
  apiKeys,
  onSaveApiKeys,
  isApiKeySettingsOpen = false,
  onApiKeySettingsOpenChange
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-5.1-thinking');
  const [isAddFileDialogOpen, setIsAddFileDialogOpen] = useState(false);
  const [isGuidelineDialogOpen, setIsGuidelineDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-screen">
      {/* Header */}
      <header className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            className="lg:hidden p-2"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="size-5" />
          </Button>
          
          <ModelSelector
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2">
            <Share2 className="size-4" />
            <span className="hidden sm:inline">공유하기</span>
          </Button>
          <ProjectMenu
            onShare={() => console.log('공유하기')}
            onSettings={() => console.log('프로젝트 설정')}
            onAddGuideline={() => setIsGuidelineDialogOpen(true)}
            onDelete={() => console.log('프로젝트 삭제')}
          />
        </div>
      </header>

      {/* API Key Settings Modal */}
      <ApiKeySettings
        isOpen={isApiKeySettingsOpen}
        onClose={() => onApiKeySettingsOpenChange?.(false)}
        apiKeys={apiKeys}
        onSaveApiKeys={onSaveApiKeys}
      />

      {/* Add File Dialog */}
      <AddFileDialog
        isOpen={isAddFileDialogOpen}
        onClose={() => setIsAddFileDialogOpen(false)}
        onAddFiles={(files) => onAddFiles?.(files)}
        existingFiles={projectFiles}
      />

      {/* Guideline Dialog */}
      <GuidelineDialog
        isOpen={isGuidelineDialogOpen}
        onClose={() => setIsGuidelineDialogOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="px-4 pb-4">
            {/* Project View - Show conversations list */}
            {projectTitle && (
              <>
                {/* Project Header */}
                <div className="max-w-3xl mx-auto py-12">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="size-8 text-gray-700" />
                      <h1 className="text-4xl">{projectTitle}</h1>
                    </div>
                    <Button 
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => setIsAddFileDialogOpen(true)}
                    >
                      <Plus className="size-4" />
                      파일 추가
                    </Button>
                  </div>

                  {/* Input Area for Project */}
                  <div className="mb-8">
                    <form onSubmit={handleSubmit} className="relative">
                      <div className="flex items-center gap-2 p-3 bg-white rounded-3xl border border-gray-200 focus-within:border-gray-300 transition-colors">
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Plus className="size-5 text-gray-600" />
                        </button>
                        
                        <textarea
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmit(e);
                            }
                          }}
                          placeholder={`${projectTitle}에서 새 채팅`}
                          className="flex-1 bg-transparent resize-none outline-none max-h-32 min-h-[24px] py-2"
                          rows={1}
                        />

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Mic className="size-5 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Volume2 className="size-5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Conversations List */}
                  {projectConversations && projectConversations.length > 0 && (
                    <div className="space-y-2">
                      <h2 className="text-sm text-gray-500 mb-4">대화</h2>
                      {projectConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          onClick={() => onSelectConversation?.(conversation.id)}
                          className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <h3 className="mb-1">{conversation.title}</h3>
                          <p className="text-sm text-gray-500">{conversation.preview}</p>
                          <p className="text-xs text-gray-400 mt-2">{conversation.date}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Conversation View - Show messages */}
            {!projectTitle && conversationTitle && (
              <>
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mb-6">
                      <FolderOpen className="size-16 mx-auto text-gray-300" />
                    </div>
                    <h1 className="text-3xl mb-4">{conversationTitle || '새 프로젝트'}</h1>
                    <p className="text-gray-500 mb-8">
                      {conversationTitle ? `${conversationTitle}에서 새 채팅` : '프로젝트를 선택하거나 새로 만드세요'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-4 ${
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="size-8 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                            <span className="text-white text-sm">AI</span>
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-white border border-gray-200'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === 'user' && (
                          <div className="size-8 rounded-full bg-blue-500 flex-shrink-0 flex items-center justify-center">
                            <span className="text-white text-sm">U</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area - Only show for conversation view */}
      {!projectTitle && (
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-3xl border border-gray-200 focus-within:border-gray-300 transition-colors">
                <button
                  type="button"
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                >
                  <Plus className="size-5 text-gray-600" />
                </button>
                
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder={conversationTitle ? `${conversationTitle}에서 새 채팅` : '메시지를 입력하세요'}
                  className="flex-1 bg-transparent resize-none outline-none max-h-32 min-h-[24px] py-2"
                  rows={1}
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Mic className="size-5 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Volume2 className="size-5 text-gray-600" />
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="p-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Send className="size-5 text-white" />
                  </button>
                </div>
              </div>
            </form>
            <p className="text-xs text-gray-500 text-center mt-3">
              Extended thinking
            </p>
          </div>
        </div>
      )}
    </div>
  );
}