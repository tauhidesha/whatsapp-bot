'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createApiClient } from '@/lib/api/client';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  media?: { type: string; mimetype: string; base64: string; previewUrl: string }[];
  timestamp: Date;
}

interface MediaAttachment {
  type: string; // 'image' or 'video'
  mimetype: string;
  base64: string;
  previewUrl: string;
  fileName: string;
}

export default function PlaygroundChat() {
  const { getIdToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'customer' | 'admin'>('customer');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [messages, isLoading]);

  // Compress image using canvas to stay under Vercel's 4.5MB payload limit
  const compressImage = useCallback(async (file: File, maxSize = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Resize if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG base64
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: MediaAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;

      let base64: string;
      let mimetype = file.type;

      if (isImage) {
        // Compress images to avoid Vercel payload limit
        base64 = await compressImage(file);
        mimetype = 'image/jpeg';
      } else {
        // Videos: read as-is (user should keep them small)
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
      }

      const previewUrl = URL.createObjectURL(file);

      newAttachments.push({
        type: isImage ? 'image' : 'video',
        mimetype,
        base64,
        previewUrl,
        fileName: file.name,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [compressImage]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if ((!trimmedInput && attachments.length === 0) || isLoading) return;

    const messageMedia = attachments.map(a => ({
      type: a.type,
      mimetype: a.mimetype,
      base64: a.base64,
      previewUrl: a.previewUrl,
    }));

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      media: messageMedia.length > 0 ? messageMedia : undefined,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setIsLoading(true);

    try {
      const apiClient = createApiClient(
        process.env.NEXT_PUBLIC_API_URL || '/api',
        getIdToken
      );

      const payload: any = {
        message: trimmedInput || '(media)',
        mode,
      };

      if (messageMedia.length > 0) {
        payload.media = messageMedia.map(m => ({
          type: m.type,
          mimetype: m.mimetype,
          base64: m.base64,
        }));
      }

      const result: any = await apiClient.testAI(payload);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: result.response || result.ai_response || 'Tidak ada respons.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: `⚠️ Error: ${error.message || 'Gagal menghubungi server.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    attachments.forEach(a => URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
  };

  function formatMessageText(text: string) {
    if (!text) return '';
    text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
    return text;
  }

  return (
    <div className="flex flex-col h-full bg-[#fbfbfb]">
      {/* Header */}
      <div className="shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md shadow-slate-800/20">
              <span className="material-symbols-outlined text-teal-400 text-[22px]">smart_toy</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-slate-900 text-base font-black leading-none tracking-tight">Zoya Playground</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-1">Testing & Debug</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setMode('customer')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                  mode === 'customer'
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                Customer
              </button>
              <button
                onClick={() => setMode('admin')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-200",
                  mode === 'admin'
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                Admin
              </button>
            </div>

            {/* Clear Chat */}
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
              title="Clear chat"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              <span className="hidden md:inline">Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {/* Subtle dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />

        <div
          className="py-4 md:py-8 flex flex-col gap-3 min-h-full"
          style={{ padding: '1rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
        >
          {/* Spacer to push content down */}
          <div className="flex-1" />

          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center p-8 max-w-xs">
                <div className="size-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-slate-200/50 mb-8 border border-slate-50">
                  <span className="material-symbols-outlined text-6xl text-slate-100">smart_toy</span>
                </div>
                <h4 className="text-slate-900 font-black text-lg mb-2">Playground Siap!</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Kirim pesan untuk menguji respons Zoya. Mode saat ini: <strong className="text-slate-600">{mode === 'customer' ? 'Customer' : 'Admin'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Message Bubbles */}
          {messages.map((message) => {
            const isOutgoing = message.role === 'user';

            return (
              <div
                key={message.id}
                className={cn(
                  "flex group animate-in fade-in slide-in-from-bottom-4 duration-500",
                  isOutgoing ? "justify-end" : "justify-start"
                )}
                style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
              >
                {/* AI Avatar */}
                {!isOutgoing && (
                  <div className="w-10 mr-3 shrink-0 flex flex-col justify-end">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-md">
                      <span className="material-symbols-outlined text-teal-400 text-[16px]">smart_toy</span>
                    </div>
                  </div>
                )}

                <div
                  className={cn(
                    "flex flex-col",
                    isOutgoing ? "items-end" : "items-start"
                  )}
                  style={{
                    minWidth: 0,
                    maxWidth: isOutgoing ? '75%' : 'calc(75% - 52px)',
                  }}
                >
                  {/* Media Preview in Message */}
                  {message.media && message.media.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {message.media.map((m, i) => (
                        <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                          {m.type === 'image' ? (
                            <img src={m.previewUrl} alt="attachment" className="max-h-48 max-w-64 object-cover rounded-xl" />
                          ) : (
                            <video src={m.previewUrl} className="max-h-48 max-w-64 rounded-xl" controls />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text Bubble */}
                  {message.content && (
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl leading-relaxed text-[15px] relative transition-all duration-300",
                        isOutgoing
                          ? "bg-slate-800 text-slate-50 font-medium rounded-tr-sm shadow-sm"
                          : "bg-white text-slate-700 rounded-tl-sm border border-slate-200 shadow-sm"
                      )}
                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word', minWidth: 0, maxWidth: '100%' }}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: formatMessageText(message.content) }}
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      />
                    </div>
                  )}

                  {/* Meta */}
                  <div className={cn(
                    "mt-2.5 flex items-center gap-2.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    isOutgoing ? "flex-row-reverse" : ""
                  )}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {isOutgoing ? 'You' : 'Zoya AI'}
                    </span>
                    <span className="size-1 bg-slate-200 rounded-full" />
                    <Badge variant="outline" className={cn(
                      "h-3.5 px-1.5 py-0 text-[9px] uppercase font-black tracking-tighter shadow-none",
                      mode === 'admin'
                        ? "border-amber-300/50 text-amber-600 bg-amber-50"
                        : "border-teal-300/50 text-teal-600 bg-teal-50"
                    )}>
                      {mode}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ width: '100%' }}>
              <div className="w-10 mr-3 shrink-0 flex flex-col justify-end">
                <div className="w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-teal-400 text-[16px]">smart_toy</span>
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="size-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="size-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-2 md:p-6 bg-white/90 backdrop-blur-md border-t border-slate-100 z-20 w-full">
        <div className="max-w-4xl mx-auto w-full">
          <div className="relative flex flex-col items-stretch bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">

            {/* Input Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "size-1.5 rounded-full animate-pulse shadow-sm",
                  mode === 'admin' ? "bg-amber-500 shadow-amber-500/50" : "bg-teal-500 shadow-teal-500/50"
                )} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Playground — {mode === 'admin' ? 'Admin Mode' : 'Customer Mode'}
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-400 hidden md:block uppercase tracking-tight">Shift + Enter untuk baris baru</span>
            </div>

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 overflow-x-auto">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative shrink-0 group/thumb">
                    {attachment.type === 'image' ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.fileName}
                        className="h-16 w-16 object-cover rounded-xl border border-slate-200"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400 text-[24px]">videocam</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-md"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                    <span className="absolute bottom-0.5 left-0.5 right-0.5 text-[8px] font-bold text-white bg-black/50 rounded-b-lg px-1 py-0.5 truncate text-center">
                      {attachment.fileName.length > 10 ? attachment.fileName.slice(0, 8) + '…' : attachment.fileName}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Textarea + Buttons */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan untuk menguji Zoya..."
                disabled={isLoading}
                className={cn(
                  "min-h-[80px] p-4 pr-24 resize-none border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-b-2xl transition-all text-[15px] font-medium placeholder:text-slate-400",
                  isLoading && "opacity-50"
                )}
                style={{ maxHeight: '160px' }}
              />

              {/* Action Buttons */}
              <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                {/* Attach Media */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="rounded-xl h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-all"
                  title="Attach image/video"
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="rounded-xl h-10 w-10 flex items-center justify-center bg-teal-500 text-white shadow-md shadow-teal-500/30 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all border-none"
                >
                  {isLoading ? (
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[20px] ml-0.5">send</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
