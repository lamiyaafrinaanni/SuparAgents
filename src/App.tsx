/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Key, Database, Search, Plus, Star, Trash2, RefreshCw, Filter, ShieldCheck, ShieldAlert, X, Clock, Calendar, AlertTriangle, Power, ChevronUp, ChevronDown, ArrowUpDown, LayoutDashboard, Settings, Menu, BarChart3, Users, Activity, Send, Bot, User, Sparkles, Eraser, Copy, Check, Mic, MicOff, MoreHorizontal, Minus, SlidersHorizontal, Sliders, Cpu, Zap, Brain, FileText, Edit3, CheckCircle2, Shield, Lock, Crown, Briefcase, Eye, UserPlus, UserX, HelpCircle, LockKeyhole } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

interface AgentAction {
  id: string;
  type: 'thought' | 'read_file' | 'edit_file' | 'search' | 'building' | 'built';
  label: string;
  timestamp: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelName?: string;
  provider?: string;
  executionTime?: number;
  thoughtTime?: number;
  thoughtText?: string;
  actions?: AgentAction[];
}

interface ApiKey {
  id: number | string;
  provider: string;
  name: string;
  key_value: string;
  expires_at?: string;
  last_used_at?: string;
  usage_count?: number;
  created_at: string;
}

interface AiModel {
  id: number | string;
  provider: string;
  model_name: string;
  model_id: string;
  status: 'active' | 'inactive';
  is_playground: boolean;
  is_favorite: boolean;
  created_at: string;
}

export type UserRole = "Admin" | "Manager" | "Viewer";

export interface AppUser {
  id: number | string;
  name: string;
  email: string;
  role: UserRole;
  avatar_color?: string;
  created_at?: string;
}

export interface PermissionItem {
  key: string;
  name: string;
  description: string;
  category: "API Keys" | "AI Models" | "User Management" | "Playground & Analytics";
  admin: boolean;
  manager: boolean;
  viewer: boolean;
}

export const PERMISSIONS_LIST: PermissionItem[] = [
  { key: "api_keys:read", name: "View API Keys", description: "View configured provider API keys and usage stats", category: "API Keys", admin: true, manager: true, viewer: true },
  { key: "api_keys:create", name: "Add & Test API Keys", description: "Validate and register new API keys to system", category: "API Keys", admin: true, manager: true, viewer: false },
  { key: "api_keys:delete", name: "Delete API Keys", description: "Permanently delete API keys from storage", category: "API Keys", admin: true, manager: false, viewer: false },
  
  { key: "ai_models:read", name: "View AI Models", description: "Browse active/inactive model inventory", category: "AI Models", admin: true, manager: true, viewer: true },
  { key: "ai_models:create", name: "Add & Sync Models", description: "Fetch models from providers or add custom models", category: "AI Models", admin: true, manager: true, viewer: false },
  { key: "ai_models:update", name: "Edit Model Settings", description: "Toggle active status, playground & favorite flags", category: "AI Models", admin: true, manager: true, viewer: false },
  { key: "ai_models:delete", name: "Delete AI Models", description: "Remove individual or bulk models", category: "AI Models", admin: true, manager: false, viewer: false },
  
  { key: "users:read", name: "View Team Roster", description: "View team members and assigned roles", category: "User Management", admin: true, manager: true, viewer: true },
  { key: "users:manage", name: "Manage Roles & Users", description: "Invite new users, assign roles, or delete users", category: "User Management", admin: true, manager: false, viewer: false },
  
  { key: "playground:execute", name: "Run Playground Prompts", description: "Execute test prompts in live AI playground", category: "Playground & Analytics", admin: true, manager: true, viewer: true },
  { key: "analytics:read", name: "View Usage Analytics", description: "View system metrics, DB health, and call stats", category: "Playground & Analytics", admin: true, manager: true, viewer: true },
];

export const hasPermission = (role: UserRole, permissionKey: string): boolean => {
  const perm = PERMISSIONS_LIST.find(p => p.key === permissionKey);
  if (!perm) return false;
  if (role === "Admin") return perm.admin;
  if (role === "Manager") return perm.manager;
  if (role === "Viewer") return perm.viewer;
  return false;
};

const isFreeModel = (model_id?: string | null, model_name?: string | null) => {
  if (!model_id && !model_name) return false;
  const idMatch = model_id ? model_id.toLowerCase().endsWith(":free") : false;
  const nameMatch = model_name ? model_name.toLowerCase().includes("free") : false;
  return idMatch || nameMatch;
};

const providers = [
  "Gemini",
  "Google AI Studio",
  "DeepSeek",
  "OpenRouter",
  "Alibaba Cloud",
  "Ollama Cloud",
  "NVIDIA NIM",
  "Mistral",
  "Codestral",
  "HuggingFace",
  "Vercel AI Gateway",
  "Kilo Gateway",
  "OpenCode Zen",
  "Cerebras",
  "Groq",
  "Cohere",
  "Cloudflare Workers AI",
  "OpenAI",
  "Anthropic",
  "Perplexity"
];

const DashboardView = ({ apiKeys, aiModels }: { apiKeys: ApiKey[], aiModels: AiModel[] }) => {
  const totalKeys = apiKeys.length;
  const totalModels = aiModels.length;
  const activeModels = aiModels.filter(m => m.status === 'active').length;
  const totalUsage = apiKeys.reduce((acc, key) => acc + (key.usage_count || 0), 0);
  
  const providerStats = providers.map(p => ({
    name: p,
    keys: apiKeys.filter(k => k.provider === p).length,
    models: aiModels.filter(m => m.provider === p).length
  })).filter(s => s.keys > 0 || s.models > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Key className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Total API Keys</p>
              <h3 className="text-2xl font-bold text-neutral-900">{totalKeys}</h3>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Total Models</p>
              <h3 className="text-2xl font-bold text-neutral-900">{totalModels}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Active Models</p>
              <h3 className="text-2xl font-bold text-neutral-900">{activeModels}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <BarChart3 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500">Total API Calls</p>
              <h3 className="text-2xl font-bold text-neutral-900">{totalUsage}</h3>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-neutral-200 shadow-sm">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg">Provider Distribution</CardTitle>
            <CardDescription>Breakdown of keys and models per provider</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            {providerStats.map(stat => (
              <div key={stat.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-700">{stat.name}</span>
                  <span className="text-neutral-500">{stat.keys} Keys • {stat.models} Models</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${(stat.keys / totalKeys) * 100}%` }}
                  />
                  <div 
                    className="h-full bg-purple-400" 
                    style={{ width: `${(stat.models / totalModels) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-neutral-200 shadow-sm">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest API key usage</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            {apiKeys
              .filter(k => k.last_used_at)
              .sort((a, b) => new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime())
              .slice(0, 5)
              .map(key => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-neutral-200">
                      <Key className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{key.name}</p>
                      <p className="text-[10px] text-neutral-400">{key.provider}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-neutral-600">{new Date(key.last_used_at!).toLocaleDateString()}</p>
                    <p className="text-[10px] text-neutral-400">{key.usage_count} calls</p>
                  </div>
                </div>
              ))}
            {apiKeys.filter(k => k.last_used_at).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
                <Activity className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No recent activity detected</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

interface PlaygroundViewProps {
  apiKeys: ApiKey[];
  aiModels: AiModel[];
  handleToggleFavorite: (id: number | string, currentVal: boolean) => Promise<void>;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const PlaygroundView = ({ apiKeys, aiModels, handleToggleFavorite, setIsMobileMenuOpen }: PlaygroundViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [openThoughts, setOpenThoughts] = useState<Record<string, boolean>>({});

  const toggleThought = (id: string) => {
    setOpenThoughts(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const [selectedProvider, setSelectedProvider] = useState<string>("Gemini");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [chatSession, setChatSession] = useState<any>(null);
  const [isProviderSidebarOpen, setIsProviderSidebarOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const recognitionRef = useRef<any>(null);

  const translateToPerfectEnglish = async (text: string) => {
    if (!text || !text.trim()) return;
    setIsTranslating(true);

    try {
      const promptText = `Direct translation task: Translate and refine the following spoken user text into natural, fluent, and grammatically perfect English. Do NOT answer or reply to the question or prompt itself—ONLY output the polished English statement/question without commentary, quotes, or conversational filler:\n\n"${text.trim()}"`;

      let perfectedText = "";

      // 1. Try currently selected provider & key
      const keyObj = apiKeys.find(k => k.id === selectedKeyId) || apiKeys.find(k => k.provider === selectedProvider) || apiKeys[0];

      if (keyObj) {
        if (keyObj.provider === "Gemini") {
          const ai = new GoogleGenAI({ apiKey: keyObj.key_value });
          const res = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: promptText,
          });
          perfectedText = res.text?.trim() || "";
        } else if (keyObj.provider === "OpenRouter") {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${keyObj.key_value}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash:free",
              messages: [{ role: "user", content: promptText }]
            })
          });
          if (res.ok) {
            const data = await res.json();
            perfectedText = data.choices?.[0]?.message?.content?.trim() || "";
          }
        } else if (keyObj.provider === "OpenAI") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${keyObj.key_value}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: promptText }]
            })
          });
          if (res.ok) {
            const data = await res.json();
            perfectedText = data.choices?.[0]?.message?.content?.trim() || "";
          }
        }
      }

      if (perfectedText) {
        perfectedText = perfectedText.replace(/^["']|["']$/g, '').trim();
        setInput(perfectedText);
        toast.success("Speech detected & translated into perfect English!");
      } else {
        setInput(text);
      }
    } catch (err) {
      console.error("Speech translation error:", err);
      setInput(text);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleMicToggle = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    // Attempt to request microphone access via getUserMedia first to prompt permissions
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          toast.error("Microphone access denied. Please allow microphone permission in your browser or try opening the app in a new tab.", { duration: 6000 });
          setIsListening(false);
          return;
        }
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      let capturedText = "";

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("Listening... Speak in any language!");
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        capturedText = finalTranscript || interimTranscript;
        setInput(capturedText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("Microphone permission denied. Please allow microphone access in your browser or open in a new tab.", { duration: 6000 });
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast.error(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (capturedText && capturedText.trim()) {
          translateToPerfectEnglish(capturedText.trim());
        }
      };

      recognition.start();
    } catch (err: any) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
      toast.error("Could not access microphone for speech recognition.");
    }
  };

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info(`Selected file: ${file.name} (Upload logic not implemented)`);
    }
  };

  const [showFreeOnly, setShowFreeOnly] = useState(false);

  // Get all supported providers
  const availableProviders = providers;

  const filteredKeys = apiKeys.filter(k => k.provider === selectedProvider);
  const baseFilteredModels = aiModels.filter(m => 
    m.provider === selectedProvider && 
    m.status === "active" && 
    (m.is_playground || aiModels.filter(mod => mod.provider === selectedProvider && mod.is_playground).length === 0)
  );

  const filteredModels = baseFilteredModels
    .filter(m => {
      if (selectedProvider === "OpenRouter" && showFreeOnly) {
        return isFreeModel(m.model_id, m.model_name);
      }
      return true;
    })
    .sort((a, b) => {
      if (selectedProvider === "OpenRouter") {
        const aFree = isFreeModel(a.model_id, a.model_name);
        const bFree = isFreeModel(b.model_id, b.model_name);
        if (aFree && !bFree) return -1;
        if (!aFree && bFree) return 1;
      }
      return (a.model_name || "").localeCompare(b.model_name || "");
    });

  // Get all playground models for the list
  const playgroundModels = aiModels.filter(m => m.is_playground && m.status === "active");
  const favoriteModels = aiModels.filter(m => m.is_favorite && m.status === "active");

  // Automatically pick the first key for the selected provider
  const selectedKeyId = filteredKeys.length > 0 ? filteredKeys[0].id : "";

  useEffect(() => {
    if (filteredModels.length > 0) {
      const currentModelExists = filteredModels.find(m => m.model_id === selectedModelId);
      if (!selectedModelId || !currentModelExists) {
        // If no model selected OR current model is not in new provider's list
        setSelectedModelId(filteredModels[0].model_id);
      }
    } else {
      // Clear selection if no models available for provider
      setSelectedModelId("");
    }
  }, [selectedProvider, filteredModels]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !selectedKeyId || !selectedModelId) {
      if (!selectedKeyId && input.trim()) toast.error(`No API key found for ${selectedProvider}`);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const startTime = Date.now();
    const selModelObj = aiModels.find(m => m.model_id === selectedModelId);
    const displayModelName = selModelObj ? selModelObj.model_name : (selectedModelId || "Gemini 3.6 Flash");
    const assistantMessageId = (Date.now() + 1).toString();

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const initialActions: AgentAction[] = [
      { id: '1', type: 'search', label: 'Searching model knowledge', timestamp: nowTimeStr },
      { id: '2', type: 'read_file', label: 'Read 1 file: prompt context', timestamp: nowTimeStr },
      { id: '3', type: 'thought', label: 'Thinking', timestamp: nowTimeStr }
    ];

    let liveTimer: any = null;

    try {
      const keyObj = apiKeys.find(k => k.id === selectedKeyId);
      if (!keyObj) throw new Error("Selected API key not found");

      liveTimer = setInterval(() => {
        const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId ? { ...m, executionTime: elapsed } : m
        ));
      }, 100);

      if (selectedProvider === "OpenRouter") {
        fetch(`/api/api-keys/${selectedKeyId}/last-used`, { method: "PATCH" }).catch(console.error);

        setMessages(prev => [...prev, {
          id: assistantMessageId,
          role: 'model',
          content: "",
          timestamp: new Date().toISOString(),
          modelName: displayModelName,
          provider: selectedProvider,
          executionTime: 0.1,
          thoughtTime: 1.2,
          thoughtText: `Analyzing OpenRouter prompt, formatting response context using ${displayModelName}.`,
          actions: initialActions
        }]);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${keyObj.key_value}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Super Agent Playground"
          },
          body: JSON.stringify({
            model: selectedModelId,
            messages: [
              ...messages.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.content
              })),
              { role: 'user', content: userMessage.content }
            ],
            stream: true,
            max_tokens: maxTokens
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          let rawError = errData.error?.message || errData.message || `OpenRouter error: ${response.status}`;
          if (typeof rawError === "object") rawError = JSON.stringify(rawError);

          if (rawError.toLowerCase().includes("insufficient credits")) {
            throw new Error(
              `Insufficient OpenRouter credits for '${selectedModelId}'. Your key has $0 credits. Please toggle "Free Only" or select a model ending in ':free' (e.g. google/gemma-2-9b-it:free) or add credits at openrouter.ai/settings/credits.`
            );
          }
          if (rawError.toLowerCase().includes("no endpoints found")) {
            throw new Error(
              `No active endpoints found for model '${selectedModelId}' on OpenRouter. Please select a valid active model from the dropdown.`
            );
          }
          throw new Error(rawError);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get response reader");

        let assistantContent = "";
        let addedEditAction = false;
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  let errText = parsed.error.message || JSON.stringify(parsed.error);
                  if (errText.toLowerCase().includes("insufficient credits")) {
                    errText = `Insufficient OpenRouter credits for '${selectedModelId}'. Please select a Free model ending in ':free' or add credits at openrouter.ai/settings/credits.`;
                  } else if (errText.toLowerCase().includes("no endpoints found")) {
                    errText = `No active endpoints found for '${selectedModelId}'. Please select another model from the dropdown.`;
                  }
                  throw new Error(errText);
                }
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  assistantContent += content;
                  setMessages(prev => prev.map(m => {
                    if (m.id === assistantMessageId) {
                      let updatedActions = m.actions || [];
                      if (!addedEditAction) {
                        addedEditAction = true;
                        updatedActions = [
                          ...updatedActions,
                          { id: '4', type: 'edit_file', label: 'Editing stream output', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
                        ];
                      }
                      return { ...m, content: assistantContent, actions: updatedActions };
                    }
                    return m;
                  }));
                }
              } catch (e: any) {
                if (e.message && (e.message.includes("credits") || e.message.includes("endpoints") || e.message.includes("OpenRouter"))) {
                  throw e;
                }
              }
            }
          }
        }
        return;
      }

      if (selectedProvider === "OpenAI") {
        fetch(`/api/api-keys/${selectedKeyId}/last-used`, { method: "PATCH" }).catch(console.error);

        setMessages(prev => [...prev, {
          id: assistantMessageId,
          role: 'model',
          content: "",
          timestamp: new Date().toISOString(),
          modelName: displayModelName,
          provider: selectedProvider,
          executionTime: 0.1,
          thoughtTime: 1.0,
          thoughtText: `Processing request with OpenAI ${displayModelName}.`,
          actions: initialActions
        }]);

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${keyObj.key_value}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModelId || "gpt-4o-mini",
            messages: [
              ...messages.map(m => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.content
              })),
              { role: 'user', content: userMessage.content }
            ],
            stream: true,
            max_tokens: maxTokens
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `OpenAI error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to get response reader");

        let assistantContent = "";
        let addedEditAction = false;
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  assistantContent += content;
                  setMessages(prev => prev.map(m => {
                    if (m.id === assistantMessageId) {
                      let updatedActions = m.actions || [];
                      if (!addedEditAction) {
                        addedEditAction = true;
                        updatedActions = [
                          ...updatedActions,
                          { id: '4', type: 'edit_file', label: 'Editing stream output', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
                        ];
                      }
                      return { ...m, content: assistantContent, actions: updatedActions };
                    }
                    return m;
                  }));
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
        return;
      }

      if (selectedProvider !== "Gemini") {
        throw new Error(`The Playground currently supports Gemini, OpenRouter, and OpenAI. Model key validation is supported for ${selectedProvider}.`);
      }

      // Ensure model name is valid for Gemini
      let modelName = selectedModelId;
      
      const modelMapping: Record<string, string> = {
        "gemini-pro": "gemini-1.5-pro",
        "gemini-flash": "gemini-1.5-flash",
        "gemini-ultra": "gemini-1.0-ultra",
        "gemini-1.5-pro-latest": "gemini-1.5-pro",
        "gemini-1.5-flash-latest": "gemini-1.5-flash"
      };

      if (modelMapping[modelName]) {
        modelName = modelMapping[modelName];
      }

      const ai = new GoogleGenAI({ apiKey: keyObj.key_value });
      
      fetch(`/api/api-keys/${selectedKeyId}/last-used`, { method: "PATCH" }).catch(console.error);

      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'model',
        content: "",
        timestamp: new Date().toISOString(),
        modelName: displayModelName || "Gemini 3.6 Flash",
        provider: selectedProvider,
        executionTime: 0.1,
        thoughtTime: 1.5,
        thoughtText: `Analyzed system context, executed Google Gemini multi-modal stream pipeline.`,
        actions: initialActions
      }]);

      const result = await ai.models.generateContentStream({
        model: modelName,
        contents: [
          ...messages.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          })),
          { role: 'user', parts: [{ text: userMessage.content }] }
        ],
        config: {
          maxOutputTokens: maxTokens
        }
      });
      
      let assistantContent = "";
      let addedEditAction = false;

      for await (const chunk of result) {
        const chunkText = chunk.text;
        if (chunkText) {
          assistantContent += chunkText;
          setMessages(prev => prev.map(m => {
            if (m.id === assistantMessageId) {
              let updatedActions = m.actions || [];
              if (!addedEditAction) {
                addedEditAction = true;
                updatedActions = [
                  ...updatedActions,
                  { id: '4', type: 'edit_file', label: 'Editing stream output', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
                ];
              }
              return { ...m, content: assistantContent, actions: updatedActions };
            }
            return m;
          }));
        }
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      const errMsg = error.message || "Unknown error";
      toast.error(`Chat error: ${errMsg}`);
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        role: 'model',
        content: `⚠️ **Chat Error:** ${errMsg}`,
        timestamp: new Date().toISOString(),
        modelName: displayModelName || "Gemini 3.6 Flash",
        provider: selectedProvider,
        executionTime: parseFloat(((Date.now() - startTime) / 1000).toFixed(1))
      }]);
    } finally {
      if (liveTimer) clearInterval(liveTimer);
      const finalTotalSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
      const endNowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setMessages(prev => prev.map(m => {
        if (m.id === assistantMessageId) {
          const acts = m.actions || [];
          const hasBuilt = acts.some(a => a.type === 'built');
          return {
            ...m,
            executionTime: finalTotalSec,
            actions: hasBuilt ? acts : [
              ...acts,
              { id: Date.now().toString(), type: 'built', label: 'Built response', timestamp: endNowStr }
            ]
          };
        }
        return m;
      }));
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatSession(null);
    toast.success("Chat cleared");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen md:h-full bg-white md:rounded-none md:border-0 overflow-hidden animate-in fade-in duration-500 fixed inset-0 z-[130] md:relative md:inset-auto">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header (Mobile Specific) */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-neutral-100 text-neutral-900 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-10 h-10 flex items-center justify-center hover:bg-neutral-100 rounded-full transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-semibold text-lg tracking-tight">Super Agent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
              
              {/* Model Dropdown */}
              <AnimatePresence>
                {isModelDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 rounded-xl shadow-xl z-[60] overflow-hidden"
                  >
                    <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200">
                      <p className="px-3 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Select Model ({selectedProvider})</span>
                        {selectedProvider === "OpenRouter" && (
                          <button 
                            onClick={() => setShowFreeOnly(!showFreeOnly)} 
                            className="text-[10px] text-emerald-600 font-semibold hover:underline"
                          >
                            {showFreeOnly ? "Show All" : "Free Only"}
                          </button>
                        )}
                      </p>
                      {filteredModels.map(m => (
                        <div key={m.id} className="flex items-center gap-1 group">
                          <button
                            onClick={() => {
                              setSelectedModelId(m.model_id);
                              setIsModelDropdownOpen(false);
                            }}
                            className={cn(
                              "flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-1.5",
                              selectedModelId === m.model_id ? "bg-primary/10 text-primary font-medium" : "hover:bg-neutral-50 text-neutral-700"
                            )}
                          >
                            <span className="truncate">{m.model_name}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {isFreeModel(m.model_id, m.model_name) && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 font-normal">Free</Badge>
                              )}
                              {selectedModelId === m.model_id && <Check className="w-4 h-4" />}
                            </div>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(m.id, m.is_favorite);
                            }}
                            className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                            title={m.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            <Star className={cn("w-4 h-4", m.is_favorite && "fill-current")} />
                          </button>
                        </div>
                      ))}
                      {filteredModels.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-neutral-400 italic">No models available</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsProviderSidebarOpen(true)}
              className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Right Sidebar (Provider & Favorites) */}
        <AnimatePresence>
          {isProviderSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProviderSidebarOpen(false)}
                className="fixed inset-0 bg-black/40 z-[160] md:hidden backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                className="fixed inset-y-0 right-0 w-72 bg-white z-[170] md:hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 flex items-center justify-between border-b border-neutral-100">
                  <span className="font-bold text-neutral-900">Playground Settings</span>
                  <button onClick={() => setIsProviderSidebarOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Select Provider</p>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-white border-neutral-200 shadow-sm">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProviders.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Favorite Models</p>
                    <div className="space-y-1">
                      {favoriteModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedProvider(m.provider);
                            setSelectedModelId(m.model_id);
                            setIsProviderSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between border",
                            selectedModelId === m.model_id 
                              ? "bg-primary/5 border-primary/20 text-primary" 
                              : "bg-transparent border-transparent hover:bg-neutral-50 text-neutral-600"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold">{m.model_name}</span>
                            <span className="text-[9px] opacity-60 font-medium">{m.provider}</span>
                          </div>
                          {selectedModelId === m.model_id && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                      {favoriteModels.length === 0 && (
                        <p className="text-xs text-neutral-400 italic text-center py-4">No favorites yet</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-neutral-100">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Max Tokens</p>
                      <span className="text-xs font-mono font-bold text-primary">{maxTokens}</span>
                    </div>
                    <div className="px-1">
                      <input 
                        type="range" 
                        min="256" 
                        max="32768" 
                        step="256"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Chat Header (Desktop Specific) */}
        <div className="hidden md:flex p-4 border-b border-neutral-100 bg-neutral-50/50 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-[200px]">
            <div className="flex flex-col gap-1 flex-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Model</label>
                {selectedProvider === "OpenRouter" && (
                  <button 
                    onClick={() => setShowFreeOnly(!showFreeOnly)} 
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 border",
                      showFreeOnly 
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold" 
                        : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                    )}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    {showFreeOnly ? "Free Models Only (Active)" : "Filter Free Models"}
                  </button>
                )}
              </div>
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger className="h-9 bg-white">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 z-[300]">
                  {filteredModels.map(m => (
                    <SelectItem key={m.id} value={m.model_id}>
                      <div className="flex items-center justify-between w-full gap-3">
                        <span className="truncate">{m.model_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isFreeModel(m.model_id, m.model_name) && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 font-normal">Free</Badge>
                          )}
                          {m.is_playground && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  {filteredModels.length === 0 && <SelectItem value="none" disabled>No Models Available</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={clearChat} className="text-neutral-500 hover:text-red-500 gap-2">
            <Eraser className="w-4 h-4" /> Clear
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth scrollbar-hide bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 pb-20">
              <h2 className="text-neutral-900 text-3xl md:text-5xl font-medium max-w-lg leading-tight tracking-tight">
                Hi there, what can I help with?
              </h2>
              
              {/* Desktop Only Suggestions */}
              <div className="hidden md:grid grid-cols-1 gap-2 w-full max-w-md mt-12">
                <Button variant="outline" className="justify-start text-left h-auto py-4 px-5 rounded-2xl border-neutral-200 hover:bg-neutral-50 transition-all" onClick={() => setInput("Explain quantum computing in simple terms.")}>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Try asking:</p>
                    <p className="text-sm text-neutral-600">"Explain quantum computing in simple terms."</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start text-left h-auto py-4 px-5 rounded-2xl border-neutral-200 hover:bg-neutral-50 transition-all" onClick={() => setInput("Write a short poem about artificial intelligence.")}>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Try asking:</p>
                    <p className="text-sm text-neutral-600">"Write a short poem about artificial intelligence."</p>
                  </div>
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 pb-10">
              {messages.map((m) => (
                m.role === 'user' ? (
                  <div key={m.id} className="flex gap-3 flex-row-reverse group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 border border-neutral-800 shadow-sm">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col gap-1 items-end max-w-[85%]">
                      <div className="p-4 rounded-2xl bg-neutral-900 text-white text-[15px] leading-relaxed shadow-sm rounded-tr-none">
                        <div className="markdown-body prose prose-invert max-w-none">
                          <Markdown>{m.content}</Markdown>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-1 text-[10px] font-medium text-neutral-400">
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col gap-1.5 w-full items-start group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Model Name & Profile Photo OUTSIDE / ABOVE response div */}
                    <div className="flex items-center gap-2 px-1 text-xs text-neutral-700 font-medium">
                      <div className="w-6 h-6 rounded-md bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="font-bold text-neutral-900 text-xs">
                        {m.modelName || "Gemini 3.6 Flash"}
                      </span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-[11px] font-mono text-neutral-500 font-medium">
                        Ran for {m.executionTime !== undefined ? `${m.executionTime}s` : '59s'}
                      </span>
                    </div>

                    {/* Main response card div */}
                    <div className="w-full bg-white border border-neutral-200/90 rounded-2xl p-4 md:p-5 shadow-xs text-neutral-800 space-y-3">
                      <div className="markdown-body prose prose-neutral max-w-none text-[15px] leading-relaxed">
                        <Markdown>{m.content || "..."}</Markdown>
                      </div>

                      <div className="pt-3 border-t border-neutral-100 space-y-2.5">
                        <button 
                          onClick={() => toggleThought(m.id)}
                          className="flex items-center gap-2 text-xs font-mono font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200/70 transition-all w-fit"
                        >
                          <Brain className="w-3.5 h-3.5 text-purple-600" />
                          <span>Thought for ({m.thoughtTime || (m.executionTime ? Math.max(0.4, Number((m.executionTime * 0.35).toFixed(1))) : '1.2')}s)</span>
                          {openThoughts[m.id] ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 text-neutral-400" />}
                        </button>

                        {openThoughts[m.id] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs font-mono text-neutral-600 space-y-1"
                          >
                            <p className="text-neutral-700 font-sans font-medium">
                              {m.thoughtText || "Analyzed context, validated parameter constraints, and generated real-time token stream."}
                            </p>
                          </motion.div>
                        )}

                        {m.actions && m.actions.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-0.5">Agent Action History</p>
                            <div className="flex flex-wrap gap-1.5">
                              {m.actions.map(act => (
                                <div key={act.id} className="flex items-center gap-1.5 text-[11px] font-mono bg-neutral-100/80 border border-neutral-200/60 px-2.5 py-1 rounded-md text-neutral-700">
                                  {act.type === 'search' && <Search className="w-3 h-3 text-blue-500" />}
                                  {act.type === 'read_file' && <FileText className="w-3 h-3 text-emerald-600" />}
                                  {act.type === 'edit_file' && <Edit3 className="w-3 h-3 text-amber-600" />}
                                  {act.type === 'thought' && <Brain className="w-3 h-3 text-purple-500" />}
                                  {act.type === 'building' && <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />}
                                  {act.type === 'built' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                  <span>{act.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-2">
                      <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <button 
                        onClick={() => copyToClipboard(m.content)}
                        className="text-neutral-400 hover:text-neutral-700 transition-colors p-1 rounded-md hover:bg-neutral-100"
                        title="Copy message"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
          {isLoading && (
            <div className="flex gap-4 max-w-4xl mx-auto animate-pulse">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="p-4 rounded-2xl bg-neutral-100 border border-neutral-200 rounded-tl-none w-24 h-12 flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-3 md:p-4 bg-white border-t border-neutral-100">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-white border border-neutral-200/90 rounded-2xl p-3 shadow-xs space-y-2 focus-within:border-neutral-300 focus-within:ring-2 focus-within:ring-neutral-100 transition-all">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden" 
              />
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask anything or click mic to speak in any language..."
                className="w-full bg-white border-none text-neutral-900 p-2 text-[15px] focus:outline-none focus:ring-0 transition-all resize-none min-h-[60px] max-h-[200px] placeholder:text-neutral-400"
                rows={2}
              />

              <AnimatePresence>
                {isListening && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50/80 border border-red-200 px-3 py-1.5 rounded-xl animate-pulse"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    <Mic className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Listening... Speak in any language</span>
                  </motion.div>
                )}
                {isTranslating && (
                  <motion.div 
                    initial={{ opacity: 0, y: -4 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50/80 border border-amber-200 px-3 py-1.5 rounded-xl"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin shrink-0" />
                    <span className="truncate">Translating speech into perfect English...</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-800 transition-colors shrink-0 bg-neutral-100/80 hover:bg-neutral-200/80 border border-neutral-200/60"
                  title="Upload file or image"
                >
                  <Plus className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2 shrink-0">
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger className="h-9 px-2.5 rounded-xl bg-neutral-100/80 hover:bg-neutral-200/80 border border-neutral-200/60 font-medium text-xs max-w-[150px] sm:max-w-[200px] shrink-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <Cpu className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="truncate text-xs font-medium">
                          {filteredModels.find(m => m.model_id === selectedModelId)?.model_name || selectedModelId || "Select Model"}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-h-[260px] overflow-y-auto scrollbar-thin z-[300]">
                      {filteredModels.map(m => (
                        <SelectItem key={m.id} value={m.model_id}>
                          <div className="flex items-center justify-between w-full gap-2">
                            <span className="truncate text-xs">{m.model_name}</span>
                            {isFreeModel(m.model_id, m.model_name) && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 font-normal shrink-0">Free</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button 
                    onClick={handleMicToggle}
                    disabled={isTranslating}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 border",
                      isListening 
                        ? "bg-red-500 text-white border-red-600 animate-pulse ring-2 ring-red-300 shadow-sm" 
                        : isTranslating 
                        ? "bg-amber-100 text-amber-700 border-amber-300 cursor-wait"
                        : "bg-neutral-100/80 hover:bg-neutral-200/80 text-neutral-500 hover:text-neutral-800 border-neutral-200/60"
                    )}
                    title={
                      isListening 
                        ? "Listening... Click to stop" 
                        : isTranslating 
                        ? "Translating to perfect English..." 
                        : "Voice input (Auto-translates to perfect English)"
                    }
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5 text-white animate-pulse" />
                    ) : isTranslating ? (
                      <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading || !selectedKeyId || !selectedModelId}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-2xs shrink-0",
                      input.trim() 
                        ? "bg-neutral-900 text-white hover:bg-black active:scale-95" 
                        : "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                    )}
                    title="Send message"
                  >
                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-center text-neutral-500 mt-3 md:block hidden font-medium tracking-wide">
              AI can make mistakes. Check important info. Powered by Google Gemini.
            </p>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Desktop) */}
      <div className="hidden md:flex flex-col w-80 shrink-0 border-l border-neutral-200/80 bg-neutral-50/50 overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">Playground Settings</h3>
                <p className="text-[10px] text-neutral-500">Provider & Model Controls</p>
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Provider</label>
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-neutral-200 text-neutral-600 bg-white">
                {filteredKeys.length} {filteredKeys.length === 1 ? 'Key' : 'Keys'} Available
              </Badge>
            </div>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-white border-neutral-200 shadow-2xs font-medium text-xs">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                {availableProviders.map(p => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-xs">{p}</span>
                      {apiKeys.some(k => k.provider === p) && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Select Model</label>
              {selectedProvider === "OpenRouter" && (
                <button 
                  onClick={() => setShowFreeOnly(!showFreeOnly)} 
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1 border",
                    showFreeOnly 
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold" 
                      : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                  )}
                >
                  <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                  {showFreeOnly ? "Free Only" : "Filter Free"}
                </button>
              )}
            </div>
            <Select value={selectedModelId} onValueChange={setSelectedModelId}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-white border-neutral-200 shadow-2xs font-medium text-xs">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-200 z-[300]">
                {filteredModels.map(m => (
                  <SelectItem key={m.id} value={m.model_id}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="truncate">{m.model_name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFreeModel(m.model_id, m.model_name) && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50 font-normal">Free</Badge>
                        )}
                        {m.is_playground && <Star className="w-3 h-3 text-amber-500 fill-current" />}
                      </div>
                    </div>
                  </SelectItem>
                ))}
                {filteredModels.length === 0 && <SelectItem value="none" disabled>No Models Available</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Active API Key Status */}
          <div className="p-3 bg-white rounded-xl border border-neutral-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <Key className="w-3 h-3 text-neutral-500" /> API Key
              </span>
              {filteredKeys.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <AlertTriangle className="w-3 h-3" /> No Key
                </span>
              )}
            </div>

            {filteredKeys.length > 0 ? (
              <div className="text-xs font-mono bg-neutral-50 p-2 rounded-lg border border-neutral-100 flex items-center justify-between text-neutral-700">
                <span className="truncate">{filteredKeys[0].name}</span>
                <span className="text-[10px] text-neutral-400 shrink-0 font-sans">{filteredKeys[0].key_value.slice(0, 6)}...</span>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500 italic">
                No active key found for {selectedProvider}. Please add one in API Keys tab.
              </p>
            )}
          </div>

          {/* Active Model Summary Card */}
          <div className="p-3.5 bg-neutral-900 text-white rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase font-mono tracking-wider">
              <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-primary" /> Active Model</span>
              <span className="text-emerald-400 font-semibold">{selectedProvider}</span>
            </div>
            <p className="text-sm font-semibold truncate text-white">
              {filteredModels.find(m => m.model_id === selectedModelId)?.model_name || selectedModelId || "No Model Selected"}
            </p>
            <div className="flex items-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-neutral-700 text-neutral-300 font-mono truncate max-w-[200px]">
                {selectedModelId || "none"}
              </Badge>
              {isFreeModel(selectedModelId) && (
                <Badge className="text-[9px] py-0 px-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Free</Badge>
              )}
            </div>
          </div>

          {/* Max Tokens Slider & Presets */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Max Tokens
              </label>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{maxTokens}</span>
            </div>
            
            <input 
              type="range" 
              min="256" 
              max="32768" 
              step="256"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            
            <div className="flex items-center justify-between gap-1">
              {[1024, 2048, 4096, 8192, 16384].map(val => (
                <button
                  key={val}
                  onClick={() => setMaxTokens(val)}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-mono rounded border transition-all",
                    maxTokens === val 
                      ? "bg-primary text-white border-primary font-bold shadow-2xs" 
                      : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                  )}
                >
                  {val >= 1024 ? `${val / 1024}k` : val}
                </button>
              ))}
            </div>
          </div>

          {/* Favorite Models Quick List */}
          <div className="space-y-2.5 pt-4 border-t border-neutral-200/80">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500 fill-amber-500" /> Favorites ({favoriteModels.length})
              </label>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
              {favoriteModels.map(m => (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedProvider(m.provider);
                    setSelectedModelId(m.model_id);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between border cursor-pointer group",
                    selectedModelId === m.model_id 
                      ? "bg-white border-primary/30 text-primary shadow-xs ring-1 ring-primary/20" 
                      : "bg-white/80 border-neutral-200/60 hover:bg-white hover:border-neutral-300 text-neutral-700"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold truncate text-[11px]">{m.model_name}</span>
                      <span className="text-[9px] text-neutral-400 font-medium">{m.provider}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(m.id, m.is_favorite);
                      }}
                      className="p-1 text-amber-500 hover:bg-amber-50 rounded transition-colors"
                      title="Remove from Favorites"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                    {selectedModelId === m.model_id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </div>
                </div>
              ))}
              {favoriteModels.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-neutral-200 text-center bg-white/50">
                  <p className="text-[10px] text-neutral-400 italic">No favorite models starred yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-neutral-200/80 space-y-2">
            <Button 
              variant="outline" 
              onClick={clearChat} 
              className="w-full justify-center h-9 text-xs font-medium text-neutral-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 gap-2 rounded-xl"
            >
              <Eraser className="w-3.5 h-3.5" /> Clear Conversation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface UsersRbacViewProps {
  users: AppUser[];
  currentUser: AppUser;
  onSwitchUser: (user: AppUser) => void;
  onAddUser: (newUser: { name: string; email: string; role: UserRole }) => Promise<void>;
  onUpdateUserRole: (id: number | string, role: UserRole) => Promise<void>;
  onDeleteUser: (id: number | string) => Promise<void>;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const UsersRbacView = ({
  users,
  currentUser,
  onSwitchUser,
  onAddUser,
  onUpdateUserRole,
  onDeleteUser,
  setIsMobileMenuOpen,
}: UsersRbacViewProps) => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({ name: "", email: "", role: "Viewer" as UserRole });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageUsers = hasPermission(currentUser.role, "users:manage");

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter(u => u.role === "Admin").length;
  const managerCount = users.filter(u => u.role === "Manager").length;
  const viewerCount = users.filter(u => u.role === "Viewer").length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      toast.error("Permission Denied: Administrator role required to add users.");
      return;
    }
    if (!addUserForm.name || !addUserForm.email) {
      toast.error("Please fill in name and email.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onAddUser(addUserForm);
      setAddUserForm({ name: "", email: "", role: "Viewer" });
      setIsAddUserOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Users & Access Control (RBAC)</h1>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 text-xs">
              <Shield className="w-3.5 h-3.5" />
              Security Engine
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Manage user authorization, role hierarchy, and granular permissions across API keys and models.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Role Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
            <span className="text-neutral-500">Active Role:</span>
            <span className={cn(
              "font-semibold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1",
              currentUser.role === "Admin" && "bg-indigo-100 text-indigo-800 border border-indigo-200",
              currentUser.role === "Manager" && "bg-blue-100 text-blue-800 border border-blue-200",
              currentUser.role === "Viewer" && "bg-emerald-100 text-emerald-800 border border-emerald-200"
            )}>
              {currentUser.role === "Admin" && <Crown className="w-3 h-3" />}
              {currentUser.role === "Manager" && <Briefcase className="w-3 h-3" />}
              {currentUser.role === "Viewer" && <Eye className="w-3 h-3" />}
              {currentUser.role}
            </span>
          </div>

          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger render={
              <Button disabled={!canManageUsers} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium">
                {!canManageUsers ? <Lock className="w-4 h-4 text-neutral-300" /> : <UserPlus className="w-4 h-4" />}
                Add Team Member
              </Button>
            } />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                  Invite Team Member
                </DialogTitle>
                <DialogDescription>
                  Add a new user and assign their access control role.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700">Full Name</label>
                  <Input 
                    placeholder="e.g. Jordan Lee" 
                    value={addUserForm.name}
                    onChange={e => setAddUserForm({ ...addUserForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700">Email Address</label>
                  <Input 
                    type="email"
                    placeholder="jordan@company.com" 
                    value={addUserForm.email}
                    onChange={e => setAddUserForm({ ...addUserForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700">Assign Role</label>
                  <Select value={addUserForm.role} onValueChange={(val: UserRole) => setAddUserForm({ ...addUserForm, role: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Admin (Full System Control)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Manager">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                          <span>Manager (Create & Edit Keys/Models)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Viewer (Read-Only + Playground)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSubmitting ? "Saving..." : "Add User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!canManageUsers && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Role Restrictions Active:</strong> You are logged in as <strong>{currentUser.name} ({currentUser.role})</strong>. User management and role assignments require Administrator role.
            </span>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="text-xs h-7 border-amber-300 text-amber-900 bg-amber-100 hover:bg-amber-200 shrink-0"
            onClick={() => {
              const adminUser = users.find(u => u.role === "Admin");
              if (adminUser) onSwitchUser(adminUser);
            }}
          >
            Switch to Admin Session
          </Button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-neutral-200 shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-neutral-500">Total Team Members</p>
              <h3 className="text-2xl font-bold text-neutral-900 mt-1">{users.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-700">Administrators</p>
              <h3 className="text-2xl font-bold text-indigo-950 mt-1">{adminCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-700">Managers</p>
              <h3 className="text-2xl font-bold text-blue-950 mt-1">{managerCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-neutral-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700">Viewers</p>
              <h3 className="text-2xl font-bold text-emerald-950 mt-1">{viewerCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="roster" className="w-full">
        <TabsList className="bg-neutral-100/80 p-1 border border-neutral-200">
          <TabsTrigger value="roster" className="gap-2 text-xs">
            <Users className="w-3.5 h-3.5" />
            Team Roster & Role Assignments
          </TabsTrigger>
          <TabsTrigger value="matrix" className="gap-2 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            Permissions Matrix
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="mt-4 space-y-4">
          <Card className="border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <Input 
                  placeholder="Search user name or email..." 
                  className="pl-9 h-9 text-xs bg-white"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9 text-xs w-36 bg-white">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="Admin">Admin Only</SelectItem>
                    <SelectItem value="Manager">Manager Only</SelectItem>
                    <SelectItem value="Viewer">Viewer Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-100/50">
                  <TableHead className="w-72 text-xs">User Member</TableHead>
                  <TableHead className="text-xs">Role Assignment</TableHead>
                  <TableHead className="text-xs">Session Switcher</TableHead>
                  <TableHead className="text-xs">Added On</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => {
                  const isCurrent = user.id === currentUser.id;
                  return (
                    <TableRow key={user.id} className={cn("hover:bg-neutral-50/80", isCurrent && "bg-indigo-50/40")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-full text-white font-semibold flex items-center justify-center text-xs shadow-xs shrink-0", user.avatar_color || "bg-indigo-600")}>
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm text-neutral-900 truncate">{user.name}</span>
                              {isCurrent && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5 bg-indigo-100 text-indigo-700 font-normal shrink-0">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-neutral-500 truncate block">{user.email}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {canManageUsers ? (
                          <Select 
                            value={user.role} 
                            onValueChange={(newRole: UserRole) => onUpdateUserRole(user.id, newRole)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32 border-neutral-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="Viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={cn(
                            "text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit",
                            user.role === "Admin" && "bg-indigo-100 text-indigo-800 border border-indigo-200",
                            user.role === "Manager" && "bg-blue-100 text-blue-800 border border-blue-200",
                            user.role === "Viewer" && "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          )}>
                            {user.role === "Admin" && <Crown className="w-3 h-3" />}
                            {user.role === "Manager" && <Briefcase className="w-3 h-3" />}
                            {user.role === "Viewer" && <Eye className="w-3 h-3" />}
                            {user.role}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {isCurrent ? (
                          <span className="text-xs font-medium text-indigo-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Logged In
                          </span>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-xs text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 border border-neutral-200"
                            onClick={() => onSwitchUser(user)}
                          >
                            Switch Session
                          </Button>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-neutral-500">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "System Default"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={!canManageUsers || isCurrent}
                          className="h-8 w-8 p-0 text-neutral-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                          onClick={() => onDeleteUser(user.id)}
                          title={!canManageUsers ? "Requires Admin role to delete users" : "Delete user"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-neutral-400 text-sm">
                      No matching team members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <Card className="border-neutral-200 shadow-sm overflow-hidden p-6">
            <div className="mb-6">
              <h3 className="text-base font-semibold text-neutral-900">Role Permissions Matrix</h3>
              <p className="text-xs text-neutral-500 mt-1">
                Granular security matrix specifying functional limits across Admin, Manager, and Viewer roles.
              </p>
            </div>

            <div className="overflow-x-auto">
              <Table className="border border-neutral-200 rounded-lg">
                <TableHeader>
                  <TableRow className="bg-neutral-100/70">
                    <TableHead className="w-64 text-xs font-semibold text-neutral-800">Capability / Feature</TableHead>
                    <TableHead className="text-xs font-semibold text-neutral-800">Scope Description</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-indigo-700 w-28 bg-indigo-50/50">Admin</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-blue-700 w-28 bg-blue-50/50">Manager</TableHead>
                    <TableHead className="text-center text-xs font-semibold text-emerald-700 w-28 bg-emerald-50/50">Viewer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSIONS_LIST.map((p, i) => (
                    <TableRow key={p.key} className={cn("hover:bg-neutral-50", i % 2 === 0 ? "bg-white" : "bg-neutral-50/30")}>
                      <TableCell className="font-medium text-xs text-neutral-900">
                        <div className="space-y-0.5">
                          <div>{p.name}</div>
                          <span className="text-[10px] text-neutral-400 font-normal">{p.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-neutral-600">{p.description}</TableCell>
                      
                      <TableCell className="text-center bg-indigo-50/20">
                        {p.admin ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-neutral-300 mx-auto" />
                        )}
                      </TableCell>

                      <TableCell className="text-center bg-blue-50/20">
                        {p.manager ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-neutral-300 mx-auto" />
                        )}
                      </TableCell>

                      <TableCell className="text-center bg-emerald-50/20">
                        {p.viewer ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-red-400 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default function App() {
  const [dbStatus, setDbStatus] = useState<{ status: string; message: string; error?: string }>({ status: "checking", message: "Checking connection..." });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [keySortOrder, setKeySortOrder] = useState<"newest" | "last_used" | "expiry">("newest");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<Record<string | number, { status: string; count: number; error?: string }>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<(number | string)[]>([]);
  const [modelSortConfig, setModelSortConfig] = useState<{ key: keyof AiModel; direction: 'asc' | 'desc' }>({ 
    key: 'model_name', 
    direction: 'asc' 
  });

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant: "default" | "destructive";
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default"
  });

  // Form states
  const [newKey, setNewKey] = useState({ provider: "Gemini", name: "", key_value: "", expires_at: "" });
  const [newModel, setNewModel] = useState({ provider: "Gemini", model_name: "", model_id: "" });

  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"dashboard" | "manager" | "playground" | "users">("manager");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // User & RBAC state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser>({
    id: "user_1",
    name: "Sarah Connor (Admin)",
    email: "sarah.admin@company.com",
    role: "Admin",
    avatar_color: "bg-indigo-600"
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          if (data.length > 0) {
            // retain active user session if possible
            const existing = data.find((u: AppUser) => u.id === currentUser.id || u.email === currentUser.email);
            if (existing) {
              setCurrentUser(existing);
            } else if (!currentUser.id) {
              setCurrentUser(data[0]);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  };

  const handleAddUser = async (newUser: { name: string; email: string; role: UserRole }) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": currentUser.role
      },
      body: JSON.stringify(newUser)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create user");
    }
    const data = await res.json();
    toast.success(`User '${data.name}' added with role ${data.role}`);
    await fetchUsers();
  };

  const handleUpdateUserRole = async (id: number | string, role: UserRole) => {
    const res = await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": currentUser.role
      },
      body: JSON.stringify({ role })
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to update user role");
      return;
    }
    toast.success(`Updated role to ${role}`);
    await fetchUsers();
  };

  const handleDeleteUser = async (id: number | string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: {
        "x-user-role": currentUser.role
      }
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to delete user");
      return;
    }
    toast.success("User deleted successfully");
    await fetchUsers();
  };

  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, options);
        
        if (res.ok) return await res.json();
        
        let errorMsg = `HTTP error! status: ${res.status}`;
        try {
          const text = await res.text();
          if (text) {
            try {
              const errorData = JSON.parse(text);
              if (errorData.error?.message) {
                errorMsg = errorData.error.message;
              } else if (errorData.message) {
                errorMsg = errorData.message;
              } else if (errorData.error) {
                errorMsg = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
              }
            } catch (e) {
              // Not JSON, use the text if it's short
              errorMsg = text.length < 500 ? text : text.substring(0, 500) + "...";
            }
          }
        } catch (e) {
          console.error("Error reading response body:", e);
        }

        // Non-retriable errors
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new Error(errorMsg);
        }

        if (i === retries) throw new Error(errorMsg);
        
        console.warn(`Retrying fetch (${i + 1}/${retries}) for ${url} due to status ${res.status}`);
      } catch (err) {
        if (i === retries || (err instanceof Error && !err.message.includes("status"))) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
      }
    }
  };

  const validateKey = async (provider: string, key: string) => {
    const trimmedKey = key.trim();
    if (!trimmedKey) throw new Error("API key is empty");

    try {
      if (provider === "Gemini") {
        if (trimmedKey.startsWith('{')) {
          throw new Error("Invalid key format: It looks like you provided a Service Account JSON. Please use a standard Gemini API Key (usually starts with 'AIza').");
        }
        console.log("Validating Gemini key in frontend using SDK...");
        const ai = new GoogleGenAI({ apiKey: trimmedKey });
        const response = await ai.models.list();
        // If we can list models, the key is valid.
        // We just need to check if we can get at least one model or if it doesn't throw.
        for await (const _ of response) {
          break; // Just need to know it works
        }
        return true;
      }

      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key_value: trimmedKey })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || res.statusText);
      }
      
      return true;
    } catch (error: any) {
      console.error(`Validation failed for ${provider}:`, error);
      throw new Error(`Invalid ${provider} API Key: ${error.message || "Verification failed"}`);
    }
  };

  const syncModels = async () => {
    if (apiKeys.length === 0) {
      toast.error("No API keys found. Please add keys first.");
      return;
    }
    
    setIsSyncing(true);
    setSyncProgress({});
    toast.info("Starting model synchronization...");
    
    let totalSyncCount = 0;
    let totalErrorCount = 0;

    try {
      const syncPromises = apiKeys.map(async (key) => {
        setSyncProgress(prev => ({ ...prev, [key.id]: { status: 'syncing', count: 0 } }));
        try {
          let models: { id: string; name: string }[] = [];
          
          if (key.provider === "Gemini") {
            const rawKey = key.key_value.trim();
            if (!rawKey) throw new Error("API key is empty");
            
            if (rawKey.startsWith('{')) {
              throw new Error("Invalid key format: It looks like you provided a Service Account JSON. Please use a standard Gemini API Key (usually starts with 'AIza').");
            }

            try {
              const ai = new GoogleGenAI({ apiKey: rawKey });
              const response = await ai.models.list();
              
              const fetchedModels: { id: string; name: string }[] = [];
              for await (const m of response) {
                fetchedModels.push({
                  id: m.name.replace('models/', ''),
                  name: m.displayName || m.name.replace('models/', '')
                });
              }
              models = fetchedModels;
            } catch (sdkError: any) {
              console.warn(`Gemini SDK sync failed for ${key.name}:`, sdkError);
              
              const encodedKey = encodeURIComponent(rawKey);
              try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodedKey}`;
                const data = await fetchWithRetry(url);
                if (data && data.models) {
                  models = data.models.map((m: any) => ({
                    id: m.name.replace('models/', ''),
                    name: m.displayName || m.name.replace('models/', '')
                  }));
                }
              } catch (fetchError: any) {
                console.error(`Gemini fetch sync also failed for ${key.name}:`, fetchError);
                throw fetchError;
              }
            }
          } else if (key.provider === "OpenAI") {
            const trimmedKey = key.key_value.trim();
            const data = await fetchWithRetry(`https://api.openai.com/v1/models`, {
              headers: { "Authorization": `Bearer ${trimmedKey}` }
            });
            if (data.data) {
              models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
            }
          } else if (key.provider === "DeepSeek") {
            const trimmedKey = key.key_value.trim();
            const data = await fetchWithRetry(`https://api.deepseek.com/models`, {
              headers: { "Authorization": `Bearer ${trimmedKey}` }
            });
            if (data.data) {
              models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
            }
          } else if (key.provider === "Groq") {
            const trimmedKey = key.key_value.trim();
            const data = await fetchWithRetry(`https://api.groq.com/openai/v1/models`, {
              headers: { "Authorization": `Bearer ${trimmedKey}` }
            });
            if (data.data) {
              models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
            }
          } else if (key.provider === "Mistral" || key.provider === "Codestral") {
            const trimmedKey = key.key_value.trim();
            const data = await fetchWithRetry(`https://api.mistral.ai/v1/models`, {
              headers: { "Authorization": `Bearer ${trimmedKey}` }
            });
            if (data.data) {
              models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
            }
          } else if (key.provider === "OpenRouter") {
            const data = await fetchWithRetry(`https://openrouter.ai/api/v1/models`);
            if (data.data) {
              models = data.data.map((m: any) => ({ id: m.id, name: m.name || m.id }));
            }
          }

          // Save models to backend in batches
          let keySyncCount = 0;
          if (models.length > 0) {
            // Update last used timestamp
            await fetch(`/api/api-keys/${key.id}/last-used`, { method: "PATCH" });
            
            const batchSize = 50;
            for (let i = 0; i < models.length; i += batchSize) {
              const chunk = models.slice(i, i + batchSize).map(m => ({
                provider: key.provider,
                model_name: m.name,
                model_id: m.id
              }));
              
              try {
                const res = await fetch("/api/ai-models/batch", {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "x-user-role": currentUser.role
                  },
                  body: JSON.stringify({ models: chunk })
                });
                if (res.ok) {
                  keySyncCount += chunk.length;
                  setSyncProgress(prev => ({ 
                    ...prev, 
                    [key.id]: { status: 'syncing', count: keySyncCount } 
                  }));
                } else {
                  console.error("Batch save failed:", await res.text());
                }
              } catch (e) {
                console.error("Failed to save model batch:", e);
              }
            }
          }
          
          totalSyncCount += keySyncCount;
          setSyncProgress(prev => ({ 
            ...prev, 
            [key.id]: { status: 'done', count: keySyncCount } 
          }));
        } catch (e: any) {
          totalErrorCount++;
          console.error(`Failed to sync for ${key.provider} (${key.name}):`, e);
          setSyncProgress(prev => ({ 
            ...prev, 
            [key.id]: { status: 'error', count: 0, error: e.message } 
          }));
        }
      });

      await Promise.all(syncPromises);
      
      if (totalSyncCount > 0) {
        toast.success(`Successfully synced ${totalSyncCount} models!`);
      }
      if (totalErrorCount > 0) {
        toast.warning(`${totalErrorCount} provider(s) failed to sync.`);
      }
      fetchData();
    } catch (error) {
      console.error("Sync process failed:", error);
      toast.error("Synchronization process encountered a major error.");
    } finally {
      setIsSyncing(false);
      // Keep progress visible for 5 seconds after completion
      setTimeout(() => {
        setSyncProgress({});
      }, 5000);
    }
  };

  const handleResetDefaultModels = async () => {
    try {
      toast.info("Restoring default models...");
      const res = await fetch("/api/ai-models/reset-defaults", { 
        method: "POST",
        headers: { "x-user-role": currentUser.role }
      });
      if (res.ok) {
        toast.success("Default seed models successfully restored!");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to restore default models.");
      }
    } catch (e) {
      toast.error("Error restoring default models.");
    }
  };

  const generateKeyName = (provider: string, currentKeys: ApiKey[]) => {
    const providerKeys = currentKeys.filter(k => k.provider === provider);
    let maxNum = 0;
    const prefix = `${provider} K`;
    
    providerKeys.forEach(k => {
      if (k.name.startsWith(prefix)) {
        const numPart = k.name.slice(prefix.length);
        const num = parseInt(numPart);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    
    return `${prefix}${maxNum + 1}`;
  };

  const handleProviderChange = (provider: string) => {
    const autoName = generateKeyName(provider, apiKeys);
    setNewKey({ ...newKey, provider, name: autoName });
  };

  const fetchData = async () => {
    try {
      const [keysRes, modelsRes, healthRes] = await Promise.all([
        fetch("/api/api-keys"),
        fetch("/api/ai-models"),
        fetch("/api/db-health")
      ]);

      const keys = await keysRes.json();
      const models = await modelsRes.json();
      const health = await healthRes.json();

      setApiKeys(keys);
      setAiModels(models);
      setDbStatus(health);
      await fetchUsers();
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast.error("Failed to sync with server");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddKey = async () => {
    console.log("Attempting to save API key:", newKey);
    if (!newKey.name || !newKey.key_value) {
      toast.error("Please fill in all fields");
      return;
    }

    const validationToastId = toast.loading(`Validating ${newKey.provider} API key...`);

    try {
      // Validate the key before saving
      await validateKey(newKey.provider, newKey.key_value);
      
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify(newKey)
      });
      
      if (res.ok) {
        toast.success("API Key validated and added successfully", { id: validationToastId });
        setNewKey({ ...newKey, name: "", key_value: "" });
        setIsKeyDialogOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        console.error("Server error adding key:", errorData);
        toast.error(`Failed to add API Key: ${errorData.error || res.statusText}`, { id: validationToastId });
      }
    } catch (error: any) {
      console.error("Error validating or adding key:", error);
      toast.error(error.message || "Failed to validate API Key", { id: validationToastId });
    }
  };

  const handleDeleteKey = async (id: number | string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete API Key",
      description: "Are you sure you want to delete this API key? This action cannot be undone.",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/api-keys/${id}`, { 
            method: "DELETE",
            headers: { "x-user-role": currentUser.role }
          });
          if (res.ok) {
            toast.success("API Key deleted");
            fetchData();
          } else {
            const err = await res.json();
            toast.error(err.error || "Failed to delete API Key");
          }
        } catch (error) {
          toast.error("Failed to delete API Key");
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddModel = async () => {
    console.log("Attempting to add AI model:", newModel);
    if (!newModel.model_name || !newModel.model_id) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      const res = await fetch("/api/ai-models", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify(newModel)
      });
      if (res.ok) {
        toast.success("AI Model added successfully");
        setNewModel({ ...newModel, model_name: "", model_id: "" });
        setIsModelDialogOpen(false);
        fetchData();
      } else {
        const errorData = await res.json();
        console.error("Server error adding model:", errorData);
        toast.error(`Failed to add AI Model: ${errorData.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Network error adding model:", error);
      toast.error("Failed to add AI Model: Network error");
    }
  };

  const handleDeleteModel = async (id: number | string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete AI Model",
      description: "Are you sure you want to delete this model?",
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/ai-models/${id}`, { 
            method: "DELETE",
            headers: { "x-user-role": currentUser.role }
          });
          if (res.ok) {
            toast.success("AI Model deleted");
            setSelectedModelIds(prev => prev.filter(mid => mid !== id));
            fetchData();
          } else {
            const err = await res.json();
            toast.error(err.error || "Failed to delete AI Model");
          }
        } catch (error) {
          toast.error("Failed to delete AI Model");
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleModelStatus = async (id: number | string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/ai-models/${id}/status`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success(`Model status updated to ${newStatus}`);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update model status");
      }
    } catch (error) {
      toast.error("Network error updating model status");
    }
  };

  const handleTogglePlayground = async (id: number | string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/ai-models/${id}/playground`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify({ is_playground: !currentVal })
      });
      if (res.ok) {
        toast.success(!currentVal ? "Added to Playground" : "Removed from Playground");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update Playground status");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const handleToggleFavorite = async (id: number | string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/ai-models/${id}/favorite`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify({ is_favorite: !currentVal })
      });
      if (res.ok) {
        toast.success(!currentVal ? "Added to Favorites" : "Removed from Favorites");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update Favorite status");
      }
    } catch (error) {
      toast.error("Network error");
    }
  };

  const handleBulkPlaygroundUpdate = async (is_playground: boolean) => {
    if (selectedModelIds.length === 0) return;
    
    try {
      const res = await fetch("/api/ai-models/bulk-playground", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify({ ids: selectedModelIds, is_playground })
      });
      if (res.ok) {
        toast.success(`${selectedModelIds.length} models updated in Playground`);
        setSelectedModelIds([]);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update models in Playground");
      }
    } catch (error) {
      toast.error("Network error during bulk playground update");
    }
  };

  const handleBulkDeleteModels = async () => {
    if (selectedModelIds.length === 0) return;
    
    setConfirmDialog({
      isOpen: true,
      title: "Bulk Delete Models",
      description: `Are you sure you want to delete ${selectedModelIds.length} models? This action cannot be undone.`,
      variant: "destructive",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/ai-models/bulk-delete", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-user-role": currentUser.role
            },
            body: JSON.stringify({ ids: selectedModelIds })
          });
          if (res.ok) {
            toast.success(`${selectedModelIds.length} models deleted successfully`);
            setSelectedModelIds([]);
            fetchData();
          } else {
            const err = await res.json();
            toast.error(err.error || "Failed to delete models");
          }
        } catch (error) {
          toast.error("Network error during bulk delete");
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkStatusUpdate = async (status: 'active' | 'inactive') => {
    if (selectedModelIds.length === 0) return;
    
    try {
      const res = await fetch("/api/ai-models/bulk-status", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-role": currentUser.role
        },
        body: JSON.stringify({ ids: selectedModelIds, status })
      });
      if (res.ok) {
        toast.success(`${selectedModelIds.length} models updated to ${status}`);
        setSelectedModelIds([]);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to update models to ${status}`);
      }
    } catch (error) {
      toast.error("Network error during bulk status update");
    }
  };

  const toggleModelSelection = (id: number | string) => {
    setSelectedModelIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const toggleAllModels = () => {
    if (selectedModelIds.length === filteredModels.length && filteredModels.length > 0) {
      setSelectedModelIds([]);
    } else {
      setSelectedModelIds(filteredModels.map(m => m.id));
    }
  };

  const handleSortModels = (key: keyof AiModel) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (modelSortConfig.key === key && modelSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setModelSortConfig({ key, direction });
  };

  const filteredModels = aiModels
    .filter(model => {
      const name = model.model_name || "";
      const mid = model.model_id || "";
      const q = searchQuery.toLowerCase();
      const matchesSearch = name.toLowerCase().includes(q) || mid.toLowerCase().includes(q);
      const matchesProvider = providerFilter === "all" || model.provider === providerFilter;
      const matchesStatus = statusFilter === "all" || model.status === statusFilter;
      return matchesSearch && matchesProvider && matchesStatus;
    })
    .sort((a, b) => {
      const aValue = (a[modelSortConfig.key] ?? "").toString();
      const bValue = (b[modelSortConfig.key] ?? "").toString();
      
      if (aValue < bValue) {
        return modelSortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return modelSortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });



  return (
    <div className="min-h-screen bg-neutral-50 flex font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 z-[140] md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop & Mobile) */}
      <aside className={cn(
        "bg-white border-r border-neutral-200 transition-all duration-300 flex flex-col z-[150]",
        // Desktop classes
        "hidden md:flex",
        isSidebarOpen ? "w-64" : "w-20",
        // Mobile classes
        "fixed inset-y-0 left-0 transform md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0 flex w-64" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-bold text-neutral-900 truncate">AI Platform</span>}
          </div>
          {isMobileMenuOpen && (
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)} className="md:hidden">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              setActiveMenu("dashboard");
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              activeMenu === "dashboard" 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <LayoutDashboard className={cn("w-5 h-5 shrink-0", activeMenu === "dashboard" ? "text-white" : "text-neutral-400 group-hover:text-neutral-600")} />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">Dashboard</span>}
          </button>

          <button
            onClick={() => {
              setActiveMenu("manager");
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              activeMenu === "manager" 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <Settings className={cn("w-5 h-5 shrink-0", activeMenu === "manager" ? "text-white" : "text-neutral-400 group-hover:text-neutral-600")} />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium font-sans">Keys & Models</span>}
          </button>

          <button
            onClick={() => {
              setActiveMenu("playground");
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              activeMenu === "playground" 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <Sparkles className={cn("w-5 h-5 shrink-0", activeMenu === "playground" ? "text-white" : "text-neutral-400 group-hover:text-neutral-600")} />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="font-medium">Playground</span>}
          </button>

          <button
            onClick={() => {
              setActiveMenu("users");
              setIsMobileMenuOpen(false);
            }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
              activeMenu === "users" 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <ShieldCheck className={cn("w-5 h-5 shrink-0", activeMenu === "users" ? "text-white" : "text-neutral-400 group-hover:text-neutral-600")} />
            {(isSidebarOpen || isMobileMenuOpen) && (
              <div className="flex items-center justify-between w-full pr-1">
                <span className="font-medium">Users & RBAC</span>
                <Badge variant="secondary" className="text-[9px] py-0 px-1 bg-indigo-100 text-indigo-700 border-none font-semibold">
                  {currentUser.role}
                </Badge>
              </div>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-neutral-100 hidden md:block">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 transition-colors"
          >
            <Menu className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="text-xs font-medium">Collapse Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 h-screen", activeMenu === "playground" ? "overflow-hidden" : "overflow-y-auto")}>
        {/* Mobile Top Bar */}
        {!isMobileMenuOpen && activeMenu !== "playground" && (
          <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-neutral-200 sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
                <Menu className="w-6 h-6" />
              </Button>
              <span className="font-bold text-neutral-900">AI Platform</span>
            </div>

            <Select value={currentUser.id?.toString()} onValueChange={(val) => {
              const selected = users.find(u => u.id.toString() === val);
              if (selected) {
                setCurrentUser(selected);
                toast.info(`Switched session to ${selected.name} (${selected.role})`);
              }
            }}>
              <SelectTrigger className="h-8 px-2 text-xs bg-white border-neutral-200 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-4 h-4 rounded-full text-white font-bold flex items-center justify-center text-[9px]", currentUser.avatar_color || "bg-indigo-600")}>
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="font-medium">{currentUser.role}</span>
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={cn(
          activeMenu === "playground" 
            ? "w-full h-full p-0 max-w-none space-y-0" 
            : "max-w-7xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 md:p-10"
        )}>
          {/* Header (Desktop) */}
          {activeMenu !== "playground" && (
            <div className="hidden md:flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200/60">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                  {activeMenu === "dashboard" && "Platform Dashboard"}
                  {activeMenu === "manager" && "API Keys & AI Models"}
                  {activeMenu === "users" && "User Access Control"}
                </h1>
                <p className="text-sm text-neutral-500 mt-1">
                  {activeMenu === "dashboard" && "Overview of your AI infrastructure, provider metrics, and database health."}
                  {activeMenu === "manager" && "Manage API keys and active AI models across multiple providers."}
                  {activeMenu === "users" && "Manage team accounts, assign RBAC roles, and inspect permission boundaries."}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {/* User Session Switcher Pill */}
                <Select value={currentUser.id?.toString()} onValueChange={(val) => {
                  const selected = users.find(u => u.id.toString() === val);
                  if (selected) {
                    setCurrentUser(selected);
                    toast.info(`Switched session to ${selected.name} (${selected.role})`);
                  }
                }}>
                  <SelectTrigger className="h-9 px-3 bg-white border-neutral-200 gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-xs shadow-xs", currentUser.avatar_color || "bg-indigo-600")}>
                        {currentUser.name.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-neutral-800">{currentUser.name}</span>
                      <Badge className={cn(
                        "text-[9px] py-0 px-1.5 font-medium ml-1",
                        currentUser.role === "Admin" && "bg-indigo-100 text-indigo-800 border-indigo-200",
                        currentUser.role === "Manager" && "bg-blue-100 text-blue-800 border-blue-200",
                        currentUser.role === "Viewer" && "bg-emerald-100 text-emerald-800 border-emerald-200"
                      )}>
                        {currentUser.role}
                      </Badge>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="end" className="w-64">
                    <div className="px-2 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Switch Active Role / User
                    </div>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        <div className="flex items-center gap-2 py-1">
                          <div className={cn("w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0", u.avatar_color || "bg-indigo-600")}>
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-medium text-neutral-900">{u.name}</span>
                            <span className="text-[10px] text-neutral-500">{u.role} &bull; {u.email}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className={`flex items-center w-fit gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  dbStatus.status === "ok" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {dbStatus.status === "ok" ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  <span className="whitespace-nowrap">DB: {dbStatus.message}</span>
                </div>
              </div>
            </div>
          )}

          {/* Header (Mobile Title Only) */}
          {activeMenu !== "playground" && (
            <div className="md:hidden space-y-1">
              <h1 className="text-xl font-bold text-neutral-900">
                {activeMenu === "dashboard" && "Platform Dashboard"}
                {activeMenu === "manager" && "API Keys & AI Models"}
                {activeMenu === "users" && "User Access Control"}
              </h1>
              <p className="text-xs text-neutral-500">
                Logged in as <strong>{currentUser.name}</strong> ({currentUser.role})
              </p>
            </div>
          )}

          {activeMenu === "dashboard" ? (
            <DashboardView apiKeys={apiKeys} aiModels={aiModels} />
          ) : activeMenu === "playground" ? (
            <PlaygroundView 
              apiKeys={apiKeys} 
              aiModels={aiModels} 
              handleToggleFavorite={handleToggleFavorite}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          ) : activeMenu === "users" ? (
            <UsersRbacView 
              users={users}
              currentUser={currentUser}
              onSwitchUser={setCurrentUser}
              onAddUser={handleAddUser}
              onUpdateUserRole={handleUpdateUserRole}
              onDeleteUser={handleDeleteUser}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          ) : (
            <Tabs defaultValue="keys" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 sm:mb-8">
            <TabsTrigger value="keys" className="flex items-center gap-2">
              <Key className="w-4 h-4" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="models" className="flex items-center gap-2">
              <Database className="w-4 h-4" /> AI Models
            </TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-neutral-800">API Key Store</h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sort By:</span>
                  <Select value={keySortOrder} onValueChange={(v: any) => setKeySortOrder(v)}>
                    <SelectTrigger className="w-[120px] sm:w-[140px] h-9">
                      <SelectValue placeholder="Sort By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="last_used">Last Used</SelectItem>
                      <SelectItem value="expiry">Expiry Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Dialog open={isKeyDialogOpen} onOpenChange={(open) => {
                  setIsKeyDialogOpen(open);
                  if (open) {
                    const autoName = generateKeyName(newKey.provider, apiKeys);
                    setNewKey({ ...newKey, name: autoName });
                  }
                }}>
                  <DialogTrigger render={<Button className="flex items-center gap-2" />}>
                    <Plus className="w-4 h-4" /> Add New Key
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add API Key</DialogTitle>
                      <DialogDescription>Store a new API key for your AI providers.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Provider</label>
                        <Select value={newKey.provider} onValueChange={handleProviderChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Key Name (e.g., Gemini K1)</label>
                        <Input 
                          placeholder="Enter key name" 
                          value={newKey.name} 
                          onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Key Value</label>
                        <Input 
                          type="password" 
                          placeholder="Paste your API key here" 
                          value={newKey.key_value} 
                          onChange={(e) => setNewKey({ ...newKey, key_value: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> Expiry Date (Optional)
                        </label>
                        <Input 
                          type="date" 
                          value={newKey.expires_at} 
                          onChange={(e) => setNewKey({ ...newKey, expires_at: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewKey({ ...newKey, name: "", key_value: "", expires_at: "" })}>Cancel</Button>
                      <Button onClick={handleAddKey}>Save Key</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {providers.map(provider => {
                const keys = apiKeys
                  .filter(k => k.provider === provider)
                  .sort((a, b) => {
                    if (keySortOrder === "last_used") {
                      const dateA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
                      const dateB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
                      return dateB - dateA;
                    }
                    if (keySortOrder === "expiry") {
                      const dateA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
                      const dateB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
                      return dateA - dateB;
                    }
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  });
                  
                if (keys.length === 0) return null;
                return (
                  <Card key={provider} className="border-neutral-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center justify-between">
                        {provider}
                        <Badge variant="secondary" className="font-normal">{keys.length} Keys</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {keys.map(key => {
                        const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
                        const isExpiringSoon = key.expires_at && !isExpired && 
                          (new Date(key.expires_at).getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);
                        const isUnused = !key.last_used_at && 
                          (new Date().getTime() - new Date(key.created_at).getTime()) > (30 * 24 * 60 * 60 * 1000);

                        return (
                          <div key={key.id} className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3",
                            isExpired ? "bg-red-50 border-red-200" : "bg-neutral-100/50 border-neutral-200/50"
                          )}>
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <p className="text-sm font-medium text-neutral-700 truncate">{key.name}</p>
                                {isExpired && <Badge variant="destructive" className="h-4 text-[10px] px-1">Expired</Badge>}
                                {isExpiringSoon && <Badge variant="outline" className="h-4 text-[10px] px-1 border-amber-500 text-amber-600 bg-amber-50">Expiring Soon</Badge>}
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <p className="text-xs text-neutral-400 font-mono truncate">••••••••••••••••</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {key.expires_at && (
                                    <p className={cn("text-[10px] flex items-center gap-1", isExpired ? "text-red-500" : "text-neutral-500")}>
                                      <Calendar className="w-3 h-3" /> {new Date(key.expires_at).toLocaleDateString()}
                                    </p>
                                  )}
                                  {key.last_used_at ? (
                                    <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> {new Date(key.last_used_at).toLocaleDateString()}
                                    </p>
                                  ) : (
                                    <p className={cn("text-[10px] flex items-center gap-1", isUnused ? "text-amber-600" : "text-neutral-400")}>
                                      <Clock className="w-3 h-3" /> Never
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="mt-2 pt-2 border-t border-neutral-200/50">
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Usage Analytics</p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <RefreshCw className="w-3 h-3 text-neutral-400" />
                                    <span className="text-[10px] text-neutral-600">Total Calls:</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-primary">{key.usage_count || 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-red-500 h-8 w-8" onClick={() => handleDeleteKey(key.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* AI Models Tab */}
          <TabsContent value="models" className="space-y-6">
            {Object.keys(syncProgress).length > 0 && (
              <Card className="p-4 bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                  <h3 className="text-sm font-semibold text-primary">Sync Progress</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {apiKeys.filter(k => syncProgress[k.id]).map(key => {
                    const progress = syncProgress[key.id];
                    return (
                      <div key={key.id} className="flex items-center justify-between p-2 rounded bg-white border border-neutral-100 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-neutral-700 truncate max-w-[120px]">{key.name}</span>
                          <span className="text-[10px] text-neutral-400">{key.provider}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {progress.status === 'syncing' && (
                            <span className="text-[10px] font-mono text-primary animate-pulse">
                              {progress.count} models...
                            </span>
                          )}
                          {progress.status === 'done' && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-100">
                              {progress.count} models
                            </Badge>
                          )}
                          {progress.status === 'error' && (
                            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-100" title={progress.error}>
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-neutral-800">AI Model Registry</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <Input 
                    placeholder="Search models..." 
                    className="pl-9" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {selectedModelIds.length > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                      <Select onValueChange={(val) => {
                        if (val === 'active' || val === 'inactive') handleBulkStatusUpdate(val);
                        if (val === 'playground') handleBulkPlaygroundUpdate(true);
                        if (val === 'remove_playground') handleBulkPlaygroundUpdate(false);
                      }}>
                        <SelectTrigger className="h-9 w-[130px] bg-primary/10 border-primary/20 text-primary font-medium">
                          <SelectValue placeholder="Bulk Action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active" className="text-green-600">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-3.5 h-3.5" /> Activate
                            </div>
                          </SelectItem>
                          <SelectItem value="inactive" className="text-neutral-500">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="w-3.5 h-3.5" /> Deactivate
                            </div>
                          </SelectItem>
                          <SelectItem value="playground" className="text-primary">
                            <div className="flex items-center gap-2">
                              <Plus className="w-3.5 h-3.5" /> Add to Playground
                            </div>
                          </SelectItem>
                          <SelectItem value="remove_playground" className="text-neutral-400">
                            <div className="flex items-center gap-2">
                              <Minus className="w-3.5 h-3.5" /> Remove from Playground
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center gap-1 h-9"
                        onClick={handleBulkDeleteModels}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete ({selectedModelIds.length})
                      </Button>
                    </div>
                  )}
                  
                  <Select value={providerFilter} onValueChange={setProviderFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="All Providers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Providers</SelectItem>
                      {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`flex items-center gap-1 whitespace-nowrap ${showAdvanced ? 'text-primary' : 'text-neutral-500'}`}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    <Filter className="w-4 h-4" />
                    Advanced
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {(searchQuery !== "" || providerFilter !== "all" || statusFilter !== "all") && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-1 text-neutral-500 hover:text-neutral-900"
                      onClick={() => {
                        setSearchQuery("");
                        setProviderFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 flex-1 sm:flex-none" 
                    onClick={handleResetDefaultModels}
                  >
                    <RefreshCw className="w-4 h-4 text-neutral-500" />
                    <span className="whitespace-nowrap">Restore Defaults</span>
                  </Button>

                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2 flex-1 sm:flex-none" 
                    onClick={syncModels}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span className="whitespace-nowrap">{isSyncing ? 'Syncing...' : 'Sync Models'}</span>
                  </Button>
                  
                  <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
                    <DialogTrigger render={<Button className="flex items-center gap-2 flex-1 sm:flex-none" />}>
                      <Plus className="w-4 h-4" /> <span className="whitespace-nowrap">Add Model</span>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register AI Model</DialogTitle>
                      <DialogDescription>Add a new AI model to your registry.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Provider</label>
                        <Select value={newModel.provider} onValueChange={(v) => setNewModel({ ...newModel, provider: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Model Name (e.g., GPT-4o)</label>
                        <Input 
                          placeholder="Enter display name" 
                          value={newModel.model_name} 
                          onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Model ID (e.g., gpt-4o-2024-05-13)</label>
                        <Input 
                          placeholder="Enter technical ID" 
                          value={newModel.model_id} 
                          onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewModel({ ...newModel, model_name: "", model_id: "" })}>Cancel</Button>
                      <Button onClick={handleAddModel}>Add Model</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Confirmation Dialog */}
                <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>{confirmDialog.title}</DialogTitle>
                      <DialogDescription>
                        {confirmDialog.description}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                        Cancel
                      </Button>
                      <Button variant={confirmDialog.variant} onClick={confirmDialog.onConfirm}>
                        Confirm
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

            {showAdvanced && (
              <Card className="p-4 bg-neutral-100/30 border-neutral-200">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Sort By</label>
                    <Select 
                      value={modelSortConfig.key} 
                      onValueChange={(v: any) => setModelSortConfig({ ...modelSortConfig, key: v })}
                    >
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Sort By" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="model_name">Name</SelectItem>
                        <SelectItem value="provider">Provider</SelectItem>
                        <SelectItem value="model_id">Model ID</SelectItem>
                        <SelectItem value="created_at">Newest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1"></div>
                  
                  <div className="text-xs text-neutral-400 pb-2">
                    Showing {filteredModels.length} of {aiModels.length} models
                  </div>
                </div>
              </Card>
            )}

            <Card className="border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-neutral-100/50">
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox 
                          checked={filteredModels.length > 0 && selectedModelIds.length === filteredModels.length}
                          onCheckedChange={toggleAllModels}
                        />
                      </TableHead>
                      <TableHead 
                        className="whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSortModels('provider')}
                      >
                        <div className="flex items-center gap-1">
                          Provider
                          {modelSortConfig.key === 'provider' ? (
                            modelSortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSortModels('model_name')}
                      >
                        <div className="flex items-center gap-1">
                          Model Name
                          {modelSortConfig.key === 'model_name' ? (
                            modelSortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSortModels('model_id')}
                      >
                        <div className="flex items-center gap-1">
                          Model ID
                          {modelSortConfig.key === 'model_id' ? (
                            modelSortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="whitespace-nowrap cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleSortModels('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {modelSortConfig.key === 'status' ? (
                            modelSortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Playground</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredModels.length > 0 ? (
                      filteredModels.map((model) => (
                        <TableRow key={model.id} className={cn("hover:bg-neutral-50/50", selectedModelIds.includes(model.id) && "bg-primary/5")}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedModelIds.includes(model.id)}
                              onCheckedChange={() => toggleModelSelection(model.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{model.provider}</TableCell>
                          <TableCell className="whitespace-nowrap">{model.model_name}</TableCell>
                          <TableCell className="font-mono text-xs text-neutral-500 whitespace-nowrap">{model.model_id}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant={model.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                              {model.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleTogglePlayground(model.id, model.is_playground)}
                              className={cn(
                                "gap-1.5 h-8 px-2.5",
                                model.is_playground ? "text-primary bg-primary/5 hover:bg-primary/10" : "text-neutral-400 hover:text-neutral-500 hover:bg-neutral-100"
                              )}
                            >
                              {model.is_playground ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              {model.is_playground ? "Added" : "Add"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                  "transition-colors",
                                  model.status === 'active' ? "text-green-500 hover:text-green-600 hover:bg-green-50" : "text-neutral-400 hover:text-neutral-500 hover:bg-neutral-100"
                                )} 
                                onClick={() => handleToggleModelStatus(model.id, model.status)}
                                title={model.status === 'active' ? "Deactivate Model" : "Activate Model"}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-red-500" onClick={() => handleDeleteModel(model.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-neutral-400">
                          No models found matching your criteria.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
